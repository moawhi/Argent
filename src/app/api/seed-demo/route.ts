import { NextResponse } from "next/server";
import { seedDemo } from "@/server/demo/seed";

/**
 * Installs the bundled demo from the command line:
 * `npm run seed` while the dev server is running.
 *
 * Development only — in production the demo is installed from the home page,
 * which sits behind whatever access control the deployment adds.
 */
export async function POST() {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json(
      { error: "Seeding is only available in development." },
      { status: 403 },
    );
  }

  try {
    const result = await seedDemo();
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : String(error) },
      { status: 500 },
    );
  }
}
