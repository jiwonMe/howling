/**
 * 기기 이름 변경·삭제. entity_id는 없다.
 */
import { originOf, type DeviceSummary } from "@howling/contracts";
import { useState, type FormEvent } from "react";
import { loginHref, UnauthorizedError } from "../lib/api.js";
import { deleteDevice, updateDevice } from "../lib/devices-api.js";
import { buttonRecipe } from "../ui/button.css.js";
import { errorText, field, formStack, input, label } from "../ui/form.css.js";
import { caption } from "../ui/layout.css.js";
import { manageRow } from "./device-manage.css.js";

export const DeviceManage = (props: {
  readonly device: DeviceSummary;
  readonly siteId: string;
  readonly csrf: string;
  readonly onDevice: (device: DeviceSummary) => void;
  readonly onGone: (deviceId: string) => void;
}) => {
  const [mode, setMode] = useState<"idle" | "edit" | "delete">("idle");
  const [name, setName] = useState(props.device.name);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();

  const fail = (caught: unknown, fallback: string) => {
    if (caught instanceof UnauthorizedError) {
      window.location.assign(loginHref);
      return;
    }
    setError(caught instanceof Error ? caught.message : fallback);
  };

  const save = (event: FormEvent) => {
    event.preventDefault();
    const trimmed = name.trim();
    if (!trimmed || busy) {
      return;
    }
    setBusy(true);
    setError(undefined);
    void updateDevice(props.siteId, props.csrf, props.device.id, { name: trimmed })
      .then((device) => {
        props.onDevice(device);
        setMode("idle");
      })
      .catch((caught: unknown) => fail(caught, "이름을 바꾸지 못했습니다."))
      .finally(() => setBusy(false));
  };

  const remove = () => {
    if (busy) {
      return;
    }
    setBusy(true);
    setError(undefined);
    void deleteDevice(props.siteId, props.csrf, props.device.id)
      .then(() => props.onGone(props.device.id))
      .catch((caught: unknown) => fail(caught, "기기를 지우지 못했습니다."))
      .finally(() => setBusy(false));
  };

  if (mode === "edit") {
    return (
      <form className={formStack} data-testid="device-edit" onSubmit={save}>
        <label className={field}>
          <span className={label}>이름</span>
          <input
            className={input}
            data-testid="device-edit-name"
            value={name}
            onChange={(event) => setName(event.target.value)}
          />
        </label>
        {error ? <p className={errorText}>{error}</p> : null}
        <div className={manageRow}>
          <button className={buttonRecipe({ intent: "primary" })} data-testid="device-edit-save" disabled={busy} type="submit">
            저장
          </button>
          <button className={buttonRecipe()} data-testid="device-edit-cancel" disabled={busy} type="button" onClick={() => setMode("idle")}>
            취소
          </button>
        </div>
      </form>
    );
  }

  if (mode === "delete") {
    return (
      <div className={formStack} data-testid="device-delete">
        <p className={caption}>{props.device.name}을 삭제할까요?</p>
        <p className={caption}>
          {originOf(props.device) === "virtual"
            ? "플로 시험용입니다. 목록에서 없어집니다."
            : "시험 스위치·숫자는 허브에서도 지웁니다. 그 외 집 기기는 허브에서 빼야 합니다."}
        </p>
        {error ? <p className={errorText}>{error}</p> : null}
        <div className={manageRow}>
          <button className={buttonRecipe({ intent: "primary" })} data-testid="device-delete-confirm" disabled={busy} type="button" onClick={remove}>
            삭제
          </button>
          <button className={buttonRecipe()} data-testid="device-delete-cancel" disabled={busy} type="button" onClick={() => setMode("idle")}>
            취소
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={formStack}>
      {error ? <p className={errorText}>{error}</p> : null}
      <div className={manageRow}>
        <button
          className={buttonRecipe()}
          data-testid="device-edit-open"
          type="button"
          onClick={() => {
            setName(props.device.name);
            setError(undefined);
            setMode("edit");
          }}
        >
          수정
        </button>
        {canDeleteOf(props.device) ? (
          <button
            className={buttonRecipe()}
            data-testid="device-delete-open"
            type="button"
            onClick={() => {
              setError(undefined);
              setMode("delete");
            }}
          >
            삭제
          </button>
        ) : null}
      </div>
    </div>
  );
};

const canDeleteOf = (item: DeviceSummary): boolean =>
  item.deletable === true || originOf(item) === "virtual";
