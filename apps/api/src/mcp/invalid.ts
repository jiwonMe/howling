/**
 * 잘못된 tool 인자를 필드 단위로 알려준다. 원문 값은 넣지 않고 경로·이유만 넣는다.
 */
import type { ServiceResult } from "../flows/access.js";

/** zod ZodError와 구조가 같다. api가 zod에 직접 의존하지 않도록 형태만 받는다. */
type ZodError = {
  readonly issues: readonly {
    readonly path: readonly (string | number)[];
    readonly message: string;
    readonly code: string;
  }[];
};

export type FieldIssue = {
  readonly path: string;
  readonly message: string;
  readonly code: string;
};

export const issuesOf = (error: ZodError): FieldIssue[] =>
  error.issues.map((issue) => ({
    path: issue.path.length > 0 ? `/${issue.path.map(String).join("/")}` : "",
    message: issue.message,
    code: issue.code,
  }));

const summarize = (issues: readonly FieldIssue[]): string =>
  issues
    .slice(0, 5)
    .map((issue) => (issue.path === "" ? issue.message : `${issue.path}: ${issue.message}`))
    .join("; ");

export const invalid = (what: string, error?: ZodError): ServiceResult => {
  const issues = error ? issuesOf(error) : [];
  const detail = issues.length > 0 ? ` (${summarize(issues)})` : "";
  return {
    ok: false,
    status: 400,
    body: {
      error: {
        code: "invalid_request",
        message: `${what}${detail}`,
        ...(issues.length > 0 ? { issues } : {}),
      },
    },
  };
};
