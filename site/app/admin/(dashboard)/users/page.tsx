"use client";

import { useEffect, useState } from "react";
import { adminFetch } from "@/lib/admin-client";
import { useConfirm } from "../components/ConfirmDialog";
import { jsonBody, useMutation } from "../components/useMutation";

type AdminUserView = { id: string; username: string; role: "owner" | "editor"; createdAt: string };

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "0.55rem 0.7rem",
  border: "1px solid rgba(74,63,51,0.2)",
  fontSize: "0.85rem",
  outline: "none",
};

export default function AdminUsersPage() {
  const [users, setUsers] = useState<AdminUserView[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({
    username: "",
    password: "",
    role: "editor" as "owner" | "editor",
  });
  const [error, setError] = useState("");
  const { mutate } = useMutation();
  const confirm = useConfirm();

  async function load() {
    setLoading(true);
    const res = await adminFetch("/api/admin/users");
    if (res.ok) setUsers(await res.json());
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  async function addUser(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    // useMutation already surfaces the server's message as an error toast, so
    // the inline setError path only exists for the field-level hint next to
    // the form — a null result means it was rejected and already reported.
    const created = await mutate<{ username: string }>(
      "/api/admin/users",
      { method: "POST", ...jsonBody(form) },
      { successMessage: `Account “${form.username.trim()}” created.` }
    );
    if (!created) {
      setError("Could not create that account. See the message for details.");
      return;
    }

    setForm({ username: "", password: "", role: "editor" });
    load();
  }

  async function removeUser(id: string) {
    const target = users.find((item) => item.id === id);
    const ok = await confirm({
      title: `Remove the account “${target?.username ?? "this item"}”?`,
      body: "They lose access to the admin panel immediately.",
      confirmLabel: "Remove account",
      tone: "danger",
    });
    if (!ok) return;

    const previous = users;
    await mutate(
      `/api/admin/users/${id}`,
      { method: "DELETE" },
      {
        optimistic: () => setUsers((prev) => prev.filter((u) => u.id !== id)),
        rollback: () => setUsers(previous),
        successMessage: "Account removed.",
      }
    );
  }

  return (
    <div>
      <h1
        style={{
          fontFamily: "Georgia, serif",
          fontSize: "1.6rem",
          marginBottom: "1.75rem",
          color: "#26231F",
        }}
      >
        Admin Users
      </h1>

      <form
        onSubmit={addUser}
        style={{
          background: "#fff",
          border: "1px solid rgba(74,63,51,0.16)",
          padding: "1.5rem",
          marginBottom: "2rem",
          display: "grid",
          gap: "0.8rem",
          maxWidth: 420,
        }}
      >
        <p style={{ fontSize: "0.9rem", fontWeight: 600, color: "#26231F" }}>Add Admin Account</p>
        <input
          placeholder="Username"
          value={form.username}
          onChange={(e) => setForm({ ...form, username: e.target.value })}
          style={inputStyle}
        />
        <input
          type="password"
          placeholder="Password (min 8 characters)"
          value={form.password}
          onChange={(e) => setForm({ ...form, password: e.target.value })}
          style={inputStyle}
        />
        <select
          value={form.role}
          onChange={(e) => setForm({ ...form, role: e.target.value as "owner" | "editor" })}
          style={inputStyle}
        >
          <option value="editor">Editor</option>
          <option value="owner">Owner</option>
        </select>
        {error && <p style={{ color: "#5A2630", fontSize: "0.8rem" }}>{error}</p>}
        <button
          type="submit"
          style={{
            justifySelf: "start",
            background: "#B08A4A",
            color: "#fff",
            border: "none",
            padding: "0.6rem 1.4rem",
            fontSize: "0.8rem",
          }}
        >
          Create Account
        </button>
      </form>

      {loading ? (
        <p style={{ color: "#777168" }}>Loading…</p>
      ) : (
        <div style={{ display: "grid", gap: "0.6rem", maxWidth: 560 }}>
          {users.map((u) => (
            <div
              key={u.id}
              style={{
                background: "#fff",
                border: "1px solid rgba(74,63,51,0.16)",
                padding: "0.9rem 1.1rem",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <div>
                <p style={{ color: "#26231F" }}>{u.username}</p>
                <p style={{ fontSize: "0.72rem", color: "#777168", textTransform: "capitalize" }}>
                  {u.role}
                </p>
              </div>
              <button
                onClick={() => removeUser(u.id)}
                style={{
                  background: "transparent",
                  border: "1px solid #5A2630",
                  color: "#5A2630",
                  padding: "0.35rem 0.75rem",
                  fontSize: "0.72rem",
                }}
              >
                Remove
              </button>
            </div>
          ))}
        </div>
      )}

      <p style={{ fontSize: "0.78rem", color: "#777168", marginTop: "1.5rem", maxWidth: "60ch" }}>
        Owners can add or remove admin accounts and set roles. Editors can manage content but not
        other admin accounts. Only owners can create new accounts or remove existing ones.
      </p>
    </div>
  );
}
