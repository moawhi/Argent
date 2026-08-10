import { requireAdmin } from "@/server/auth/permissions";
import { listRoles, listUsers } from "@/server/auth/users";
import {
  listApiGrantsForSubject,
  listConnectionsWithOperations,
  listRequestActivity,
} from "@/server/auth/api-grants";
import { UsersAdmin } from "@/components/users/UsersAdmin";

export default async function UsersPage() {
  await requireAdmin();
  const [users, roles, connections, activity] = await Promise.all([
    listUsers(),
    listRoles(),
    listConnectionsWithOperations(),
    listRequestActivity({ take: 50 }),
  ]);

  const grantsByRole: Record<
    string,
    { id: string; connectionId: string | null; operationId: string | null }[]
  > = {};
  const grantsByUser: Record<
    string,
    { id: string; connectionId: string | null; operationId: string | null }[]
  > = {};

  await Promise.all([
    ...roles.map(async (role) => {
      grantsByRole[role.id] = await listApiGrantsForSubject({
        kind: "role",
        roleId: role.id,
      });
    }),
    ...users.map(async (user) => {
      grantsByUser[user.id] = await listApiGrantsForSubject({
        kind: "user",
        userId: user.id,
      });
    }),
  ]);

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Users</h1>
        <p className="mt-1 text-sm text-ink-soft">
          Manage people, roles, API access grants, and call activity.
        </p>
      </div>
      <UsersAdmin
        users={users}
        roles={roles}
        connections={connections}
        grantsByRole={grantsByRole}
        grantsByUser={grantsByUser}
        activity={activity}
      />
    </div>
  );
}
