/**
 * POST /api/order   { name, phone, product, volume, message, lang, t }
 *
 * Saytdagi buyurtma formasi shu manzilga yuboradi va xabar Telegramga tushadi.
 *
 * Kerakli Environment Variables (Vercel):
 *   TELEGRAM_BOT_TOKEN  — @BotFather bergan token
 *   TELEGRAM_CHAT_ID    — sizning ID raqamingiz (bir nechtasi vergul bilan)
 *
 * Token faqat serverda turadi, brauzerga hech qachon yuborilmaydi.
 */
import { env, json } from "./_lib.js";

const MAX = { name: 120, phone: 40, product: 160, volume: 120, message: 2000 };
const LIMIT_PER_HOUR = 12;
const hits = new Map();

const clean = (v, max) => String(v ?? "").replace(/\s+/g, " ").trim().slice(0, max);
const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

function ip(req) {
  return (req.headers["x-forwarded-for"] || "").split(",")[0].trim() || req.socket?.remoteAddress || "unknown";
}

function rateLimited(key) {
  const now = Date.now();
  const list = (hits.get(key) || []).filter((t) => now - t < 3600e3);
  list.push(now);
  hits.set(key, list);
  if (hits.size > 500) hits.clear();
  return list.length > LIMIT_PER_HOUR;
}

async function sendTelegram(text) {
  const token = env("TELEGRAM_BOT_TOKEN");
  const chat = env("TELEGRAM_CHAT_ID");
  if (!token || !chat) return { ok: false, skipped: true };
  const chats = chat.split(",").map((c) => c.trim()).filter(Boolean);
  let anyOk = false, lastErr = "";
  for (const c of chats) {
    try {
      const r = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chat_id: c, text, parse_mode: "HTML", disable_web_page_preview: true })
      });
      const j = await r.json().catch(() => ({}));
      if (r.ok && j.ok) anyOk = true; else lastErr = j.description || `HTTP ${r.status}`;
    } catch (e) { lastErr = String(e.message || e); }
  }
  return { ok: anyOk, error: lastErr };
}

export default async function handler(req, res) {
  if (req.method !== "POST") return json(res, 405, { ok: false, error: "Faqat POST." });

  let body = req.body;
  if (typeof body === "string") { try { body = JSON.parse(body); } catch { body = null; } }
  if (!body) return json(res, 400, { ok: false, error: "Ma'lumot yuborilmadi." });

  const name = clean(body.name, MAX.name);
  const phone = clean(body.phone, MAX.phone);
  const product = clean(body.product, MAX.product);
  const volume = clean(body.volume, MAX.volume);
  const message = String(body.message ?? "").trim().slice(0, MAX.message);
  const lang = ["uz", "ru", "en"].includes(body.lang) ? body.lang : "uz";

  if (!name || !phone) return json(res, 400, { ok: false, error: "Ism va telefon to'ldirilishi shart." });
  if ((phone.match(/\d/g) || []).length < 7) return json(res, 400, { ok: false, error: "Telefon raqami noto'g'ri." });
  if (body.hp) return json(res, 200, { ok: true });
  if (Number(body.t) && Number(body.t) < 2500) return json(res, 200, { ok: true });

  if (rateLimited(ip(req))) {
    return json(res, 429, { ok: false, error: "Juda ko'p so'rov yuborildi. Bir ozdan keyin urinib ko'ring." });
  }

  const when = new Date().toLocaleString("uz-UZ", { timeZone: "Asia/Tashkent" });
  const text =
    "🧾 <b>Saytdan yangi buyurtma</b>\n\n" +
    `👤 <b>${esc(name)}</b>\n` +
    `📞 <a href="tel:${esc(phone.replace(/[^\d+]/g, ""))}">${esc(phone)}</a>\n` +
    (product ? `📦 ${esc(product)}\n` : "") +
    (volume ? `📐 ${esc(volume)}\n` : "") +
    (message ? `\n💬 ${esc(message)}\n` : "") +
    `\n🌐 ${lang.toUpperCase()} · 🕒 ${esc(when)}`;

  const tg = await sendTelegram(text);

  if (tg.ok) return json(res, 200, { ok: true });
  if (tg.skipped) return json(res, 500, { ok: false, error: "Telegram sozlanmagan (env)." });
  return json(res, 502, { ok: false, error: `Telegramga yuborib bo'lmadi: ${tg.error}` });
}
