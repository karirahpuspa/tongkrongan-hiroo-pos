// Format respons seragam: { success: true, data } atau { success: false, message }
export const ok = (res, data = null, status = 200) =>
  res.status(status).json({ success: true, data });

export const fail = (res, status, message) =>
  res.status(status).json({ success: false, message });

export class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

// Bungkus handler async agar error masuk ke error handler Express
export const asyncHandler = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);
