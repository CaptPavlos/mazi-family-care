import { randomBytes, createHash } from "node:crypto";
import { cookies } from "next/headers";
import { configured, cookieOptions, seal } from "@/lib/auth";
export async function GET() {
  const base = process.env.APP_URL || "http://localhost:3000";
  if (!configured()) return Response.redirect(new URL("/?setup=google", base));
  const state = randomBytes(32).toString("base64url"),
    verifier = randomBytes(32).toString("base64url"),
    nonce = randomBytes(32).toString("base64url");
  (await cookies()).set(
    "mazi_oauth",
    await seal({ state, verifier, nonce }, "10m"),
    { ...cookieOptions, maxAge: 600 },
  );
  const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  url.search = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID!,
    redirect_uri: new URL("/api/auth/callback", base).href,
    response_type: "code",
    scope:
      "openid email https://www.googleapis.com/auth/drive.metadata.readonly",
    state,
    nonce,
    access_type: "offline",
    prompt: "consent",
    code_challenge: createHash("sha256").update(verifier).digest("base64url"),
    code_challenge_method: "S256",
  }).toString();
  return Response.redirect(url);
}
