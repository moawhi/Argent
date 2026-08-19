"use server";

import { revalidatePath } from "next/cache";
import {
  removeDemo,
  seedDemo,
  type SeedResult,
} from "@/server/demo/seed";
import { setUserHideDemo } from "@/server/demo/access";
import {
  isAdmin,
  requireAdmin,
  requireUser,
} from "@/server/auth/permissions";

function revalidateDemoPaths() {
  revalidatePath("/");
  revalidatePath("/connections");
  revalidatePath("/sites");
  revalidatePath("/dashboards");
  revalidatePath("/docs");
  revalidatePath("/objects");
  revalidatePath("/mcp");
}

export async function loadDemoAction(): Promise<{
  ok: boolean;
  result?: SeedResult;
  error?: string;
}> {
  try {
    const user = await requireUser();
    const result = await seedDemo(user.id);

    // Loading the demo also un-hides it for this user.
    if (user.hideDemo) {
      await setUserHideDemo(user.id, false);
    }

    revalidateDemoPaths();
    revalidatePath("/mcp");

    return { ok: true, result };
  } catch (error) {
    return {
      ok: false,
      error:
        error instanceof Error
          ? error.message
          : "The demo could not be installed.",
    };
  }
}

export async function removeDemoAction(): Promise<{
  ok: boolean;
  error?: string;
}> {
  try {
    await requireAdmin();
    await removeDemo();
    revalidateDemoPaths();
    return { ok: true };
  } catch (error) {
    return {
      ok: false,
      error:
        error instanceof Error ? error.message : "The demo could not be removed.",
    };
  }
}

/** Soft-hide the bundled demo from this user's dashboards and docs. */
export async function hideDemoAction(): Promise<{
  ok: boolean;
  error?: string;
}> {
  try {
    const user = await requireUser();
    if (isAdmin(user)) {
      return {
        ok: false,
        error: "Admins remove the demo entirely instead of hiding it.",
      };
    }
    await setUserHideDemo(user.id, true);
    revalidateDemoPaths();
    return { ok: true };
  } catch (error) {
    return {
      ok: false,
      error:
        error instanceof Error ? error.message : "Could not hide the example.",
    };
  }
}

/** Show the bundled demo again for this user (does not reinstall). */
export async function showDemoAction(): Promise<{
  ok: boolean;
  error?: string;
}> {
  try {
    const user = await requireUser();
    await setUserHideDemo(user.id, false);
    revalidateDemoPaths();
    return { ok: true };
  } catch (error) {
    return {
      ok: false,
      error:
        error instanceof Error ? error.message : "Could not show the example.",
    };
  }
}
