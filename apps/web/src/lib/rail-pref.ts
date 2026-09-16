/**
 * 좌측 레일 접힘. 브라우저에만 두고 서버 초안과 섞지 않는다.
 */
const KEY = "howling.railCollapsed";

export const readRailCollapsed = (): boolean => {
  try {
    return window.localStorage.getItem(KEY) !== "0";
  } catch {
    return true;
  }
};

export const writeRailCollapsed = (collapsed: boolean): void => {
  try {
    window.localStorage.setItem(KEY, collapsed ? "1" : "0");
  } catch {
    return;
  }
};
