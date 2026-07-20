import React, { useCallback, useEffect, useState } from "react";
import { api } from "../api/client.js";
import StatCard from "../components/StatCard.jsx";
import ConfirmDialog from "../components/ConfirmDialog.jsx";

function formatUptime(startedAt) {
  if (!startedAt) return "-";
  const started = new Date(startedAt).getTime();
  const seconds = Math.max(0, Math.floor((Date.now() - started) / 1000));
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return `${h}h ${m}m ${s}s`;
}

function formatBytes(bytes) {
  if (!bytes) return "0 MB";
  return `${(bytes / (1024 * 1024)).toFixed(0)} MB`;
}

export default function DashboardPage() {
  const [status, setStatus] = useState(null);
  const [error, setError] = useState(null);
  const [confirm, setConfirm] = useState(null); // 'stop' | 'restart' | null
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(() => {
    api
      .status()
      .then(setStatus)
      .catch((err) => setError(err.message));
  }, []);

  useEffect(() => {
    refresh();
    const id = setInterval(refresh, 5000);
    return () => clearInterval(id);
  }, [refresh]);

  async function doAction(action) {
    setBusy(true);
    try {
      await action();
      refresh();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
      setConfirm(null);
    }
  }

  if (error) return <p className="error">{error}</p>;
  if (!status) return <p>Loading status...</p>;

  return (
    <div>
      <h2>
        Server{" "}
        <span className={`badge ${status.running ? "running" : "stopped"}`}>
          {status.running ? "running" : "stopped"}
        </span>
      </h2>

      <div style={{ display: "flex", gap: "1rem", marginBottom: "1rem" }}>
        <StatCard label="Uptime" value={status.running ? formatUptime(status.startedAt) : "-"} />
        <StatCard label="CPU" value={status.running ? `${status.cpuPercent.toFixed(1)}%` : "-"} />
        <StatCard
          label="Memory"
          value={status.running ? `${formatBytes(status.memUsageBytes)} / ${formatBytes(status.memLimitBytes)}` : "-"}
        />
      </div>

      <div className="card" style={{ display: "flex", gap: "0.5rem" }}>
        {!status.running && (
          <button className="primary" disabled={busy} onClick={() => doAction(api.start)}>
            Start
          </button>
        )}
        {status.running && (
          <>
            <button className="danger" disabled={busy} onClick={() => setConfirm("stop")}>
              Stop
            </button>
            <button disabled={busy} onClick={() => setConfirm("restart")}>
              Restart
            </button>
          </>
        )}
      </div>

      <ConfirmDialog
        open={!!confirm}
        title={confirm === "stop" ? "Stop server?" : "Restart server?"}
        message="This will disconnect all connected players."
        busy={busy}
        onCancel={() => setConfirm(null)}
        onConfirm={() => doAction(confirm === "stop" ? api.stop : api.restart)}
      />
    </div>
  );
}
