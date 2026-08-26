/**
 * POST /api/save-data   { data: { ...window.QBK_DATA ko'rinishidagi obyekt... } }
 *
 * Nima qiladi:
 *   1. Sessiyani tekshiradi (HttpOnly cookie).
 *   2. Ma'lumotni tozalaydi/tekshiradi (faqat ma'lum maydonlar o'tadi).
 *   3. Yangi rasmlarni (data:image/... ko'rinishidagilarni) images/ papkasiga fayl qilib chiqaradi,
 *      data.js ichida esa faqat yo'l qoladi: "images/ab12cd34ef56.webp".
 *   4. data.js + barcha yangi rasmlarni BITTA commit qilib GitHub'ga yozadi.
 *   5. Frontendga tozalangan ma'lumotni qaytaradi (rasmlar endi yo'l ko'rinishida).
 *
 * GITHUB_TOKEN faqat shu yerda — server tomonda ishlatiladi.
 */
import crypto from "node:crypto";
import { json, requireAuth, ghConfig, gh } from "./_lib.js";

/* ---------- cheklovlar ---------- */
const MAX_PRODUCTS = 300;
const MAX_TEXT = 2000;
const MAX_SPECS = 20;
const MAX_IMAGE_BYTES = 2 * 1024 * 1024;   // bitta rasm uchun 2 MB
const MAX_NEW_IMAGES = 30;                 // bitta saqlashda
const MAX_TOTAL_BYTES = 3.8 * 1024 * 1024; // Vercel so'rov tanasi ~4.5 MB
const MIME_EXT = { "image/webp": "webp", "image/jpeg": "jpg", "image/png": "png" };
const CATS = new Set(["rc", "road", "mix"]);

const str = (v, max = MAX_TEXT) => (typeof v === "string" ? v.slice(0, max) : "");

/* ---------- rasmlar ---------- */
function takeImage(value, files, cfg, errors) {
  const v = typeof value === "string" ? value.trim() : "";
  if (!v) return "";
  if (!v.startsWith("data:")) return str(v, 500);        // allaqachon yo'l yoki URL — tegmaymiz

  const m = /^data:([a-z/+-]+);base64,(.+)$/i.exec(v);
  if (!m) { errors.push("Rasm formati noto'g'ri."); return ""; }
  const mime = m[1].toLowerCase();
  const ext = MIME_EXT[mime];
  if (!ext) { errors.push(`Ruxsat etilmagan rasm turi: ${mime}`); return ""; }

  const buf = Buffer.from(m[2], "base64");
  if (!buf.length) { errors.push("Bo'sh rasm."); return ""; }
  if (buf.length > MAX_IMAGE_BYTES) { errors.push(`Rasm juda katta (${Math.round(buf.length / 1024)} KB).`); return ""; }

  // Fayl nomi = rasm mazmunining hash'i → bir xil rasm ikki marta yuklanmaydi,
  // o'zgargan rasm esa yangi nom oladi (cache muammosi bo'lmaydi).
  const hash = crypto.createHash("sha256").update(buf).digest("hex").slice(0, 16);
  const path = `${cfg.imagesDir}/${hash}.${ext}`;
  if (!files.some((f) => f.path === path)) files.push({ path, base64: buf.toString("base64"), bytes: buf.length });
  return path;
}

/* ---------- ma'lumotni tozalash ---------- */
function sanitize(input, cfg, files, errors) {
  if (!input || typeof input !== "object") { errors.push("Ma'lumot obyekt emas."); return null; }
  const products = Array.isArray(input.products) ? input.products : null;
  if (!products) { errors.push("products ro'yxati topilmadi."); return null; }
  if (products.length > MAX_PRODUCTS) { errors.push("Mahsulotlar soni juda ko'p."); return null; }

  const media = input.media && typeof input.media === "object" ? input.media : {};
  const c = input.contacts && typeof input.contacts === "object" ? input.contacts : {};
  const addr = c.addr && typeof c.addr === "object" ? c.addr : {};
  const hours = c.hours && typeof c.hours === "object" ? c.hours : {};
  const social = c.social && typeof c.social === "object" ? c.social : {};

  const out = {
    version: Number.isFinite(input.version) ? input.version : 1,
    media: {
      hero: takeImage(media.hero, files, cfg, errors),
      quarry: takeImage(media.quarry, files, cfg, errors)
    },
    contacts: {
      phone: str(c.phone, 60),
      email: str(c.email, 120),
      addr: { uz: str(addr.uz, 400), ru: str(addr.ru, 400), en: str(addr.en, 400) },
      hours: { uz: str(hours.uz, 400), ru: str(hours.ru, 400), en: str(hours.en, 400) },
      social: { fb: str(social.fb, 300), ig: str(social.ig, 300), li: str(social.li, 300), tg: str(social.tg, 300) }
    },
    products: []
  };

  const seen = new Set();
  products.forEach((p, i) => {
    if (!p || typeof p !== "object") return;
    let id = str(p.id, 64).replace(/[^\w-]/g, "") || `p${i}`;
    while (seen.has(id)) id += "x";
    seen.add(id);

    const item = {
      id,
      code: str(p.code, 40),
      cat: CATS.has(p.cat) ? p.cat : "rc",
      img: takeImage(p.img, files, cfg, errors)
    };
    for (const l of ["uz", "ru", "en"]) {
      const t = p[l] && typeof p[l] === "object" ? p[l] : {};
      item[l] = {
        n: str(t.n, 200),
        d: str(t.d, 1200),
        s: (Array.isArray(t.s) ? t.s : []).slice(0, MAX_SPECS).map((x) => str(x, 200)).filter(Boolean)
      };
    }
    if (!item.uz.n && !item.ru.n && !item.en.n) return; // nomsiz yozuvni o'tkazmaymiz
    out.products.push(item);
  });

  if (!out.products.length) errors.push("Hech bo'lmasa bitta mahsulot bo'lishi kerak.");
  if (files.length > MAX_NEW_IMAGES) errors.push(`Bir vaqtda ${MAX_NEW_IMAGES} tadan ko'p yangi rasm yuklab bo'lmaydi.`);
  return out;
}

/* ---------- GitHub'ga bitta commit ---------- */
async function commitAll(cfg, dataText, files, message) {
  const base = `/repos/${cfg.owner}/${cfg.repo}`;

  const ref = await gh(cfg, `${base}/git/ref/heads/${encodeURIComponent(cfg.branch)}`);
  const headSha = ref.object.sha;
  const headCommit = await gh(cfg, `${base}/git/commits/${headSha}`);
  const baseTree = headCommit.tree.sha;

  const tree = [];

  for (const f of files) {
    const blob = await gh(cfg, `${base}/git/blobs`, {
      method: "POST",
      body: JSON.stringify({ content: f.base64, encoding: "base64" })
    });
    tree.push({ path: f.path, mode: "100644", type: "blob", sha: blob.sha });
  }

  const dataBlob = await gh(cfg, `${base}/git/blobs`, {
    method: "POST",
    body: JSON.stringify({ content: Buffer.from(dataText, "utf8").toString("base64"), encoding: "base64" })
  });
  tree.push({ path: cfg.dataPath, mode: "100644", type: "blob", sha: dataBlob.sha });

  const newTree = await gh(cfg, `${base}/git/trees`, {
    method: "POST",
    body: JSON.stringify({ base_tree: baseTree, tree })
  });

  if (newTree.sha === baseTree) return { unchanged: true, commit: headSha };

  const commit = await gh(cfg, `${base}/git/commits`, {
    method: "POST",
    body: JSON.stringify({ message, tree: newTree.sha, parents: [headSha] })
  });

  await gh(cfg, `${base}/git/refs/heads/${encodeURIComponent(cfg.branch)}`, {
    method: "PATCH",
    body: JSON.stringify({ sha: commit.sha, force: false })
  });

  return { unchanged: false, commit: commit.sha };
}

/* ---------- handler ---------- */
export default async function handler(req, res) {
  if (req.method !== "POST") return json(res, 405, { ok: false, error: "Faqat POST." });
  if (!requireAuth(req, res)) return;

  const cfg = ghConfig();
  if (!cfg.token) {
    return json(res, 500, { ok: false, error: "GITHUB_TOKEN sozlanmagan (Vercel → Settings → Environment Variables)." });
  }

  let body = req.body;
  if (typeof body === "string") { try { body = JSON.parse(body); } catch { body = null; } }
  if (!body || !body.data) return json(res, 400, { ok: false, error: "Ma'lumot yuborilmadi." });

  const files = [];
  const errors = [];
  const clean = sanitize(body.data, cfg, files, errors);
  if (!clean || errors.length) {
    return json(res, 400, { ok: false, error: errors[0] || "Ma'lumot noto'g'ri.", errors });
  }

  const totalBytes = files.reduce((s, f) => s + f.bytes, 0);
  if (totalBytes > MAX_TOTAL_BYTES) {
    return json(res, 413, {
      ok: false,
      error: "Yangi rasmlar hajmi juda katta. Rasmlarni bo'lib-bo'lib saqlang (bir necha marta 'Saqlash')."
    });
  }

  const text =
    "/* Qarshi Beton Klaster — sayt kontenti.\n" +
    "   Bu fayl admin panel orqali avtomatik yangilanadi. Qo'lda tahrirlash shart emas.\n" +
    `   Oxirgi yangilanish: ${new Date().toISOString()} */\n` +
    "window.QBK_DATA = " + JSON.stringify(clean) + ";\n";

  try {
    const msg = `admin: kontent yangilandi (${clean.products.length} mahsulot${files.length ? `, ${files.length} rasm` : ""})`;
    const r = await commitAll(cfg, text, files, msg);
    return json(res, 200, {
      ok: true,
      unchanged: r.unchanged,
      commit: r.commit,
      commitUrl: `https://github.com/${cfg.owner}/${cfg.repo}/commit/${r.commit}`,
      images: files.map((f) => f.path),
      data: clean
    });
  } catch (e) {
    const status = e.status === 401 || e.status === 403 ? 502 : 502;
    let hint = e.message || "Noma'lum xatolik.";
    if (e.status === 401) hint = "GitHub token noto'g'ri yoki muddati tugagan.";
    if (e.status === 403) hint = "GitHub token'da yozish huquqi yo'q (Contents: Read and write kerak).";
    if (e.status === 404) hint = `Repository yoki branch topilmadi: ${cfg.owner}/${cfg.repo}@${cfg.branch}`;
    if (e.status === 409 || e.status === 422) hint = "Branch shu orada o'zgardi. Sahifani yangilab, qaytadan saqlang.";
    return json(res, status, { ok: false, error: `GitHub'ga saqlashda xatolik: ${hint}` });
  }
}
