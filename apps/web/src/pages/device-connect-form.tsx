/**
 * 집 기기를 Howling에 연결한다. entity_id는 보여주지 않는다.
 */
import type { DeviceIntegrateField, DeviceIntegrationId, DeviceSummary } from "@howling/contracts";
import { useEffect, useState, type FormEvent } from "react";
import { loginHref, UnauthorizedError } from "../lib/api.js";
import { integrateDevice } from "../lib/devices-api.js";
import { buttonRecipe } from "../ui/button.css.js";
import { errorText, field, formStack, input, label, select } from "../ui/form.css.js";
import { caption, section, sectionTitle } from "../ui/layout.css.js";
import { DeviceConnectCatalog } from "./device-connect-catalog.js";
import { DeviceCreateForm } from "./device-create-form.js";

export const DeviceConnectForm = (props: {
  readonly siteId: string;
  readonly csrf: string;
  readonly ready: boolean;
  readonly onDevices: (devices: readonly DeviceSummary[]) => void;
}) => {
  const [query, setQuery] = useState("");
  const [discovered, setDiscovered] = useState<readonly { key: string; name: string }[]>([]);
  const [token, setToken] = useState<string>();
  const [title, setTitle] = useState<string>();
  const [description, setDescription] = useState<string>();
  const [submitLabel, setSubmitLabel] = useState("연결");
  const [fields, setFields] = useState<readonly DeviceIntegrateField[]>([]);
  const [values, setValues] = useState<Record<string, string>>({});
  const [virtual, setVirtual] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();

  useEffect(() => {
    if (!props.ready) {
      return;
    }
    void integrateDevice(props.siteId, props.csrf, { list: true })
      .then((result) => {
        setDiscovered(result.options ?? []);
      })
      .catch(() => {
        setDiscovered([]);
      });
  }, [props.csrf, props.ready, props.siteId]);

  useEffect(() => {
    const next: Record<string, string> = {};
    for (const item of fields) {
      next[item.key] = item.type === "select" ? (item.options?.[0]?.key ?? "") : "";
    }
    setValues(next);
  }, [fields]);

  const apply = (body: Parameters<typeof integrateDevice>[2]) => {
    if (busy || !props.ready) {
      return;
    }
    setBusy(true);
    setError(undefined);
    void integrateDevice(props.siteId, props.csrf, body)
      .then((result) => {
        setToken(result.token);
        setTitle(result.title);
        setDescription(result.description);
        setSubmitLabel(result.submitLabel ?? "연결");
        setFields(result.fields ?? []);
        setDiscovered((current) => (result.status === "pick" ? (result.options ?? []) : current));
        if (result.status === "done") {
          reset();
          props.onDevices(result.devices ?? []);
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
        setError(caught instanceof Error ? caught.message : "기기를 연결하지 못했습니다.");
      })
      .finally(() => {
        setBusy(false);
      });
  };

  const reset = () => {
    setVirtual(false);
    setToken(undefined);
    setTitle(undefined);
    setDescription(undefined);
    setSubmitLabel("연결");
    setFields([]);
    setValues({});
  };

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!token) {
      return;
    }
    apply({ token, values });
  };

  const pick = (integration: DeviceIntegrationId) => {
    apply({ integration });
  };

  return (
    <section className={section}>
      <h2 className={sectionTitle}>기기 연결</h2>
      {virtual ? (
        <div data-testid="device-connect">
          <DeviceCreateForm
            csrf={props.csrf}
            ready={props.ready}
            siteId={props.siteId}
            onBack={() => {
              reset();
              setError(undefined);
            }}
            onCreated={(device) => {
              reset();
              props.onDevices([device]);
            }}
          />
        </div>
      ) : token ? (
        <form className={formStack} data-testid="device-connect" onSubmit={submit}>
          {title ? <p className={caption}>{title}</p> : null}
          {description ? <p className={caption}>{description}</p> : null}
          {fields.map((item) => (
            <ConnectField
              field={item}
              key={item.key}
              value={values[item.key] ?? ""}
              onChange={(value) => setValues((current) => ({ ...current, [item.key]: value }))}
            />
          ))}
          <button
            className={buttonRecipe({ intent: "primary" })}
            data-testid="device-connect-next"
            disabled={busy || !props.ready}
            type="submit"
          >
            {submitLabel}
          </button>
          <button
            className={buttonRecipe()}
            data-testid="device-connect-back"
            disabled={busy}
            type="button"
            onClick={() => {
              reset();
              setError(undefined);
            }}
          >
            처음으로
          </button>
          {error ? <p className={errorText}>{error}</p> : null}
        </form>
      ) : (
        <div className={formStack} data-testid="device-connect">
          <DeviceConnectCatalog
            busy={busy}
            discovered={discovered}
            query={query}
            ready={props.ready}
            onDiscover={(next) => apply({ token: next })}
            onPick={pick}
            onQuery={setQuery}
            onVirtual={() => {
              setVirtual(true);
              setError(undefined);
            }}
          />
          {props.ready ? (
            <p className={caption}>전구·플러그는 먼저 제조사 앱에 등록되어 있어야 할 수 있습니다.</p>
          ) : (
            <p className={caption}>허브가 준비되면 기기를 연결할 수 있습니다.</p>
          )}
          {error ? <p className={errorText}>{error}</p> : null}
        </div>
      )}
    </section>
  );
};

const ConnectField = (props: {
  readonly field: DeviceIntegrateField;
  readonly value: string;
  readonly onChange: (value: string) => void;
}) => {
  if (props.field.type === "select") {
    return (
      <label className={field}>
        <span className={label}>{props.field.label}</span>
        <select
          className={select}
          data-testid={`device-connect-field-${props.field.key}`}
          required={props.field.required}
          value={props.value}
          onChange={(event) => props.onChange(event.target.value)}
        >
          {(props.field.options ?? []).map((item) => (
            <option key={item.key} value={item.key}>
              {item.name}
            </option>
          ))}
        </select>
      </label>
    );
  }
  return (
    <label className={field}>
      <span className={label}>{props.field.label}</span>
      <input
        className={input}
        data-testid={`device-connect-field-${props.field.key}`}
        name={props.field.key}
        placeholder={props.field.placeholder}
        required={props.field.required}
        type={props.field.type === "password" ? "password" : "text"}
        value={props.value}
        onChange={(event) => props.onChange(event.target.value)}
      />
    </label>
  );
};
