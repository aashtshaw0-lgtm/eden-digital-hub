import { beforeEach, describe, expect, it } from "vitest";
import { api } from "../src/convex/_generated/api";
import { createUser, makeTest, signIn } from "./harness";

let t = makeTest();

beforeEach(() => {
  t = makeTest();
  signIn(null);
});

/** Signs the next request in as a manager, which is enough to write settings. */
async function asManager() {
  const id = await createUser(t, { role: "manager" });
  signIn(id);
  return id;
}

describe("settings — the studio's domain is data, not a constant", () => {
  it("stores a bare host as an https origin without a trailing slash", async () => {
    await asManager();
    await t.mutation(api.settings.update, { siteUrl: "studio.example/" });
    const settings = await t.query(api.settings.get, {});
    expect(settings.siteUrl).toBe("https://studio.example");
  });

  it("keeps an explicit scheme, including http on localhost", async () => {
    await asManager();
    await t.mutation(api.settings.update, { siteUrl: "http://localhost:5173" });
    const settings = await t.query(api.settings.get, {});
    expect(settings.siteUrl).toBe("http://localhost:5173");
  });

  it("reads as unset before anyone has configured one", async () => {
    const settings = await t.query(api.settings.get, {});
    expect(settings.siteUrl).toBeUndefined();
    expect(settings.twitterHandle).toBeUndefined();
  });

  it("can be cleared again with an empty string", async () => {
    await asManager();
    await t.mutation(api.settings.update, { siteUrl: "studio.example" });
    await t.mutation(api.settings.update, { siteUrl: "  " });
    const settings = await t.query(api.settings.get, {});
    // Empty means "fall back to whatever origin this page is served from".
    expect(settings.siteUrl).toBeUndefined();
  });

  it("round-trips the twitter handle, trimmed, and clears with a blank", async () => {
    await asManager();
    await t.mutation(api.settings.update, { twitterHandle: "  kavi_studio " });
    expect((await t.query(api.settings.get, {})).twitterHandle).toBe("kavi_studio");

    await t.mutation(api.settings.update, { twitterHandle: "" });
    expect((await t.query(api.settings.get, {})).twitterHandle).toBeUndefined();
  });

  it("leaves the rest of the branding alone when only the domain changes", async () => {
    await asManager();
    await t.mutation(api.settings.update, {
      primaryColor: "#123456",
      upiId: "studio@bank",
      siteUrl: "studio.example",
    });
    await t.mutation(api.settings.update, { siteUrl: "other.example" });
    const settings = await t.query(api.settings.get, {});
    expect(settings.primaryColor).toBe("#123456");
    expect(settings.upiId).toBe("studio@bank");
    expect(settings.siteUrl).toBe("https://other.example");
  });

  it("refuses the domain from a customer", async () => {
    signIn(await createUser(t, { email: "nosy@example.com" }));
    await expect(
      t.mutation(api.settings.update, { siteUrl: "attacker.example" }),
    ).rejects.toThrow(/Unauthorized/i);
  });
});
