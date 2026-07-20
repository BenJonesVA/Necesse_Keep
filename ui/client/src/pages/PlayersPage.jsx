import React, { useCallback, useEffect, useState } from "react";
import { api } from "../api/client.js";
import ConfirmDialog from "../components/ConfirmDialog.jsx";

export default function PlayersPage() {
  const [online, setOnline] = useState(null);
  const [consoleStatus, setConsoleStatus] = useState(null); // { online, max } | { unavailable: message }
  const [bansList, setBansList] = useState(null);
  const [error, setError] = useState(null);
  const [busyId, setBusyId] = useState(null);
  const [confirmBan, setConfirmBan] = useState(null); // player object or null

  const refresh = useCallback(() => {
    api.onlinePlayers().then(setOnline).catch((err) => setError(err.message));
    api
      .consolePlayers()
      .then((d) => setConsoleStatus({ online: d.online, max: d.max }))
      .catch((err) =>
        setConsoleStatus({ unavailable: err.status === 409 ? err.message : "Console unavailable." })
      );
    api.bans().then(setBansList).catch(() => {});
  }, []);

  useEffect(() => {
    refresh();
    const id = setInterval(refresh, 5000);
    return () => clearInterval(id);
  }, [refresh]);

  async function handleKick(player) {
    setBusyId(player.player);
    try {
      await api.kickPlayer(player.player, "Kicked from admin UI");
      refresh();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusyId(null);
    }
  }

  async function handleBan() {
    const player = confirmBan;
    setBusyId(player.player);
    try {
      await api.banPlayer(player.player);
      refresh();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusyId(null);
      setConfirmBan(null);
    }
  }

  async function handleUnban(id) {
    setBusyId(id);
    try {
      await api.unbanPlayer(id);
      refresh();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusyId(null);
    }
  }

  if (error) return <p className="error">{error}</p>;

  return (
    <div>
      <h2>Players</h2>

      <div className="card">
        {!consoleStatus ? (
          <p>Checking live server status...</p>
        ) : consoleStatus.unavailable ? (
          <p className="caveat">{consoleStatus.unavailable}</p>
        ) : (
          <p>
            Live from server console: <strong>{consoleStatus.online}</strong> / {consoleStatus.max} online
          </p>
        )}
      </div>

      <h3>Online now (from logs)</h3>
      <p className="caveat">
        {online?.caveat || "Loading..."}
      </p>
      <div className="card">
        {!online ? (
          <p>Loading...</p>
        ) : online.players.length === 0 ? (
          <p>No players currently connected.</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Player</th>
                <th>Client ID</th>
                <th>Joined at</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {online.players.map((p) => (
                <tr key={p.player}>
                  <td>{p.name || <span className="caveat">(name not yet seen)</span>}</td>
                  <td>{p.player}</td>
                  <td>{p.joinedAt}</td>
                  <td style={{ display: "flex", gap: "0.4rem" }}>
                    <button disabled={busyId === p.player} onClick={() => handleKick(p)}>
                      Kick
                    </button>
                    <button
                      className="danger"
                      disabled={busyId === p.player}
                      onClick={() => setConfirmBan(p)}
                    >
                      Ban
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <h3>Bans</h3>
      <div className="card">
        {!bansList ? (
          <p>Loading...</p>
        ) : bansList.entries.length === 0 ? (
          <p>No banned players.</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Banned ID / name</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {bansList.entries.map((id) => (
                <tr key={id}>
                  <td>{id}</td>
                  <td>
                    <button disabled={busyId === id} onClick={() => handleUnban(id)}>
                      Unban
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <ConfirmDialog
        open={!!confirmBan}
        title="Ban player?"
        message={`This bans "${confirmBan?.name || confirmBan?.player}" from reconnecting until unbanned.`}
        busy={busyId === confirmBan?.player}
        onCancel={() => setConfirmBan(null)}
        onConfirm={handleBan}
      />
    </div>
  );
}
