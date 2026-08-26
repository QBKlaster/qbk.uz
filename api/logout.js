/** POST /api/logout — sessiyani o'chiradi. */
import { json, clearSessionCookie } from "./_lib.js";

export default async function handler(req, res) {
  clearSessionCookie(res);
  return json(res, 200, { ok: true });
}
