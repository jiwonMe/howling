/**
 * step/continue/fixture. dry-run에서만 fixture를 보낸다.
 */
import { useState } from "react";
import { postRunCommand, startTestSession, type RunRow } from "../lib/flows-api.js";
import { buttonRecipe } from "../ui/button.css.js";
import { field, input, label } from "../ui/form.css.js";
import { floatCluster } from "../ui/editor.css.js";

export const RunControls = (props: {
  readonly siteId: string;
  readonly csrf: string;
  readonly row: RunRow;
  readonly onMessage: (message: string) => void;
}) => {
  const [effectId, setEffectId] = useState("");
  const send = (type: "step" | "continue" | "pause" | "resume" | "cancel") => {
    void postRunCommand(props.siteId, props.row.runId, props.csrf, {
      type,
      commandId: `${type}-${Date.now()}`,
    }).catch((caught: unknown) =>
      props.onMessage(caught instanceof Error ? caught.message : "명령 실패"),
    );
  };
  const waiting = props.row.status === "waiting" || props.row.status === "running";
  return (
    <div className={floatCluster} data-testid="run-controls">
      <button
        className={buttonRecipe()}
        data-testid="run-step"
        disabled={!waiting}
        onClick={() => send("step")}
        type="button"
      >
        Step
      </button>
      <button
        className={buttonRecipe({ intent: "primary" })}
        data-testid="run-continue"
        disabled={!waiting}
        onClick={() => send("continue")}
        type="button"
      >
        Continue
      </button>
      <button className={buttonRecipe()} data-testid="run-pause" onClick={() => send("pause")} type="button">
        Pause
      </button>
      <button className={buttonRecipe()} data-testid="run-cancel" onClick={() => send("cancel")} type="button">
        Cancel
      </button>
      {props.row.runMode === "dryRun" ? (
        <div className={field}>
          <label className={label} htmlFor="fixture-effect">
            Fixture effect
          </label>
          <input
            className={input}
            data-testid="fixture-effect"
            id="fixture-effect"
            onChange={(event) => setEffectId(event.target.value)}
            value={effectId}
          />
          <button
            className={buttonRecipe()}
            data-testid="run-fixture"
            type="button"
            onClick={() => {
              void postRunCommand(props.siteId, props.row.runId, props.csrf, {
                type: "fixture",
                commandId: `fix-${Date.now()}`,
                effectId,
                response: { source: "fixture", status: "succeeded", value: { ok: true } },
              }).catch((caught: unknown) =>
                props.onMessage(caught instanceof Error ? caught.message : "fixture 실패"),
              );
            }}
          >
            Fixture
          </button>
        </div>
      ) : (
        <button
          className={buttonRecipe()}
          data-testid="replay-run"
          type="button"
          onClick={() => {
            void startTestSession(props.siteId, props.row.flowId, props.csrf, {
              source: "run",
              runId: props.row.runId,
              input: props.row.trigger,
              fixtures: [],
              progression: "manual",
              idempotencyKey: `replay-${Date.now()}`,
            })
              .then((session) => {
                window.location.assign(`/runs/${session.runId}`);
              })
              .catch((caught: unknown) =>
                props.onMessage(caught instanceof Error ? caught.message : "재생 실패"),
              );
          }}
        >
          다시 시험
        </button>
      )}
    </div>
  );
};
