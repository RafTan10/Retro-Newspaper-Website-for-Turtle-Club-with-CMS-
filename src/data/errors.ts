/** Someone else saved the issue after it was opened here */
export class ConflictError extends Error {
  constructor() {
    super("Someone else changed this issue. Reload to see their changes.");
  }
}

/** A read or write failed; the message says what happened and what to do */
export class DataError extends Error {}

/** Thrown when the page lost its editor session or the account isn't an editor */
export class NotAllowedError extends Error {
  constructor(message = "You're signed out. Sign in again to keep editing.") {
    super(message);
  }
}
