import { test } from "node:test";
import assert from "node:assert/strict";
import { createHumanVerifier, createModelStubVerifier } from "./index.js";

test("human requires explicit verdict", () => {
  const v = createHumanVerifier({ verifierId: "v:h" });
  const a = v.attest({ jobId: "j1" }, { verdict: "pass", note: "lgtm" });
  assert.equal(a.verdict, "pass");
  assert.equal(a.verifierId, "v:h");
  assert.throws(() => v.attest({ jobId: "j1" }, {}));
});

test("model stub passes with contentHash", () => {
  const v = createModelStubVerifier();
  const pass = v.attest({ jobId: "j1", artifact: { contentHash: "sha256:abc" } });
  assert.equal(pass.verdict, "pass");
  const fail = v.attest({ jobId: "j1", artifact: {} });
  assert.equal(fail.verdict, "fail");
});
