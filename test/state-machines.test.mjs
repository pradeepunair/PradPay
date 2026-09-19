import assert from "node:assert/strict";
import test from "node:test";

import {
  canTransition,
  transitionState,
  transitionTables,
} from "../lib/domain/state-machines.mjs";

test("keeps run, checkout, mandate, attempt, order, and webhook states separate", () => {
  assert.deepEqual(Object.keys(transitionTables).sort(), [
    "attempt",
    "checkout",
    "mandate",
    "order",
    "run",
    "webhook",
  ]);
});

test("transition policy cannot be mutated by consumers", () => {
  assert.equal(Object.isFrozen(transitionTables.run.queued), true);
  assert.throws(() => transitionTables.run.queued.push("succeeded"), TypeError);
  assert.equal(canTransition("run", "queued", "succeeded"), false);
});

test("permits documented forward transitions", () => {
  assert.equal(transitionState("run", "queued", "running"), "running");
  assert.equal(transitionState("checkout", "ready", "completing"), "completing");
  assert.equal(transitionState("mandate", "active", "reserved"), "reserved");
  assert.equal(transitionState("attempt", "submitted", "unknown"), "unknown");
  assert.equal(transitionState("order", "pending_payment", "confirmed"), "confirmed");
  assert.equal(transitionState("webhook", "verified", "applied"), "applied");
});

test("fails closed on illegal or regressive transitions", () => {
  assert.equal(canTransition("order", "confirmed", "pending_payment"), false);
  assert.throws(
    () => transitionState("mandate", "consumed", "active"),
    /Illegal mandate transition/,
  );
  assert.throws(() => transitionState("unknown", "a", "b"), /Unknown state machine/);
});
