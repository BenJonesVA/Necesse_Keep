import React, { useEffect, useState } from "react";
import { api } from "../api/client.js";

function formatBytes(bytes) {
  if (!bytes) return "0 B";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function SavesPage() {
  const [saves, setSaves] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    api.saves().then(setSaves).catch((err) => setError(err.message));
  }, []);

  if (error) return <p className="error">{error}</p>;
  if (!saves) return <p>Loading saves...</p>;

  return (
    <div>
      <h2>World Saves</h2>
      {saves.length === 0 && <p>No saves found yet.</p>}
      {saves.map((s) => (
        <div className="card" key={s.name}>
          <strong>{s.name}</strong>
          <div style={{ color: "#aab", fontSize: "0.85rem" }}>
            {formatBytes(s.size)} - {new Date(s.mtime).toLocaleString()}
          </div>
          {s.worldSettings ? (
            <pre style={{ whiteSpace: "pre-wrap", fontSize: "0.8rem", marginTop: "0.5rem" }}>
              {s.worldSettings}
            </pre>
          ) : (
            <p className="caveat">No readable worldSettings.cfg (empty or not-yet-saved world).</p>
          )}
        </div>
      ))}
    </div>
  );
}
