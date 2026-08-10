/**
 * End-to-end smoke against the app's own Postgres (DATABASE_URL).
 * Creates a temporary database connection, introspects, saves a query, runs it.
 */
import { prisma } from "@/server/db";
import {
  createDatabaseConnection,
  refreshDbCatalog,
  saveSqlOperation,
} from "@/server/database/service";
import { executeSqlOperation, executeAdHocSql } from "@/server/database/executor";
import { executeOperation } from "@/server/gateway/executor";

function parseDatabaseUrl(url: string) {
  const parsed = new URL(url);
  return {
    host: parsed.hostname,
    port: Number(parsed.port || 5432),
    database: parsed.pathname.replace(/^\//, "").split("?")[0],
    user: decodeURIComponent(parsed.username),
    password: decodeURIComponent(parsed.password),
  };
}

async function main() {
  const raw = process.env.DATABASE_URL;
  if (!raw) throw new Error("DATABASE_URL is required");

  const parsed = parseDatabaseUrl(raw);
  const name = `Smoke Postgres ${Date.now().toString(36)}`;

  console.log("creating connection to", parsed.host, parsed.database);
  const connection = await createDatabaseConnection({
    name,
    password: parsed.password,
    readOnly: true,
    config: {
      engine: "postgres",
      host: parsed.host,
      port: parsed.port,
      database: parsed.database,
      user: parsed.user,
      ssl: false,
    },
  });

  try {
    const schemas = await refreshDbCatalog(connection.id);
    console.log(
      "schemas:",
      schemas.map((schema) => `${schema.name}(${schema.tables.length} tables)`).join(", "),
    );
    assert(schemas.length > 0, "expected at least one schema");

    const publicSchema = schemas.find((schema) => schema.name === "public");
    assert(publicSchema, "expected public schema");
    assert(publicSchema.tables.length > 0, "expected tables in public");

    const adHoc = await executeAdHocSql({
      connectionId: connection.id,
      sql: "SELECT count(*)::int AS n FROM \"Connection\"",
      origin: "test",
    });
    console.log("ad-hoc:", adHoc.ok, adHoc.rows?.[0], adHoc.error?.message);
    assert(adHoc.ok, adHoc.error?.message ?? "ad-hoc failed");

    const writeBlocked = await executeAdHocSql({
      connectionId: connection.id,
      sql: "DELETE FROM \"Connection\" WHERE id = {{id}}",
      params: { id: "nope" },
      origin: "test",
    });
    assert(
      !writeBlocked.ok && writeBlocked.error?.kind === "readOnly",
      "read-only should block DELETE",
    );
    console.log("read-only blocked DELETE:", writeBlocked.error?.message);

    const operation = await saveSqlOperation({
      connectionId: connection.id,
      name: "Count connections",
      sqlTemplate:
        "SELECT count(*)::int AS n FROM \"Connection\" WHERE type = {{type}}",
      tags: ["Smoke"],
    });

    const viaGateway = await executeOperation({
      operationId: operation.id,
      params: { type: "database" },
      origin: "test",
      noCache: true,
    });
    console.log(
      "gateway:",
      viaGateway.ok,
      viaGateway.rows?.[0],
      viaGateway.error?.message,
    );
    assert(viaGateway.ok, viaGateway.error?.message ?? "gateway failed");

    const viaSql = await executeSqlOperation({
      operationId: operation.id,
      connectionId: connection.id,
      params: { type: "api" },
      origin: "test",
    });
    assert(viaSql.ok, viaSql.error?.message ?? "sql executor failed");

    console.log("smoke OK");
  } finally {
    await prisma.connection.delete({ where: { id: connection.id } });
    console.log("cleaned up", connection.id);
  }
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
