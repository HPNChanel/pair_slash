function buildGlobalMemoryLookup(globalMemoryRecords = []) {
  const lookup = new Map();
  for (const record of globalMemoryRecords) {
    if (!record || typeof record !== "object") {
      continue;
    }
    if (typeof record.key !== "string" || record.key.trim() === "") {
      continue;
    }
    lookup.set(record.key, {
      value: record.value ?? null,
      source_path: record.source_path ?? null,
    });
  }
  return lookup;
}

export function resolveRetrievedFactAgainstGlobalMemory({
  factKey,
  retrievedValue,
  globalMemoryRecords = [],
} = {}) {
  if (typeof factKey !== "string" || factKey.trim() === "") {
    throw new Error("factKey is required");
  }

  const lookup = buildGlobalMemoryLookup(globalMemoryRecords);
  const globalRecord = lookup.get(factKey);

  if (!globalRecord) {
    return {
      fact_key: factKey,
      conflict: false,
      status: "no-global-truth",
      winner: "retrieved",
      effective_value: retrievedValue ?? null,
      retrieved_value: retrievedValue ?? null,
      global_value: null,
      authoritative_source: null,
    };
  }

  const globalValue = globalRecord.value ?? null;
  const retrieved = retrievedValue ?? null;
  const conflict = globalValue !== retrieved;

  return {
    fact_key: factKey,
    conflict,
    status: conflict ? "conflict" : "consistent",
    winner: "global_memory",
    effective_value: globalValue,
    retrieved_value: retrieved,
    global_value: globalValue,
    authoritative_source: "global_project_memory",
    global_source_path: globalRecord.source_path,
  };
}

export function resolveRetrievedFacts({
  retrievedFacts = [],
  globalMemoryRecords = [],
} = {}) {
  const results = [];
  for (const fact of retrievedFacts) {
    if (!fact || typeof fact !== "object") {
      continue;
    }
    if (typeof fact.key !== "string" || fact.key.trim() === "") {
      continue;
    }
    results.push(
      resolveRetrievedFactAgainstGlobalMemory({
        factKey: fact.key,
        retrievedValue: fact.value ?? null,
        globalMemoryRecords,
      }),
    );
  }
  return results;
}
