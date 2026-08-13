/** Error raised by the browser capability. @module dsh-browser/error */

/**
 * Open-coded error in the style of {@link WebError} and {@link LlmError}.
 * Consumers must tolerate unknown codes.
 */
export class BrowserError extends Error {
  constructor(
    readonly code: string,
    message: string,
    options?: { cause?: unknown },
  ) {
    super(message, options)
    this.name = 'BrowserError'
  }
}
