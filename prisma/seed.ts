/**
 * Seeds roles/grants and the bundled sample API: `npm run db:seed`.
 *
 * Safe to run more than once — demo seed does nothing if already installed.
 */
import { seedDemo } from "../src/server/demo/seed";
import { prisma } from "../src/server/db";
import { ensureDefaultRoles } from "../src/server/auth/roles";

async function main() {
  await ensureDefaultRoles();
  console.log("Roles ready: Admin, Dev, Sales, Client (with default section grants).");

  const result = await seedDemo();

  if (result.alreadyExisted) {
    console.log("The demo is already installed. Nothing to do.");
  } else {
    console.log(
      `Demo installed: ${result.operationCount} endpoints, ` +
        `${result.objectCount} objects, site /sites/${result.dashboardSlug}.`,
    );
  }

  const users = await prisma.user.count();
  if (users === 0) {
    console.log(
      "No users yet — open /login to create the first admin account.",
    );
  }
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
