/** GET /api/session — sessiya hali amal qiladimi? Admin panel sahifa ochilganda so'raydi. */
import { env, json, readCookie, verifyToken, COOKIE } from "./_lib.js";

export default async function handler(req, res) {
  const secret = env("SESSION_SECRET");
  const configured = Boolean(env("ADMIN_PASSWORD") && secret && env("GITHUB_TOKEN"));
  const auth = Boolean(secret && verifyToken(readCookie(req, COOKIE), secret));
  return json(res, 200, { ok: true, auth, configured });
}
