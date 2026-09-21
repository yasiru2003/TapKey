export class InvalidPinPatternError extends Error {
  constructor() {
    super("Invalid shifted PIN pattern");
    this.name = "InvalidPinPatternError";
  }
}