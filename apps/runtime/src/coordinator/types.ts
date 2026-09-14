/**
 * Coordinator inbox 메시지.
 */
import type { EngineCommand, EffectFixture, EffectResponse, JsonValue } from "@howling/core";
import type { ProgressionMode } from "../store/triggers.js";

export type InboxMessage =
  | {
      readonly kind: "start_run";
      readonly triggerId: string;
      readonly artifactId: string;
      readonly input: JsonValue;
      readonly mode: ProgressionMode;
      readonly idempotencyKey: string;
    }
  | {
      readonly kind: "start_dry_run";
      readonly triggerId: string;
      readonly artifactId: string;
      readonly input: JsonValue;
      readonly mode: ProgressionMode;
      readonly idempotencyKey: string;
      readonly runId?: string;
      readonly fixtures: readonly EffectFixture[];
      readonly fixtureBundleVersion: string;
      readonly initialState?: Readonly<Record<string, JsonValue>>;
      readonly testSessionId?: string;
      readonly definition?: unknown;
      readonly triggers?: unknown;
      readonly connections?: unknown;
    }
  | {
      readonly kind: "fixture";
      readonly runId: string;
      readonly commandId: string;
      readonly effectId: string;
      readonly response: EffectResponse;
    }
  | {
      readonly kind: "step";
      readonly runId: string;
      readonly commandId?: string;
    }
  | {
      readonly kind: "continue";
      readonly runId: string;
      readonly commandId?: string;
    }
  | {
      readonly kind: "pause";
      readonly runId: string;
      readonly commandId: string;
    }
  | {
      readonly kind: "resume";
      readonly runId: string;
      readonly commandId: string;
    }
  | {
      readonly kind: "cancel";
      readonly runId: string;
      readonly commandId: string;
    }
  | {
      readonly kind: "core_command";
      readonly runId: string;
      readonly command: EngineCommand;
    }
  | {
      readonly kind: "dispatch";
      readonly runId: string;
      readonly effectId: string;
    };

export type StartRunResult = {
  readonly triggerId: string;
  readonly runId: string | null;
  readonly status: "started" | "queued" | "duplicate";
};

export type CommitHint = {
  readonly runId: string;
  readonly halted: boolean;
};
