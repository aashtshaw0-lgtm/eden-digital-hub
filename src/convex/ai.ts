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
      const result = await chat.sendMessage(lastUser?.text ?? "Hello");
      return { reply: result.response.text(), engine: "gemini" as const };
    }

    // Fallback: platform AI gateway (OpenAI-compatible), works with zero setup.
    const completion = await vly.ai.completion({
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
    if (!completion.success || !completion.data) {
      throw new Error(completion.error || "The assistant is unavailable right now. Please try 'Talk to Manager'.");
    }
    const reply = completion.data.choices?.[0]?.message?.content ?? "";
    return { reply, engine: "fallback" as const };
  },
});
