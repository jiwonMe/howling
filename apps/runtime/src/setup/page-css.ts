/**
 * setup 페이지 전용 기하. vbg 토큰만 읽고 공개 클래스는 손대지 않는다.
 */
export const setupPageCss = `
.vbg-custom-ko {
  font-family: "Geist", "Noto Sans KR", var(--vbg-font-sans);
}

.vbg-custom-wordmark {
  font-family: "Geist", "Noto Sans KR", var(--vbg-font-sans);
  font-size: var(--vbg-type-compact);
  font-weight: var(--vbg-weight-heading);
  letter-spacing: 0;
  line-height: var(--vbg-leading-compact);
}

.vbg-custom-lede {
  font-size: var(--vbg-type-lede);
  font-weight: var(--vbg-weight-regular);
  line-height: var(--vbg-leading-lede);
  letter-spacing: 0;
  word-break: keep-all;
  max-width: 40rem;
  margin: 0;
}

.vbg-custom-title {
  font-size: var(--vbg-type-page-title);
  font-weight: var(--vbg-weight-heading);
  line-height: var(--vbg-leading-page-title);
  letter-spacing: 0;
  word-break: keep-all;
  margin: 0;
}

.vbg-custom-heading {
  font-size: var(--vbg-type-section);
  font-weight: var(--vbg-weight-heading);
  line-height: var(--vbg-leading-section);
  letter-spacing: 0;
  word-break: keep-all;
  margin: 0;
}

.vbg-custom-heading-sm {
  font-size: var(--vbg-type-subsection);
  font-weight: var(--vbg-weight-heading);
  line-height: var(--vbg-leading-subsection);
  letter-spacing: 0;
  word-break: keep-all;
  margin: 0;
}

.vbg-custom-value {
  font-size: var(--vbg-type-title);
  font-weight: var(--vbg-weight-heading);
  line-height: var(--vbg-leading-title);
  letter-spacing: 0;
  word-break: keep-all;
  margin: 0;
}

.vbg-custom-code {
  font-size: var(--vbg-type-page-title);
  font-weight: var(--vbg-weight-heading);
  letter-spacing: 0.06em;
  line-height: var(--vbg-leading-page-title);
  margin: 0;
}

.vbg-custom-audit {
  margin: 0;
}

.vbg-custom-audit pre {
  margin: 0;
  overflow: auto;
}
`;
