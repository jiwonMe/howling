/**
 * 제품 계약 공개 진입점.
 * Host는 여기 export만 사용한다. React·DB·HTTP 클라이언트는 넣지 않는다.
 */
export { errorBody, errorBodySchema, errorCodes } from "./errors.js";
export type { ErrorBody } from "./errors.js";
export {
  healthServiceSchema,
  healthStatusSchema,
  readyChecksSchema,
  readyStatusSchema,
} from "./health.js";
export type { HealthStatus, ReadyStatus } from "./health.js";
export {
  currentUserSchema,
  ownerPermissions,
  permissionSchema,
  siteListSchema,
  siteSummarySchema,
} from "./auth.js";
export type { CurrentUser, Permission, SiteList, SiteSummary } from "./auth.js";
export {
  haConnectionPlaceholderSchema,
  haConnectionSchema,
  haStatusSchema,
  runtimeStatusSchema,
} from "./runtime-status.js";
export type { HaStatus, RuntimeStatus } from "./runtime-status.js";
export {
  issueTokenRequestSchema,
  issuedTokenSchema,
  tokenListItemSchema,
  tokenListSchema,
} from "./tokens.js";
export type { IssueTokenRequest, IssuedToken, TokenListItem } from "./tokens.js";
export {
  MCP_TOOL_SCOPES,
  mcpCreateFlowSchema,
  mcpEffectInputSchema,
  mcpLocalSetupSchema,
  mcpServerSnapshotSchema,
  mcpSnapshotSchema,
  mcpToolCatalogItemSchema,
  oauthCodePayloadSchema,
} from "./mcp.js";
export type {
  McpCreateFlow,
  McpEffectInput,
  McpLocalSetup,
  McpSnapshot,
  McpToolCatalogItem,
  OauthCodePayload,
} from "./mcp.js";
export {
  TRIGGER_KINDS,
  haStateTriggerConfigSchema,
  scheduleTriggerConfigSchema,
  sunTriggerConfigSchema,
  triggerBindingSchema,
  triggerListSchema,
  triggerNeedsHa,
} from "./triggers.js";
export type {
  HaStateTriggerConfig,
  ScheduleTriggerConfig,
  SunTriggerConfig,
} from "./triggers.js";
export {
  pairingClaimRequestSchema,
  pairingClaimResponseSchema,
  pairingCompleteResponseSchema,
  pairingCreateResponseSchema,
} from "./pairing.js";
export type {
  PairingCompleteResponse,
  PairingCreateResponse,
} from "./pairing.js";
export { NODE_CATALOG_VERSION, officialCatalog } from "./catalog.js";
export {
  DARK_WEATHER,
  SWITCH_PLACEHOLDER,
  WEATHER_PLACEHOLDER,
  sunsetDeskLightConnections,
  sunsetDeskLightDefinition,
  sunsetDeskLightExample,
  sunsetDeskLightTriggers,
} from "./example-sunset.js";
export type { CatalogNode } from "./catalog.js";
export {
  deployRequestSchema,
  draftSaveSchema,
  editorSaveSchema,
  effectFixtureSchema,
  effectResponseSchema,
  flowRenameSchema,
  runCommandRequestSchema,
  runSummarySchema,
  startRunRequestSchema,
  testSessionRequestSchema,
} from "./flow-api.js";
export type {
  DeployRequest,
  DraftSave,
  EditorSave,
  EffectFixture,
  FlowRename,
  RunCommandRequest,
  RunSummary,
  TestSessionRequest,
} from "./flow-api.js";
export {
  activationResultSchema,
  connectionsSnapshotSchema,
  desiredDeploymentSchema,
  runCommandPayloadSchema,
  runStartPayloadSchema,
  runSummaryPayloadSchema,
  summaryAckSchema,
  summaryBatchSchema,
  summaryItemSchema,
} from "./runtime/control.js";
export {
  parseRuntimeEnvelope,
  runtimeEnvelopeSchema,
} from "./runtime/envelope.js";
export type { RuntimeEnvelope } from "./runtime/envelope.js";
export {
  HEARTBEAT_INTERVAL_MS,
  HEARTBEAT_TIMEOUT_MS,
  capabilitiesPayloadSchema,
  connectMessageTypeSchema,
  heartbeatAckPayloadSchema,
  heartbeatPayloadSchema,
  helloPayloadSchema,
} from "./runtime/connect.js";
export type {
  CapabilitiesPayload,
  ConnectMessageType,
  HeartbeatAckPayload,
  HeartbeatPayload,
  HelloPayload,
} from "./runtime/connect.js";
export { reservedRuntimeMessageTypes } from "./runtime/types.js";
export type { ReservedRuntimeMessageType } from "./runtime/types.js";
export {
  DEFAULT_DATA_POLICY,
  GIB,
  MCP_OAUTH_PRESETS,
  analyticsSnapshotSchema,
  detailRequestBodySchema,
  observationFieldSchema,
  observationSpecSchema,
  observeSampleSchema,
  siteDataPolicySchema,
} from "./data.js";
export type {
  AnalyticsSnapshot,
  ObservationField,
  ObservationSpec,
  ObserveSample,
  SiteDataPolicy,
} from "./data.js";
export {
  desiredDataSchema,
  detailRequestSchema,
  detailResponseSchema,
  observeBatchSchema,
  rawBatchSchema,
  streamAckSchema,
  syncStreamSchema,
} from "./runtime/streams.js";
export {
  DEVICE_ACTION_LABELS,
  DEVICE_KIND_LABELS,
  DEVICE_ORIGIN_LABELS,
  actionLabel,
  deviceOriginSchema,
  creatableDeviceKindSchema,
  deviceActionBodySchema,
  deviceActionInvokeSchema,
  deviceActionRequestSchema,
  deviceActionResultSchema,
  deviceActionSchema,
  deviceCreateBodySchema,
  deviceCreateRequestSchema,
  deviceCreateResultSchema,
  deviceKindSchema,
  deviceReadRequestSchema,
  deviceSummarySchema,
  deviceTriggerConfigSchema,
  devicesSnapshotSchema,
  helperDeviceKindSchema,
  isHelperCreate,
  originLabel,
  originOf,
} from "./devices.js";
export {
  deviceDeleteRequestSchema,
  deviceDeleteResultSchema,
  deviceUpdateBodySchema,
  deviceUpdateRequestSchema,
  deviceUpdateResultSchema,
} from "./device-mutate.js";
export type {
  DeviceDeleteRequest,
  DeviceDeleteResult,
  DeviceUpdateBody,
  DeviceUpdateRequest,
  DeviceUpdateResult,
} from "./device-mutate.js";
export { actionsOf, fieldsOf } from "./device-services.js";
export type { DeviceActionField, DeviceService } from "./device-services.js";
export {
  DEVICE_STATE_LABELS,
  looksLikeEntityId,
  onDeviceBoard,
  publicAttrsOf,
  readingOf,
  stateLabel,
} from "./device-state.js";
export { productIdOf, productNameOf, productPartsOf } from "./device-products.js";
export type { ProductPart } from "./device-products.js";
export { parseVirtualDevicesYaml } from "./device-yaml.js";
export {
  booleanTriggerOf,
  defaultTriggerKey,
  isPrimaryTriggerKey,
  isTriggerableDevice,
} from "./device-triggers.js";
export {
  FIELDS_ATTR,
  actionFieldsOf,
  applyFieldData,
  fieldsFromAttrs,
  initialAttrsOf,
  publicFieldsOf,
  readingFromFields,
  stateFromFields,
  valueAttrsOf,
  virtualFieldSchema,
  virtualFieldStateSchema,
  virtualFieldsSchema,
} from "./device-virtual-fields.js";
export type { VirtualField, VirtualFieldState, VirtualFieldType } from "./device-virtual-fields.js";
export type {
  CreatableDeviceKind,
  DeviceAction,
  DeviceActionBody,
  DeviceActionInvoke,
  DeviceActionRequest,
  DeviceActionResult,
  DeviceCreateBody,
  DeviceCreateRequest,
  DeviceCreateResult,
  DeviceKind,
  DeviceOrigin,
  DeviceReadRequest,
  DeviceSummary,
  DeviceTriggerConfig,
  DevicesSnapshot,
  HelperDeviceKind,
} from "./devices.js";
export {
  DEVICE_INTEGRATIONS,
  VIRTUAL_DEVICE,
  deviceIntegrateBodySchema,
  deviceIntegrateFieldSchema,
  deviceIntegrateRequestSchema,
  deviceIntegrateResultSchema,
  deviceIntegrationIdSchema,
  deviceIntegrationOf,
  deviceIntegrationSchema,
} from "./device-integrations.js";
export type {
  DeviceIntegrateBody,
  DeviceIntegrateField,
  DeviceIntegrateRequest,
  DeviceIntegrateResult,
  DeviceIntegration,
  DeviceIntegrationId,
} from "./device-integrations.js";
export type {
  DesiredData,
  DetailRequest,
  DetailResponse,
  ObserveBatch,
  RawBatch,
  SyncStream,
} from "./runtime/streams.js";
export type {
  ConnectionBinding,
  EditorDocument,
  EditorGroup,
  ExecutionPolicy,
  ProductFlowDraft,
  RevisionArtifact,
  RuntimeRequirements,
  TriggerBinding,
  TriggerKind,
} from "./flow.js";
