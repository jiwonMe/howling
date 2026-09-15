/**
 * 편집기 저장·검증·배포·시험·실행.
 */
import type { WorkflowDefinition } from "@howling/core";
import { defaultTestFixtures } from "./test-fixtures.js";
import {
  createRevision,
  deactivateFlow,
  deployRevision,
  startLiveRun,
  startTestSession,
  validateFlow,
  waitDeployment,
} from "../lib/flows-api.js";
import { repairBindings } from "../lib/flow-model.js";
import { buttonRecipe } from "../ui/button.css.js";

export const EditorToolbar = (props: {
  readonly siteId: string;
  readonly flowId: string;
  readonly csrf: string;
  readonly definition: WorkflowDefinition;
  readonly testPower: string;
  readonly previousRevision?: string;
  readonly persist: () => Promise<WorkflowDefinition>;
  readonly onDefinition: (next: WorkflowDefinition) => void;
  readonly onMessage: (message: string) => void;
  readonly onDeployStatus: (status: string) => void;
  readonly onOpenedRun: (runId: string) => void;
  readonly captureRaw: boolean;
  readonly onCaptureRaw: (value: boolean) => void;
  readonly deployStatus?: string;
}) => (
  <>
    <label>
      <input
        checked={props.captureRaw}
        data-testid="flow-capture-raw"
        type="checkbox"
        onChange={(event) => props.onCaptureRaw(event.target.checked)}
      />{" "}
      원본
    </label>
    <button className={buttonRecipe()} data-testid="save-draft" type="button" onClick={() => void props.persist()}>
      저장
    </button>
    <button
      className={buttonRecipe()}
      data-testid="validate-flow"
      type="button"
      onClick={() => {
        const next = repairBindings(props.definition);
        props.onDefinition(next);
        void validateFlow(props.siteId, props.flowId, props.csrf, next).then((result) =>
          props.onMessage(result.ok ? "검증 통과" : result.diagnostics?.map((item) => item.message).join("; ") ?? ""),
        );
      }}
    >
      검증
    </button>
    <button
      className={buttonRecipe()}
      data-testid="create-revision"
      type="button"
      onClick={() => {
        void props
          .persist()
          .then(() => createRevision(props.siteId, props.flowId, props.csrf))
          .then((result) => props.onMessage(`revision ${result.revisionId}`));
      }}
    >
      Revision
    </button>
    <button
      className={buttonRecipe({ intent: "primary" })}
      data-testid="deploy-flow"
      type="button"
      onClick={() => {
        void props
          .persist()
          .then(() => createRevision(props.siteId, props.flowId, props.csrf))
          .then((revision) =>
            deployRevision(props.siteId, props.flowId, props.csrf, revision.revisionId),
          )
          .then((deployed) => waitDeploy(props, deployed.deploymentId, "배포"));
      }}
    >
      배포
    </button>
    {props.deployStatus === "active" ? (
      <button
        className={buttonRecipe()}
        data-testid="deactivate-flow"
        type="button"
        onClick={() => {
          void deactivateFlow(props.siteId, props.flowId, props.csrf)
            .then((deployed) => waitDeploy(props, deployed.deploymentId, "해제"))
            .catch((caught: unknown) =>
              props.onMessage(caught instanceof Error ? caught.message : "해제 실패"),
            );
        }}
      >
        해제
      </button>
    ) : null}
    <button
      className={buttonRecipe()}
      data-testid="dry-run-flow"
      type="button"
      onClick={() => {
        void props
          .persist()
          .then((next) =>
            startTestSession(props.siteId, props.flowId, props.csrf, {
              source: "draft",
              input: { power: Number(props.testPower) },
              fixtures: defaultTestFixtures(next),
              progression: "auto",
              idempotencyKey: `test-${Date.now()}`,
            }),
          )
          .then((session) => props.onOpenedRun(session.runId))
          .catch((caught: unknown) =>
            props.onMessage(caught instanceof Error ? caught.message : "시험 실패"),
          );
      }}
    >
      시험
    </button>
    <button
      className={buttonRecipe()}
      data-testid="live-run-flow"
      type="button"
      onClick={() => {
        void props
          .persist()
          .then(() =>
            startLiveRun(props.siteId, props.flowId, props.csrf, {
              power: Number(props.testPower),
              text: "ping",
            }),
          )
          .then(() => props.onMessage("실행 요청"))
          .catch((caught: unknown) =>
            props.onMessage(caught instanceof Error ? caught.message : "실행 실패"),
          );
      }}
    >
      실행
    </button>
    {props.previousRevision ? (
      <button
        className={buttonRecipe()}
        data-testid="rollback-flow"
        type="button"
        onClick={() => {
          void deployRevision(props.siteId, props.flowId, props.csrf, props.previousRevision ?? "", {
            rollback: true,
            stateEpoch: "reset",
          }).then((deployed) => waitDeploy(props, deployed.deploymentId, "되돌리기"));
        }}
      >
        되돌리기
      </button>
    ) : null}
  </>
);

const waitDeploy = async (
  props: {
    readonly siteId: string;
    readonly onMessage: (message: string) => void;
    readonly onDeployStatus: (status: string) => void;
  },
  deploymentId: string,
  label: string,
) => {
  props.onMessage(`${label} 요청`);
  const row = await waitDeployment(props.siteId, deploymentId);
  props.onDeployStatus(row.status);
  props.onMessage(`배포 ${row.status}`);
};
