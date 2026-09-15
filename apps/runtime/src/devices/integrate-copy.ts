/**
 * 허브 연결 화면 문구. 내부 id는 넣지 않는다.
 */

export const publicIntegrateError = (error: unknown): string => {
  const raw = error instanceof Error ? error.message : String(error);
  if (/403|401/.test(raw)) {
    return "허브 계정에 기기를 연결할 권한이 없습니다.";
  }
  if (/already_configured|already configured/i.test(raw)) {
    return "이미 연결된 기기입니다.";
  }
  if (/no_devices_found|device_not_found|inconsistent_device/i.test(raw)) {
    return "같은 네트워크에서 찾지 못했습니다.";
  }
  if (/invalid_pin/i.test(raw)) {
    return "숫자가 올바르지 않습니다.";
  }
  if (/invalid_auth|device_did_not_pair/i.test(raw)) {
    return "화면의 숫자를 확인한 뒤 다시 연결하세요.";
  }
  if (/backoff/i.test(raw)) {
    return "잠시 후 다시 연결하세요.";
  }
  if (/cannot_connect|timeout|disconnected/i.test(raw)) {
    return "기기에 닿지 못했습니다.";
  }
  if (/register_failed|link/i.test(raw)) {
    return "기기 버튼을 누른 뒤 다시 연결하세요.";
  }
  if (/external|oauth/i.test(raw)) {
    return "이 기기는 지금은 Howling에서 이을 수 없습니다.";
  }
  return "기기를 연결하지 못했습니다.";
};

export const flowErrorOf = (errors: unknown): string | undefined => {
  if (!errors || typeof errors !== "object") {
    return undefined;
  }
  const values = Object.values(errors as Record<string, unknown>);
  const raw = values.find((item) => typeof item === "string");
  return typeof raw === "string" ? publicIntegrateError(new Error(raw)) : undefined;
};

export const descriptionOf = (
  stepId: string,
  fieldCount: number,
  placeholders: Readonly<Record<string, string>> = {},
  handler = "",
): string => {
  const pin = safePin(placeholders.pin);
  const who = [placeholders.name, placeholders.type].filter(Boolean).join(" · ");
  if (stepId === "pair_no_pin") {
    return pin
      ? `TV에 이 숫자를 입력한 뒤 계속하세요. ${pin}`
      : "TV에 나온 안내의 숫자를 입력한 뒤 계속하세요.";
  }
  if (stepId === "pair_with_pin") {
    return placeholders.protocol
      ? `TV 화면에 나온 숫자를 입력하세요. (${placeholders.protocol})`
      : "TV 화면에 나온 숫자를 입력하세요.";
  }
  if (handler === "apple_tv" && stepId === "user") {
    return "같은 네트워크에서 못 찾았습니다. 이름이나 주소를 넣으면 다시 찾습니다.";
  }
  if (stepId === "protocol_disabled") {
    return "이 연결 방식은 꺼져 있습니다. 계속하면 다음으로 넘어갑니다.";
  }
  if (stepId === "password") {
    return "이 연결 방식은 비밀번호를 쓰므로 건너뜁니다.";
  }
  if (stepId === "service_problem") {
    return "이 연결 방식은 지금은 쓸 수 없습니다. 계속하면 다음으로 갑니다.";
  }
  if (/link|button/.test(stepId)) {
    return "기기 가운데 버튼을 누른 뒤 계속하세요.";
  }
  if (/confirm|discovery|zeroconf|ssdp|homekit|hassio|bluetooth/.test(stepId)) {
    return who ? `이 기기를 연결할까요? ${who}` : "이 기기를 Howling에 연결할까요?";
  }
  if (fieldCount === 0) {
    return "안내에 따라 기기를 준비한 뒤 계속하세요.";
  }
  return "제조사 앱에 이미 있는 기기를 연결합니다.";
};

export const submitLabelOf = (stepId: string, fieldCount: number): string => {
  if (stepId === "pair_no_pin") {
    return "숫자를 입력했습니다";
  }
  if (stepId === "pair_with_pin") {
    return "연결";
  }
  if (/link|button/.test(stepId)) {
    return "버튼을 눌렀습니다";
  }
  if (fieldCount === 0) {
    return "계속";
  }
  return "연결";
};

const safePin = (value: string | undefined): string | undefined =>
  value && /^\d{3,8}$/.test(value) ? value : undefined;
