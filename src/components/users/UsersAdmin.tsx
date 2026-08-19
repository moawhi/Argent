"use client";

import { useActionState, useState } from "react";
import {
  createRoleAction,
  createUserAction,
  deleteRoleAction,
  updateRoleAction,
  updateUserAction,
  type UsersFormState,
} from "@/app/users/actions";
import { Button } from "@/components/ui/button";
import { Badge, Field, Input, Select } from "@/components/ui/primitives";
import { isSystemRoleKey } from "@/lib/auth/roles";
import { APP_SECTIONS, SECTION_META, type AppSection } from "@/lib/auth/sections";
import { cn } from "@/lib/utils";
import {
  ApiAccessPanel,
  type ApiAccessConnection,
  type ApiAccessGrant,
} from "./ApiAccessPanel";
import { ActivityPanel } from "./ActivityPanel";
import type { fetchActivityAction } from "@/app/users/actions";

type RoleRow = {
  id: string;
  key: string;
  label: string;
  description: string | null;
  sectionGrants: { section: string }[];
  _count: { users: number };
};

type UserRow = {
  id: string;
  name: string;
  email: string;
  active: boolean;
  roleId: string;
  role: { id: string; key: string; label: string };
  sectionGrants: { section: string }[];
};

const initial: UsersFormState = {};

type Tab = "people" | "roles" | "api" | "activity";

export function UsersAdmin({
  users,
  roles,
  connections,
  grantsByRole,
  grantsByUser,
  activity,
}: {
  users: UserRow[];
  roles: RoleRow[];
  connections: ApiAccessConnection[];
  grantsByRole: Record<string, ApiAccessGrant[]>;
  grantsByUser: Record<string, ApiAccessGrant[]>;
  activity: Awaited<ReturnType<typeof fetchActivityAction>>;
}) {
  const [tab, setTab] = useState<Tab>("people");
  const [editingId, setEditingId] = useState<string | null>(null);

  return (
    <div className="w-full min-w-0 space-y-6">
      <div className="flex flex-wrap gap-2 border-b border-line">
        {(
          [
            ["people", "People"],
            ["roles", "Roles"],
            ["api", "API access"],
            ["activity", "Activity"],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => setTab(id)}
            className={cn(
              "border-b-2 px-3 py-2 text-sm font-medium transition-colors",
              tab === id
                ? "border-brand text-brand-ink"
                : "border-transparent text-ink-soft hover:text-ink",
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === "people" ? (
        <div className="w-full min-w-0 space-y-4">
          <CreateUserCard roles={roles} />
          <div className="min-w-0 space-y-3">
            {users.map((user) => (
              <UserCard
                key={user.id}
                user={user}
                roles={roles}
                expanded={editingId === user.id}
                onToggle={() =>
                  setEditingId((id) => (id === user.id ? null : user.id))
                }
              />
            ))}
            {users.length === 0 ? (
              <p className="text-sm text-ink-soft">No users yet.</p>
            ) : null}
          </div>
        </div>
      ) : null}

      {tab === "roles" ? (
        <div className="w-full min-w-0 space-y-3">
          <CreateRoleCard />
          {roles.map((role) => (
            <RoleCard key={role.id} role={role} />
          ))}
        </div>
      ) : null}

      {tab === "api" ? (
        <div className="w-full min-w-0">
          <ApiAccessPanel
            connections={connections}
            grantsByRole={grantsByRole}
            grantsByUser={grantsByUser}
            roles={roles.map((r) => ({ id: r.id, key: r.key, label: r.label }))}
            users={users.map((u) => ({
              id: u.id,
              name: u.name,
              email: u.email,
              role: { label: u.role.label },
            }))}
          />
        </div>
      ) : null}

      {tab === "activity" ? (
        <div className="w-full min-w-0">
          <ActivityPanel
            users={users.map((u) => ({
              id: u.id,
              name: u.name,
              email: u.email,
            }))}
            connections={connections.map((c) => ({ id: c.id, name: c.name }))}
            initial={activity}
          />
        </div>
      ) : null}
    </div>
  );
}

function CreateUserCard({ roles }: { roles: RoleRow[] }) {
  const [state, action, pending] = useActionState(createUserAction, initial);

  return (
    <form
      action={action}
      className="card w-full min-w-0 space-y-3 border border-line p-4"
    >
      <h2 className="text-sm font-semibold">Add user</h2>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Field label="Name">
          <Input name="name" required />
        </Field>
        <Field label="Email">
          <Input name="email" type="email" required />
        </Field>
        <Field label="Temporary password">
          <Input name="password" type="password" required minLength={8} />
        </Field>
        <Field label="Role">
          <Select name="roleId" required defaultValue={roles[0]?.id}>
            {roles.map((r) => (
              <option key={r.id} value={r.id}>
                {r.label}
              </option>
            ))}
          </Select>
        </Field>
      </div>
      {state.error ? (
        <p className="text-sm text-danger">{state.error}</p>
      ) : null}
      {state.ok ? (
        <p className="text-sm text-positive">{state.ok}</p>
      ) : null}
      <Button type="submit" disabled={pending}>
        {pending ? "Creating…" : "Create user"}
      </Button>
    </form>
  );
}

function UserCard({
  user,
  roles,
  expanded,
  onToggle,
}: {
  user: UserRow;
  roles: RoleRow[];
  expanded: boolean;
  onToggle: () => void;
}) {
  const [state, action, pending] = useActionState(updateUserAction, initial);
  const overrides = new Set(user.sectionGrants.map((g) => g.section));

  return (
    <div className="card min-w-0 border border-line p-4">
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full min-w-0 items-start justify-between gap-3 text-left"
      >
        <div className="min-w-0">
          <p className="truncate text-sm font-medium">
            {user.name}
            {!user.active ? (
              <span className="ml-2 text-xs font-normal text-ink-faint">
                inactive
              </span>
            ) : null}
          </p>
          <p className="truncate text-xs text-ink-soft">{user.email}</p>
        </div>
        <span className="shrink-0 rounded-md bg-canvas px-2 py-0.5 text-xs text-ink-soft">
          {user.role.label}
        </span>
      </button>

      {expanded ? (
        <form action={action} className="mt-4 space-y-3 border-t border-line pt-4">
          <input type="hidden" name="userId" value={user.id} />
          <Field label="Name">
            <Input name="name" defaultValue={user.name} required />
          </Field>
          <Field label="Role">
            <Select name="roleId" defaultValue={user.roleId}>
              {roles.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.label}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="New password (optional)">
            <Input name="password" type="password" minLength={8} />
          </Field>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              name="active"
              defaultChecked={user.active}
              className="size-4 rounded border-line"
            />
            Active
          </label>
          <div>
            <p className="mb-2 text-xs font-medium text-ink-soft">
              Extra section access (overrides)
            </p>
            <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3 lg:grid-cols-4">
              {APP_SECTIONS.map((section) => (
                <label
                  key={section}
                  className="flex items-center gap-2 text-xs text-ink-soft"
                >
                  <input
                    type="checkbox"
                    name={`override_${section}`}
                    defaultChecked={overrides.has(section)}
                    className="size-3.5 rounded border-line"
                  />
                  {SECTION_META[section].label}
                </label>
              ))}
            </div>
          </div>
          {state.error ? (
            <p className="text-sm text-danger">{state.error}</p>
          ) : null}
          {state.ok ? (
            <p className="text-sm text-positive">{state.ok}</p>
          ) : null}
          <Button type="submit" disabled={pending}>
            {pending ? "Saving…" : "Save changes"}
          </Button>
        </form>
      ) : null}
    </div>
  );
}

function SectionAccessGrid({
  granted,
  locked,
}: {
  granted: Set<string>;
  locked?: boolean;
}) {
  return (
    <div>
      <p className="mb-2 text-xs font-medium text-ink-soft">Section access</p>
      <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-7">
        {APP_SECTIONS.map((section: AppSection) => (
          <label
            key={section}
            className={cn(
              "flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm",
              locked ? "opacity-70" : "hover:bg-canvas",
            )}
            title={SECTION_META[section].hint}
          >
            <input
              type="checkbox"
              name={`section_${section}`}
              defaultChecked={granted.has(section) || locked}
              disabled={locked}
              className="size-3.5 rounded border-line"
            />
            {SECTION_META[section].label}
          </label>
        ))}
      </div>
    </div>
  );
}

function CreateRoleCard() {
  const [state, action, pending] = useActionState(createRoleAction, initial);

  return (
    <form
      key={state.nonce ?? "new-role"}
      action={action}
      className="card w-full min-w-0 space-y-3 border border-line p-4"
    >
      <div>
        <h2 className="text-sm font-semibold">New role</h2>
        <p className="text-xs text-ink-soft">
          Create a group type and choose which areas it can open. Assign people
          on the People tab; API and site viewers are set on the other tabs.
        </p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Name" required>
          <Input name="label" required maxLength={60} placeholder="e.g. Finance" />
        </Field>
        <Field label="Description">
          <Input name="description" maxLength={160} placeholder="Optional" />
        </Field>
      </div>
      <SectionAccessGrid granted={new Set()} />
      {state.error ? (
        <p className="text-sm text-danger">{state.error}</p>
      ) : null}
      {state.ok ? (
        <p className="text-sm text-positive">{state.ok}</p>
      ) : null}
      <Button type="submit" disabled={pending}>
        {pending ? "Creating…" : "Create role"}
      </Button>
    </form>
  );
}

function RoleCard({ role }: { role: RoleRow }) {
  const [state, action, pending] = useActionState(updateRoleAction, initial);
  const [deleteState, deleteAction, deleting] = useActionState(
    deleteRoleAction,
    initial,
  );
  const granted = new Set(role.sectionGrants.map((g) => g.section));
  const locked = role.key === "admin";
  const system = isSystemRoleKey(role.key);
  const canDelete = !system && role._count.users === 0;
  const error = state.error ?? deleteState.error;
  const ok = state.ok ?? deleteState.ok;

  return (
    <div className="card min-w-0 space-y-3 border border-line p-4">
      <form action={action} className="space-y-3">
        <input type="hidden" name="roleId" value={role.id} />
        <div className="flex min-w-0 items-start justify-between gap-3">
          <div className="min-w-0 flex-1 space-y-2">
            {locked ? (
              <div>
                <h3 className="text-sm font-semibold">{role.label}</h3>
                <p className="text-xs text-ink-soft">
                  {role.description ?? role.key} · {role._count.users} user
                  {role._count.users === 1 ? "" : "s"}
                </p>
              </div>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Name" required>
                  <Input
                    name="label"
                    required
                    maxLength={60}
                    defaultValue={role.label}
                  />
                </Field>
                <Field label="Description">
                  <Input
                    name="description"
                    maxLength={160}
                    defaultValue={role.description ?? ""}
                  />
                </Field>
              </div>
            )}
          </div>
          <div className="flex shrink-0 flex-col items-end gap-1">
            <Badge tone={system ? "neutral" : "brand"}>
              {system ? "Built-in" : "Custom"}
            </Badge>
            {locked ? (
              <span className="text-[11px] text-ink-faint">Always all sections</span>
            ) : (
              <span className="text-[11px] text-ink-faint">
                {role._count.users} user{role._count.users === 1 ? "" : "s"}
              </span>
            )}
          </div>
        </div>
        <SectionAccessGrid granted={granted} locked={locked} />
        {error ? <p className="text-sm text-danger">{error}</p> : null}
        {ok ? <p className="text-sm text-positive">{ok}</p> : null}
        {!locked ? (
          <div className="flex flex-wrap items-center gap-2">
            <Button type="submit" disabled={pending}>
              {pending ? "Saving…" : "Save role"}
            </Button>
          </div>
        ) : null}
      </form>
      {canDelete ? (
        <form
          action={deleteAction}
          onSubmit={(event) => {
            if (!confirm(`Delete role "${role.label}"?`)) {
              event.preventDefault();
            }
          }}
        >
          <input type="hidden" name="roleId" value={role.id} />
          <Button type="submit" variant="ghost" size="sm" disabled={deleting}>
            {deleting ? "Deleting…" : "Delete role"}
          </Button>
        </form>
      ) : !system && role._count.users > 0 ? (
        <p className="text-[11px] text-ink-faint">
          Reassign users before this role can be deleted.
        </p>
      ) : null}
    </div>
  );
}
