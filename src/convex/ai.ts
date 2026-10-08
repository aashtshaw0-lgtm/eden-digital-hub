"use node";

import { GoogleGenerativeAI } from "@google/generative-ai";
import { v } from "convex/values";
import { action } from "./_generated/server";
import { api, internal } from "./_generated/api";
import { vly } from "../lib/vly-integrations";

type Turn = { role: "user" | "model"; text: string };

/** Longest single message we will forward to the model. */
const MAX_MESSAGE_CHARS = 2000;
/** Cap on the whole conversation, so one call cannot ship an unbounded body. */
const MAX_HISTORY_CHARS = 8000;

/**
 * Eden's AI sales assistant.
 *
 * Primary path: Google Gemini (GOOGLE_API_KEY / GEMINI_API_KEY).
 * Fallback path: the platform AI gateway (VLY_INTEGRATION_KEY), so the chat
 * keeps working even before a Gemini key is configured.
 * The system prompt is built live from the seeded catalog, so the assistant
 * always quotes real services and prices.
 */
/**
 * AI logo studio.
 *
 * Draws a logo with Gemini's native image model and drops it straight into the
 * site's logo slot, so the studio can rebrand without a designer or a file to
 * upload. Two variants are supported: the light logo used on light surfaces and
 * the optional dark variant shown on dark ones.
 *
 * Requires GOOGLE_API_KEY (or GEMINI_API_KEY) in the Keys tab — the same key the
 * sales assistant already uses.
 */
export const generateLogo = action({
  args: {
    /** What the brand is and how the logo should feel. */
    brief: v.string(),
    /** "light" writes the main logo, "dark" writes the dark-surface variant. */
    variant: v.union(v.literal("light"), v.literal("dark")),
    /** Optional look, e.g. "minimal", "vintage", "bold editorial". */
    style: v.optional(v.string()),
  },
  handler: async (ctx, { brief, variant, style }) => {
    // Same gate as the console itself: managers and the super owner only.
    const role = await ctx.runQuery(api.users.myRole, {});
    if (role !== "manager" && role !== "super_owner") {
      throw new Error("Unauthorized: only studio admins can generate a logo.");
    }

    const apiKey = process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error(
        "Logo generation needs a Google AI key. Add GOOGLE_API_KEY in the Keys tab, then try again.",
      );
    }

    const cleanedBrief = brief.trim().slice(0, 600);
    const look = style?.trim() ? style.trim() : "premium, modern, minimal";
    const palette =
      variant === "dark"
        ? "Built for a dark background: light, luminous marks on a plain white background so it stays visible in both themes."
        : "Built for a light background: rich, confident marks on a plain white background.";

    const prompt = [
      `Design a logo for: ${cleanedBrief}.`,
      `Style: ${look}.`,
      palette,
      "It is a studio wordmark or emblem used at about 240px wide in a website header and a footer.",
      "Flat vector illustration, crisp clean edges, balanced composition, high contrast, no photographic detail, no mockup, no frame, no drop shadow, no watermark, no extra text beyond the brand name.",
      "Centered with generous breathing room on a solid white background.",
    ].join(" ");

    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-image:generateContent`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": apiKey,
        },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { responseModalities: ["IMAGE"] },
        }),
      },
    );

    if (!res.ok) {
      const detail = await res.text();
      console.warn("[Eden/AI] logo generation failed:", res.status, detail.slice(0, 500));
      throw new Error(
        res.status === 400 || res.status === 403
          ? "The image model rejected that brief. Try a shorter description or a different style."
          : "Logo generation is unavailable right now. Please try again in a moment.",
      );
    }

    const payload = (await res.json()) as {
      candidates?: { content?: { parts?: { inlineData?: { data?: string; mimeType?: string } }[] } }[];
    };
    const part = payload.candidates?.[0]?.content?.parts?.find((p) => p.inlineData?.data);
    const base64 = part?.inlineData?.data;
    const mimeType = part?.inlineData?.mimeType ?? "image/png";
    if (!base64) {
      throw new Error("The image model did not return a picture. Try rephrasing the brief.");
    }

    const bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
    const blob = new Blob([bytes], { type: mimeType });
    const storageId = await ctx.storage.store(blob);

    if (variant === "dark") {
      await ctx.runMutation(api.settings.setLogoDarkImage, { storageId });
    } else {
      await ctx.runMutation(api.settings.setLogoImage, { storageId });
    }

    return {
      storageId,
      mimeType,
      variant,
      dataUrl: `data:${mimeType};base64,${base64}`,
    };
  },
});

export const assistantReply = action({
  args: {
    history: v.array(
      v.object({
        role: v.union(v.literal("user"), v.literal("model")),
        text: v.string(),
      }),
    ),
  },
  handler: async (ctx, { history }) => {
    // Charged against the caller's own quota before any paid API is touched.
    await ctx.runMutation(internal.assistantQuota.consumeAssistantQuota, {});

    const catalog = await ctx.runQuery(api.catalog.listPublic, {});
    const settings = await ctx.runQuery(api.settings.get, {});

    const priceList = catalog
      .map(
        (s) =>
          `- ${s.name} (${s.category}) — ${s.tagline ?? ""}\n` +
          s.tiers.map((t) => `    ${t.name}: ₹${t.basePrice.toLocaleString("en-IN")} — ${t.deliverables.join("; ")}`).join("\n"),
      )
      .join("\n");

    const systemPrompt = [
      "You are Eden's senior sales assistant. Eden is a digital design & management studio selling one-off creative products (logos, posters, commercial designs, YouTube thumbnails, event banners) and ongoing services (event planning, social media management).",
      "Your job: qualify the visitor's needs, recommend the right service and tier, quote exact prices from the list below, and guide them to pick a tier on the Services page, fill the intake form, and complete checkout (manual UPI payment).",
      "Rules: be warm, concise and persuasive (max ~120 words). Never invent discounts, prices or services that are not in the list. For custom or bulk requests, invite them to click 'Talk to Manager' for a human quote. If asked about delivery, use the deliverable timelines on the tiers. Do not ask for payment details; payments happen at checkout via UPI.",
      `Current service & price list (INR):\n${priceList}`,
      settings.upiId ? `Payments go to UPI ID: ${settings.upiId}.` : "",
    ]
      .filter(Boolean)
      .join("\n\n");

    let spent = 0;
    const safeHistory: Turn[] = history
      .filter((t) => typeof t.text === "string" && t.text.trim().length > 0)
      // Bound both the turn count and the payload: without this a caller could
      // push megabytes of text through a metered endpoint in a single request.
      .slice(-12)
      .map((t) => ({ role: t.role, text: t.text.slice(0, MAX_MESSAGE_CHARS) }))
      .filter((t) => {
        const room = MAX_HISTORY_CHARS - spent;
        if (room <= 0) return false;
        const kept = t.text.slice(0, room);
        spent += kept.length;
        t.text = kept;
        return true;
      });
    const lastUser = [...safeHistory].reverse().find((t) => t.role === "user");

    const geminiKey = process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY;
    if (geminiKey) {
      const genAI = new GoogleGenerativeAI(geminiKey);
      const model = genAI.getGenerativeModel({
        model: "gemini-2.0-flash",
        systemInstruction: systemPrompt,
      });
      let priorTurns = safeHistory.filter((t) => t !== lastUser);
      // Gemini requires history to begin with a user turn.
      while (priorTurns.length > 0 && priorTurns[0].role !== "user") {
        priorTurns = priorTurns.slice(1);
      }
      const chat = model.startChat({
        history: priorTurns.map((t) => ({
          role: t.role,
          parts: [{ text: t.text }],
        })),
      });
      try {
        const result = await chat.sendMessage(lastUser?.text ?? "Hello");
        return { reply: result.response.text(), engine: "gemini" as const };
      } catch (geminiErr) {
        // If Gemini fails (e.g., model deprecation, quota), fall through to the
        // vly gateway instead of surfacing a raw error to the customer.
        console.warn("[Eden/AI] Gemini failed, using fallback:", geminiErr);
      }
    }

    // Fallback: platform AI gateway (OpenAI-compatible), works with zero setup.
    let completion: Awaited<ReturnType<typeof vly.ai.completion>>;
    try {
      completion = await vly.ai.completion({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: systemPrompt },
          ...safeHistory.map((t) => ({
            role: t.role === "user" ? ("user" as const) : ("assistant" as const),
            content: t.text,
          })),
        ],
        temperature: 0.6,
        maxTokens: 400,
      });
    } catch (vlyErr) {
      throw new Error("The assistant is temporarily unavailable. Please try 'Talk to Manager' for a human.");
    }
    if (!completion.success || !completion.data) {
      throw new Error(completion.error || "The assistant is unavailable right now. Please try 'Talk to Manager'.");
    }
    const reply = completion.data.choices?.[0]?.message?.content ?? "";
    if (!reply) {
      throw new Error("The assistant returned an empty reply. Please try again.");
    }
    return { reply, engine: "fallback" as const };
  },
});
