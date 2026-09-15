/**
 * Flow·run HTTP DTO.
 */
export const presentFlow = (row: {
  readonly draft: {
    readonly id: string;
    readonly name: string;
    readonly version: number;
    readonly definition_json: unknown;
    readonly triggers_json: unknown;
    readonly connections_json: unknown;
    readonly execution_policy_json?: unknown;
  };
  readonly editor?: {
    readonly version: number;
    readonly positions_json: unknown;
    readonly viewport_json: unknown;
  };
  readonly deployment?: {
    readonly id: string;
    readonly revision_id: string;
    readonly status: string;
    readonly generation: number;
  };
  readonly revisions?: readonly { readonly id: string; readonly created_at: string }[];
}) => ({
  flowId: row.draft.id,
  name: row.draft.name,
  draft: {
    version: row.draft.version,
    definition: row.draft.definition_json,
    triggers: row.draft.triggers_json,
    connections: row.draft.connections_json,
    executionPolicy: row.draft.execution_policy_json ?? { mode: "live", captureRaw: false },
  },
  editor: {
    version: row.editor?.version ?? 1,
    positions: (row.editor?.positions_json ?? {}) as Record<string, { x: number; y: number }>,
    viewport: (row.editor?.viewport_json ?? { x: 0, y: 0, zoom: 1 }) as {
      x: number;
      y: number;
      zoom: number;
    },
  },
  deployment: row.deployment
    ? {
        id: row.deployment.id,
        revisionId: row.deployment.revision_id,
        status: row.deployment.status,
        generation: row.deployment.generation,
      }
    : null,
  revisions: row.revisions ?? [],
});

export const presentRun = (row: {
  readonly run_id: string;
  readonly flow_id: string;
  readonly revision_id: string;
  readonly status: string;
  readonly last_seq: number;
  readonly trigger_json: unknown;
  readonly events_json: unknown;
  readonly run_mode?: string;
}) => ({
  runId: row.run_id,
  flowId: row.flow_id,
  revisionId: row.revision_id,
  status: row.status,
  lastSeq: row.last_seq,
  trigger: row.trigger_json,
  events: row.events_json,
  runMode: row.run_mode ?? "live",
});
