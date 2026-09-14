/**
 * Inbox 메시지 한 건을 처리한다.
 */
import type { HostContext } from "./context.js";
import {
  handleCancel,
  handleContinue,
  handlePause,
  handleResume,
  handleStep,
} from "./handle-control.js";
import { handleDryStart, handleFixture } from "./handle-dry-run.js";
import { handleCoreCommand, handleDispatch } from "./handle-effect.js";
import { handleStart } from "./handle-start.js";
import type { InboxMessage } from "./types.js";

export const handleMessage = async (
  ctx: HostContext,
  message: InboxMessage,
): Promise<unknown> => {
  switch (message.kind) {
    case "start_run":
      return handleStart(ctx, message);
    case "start_dry_run":
      return handleDryStart(ctx, message);
    case "fixture":
      return handleFixture(ctx, message);
    case "step":
      return handleStep(ctx, message);
    case "continue":
      return handleContinue(ctx, message);
    case "pause":
      return handlePause(ctx, message);
    case "resume":
      return handleResume(ctx, message);
    case "cancel":
      return handleCancel(ctx, message);
    case "core_command":
      return handleCoreCommand(ctx, message);
    case "dispatch":
      return handleDispatch(ctx, message);
  }
};
