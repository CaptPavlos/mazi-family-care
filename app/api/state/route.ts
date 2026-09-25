import { stateSchema, canEdit } from "@/lib/model";
import { readState, saveState } from "@/lib/store";
import {
  authorized,
  checkOrigin,
  configured,
  isLocal,
  session,
} from "@/lib/auth";
import { failure } from "@/lib/http";
export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  try {
    if (!isLocal(request) && !(await session()))
      return Response.json({ mode: "demo", configured: configured() });
    const user = await authorized(request);
    const state = await readState();
    return Response.json({
      mode: isLocal(request) ? "local" : "private",
      state,
      role: user.role,
      configured: configured(),
      googleConnected: !!(await session())?.access,
    });
  } catch (e) {
    return failure(e);
  }
}
export async function PUT(request: Request) {
  try {
    checkOrigin(request);
    if (Number(request.headers.get("content-length")) > 2000000)
      throw new Error("TOO_LARGE");
    const user = await authorized(request);
    if (!canEdit(user.role)) throw new Error("FORBIDDEN");
    const text = await request.text();
    if (text.length > 2000000) throw new Error("TOO_LARGE");
    const data = stateSchema.parse(JSON.parse(text));
    const old = await readState();
    if (
      user.role !== "owner" &&
      (JSON.stringify(data.members) !== JSON.stringify(old.members) ||
        data.driveFolder !== old.driveFolder)
    )
      throw new Error("FORBIDDEN");
    // The owner is configured server-side. Members cannot grant owner privileges.
    if (
      data.members.some(
        (m) =>
          m.role === "owner" &&
          m.email &&
          m.email.toLowerCase() !==
            (process.env.OWNER_EMAIL || "").toLowerCase(),
      ) &&
      !isLocal(request)
    )
      throw new Error("FORBIDDEN");
    return Response.json({ state: await saveState(data, data.revision) });
  } catch (e) {
    return failure(e);
  }
}
