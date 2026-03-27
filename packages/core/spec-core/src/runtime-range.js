const SEMVER_PATTERN = /^(\d+)\.(\d+)\.(\d+)$/;
const RANGE_PATTERN = /^(>=)?\s*(\d+\.\d+\.\d+)$/;

function parseSemver(value) {
  const match = typeof value === "string" ? value.trim().match(SEMVER_PATTERN) : null;
  if (!match) {
    return null;
  }
  return match.slice(1).map((item) => Number.parseInt(item, 10));
}

export function compareSemver(left, right) {
  for (let index = 0; index < 3; index += 1) {
    const delta = left[index] - right[index];
    if (delta !== 0) {
      return delta;
    }
  }
  return 0;
}

export function parseRuntimeRange(range) {
  if (typeof range !== "string") {
    return null;
  }
  const match = range.trim().match(RANGE_PATTERN);
  if (!match) {
    return null;
  }
  const version = parseSemver(match[2]);
  if (!version) {
    return null;
  }
  return {
    operator: match[1] ? ">=" : "=",
    version,
    normalized: `${match[1] ? ">=" : ""}${match[2]}`,
  };
}

export function validateRuntimeRange(range) {
  return Boolean(parseRuntimeRange(range));
}

export function satisfiesRuntimeRange(detectedVersion, range) {
  const parsedRange = parseRuntimeRange(range);
  const parsedDetected = parseSemver(detectedVersion);
  if (!parsedRange) {
    return false;
  }
  if (!parsedDetected) {
    return parsedRange.normalized === ">=0.0.0";
  }
  if (parsedRange.operator === ">=") {
    return compareSemver(parsedDetected, parsedRange.version) >= 0;
  }
  return compareSemver(parsedDetected, parsedRange.version) === 0;
}

export function normalizeRuntimeRange(range) {
  const parsed = parseRuntimeRange(range);
  return parsed?.normalized ?? null;
}
