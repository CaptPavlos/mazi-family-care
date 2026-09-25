import { cookies } from "next/headers";
import { createRemoteJWKSet, jwtVerify } from "jose";
import { cookieOptions, seal, unseal, sessionName } from "@/lib/auth";
import { readState } from "@/lib/store";
import { authorizeRole } from "@/lib/model";
const jwks = createRemoteJWKSet(
  new URL("https://www.googleapis.com/oauth2/v3/certs"),
);
export async function GET(request: Request) {
  const base = process.env.APP_URL || "http://localhost:3000";
  const jar = await cookies();
  try {
    const params = new URL(request.url).searchParams;
    const flow = await unseal(jar.get("mazi_oauth")?.value || "");
    jar.delete("mazi_oauth");
    if (
      !params.get("code") ||
      !params.get("state") ||
      params.get("state") !== flow.state
    )
      throw new Error("Invalid state");
    const response = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      body: new URLSearchParams({
        client_id: process.env.GOOGLE_CLIENT_ID!,
        client_secret: process.env.GOOGLE_CLIENT_SECRET!,
        code: params.get("code")!,
        code_verifier: String(flow.verifier),
        redirect_uri: new URL("/api/auth/callback", base).href,
        grant_type: "authorization_code",
      }),
      cache: "no-store",
    });
    if (!response.ok) throw new Error("Exchange failed");
    const token = await response.json();
    const { payload } = await jwtVerify(token.id_token, jwks, {
      issuer: ["https://accounts.google.com", "accounts.google.com"],
      audience: process.env.GOOGLE_CLIENT_ID,
    });
    if (
      payload.nonce !== flow.nonce ||
      payload.email_verified !== true ||
      typeof payload.email !== "string"
    )
      throw new Error("Invalid identity");
    if (
      !authorizeRole(
        await readState(),
        payload.email,
        process.env.OWNER_EMAIL || "",
      )
    )
      return Response.redirect(new URL("/?auth=denied", base));
    const driveGranted = String(token.scope || "")
      .split(" ")
      .includes("https://www.googleapis.com/auth/drive.metadata.readonly");
    const value = await seal({
      email: payload.email,
      ...(driveGranted
        ? {
            access: token.access_token,
            refresh: token.refresh_token,
            expires: Date.now() + token.expires_in * 1000,
          }
        : {}),
    });
    if (value.length > 3800) throw new Error("Session too large");
    jar.set(sessionName, value, { ...cookieOptions, maxAge: 604800 });
    return Response.redirect(new URL("/", base));
  } catch {
    jar.delete("mazi_oauth");
    return Response.redirect(new URL("/?auth=failed", base));
  }
}
