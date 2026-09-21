export class InvalidCountPatternError extends Error {
  constructor() {
    super("Invalid count pattern");
    this.name = "InvalidCountPatternError";
  }
}

export class InvalidRhythmPatternError extends Error {
  constructor() {
    super("Invalid rhythm pattern");
    this.name = "InvalidRhythmPatternError";
  }
}

export class AmbiguousRhythmError extends InvalidRhythmPatternError {
  constructor() {
    super();
    this.name = "AmbiguousRhythmError";
  }
}