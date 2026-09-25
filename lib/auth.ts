import { cookies } from "next/headers";
import { EncryptJWT, jwtDecrypt } from "jose";
import { createHash } from "node:crypto";
import { authorizeRole, type CareState } from "./model";
import { localEnabled, readState } from "./store";
export const sessionName = "mazi_session";
export type Session = {
  email: string;
  access?: string;
  refresh?: string;
  expires?: number;
};
export function configured() {
  return !!(
    process.env.GOOGLE_CLIENT_ID &&
    process.env.GOOGLE_CLIENT_SECRET &&
    process.env.OWNER_EMAIL &&
    process.env.APP_URL &&
    process.env.SESSION_SECRET &&
    process.env.SESSION_SECRET.length >= 32 &&
    (localEnabled() || process.env.DATABASE_URL)
  );
}
function key() {
  const value = process.env.SESSION_SECRET;
  if (!value || value.length < 32) throw new Error("SETUP_REQUIRED");
  return createHash("sha256").update(value).digest();
}
export async function seal(value: Record<string, unknown>, ttl = "7d") {
  return new EncryptJWT(value)
    .setProtectedHeader({ alg: "dir", enc: "A256GCM" })
    .setIssuedAt()
    .setExpirationTime(ttl)
    .encrypt(key());
}
export async function unseal(value: string) {
  return (await jwtDecrypt(value, key())).payload;
}
export const cookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/",
};
export async function session(): Promise<Session | null> {
  try {
    const value = (await cookies()).get(sessionName)?.value;
    if (!value) return null;
    const payload = await unseal(value);
    return typeof payload.email === "string" ? (payload as Session) : null;
  } catch {
    return null;
  }
}
export function isLocal(request: Request) {
  const host = new URL(request.url).hostname;
  return localEnabled() && ["localhost", "127.0.0.1", "[::1]"].includes(host);
}
export function checkOrigin(request: Request) {
  const origin = request.headers.get("origin");
  const expected = process.env.APP_URL;
  const local =
    isLocal(request) &&
    ["http://127.0.0.1:3000", "http://localhost:3000"].includes(origin || "");
  if (!origin || (!local && origin !== expected)) throw new Error("FORBIDDEN");
}
export async function authorized(request: Request, state?: CareState) {
  if (isLocal(request)) return { email: "local", role: "owner" as const };
  const s = await session();
  if (!s) throw new Error("UNAUTHORIZED");
  const role = authorizeRole(
    state ?? (await readState()),
    s.email,
    process.env.OWNER_EMAIL || "",
  );
  if (!role) throw new Error("FORBIDDEN");
  return { email: s.email, role };
}
export async function accessToken() {
  const s = await session();
  if (!s?.access) throw new Error("GOOGLE_SIGN_IN_REQUIRED");
  if (s.expires && s.expires > Date.now() + 60000) return s.access;
  if (!s.refresh) throw new Error("GOOGLE_SIGN_IN_REQUIRED");
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    body: new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      refresh_token: s.refresh,
      grant_type: "refresh_token",
    }),
    cache: "no-store",
  });
  if (!response.ok) throw new Error("GOOGLE_SIGN_IN_REQUIRED");
  const tokens = await response.json();
  (await cookies()).set(
    sessionName,
    await seal({
      ...s,
      access: tokens.access_token,
      expires: Date.now() + tokens.expires_in * 1000,
    }),
    { ...cookieOptions, maxAge: 604800 },
  );
  return tokens.access_token as string;
}
