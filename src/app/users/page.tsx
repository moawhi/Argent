import { requireAdmin } from "@/server/auth/permissions";
import { listRoles, listUsers } from "@/server/auth/users";
import {
  listApiGrantsForSubject,
  listConnectionsWithOperations,
  listRequestActivity,
} from "@/server/auth/api-grants";
import { UsersAdmin } from "@/components/users/UsersAdmin";
import { PageBody, PageHeader } from "@/components/layout/PageHeader";

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
    <>
      <PageHeader
        title="Users"
        description="Manage people, roles, API access grants, and call activity."
      />
      <PageBody>
        <UsersAdmin
          users={users}
          roles={roles}
          connections={connections}
          grantsByRole={grantsByRole}
          grantsByUser={grantsByUser}
          activity={activity}
        />
      </PageBody>
    </>
  );
}
