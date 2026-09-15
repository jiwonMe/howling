/**
 * 원본 ON/보관. OFF가 삭제를 끝냈다고 말하지 않는다.
 */
import type { SiteDataPolicy } from "@howling/contracts";
import { useEffect, useState } from "react";
import { getDataPolicy, purgeCloudRaw, putDataPolicy } from "../lib/data-api.js";
import { buttonRecipe } from "../ui/button.css.js";
import { caption, section, sectionTitle } from "../ui/layout.css.js";
import { field, formStack, input, label } from "../ui/form.css.js";

export const DataPolicyPanel = (props: { readonly siteId: string; readonly csrf: string }) => {
  const [policy, setPolicy] = useState<SiteDataPolicy>();
  const [lastSyncAt, setLastSyncAt] = useState<string | null>(null);
  const [message, setMessage] = useState<string>();

  useEffect(() => {
    void getDataPolicy(props.siteId).then((result) => {
      setPolicy(result.policy);
      setLastSyncAt(result.lastSyncAt);
    });
  }, [props.siteId]);

  if (!policy) {
    return null;
  }

  return (
    <section className={section}>
      <h2 className={sectionTitle}>데이터 전송·보관</h2>
      <p className={caption} data-testid="last-sync">
        마지막 동기화 {lastSyncAt ?? "없음"}
      </p>
      <form
        className={formStack}
        onSubmit={(event) => {
          event.preventDefault();
          void putDataPolicy(props.siteId, props.csrf, policy).then((result) => {
            setPolicy(result.policy);
            setMessage(
              result.policy.defaultCaptureRaw
                ? "이후 생성되는 원본만 올라갑니다."
                : "전송을 껐습니다. 이미 저장된 원본은 그대로입니다.",
            );
          });
        }}
      >
        <label className={label}>
          <input
            checked={policy.defaultCaptureRaw}
            data-testid="capture-raw"
            type="checkbox"
            onChange={(event) =>
              setPolicy({ ...policy, defaultCaptureRaw: event.target.checked })
            }
          />{" "}
          원본 전송 ON
        </label>
        <div className={field}>
          <label className={label} htmlFor="retain-local">
            로컬 원본 일수
          </label>
          <input
            id="retain-local"
            className={input}
            type="number"
            value={policy.localRetentionDays}
            onChange={(event) =>
              setPolicy({ ...policy, localRetentionDays: Number(event.target.value) })
            }
          />
        </div>
        <div className={field}>
          <label className={label} htmlFor="retain-cloud">
            클라우드 원본 일수
          </label>
          <input
            id="retain-cloud"
            className={input}
            type="number"
            value={policy.cloudRawDays}
            onChange={(event) =>
              setPolicy({ ...policy, cloudRawDays: Number(event.target.value) })
            }
          />
        </div>
        <button className={buttonRecipe({ intent: "primary" })} data-testid="save-policy" type="submit">
          정책 저장
        </button>
      </form>
      <button
        className={buttonRecipe()}
        data-testid="purge-raw"
        type="button"
        onClick={() => {
          void purgeCloudRaw(props.siteId, props.csrf).then((result) => {
            setMessage(`삭제 작업을 요청했습니다. ${String(result.removed)}건.`);
          });
        }}
      >
        저장된 클라우드 원본 삭제
      </button>
      {message ? <p className={caption}>{message}</p> : null}
    </section>
  );
};
