/**
 * 플로 시험용 가상 스위치·숫자. 집 기기가 아니다.
 */
import type { CreatableDeviceKind, DeviceSummary } from "@howling/contracts";
import { useState, type FormEvent } from "react";
import { loginHref, UnauthorizedError } from "../lib/api.js";
import { createDevice } from "../lib/devices-api.js";
import { buttonRecipe } from "../ui/button.css.js";
import { errorText, field, formStack, input, label, select } from "../ui/form.css.js";
import { caption } from "../ui/layout.css.js";

export const DeviceCreateForm = (props: {
  readonly siteId: string;
  readonly csrf: string;
  readonly ready: boolean;
  readonly onCreated: (device: DeviceSummary) => void;
  readonly onBack: () => void;
}) => {
  const [name, setName] = useState("");
  const [kind, setKind] = useState<CreatableDeviceKind>("boolean");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const trimmed = name.trim();
    if (!trimmed || busy || !props.ready) {
      return;
    }
    setBusy(true);
    setError(undefined);
    void createDevice(props.siteId, props.csrf, { name: trimmed, kind })
      .then((device) => {
        setName("");
        props.onCreated(device);
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
    <form className={formStack} data-testid="device-create" onSubmit={submit}>
      <p className={caption}>가상 기기</p>
      <p className={caption}>플로에서 쓰는 스위치와 숫자입니다. 집 기기가 아닙니다.</p>
      <label className={field}>
        <span className={label}>이름</span>
        <input
          className={input}
          data-testid="device-name"
          maxLength={64}
          name="name"
          value={name}
          onChange={(event) => setName(event.target.value)}
        />
      </label>
      <label className={field}>
        <span className={label}>종류</span>
        <select
          className={select}
          data-testid="device-kind"
          name="kind"
          value={kind}
          onChange={(event) => setKind(event.target.value as CreatableDeviceKind)}
        >
          <option value="boolean">스위치 (켜기/끄기)</option>
          <option value="number">숫자 (전력, 온도)</option>
        </select>
      </label>
      <button
        className={buttonRecipe({ intent: "primary" })}
        data-testid="device-add"
        disabled={busy || !props.ready || name.trim() === ""}
        type="submit"
      >
        연결
      </button>
      <button className={buttonRecipe()} disabled={busy} type="button" onClick={props.onBack}>
        처음으로
      </button>
      {error ? <p className={errorText}>{error}</p> : null}
    </form>
  );
};
