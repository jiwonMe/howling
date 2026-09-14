/**
 * Core 공개 타입에서 파생한 실행 상태 별칭.
 */
import type { ExecutionState } from "@howling/core";

export type RunStatus = ExecutionState["status"];
export type EffectRecord = ExecutionState["effects"][string];
export type EffectRecordStatus = EffectRecord["status"];
