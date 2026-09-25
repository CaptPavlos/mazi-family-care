import { readFile, mkdir, writeFile, rename } from "node:fs/promises";
import path from "node:path";
import postgres from "postgres";
import { CompactEncrypt, compactDecrypt } from "jose";
import { createHash } from "node:crypto";
import { blankState, stateSchema, type CareState } from "./model";
export const localEnabled = () =>
  process.env.NODE_ENV === "development" &&
  !process.env.VERCEL &&
  process.env.ALLOW_LOCAL_PRIVATE === "true";
const file = path.join(process.cwd(), ".private", "state.json");
const workspace = () => process.env.WORKSPACE_ID || "family";
let sql: ReturnType<typeof postgres> | undefined;
function db() {
  if (!process.env.DATABASE_URL) throw new Error("STORAGE_NOT_CONFIGURED");
  return (sql ??= postgres(process.env.DATABASE_URL, {
    max: 3,
    idle_timeout: 20,
    connect_timeout: 10,
  }));
}
function key() {
  const secret = process.env.SESSION_SECRET;
  if (!secret || secret.length < 32) throw new Error("SECRET_NOT_CONFIGURED");
  return createHash("sha256").update(secret).digest();
}
async function encrypt(s: CareState) {
  return new CompactEncrypt(new TextEncoder().encode(JSON.stringify(s)))
    .setProtectedHeader({ alg: "dir", enc: "A256GCM" })
    .encrypt(key());
}
async function decrypt(s: string) {
  return stateSchema.parse(
    JSON.parse(
      new TextDecoder().decode((await compactDecrypt(s, key())).plaintext),
    ),
  );
}
let initialized: Promise<unknown> | undefined;
function init() {
  return (initialized ??=
    db()`CREATE TABLE IF NOT EXISTS mazi_workspaces (id text PRIMARY KEY, revision integer NOT NULL, encrypted_state text NOT NULL, updated_at timestamptz NOT NULL DEFAULT now())`.catch(
      (e) => {
        initialized = undefined;
        throw e;
      },
    ));
}
export async function readState(): Promise<CareState> {
  if (localEnabled()) {
    try {
      return stateSchema.parse(JSON.parse(await readFile(file, "utf8")));
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code === "ENOENT") return blankState();
      throw e;
    }
  }
  await init();
  const rows =
    await db()`SELECT encrypted_state FROM mazi_workspaces WHERE id=${workspace()}`;
  return rows[0] ? decrypt(rows[0].encrypted_state) : blankState();
}
let localQueue: Promise<unknown> = Promise.resolve();
export async function saveState(
  data: CareState,
  expected: number,
): Promise<CareState> {
  const next = stateSchema.parse({ ...data, revision: expected + 1 });
  if (localEnabled()) {
    const operation = localQueue.then(async () => {
      const old = await readState();
      if (old.revision !== expected) throw new Error("CONFLICT");
      await mkdir(path.dirname(file), { recursive: true, mode: 0o700 });
      await writeFile(file + ".tmp", JSON.stringify(next, null, 2), {
        mode: 0o600,
      });
      await rename(file + ".tmp", file);
      return next;
    });
    localQueue = operation.catch(() => undefined);
    return operation;
  }
  await init();
  const encrypted = await encrypt(next);
  const rows =
    expected === 0
      ? await db()`INSERT INTO mazi_workspaces (id,revision,encrypted_state) VALUES (${workspace()},1,${encrypted}) ON CONFLICT (id) DO UPDATE SET revision=1, encrypted_state=EXCLUDED.encrypted_state,updated_at=now() WHERE mazi_workspaces.revision=0 RETURNING revision`
      : await db()`UPDATE mazi_workspaces SET revision=${expected + 1},encrypted_state=${encrypted},updated_at=now() WHERE id=${workspace()} AND revision=${expected} RETURNING revision`;
  if (!rows.length) throw new Error("CONFLICT");
  return next;
}
