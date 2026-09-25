import test from "node:test";
import assert from "node:assert/strict";
import {
  authorizeRole,
  blankState,
  both,
  canEdit,
  demoState,
  folderId,
  mergeConditions,
  stateSchema,
} from "../lib/model";
import { parseImport } from "../lib/import";
test("only configured owner and explicit members can access private data", () => {
  const s = blankState();
  s.members = [
    { id: "1", name: "Reader", email: "reader@example.org", role: "viewer" },
    { id: "2", name: "Editor", email: "editor@example.org", role: "editor" },
  ];
  assert.equal(
    authorizeRole(s, "stranger@example.org", "owner@example.org"),
    null,
  );
  assert.equal(
    authorizeRole(s, "OWNER@example.org", "owner@example.org"),
    "owner",
  );
  assert.equal(
    authorizeRole(s, "reader@example.org", "owner@example.org"),
    "viewer",
  );
  assert.equal(
    authorizeRole(s, "editor@example.org", "owner@example.org"),
    "editor",
  );
  assert.equal(authorizeRole(s, "", ""), null);
  assert.equal(canEdit("viewer"), false);
  assert.equal(canEdit("owner"), true);
});
test("client-side owner role cannot grant ownership", () => {
  const s = blankState();
  s.members = [
    { id: "1", name: "Fake owner", email: "other@example.org", role: "owner" },
  ];
  assert.equal(
    authorizeRole(s, "other@example.org", "owner@example.org"),
    null,
  );
});
test("folder parsing rejects injection and other domains", () => {
  assert.equal(
    folderId("https://drive.google.com/drive/folders/example-123?usp=sharing"),
    "example-123",
  );
  assert.equal(folderId("example-123"), "example-123");
  for (const input of [
    "foo' in parents",
    "https://evil.example/drive/folders/abc",
    "abc/../../xyz",
    "javascript:alert(1)",
  ])
    assert.throws(() => folderId(input));
});
test("imports cannot silently become confirmed clinical records", () => {
  const c = { ...demoState().conditions[0], verified: true };
  const result = parseImport({ conditions: [c] });
  assert.equal(result[0].verified, false);
  assert.equal(result[0].title.en, c.title.en);
});
test("repeat imports are deduplicated without overwriting reviewed edits", () => {
  const c = demoState().conditions[0];
  const edited = { ...c, title: both("Reviewed wording") };
  const merged = mergeConditions([edited], [c, c]);
  assert.equal(merged.length, 1);
  assert.equal(merged[0].title.en, "Reviewed wording");
});
test("FHIR parsing keeps source wording and does not infer body location", () => {
  const records = parseImport({
    resourceType: "Bundle",
    entry: [
      {
        resource: {
          resourceType: "Condition",
          id: "test",
          code: { text: "Original diagnosis text" },
          onsetDateTime: "2025-02-03T12:00:00Z",
          note: [{ text: "Source note" }],
        },
      },
      { resource: { resourceType: "Patient", id: "patient" } },
    ],
  });
  assert.equal(records.length, 1);
  assert.equal(records[0].region, "body");
  assert.equal(records[0].title.en, "Original diagnosis text");
  assert.equal(records[0].date, "2025-02-03");
  assert.equal(records[0].verified, false);
});
test("invalid records and negative expenses are rejected", () => {
  const s = blankState();
  assert.throws(() =>
    stateSchema.parse({
      ...s,
      expenses: [
        {
          id: "bad",
          title: both("Test"),
          amount: -1,
          member: "",
          date: "",
          settled: false,
          receiptId: "",
        },
      ],
    }),
  );
  assert.throws(() =>
    parseImport({ conditions: [{ title: "not a valid record" }] }),
  );
});
test("invalid calendar dates and invented FHIR status are not accepted", () => {
  const s = demoState();
  assert.throws(() =>
    stateSchema.parse({
      ...s,
      conditions: [{ ...s.conditions[0], date: "2026-02-31" }],
    }),
  );
  const rows = parseImport({
    resourceType: "Bundle",
    entry: [
      {
        resource: {
          resourceType: "Condition",
          id: "x",
          code: { text: "Source wording" },
        },
      },
    ],
  });
  assert.equal(rows[0].status, "unknown");
  assert.equal(rows[0].source, "document");
});
