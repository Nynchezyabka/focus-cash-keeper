// End-to-end encryption for device sync: keys are made and kept on the devices; the server sees only ciphertext.
const ABC = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";
const enc = new TextEncoder(), dec = new TextDecoder();
const b64 = (b: ArrayBuffer | Uint8Array) => { const u = b instanceof Uint8Array ? b : new Uint8Array(b); let s = ""; u.forEach((x) => (s += String.fromCharCode(x))); return btoa(s); };
const unb64 = (s: string) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));

/** 16 characters ≈ 80 bits: short enough to type, long enough for a 10-minute pairing */
export function newPairCode() {
  const r = crypto.getRandomValues(new Uint8Array(16));
  return Array.from(r, (x) => ABC[x % 32]).join("");
}
export const normCode = (s: string) => s.toUpperCase().replace(/[^0-9A-Z]/g, "").replace(/[01IO]/g, "");
export const showCode = (c: string) => c.match(/.{1,4}/g)!.join("-");

export async function pairHash(code: string) {
  const h = await crypto.subtle.digest("SHA-256", enc.encode("pair:" + code));
  return Array.from(new Uint8Array(h), (x) => x.toString(16).padStart(2, "0")).join("");
}
export async function pairKey(code: string) {
  const base = await crypto.subtle.importKey("raw", enc.encode(code), "PBKDF2", false, ["deriveKey"]);
  return crypto.subtle.deriveKey({ name: "PBKDF2", salt: enc.encode("berezhny-pair-v1"), iterations: 150000, hash: "SHA-256" }, base, { name: "AES-GCM", length: 256 }, false, ["encrypt", "decrypt"]);
}
export const newVaultKey = () => b64(crypto.getRandomValues(new Uint8Array(32)));
export const newToken = () => b64(crypto.getRandomValues(new Uint8Array(32))).replace(/[^a-z0-9]/gi, "");
export const importKey = (k: string) => crypto.subtle.importKey("raw", unb64(k), "AES-GCM", false, ["encrypt", "decrypt"]);

export async function seal(key: CryptoKey, data: unknown) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, enc.encode(JSON.stringify(data)));
  return `${b64(iv)}.${b64(ct)}`;
}
export async function open<T>(key: CryptoKey, blob: string): Promise<T> {
  const [iv, ct] = blob.split(".");
  const pt = await crypto.subtle.decrypt({ name: "AES-GCM", iv: unb64(iv ?? "") }, key, unb64(ct ?? ""));
  return JSON.parse(dec.decode(pt)) as T;
}
