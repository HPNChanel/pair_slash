export class ContractEngineError extends Error {
  declare code: any;
  declare details: any;
  constructor(code, message, details = {}) {
    super(message);
    this.name = "ContractEngineError";
    this.code = code;
    this.details = details;
  }
}

export function ensure(condition, code, message, details = {}) {
  if (!condition) {
    throw new ContractEngineError(code, message, details);
  }
}
