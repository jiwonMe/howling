/**
 * Host가 주입한 실제 작업 함수를 쓰는 driver.
 * 타이머 구현과 네트워크 클라이언트는 이 패키지에 넣지 않는다.
 */
import type { EngineCommand } from "../contracts/command.js";
import type { EffectRequest, EffectResponse } from "../contracts/effect.js";
import type { EngineDriver } from "../contracts/engine.js";

export interface LiveDriverAdapters {
  readonly executeExternal: (request: EffectRequest) => EffectResponse;
}

export const createLiveDriver = (adapters: LiveDriverAdapters): EngineDriver => ({
  nextCommands: (_plan, state, effects) => {
    const commands: EngineCommand[] = [];
    const pending = [
      ...effects,
      ...Object.values(state.effects)
        .filter((effect) => effect.status === "requested")
        .map((effect) => ({
          id: effect.id,
          runId: effect.runId,
          nodeId: effect.nodeId,
          index: effect.index,
          intent: effect.intent,
        })),
    ];
    const unique = new Map(pending.map((effect) => [effect.id, effect]));
    for (const request of unique.values()) {
      if (request.intent.kind === "timer") {
        if (request.intent.dueAt <= state.logicalTime) {
          commands.push({
            type: "effect.resolved",
            commandId: `live-timer:${request.id}`,
            effectId: request.id,
            response: {
              source: "live",
              status: "succeeded",
              value: { dueAt: request.intent.dueAt },
            },
          });
        }
        continue;
      }
      const response = adapters.executeExternal(request);
      commands.push({
        type: "effect.dispatchStarted",
        commandId: `live-dispatch:${request.id}`,
        effectId: request.id,
      });
      commands.push({
        type: "effect.resolved",
        commandId: `live-resolve:${request.id}`,
        effectId: request.id,
        response,
      });
    }
    return commands;
  },
});
