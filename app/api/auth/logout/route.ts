import { cookies } from "next/headers";
import { checkOrigin, sessionName } from "@/lib/auth";
import { failure } from "@/lib/http";
export async function POST(request: Request) {
  try {
    checkOrigin(request);
    (await cookies()).delete(sessionName);
    return Response.json({ ok: true });
  } catch (e) {
    return failure(e);
  }
}
