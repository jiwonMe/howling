/**
 * Effect binding. HA 기본 경로는 그대로 두고 MCP를 고를 수 있다.
 */
import type { JsonValue, WorkflowDefinition } from "@howling/core";
import { field, input, label, select } from "../ui/form.css.js";

type NodeInstance = WorkflowDefinition["nodes"][number];

export type McpToolOption = {
  readonly connectionId: string;
  readonly tool: string;
  readonly inputSchemaDigest: string;
  readonly title?: string;
};

export const EffectFields = (props: {
  readonly node: NodeInstance;
  readonly onNode: (node: NodeInstance) => void;
  readonly tools: readonly McpToolOption[];
}) => {
  const adapter = String(props.node.config.adapter ?? "homeassistant");
  return (
    <>
      <label className={field}>
        <span className={label}>adapter</span>
        <select
          className={select}
          data-testid="bind-adapter"
          value={adapter}
          onChange={(event) => switchAdapter(props, event.target.value)}
        >
          <option value="homeassistant">homeassistant</option>
          <option value="mcp">mcp</option>
        </select>
      </label>
      {adapter === "mcp" ? (
        <McpFields node={props.node} onNode={props.onNode} tools={props.tools} />
      ) : (
        <HaFields node={props.node} onNode={props.onNode} />
      )}
    </>
  );
};

const switchAdapter = (
  props: { readonly node: NodeInstance; readonly onNode: (node: NodeInstance) => void },
  adapter: string,
) => {
  if (adapter === "mcp") {
    props.onNode({
      ...props.node,
      config: { ...props.node.config, adapter: "mcp", operation: "call_tool" },
      inputs: {
        ...props.node.inputs,
        request: {
          kind: "literal",
          value: { connectionId: "", tool: "", arguments: {} } satisfies JsonValue,
        },
      },
    });
    return;
  }
  props.onNode({
    ...props.node,
    config: { ...props.node.config, adapter: "homeassistant", operation: "call_service" },
    inputs: {
      ...props.node.inputs,
      request: {
        kind: "literal",
        value: {
          domain: "",
          service: "",
          service_data: { entity_id: "" },
        } satisfies JsonValue,
      },
    },
  });
};

const HaFields = (props: {
  readonly node: NodeInstance;
  readonly onNode: (node: NodeInstance) => void;
}) => {
  const request = haRequest(props.node.inputs.request);
  const data = request.service_data ?? {};
  const set = (next: {
    readonly domain?: string;
    readonly service?: string;
    readonly service_data?: { readonly entity_id?: string };
  }) =>
    props.onNode({
      ...props.node,
      inputs: {
        ...props.node.inputs,
        request: {
          kind: "literal",
          value: {
            domain: next.domain ?? "",
            service: next.service ?? "",
            service_data: { entity_id: next.service_data?.entity_id ?? "" },
          } satisfies JsonValue,
        },
      },
    });
  return (
    <>
      <TextField
        label="domain"
        testId="bind-domain"
        value={String(request.domain ?? "")}
        onChange={(domain) => set({ ...request, domain })}
      />
      <TextField
        label="service"
        testId="bind-service"
        value={String(request.service ?? "")}
        onChange={(service) => set({ ...request, service })}
      />
      <TextField
        label="entity_id"
        testId="bind-entity"
        value={String(data.entity_id ?? "")}
        onChange={(entity) => set({ ...request, service_data: { ...data, entity_id: entity } })}
      />
    </>
  );
};

const McpFields = (props: {
  readonly node: NodeInstance;
  readonly onNode: (node: NodeInstance) => void;
  readonly tools: readonly McpToolOption[];
}) => {
  const request = mcpRequest(props.node.inputs.request);
  const servers = [...new Set(props.tools.map((item) => item.connectionId))];
  const tools = props.tools.filter((item) => item.connectionId === request.connectionId);
  const set = (next: {
    readonly connectionId?: string;
    readonly tool?: string;
    readonly arguments?: Record<string, string>;
    readonly inputSchemaDigest?: string;
  }) =>
    props.onNode({
      ...props.node,
      inputs: {
        ...props.node.inputs,
        request: {
          kind: "literal",
          value: {
            connectionId: next.connectionId ?? "",
            tool: next.tool ?? "",
            arguments: next.arguments ?? {},
            ...(next.inputSchemaDigest ? { inputSchemaDigest: next.inputSchemaDigest } : {}),
          } satisfies JsonValue,
        },
      },
    });
  return (
    <>
      <label className={field}>
        <span className={label}>connection</span>
        <select
          className={select}
          data-testid="bind-mcp-connection"
          value={request.connectionId}
          onChange={(event) => set({ ...request, connectionId: event.target.value, tool: "" })}
        >
          <option value="">선택</option>
          {servers.map((id) => (
            <option key={id} value={id}>
              {id}
            </option>
          ))}
        </select>
      </label>
      <label className={field}>
        <span className={label}>tool</span>
        <select
          className={select}
          data-testid="bind-mcp-tool"
          value={request.tool}
          onChange={(event) => {
            const picked = tools.find((item) => item.tool === event.target.value);
            set({
              ...request,
              tool: event.target.value,
              ...(picked?.inputSchemaDigest
                ? { inputSchemaDigest: picked.inputSchemaDigest }
                : {}),
            });
          }}
        >
          <option value="">선택</option>
          {tools.map((item) => (
            <option key={item.tool} value={item.tool}>
              {item.title ?? item.tool}
            </option>
          ))}
        </select>
      </label>
      <TextField
        label="arguments"
        testId="bind-mcp-args"
        value={JSON.stringify(request.arguments ?? {})}
        onChange={(value) => {
          try {
            const parsed = JSON.parse(value) as Record<string, string>;
            set({ ...request, arguments: parsed });
          } catch {
            set({ ...request, arguments: { text: value } });
          }
        }}
      />
    </>
  );
};

const TextField = (props: {
  readonly label: string;
  readonly testId: string;
  readonly value: string;
  readonly onChange: (value: string) => void;
}) => (
  <label className={field}>
    <span className={label}>{props.label}</span>
    <input
      className={input}
      data-testid={props.testId}
      value={props.value}
      onChange={(event) => props.onChange(event.target.value)}
    />
  </label>
);

const haRequest = (binding?: { kind?: string; value?: unknown }) => {
  if (!binding || binding.kind !== "literal" || !binding.value || typeof binding.value !== "object") {
    return {};
  }
  return binding.value as {
    readonly domain?: string;
    readonly service?: string;
    readonly service_data?: { readonly entity_id?: string };
  };
};

const mcpRequest = (binding?: { kind?: string; value?: unknown }) => {
  if (!binding || binding.kind !== "literal" || !binding.value || typeof binding.value !== "object") {
    return { connectionId: "", tool: "", arguments: {} };
  }
  const value = binding.value as {
    connectionId?: string;
    tool?: string;
    arguments?: Record<string, string>;
  };
  return {
    connectionId: value.connectionId ?? "",
    tool: value.tool ?? "",
    arguments: value.arguments ?? {},
  };
};
