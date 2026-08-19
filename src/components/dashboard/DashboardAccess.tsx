"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { saveDashboardAccessAction } from "@/app/dashboards/actions";
import { Button } from "@/components/ui/button";

type RoleOpt = { id: string; label: string; key: string };
type UserOpt = { id: string; name: string; email: string };

export function DashboardAccess({
  dashboardId,
  roles,
  users,
  selectedRoleIds,
  selectedUserIds,
}: {
  dashboardId: string;
  roles: RoleOpt[];
  users: UserOpt[];
  selectedRoleIds: string[];
  selectedUserIds: string[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [roleIds, setRoleIds] = useState(new Set(selectedRoleIds));
  const [userIds, setUserIds] = useState(new Set(selectedUserIds));
  const [message, setMessage] = useState<string | null>(null);

  function toggle(set: Set<string>, id: string, next: boolean) {
    const copy = new Set(set);
    if (next) copy.add(id);
    else copy.delete(id);
    return copy;
  }

  function save() {
    startTransition(async () => {
      await saveDashboardAccessAction(dashboardId, {
        roleIds: [...roleIds],
        userIds: [...userIds],
      });
      setMessage(
        roleIds.size === 0 && userIds.size === 0
          ? "Open to everyone with Sites access."
          : "Viewer list updated.",
      );
      router.refresh();
    });
  }

  return (
    <div className="space-y-3">
      <div>
        <h4 className="text-sm font-medium">Who can view</h4>
        <p className="text-xs text-ink-soft">
          Leave empty so anyone with the Sites section can open it. Once
          you pick roles or people, only they (and Admins) can view.
        </p>
      </div>

      <div>
        <p className="mb-1.5 text-xs font-medium text-ink-soft">Roles</p>
        <div className="space-y-1">
          {roles.map((role) => (
            <label
              key={role.id}
              className="flex items-center gap-2 text-sm text-ink-soft"
            >
              <input
                type="checkbox"
                checked={roleIds.has(role.id)}
                onChange={(e) =>
                  setRoleIds((prev) => toggle(prev, role.id, e.target.checked))
                }
                className="size-3.5 rounded border-line"
              />
              {role.label}
            </label>
          ))}
        </div>
      </div>

      <div>
        <p className="mb-1.5 text-xs font-medium text-ink-soft">People</p>
        <div className="max-h-40 space-y-1 overflow-y-auto">
          {users.map((user) => (
            <label
              key={user.id}
              className="flex items-center gap-2 text-sm text-ink-soft"
            >
              <input
                type="checkbox"
                checked={userIds.has(user.id)}
                onChange={(e) =>
                  setUserIds((prev) => toggle(prev, user.id, e.target.checked))
                }
                className="size-3.5 rounded border-line"
              />
              <span className="truncate">
                {user.name}{" "}
                <span className="text-ink-faint">({user.email})</span>
              </span>
            </label>
          ))}
        </div>
      </div>

      {message ? (
        <p className="text-xs text-positive">{message}</p>
      ) : null}

      <Button type="button" onClick={save} disabled={pending}>
        {pending ? "Saving…" : "Save viewers"}
      </Button>
    </div>
  );
}
