import { basename } from "node:path";

import YAML from "yaml";

export const SKILL_SPEC_NAME = "agentskills.io/skill-spec/1";
export const SKILL_SPEC_MAX_NAME_LENGTH = 64;
export const SKILL_SPEC_MAX_DESCRIPTION_LENGTH = 1024;
export const SKILL_SPEC_MAX_COMPATIBILITY_LENGTH = 500;
export const SKILL_SPEC_CONVENTIONAL_DIRS = Object.freeze(["assets", "references", "scripts"]);
export const SKILL_SPEC_RECOGNIZED_FIELDS = Object.freeze([
  "allowed-tools",
  "compatibility",
  "description",
  "license",
  "metadata",
  "name",
]);

export const SKILL_SPEC_DEFAULT_LICENSE = "Apache-2.0";

// Returns the parsed SKILL.md frontmatter mapping, or null when the file has
// no readable frontmatter block. Used by lint rules that need field values
// (e.g. description) without re-running full spec validation.
export function parseSkillFrontmatterFields(content: any) {
  if (typeof content !== "string") {
    return null;
  }
  const normalized = content.replace(/\r\n/g, "\n");
  const match = normalized.match(/^---\n([\s\S]*?)\n---\n?/);
  if (!match) {
    return null;
  }
  let fields;
  try {
    fields = YAML.parse(match[1], { uniqueKeys: true, strict: true });
  } catch {
    return null;
  }
  if (fields === null || typeof fields !== "object" || Array.isArray(fields)) {
    return null;
  }
  return fields;
}

const SKILL_NAME_PATTERN = /^[a-z0-9-]+$/;
const CONTROL_CHAR_PATTERN = new RegExp("[\\u0000-\\u001f\\u007f-\\u009f]");

function listSkillSpecErrors(content: any, dirName: any) {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (typeof content !== "string" || content.trim().length === 0) {
    errors.push("SKILL.md is empty or unreadable");
    return { errors, warnings, fields: null };
  }

  const normalized = content.replace(/\r\n/g, "\n");
  const frontmatterMatch = normalized.match(/^---\n([\s\S]*?)\n---\n?/);
  if (!frontmatterMatch) {
    errors.push("SKILL.md must start with a YAML frontmatter block fenced by --- markers");
    return { errors, warnings, fields: null };
  }

  let fields;
  try {
    fields = YAML.parse(frontmatterMatch[1], { uniqueKeys: true, strict: true });
  } catch (error) {
    errors.push(`frontmatter YAML is invalid or contains duplicate keys: ${error instanceof Error ? error.message : String(error)}`);
    return { errors, warnings, fields: null };
  }

  if (fields === null || typeof fields !== "object" || Array.isArray(fields)) {
    errors.push("frontmatter must be a YAML mapping of spec fields");
    return { errors, warnings, fields: null };
  }

  for (const key of Object.keys(fields)) {
    if (SKILL_SPEC_RECOGNIZED_FIELDS.includes(key)) {
      continue;
    }
    const lowered = String(key).toLowerCase();
    if (SKILL_SPEC_RECOGNIZED_FIELDS.includes(lowered)) {
      errors.push(`field "${key}" uses wrong casing; recognized fields are lowercase (${lowered})`);
    } else {
      warnings.push(`unknown frontmatter field "${key}" ignored for forward compatibility`);
    }
  }

  const name = fields.name;
  if (name === undefined || name === null || name === "") {
    errors.push('required field "name" is missing');
  } else if (typeof name !== "string") {
    errors.push('field "name" must be a string');
  } else {
    if (name.length > SKILL_SPEC_MAX_NAME_LENGTH) {
      errors.push(`field "name" exceeds ${SKILL_SPEC_MAX_NAME_LENGTH} characters (${name.length})`);
    }
    if (!SKILL_NAME_PATTERN.test(name)) {
      errors.push('field "name" must use lowercase letters, digits, and hyphens only');
    }
    if (name.startsWith("-") || name.endsWith("-")) {
      errors.push('field "name" must not start or end with a hyphen');
    }
    if (name.includes("--")) {
      errors.push('field "name" must not contain consecutive hyphens');
    }
    if (CONTROL_CHAR_PATTERN.test(name)) {
      errors.push('field "name" contains terminal control characters');
    }
    if (typeof dirName === "string" && dirName.length > 0 && basename(dirName) !== name) {
      errors.push(`field "name" (${name}) must match the parent directory name (${basename(dirName)})`);
    }
  }

  const description = fields.description;
  if (description === undefined || description === null || String(description).trim() === "") {
    errors.push('required field "description" is missing or empty');
  } else if (typeof description !== "string") {
    errors.push('field "description" must be a string');
  } else {
    if (description.length > SKILL_SPEC_MAX_DESCRIPTION_LENGTH) {
      errors.push(
        `field "description" exceeds ${SKILL_SPEC_MAX_DESCRIPTION_LENGTH} characters (${description.length})`,
      );
    }
    if (CONTROL_CHAR_PATTERN.test(description)) {
      errors.push('field "description" contains terminal control characters');
    }
  }

  const license = fields.license;
  if (license !== undefined && license !== null && typeof license !== "string") {
    errors.push('optional field "license" must be a string when present');
  }

  const compatibility = fields.compatibility;
  if (compatibility !== undefined && compatibility !== null) {
    if (typeof compatibility !== "string") {
      errors.push('optional field "compatibility" must be a string when present');
    } else if (compatibility.length > SKILL_SPEC_MAX_COMPATIBILITY_LENGTH) {
      errors.push(
        `field "compatibility" exceeds ${SKILL_SPEC_MAX_COMPATIBILITY_LENGTH} characters (${compatibility.length})`,
      );
    }
  }

  const metadata = fields.metadata;
  if (metadata !== undefined && metadata !== null) {
    if (typeof metadata !== "object" || Array.isArray(metadata)) {
      errors.push('optional field "metadata" must be a mapping of string keys to string values');
    } else {
      for (const [key, value] of Object.entries(metadata)) {
        if (typeof key !== "string" || typeof value !== "string") {
          errors.push(`field "metadata.${String(key)}" must map a string key to a string value`);
        }
      }
    }
  }

  const allowedTools = fields["allowed-tools"];
  if (allowedTools !== undefined && allowedTools !== null) {
    if (typeof allowedTools !== "string") {
      errors.push('optional field "allowed-tools" must be a space-separated string when present');
    } else {
      warnings.push('field "allowed-tools" is experimental; runtime semantics differ across runtimes');
    }
  }

  for (const optionalField of ["license", "compatibility", "metadata"]) {
    if (fields[optionalField] === undefined || fields[optionalField] === null) {
      warnings.push(`optional field "${optionalField}" is not set`);
    }
  }

  return { errors, warnings, fields };
}

export function validateSkillSpec({ content, dirName = null }: { content?: any; dirName?: any }) {
  const { errors, warnings, fields } = listSkillSpecErrors(content, dirName);
  return {
    ok: errors.length === 0,
    spec: SKILL_SPEC_NAME,
    errors: [...errors].sort(),
    warnings: [...warnings].sort(),
    recognized_fields: fields === null ? [] : Object.keys(fields).sort(),
  };
}

function skillSpecCompatibilityLine(ir: any) {
  const ranges = Object.entries<Record<string, { semver_range: string }>>(ir.runtime_support ?? {})
    .map(([runtime, support]) => `${runtime}${support.semver_range}`)
    .sort();
  return `requires ${ranges.join(", ")}`;
}

export function buildSkillFrontmatterAdditions(ir: any) {
  const compatibility = skillSpecCompatibilityLine(ir).slice(
    0,
    SKILL_SPEC_MAX_COMPATIBILITY_LENGTH,
  );
  return {
    license: SKILL_SPEC_DEFAULT_LICENSE,
    compatibility,
    metadata: {
      pack_id: ir.pack.id,
      pack_version: String(ir.pack.version),
      workflow_class: String(ir.pack.workflow_class),
      canonical_entrypoint: String(ir.pack.canonical_entrypoint),
      implicit_invocation: String(ir.pack.implicit_invocation),
      release_channel: String(ir.pack.release_channel),
      provenance: `pairslash-compiler@${ir.compiler_version}`,
    },
  };
}

export function enrichSkillFrontmatter({ content, ir }: { content?: any; ir?: any }) {
  const normalized = String(content ?? "").replace(/\r\n/g, "\n");
  const match = normalized.match(/^---\n([\s\S]*?)\n---\n?/);
  if (!match) {
    return String(content ?? "");
  }
  let fields;
  try {
    fields = YAML.parse(match[1], { uniqueKeys: true, strict: true });
  } catch {
    return String(content ?? "");
  }
  if (fields === null || typeof fields !== "object" || Array.isArray(fields)) {
    return String(content ?? "");
  }

  const additions: Record<string, any> = buildSkillFrontmatterAdditions(ir);
  const injected: any[] = [];
  for (const key of ["license", "compatibility"]) {
    if (fields[key] === undefined || fields[key] === null) {
      injected.push(`${key}: ${JSON.stringify(additions[key])}`);
    }
  }
  // A second `metadata:` key would duplicate an existing one (invalid YAML),
  // so injection only happens when the field is entirely absent.
  if (fields.metadata === undefined || fields.metadata === null) {
    const metadataKeys = Object.keys(additions.metadata).sort();
    injected.push(
      [
        "metadata:",
        ...metadataKeys.map(
          (key: string) => `  ${key}: ${JSON.stringify(String(additions.metadata[key]))}`,
        ),
      ].join("\n"),
    );
  }

  if (injected.length === 0) {
    return String(content ?? "");
  }
  const frontmatter = `${match[1]}\n${injected.join("\n")}`;
  return `---\n${frontmatter}\n---\n${normalized.slice(match[0].length)}`;
}
