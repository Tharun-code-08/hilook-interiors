"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function AdminLoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error || "Invalid credentials");
        setLoading(false);
        return;
      }
      router.push("/admin");
      router.refresh();
    } catch {
      setError("Something went wrong. Please try again.");
      setLoading(false);
    }
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "#26231F",
        fontFamily: "Inter, system-ui, sans-serif",
        padding: "1.5rem",
      }}
    >
      <form
        onSubmit={onSubmit}
        style={{
          width: "100%",
          maxWidth: 360,
          background: "#F4F1EA",
          padding: "2.5rem",
          borderRadius: 4,
        }}
      >
        <p
          style={{
            fontFamily: "Georgia, serif",
            fontSize: "1.4rem",
            color: "#26231F",
            marginBottom: "0.4rem",
          }}
        >
          Hilook Interiors
        </p>
        <p style={{ fontSize: "0.8rem", color: "#777168", marginBottom: "2rem" }}>
          Admin sign in
        </p>

        <label style={{ display: "block", fontSize: "0.75rem", color: "#5E5951", marginBottom: "0.4rem" }}>
          Username
        </label>
        <input
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          required
          style={inputStyle}
        />

        <label style={{ display: "block", fontSize: "0.75rem", color: "#5E5951", margin: "1rem 0 0.4rem" }}>
          Password
        </label>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          style={inputStyle}
        />

        {error && (
          <p style={{ color: "#5A2630", fontSize: "0.8rem", marginTop: "1rem" }}>{error}</p>
        )}

        <button
          type="submit"
          disabled={loading}
          style={{
            marginTop: "1.75rem",
            width: "100%",
            background: "#B08A4A",
            color: "#F8F2E8",
            border: "none",
            padding: "0.8rem",
            fontSize: "0.75rem",
            letterSpacing: "0.14em",
            textTransform: "uppercase",
          }}
        >
          {loading ? "Signing in..." : "Sign In"}
        </button>
      </form>
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "0.65rem 0.8rem",
  border: "1px solid rgba(74,63,51,0.24)",
  background: "#fff",
  fontSize: "0.9rem",
  outline: "none",
};
