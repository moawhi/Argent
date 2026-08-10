/**
 * Lightweight checks for the SQL binder and read-only gate.
 * Run with: npx tsx --test src/server/database/sql.test.ts
 */
import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import {
  bindSql,
  extractParamNames,
  isReadOnlySql,
  isWriteSql,
  sqlVerb,
} from "./sql";

describe("extractParamNames", () => {
  it("keeps first-seen order and uniqueness", () => {
    assert.deepEqual(
      extractParamNames(
        "SELECT * FROM t WHERE a = {{status}} AND b = {{limit}} OR a = {{status}}",
      ),
      ["status", "limit"],
    );
  });
});

describe("bindSql", () => {
  it("binds postgres positionally", () => {
    const bound = bindSql(
      "postgres",
      "SELECT * FROM orders WHERE status = {{status}} LIMIT {{limit}}",
      { status: "active", limit: 10 },
    );
    assert.equal(
      bound.text,
      "SELECT * FROM orders WHERE status = $1 LIMIT $2",
    );
    assert.deepEqual(bound.values, ["active", 10]);
  });

  it("binds mariadb with question marks", () => {
    const bound = bindSql(
      "mariadb",
      "SELECT * FROM orders WHERE status = {{status}}",
      { status: "paused" },
    );
    assert.equal(bound.text, "SELECT * FROM orders WHERE status = ?");
    assert.deepEqual(bound.values, ["paused"]);
  });

  it("binds clickhouse with named typed params", () => {
    const bound = bindSql(
      "clickhouse",
      "SELECT * FROM events WHERE day = {{day}} AND amount > {{amount}}",
      { day: "2026-01-01", amount: 1.5 },
    );
    assert.equal(
      bound.text,
      "SELECT * FROM events WHERE day = {day:String} AND amount > {amount:Float64}",
    );
    assert.deepEqual(bound.named, { day: "2026-01-01", amount: 1.5 });
  });

  it("never splices values into the bound text", () => {
    const evil = "'; DROP TABLE users; --";
    const bound = bindSql("postgres", "SELECT {{q}}", { q: evil });
    assert.equal(bound.text, "SELECT $1");
    assert.ok(!bound.text.includes("DROP"));
    assert.equal(bound.values[0], evil);
  });
});

describe("read-only detection", () => {
  it("allows SELECT and WITH", () => {
    assert.equal(isReadOnlySql("SELECT 1"), true);
    assert.equal(isReadOnlySql("WITH x AS (SELECT 1) SELECT * FROM x"), true);
    assert.equal(isReadOnlySql("SHOW TABLES"), true);
  });

  it("rejects writes and multi-statements", () => {
    assert.equal(isWriteSql("DELETE FROM t"), true);
    assert.equal(isReadOnlySql("DELETE FROM t"), false);
    assert.equal(isReadOnlySql("SELECT 1; DROP TABLE t"), false);
    assert.equal(isWriteSql("OPTIMIZE TABLE t"), true);
  });

  it("ignores leading comments", () => {
    assert.equal(isReadOnlySql("-- note\nSELECT 1"), true);
    assert.equal(isReadOnlySql("/* block */ INSERT INTO t VALUES (1)"), false);
  });

  it("reports the verb", () => {
    assert.equal(sqlVerb("  select * from t"), "SELECT");
    assert.equal(sqlVerb("Insert into t values (1)"), "INSERT");
  });
});
