/**
 * 기기 동작 필드. entity_id 키는 계약에서 받지 않는다.
 */

export type DeviceActionField = {
  readonly key: string;
  readonly label: string;
  readonly type: "text" | "number" | "select" | "boolean";
  readonly required: boolean;
  readonly options?: readonly { readonly key: string; readonly name: string }[];
};

export type DeviceService = {
  readonly action: string;
  readonly fields?: readonly DeviceActionField[];
};

export const field = (
  key: string,
  label: string,
  type: DeviceActionField["type"],
  required = false,
): DeviceActionField => ({ key, label, type, required });
