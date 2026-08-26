/**
 * Umumiy server yordamchilari.
 * Fayl nomi "_" bilan boshlangani uchun Vercel buni alohida API manzil sifatida ochmaydi.
 * Bu yerdagi kod FAQAT serverda ishlaydi — token hech qachon brauzerga chiqmaydi.
 */
import crypto from "node:crypto";

export const COOKIE = "qbk_session";

export function env(name, fallback = undefined) {
  const v = process.env[name];
  return v === undefined || v === "" ? fallback : v;
}

export function json(res, status, obj) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.end(JSON.stringify(obj));
}

/* ---------- sessiya tokeni (HMAC bilan imzolangan) ---------- */

function b64url(buf) {
  return Buffer.from(buf).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
function fromB64url(s) {
  return Buffer.from(String(s).replace(/-/g, "+").replace(/_/g, "/"), "base64");
}

export function makeToken(secret, hours = 8) {
  const payload = { exp: Date.now() + hours * 3600 * 1000, v: 1 };
  const body = b64url(JSON.stringify(payload));
  const sig = b64url(crypto.createHmac("sha256", secret).update(body).digest());
  return `${body}.${sig}`;
}

export function verifyToken(token, secret) {
  if (!token || typeof token !== "string" || !secret) return false;
  const [body, sig] = token.split(".");
  if (!body || !sig) return false;
  const expected = crypto.createHmac("sha256", secret).update(body).digest();
  const got = fromB64url(sig);
  if (got.length !== expected.length || !crypto.timingSafeEqual(got, expected)) return false;
  try {
    const payload = JSON.parse(fromB64url(body).toString("utf8"));
    return typeof payload.exp === "number" && payload.exp > Date.now();
  } catch {
    return false;
  }
}

export function readCookie(req, name) {
  const raw = req.headers.cookie || "";
  for (const part of raw.split(";")) {
    const i = part.indexOf("=");
    if (i < 0) continue;
    if (part.slice(0, i).trim() === name) return decodeURIComponent(part.slice(i + 1).trim());
  }
  return null;
}

export function setSessionCookie(res, token, maxAgeSec) {
  const bits = [
    `${COOKIE}=${token}`,
    "Path=/",
    "HttpOnly",            // JavaScript o'qiy olmaydi
    "SameSite=Strict",     // boshqa saytdan so'rov yubora olmaydi
    "Secure",              // faqat https
    `Max-Age=${maxAgeSec}`
  ];
  res.setHeader("Set-Cookie", bits.join("; "));
}

export function clearSessionCookie(res) {
  res.setHeader("Set-Cookie", `${COOKIE}=; Path=/; HttpOnly; SameSite=Strict; Secure; Max-Age=0`);
}

/** Sessiya tekshiruvi. Ruxsat bo'lmasa javobni o'zi yozadi va false qaytaradi. */
export function requireAuth(req, res) {
  const secret = env("SESSION_SECRET");
  if (!secret) {
    json(res, 500, { ok: false, error: "SESSION_SECRET sozlanmagan (Vercel Environment Variables)." });
    return false;
  }
  if (!verifyToken(readCookie(req, COOKIE), secret)) {
    json(res, 401, { ok: false, error: "Sessiya tugagan yoki yo'q. Qaytadan kiring." });
    return false;
  }
  return true;
}

/* ---------- GitHub API ---------- */

export function ghConfig() {
  return {
    token: env("GITHUB_TOKEN"),
    owner: env("GITHUB_OWNER", "qbklaster"),
    repo: env("GITHUB_REPO", "qbk.uz"),
    branch: env("GITHUB_BRANCH", "main"),
    dataPath: env("DATA_PATH", "data.js"),
    imagesDir: env("IMAGES_DIR", "images").replace(/^\/+|\/+$/g, "")
  };
}

export async function gh(cfg, path, options = {}) {
  const url = `https://api.github.com${path}`;
  const res = await fetch(url, {
    ...options,
    headers: {
      Authorization: `Bearer ${cfg.token}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      "User-Agent": "qbk-admin",
      "Content-Type": "application/json",
      ...(options.headers || {})
    }
  });
  const text = await res.text();
  let body = null;
  try { body = text ? JSON.parse(text) : null; } catch { body = { raw: text }; }
  if (!res.ok) {
    const msg = (body && (body.message || body.error)) || `GitHub xatosi (${res.status})`;
    const err = new Error(msg);
    err.status = res.status;
    err.body = body;
    throw err;
  }
  return body;
}
