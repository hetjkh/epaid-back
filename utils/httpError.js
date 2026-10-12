class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

/** Sends client errors (4xx) as-is; hides details of unexpected server errors. */
function sendError(res, error, fallbackMessage) {
  if (error instanceof HttpError && error.status < 500) {
    return res.status(error.status).json({ message: error.message });
  }
  return res.status(500).json({ message: fallbackMessage });
}

module.exports = { HttpError, sendError };
