export class ContractEngineError extends Error {
  declare code: any;
  declare details: any;
  constructor(code: string, message: string, details: any = {}) {
    super(message);
    this.name = "ContractEngineError";
    this.code = code;
    this.details = details;
  }
}

export function ensure(condition: any, code: string, message: string, details: any = {}) {
  if (!condition) {
    throw new ContractEngineError(code, message, details);
  }
}
