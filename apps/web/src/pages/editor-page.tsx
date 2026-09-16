/**
 * 초안 저장·검증·revision·배포.
 */
import type { DeviceSummary, TriggerBinding } from "@howling/contracts";
import type { WorkflowDefinition } from "@howling/core";
import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { Bindings } from "../editor/bindings.js";
import type { McpToolOption } from "../editor/effect-fields.js";
import { FlowCanvas } from "../editor/flow-canvas.js";
import { Palette } from "../editor/palette.js";
import { EditorToolbar } from "../editor/toolbar.js";
import { loginHref, UnauthorizedError } from "../lib/api.js";
import { getDevices } from "../lib/devices-api.js";
import { getConnections, getFlow, saveDraft, saveEditor, type FlowDetail } from "../lib/flows-api.js";
import { connectEdgeWithBinding } from "../lib/flow-edges.js";
import {
  addNode,
  draftConnections,
  emptyDefinition,
  repairBindings,
  replaceNode,
} from "../lib/flow-model.js";
import { removeEdges, removeNodes } from "../lib/flow-remove.js";
import { loadStatus } from "../lib/status.js";
import { buttonRecipe } from "../ui/button.css.js";
import {
  editorStage,
  floatBar,
  floatCluster,
  floatNote,
  floatTitle,
  muted,
  toolbar,
} from "../ui/editor.css.js";
import { errorText } from "../ui/form.css.js";
import { iconMark } from "../ui/icon.css.js";
import { ArrowLeftOutline18 } from "../ui/icons/index.js";
import { page, subtitle } from "../ui/layout.css.js";

type NodeInstance = WorkflowDefinition["nodes"][number];

export const EditorPage = () => {
  const navigate = useNavigate();
  const { flowId } = useParams<{ flowId: string }>();
  const [siteId, setSiteId] = useState<string>();
  const [csrf, setCsrf] = useState<string>();
  const [detail, setDetail] = useState<FlowDetail>();
  const [definition, setDefinition] = useState<WorkflowDefinition>();
  const [positions, setPositions] = useState<Record<string, { x: number; y: number }>>({});
  const [triggers, setTriggers] = useState<readonly TriggerBinding[]>([]);
  const [selectedId, setSelectedId] = useState<string>();
  const [selectedEdgeId, setSelectedEdgeId] = useState<string>();
  const [message, setMessage] = useState<string>();
  const [deployStatus, setDeployStatus] = useState<string>();
  const [testPower, setTestPower] = useState("1400");
  const [tools, setTools] = useState<readonly McpToolOption[]>([]);
  const [devices, setDevices] = useState<readonly DeviceSummary[]>([]);
  const [captureRaw, setCaptureRaw] = useState(false);

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
          repairBindings(
            (flow.draft.definition as WorkflowDefinition | undefined) ?? emptyDefinition(flowId),
          ),
        );
        setPositions(flow.editor.positions ?? {});
        setTriggers((flow.draft.triggers as TriggerBinding[]) ?? []);
        setDeployStatus(flow.deployment?.status);
        setCaptureRaw(flow.draft.executionPolicy?.captureRaw ?? false);
        const catalog = await getConnections(status.site.id);
        setTools(catalog.connections.mcp?.servers.flatMap((server) => server.tools) ?? []);
        const listed = await getDevices(status.site.id).catch(() => ({ devices: [] }));
        setDevices(listed.devices);
      })
      .catch((caught: unknown) => {
        if (caught instanceof UnauthorizedError) {
          window.location.assign(loginHref);
        }
      });
  }, [flowId]);

  useEffect(() => {
    if (!siteId) {
      return;
    }
    const refresh = () => {
      void getDevices(siteId)
        .then((listed) => setDevices(listed.devices))
        .catch((caught: unknown) => {
          if (caught instanceof UnauthorizedError) {
            window.location.assign(loginHref);
          }
        });
    };
    refresh();
    const timer = window.setInterval(refresh, 4000);
    return () => window.clearInterval(timer);
  }, [siteId]);

  if (!siteId || !csrf || !flowId || !definition || !detail) {
    return (
      <div className={page({ tone: "muted" })}>
        <p>편집기를 불러오는 중…</p>
      </div>
    );
  }

  const previousRevision = (detail.revisions ?? []).find(
    (item) => item.id !== detail.deployment?.revisionId,
  )?.id;

  const persist = async () => {
    const next = repairBindings(definition);
    setDefinition(next);
    await saveDraft(siteId, flowId, csrf, {
      expectedVersion: detail.draft.version,
      definition: next,
      triggers,
      connections: draftConnections(next),
      executionPolicy: { mode: "live", captureRaw },
    });
    await saveEditor(siteId, flowId, csrf, {
      expectedVersion: detail.editor.version,
      positions,
      viewport: detail.editor.viewport ?? { x: 0, y: 0, zoom: 1 },
    });
    const saved = await getFlow(siteId, flowId);
    setDetail(saved);
    setMessage("저장했습니다.");
    return next;
  };

  const deleteNodes = (ids: readonly string[]) => {
    setDefinition(removeNodes(definition, ids));
    if (selectedId && ids.includes(selectedId)) {
      setSelectedId(undefined);
    }
  };
  const deleteEdges = (ids: readonly string[]) => {
    setDefinition(removeEdges(definition, ids));
    if (selectedEdgeId && ids.includes(selectedEdgeId)) {
      setSelectedEdgeId(undefined);
    }
  };

  return (
    <div className={editorStage}>
      <FlowCanvas
        definition={definition}
        devices={devices}
        positions={positions}
        selectedId={selectedId}
        selectedEdgeId={selectedEdgeId}
        onSelect={setSelectedId}
        onSelectEdge={setSelectedEdgeId}
        onDeleteNodes={deleteNodes}
        onDeleteEdges={deleteEdges}
        onPositions={setPositions}
        onConnect={(connection) => {
          if (!connection.source || !connection.target) {
            return;
          }
          setDefinition(
            connectEdgeWithBinding(definition, {
              sourceId: connection.source,
              targetId: connection.target,
              ...(connection.sourceHandle ? { sourcePort: connection.sourceHandle } : {}),
              ...(connection.targetHandle ? { targetPort: connection.targetHandle } : {}),
            }),
          );
        }}
      />
      <div className={floatBar}>
        <header className={floatCluster}>
          <Link className={buttonRecipe()} to="/flows">
            <ArrowLeftOutline18 aria-hidden className={iconMark} />
            목록
          </Link>
          <div>
            <h1 className={floatTitle}>{detail.name}</h1>
            <p className={subtitle} data-testid="deploy-status">
              배포 {deployStatus ?? "없음"} · 노드 {definition.nodes.length}
            </p>
          </div>
        </header>
        <div className={`${floatCluster} ${toolbar}`}>
          <EditorToolbar
            siteId={siteId}
            flowId={flowId}
            csrf={csrf}
            definition={definition}
            testPower={testPower}
            persist={persist}
            onDefinition={setDefinition}
            onMessage={setMessage}
            onDeployStatus={setDeployStatus}
            onOpenedRun={(runId) => navigate(`/runs/${runId}`)}
            captureRaw={captureRaw}
            onCaptureRaw={setCaptureRaw}
            {...(deployStatus ? { deployStatus } : {})}
            {...(previousRevision ? { previousRevision } : {})}
          />
        </div>
      </div>
      <Palette
        hasInput={definition.nodes.length > 0}
        onAdd={(type) => {
          const added = addNode(definition, type);
          setDefinition(added.definition);
          setSelectedEdgeId(undefined);
          setSelectedId(added.nodeId);
        }}
      />
      <Bindings
        definition={definition}
        onTestPower={setTestPower}
        selectedId={selectedId}
        selectedEdgeId={selectedEdgeId}
        onDeleteNode={(id) => deleteNodes([id])}
        onDeleteEdge={(id) => deleteEdges([id])}
        testPower={testPower}
        triggers={triggers}
        onTriggers={setTriggers}
        onNode={(node: NodeInstance) => setDefinition(replaceNode(definition, node.id, node))}
        onDefinition={setDefinition}
        tools={tools}
        devices={devices}
      />
      {message ? (
        <p className={`${floatNote} ${deployStatus === "failed" ? errorText : muted}`}>{message}</p>
      ) : null}
    </div>
  );
};
