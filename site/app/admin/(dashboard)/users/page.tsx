import { listUsers } from "@/lib/repos/operations";
import UsersAdmin from "./UsersAdmin";

/** Server component: the account list ships in the HTML. */
export default async function AdminUsersPage() {
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
