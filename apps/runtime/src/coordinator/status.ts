/**
 * Run 진행 판정.
 */
import type { ExecutionState } from "@howling/core";
import type { ProgressionMode } from "../store/triggers.js";

export const isTerminalStatus = (status: string): boolean =>
  status === "completed" || status === "failed" || status === "cancelled";

export const canAutoStep = (
  state: ExecutionState,
  mode: ProgressionMode,
): boolean =>
  mode === "auto" &&
  !state.paused &&
  !state.cancelled &&
  state.readyQueue.length > 0;
