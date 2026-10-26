import { expect, test } from "vitest";
import { nextCodeRunStatus } from "./state-machine";

test("queued can only move to running", () => {
  expect(nextCodeRunStatus("queued", "running")).toBe("running");
  expect(() => nextCodeRunStatus("queued", "succeeded")).toThrow(
    /illegal code run transition: queued -> succeeded/,
  );
  expect(() => nextCodeRunStatus("queued", "failed")).toThrow(
    /illegal code run transition/,
  );
  expect(() => nextCodeRunStatus("queued", "timed_out")).toThrow(
    /illegal code run transition/,
  );
});

test("running ends as succeeded, failed, or timed_out", () => {
  expect(nextCodeRunStatus("running", "succeeded")).toBe("succeeded");
  expect(nextCodeRunStatus("running", "failed")).toBe("failed");
  expect(nextCodeRunStatus("running", "timed_out")).toBe("timed_out");
  expect(() => nextCodeRunStatus("running", "queued")).toThrow(
    /illegal code run transition: running -> queued/,
  );
});

test("terminal statuses do not move again", () => {
  for (const status of ["succeeded", "failed", "timed_out"] as const) {
    expect(() => nextCodeRunStatus(status, "running")).toThrow(
      /illegal code run transition/,
    );
    expect(() => nextCodeRunStatus(status, "succeeded")).toThrow(
      /illegal code run transition/,
    );
  }
});
