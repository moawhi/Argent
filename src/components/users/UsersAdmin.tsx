"use client";

import { useActionState, useState } from "react";
import {
  createUserAction,
  updateRoleSectionsAction,
  updateUserAction,
  type UsersFormState,
} from "@/app/users/actions";
import { Button } from "@/components/ui/button";
import { Field, Input, Select } from "@/components/ui/primitives";
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
    <div className="space-y-6">
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
        <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
          <div className="space-y-3">
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
          <CreateUserCard roles={roles} />
        </div>
      ) : null}

      {tab === "roles" ? (
        <div className="space-y-4">
          {roles.map((role) => (
            <RoleCard key={role.id} role={role} />
          ))}
        </div>
      ) : null}

      {tab === "api" ? (
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
      ) : null}

      {tab === "activity" ? (
        <ActivityPanel
          users={users.map((u) => ({
            id: u.id,
            name: u.name,
            email: u.email,
          }))}
          connections={connections.map((c) => ({ id: c.id, name: c.name }))}
          initial={activity}
        />
      ) : null}
    </div>
  );
}

function CreateUserCard({ roles }: { roles: RoleRow[] }) {
  const [state, action, pending] = useActionState(createUserAction, initial);

  return (
    <form action={action} className="card h-fit space-y-3 border border-line p-4">
      <h2 className="text-sm font-semibold">Add user</h2>
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
      {state.error ? (
        <p className="text-sm text-danger">{state.error}</p>
      ) : null}
      {state.ok ? (
        <p className="text-sm text-positive">{state.ok}</p>
      ) : null}
      <Button type="submit" disabled={pending} className="w-full">
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
    <div className="card border border-line p-4">
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-start justify-between gap-3 text-left"
      >
        <div>
          <p className="text-sm font-medium">
            {user.name}
            {!user.active ? (
              <span className="ml-2 text-xs font-normal text-ink-faint">
                inactive
              </span>
            ) : null}
          </p>
          <p className="text-xs text-ink-soft">{user.email}</p>
        </div>
        <span className="rounded-md bg-canvas px-2 py-0.5 text-xs text-ink-soft">
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
            <div className="grid grid-cols-2 gap-1.5">
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

function RoleCard({ role }: { role: RoleRow }) {
  const [state, action, pending] = useActionState(
    updateRoleSectionsAction,
    initial,
  );
  const granted = new Set(role.sectionGrants.map((g) => g.section));
  const locked = role.key === "admin";

  return (
    <form action={action} className="card space-y-3 border border-line p-4">
      <input type="hidden" name="roleId" value={role.id} />
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold">{role.label}</h3>
          <p className="text-xs text-ink-soft">
            {role.description ?? role.key} · {role._count.users} user
            {role._count.users === 1 ? "" : "s"}
          </p>
        </div>
        {locked ? (
          <span className="text-[11px] text-ink-faint">Always all sections</span>
        ) : null}
      </div>
      <div className="grid gap-1.5 sm:grid-cols-2">
        {APP_SECTIONS.map((section: AppSection) => (
          <label
            key={section}
            className={cn(
              "flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm",
              locked ? "opacity-70" : "hover:bg-canvas",
            )}
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
      {state.error ? (
        <p className="text-sm text-danger">{state.error}</p>
      ) : null}
      {state.ok ? (
        <p className="text-sm text-positive">{state.ok}</p>
      ) : null}
      {!locked ? (
        <Button type="submit" disabled={pending}>
          {pending ? "Saving…" : "Save role access"}
        </Button>
      ) : null}
    </form>
  );
}
