"use client";

import { useActionState, useMemo, useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import {
  saveApiAccessAction,
  type UsersFormState,
} from "@/app/users/actions";
import { Button } from "@/components/ui/button";
import { MethodBadge } from "@/components/ui/primitives";
import { cn } from "@/lib/utils";

export type ApiAccessConnection = {
  id: string;
  name: string;
  type: string;
  operations: {
    id: string;
    method: string;
    path: string;
    summary: string | null;
    operationKey: string;
    tags: string[];
  }[];
};

export type ApiAccessGrant = {
  id: string;
  connectionId: string | null;
  operationId: string | null;
};

type SubjectKind = "role" | "user";

const initial: UsersFormState = {};

export function ApiAccessPanel({
  connections,
  grantsByRole,
  grantsByUser,
  roles,
  users,
}: {
  connections: ApiAccessConnection[];
  grantsByRole: Record<string, ApiAccessGrant[]>;
  grantsByUser: Record<string, ApiAccessGrant[]>;
  roles: { id: string; key: string; label: string }[];
  users: { id: string; name: string; email: string; role: { label: string } }[];
}) {
  const [subjectKind, setSubjectKind] = useState<SubjectKind>("role");
  const [subjectId, setSubjectId] = useState(roles[0]?.id ?? "");
  const [openConnectionId, setOpenConnectionId] = useState<string | null>(
    connections[0]?.id ?? null,
  );

  const grants = useMemo(() => {
    if (subjectKind === "role") return grantsByRole[subjectId] ?? [];
    return grantsByUser[subjectId] ?? [];
  }, [grantsByRole, grantsByUser, subjectId, subjectKind]);

  const subjects =
    subjectKind === "role"
      ? roles.map((r) => ({ id: r.id, label: r.label }))
      : users.map((u) => ({
          id: u.id,
          label: `${u.name} (${u.email})`,
        }));

  return (
    <div className="space-y-4">
      <p className="text-sm text-ink-soft">
        Grant access to whole connections or individual endpoints. A connection
        stays open to everyone until you add the first grant on it — then only
        granted people and roles (plus admins) can call it.
      </p>

      <div className="flex flex-wrap items-end gap-3">
        <label className="space-y-1 text-xs">
          <span className="font-medium text-ink-soft">Grant to</span>
          <select
            value={subjectKind}
            onChange={(event) => {
              const next = event.target.value as SubjectKind;
              setSubjectKind(next);
              setSubjectId(
                next === "role" ? (roles[0]?.id ?? "") : (users[0]?.id ?? ""),
              );
            }}
            className="block h-8 rounded-md border border-line bg-surface px-2 text-sm"
          >
            <option value="role">Role</option>
            <option value="user">User</option>
          </select>
        </label>
        <label className="min-w-[16rem] flex-1 space-y-1 text-xs">
          <span className="font-medium text-ink-soft">
            {subjectKind === "role" ? "Role" : "Person"}
          </span>
          <select
            value={subjectId}
            onChange={(event) => setSubjectId(event.target.value)}
            className="block h-8 w-full rounded-md border border-line bg-surface px-2 text-sm"
          >
            {subjects.map((subject) => (
              <option key={subject.id} value={subject.id}>
                {subject.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      {connections.length === 0 ? (
        <p className="text-sm text-ink-faint">
          No connections yet. Import an API first.
        </p>
      ) : (
        <div className="space-y-2">
          {connections.map((connection) => (
            <ConnectionGrantCard
              key={`${subjectKind}:${subjectId}:${connection.id}`}
              connection={connection}
              subjectKind={subjectKind}
              subjectId={subjectId}
              grants={grants}
              open={openConnectionId === connection.id}
              onToggle={() =>
                setOpenConnectionId((id) =>
                  id === connection.id ? null : connection.id,
                )
              }
            />
          ))}
        </div>
      )}
    </div>
  );
}

function ConnectionGrantCard({
  connection,
  subjectKind,
  subjectId,
  grants,
  open,
  onToggle,
}: {
  connection: ApiAccessConnection;
  subjectKind: SubjectKind;
  subjectId: string;
  grants: ApiAccessGrant[];
  open: boolean;
  onToggle: () => void;
}) {
  const entire = grants.some(
    (g) => g.connectionId === connection.id && !g.operationId,
  );
  const grantedOps = new Set(
    grants
      .filter((g) => g.operationId)
      .map((g) => g.operationId as string)
      .filter((id) => connection.operations.some((op) => op.id === id)),
  );

  const [state, action, pending] = useActionState(saveApiAccessAction, initial);
  const [entireChecked, setEntireChecked] = useState(entire);

  const summary = entire
    ? "Entire connection"
    : grantedOps.size > 0
      ? `${grantedOps.size} endpoint${grantedOps.size === 1 ? "" : "s"}`
      : "No grants (open if none exist on this connection)";

  return (
    <div className="rounded-lg border border-line bg-surface">
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center gap-2 px-3 py-2.5 text-left"
      >
        {open ? (
          <ChevronDown className="size-3.5 text-ink-faint" />
        ) : (
          <ChevronRight className="size-3.5 text-ink-faint" />
        )}
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-ink">
            {connection.name}
          </p>
          <p className="text-[11px] text-ink-faint">
            {connection.operations.length} endpoints · {summary}
          </p>
        </div>
      </button>

      {open ? (
        <form action={action} className="space-y-3 border-t border-line p-3">
          <input type="hidden" name="subjectKind" value={subjectKind} />
          <input type="hidden" name="subjectId" value={subjectId} />
          <input type="hidden" name="connectionId" value={connection.id} />

          <label className="flex cursor-pointer items-center gap-2 text-sm">
            <input
              type="checkbox"
              name="entireConnection"
              checked={entireChecked}
              onChange={(event) => setEntireChecked(event.target.checked)}
              className="size-3.5 rounded border-line"
            />
            Entire connection
          </label>

          <div
            className={cn(
              "max-h-64 space-y-1 overflow-y-auto rounded-md border border-line p-2",
              entireChecked && "pointer-events-none opacity-40",
            )}
          >
            {connection.operations.map((op) => (
              <label
                key={op.id}
                className="flex cursor-pointer items-start gap-2 rounded-md px-1.5 py-1 text-xs hover:bg-canvas"
              >
                <input
                  type="checkbox"
                  name="operationId"
                  value={op.id}
                  defaultChecked={grantedOps.has(op.id)}
                  disabled={entireChecked}
                  className="mt-0.5 size-3.5 rounded border-line"
                />
                <span className="min-w-0">
                  <span className="flex items-center gap-1.5">
                    <MethodBadge method={op.method} />
                    <span className="truncate font-mono text-[11px] text-ink">
                      {op.path}
                    </span>
                  </span>
                  {op.summary ? (
                    <span className="mt-0.5 block truncate text-[11px] text-ink-faint">
                      {op.summary}
                    </span>
                  ) : null}
                </span>
              </label>
            ))}
            {connection.operations.length === 0 ? (
              <p className="px-1 py-2 text-[11px] text-ink-faint">
                No endpoints on this connection.
              </p>
            ) : null}
          </div>

          {state.error ? (
            <p className="text-sm text-danger">{state.error}</p>
          ) : null}
          {state.ok ? (
            <p className="text-sm text-positive">{state.ok}</p>
          ) : null}

          <Button type="submit" size="sm" disabled={pending || !subjectId}>
            {pending ? "Saving…" : "Save grants for this connection"}
          </Button>
        </form>
      ) : null}
    </div>
  );
}
