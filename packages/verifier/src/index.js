import { createHash } from "node:crypto";

/** Hash rubric + artifact for reproducible model-judge inputs. */
export function hashRubricAndArtifact(rubric, artifactHash) {
  return createHash("sha256")
    .update(JSON.stringify({ rubric, artifactHash }))
    .digest("hex");
}

/**
 * Extremely dumb model-judge stub: fail if note includes FAIL or hash too short.
 * Replace with a real model later.
 */
export function modelJudgeStub({ rubric, artifact, evidenceNote = "" }) {
  const inputHash = hashRubricAndArtifact(rubric, artifact.contentHash);
  const fail =
    /FAIL/i.test(evidenceNote) || !artifact?.contentHash || artifact.contentHash.length < 8;
  return {
    verdict: fail ? "fail" : "pass",
    evidenceRef: `stub:judge:${inputHash.slice(0, 12)}`,
    inputHash,
  };
}

export function humanAttest({ verdict, evidenceRef = null }) {
  if (verdict !== "pass" && verdict !== "fail") throw new Error("verdict must be pass|fail");
  return { verdict, evidenceRef };
}
