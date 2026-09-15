/**
 * MCP OAuth 제공자 목록. 동의는 로컬 runtime setup에서 끝낸다.
 */
import { MCP_OAUTH_PRESETS } from "@howling/contracts";
import { useState } from "react";
import { caption, section, sectionTitle } from "../ui/layout.css.js";
import { field, formStack, input, label, select } from "../ui/form.css.js";

export const OauthPanel = () => {
  const [presetId, setPresetId] = useState<string>("custom");
  const preset = MCP_OAUTH_PRESETS.find((item) => item.id === presetId) ?? MCP_OAUTH_PRESETS[0];
  return (
    <section className={section}>
      <h2 className={sectionTitle}>MCP OAuth 등록</h2>
      <p className={caption}>
        제공자를 고르고 로컬 <a href="http://127.0.0.1:4000/setup">runtime setup</a>에서 동의합니다.
        API는 authorization code를 저장하지 않습니다.
      </p>
      <div className={formStack}>
        <div className={field}>
          <label className={label} htmlFor="oauth-preset">
            제공자
          </label>
          <select
            id="oauth-preset"
            className={select}
            data-testid="oauth-preset"
            value={presetId}
            onChange={(event) => setPresetId(event.target.value)}
          >
            {MCP_OAUTH_PRESETS.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </select>
        </div>
        <div className={field}>
          <label className={label} htmlFor="oauth-authorize">
            Authorize URL
          </label>
          <input
            id="oauth-authorize"
            className={input}
            data-testid="oauth-authorize"
            readOnly
            value={"authorizeUrl" in preset ? preset.authorizeUrl : ""}
          />
        </div>
        <div className={field}>
          <label className={label} htmlFor="oauth-token">
            Token URL
          </label>
          <input
            id="oauth-token"
            className={input}
            data-testid="oauth-token"
            readOnly
            value={"tokenUrl" in preset ? preset.tokenUrl : ""}
          />
        </div>
      </div>
    </section>
  );
};
