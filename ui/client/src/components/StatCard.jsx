import React from "react";

export default function StatCard({ label, value }) {
  return (
    <div className="card" style={{ flex: 1, minWidth: 120 }}>
      <div style={{ fontSize: "0.8rem", color: "#aab" }}>{label}</div>
      <div style={{ fontSize: "1.4rem" }}>{value}</div>
    </div>
  );
}
