import test from "node:test";
import assert from "node:assert/strict";
import {
  authorizeRole,
  blankState,
  both,
  canEdit,
  demoState,
  folderId,
  expenseSchema,
  expenseContributions,
  memberExpenseTotal,
  uncoveredExpense,
  mergeConditions,
  stateSchema,
} from "../lib/model";
import { parseImport } from "../lib/import";
const expense = {
  id: "expense", title: both("Shared expense"), amount: 100,
  member: "", date: "", settled: false, receiptId: "",
};
test("split expenses attribute each contribution once and retain the uncovered balance", () => {
  const shared = expenseSchema.parse({ ...expense, contributions: [
    { member: "Alex", amount: 60.25 }, { member: "Maria", amount: 25.50 },
  ] });
  assert.equal(memberExpenseTotal([shared], "Alex"), 60.25);
  assert.equal(memberExpenseTotal([shared], "Maria"), 25.5);
  assert.equal(uncoveredExpense(shared), 14.25);
  assert.equal(shared.amount, 100);
  assert.equal(uncoveredExpense({ ...expense, amount: 0.3, contributions: [
    { member: "Alex", amount: 0.1 }, { member: "Maria", amount: 0.2 },
  ] }), 0);
});
test("legacy single-payer expenses keep their full contribution until explicitly changed", () => {
  const legacy = expenseSchema.parse({ ...expense, member: "Alex" });
  assert.deepEqual(expenseContributions(legacy), [{ member: "Alex", amount: 100 }]);
  assert.equal(memberExpenseTotal([legacy], "Alex"), 100);
  assert.equal(uncoveredExpense({ ...legacy, contributions: [] }), 100);
});
test("expenses reject over-allocation, duplicate payers, negative and fractional-cent contributions", () => {
  for (const contributions of [
    [{ member: "Alex", amount: 60 }, { member: "Maria", amount: 40.01 }],
    [{ member: "Alex", amount: 20 }, { member: "Alex", amount: 20 }],
    [{ member: "Alex", amount: -1 }],
    [{ member: "Alex", amount: 0.001 }],
  ]) assert.equal(expenseSchema.safeParse({ ...expense, contributions }).success, false);
});
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
