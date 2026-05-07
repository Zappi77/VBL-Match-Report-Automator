import assert from "node:assert/strict";
import test from "node:test";
import { extractMatchIdCandidate } from "./matchIdParsing";

test("extracts direct matchId near matchNumber", () => {
  const html = `<a href='...matchId=777123456'>Spiel 3150</a>`;
  assert.equal(extractMatchIdCandidate(html, "3150"), "777123456");
});

test("extracts snippet match_ candidate near matchNumber", () => {
  const html = `header ... 3150 ... id='match_777654321' ... footer`;
  assert.equal(extractMatchIdCandidate(html, "3150"), "777654321");
});

test("returns null when no candidate exists", () => {
  const html = `<div>no ids here for 3150</div>`;
  assert.equal(extractMatchIdCandidate(html, "3150"), null);
});
