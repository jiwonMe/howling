/**
 * 제품 화면 라우터.
 */
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { ConnectionsPage } from "./pages/connections-page.js";
import { EditorPage } from "./pages/editor-page.js";
import { FlowsPage } from "./pages/flows-page.js";
import { RunPage } from "./pages/run-page.js";
import { AnalyticsPage } from "./analytics/page.js";
import { StatusPage } from "./pages/status-page.js";
import { AppShell } from "./shell/app-shell.js";

export const App = () => (
  <BrowserRouter>
    <Routes>
      <Route element={<AppShell />}>
        <Route path="/" element={<StatusPage />} />
        <Route path="/connections" element={<ConnectionsPage />} />
        <Route path="/flows" element={<FlowsPage />} />
        <Route path="/flows/:flowId" element={<EditorPage />} />
        <Route path="/runs/:runId" element={<RunPage />} />
        <Route path="/analytics" element={<AnalyticsPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  </BrowserRouter>
);
