/**
 * 자동 실행 조건(trigger). 기본은 기기 선택, 고급은 HA entity 직접 입력.
 */
import { originOf, type DeviceSummary, type TriggerBinding } from "@howling/contracts";
import { field, input, label, select } from "../ui/form.css.js";
import { cardTitle } from "../ui/card.css.js";
import { muted, panelSection } from "../ui/editor.css.js";

export const TriggerFields = (props: {
  readonly devices: readonly DeviceSummary[];
  readonly trigger: TriggerBinding | undefined;
  readonly onTriggers: (triggers: readonly TriggerBinding[]) => void;
}) => {
  const advanced = props.trigger?.kind === "ha.state_changed";
  const deviceId =
    props.trigger?.kind === "device.changed" ? String(props.trigger.config.deviceId ?? "") : "";
  const triggerable = props.devices.filter(
    (item) =>
      (item.available || item.id === deviceId) &&
      ((item.kind === "number" && item.numeric) || item.kind === "binary"),
  );
  return (
    <section className={panelSection}>
      <h2 className={cardTitle}>자동 실행</h2>
      <p className={muted}>고른 기기 값이 바뀌면 플로가 실행됩니다. 비워 두면 수동·시험만 됩니다.</p>
      {advanced ? (
        <label className={field}>
          <span className={label}>HA entity</span>
          <input
            className={input}
            data-testid="trigger-entity"
            value={String(props.trigger?.config.entityId ?? "")}
            onChange={(event) =>
              props.onTriggers([
                {
                  id: "ha-power",
                  kind: "ha.state_changed",
                  connectionId: "ha",
                  config: { entityId: event.target.value, inputKey: "power" },
                },
              ])
            }
          />
        </label>
      ) : (
        <label className={field}>
          <span className={label}>지켜볼 기기</span>
          <select
            className={select}
            data-testid="trigger-device"
            value={deviceId}
            onChange={(event) => {
              const nextId = event.target.value;
              const picked = triggerable.find((item) => item.id === nextId);
              props.onTriggers([
                {
                  id: "device-trigger",
                  kind: "device.changed",
                  connectionId: "ha",
                  config: {
                    deviceId: nextId,
                    inputKey: picked?.kind === "binary" ? "value" : "power",
                  },
                },
              ]);
            }}
          >
            <option value="">선택</option>
            {triggerable.map((item) => (
              <option key={item.id} value={item.id}>
                {originOf(item) === "virtual" ? `${item.name} · 가상` : item.name}
              </option>
            ))}
          </select>
        </label>
      )}
      <label className={field} style={{ flexDirection: "row", alignItems: "center", gap: "8px" }}>
        <input
          checked={advanced}
          type="checkbox"
          onChange={(event) => {
            if (event.target.checked) {
              props.onTriggers([
                {
                  id: "ha-power",
                  kind: "ha.state_changed",
                  connectionId: "ha",
                  config: { entityId: "", inputKey: "power" },
                },
              ]);
              return;
            }
            props.onTriggers([
              {
                id: "device-trigger",
                kind: "device.changed",
                connectionId: "ha",
                config: { deviceId: "", inputKey: "power" },
              },
            ]);
          }}
        />
        <span className={label}>고급: HA entity</span>
      </label>
    </section>
  );
};
