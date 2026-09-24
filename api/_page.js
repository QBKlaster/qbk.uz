/**
 * Alohida sahifalar uchun umumiy yordamchi.
 * Bu fayl "_" bilan boshlangani uchun Vercel uni alohida manzil qilib ochmaydi.
 */

const SITE = "https://qarshibetonklaster.uz";
const LANGS = ["uz", "ru", "en"];

/* ---------- manzil (slug) yasash ---------- */
const CYR = {
  а:"a", б:"b", в:"v", г:"g", д:"d", е:"e", ё:"yo", ж:"j", з:"z", и:"i", й:"y",
  к:"k", л:"l", м:"m", н:"n", о:"o", п:"p", р:"r", с:"s", т:"t", у:"u", ф:"f",
  х:"x", ц:"ts", ч:"ch", ш:"sh", щ:"sh", ъ:"", ы:"i", ь:"", э:"e", ю:"yu", я:"ya",
  ғ:"g", қ:"q", ҳ:"h", ў:"o"
};

export function slugify(text) {
  let s = String(text || "").toLowerCase();
  s = s.replace(/[а-яёғқҳў]/g, (c) => (CYR[c] !== undefined ? CYR[c] : c));
  s = s.replace(/[''`ʻʼ’]/g, "");
  s = s.replace(/[^a-z0-9]+/g, "-");
  s = s.replace(/^-+|-+$/g, "").slice(0, 80);
  return s || "mahsulot";
}

/** Ro'yxatdagi har bir yozuvga takrorlanmas manzil beradi */
export function withSlugs(list) {
  const used = new Set();
  return (list || []).map((item) => {
    const base = slugify((item.uz && item.uz.n) || (item.ru && item.ru.n) || item.id);
    let s = base, i = 2;
    while (used.has(s)) s = `${base}-${i++}`;
    used.add(s);
    return { ...item, slug: s };
  });
}

/* ---------- data.js ni o'qish ---------- */
let cache = null, cacheAt = 0;
const TTL = 60 * 1000;

export async function loadData() {
  if (cache && Date.now() - cacheAt < TTL) return cache;

  // Manbalar navbati: sozlama → asosiy domen → Vercel ichki manzili → fayl tizimi
  const tries = [];
  if (process.env.DATA_BASE) tries.push(`${process.env.DATA_BASE}/data.js`);
  tries.push(`${SITE}/data.js`);
  if (process.env.VERCEL_URL) tries.push(`https://${process.env.VERCEL_URL}/data.js`);

  let text = null, lastErr = "";
  for (const url of tries) {
    try {
      const r = await fetch(url, { headers: { "cache-control": "no-cache" } });
      if (r.ok) { text = await r.text(); break; }
      lastErr = `${url} → ${r.status}`;
    } catch (e) { lastErr = `${url} → ${e.message}`; }
  }

  // Oxirgi chora: fayl tizimidan o'qish
  if (text === null) {
    try {
      const fs = await import("node:fs");
      const path = await import("node:path");
      for (const f of [path.join(process.cwd(), "data.js"), path.join(process.cwd(), "public", "data.js")]) {
        if (fs.existsSync(f)) { text = fs.readFileSync(f, "utf8"); break; }
      }
    } catch (e) { lastErr += " | fs: " + e.message; }
  }

  if (text === null) throw new Error("data.js topilmadi. " + lastErr);

  const i = text.indexOf("{");
  const obj = JSON.parse(text.slice(i).trim().replace(/;\s*$/, ""));
  obj.products = withSlugs(obj.products || []);
  obj.projects = withSlugs(obj.projects || []);
  cache = obj; cacheAt = Date.now();
  return obj;
}

/* ---------- matn yordamchilari ---------- */
export const esc = (s) => String(s ?? "")
  .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
  .replace(/"/g, "&quot;").replace(/'/g, "&#39;");

export const pick = (item, lang) => item[lang] || item.uz || item.ru || item.en || {};
export const prefix = (lang) => (lang === "uz" ? "" : `/${lang}`);
export { SITE, LANGS };

/* ---------- interfeys matnlari ---------- */
export const UI = {
  uz: {
    back: "Katalogga qaytish", backPr: "Obyektlarga qaytish",
    specs: "Xususiyatlari", usedIn: "Ushbu mahsulot ishlatilgan obyektlar",
    supplied: "Yetkazilgan mahsulotlar", client: "Buyurtmachi", loc: "Joylashuvi", year: "Yili",
    order: "Narx so'rash", orderH: "Narx va muddatni so'rang",
    orderP: "Ism va telefon raqamingizni qoldiring — hisob-kitobni tayyorlab, o'zimiz bog'lanamiz.",
    fName: "Ism / Tashkilot", fPhone: "Telefon", fMsg: "Qo'shimcha ma'lumot", fSend: "So'rov yuborish",
    sending: "Yuborilmoqda…", ok: "Rahmat! So'rovingiz qabul qilindi — tez orada bog'lanamiz.",
    err: "Yuborib bo'lmadi. Iltimos, qo'ng'iroq qiling:",
    other: "Boshqa mahsulotlar", otherPr: "Boshqa obyektlar",
    home: "Bosh sahifa", products: "Mahsulotlar", projects: "Obyektlar",
    notFound: "Sahifa topilmadi", notFoundP: "Bunday mahsulot yoki obyekt yo'q. Katalogdan tanlang."
  },
  ru: {
    back: "Вернуться в каталог", backPr: "Вернуться к объектам",
    specs: "Характеристики", usedIn: "Объекты, где применялась эта продукция",
    supplied: "Поставленная продукция", client: "Заказчик", loc: "Расположение", year: "Год",
    order: "Запросить цену", orderH: "Запросите цену и срок",
    orderP: "Оставьте имя и телефон — подготовим расчёт и свяжемся сами.",
    fName: "Имя / Организация", fPhone: "Телефон", fMsg: "Дополнительная информация", fSend: "Отправить заявку",
    sending: "Отправляется…", ok: "Спасибо! Заявка принята — мы свяжемся с вами в ближайшее время.",
    err: "Не удалось отправить. Пожалуйста, позвоните:",
    other: "Другая продукция", otherPr: "Другие объекты",
    home: "Главная", products: "Продукция", projects: "Объекты",
    notFound: "Страница не найдена", notFoundP: "Такой продукции или объекта нет. Выберите из каталога."
  },
  en: {
    back: "Back to catalog", backPr: "Back to projects",
    specs: "Specifications", usedIn: "Projects where this product was used",
    supplied: "Products supplied", client: "Client", loc: "Location", year: "Year",
    order: "Request a price", orderH: "Request a price and lead time",
    orderP: "Leave your name and phone — we will prepare the figures and call you back.",
    fName: "Name / Company", fPhone: "Phone", fMsg: "Additional details", fSend: "Send request",
    sending: "Sending…", ok: "Thank you! Your request has been received — we will contact you shortly.",
    err: "Could not send. Please call us:",
    other: "Other products", otherPr: "Other projects",
    home: "Home", products: "Products", projects: "Projects",
    notFound: "Page not found", notFoundP: "No such product or project. Please pick one from the catalog."
  }
};

/* ---------- sahifa qolipi ---------- */
export function shell({ lang, title, desc, canonical, alternates, image, body, jsonld, contacts }) {
  const t = UI[lang];
  const c = contacts || {};
  const alt = (alternates || []).map(
    (a) => `<link rel="alternate" hreflang="${a.lang}" href="${a.url}">`).join("\n");
  return `<!DOCTYPE html>
<html lang="${lang}">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title>
<meta name="description" content="${esc(desc)}">
<link rel="canonical" href="${canonical}">
${alt}
<link rel="alternate" hreflang="x-default" href="${(alternates || []).find((a) => a.lang === "uz")?.url || canonical}">
<meta name="robots" content="index, follow, max-image-preview:large">
<meta property="og:type" content="article">
<meta property="og:site_name" content="Qarshi Beton Klaster">
<meta property="og:url" content="${canonical}">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(desc)}">
<meta property="og:image" content="${image || SITE + "/og-image.jpg"}">
<meta name="twitter:card" content="summary_large_image">
<link rel="icon" href="/favicon.ico" sizes="any">
<link rel="apple-touch-icon" href="/apple-touch-icon.png">
<meta name="theme-color" content="#1B1917">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Fira+Sans+Extra+Condensed:wght@500;700;800&family=IBM+Plex+Mono:wght@400;500;600&family=IBM+Plex+Sans:wght@400;500;600;700&display=swap" rel="stylesheet">
<style>
:root{--ink:#1B1917;--slate:#33302B;--stone:#6E6A62;--concrete:#D5D2CA;--paper:#EDEBE5;--white:#F8F7F4;
--signal:#F2C10E;--signal-dim:#C79C05;--line:rgba(27,25,23,.14);--line-dark:rgba(237,235,229,.16);
--maxw:1120px;--pad:clamp(20px,5vw,56px)}
*{box-sizing:border-box}
body{margin:0;background:var(--paper);color:var(--ink);font-family:"IBM Plex Sans",system-ui,sans-serif;font-size:16px;line-height:1.65;-webkit-font-smoothing:antialiased}
h1,h2,h3{font-family:"Fira Sans Extra Condensed","IBM Plex Sans",sans-serif;font-weight:800;text-transform:uppercase;line-height:.98;margin:0}
p{margin:0}a{color:inherit;text-decoration:none}img{display:block;max-width:100%}
button{font:inherit;color:inherit;border:none;background:none;cursor:pointer}
:focus-visible{outline:2px solid var(--signal);outline-offset:3px}
.wrap{max-width:var(--maxw);margin:0 auto;padding:0 var(--pad)}
.mono{font-family:"IBM Plex Mono",monospace;font-size:11px;letter-spacing:.15em;text-transform:uppercase}
.hdr{background:var(--ink);color:var(--white)}
.hdr-in{display:flex;align-items:center;gap:20px;height:74px;max-width:var(--maxw);margin:0 auto;padding:0 var(--pad);flex-wrap:wrap}
.brand{display:flex;align-items:center;gap:12px}
.mark{width:36px;height:36px;background:var(--signal);color:var(--ink);display:grid;place-items:center;font-family:"Fira Sans Extra Condensed",sans-serif;font-weight:800;font-size:16px}
.brand b{font-family:"Fira Sans Extra Condensed",sans-serif;font-weight:800;font-size:18px;text-transform:uppercase}
.hnav{margin-left:auto;display:flex;gap:18px;align-items:center}
.hnav a{font-size:13.5px;color:var(--concrete)}
.hnav a:hover{color:var(--signal)}
.lang{display:flex;border:1px solid var(--line-dark)}
.lang a{padding:6px 9px;font-family:"IBM Plex Mono",monospace;font-size:11px;color:var(--concrete)}
.lang a.on{background:var(--signal);color:var(--ink);font-weight:600}
.crumb{padding:22px 0 0;color:var(--stone);font-size:13px}
.crumb a:hover{color:var(--ink)}
main{padding:0 0 clamp(50px,7vw,80px)}
.top{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:clamp(26px,4vw,56px);align-items:start;padding:clamp(26px,4vw,44px) 0}
.fig{background:linear-gradient(158deg,#E7E5E0,#CDCAC2);display:grid;place-items:center;padding:28px;min-height:300px;position:relative}
.fig img{max-height:420px;width:auto;object-fit:contain;mix-blend-mode:multiply}
.tag{position:absolute;top:14px;left:14px;background:var(--ink);color:var(--signal);padding:5px 10px;font-family:"IBM Plex Mono",monospace;font-size:10px;letter-spacing:.14em}
.gal{display:grid;grid-template-columns:repeat(auto-fill,minmax(110px,1fr));gap:10px;margin-top:10px}
.gal img{width:100%;height:92px;object-fit:cover;background:var(--concrete)}
h1{font-size:clamp(30px,4.6vw,50px)}
.lead{margin-top:18px;font-size:17px;color:var(--slate)}
.meta{margin-top:24px;display:grid;gap:9px}
.meta div{display:flex;gap:14px;font-size:15px}
.meta b{font-family:"IBM Plex Mono",monospace;font-size:10px;letter-spacing:.14em;text-transform:uppercase;color:var(--signal-dim);flex:none;width:110px;padding-top:4px}
.specs{margin:26px 0 0;padding:20px 0 0;border-top:1px solid var(--line);list-style:none;display:grid;gap:9px}
.specs li{display:flex;gap:11px;font-family:"IBM Plex Mono",monospace;font-size:12.5px;color:var(--slate)}
.specs li::before{content:"";width:6px;height:6px;flex:none;margin-top:6px;background:var(--signal)}
.btn{display:inline-flex;align-items:center;gap:10px;padding:15px 26px;margin-top:28px;background:var(--signal);color:var(--ink);font-family:"IBM Plex Mono",monospace;font-size:12px;letter-spacing:.13em;text-transform:uppercase;font-weight:600}
.btn:hover{background:var(--ink);color:var(--signal)}
.sec{padding:clamp(40px,6vw,64px) 0;border-top:1px solid var(--line)}
.sec h2{font-size:clamp(24px,3.4vw,34px);margin-bottom:24px}
.cards{display:grid;grid-template-columns:repeat(auto-fill,minmax(240px,1fr));gap:18px}
.card{background:var(--white);border:1px solid var(--line);padding:18px;transition:transform .2s,border-color .2s}
.card:hover{transform:translateY(-3px);border-color:rgba(27,25,23,.3)}
.card b{display:block;font-family:"Fira Sans Extra Condensed",sans-serif;font-weight:700;text-transform:uppercase;font-size:18px;line-height:1.05}
.card span{display:block;margin-top:8px;color:var(--stone);font-size:13px}
.order{background:var(--ink);color:var(--white);padding:clamp(28px,4vw,44px)}
.order h2{color:var(--white)}
.order p{color:var(--concrete);max-width:52ch}
form{display:grid;gap:14px;margin-top:22px;max-width:560px}
.f2{display:grid;grid-template-columns:1fr 1fr;gap:14px}
label span{display:block;margin-bottom:7px;font-family:"IBM Plex Mono",monospace;font-size:10.5px;letter-spacing:.14em;text-transform:uppercase;color:var(--stone)}
input,textarea{width:100%;background:transparent;border:1px solid var(--line-dark);color:var(--white);padding:13px 15px;font-family:"IBM Plex Sans",sans-serif;font-size:15px;border-radius:0}
input:focus,textarea:focus{border-color:var(--signal);outline:none}
textarea{min-height:90px;resize:vertical}
form button{background:var(--signal);color:var(--ink);padding:15px 26px;font-family:"IBM Plex Mono",monospace;font-size:12px;letter-spacing:.13em;text-transform:uppercase;font-weight:600;justify-self:start}
#ok{display:none;border-left:4px solid var(--signal);padding:12px 16px;font-size:14.5px}
#ok.on{display:block}
.ftr{background:#141210;color:var(--stone);padding:26px 0}
.ftr-in{max-width:var(--maxw);margin:0 auto;padding:0 var(--pad);display:flex;flex-wrap:wrap;gap:12px;justify-content:space-between;font-family:"IBM Plex Mono",monospace;font-size:11px;letter-spacing:.1em;text-transform:uppercase}
.ftr a:hover{color:var(--signal)}
@media (max-width:860px){.top{grid-template-columns:1fr}.f2{grid-template-columns:1fr}.hnav{gap:12px}}
</style>
${jsonld ? `<script type="application/ld+json">${JSON.stringify(jsonld)}</script>` : ""}
</head>
<body>
<header class="hdr"><div class="hdr-in">
  <a class="brand" href="${prefix(lang)}/"><span class="mark">QBK</span><b>Qarshi Beton Klaster</b></a>
  <nav class="hnav">
    <a href="${prefix(lang)}/#products">${t.products}</a>
    <a href="${prefix(lang)}/#projects">${t.projects}</a>
    <span class="lang">${LANGS.map((l) => {
      const a = (alternates || []).find((x) => x.lang === l);
      return `<a class="${l === lang ? "on" : ""}" href="${a ? a.url : prefix(l) + "/"}">${l.toUpperCase()}</a>`;
    }).join("")}</span>
  </nav>
</div></header>
<main>${body}</main>
<footer class="ftr"><div class="ftr-in">
  <span>© ${new Date().getFullYear()} «Qarshi Beton Klaster» MChJ</span>
  <span>${c.phone ? `<a href="tel:${esc(String(c.phone).replace(/[^\d+]/g, ""))}">${esc(c.phone)}</a>` : ""}</span>
</div></footer>
<script>
(function(){
  var f = document.getElementById('orderForm'); if(!f) return;
  var opened = Date.now();
  f.addEventListener('submit', async function(e){
    e.preventDefault();
    var el = f.elements, btn = f.querySelector('button'), ok = document.getElementById('ok');
    if(!el.name.value.trim() || !el.phone.value.trim()) return;
    btn.disabled = true; btn.textContent = ${JSON.stringify(t.sending)};
    try{
      var r = await fetch('/api/order', {method:'POST',headers:{'Content-Type':'application/json'},
        body: JSON.stringify({name:el.name.value.trim(), phone:el.phone.value.trim(),
          product: f.dataset.product || '', volume:'', message: el.message.value.trim(),
          lang: ${JSON.stringify(lang)}, t: Date.now()-opened})});
      var j = await r.json();
      if(!r.ok || !j.ok) throw new Error('x');
      ok.textContent = ${JSON.stringify(t.ok)}; ok.className = 'on'; f.reset();
    }catch(err){
      ok.textContent = ${JSON.stringify(t.err)} + ' ' + ${JSON.stringify(String(c.phone || ""))};
      ok.className = 'on';
    }finally{ btn.disabled = false; btn.textContent = ${JSON.stringify(t.fSend)}; }
  });
})();
</script>
</body>
</html>`;
}
