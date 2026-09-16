/**
 * 제자리 이름 변경. Enter 저장, Escape 취소. 빈 이름은 저장하지 않는다.
 */
import { useCallback, useState, type FormEvent, type ReactNode } from "react";
import { loginHref, UnauthorizedError } from "../lib/api.js";
import { buttonRecipe } from "./button.css.js";
import { errorText } from "./form.css.js";
import { iconMark } from "./icon.css.js";
import { PenOutline18 } from "./icons/index.js";
import * as css from "./inline-rename.css.js";

export const InlineRename = (props: {
  readonly value: string;
  readonly display: ReactNode;
  readonly testId: string;
  readonly size: "title" | "row";
  readonly onSave: (name: string) => Promise<void>;
}) => {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(props.value);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  /** 입력 칸이 붙는 순간 한 번만 포커스와 전체 선택. */
  const focusAll = useCallback((node: HTMLInputElement | null) => {
    node?.focus();
    node?.select();
  }, []);

  const open = () => {
    setDraft(props.value);
    setError(undefined);
    setEditing(true);
  };
  const close = () => {
    setEditing(false);
    setError(undefined);
  };
  const submit = (event: FormEvent) => {
    event.preventDefault();
    const trimmed = draft.trim();
    if (busy) {
      return;
    }
    if (trimmed === "") {
      setError("이름을 비울 수 없습니다.");
      return;
    }
    if (trimmed === props.value) {
      close();
      return;
    }
    setBusy(true);
    setError(undefined);
    void props
      .onSave(trimmed)
      .then(close)
      .catch((caught: unknown) => {
        if (caught instanceof UnauthorizedError) {
          window.location.assign(loginHref);
          return;
        }
        setError(caught instanceof Error ? caught.message : "이름을 바꾸지 못했습니다.");
      })
      .finally(() => setBusy(false));
  };

  if (!editing) {
    return (
      <span className={css.row}>
        {props.display}
        <button
          aria-label="이름 변경"
          className={css.penButton}
          data-testid={`${props.testId}-edit`}
          title="이름 변경"
          type="button"
          onClick={open}
        >
          <PenOutline18 aria-hidden className={iconMark} />
        </button>
      </span>
    );
  }

  return (
    <form className={css.form} data-testid={`${props.testId}-form`} onSubmit={submit}>
      <div className={css.controls}>
        <input
          aria-label="플로 이름"
          className={css.input[props.size]}
          data-testid={`${props.testId}-input`}
          disabled={busy}
          maxLength={80}
          ref={focusAll}
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Escape") {
              event.preventDefault();
              close();
            }
          }}
        />
        <button
          className={`${buttonRecipe({ intent: "primary" })} ${css.compactButton}`}
          data-testid={`${props.testId}-save`}
          disabled={busy}
          type="submit"
        >
          저장
        </button>
        <button
          className={`${buttonRecipe()} ${css.compactButton}`}
          data-testid={`${props.testId}-cancel`}
          disabled={busy}
          type="button"
          onClick={close}
        >
          취소
        </button>
      </div>
      {error ? <p className={errorText}>{error}</p> : null}
    </form>
  );
};
