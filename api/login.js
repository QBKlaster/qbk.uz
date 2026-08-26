/**
 * POST /api/login   { password: "..." }
 * Parol serverda (ADMIN_PASSWORD) tekshiriladi va HttpOnly cookie beriladi.
 * Parol hech qachon admin.html ichida saqlanmaydi.
 */
import crypto from "node:crypto";
import { env, json, makeToken, setSessionCookie } from "./_lib.js";

const HOURS = 8;
const attempts = new Map(); // IP -> {n, until} — sovuq start'da tozalanadi (oddiy himoya)

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const sha256 = (s) => crypto.createHash("sha256").update(String(s), "utf8").digest();

function clientIp(req) {
  return (req.headers["x-forwarded-for"] || "").split(",")[0].trim() || req.socket?.remoteAddress || "unknown";
}

export default async function handler(req, res) {
  if (req.method !== "POST") return json(res, 405, { ok: false, error: "Faqat POST." });

  const pass = env("ADMIN_PASSWORD");
  const secret = env("SESSION_SECRET");
  if (!pass || !secret) {
    return json(res, 500, {
      ok: false,
      error: "Serverda ADMIN_PASSWORD yoki SESSION_SECRET sozlanmagan. Vercel → Settings → Environment Variables."
    });
  }

  const ip = clientIp(req);
  const rec = attempts.get(ip);
  if (rec && rec.until > Date.now()) {
    return json(res, 429, { ok: false, error: "Juda ko'p urinish. Bir necha daqiqadan keyin qayta urining." });
  }

  let body = req.body;
  if (typeof body === "string") { try { body = JSON.parse(body); } catch { body = {}; } }
  const given = (body && body.password) || "";

  const a = sha256(given), b = sha256(pass);
  const okPass = a.length === b.length && crypto.timingSafeEqual(a, b);

  if (!okPass) {
    const n = (rec?.n || 0) + 1;
    attempts.set(ip, { n, until: n >= 6 ? Date.now() + 5 * 60 * 1000 : 0 });
    await sleep(600); // brute-force'ni sekinlashtirish
    return json(res, 401, { ok: false, error: "Parol noto'g'ri." });
  }

  attempts.delete(ip);
  setSessionCookie(res, makeToken(secret, HOURS), HOURS * 3600);
  return json(res, 200, { ok: true, hours: HOURS });
}
