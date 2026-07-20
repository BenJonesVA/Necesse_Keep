import React, { useEffect, useState } from "react";
import { api } from "../api/client.js";

export default function LogsPage() {
  const [files, setFiles] = useState([]);
  const [selected, setSelected] = useState("");
  const [events, setEvents] = useState(null);
  const [rawTail, setRawTail] = useState(null);
  const [showRaw, setShowRaw] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    api
      .logFiles()
      .then((list) => {
        setFiles(list);
        if (list.length) setSelected(list[0].name);
      })
      .catch((err) => setError(err.message));
  }, []);

  useEffect(() => {
    if (!selected) return;
    api.logEvents(selected).then(setEvents).catch((err) => setError(err.message));
    api.logTail(selected).then(setRawTail).catch((err) => setError(err.message));
  }, [selected]);

  return (
    <div>
      <h2>Logs</h2>
      {error && <p className="error">{error}</p>}

      <div className="card">
        <label>
          <span>Session log file</span>
          <select value={selected} onChange={(e) => setSelected(e.target.value)}>
            {files.map((f) => (
              <option key={f.name} value={f.name}>
                {f.name}
              </option>
            ))}
          </select>
        </label>
        <button onClick={() => setShowRaw((v) => !v)}>
          {showRaw ? "Show parsed events" : "Show raw tail"}
        </button>
      </div>

      {!showRaw && events && (
        <div className="card">
          <p className="caveat">{events.caveat}</p>
          <table>
            <thead>
              <tr>
                <th>Time</th>
                <th>Type</th>
                <th>Player</th>
                <th>Message</th>
              </tr>
            </thead>
            <tbody>
              {events.events.map((e, i) => (
                <tr key={i}>
                  <td>{e.timestamp}</td>
                  <td>{e.type}</td>
                  <td>{e.player || "-"}</td>
                  <td>{e.raw}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showRaw && rawTail && (
        <div className="card">
          <pre style={{ whiteSpace: "pre-wrap", fontSize: "0.85rem" }}>
            {rawTail.lines.join("\n")}
          </pre>
        </div>
      )}
    </div>
  );
}
