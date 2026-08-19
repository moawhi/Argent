"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/server/auth/permissions";
import {
  createRole,
  createUser,
  deleteRole,
  setUserSectionOverrides,
  updateRole,
  updateUser,
} from "@/server/auth/users";
import {
  getRequestLogDetail,
  listRequestActivity,
  setSubjectConnectionGrants,
  type ApiGrantSubject,
} from "@/server/auth/api-grants";
import { APP_SECTIONS, isAppSection, type AppSection } from "@/lib/auth/sections";
import { prisma } from "@/server/db";

export type UsersFormState = { error?: string; ok?: string; nonce?: string };

function parseSections(formData: FormData, prefix: string): AppSection[] {
  const out: AppSection[] = [];
  for (const section of APP_SECTIONS) {
    if (formData.get(`${prefix}_${section}`) === "on" && isAppSection(section)) {
      out.push(section);
    }
  }
  return out;
}

export async function createUserAction(
  _prev: UsersFormState,
  formData: FormData,
): Promise<UsersFormState> {
  await requireAdmin();
  const name = String(formData.get("name") ?? "").trim();
  const email = String(formData.get("email") ?? "")
    .trim()
    .toLowerCase();
  const password = String(formData.get("password") ?? "");
  const roleId = String(formData.get("roleId") ?? "");

  if (!name || !email || !password || !roleId) {
    return { error: "Name, email, password, and role are required." };
  }
  if (password.length < 8) {
    return { error: "Password must be at least 8 characters." };
  }

  try {
    await createUser({ name, email, password, roleId });
  } catch (error) {
    const message =
      error instanceof Error && error.message.includes("Unique")
        ? "That email is already in use."
        : error instanceof Error
          ? error.message
          : "Could not create user.";
    return { error: message };
  }

  revalidatePath("/users");
  return { ok: "User created." };
}

export async function updateUserAction(
  _prev: UsersFormState,
  formData: FormData,
): Promise<UsersFormState> {
  await requireAdmin();
  const id = String(formData.get("userId") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  const roleId = String(formData.get("roleId") ?? "");
  const active = formData.get("active") === "on";
  const password = String(formData.get("password") ?? "");
  const sections = parseSections(formData, "override");

  if (!id || !name || !roleId) {
    return { error: "Missing user fields." };
  }

  try {
    await updateUser(id, {
      name,
      roleId,
      active,
      password: password || undefined,
    });
    await setUserSectionOverrides(id, sections);
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Could not update user.",
    };
  }

  revalidatePath("/users");
  return { ok: "User updated." };
}

export async function createRoleAction(
  _prev: UsersFormState,
  formData: FormData,
): Promise<UsersFormState> {
  await requireAdmin();
  const label = String(formData.get("label") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  const sections = parseSections(formData, "section");

  if (!label) return { error: "Role name is required." };

  try {
    const role = await createRole({
      label,
      description: description || undefined,
      sections,
    });
    revalidatePath("/users");
    return { ok: `Created ${role.label}.`, nonce: role.id };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Could not create role.",
    };
  }
}

export async function updateRoleAction(
  _prev: UsersFormState,
  formData: FormData,
): Promise<UsersFormState> {
  await requireAdmin();
  const roleId = String(formData.get("roleId") ?? "");
  if (!roleId) return { error: "Missing role." };

  const role = await prisma.role.findUnique({ where: { id: roleId } });
  if (!role) return { error: "Role not found." };

  const label = String(formData.get("label") ?? "").trim();
  const description = String(formData.get("description") ?? "");
  const sections = parseSections(formData, "section");

  try {
    await updateRole(roleId, {
      label: role.key === "admin" ? undefined : label,
      description: role.key === "admin" ? undefined : description,
      sections,
    });
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Could not update role.",
    };
  }

  revalidatePath("/users");
  return { ok: `Updated ${label || role.label}.` };
}

export async function deleteRoleAction(
  _prev: UsersFormState,
  formData: FormData,
): Promise<UsersFormState> {
  await requireAdmin();
  const roleId = String(formData.get("roleId") ?? "");
  if (!roleId) return { error: "Missing role." };

  try {
    await deleteRole(roleId);
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Could not delete role.",
    };
  }

  revalidatePath("/users");
  return { ok: "Role deleted." };
}

export async function saveApiAccessAction(
  _prev: UsersFormState,
  formData: FormData,
): Promise<UsersFormState> {
  await requireAdmin();

  const subjectKind = String(formData.get("subjectKind") ?? "");
  const subjectId = String(formData.get("subjectId") ?? "");
  const connectionId = String(formData.get("connectionId") ?? "");
  const entireConnection = formData.get("entireConnection") === "on";
  const operationIds = formData
    .getAll("operationId")
    .map(String)
    .filter(Boolean);

  if (
    (subjectKind !== "role" && subjectKind !== "user") ||
    !subjectId ||
    !connectionId
  ) {
    return { error: "Missing grant fields." };
  }

  const subject: ApiGrantSubject =
    subjectKind === "role"
      ? { kind: "role", roleId: subjectId }
      : { kind: "user", userId: subjectId };

  try {
    await setSubjectConnectionGrants(subject, connectionId, {
      entireConnection,
      operationIds,
    });
  } catch (error) {
    return {
      error:
        error instanceof Error ? error.message : "Could not save API access.",
    };
  }

  revalidatePath("/users");
  return { ok: "API access saved for this connection." };
}

export async function fetchActivityAction(input: {
  userId?: string;
  connectionId?: string;
  ok?: "all" | "ok" | "fail";
  skip?: number;
}) {
  await requireAdmin();
  const okFilter =
    input.ok === "ok" ? true : input.ok === "fail" ? false : undefined;

  return listRequestActivity({
    userId: input.userId || undefined,
    connectionId: input.connectionId || undefined,
    ok: okFilter,
    take: 50,
    skip: input.skip ?? 0,
  });
}

export async function fetchActivityDetailAction(id: string) {
  await requireAdmin();
  return getRequestLogDetail(id);
}
