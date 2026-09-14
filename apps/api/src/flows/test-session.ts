/**
 * Test session을 불변 artifact로 고정하고 runtime에 dry-run을 보낸다.
 */
import { randomUUID } from "node:crypto";
import {
  errorBody,
  errorCodes,
  type RevisionArtifact,
  type TestSessionRequest,
} from "@howling/contracts";
import type pg from "pg";
import { sendToRuntime } from "../runtime/hub.js";
import { artifactFromDraft } from "./artifact.js";
import { artifactDigest } from "./digest.js";
import { putIdempotency, recallIdempotency } from "./idempotency.js";
import { getRun, getTestSession, insertAcceptedRun } from "./runs.js";
import { getFlow, getRevision } from "./store.js";
import { compileDefinition } from "./validate.js";

export type TestSessionResult = {
  readonly ok: boolean;
  readonly status: number;
  readonly body: unknown;
};

type ResolveFail = { readonly ok: false; readonly status: number; readonly body: unknown };

export const startTestSession = async (
  pool: pg.Pool,
  siteId: string,
  flowId: string,
  request: TestSessionRequest,
): Promise<TestSessionResult> => {
  try {
    const recalled = await recallIdempotency(
      pool,
      siteId,
      request.idempotencyKey,
      "test-session",
      request,
    );
    if (recalled.hit) {
      return { ok: true, status: 202, body: recalled.response };
    }
  } catch {
    return {
      ok: false,
      status: 409,
      body: errorBody(errorCodes.conflict, "idempotency key reused"),
    };
  }
  const resolved = await resolveArtifact(pool, siteId, flowId, request);
  if (!resolved.ok) {
    return resolved;
  }
  const compiled = compileDefinition(resolved.artifact.definition);
  if (!compiled.ok) {
    return { ok: false, status: 400, body: compiled };
  }
  const runId = randomUUID();
  const testSessionId = randomUUID();
  const fixtures = fillEffectFixtures(request.fixtures, resolved.artifact.definition);
  const bundleVersion = artifactDigest(fixtures);
  const input = resolved.input ?? request.input;
  const sent = sendToRuntime(siteId, "run.start", {
    artifactId: resolved.artifact.revisionId,
    flowId,
    input,
    mode: request.progression === "manual" ? "manual" : "auto",
    idempotencyKey: request.idempotencyKey,
    runMode: "dryRun",
    runId,
    fixtures,
    fixtureBundleVersion: bundleVersion,
    initialState: request.initialState,
    testSessionId,
    artifact: resolved.artifact,
  });
  if (!sent) {
    return {
      ok: false,
      status: 409,
      body: errorBody(errorCodes.runtimeOffline, "runtime offline"),
    };
  }
  await pool.query(
    `INSERT INTO test_sessions
       (id, site_id, flow_id, run_id, source, artifact_json, fixtures_json, bundle_version, created_at)
     VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7::jsonb, $8, now())`,
    [
      testSessionId,
      siteId,
      flowId,
      runId,
      request.source,
      JSON.stringify(resolved.artifact),
      JSON.stringify(fixtures),
      bundleVersion,
    ],
  );
  await insertAcceptedRun(pool, {
    siteId,
    runId,
    flowId,
    revisionId: resolved.artifact.revisionId,
    trigger: input,
    runMode: "dryRun",
  });
  const body = { accepted: true, runId, testSessionId };
  await putIdempotency(pool, siteId, request.idempotencyKey, "test-session", request, body);
  return { ok: true, status: 202, body };
};

const resolveArtifact = async (
  pool: pg.Pool,
  siteId: string,
  flowId: string,
  request: TestSessionRequest,
): Promise<
  | { readonly ok: true; readonly artifact: RevisionArtifact; readonly input?: unknown }
  | ResolveFail
> => {
  if (request.source === "revision") {
    if (!request.revisionId) {
      return {
        ok: false,
        status: 400,
        body: errorBody(errorCodes.invalidRequest, "revisionId required"),
      };
    }
    const artifact = await getRevision(pool, request.revisionId);
    if (!artifact) {
      return {
        ok: false,
        status: 404,
        body: errorBody(errorCodes.notFound, "revision not found"),
      };
    }
    return { ok: true, artifact };
  }
  if (request.source === "run") {
    if (!request.runId) {
      return {
        ok: false,
        status: 400,
        body: errorBody(errorCodes.invalidRequest, "runId required"),
      };
    }
    const run = await getRun(pool, siteId, request.runId);
    if (!run) {
      return {
        ok: false,
        status: 404,
        body: errorBody(errorCodes.notFound, "run not found"),
      };
    }
    const session = await getTestSession(pool, request.runId);
    const artifact =
      (session?.artifact_json as RevisionArtifact | undefined) ??
      (await getRevision(pool, run.revision_id as string));
    if (!artifact) {
      return {
        ok: false,
        status: 404,
        body: errorBody(errorCodes.notFound, "revision not found"),
      };
    }
    return { ok: true, artifact, input: request.input ?? run.trigger_json };
  }
  const flow = await getFlow(pool, siteId, flowId);
  if (!flow) {
    return {
      ok: false,
      status: 404,
      body: errorBody(errorCodes.notFound, "flow not found"),
    };
  }
  return {
    ok: true,
    artifact: artifactFromDraft({
      siteId,
      flowId,
      definition: flow.draft.definition_json as object,
      triggers: flow.draft.triggers_json as RevisionArtifact["triggers"],
      connections: flow.draft.connections_json as RevisionArtifact["connections"],
      executionPolicy: flow.draft.execution_policy_json as RevisionArtifact["executionPolicy"],
    }),
  };
};

const fillEffectFixtures = (
  provided: TestSessionRequest["fixtures"],
  definition: RevisionArtifact["definition"],
): TestSessionRequest["fixtures"] => {
  const keys = new Set(provided.map((item) => `${item.nodeId}:${String(item.index)}`));
  const extras = definition.nodes
    .filter((node) => node.type === "core.effect")
    .filter((node) => !keys.has(`${node.id}:0`))
    .map((node) => ({
      nodeId: node.id,
      index: 0,
      response: {
        source: "fixture" as const,
        status: "succeeded" as const,
        value: { ok: true },
      },
    }));
  return [...provided, ...extras];
};
