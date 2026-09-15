/**
 * 가상 기기를 YAML로 여러 개 만든다. entity_id는 넣지 않는다.
 */
import { parseVirtualDevicesYaml, type DeviceSummary } from "@howling/contracts";
import { useState, type FormEvent } from "react";
import { loginHref, UnauthorizedError } from "../lib/api.js";
import { createDevice } from "../lib/devices-api.js";
import { buttonRecipe } from "../ui/button.css.js";
import { errorText, field, formStack, label, textarea } from "../ui/form.css.js";
import { caption } from "../ui/layout.css.js";

const EXAMPLE = `- name: 작업실 TV
  product: Apple TV
- name: 시험 스위치
  kind: boolean
- name: 시험 전력
  kind: number
  min: 0
  max: 10000
  step: 1
`;

export const DeviceCreateYaml = (props: {
  readonly siteId: string;
  readonly csrf: string;
  readonly ready: boolean;
  readonly onCreated: (devices: readonly DeviceSummary[], done?: boolean) => void;
  readonly onBack: () => void;
  readonly onForm: () => void;
}) => {
  const [text, setText] = useState(EXAMPLE);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (busy || !props.ready) {
      return;
    }
    let items;
    try {
      items = parseVirtualDevicesYaml(text);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "YAML 형식이 올바르지 않습니다.");
      return;
    }
    setBusy(true);
    setError(undefined);
    void createAll(props.siteId, props.csrf, items)
      .then((result) => {
        if (result.devices.length > 0) {
          props.onCreated(result.devices, result.error === undefined);
        }
        if (result.error) {
          setError(result.error);
        }
      })
      .catch((caught: unknown) => {
        if (caught instanceof UnauthorizedError) {
          window.location.assign(loginHref);
          return;
        }
        setError(caught instanceof Error ? caught.message : "가상 기기를 연결하지 못했습니다.");
      })
      .finally(() => {
        setBusy(false);
      });
  };

  return (
    <form className={formStack} data-testid="device-create-yaml" onSubmit={submit}>
      <p className={caption}>가상 기기 YAML</p>
      <p className={caption}>이름과 종류를 YAML로 여러 개 넣을 수 있습니다. 제품은 Apple TV처럼, 스위치는 boolean, 숫자는 number입니다.</p>
      <label className={field}>
        <span className={label}>YAML</span>
        <textarea
          className={textarea}
          data-testid="device-yaml"
          name="yaml"
          spellCheck={false}
          value={text}
          onChange={(event) => setText(event.target.value)}
        />
      </label>
      <button
        className={buttonRecipe({ intent: "primary" })}
        data-testid="device-add-yaml"
        disabled={busy || !props.ready || text.trim() === ""}
        type="submit"
      >
        연결
      </button>
      <button className={buttonRecipe()} disabled={busy} type="button" onClick={props.onForm}>
        한 개씩 넣기
      </button>
      <button className={buttonRecipe()} disabled={busy} type="button" onClick={props.onBack}>
        처음으로
      </button>
      {error ? <p className={errorText}>{error}</p> : null}
    </form>
  );
};

const createAll = async (
  siteId: string,
  csrf: string,
  items: ReturnType<typeof parseVirtualDevicesYaml>,
): Promise<{ devices: DeviceSummary[]; error?: string }> => {
  const devices: DeviceSummary[] = [];
  for (const item of items) {
    try {
      devices.push(...(await createDevice(siteId, csrf, item)));
    } catch (caught) {
      if (caught instanceof UnauthorizedError) {
        throw caught;
      }
      const reason = caught instanceof Error ? caught.message : "가상 기기를 연결하지 못했습니다.";
      return {
        devices,
        error:
          devices.length === 0
            ? `${item.name}: ${reason}`
            : `${item.name}은 연결하지 못했습니다. ${reason} 앞의 ${devices.length}개는 목록에 있습니다.`,
      };
    }
  }
  return { devices };
};
