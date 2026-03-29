import { randomUUID } from "node:crypto";

function compactTimestamp(value = new Date()) {
  return value.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
}

export function createOpaqueId(prefix, now = new Date()) {
  return `${prefix}-${compactTimestamp(now)}-${randomUUID().slice(0, 8)}`;
}

export function createSessionId(now = new Date()) {
  return createOpaqueId("sess", now);
}

export function createWorkflowId(now = new Date()) {
  return createOpaqueId("wf", now);
}

export function createCorrelationId(now = new Date()) {
  return createOpaqueId("corr", now);
}

export function createEventId(now = new Date()) {
  return createOpaqueId("evt", now);
}

export function createBundleId(now = new Date()) {
  return createOpaqueId("bundle", now);
}

