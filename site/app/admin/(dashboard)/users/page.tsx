import { requireAdmin } from "@/lib/admin-session";
import { listUsers } from "@/lib/repos/operations";
import UsersAdmin from "./UsersAdmin";

/** Server component: the account list ships in the HTML. */
export default async function AdminUsersPage() {
  // Before any query: the layout's check does not cover this page's data.
  await requireAdmin();
  const users = await listUsers();
  return (
    <UsersAdmin
      initial={users.map((u) => ({
        id: u.id,
        username: u.username,
        role: u.role,
        createdAt: u.createdAt,
      }))}
    />
  );
}
