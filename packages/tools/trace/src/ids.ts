import { randomUUID } from "node:crypto";

function compactTimestamp(value: Date = new Date()) {
  return value.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
}

export function createOpaqueId(prefix: string, now: Date = new Date()) {
  return `${prefix}-${compactTimestamp(now)}-${randomUUID().slice(0, 8)}`;
}

export function createSessionId(now: any = new Date()) {
  return createOpaqueId("sess", now);
}

export function createWorkflowId(now: any = new Date()) {
  return createOpaqueId("wf", now);
}

export function createCorrelationId(now: any = new Date()) {
  return createOpaqueId("corr", now);
}

export function createEventId(now: any = new Date()) {
  return createOpaqueId("evt", now);
}

export function createBundleId(now: any = new Date()) {
  return createOpaqueId("bundle", now);
}

