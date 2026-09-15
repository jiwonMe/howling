/**
 * Scoped token 발급·폐기. 원문은 한 번만 보여 준다.
 */
import { useState } from "react";
import { issueToken, listTokens, revokeToken, type TokenRow } from "../lib/flows-api.js";
import { buttonRecipe } from "../ui/button.css.js";
import { errorText, field, formStack, input, label } from "../ui/form.css.js";
import { caption, sectionTitle } from "../ui/layout.css.js";

export const TokensPanel = (props: {
  readonly siteId: string;
  readonly csrf: string;
}) => {
  const [tokens, setTokens] = useState<readonly TokenRow[]>([]);
  const [name, setName] = useState("reader");
  const [scopes, setScopes] = useState("read");
  const [once, setOnce] = useState<string>();
  const [message, setMessage] = useState<string>();

  const refresh = () =>
    listTokens(props.siteId)
      .then((body) => setTokens(body.tokens))
      .catch((caught: unknown) => setMessage(caught instanceof Error ? caught.message : "실패"));

  return (
    <section className={formStack}>
      <h2 className={sectionTitle}>API token</h2>
      <p className={caption}>원문 토큰은 발급 직후 한 번만 보입니다. Cloud DB에는 hash만 있습니다.</p>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          void issueToken(props.siteId, props.csrf, {
            name,
            scopes: scopes.split(/[\s,]+/).filter(Boolean),
          })
            .then((issued) => {
              setOnce(issued.token);
              return refresh();
            })
            .catch((caught: unknown) =>
              setMessage(caught instanceof Error ? caught.message : "실패"),
            );
        }}
      >
        <div className={field}>
          <label className={label} htmlFor="token-name">
            이름
          </label>
          <input
            id="token-name"
            className={input}
            data-testid="token-name"
            value={name}
            onChange={(event) => setName(event.target.value)}
          />
        </div>
        <div className={field}>
          <label className={label} htmlFor="token-scopes">
            scopes
          </label>
          <input
            id="token-scopes"
            className={input}
            data-testid="token-scopes"
            value={scopes}
            onChange={(event) => setScopes(event.target.value)}
          />
        </div>
        <button className={buttonRecipe({ intent: "primary" })} data-testid="issue-token" type="submit">
          발급
        </button>
      </form>
      {once ? (
        <p className={caption} data-testid="issued-token">
          {once}
        </p>
      ) : null}
      <button className={buttonRecipe()} type="button" onClick={() => void refresh()}>
        목록
      </button>
      <ul>
        {tokens.map((item) => (
          <li key={item.id}>
            {item.name} · {item.scopes.join(",")}
            {item.revokedAt ? " · revoked" : ""}
            {item.revokedAt ? null : (
              <button
                className={buttonRecipe()}
                type="button"
                onClick={() => {
                  void revokeToken(props.siteId, props.csrf, item.id).then(() => refresh());
                }}
              >
                폐기
              </button>
            )}
          </li>
        ))}
      </ul>
      {message ? <p className={errorText}>{message}</p> : null}
    </section>
  );
};
