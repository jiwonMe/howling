/**
 * 좌측 레일. 본문은 Outlet. 편집기는 패딩을 줄인다.
 */
import { useEffect, useState } from "react";
import { NavLink, Outlet, useLocation } from "react-router-dom";
import { loginHref, logout, UnauthorizedError } from "../lib/api.js";
import { loadStatus, type StatusSnapshot } from "../lib/status.js";
import { buttonRecipe } from "../ui/button.css.js";
import { iconMark } from "../ui/icon.css.js";
import {
  GaugeOutline18,
  HouseDashboard2Outline18,
  NodesOutline18,
  Plug2Outline18,
  RectLogoutOutline18,
} from "../ui/icons/index.js";
import {
  brand,
  main,
  nav,
  navLink,
  rail,
  railId,
  railMeta,
  shell,
  skipLink,
  stage,
} from "../ui/shell.css.js";

export const AppShell = () => {
  const location = useLocation();
  const [session, setSession] = useState<StatusSnapshot>();
  const editor = /^\/flows\/[^/]+$/.test(location.pathname);

  useEffect(() => {
    void loadStatus()
      .then(setSession)
      .catch((caught: unknown) => {
        if (caught instanceof UnauthorizedError) {
          window.location.assign(loginHref);
        }
      });
  }, []);

  return (
    <div className={shell}>
      <a className={skipLink} href="#main">
        본문으로
      </a>
      <aside className={rail}>
        <NavLink className={brand} to="/">
          <HouseDashboard2Outline18 aria-hidden className={iconMark} />
          Howling
        </NavLink>
        <nav className={nav}>
          <NavLink className={({ isActive }) => navLink({ active: isActive })} end to="/">
            <GaugeOutline18 aria-hidden className={iconMark} />
            상태
          </NavLink>
          <NavLink className={({ isActive }) => navLink({ active: isActive })} to="/connections">
            <Plug2Outline18 aria-hidden className={iconMark} />
            연결
          </NavLink>
          <NavLink className={({ isActive }) => navLink({ active: isActive })} to="/flows">
            <NodesOutline18 aria-hidden className={iconMark} />
            플로
          </NavLink>
        </nav>
        {session ? (
          <div className={railMeta}>
            <span>{session.user.email ?? session.user.id}</span>
            <span className={railId}>{session.site.name}</span>
            <button
              className={buttonRecipe()}
              type="button"
              onClick={() => {
                void logout(session.user.csrfToken).then(() => {
                  window.location.assign(loginHref);
                });
              }}
            >
              <RectLogoutOutline18 aria-hidden className={iconMark} />
              로그아웃
            </button>
          </div>
        ) : null}
      </aside>
      <div className={stage({ density: editor ? "editor" : "page" })}>
        <main className={main} id="main">
          <Outlet />
        </main>
      </div>
    </div>
  );
};
