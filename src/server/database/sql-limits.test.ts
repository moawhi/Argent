import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { applySqlRowLimits } from "./sql-limits";

describe("applySqlRowLimits", () => {
  it("appends LIMIT when missing", () => {
    assert.equal(
      applySqlRowLimits("SELECT * FROM orders", 25),
      "SELECT * FROM orders LIMIT 25",
    );
  });

  it("appends OFFSET when needed", () => {
    assert.equal(
      applySqlRowLimits("SELECT * FROM orders", 25, 50),
      "SELECT * FROM orders LIMIT 25 OFFSET 50",
    );
  });

  it("leaves existing LIMIT alone", () => {
    assert.equal(
      applySqlRowLimits("SELECT * FROM orders LIMIT $1", 25, 50),
      "SELECT * FROM orders LIMIT $1 OFFSET 50",
    );
  });

  it("does not duplicate OFFSET", () => {
    assert.equal(
      applySqlRowLimits("SELECT * FROM orders LIMIT 10 OFFSET 5", 25, 50),
      "SELECT * FROM orders LIMIT 10 OFFSET 5",
    );
  });
});
