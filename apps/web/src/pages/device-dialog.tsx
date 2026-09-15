/**
 * 대시보드에서 기기를 켜고 끈다. entity_id는 없다.
 */
import {
  actionLabel,
  DEVICE_KIND_LABELS,
  fieldsOf,
  originLabel,
  originOf,
  stateLabel,
  type DeviceAction,
  type DeviceSummary,
} from "@howling/contracts";
import { useEffect, useRef, useState } from "react";
import { DeviceActionFields } from "../editor/device-action-fields.js";
import { loginHref, UnauthorizedError } from "../lib/api.js";
import { actDevice } from "../lib/devices-api.js";
import { buttonRecipe } from "../ui/button.css.js";
import { errorText, field, formStack, label, select } from "../ui/form.css.js";
import { caption } from "../ui/layout.css.js";
import { dialog, dialogNow, dialogTitle, quickRow } from "./device-dialog.css.js";
import { DeviceManage } from "./device-manage.js";

const QUICK = ["turn_on", "turn_off", "toggle", "media_play", "media_pause", "media_stop"] as const;

export const DeviceDialog = (props: {
  readonly device: DeviceSummary;
  readonly siteId: string;
  readonly csrf: string;
  readonly onClose: () => void;
  readonly onDevice: (device: DeviceSummary) => void;
  readonly onGone: (deviceId: string) => void;
}) => {
  const ref = useRef<HTMLDialogElement>(null);
  const [action, setAction] = useState<DeviceAction>(props.device.actions[0] ?? "");
  const [data, setData] = useState<Record<string, string | number | boolean>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();

  useEffect(() => {
    const node = ref.current;
    if (!node) {
      return;
    }
    if (!node.open) {
      node.showModal();
    }
    const onClose = () => props.onClose();
    node.addEventListener("close", onClose);
    return () => node.removeEventListener("close", onClose);
  }, [props.onClose]);

  const run = (next: DeviceAction, extra: Record<string, string | number | boolean> = {}) => {
    if (busy || !props.device.available) {
      return;
    }
    setBusy(true);
    setError(undefined);
    void actDevice(props.siteId, props.csrf, props.device.id, {
      action: next,
      ...(Object.keys(extra).length > 0 ? { data: extra } : {}),
    })
      .then((device) => {
        props.onDevice(device);
      })
      .catch((caught: unknown) => {
        if (caught instanceof UnauthorizedError) {
          window.location.assign(loginHref);
          return;
        }
        setError(caught instanceof Error ? caught.message : "기기를 바꾸지 못했습니다.");
      })
      .finally(() => {
        setBusy(false);
      });
  };

  const submit = () => {
    if (!action) {
      return;
    }
    const listed = fieldsOf(props.device.kind, action);
    const missing = listed.some((item) => item.required && data[item.key] === undefined);
    if (missing) {
      setError("값을 넣어 주세요.");
      return;
    }
    run(action, data);
  };

  const quick = QUICK.filter((item) => props.device.actions.includes(item));
  return (
    <dialog className={dialog} data-testid="device-dialog" ref={ref}>
      <div className={formStack}>
        <h2 className={dialogTitle}>{props.device.name}</h2>
        <p className={caption}>
          {DEVICE_KIND_LABELS[props.device.kind]} · {originLabel(props.device)}
        </p>
        {originOf(props.device) === "virtual" ? <p className={caption}>플로 시험용입니다.</p> : null}
        <p className={dialogNow}>{props.device.available ? stateLabel(props.device.state) : "불가"}</p>
        {props.device.available && props.device.reading ? (
          <p className={caption}>{props.device.reading}</p>
        ) : null}
        {!props.device.available ? <p className={caption}>지금은 쓸 수 없습니다.</p> : null}
        {props.device.available && quick.length > 0 ? (
          <div className={quickRow}>
            {quick.map((item) => (
              <button
                className={buttonRecipe({ intent: item === "turn_off" ? "default" : "primary" })}
                data-testid={`device-act-${item}`}
                disabled={busy}
                key={item}
                type="button"
                onClick={() => run(item)}
              >
                {actionLabel(item)}
              </button>
            ))}
          </div>
        ) : null}
        {props.device.available && props.device.actions.length > 0 ? (
          <div className={formStack}>
            <label className={field}>
              <span className={label}>동작</span>
              <select
                className={select}
                data-testid="device-act-action"
                value={action}
                onChange={(event) => {
                  setAction(event.target.value);
                  setData({});
                }}
              >
                {props.device.actions.map((item) => (
                  <option key={item} value={item}>
                    {actionLabel(item)}
                  </option>
                ))}
              </select>
            </label>
            <DeviceActionFields
              action={action}
              data={data}
              kind={props.device.kind}
              testIdPrefix="device-act"
              onData={setData}
            />
            <button
              className={buttonRecipe({ intent: "primary" })}
              data-testid="device-act-run"
              disabled={busy || !action}
              type="button"
              onClick={submit}
            >
              실행
            </button>
          </div>
        ) : null}
        {error ? <p className={errorText}>{error}</p> : null}
        <DeviceManage
          csrf={props.csrf}
          device={props.device}
          siteId={props.siteId}
          onDevice={props.onDevice}
          onGone={props.onGone}
        />
        <button
          className={buttonRecipe()}
          data-testid="device-dialog-close"
          type="button"
          onClick={() => ref.current?.close()}
        >
          닫기
        </button>
      </div>
    </dialog>
  );
};
