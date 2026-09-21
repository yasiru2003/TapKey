<<<<<<< HEAD
export class InvalidPinPatternError extends Error {
  constructor() {
    super("Invalid shifted PIN pattern");
    this.name = "InvalidPinPatternError";
=======
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
>>>>>>> 5382501e8c22ef80dc1321e6f6ccce8ea6408a50
  }
}