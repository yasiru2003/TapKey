import { captureTapPattern } from "../src/client/captureTapPattern.js";
import type { ShiftedPinPattern } from "../src/shared/types.js";

const USER_ID = "demo-user";
const captureArea = document.querySelector<HTMLButtonElement>("#capture-area");
const progress = document.querySelector<HTMLSpanElement>("#progress");
const focusState = document.querySelector<HTMLSpanElement>("#focus-state");
const status = document.querySelector<HTMLDivElement>("#status");
const enrollButton = document.querySelector<HTMLButtonElement>("#enroll-button");
const verifyButton = document.querySelector<HTMLButtonElement>("#verify-button");
const resetButton = document.querySelector<HTMLButtonElement>("#reset-button");

if (!captureArea || !progress || !focusState || !status || !enrollButton || !verifyButton || !resetButton) {
  throw new Error("Demo UI is incomplete");
}

let capture: ReturnType<typeof captureTapPattern>;
let candidate: ShiftedPinPattern | undefined;

function setStatus(message: string, kind: "neutral" | "error" | "success" = "neutral"): void {
  status.textContent = message;
  status.dataset.kind = kind;
}

function updateProgressText(index: number): void {
  const safeIndex = Math.min(4, Math.max(1, index));
  progress.textContent = `Digit ${safeIndex} of 4`;
}

function resetCapture(): void {
  capture?.reset();
  candidate = undefined;
  enrollButton.disabled = true;
  verifyButton.disabled = true;
  setStatus("Enter first digit.");
  progress.textContent = "Digit 1 of 4";
}

function attachCapture(): void {
  capture?.detach();
  candidate = undefined;
  enrollButton.disabled = true;
  verifyButton.disabled = true;
  capture = captureTapPattern(captureArea, {
    onDigitPrompt: (message) => {
      setStatus(message);
      const currentDigitIndex = message.includes("first") ? 1 : message.includes("second") ? 2 : message.includes("third") ? 3 : message.includes("fourth") ? 4 : 1;
      updateProgressText(currentDigitIndex);
    },
    onDigitRecorded: (digitIndex) => {
      updateProgressText(Math.min(digitIndex, 4));
    },
    onPatternReady: (pattern) => {
      candidate = pattern;
      enrollButton.disabled = false;
      verifyButton.disabled = false;
      progress.textContent = "4 digits recorded";
      setStatus("PIN ready for verification.");
    },
    onReset: () => {
      candidate = undefined;
      enrollButton.disabled = true;
      verifyButton.disabled = true;
      focusState.textContent = "Ready when you are";
    },
    onValidationError: (error) => {
      setStatus(error.message, "error");
      if (error.message.includes("Too many taps")) {
        progress.textContent = "Digit rejected";
      }
    },
  });
}

async function enrollCurrentPattern(): Promise<void> {
  if (!candidate) {
    setStatus("Capture a complete PIN before enrolling.", "error");
    return;
  }

  try {
    const response = await fetch("/api/demo/enroll", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: USER_ID, candidate }),
    });
    if (!response.ok) throw new Error("Enrollment failed");
    const result: { success: boolean } = await response.json();
    setStatus(result.success ? "PIN enrolled successfully." : "PIN enrollment failed.", result.success ? "success" : "error");
  } catch {
    setStatus("PIN enrollment failed.", "error");
  }
}

async function verifyCurrentPattern(): Promise<void> {
  if (!candidate) {
    setStatus("Capture a complete PIN before verifying.", "error");
    return;
  }

  try {
    const response = await fetch("/api/demo/verify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: USER_ID, candidate }),
    });
    const result: { success: boolean } = await response.json();
    if (response.ok && result.success) {
      setStatus("Factor 2 verification PASSED.", "success");
      progress.textContent = "Factor 2 passed";
      return;
    }
    setStatus("Factor 2 verification FAILED.", "error");
  } catch {
    setStatus("Factor 2 verification FAILED.", "error");
  }
}

captureArea.addEventListener("focus", () => { focusState.textContent = "Tactile input active"; });
captureArea.addEventListener("blur", () => { focusState.textContent = "Click to reactivate tactile input"; });
resetButton.addEventListener("click", resetCapture);
enrollButton.addEventListener("click", () => { void enrollCurrentPattern(); });
verifyButton.addEventListener("click", () => { void verifyCurrentPattern(); });

attachCapture();
resetCapture();