/**
 * 초안 저장·검증·revision·배포.
 */
import type { TriggerBinding } from "@howling/contracts";
import type { WorkflowDefinition } from "@howling/core";
import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { Bindings } from "../editor/bindings.js";
import { FlowCanvas } from "../editor/flow-canvas.js";
import { Palette } from "../editor/palette.js";
import { loginHref, UnauthorizedError } from "../lib/api.js";
import {
  createRevision,
  deployRevision,
  getDeployment,
  getFlow,
  saveDraft,
  saveEditor,
  validateFlow,
  type FlowDetail,
} from "../lib/flows-api.js";
import { addNode, emptyDefinition, replaceNode } from "../lib/flow-model.js";
import { loadStatus } from "../lib/status.js";
import { buttonRecipe } from "../ui/button.css.js";
import { iconMark } from "../ui/icon.css.js";
import { ArrowLeftOutline18 } from "../ui/icons/index.js";
import { editorShell, muted, toolbar } from "../ui/editor.css.js";
import { errorText } from "../ui/form.css.js";
import { header, page, subtitle, title } from "../ui/layout.css.js";

type NodeInstance = WorkflowDefinition["nodes"][number];

export const EditorPage = () => {
  const { flowId } = useParams<{ flowId: string }>();
  const [siteId, setSiteId] = useState<string>();
  const [csrf, setCsrf] = useState<string>();
  const [detail, setDetail] = useState<FlowDetail>();
  const [definition, setDefinition] = useState<WorkflowDefinition>();
  const [positions, setPositions] = useState<Record<string, { x: number; y: number }>>({});
  const [triggers, setTriggers] = useState<readonly TriggerBinding[]>([]);
  const [selectedId, setSelectedId] = useState<string>();
  const [message, setMessage] = useState<string>();
  const [deployStatus, setDeployStatus] = useState<string>();

  useEffect(() => {
    if (!flowId) {
      return;
    }
    void loadStatus()
      .then(async (status) => {
        setSiteId(status.site.id);
        setCsrf(status.user.csrfToken);
        const flow = await getFlow(status.site.id, flowId);
        setDetail(flow);
        setDefinition(
          (flow.draft.definition as WorkflowDefinition | undefined) ?? emptyDefinition(flowId),
        );
        setPositions(flow.editor.positions ?? {});
        setTriggers((flow.draft.triggers as TriggerBinding[]) ?? []);
        setDeployStatus(flow.deployment?.status);
      })
      .catch((caught: unknown) => {
        if (caught instanceof UnauthorizedError) {
          window.location.assign(loginHref);
        }
      });
  }, [flowId]);

  if (!siteId || !csrf || !flowId || !definition || !detail) {
    return (
      <div className={page({ tone: "muted" })}>
        <p>편집기를 불러오는 중…</p>
      </div>
    );
  }

  const persist = async () => {
    await saveDraft(siteId, flowId, csrf, {
      expectedVersion: detail.draft.version,
      definition,
      triggers,
      connections: [{ id: "ha", kind: "ha", connectionId: "ha" }],
    });
    await saveEditor(siteId, flowId, csrf, {
      expectedVersion: detail.editor.version,
      positions,
      viewport: detail.editor.viewport ?? { x: 0, y: 0, zoom: 1 },
    });
    const next = await getFlow(siteId, flowId);
    setDetail(next);
    setMessage("저장했습니다.");
  };

  return (
    <div className={page()}>
      <header className={header}>
        <div>
          <h1 className={title}>{detail.name}</h1>
          <p className={subtitle} data-testid="deploy-status">
            배포 {deployStatus ?? "없음"}
          </p>
        </div>
        <Link className={buttonRecipe()} to="/flows">
          <ArrowLeftOutline18 aria-hidden className={iconMark} />
          목록
        </Link>
      </header>
      <div className={toolbar}>
        <button className={buttonRecipe()} data-testid="save-draft" type="button" onClick={() => void persist()}>
          저장
        </button>
        <button
          className={buttonRecipe()}
          data-testid="validate-flow"
          type="button"
          onClick={() => {
            void validateFlow(siteId, flowId, csrf, definition).then((result) =>
              setMessage(result.ok ? "검증 통과" : result.diagnostics?.map((item) => item.message).join("; ")),
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
            void persist()
              .then(() => createRevision(siteId, flowId, csrf))
              .then((result) => setMessage(`revision ${result.revisionId}`));
          }}
        >
          Revision
        </button>
        <button
          className={buttonRecipe({ intent: "primary" })}
          data-testid="deploy-flow"
          type="button"
          onClick={() => {
            void persist()
              .then(() => createRevision(siteId, flowId, csrf))
              .then((revision) => deployRevision(siteId, flowId, csrf, revision.revisionId))
              .then(async (deployed) => {
                setMessage("배포 요청");
                for (let attempt = 0; attempt < 40; attempt += 1) {
                  const row = await getDeployment(siteId, deployed.deploymentId);
                  setDeployStatus(row.status);
                  if (row.status === "active" || row.status === "failed") {
                    setMessage(`배포 ${row.status}`);
                    return;
                  }
                  await new Promise((resolve) => setTimeout(resolve, 1000));
                }
              });
          }}
        >
          배포
        </button>
      </div>
      {message ? <p className={deployStatus === "failed" ? errorText : muted}>{message}</p> : null}
      <div className={editorShell}>
        <Palette
          onAdd={(type) => {
            const added = addNode(definition, type);
            setDefinition(bindNewNode(added.definition, added.nodeId, type));
            setSelectedId(added.nodeId);
          }}
        />
        <FlowCanvas
          definition={definition}
          positions={positions}
          selectedId={selectedId}
          onSelect={setSelectedId}
          onPositions={setPositions}
          onConnect={(connection) => {
            if (!connection.source || !connection.target) {
              return;
            }
            setDefinition({
              ...definition,
              edges: [
                ...definition.edges,
                {
                  id: `e-${connection.source}-${connection.target}`,
                  source: {
                    nodeId: connection.source,
                    port: connection.sourceHandle ?? "success",
                  },
                  target: { nodeId: connection.target, port: connection.targetHandle ?? "in" },
                },
              ],
            });
          }}
        />
        <Bindings
          definition={definition}
          selectedId={selectedId}
          triggers={triggers}
          onTriggers={setTriggers}
          onNode={(node: NodeInstance) => setDefinition(replaceNode(definition, node.id, node))}
        />
      </div>
    </div>
  );
};

const bindNewNode = (
  definition: WorkflowDefinition,
  nodeId: string,
  type: string,
): WorkflowDefinition => {
  const node = definition.nodes.find((item) => item.id === nodeId);
  if (!node) {
    return definition;
  }
  if (type === "analysis.rolling-mean") {
    const input = definition.nodes.find((item) => item.type === "core.input");
    return replaceNode(definition, nodeId, {
      ...node,
      inputs: {
        value: { kind: "output", nodeId: input?.id ?? "input", output: "value" },
      },
    });
  }
  if (type === "core.condition") {
    const mean = definition.nodes.find((item) => item.type === "analysis.rolling-mean");
    return replaceNode(definition, nodeId, {
      ...node,
      inputs: {
        left: { kind: "output", nodeId: mean?.id ?? "mean", output: "mean" },
      },
    });
  }
  return definition;
};
