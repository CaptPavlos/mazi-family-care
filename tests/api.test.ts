import test from "node:test";
import assert from "node:assert/strict";
const base = process.env.TEST_LOCAL_URL;
test(
  "local API validates origin, persists expenses, and rejects stale revisions",
  { skip: !base },
  async () => {
    const get = async () => {
      const r = await fetch(base + "/api/state");
      assert.equal(r.status, 200);
      return r.json();
    };
    const first = await get();
    assert.equal(first.mode, "local");
    const bad = await fetch(base + "/api/state", {
      method: "PUT",
      headers: {
        Origin: "https://untrusted.example",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(first.state),
    });
    assert.equal(bad.status, 403);
    const malformed = await fetch(base + "/api/state", {
      method: "PUT",
      headers: { Origin: base!, "Content-Type": "application/json" },
      body: JSON.stringify({ patient: "invalid" }),
    });
    assert.equal(malformed.status, 400);
    const id = "temporary-test-" + Date.now();
    try {
      const candidate = {
        ...first.state,
        expenses: [
          ...first.state.expenses,
          {
            id,
            title: {
              en: "Temporary API verification",
              el: "Temporary API verification",
            },
            amount: 12.34,
            member: "",
            date: "",
            settled: false,
            receiptId: "",
          },
        ],
      };
      const save = await fetch(base + "/api/state", {
        method: "PUT",
        headers: { Origin: base!, "Content-Type": "application/json" },
        body: JSON.stringify(candidate),
      });
      assert.equal(save.status, 200);
      const saved = await get();
      assert.equal(
        saved.state.expenses.find((e: { id: string }) => e.id === id)?.amount,
        12.34,
      );
      const stale = await fetch(base + "/api/state", {
        method: "PUT",
        headers: { Origin: base!, "Content-Type": "application/json" },
        body: JSON.stringify(candidate),
      });
      assert.equal(stale.status, 409);
    } finally {
      const latest = await get();
      latest.state.expenses = latest.state.expenses.filter(
        (e: { id: string }) => e.id !== id,
      );
      const restore = await fetch(base + "/api/state", {
        method: "PUT",
        headers: { Origin: base!, "Content-Type": "application/json" },
        body: JSON.stringify(latest.state),
      });
      assert.equal(restore.status, 200);
    }
  },
);
