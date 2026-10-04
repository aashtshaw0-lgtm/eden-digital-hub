import { beforeEach, describe, expect, it } from "vitest";
import { api } from "../src/convex/_generated/api";
import { createUser, makeTest, signIn } from "./harness";

/** Fresh in-memory database per test. */
let t = makeTest();

beforeEach(() => {
  t = makeTest();
  signIn(null);
});

async function openSession() {
  const clientId = await createUser(t, { email: "client@example.com", name: "Client" });
  signIn(clientId);
  const sessionId = await t.mutation(api.chat.startSession, {});
  return { clientId, sessionId };
}

describe("chat.sendMessage — attribution", () => {
  it("labels the session owner's message as client", async () => {
    const { clientId, sessionId } = await openSession();
    await t.mutation(api.chat.sendMessage, { sessionId, content: "hey" });
    const rows = await t.run((ctx) => ctx.db.query("messages").collect());
    expect(rows[0].senderId).toBe(clientId);
    expect(rows[0].senderRole).toBe("client");
  });

  it("labels a manager's reply as manager", async () => {
    const { sessionId } = await openSession();
    const managerId = await createUser(t, { email: "boss@example.com", role: "manager" });
    signIn(managerId);
    await t.mutation(api.chat.sendMessage, { sessionId, content: "hey" });
    const rows = await t.run((ctx) => ctx.db.query("messages").collect());
    expect(rows[0].senderRole).toBe("manager");
  });

  it("labels a super owner's reply as manager even inside their own session", async () => {
    // Regression: the side used to come from session ownership, so the studio
    // owner testing their own chat had every message collapse into one column.
    process.env.SUPER_OWNER_EMAIL = "owner@example.com";
    const ownerId = await createUser(t, { email: "owner@example.com" });
    signIn(ownerId);
    const sessionId = await t.mutation(api.chat.startSession, {});
    await t.mutation(api.chat.sendMessage, { sessionId, content: "hey" });
    const rows = await t.run((ctx) => ctx.db.query("messages").collect());
    expect(rows[0].senderRole).toBe("manager");
    delete process.env.SUPER_OWNER_EMAIL;
  });

  it("re-reads the correct side even for rows stored under the old rule", async () => {
    process.env.SUPER_OWNER_EMAIL = "owner@example.com";
    const ownerId = await createUser(t, { email: "owner@example.com" });
    const clientId = await createUser(t, { email: "client@example.com" });
    const sessionId = await t.run((ctx) =>
      ctx.db.insert("chatSessions", { clientId: ownerId, status: "active", createdAt: 1 }),
    );
    // A message mislabelled "client" that the owner actually sent.
    await t.run((ctx) =>
      ctx.db.insert("messages", {
        sessionId,
        senderId: ownerId,
        senderName: "Owner",
        senderRole: "client",
        content: "hey",
        createdAt: 1,
      }),
    );
    signIn(ownerId);
    const messages = await t.query(api.chat.getMessages, { sessionId });
    expect(messages[0].senderRole).toBe("manager");
    expect(messages[0].senderId).toBe(ownerId);
    expect(clientId).toBeTruthy();
    delete process.env.SUPER_OWNER_EMAIL;
  });
});

describe("chat.getMessages — access control", () => {
  it("refuses a stranger reading someone else's thread", async () => {
    const { sessionId } = await openSession();
    signIn(await createUser(t, { email: "nosy@example.com" }));
    await expect(t.query(api.chat.getMessages, { sessionId })).rejects.toThrow(
      /Unauthorized/i,
    );
  });

  it("allows the owner and an admin", async () => {
    const { clientId, sessionId } = await openSession();
    signIn(clientId);
    await expect(t.query(api.chat.getMessages, { sessionId })).resolves.toBeDefined();

    process.env.SUPER_OWNER_EMAIL = "owner@example.com";
    signIn(await createUser(t, { email: "owner@example.com" }));
    await expect(t.query(api.chat.getMessages, { sessionId })).resolves.toBeDefined();
    delete process.env.SUPER_OWNER_EMAIL;
  });

  it("refuses a signed-out reader", async () => {
    const { sessionId } = await openSession();
    signIn(null);
    await expect(t.query(api.chat.getMessages, { sessionId })).rejects.toThrow(
      /Unauthorized/i,
    );
  });
});

describe("chat.sendMessage — abuse", () => {
  it("refuses an outsider posting into the thread", async () => {
    const { sessionId } = await openSession();
    signIn(await createUser(t, { email: "nosy@example.com" }));
    await expect(
      t.mutation(api.chat.sendMessage, { sessionId, content: "hi" }),
    ).rejects.toThrow(/Unauthorized/i);
  });

  it("ignores an empty message", async () => {
    const { sessionId } = await openSession();
    await t.mutation(api.chat.sendMessage, { sessionId, content: "   " });
    const rows = await t.run((ctx) => ctx.db.query("messages").collect());
    expect(rows).toHaveLength(0);
  });

  it("rate limits a flood", async () => {
    const { sessionId } = await openSession();
    for (let i = 0; i < 20; i++) {
      await t.mutation(api.chat.sendMessage, { sessionId, content: `m${i}` });
    }
    await expect(
      t.mutation(api.chat.sendMessage, { sessionId, content: "one too many" }),
    ).rejects.toThrow(/too fast/i);
  });
});

describe("chat.listSessions — admin only", () => {
  it("rejects a customer", async () => {
    await openSession();
    signIn(await createUser(t, { email: "nosy@example.com" }));
    await expect(t.query(api.chat.listSessions, {})).rejects.toThrow(/Unauthorized/i);
  });

  it("returns the session client to an admin", async () => {
    await openSession();
    process.env.SUPER_OWNER_EMAIL = "owner@example.com";
    signIn(await createUser(t, { email: "owner@example.com" }));
    const sessions = await t.query(api.chat.listSessions, {});
    expect(sessions[0].clientEmail).toBe("client@example.com");
    delete process.env.SUPER_OWNER_EMAIL;
  });
});