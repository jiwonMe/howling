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
  mcpEffectInputSchema,
  mcpLocalSetupSchema,
  mcpServerSnapshotSchema,
  mcpSnapshotSchema,
  mcpToolCatalogItemSchema,
  oauthCodePayloadSchema,
} from "./mcp.js";
export type {
  McpEffectInput,
  McpLocalSetup,
  McpSnapshot,
  McpToolCatalogItem,
  OauthCodePayload,
} from "./mcp.js";
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
export type { CatalogNode } from "./catalog.js";
export {
  deployRequestSchema,
  draftSaveSchema,
  editorSaveSchema,
  effectFixtureSchema,
  effectResponseSchema,
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
  deviceActionRequestSchema,
  deviceActionSchema,
  deviceKindSchema,
  deviceSummarySchema,
  deviceTriggerConfigSchema,
  devicesSnapshotSchema,
} from "./devices.js";
export type {
  DeviceAction,
  DeviceActionRequest,
  DeviceKind,
  DeviceSummary,
  DeviceTriggerConfig,
  DevicesSnapshot,
} from "./devices.js";
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
