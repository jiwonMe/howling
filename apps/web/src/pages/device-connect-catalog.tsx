/**
 * 연결할 집 기기를 고른다. 허브 내부 이름은 보이지 않는다.
 */
import { DEVICE_INTEGRATIONS, VIRTUAL_DEVICE } from "@howling/contracts";
import { choice, choiceHint, choiceList, choiceName } from "./device-connect.css.js";
import { field, input, label } from "../ui/form.css.js";
import { caption, sectionTitle } from "../ui/layout.css.js";

export const DeviceConnectCatalog = (props: {
  readonly query: string;
  readonly ready: boolean;
  readonly busy: boolean;
  readonly discovered: readonly { key: string; name: string }[];
  readonly onQuery: (value: string) => void;
  readonly onDiscover: (token: string) => void;
  readonly onPick: (id: (typeof DEVICE_INTEGRATIONS)[number]["id"]) => void;
  readonly onVirtual: () => void;
}) => {
  const query = props.query.trim().toLowerCase();
  const virtualHay = `${VIRTUAL_DEVICE.name} ${VIRTUAL_DEVICE.hint}`.toLowerCase();
  const showVirtual = query === "" || virtualHay.includes(query);
  const listed = DEVICE_INTEGRATIONS.filter((item) => {
    const hay = `${item.name} ${item.hint}`.toLowerCase();
    return hay.includes(query);
  }).slice()
    .sort((left, right) => left.name.localeCompare(right.name, "ko"));

  return (
    <>
      {props.discovered.length > 0 ? (
        <div>
          <h3 className={sectionTitle}>찾은 기기</h3>
          <div className={choiceList}>
            {props.discovered.map((item) => (
              <button
                className={choice}
                disabled={props.busy || !props.ready}
                key={item.key}
                type="button"
                onClick={() => props.onDiscover(item.key)}
              >
                <span className={choiceName}>{item.name}</span>
                <span className={choiceHint}>같은 네트워크에서 찾았습니다</span>
              </button>
            ))}
          </div>
        </div>
      ) : null}
      <label className={field}>
        <span className={label}>검색</span>
        <input
          className={input}
          data-testid="device-connect-query"
          name="query"
          placeholder="Hue, Shelly, IKEA…"
          value={props.query}
          onChange={(event) => props.onQuery(event.target.value)}
        />
      </label>
      <div className={choiceList} data-testid="device-connect-catalog">
        {showVirtual ? (
          <button
            className={choice}
            data-testid="device-connect-virtual"
            disabled={props.busy || !props.ready}
            type="button"
            onClick={props.onVirtual}
          >
            <span className={choiceName}>{VIRTUAL_DEVICE.name}</span>
            <span className={choiceHint}>{VIRTUAL_DEVICE.hint}</span>
          </button>
        ) : null}
        {listed.map((item) => (
          <button
            className={choice}
            data-testid={`device-connect-${item.id}`}
            disabled={props.busy || !props.ready}
            key={item.id}
            type="button"
            onClick={() => props.onPick(item.id)}
          >
            <span className={choiceName}>{item.name}</span>
            <span className={choiceHint}>{item.hint}</span>
          </button>
        ))}
      </div>
      {listed.length === 0 && !showVirtual ? <p className={caption}>검색과 맞는 기기가 없습니다.</p> : null}
    </>
  );
};
