import test from "node:test";
import assert from "node:assert/strict";

import { healthcheck } from "../src/server.js";

test("node service fixture stays healthy", () => {
  assert.equal(healthcheck().status, "ok");
});
