import { authorized, checkOrigin, accessToken } from "@/lib/auth";
import { readState, saveState } from "@/lib/store";
import { canEdit, isImagingPackage, type CareState } from "@/lib/model";
import { failure } from "@/lib/http";
export async function POST(request: Request) {
  try {
    checkOrigin(request);
    const user = await authorized(request);
    if (!canEdit(user.role)) throw new Error("FORBIDDEN");
    const state = await readState();
    if (!/^[\w-]+$/.test(state.driveFolder)) throw new Error("INVALID_FOLDER");
    const token = await accessToken();
    const headers = { Authorization: `Bearer ${token}` };
    const root = await fetch(
      `https://www.googleapis.com/drive/v3/files/${state.driveFolder}?fields=id,mimeType&supportsAllDrives=true`,
      { headers, cache: "no-store" },
    );
    if (
      !root.ok ||
      (await root.json()).mimeType !== "application/vnd.google-apps.folder"
    )
      throw new Error("DRIVE_ACCESS_DENIED");
    const files: CareState["files"] = [];
    const queue = [{ id: state.driveFolder, path: "" }];
    const visited = new Set<string>();
    while (queue.length) {
      const folder = queue.shift()!;
      if (visited.has(folder.id)) continue;
      visited.add(folder.id);
      if (visited.size > 200) throw new Error("DRIVE_TOO_LARGE");
      let page = "";
      do {
        const params = new URLSearchParams({
          q: `'${folder.id}' in parents and trashed = false`,
          fields: "nextPageToken,files(id,name,mimeType,modifiedTime)",
          pageSize: "1000",
          supportsAllDrives: "true",
          includeItemsFromAllDrives: "true",
          ...(page ? { pageToken: page } : {}),
        });
        const response = await fetch(
          `https://www.googleapis.com/drive/v3/files?${params}`,
          { headers, cache: "no-store" },
        );
        if (!response.ok) throw new Error("DRIVE_ACCESS_DENIED");
        const data = await response.json();
        for (const f of data.files || []) {
          if (!/^[\w-]+$/.test(f.id)) continue;
          files.push({
            ...f,
            modifiedTime: f.modifiedTime || "",
            path: folder.path,
          });
          if (
            f.mimeType === "application/vnd.google-apps.folder" &&
            !isImagingPackage(f.name)
          )
            queue.push({
              id: f.id,
              path: [folder.path, f.name].filter(Boolean).join(" / "),
            });
        }
        if (files.length > 10000) throw new Error("DRIVE_TOO_LARGE");
        page = data.nextPageToken || "";
      } while (page);
    }
    return Response.json({
      state: await saveState(
        { ...state, files, driveIndexedAt: new Date().toISOString() },
        state.revision,
      ),
    });
  } catch (e) {
    return failure(e);
  }
}
export const maxDuration = 60;
