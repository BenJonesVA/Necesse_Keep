import React, { useEffect, useState } from "react";
import { Routes, Route, Navigate, NavLink } from "react-router-dom";
import { api } from "./api/client.js";
import LoginPage from "./pages/LoginPage.jsx";
import DashboardPage from "./pages/DashboardPage.jsx";
import ConfigPage from "./pages/ConfigPage.jsx";
import LogsPage from "./pages/LogsPage.jsx";
import SavesPage from "./pages/SavesPage.jsx";
import PlayersPage from "./pages/PlayersPage.jsx";

export default function App() {
  const [authState, setAuthState] = useState("checking"); // checking | in | out

  useEffect(() => {
    api
      .me()
      .then(() => setAuthState("in"))
      .catch(() => setAuthState("out"));
  }, []);

  if (authState === "checking") {
    return <div className="app-shell">Loading...</div>;
  }

  if (authState === "out") {
    return (
      <div className="app-shell">
        <LoginPage onLoggedIn={() => setAuthState("in")} />
      </div>
    );
  }

  return (
    <div className="app-shell">
      <nav className="main-nav">
        <NavLink to="/" end>
          Dashboard
        </NavLink>
        <NavLink to="/players">Players</NavLink>
        <NavLink to="/config">Config</NavLink>
        <NavLink to="/logs">Logs</NavLink>
        <NavLink to="/saves">Saves</NavLink>
        <span style={{ flex: 1 }} />
        <button
          onClick={() =>
            api
              .logout()
              .catch(() => {})
              .then(() => setAuthState("out"))
          }
        >
          Log out
        </button>
      </nav>
      <Routes>
        <Route path="/" element={<DashboardPage />} />
        <Route path="/players" element={<PlayersPage />} />
        <Route path="/config" element={<ConfigPage />} />
        <Route path="/logs" element={<LogsPage />} />
        <Route path="/saves" element={<SavesPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </div>
  );
}
