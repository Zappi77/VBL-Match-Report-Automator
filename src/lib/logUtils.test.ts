import assert from "node:assert/strict";
import test from "node:test";
import { appendUniqueStatus } from "./logUtils";

test("appendUniqueStatus appends different status", () => {
  const next = appendUniqueStatus(["A"], "B");
  assert.deepEqual(next, ["A", "B"]);
});

test("appendUniqueStatus ignores duplicate consecutive status", () => {
  const prev = ["A", "B"];
  const next = appendUniqueStatus(prev, "B");
  assert.equal(next, prev);
});
