/**
 * 캔버스 카드에 보이는 한 줄 요약. 설정이 비었으면 무엇을 채워야 하는지 말한다.
 */
import { actionLabel, type DeviceAction, type DeviceSummary } from "@howling/contracts";
import type { InputBinding, WorkflowDefinition } from "@howling/core";
import { joinNamesOf } from "./flow-ports.js";
import { OPERATOR_LABELS, formatDuration } from "./node-meta.js";

type NodeInstance = WorkflowDefinition["nodes"][number];

export interface NodeSummary {
  readonly text: string;
  readonly incomplete: boolean;
}

const bindingText = (binding: InputBinding | undefined): string => {
  if (!binding) {
    return "?";
  }
  if (binding.kind === "literal") {
    return typeof binding.value === "string" ? `"${binding.value}"` : JSON.stringify(binding.value);
  }
  if (binding.kind === "input") {
    return `입력${binding.path}`;
  }
  return binding.path ? `${binding.nodeId}${binding.path}` : `${binding.nodeId}.${binding.output}`;
};

const literalObject = (binding: InputBinding | undefined): Record<string, unknown> =>
  binding && binding.kind === "literal" && binding.value && typeof binding.value === "object"
    ? (binding.value as Record<string, unknown>)
    : {};

const effectSummary = (node: NodeInstance, devices: readonly DeviceSummary[]): NodeSummary => {
  const adapter = String(node.config.adapter ?? "device");
  const request = literalObject(node.inputs.request);
  if (adapter === "mcp") {
    const tool = String(request.tool ?? "");
    return tool
      ? { text: `MCP ${String(request.connectionId ?? "")} · ${tool}`, incomplete: false }
      : { text: "MCP 도구를 고르세요", incomplete: true };
  }
  if (adapter === "homeassistant") {
    const domain = String(request.domain ?? "");
    const service = String(request.service ?? "");
    return domain && service
      ? { text: `HA ${domain}.${service}`, incomplete: false }
      : { text: "HA 서비스를 채우세요", incomplete: true };
  }
  const deviceId = String(request.deviceId ?? "");
  const device = devices.find((item) => item.id === deviceId);
  if (!deviceId) {
    return { text: "기기를 고르세요", incomplete: true };
  }
  const action = String(request.action ?? "");
  const actionText = action ? actionLabel(action as DeviceAction) : "동작 없음";
  return { text: `${device?.name ?? "알 수 없는 기기"} · ${actionText}`, incomplete: !device };
};

const conditionSummary = (node: NodeInstance): NodeSummary => {
  const operator = String(node.config.operator ?? "gt");
  const meta = OPERATOR_LABELS[operator] ?? { symbol: operator, text: operator };
  const left = bindingText(node.inputs.left);
  if (operator === "isTrue" || operator === "isFalse") {
    return { text: `${left} 이(가) ${meta.text}`, incomplete: !node.inputs.left };
  }
  if (!node.inputs.right) {
    return { text: `${left} ${meta.symbol} ? (비교값 필요)`, incomplete: true };
  }
  return { text: `${left} ${meta.symbol} ${bindingText(node.inputs.right)}`, incomplete: !node.inputs.left };
};

export const summarizeNode = (
  node: NodeInstance,
  devices: readonly DeviceSummary[],
): NodeSummary => {
  switch (node.type) {
    case "core.input":
      return { text: "실행 입력 → value", incomplete: false };
    case "analysis.rolling-mean": {
      const path = node.inputs.value && "path" in node.inputs.value ? node.inputs.value.path : undefined;
      return {
        text: `최근 ${String(node.config.windowSize ?? 5)}개 평균 · ${path ?? "/power"}`,
        incomplete: false,
      };
    }
    case "core.condition":
      return conditionSummary(node);
    case "core.effect":
      return effectSummary(node, devices);
    case "core.delay":
      return { text: `${formatDuration(Number(node.config.durationMs ?? 0))} 기다림`, incomplete: false };
    case "core.map": {
      const keys = Object.keys(node.inputs);
      return keys.length > 0
        ? { text: `${String(keys.length)}개 필드: ${keys.join(", ")}`, incomplete: false }
        : { text: "필드를 추가하세요", incomplete: true };
    }
    case "core.all":
    case "core.any": {
      const names = joinNamesOf(node.config);
      const missing = names.filter((name) => !node.inputs[name]);
      const tail = node.type === "core.all" ? "모두" : "중 먼저";
      return {
        text: missing.length > 0 ? `${missing.join(", ")} 값이 비었음` : `${names.join(", ")} ${tail}`,
        incomplete: missing.length > 0,
      };
    }
    default:
      return { text: node.type, incomplete: false };
  }
};
