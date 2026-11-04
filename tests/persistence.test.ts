import "fake-indexeddb/auto";
import { describe, expect, it } from "vitest";
import { indexedDbKV } from "../src/lib/persistence/kv";
import { createProfile, listProfiles, loadWorld, saveWorld, setPasscode, updateProfile, verifyPasscode } from "../src/lib/persistence/profiles";
import { catchUp } from "../src/lib/sim/engine";
import { HOUR, T0, world } from "./helpers";

describe("persistence + local auth", () => {
  it("saves and restores a world through IndexedDB, then keeps simulating", async () => {
    const kv = indexedDbKV("god-sim-test");
    const p = await createProfile(kv, "God", "1234", "seedx");
    expect((await listProfiles(kv)).length).toBe(1);
    const w = world();
    await saveWorld(kv, p.id, w);
    const back = await loadWorld(kv, p.id);
    expect(back!.messages.length).toBe(w.messages.length);
    const sum = catchUp(back!, T0 + 2 * HOUR);
    expect(sum.messages).toBeGreaterThan(300);
  });

  it("passcodes are salted hashes and verify", async () => {
    const kv = indexedDbKV("god-sim-test2");
    const p = await createProfile(kv, "God", "hunter2");
    expect(p.passHash).toMatch(/^[0-9a-f]{64}$/);
    expect(JSON.stringify(p)).not.toContain("hunter2");
    expect(await verifyPasscode(p, "hunter2")).toBe(true);
    expect(await verifyPasscode(p, "nope")).toBe(false);
    await setPasscode(p, null);
    await updateProfile(kv, p);
    expect(await verifyPasscode((await listProfiles(kv))[0], "anything")).toBe(true);
  });
});
