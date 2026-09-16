/**
 * 좌측 레일. 본문은 Outlet. 편집기는 패딩을 줄인다.
 */
import { useEffect, useState } from "react";
import { NavLink, Outlet, useLocation } from "react-router-dom";
import { loginHref, logout, UnauthorizedError } from "../lib/api.js";
import { readRailCollapsed, writeRailCollapsed } from "../lib/rail-pref.js";
import { loadStatus, type StatusSnapshot } from "../lib/status.js";
import { buttonRecipe } from "../ui/button.css.js";
import { iconMark } from "../ui/icon.css.js";
import {
  ChartLineOutline18,
  GaugeOutline18,
  HistoryOutline18,
  HouseDashboard2Outline18,
  LightSwitchOutline18,
  NodesOutline18,
  Plug2Outline18,
  RectLogoutOutline18,
  SidebarLeftHideOutline18,
  SidebarLeftShowOutline18,
} from "../ui/icons/index.js";
import { railHead, railIconLink, railLabel, railLogout, railToggle } from "../ui/rail-collapse.css.js";
import {
  brand,
  main,
  nav,
  navLink,
  rail,
  railFoot,
  railId,
  railMeta,
  shell,
  skipLink,
  stage,
} from "../ui/shell.css.js";
import { RailStatus } from "./rail-status.js";

export const AppShell = () => {
  const location = useLocation();
  const [session, setSession] = useState<StatusSnapshot>();
  const [collapsed, setCollapsed] = useState(readRailCollapsed);
  const editor = /^\/flows\/[^/]+$/.test(location.pathname);
  const toggleRail = () => {
    const next = !collapsed;
    setCollapsed(next);
    writeRailCollapsed(next);
  };
  const itemClass = (active: boolean) => `${navLink({ active })} ${railIconLink}`;

  useEffect(() => {
    let cancelled = false;
    const refresh = async () => {
      try {
        const next = await loadStatus();
        if (!cancelled) {
          setSession(next);
        }
      } catch (caught: unknown) {
        if (caught instanceof UnauthorizedError) {
          window.location.assign(loginHref);
        }
      }
    };
    void refresh();
    const timer = window.setInterval(() => {
      void refresh();
    }, 5000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, []);

  return (
    <div className={shell}>
      <a className={skipLink} href="#main">
        본문으로
      </a>
      <aside className={rail({ collapsed })} data-collapsed={collapsed ? "true" : "false"}>
        <div className={railHead}>
          <NavLink className={brand} title="Howling" to="/">
            <HouseDashboard2Outline18 aria-hidden className={iconMark} />
            <span className={railLabel}>Howling</span>
          </NavLink>
          <button
            aria-controls="app-rail-nav"
            aria-expanded={!collapsed}
            aria-label={collapsed ? "사이드바 펼치기" : "사이드바 접기"}
            className={railToggle}
            data-testid="toggle-rail"
            title={collapsed ? "사이드바 펼치기" : "사이드바 접기"}
            type="button"
            onClick={toggleRail}
          >
            {collapsed ? (
              <SidebarLeftShowOutline18 aria-hidden className={iconMark} />
            ) : (
              <SidebarLeftHideOutline18 aria-hidden className={iconMark} />
            )}
          </button>
        </div>
        <nav className={nav} id="app-rail-nav">
          <NavLink className={({ isActive }) => itemClass(isActive)} end title="상태" to="/">
            <GaugeOutline18 aria-hidden className={iconMark} />
            <span className={railLabel}>상태</span>
          </NavLink>
          <NavLink className={({ isActive }) => itemClass(isActive)} title="연결" to="/connections">
            <Plug2Outline18 aria-hidden className={iconMark} />
            <span className={railLabel}>연결</span>
          </NavLink>
          <NavLink className={({ isActive }) => itemClass(isActive)} title="기기" to="/devices">
            <LightSwitchOutline18 aria-hidden className={iconMark} />
            <span className={railLabel}>기기</span>
          </NavLink>
          <NavLink className={({ isActive }) => itemClass(isActive)} title="플로" to="/flows">
            <NodesOutline18 aria-hidden className={iconMark} />
            <span className={railLabel}>플로</span>
          </NavLink>
          <NavLink className={({ isActive }) => itemClass(isActive)} title="로그" to="/logs">
            <HistoryOutline18 aria-hidden className={iconMark} />
            <span className={railLabel}>로그</span>
          </NavLink>
          <NavLink className={({ isActive }) => itemClass(isActive)} title="관측" to="/analytics">
            <ChartLineOutline18 aria-hidden className={iconMark} />
            <span className={railLabel}>관측</span>
          </NavLink>
        </nav>
        {session ? (
          <div className={railFoot}>
            <RailStatus data={session} />
            <div className={railMeta}>
              <span className={railLabel}>{session.user.email ?? session.user.id}</span>
              <span className={`${railId} ${railLabel}`}>{session.site.name}</span>
              <button
                className={`${buttonRecipe()} ${railLogout}`}
                type="button"
                onClick={() => {
                  void logout(session.user.csrfToken).then(() => {
                    window.location.assign(loginHref);
                  });
                }}
              >
                <RectLogoutOutline18 aria-hidden className={iconMark} />
                <span className={railLabel}>로그아웃</span>
              </button>
            </div>
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
