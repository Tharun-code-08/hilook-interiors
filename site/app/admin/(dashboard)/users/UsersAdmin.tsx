"use client";

import { useState } from "react";
import { adminFetch } from "@/lib/admin-client";
import { useConfirm } from "../components/ConfirmDialog";
import { jsonBody, useMutation } from "../components/useMutation";
import {
  Badge,
  Button,
  Card,
  EmptyState,
  PageHeader,
  SelectField,
  TextField,
} from "../../components/ui";

type AdminUserView = { id: string; username: string; role: "owner" | "editor"; createdAt: string };

export default function UsersAdmin({ initial }: { initial: AdminUserView[] }) {
  const [users, setUsers] = useState<AdminUserView[]>(initial);
  const [form, setForm] = useState({
    username: "",
    password: "",
    role: "editor" as "owner" | "editor",
  });
  const [error, setError] = useState("");
  const { mutate } = useMutation();
  const confirm = useConfirm();

  // Refetch after a create; no fetch on mount — the list is server-rendered.
  async function load() {
    const res = await adminFetch("/api/admin/users");
    if (res.ok) setUsers(await res.json());
  }

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
    <>
      <PageHeader
        title="Admin users"
        description="Owners can add or remove accounts and set roles. Editors can manage content but not other accounts."
      />

      <div className="ad-stack-lg">
        <Card title="Add an account">
          <form onSubmit={addUser} className="ad-stack">
            <div className="ad-grid-2">
              <TextField
                label="Username"
                autoComplete="off"
                value={form.username}
                onChange={(e) => setForm({ ...form, username: e.target.value })}
              />
              <SelectField
                label="Role"
                value={form.role}
                onChange={(e) => setForm({ ...form, role: e.target.value as "owner" | "editor" })}
              >
                <option value="editor">Editor — content only</option>
                <option value="owner">Owner — content and accounts</option>
              </SelectField>
            </div>
            <TextField
              label="Password"
              type="password"
              autoComplete="new-password"
              hint="At least 8 characters."
              error={error || undefined}
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
            />
            <div className="ad-row">
              <Button
                type="submit"
                variant="primary"
                disabled={!form.username.trim() || form.password.length < 8}
              >
                Create account
              </Button>
            </div>
          </form>
        </Card>

        <Card title="Accounts" bodyless>
          {users.length === 0 ? (
            <EmptyState title="No accounts" />
          ) : (
            <div className="ad-table-wrap" role="region" aria-label="Admin accounts" tabIndex={0}>
              <table className="ad-table">
                <thead>
                  <tr>
                    <th scope="col">Username</th>
                    <th scope="col">Role</th>
                    <th scope="col">Created</th>
                    <th scope="col">
                      <span className="ad-sr">Actions</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((u) => (
                    <tr key={u.id}>
                      <td className="ad-td-strong">{u.username}</td>
                      <td>
                        <Badge tone={u.role === "owner" ? "info" : "neutral"}>{u.role}</Badge>
                      </td>
                      <td>{new Date(u.createdAt).toLocaleDateString()}</td>
                      <td className="ad-td-actions">
                        <Button
                          variant="danger-quiet"
                          size="sm"
                          onClick={() => removeUser(u.id)}
                          aria-label={`Remove the account ${u.username}`}
                        >
                          Remove
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>
    </>
  );
}
