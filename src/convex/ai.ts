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
      `Design an original logo for: ${cleanedBrief}.`,
      `Style: ${look}.`,
      palette,
      "It is a studio wordmark or emblem used at about 240px wide in a website header and a footer.",
      "Original artwork only: do not copy, trace, redraw or imitate any existing brand, logo, trademark, mascot, character or copyrighted design, and do not reproduce a recognisable mark from another company.",
      "Flat vector illustration, crisp clean edges, balanced composition, high contrast, no photographic detail, no mockup, no frame, no drop shadow, no watermark, no extra text beyond the brand name.",
      "Centered with generous breathing room on a solid white background.",
    ].join(" ");

    // Model names move around between API versions; try the current one first
    // and fall back rather than failing the whole feature on a rename.
    const MODELS = [
      "gemini-2.5-flash-image",
      "gemini-2.5-flash-image-preview",
      "gemini-2.0-flash-preview-image-generation",
    ];

    let base64 = "";
    let mimeType = "image/png";
    let lastStatus = 0;
    let lastDetail = "";

    for (const model of MODELS) {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
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
        lastStatus = res.status;
        lastDetail = (await res.text()).slice(0, 300);
        console.warn(`[Studio/AI] logo model ${model} failed:`, res.status, lastDetail);
        // A genuinely rejected prompt fails the same way on every model, so it
        // is not worth three round trips to be told the same thing.
        const modelMissing = /not found|not supported|unsupported|does not exist/i.test(lastDetail);
        if (res.status === 400 && !modelMissing) break;
        continue;
      }

      const payload = (await res.json()) as {
        candidates?: {
          content?: { parts?: { inlineData?: { data?: string; mimeType?: string } }[] };
        }[];
      };
      const part = payload.candidates?.[0]?.content?.parts?.find((p) => p.inlineData?.data);
      if (part?.inlineData?.data) {
        base64 = part.inlineData.data;
        mimeType = part.inlineData.mimeType ?? "image/png";
        break;
      }
      lastStatus = res.status;
      lastDetail = "the model replied without an image";
    }

    if (!base64) {
      const hint =
        lastStatus === 429
          ? "This key is rate-limited or out of image quota — check the Google AI billing and quota for that key, then try again."
          : lastStatus === 401 || lastStatus === 403
            ? "This key is not allowed to use the image model. Enable the Generative Language API and use a key with image generation (billing on)."
            : lastStatus === 404
              ? "The image model is not available to this key. Enable Gemini image generation for the key, then try again."
              : lastStatus === 400
                ? "The image model rejected that brief. Try a shorter description or a different style."
                : `Logo generation failed with HTTP ${lastStatus || "no response"}.`;
      console.error("[Studio/AI] logo generation gave up:", lastStatus, lastDetail);
      throw new Error(`${hint} (${lastDetail || "no detail"})`);
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

/** Pulls the first JSON object out of a model reply, fences and prose included. */
function parseJsonObject(text: string): Record<string, unknown> | null {
  const cleaned = text.replace(/```json/gi, "").replace(/```/g, "");
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start === -1 || end === -1) return null;
  try {
    return JSON.parse(cleaned.slice(start, end + 1)) as Record<string, unknown>;
  } catch {
    return null;
  }
}

const HEX = /^#[0-9a-fA-F]{6}$/;

function cleanStrings(value: unknown, limit: number, maxChars: number): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((v): v is string => typeof v === "string")
    .map((v) => v.trim().slice(0, maxChars))
    .filter(Boolean)
    .slice(0, limit);
}

/**
 * AI brand kit — naming, taglines and colour pairs for a studio.
 *
 * Returns only values the console can apply directly: uppercase-contrast hex
 * pairs, short taglines, and logo words. Anything the model sends that does not
 * validate is dropped rather than shipped into the theme.
 */
export const brandKit = action({
  args: {
    brief: v.string(),
    /** Current colours, so the kit can suggest neighbours rather than random hits. */
    currentPrimary: v.optional(v.string()),
    currentBackground: v.optional(v.string()),
  },
  handler: async (ctx, { brief, currentPrimary, currentBackground }) => {
    const role = await ctx.runQuery(api.users.myRole, {});
    if (role !== "manager" && role !== "super_owner") {
      throw new Error("Unauthorized: only studio admins can build a brand kit.");
    }

    const prompt = [
      "You are a senior brand designer. Return STRICT JSON only, no prose, matching exactly:",
      '{"taglines":["..."],"palettes":[{"name":"...","description":"...","primary":"#RRGGBB","background":"#RRGGBB"}],"brandWords":["..."]}',
      `The brand: ${brief.trim().slice(0, 500) || "a small design studio"}.`,
      currentPrimary && currentBackground
        ? `Its current palette is ${currentPrimary} on ${currentBackground}.`
        : "",
      "Give 4 palettes, 4 taglines (max 6 words each) and 4 logo words (one or two words).",
      "Every palette is a primary (accent ink) and a background (paper). Primary must be dark or saturated enough to read as text on a light background, and background must be a light, warm, low-glare paper tone — never both dark.",
      "Keep names and descriptions premium and specific, e.g. 'Ink & Linen' — 'deep pine on unbleached paper'.",
    ]
      .filter(Boolean)
      .join("\n");

    const geminiKey = process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY;
    let raw = "";
    if (geminiKey) {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json", "x-goog-api-key": geminiKey },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: { temperature: 0.9, responseMimeType: "application/json" },
          }),
        },
      );
      if (res.ok) {
        const payload = (await res.json()) as {
          candidates?: { content?: { parts?: { text?: string }[] } }[];
        };
        raw = payload.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
      } else {
        console.warn("[Studio/AI] brand kit via Gemini failed:", res.status);
      }
    }

    if (!raw) {
      // Fallback: the platform gateway the assistant already uses.
      const completion = await vly.ai.completion({
        model: "gpt-4o-mini",
        messages: [{ role: "user", content: prompt }],
        temperature: 0.9,
        maxTokens: 700,
      });
      if (!completion.success || !completion.data) {
        throw new Error(completion.error || "The brand kit could not be built right now.");
      }
      raw = completion.data.choices?.[0]?.message?.content ?? "";
    }

    const parsed = parseJsonObject(raw);
    if (!parsed) {
      throw new Error("The model returned something unreadable. Please try again.");
    }

    const palettes = Array.isArray(parsed.palettes)
      ? parsed.palettes
          .filter((p): p is Record<string, unknown> => Boolean(p) && typeof p === "object")
          .map((p) => ({
            name: String(p.name ?? "").trim().slice(0, 40),
            description: String(p.description ?? "").trim().slice(0, 90),
            primary: String(p.primary ?? ""),
            background: String(p.background ?? ""),
          }))
          .filter((p) => HEX.test(p.primary) && HEX.test(p.background) && p.name)
          .slice(0, 4)
      : [];

    return {
      palettes,
      taglines: cleanStrings(parsed.taglines, 4, 60),
      brandWords: cleanStrings(parsed.brandWords, 4, 28),
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

    // The assistant speaks as the studio, so it uses the name set in the copy
    // deck rather than a hardcoded one.
    const copy = await ctx.runQuery(api.content.list, {});
    const brandName = copy["brand.name"]?.trim() || "the studio";

    const systemPrompt = [
      `You are ${brandName}'s senior sales assistant. ${brandName} is a digital design & management studio selling one-off creative products (logos, posters, commercial designs, YouTube thumbnails, event banners) and ongoing services (event planning, social media management).`,
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
        console.warn("[Studio/AI] Gemini failed, using fallback:", geminiErr);
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
