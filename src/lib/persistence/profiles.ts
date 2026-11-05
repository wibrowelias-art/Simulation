import type { KV } from "./kv";
import type { WorldState } from "../sim/types";
import { migrateWorld } from "../sim/world";

/**
 * Local-only profiles. Nothing leaves the browser: a profile is a name, an optional
 * passcode (salted SHA-256 via WebCrypto) and a world snapshot in IndexedDB.
 * This is a lock screen for a shared device, not real security.
 */
export interface Profile {
  id: string;
  name: string;
  seed: string;
  createdAt: number;
  salt?: string;
  passHash?: string;
  handle?: string; // chosen at setup
  start?: string; // starting virtual cash chosen at setup
}

const PROFILES = "profiles";
const worldKey = (id: string) => `world:${id}`;

export async function sha256(text: string): Promise<string> {
  const buf = await globalThis.crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

const randomHex = (n = 16) => Array.from(globalThis.crypto.getRandomValues(new Uint8Array(n))).map((b) => b.toString(16).padStart(2, "0")).join("");

export async function listProfiles(kv: KV): Promise<Profile[]> {
  return (await kv.get<Profile[]>(PROFILES)) ?? [];
}

export async function createProfile(kv: KV, name: string, passcode?: string, seed?: string, extra: { handle?: string; start?: string } = {}): Promise<Profile> {
  const p: Profile = { id: randomHex(6), name: name.trim() || "Player", seed: seed ?? randomHex(8), createdAt: Date.now(), ...extra };
  if (passcode) await setPasscode(p, passcode);
  await kv.set(PROFILES, [...(await listProfiles(kv)), p]);
  return p;
}

export async function setPasscode(p: Profile, passcode: string | null) {
  if (!passcode) { delete p.salt; delete p.passHash; return p; }
  p.salt = randomHex(16);
  p.passHash = await sha256(`${p.salt}:${passcode}`);
  return p;
}

export async function updateProfile(kv: KV, p: Profile) {
  await kv.set(PROFILES, (await listProfiles(kv)).map((x) => (x.id === p.id ? p : x)));
}

export async function verifyPasscode(p: Profile, passcode: string): Promise<boolean> {
  if (!p.passHash || !p.salt) return true;
  return (await sha256(`${p.salt}:${passcode}`)) === p.passHash;
}

export async function deleteProfile(kv: KV, id: string) {
  await kv.set(PROFILES, (await listProfiles(kv)).filter((p) => p.id !== id));
  await kv.del(worldKey(id));
}

export async function loadWorld(kv: KV, id: string): Promise<WorldState | undefined> {
  const w = await kv.get<WorldState>(worldKey(id));
  if (!w) return undefined;
  return migrateWorld(w); // also re-checks current-version saves for content added later
}

export async function saveWorld(kv: KV, id: string, w: WorldState) {
  await kv.set(worldKey(id), w);
}

export async function clearWorld(kv: KV, id: string) {
  await kv.del(worldKey(id));
}
