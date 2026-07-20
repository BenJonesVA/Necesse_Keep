import React, { useEffect, useState } from "react";
import { api } from "../api/client.js";
import ConfirmDialog from "../components/ConfirmDialog.jsx";

const FIELDS = [
  { key: "WORLD", label: "World name", type: "text" },
  { key: "SLOTS", label: "Slots", type: "number", min: 1, max: 250 },
  { key: "OWNER", label: "Owner (client name)", type: "text" },
  { key: "MOTD", label: "Message of the day", type: "text" },
  { key: "PASSWORD", label: "Server password (blank = none)", type: "password" },
  { key: "HOST_PORT", label: "Host port (UDP)", type: "number", min: 1, max: 65535 },
  { key: "PAUSE", label: "Pause when empty", type: "bool" },
  { key: "GIVE_CLIENTS_POWER", label: "Give clients power", type: "bool" },
  { key: "LOGGING", label: "Logging", type: "bool" },
  { key: "ZIP", label: "Compress saves", type: "bool" },
];

export default function ConfigPage() {
  const [values, setValues] = useState(null);
  const [error, setError] = useState(null);
  const [message, setMessage] = useState(null);
  const [confirmApply, setConfirmApply] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api.getConfig().then(setValues).catch((err) => setError(err.message));
  }, []);

  function setField(key, value) {
    setValues((v) => ({ ...v, [key]: value }));
  }

  async function handleSave(e) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      await api.stageConfig(values);
      setMessage("Saved. Click \"Apply\" to restart the server with these settings.");
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function handleApply() {
    setBusy(true);
    setError(null);
    try {
      await api.applyConfig();
      setMessage("Applied. The server is recreating with the new settings.");
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
      setConfirmApply(false);
    }
  }

  if (error && !values) return <p className="error">{error}</p>;
  if (!values) return <p>Loading config...</p>;

  return (
    <div>
      <h2>Server Config</h2>
      <p className="caveat">
        Changing any of these stages the value in .env only. Nothing takes effect until you click
        "Apply", which recreates the server container (disconnects players).
      </p>

      <form className="card" onSubmit={handleSave}>
        {FIELDS.map((f) => (
          <label key={f.key}>
            <span>{f.label}</span>
            {f.type === "bool" ? (
              <select
                value={values[f.key]}
                onChange={(e) => setField(f.key, e.target.value)}
              >
                <option value="1">On</option>
                <option value="0">Off</option>
              </select>
            ) : (
              <input
                type={f.type === "number" ? "number" : f.type === "password" ? "password" : "text"}
                min={f.min}
                max={f.max}
                value={values[f.key] ?? ""}
                onChange={(e) => setField(f.key, e.target.value)}
              />
            )}
          </label>
        ))}

        {error && <p className="error">{error}</p>}
        {message && <p>{message}</p>}

        <div style={{ display: "flex", gap: "0.5rem" }}>
          <button className="primary" type="submit" disabled={busy}>
            Save
          </button>
          <button type="button" disabled={busy} onClick={() => setConfirmApply(true)}>
            Apply (restart server)
          </button>
        </div>
      </form>

      <ConfirmDialog
        open={confirmApply}
        title="Apply config?"
        message="This restarts the Necesse server and disconnects all players."
        busy={busy}
        onCancel={() => setConfirmApply(false)}
        onConfirm={handleApply}
      />
    </div>
  );
}
