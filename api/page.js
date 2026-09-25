/**
 * Mahsulot va obyekt sahifalari — serverda yasaladi.
 *
 * Manzillar (vercel.json dagi rewrites orqali):
 *   /mahsulot/<nomi>        → uz
 *   /ru/mahsulot/<nomi>     → ru
 *   /en/mahsulot/<nomi>     → en
 *   /obyekt/<nomi>          → uz   (va shunga mos /ru/, /en/)
 */
import { loadData, esc, pick, prefix, shell, UI, SITE, LANGS } from "./_page.js";

const html = (res, code, body) => {
  res.statusCode = code;
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.setHeader("Cache-Control", "public, max-age=0, s-maxage=300, stale-while-revalidate=86400");
  res.end(body);
};

function altsFor(kind, slug) {
  const seg = kind === "product" ? "mahsulot" : "obyekt";
  return LANGS.map((l) => ({ lang: l, url: `${SITE}${prefix(l)}/${seg}/${slug}` }));
}

/* ---------- mahsulot sahifasi ---------- */
/* tipo'lchamlar jadvali — faqat yoqilgan qatorlar */
function sizesTable(item, t) {
  const rows = (item.sizes || []).filter((z) => z && z.on !== false && (z.c || z.d || z.w || z.v));
  if (!rows.length) return { html: "", rows: [] };
  const cols = [
    ["c", t.szMark], ["d", t.szDim], ["w", t.szWeight], ["v", t.szVol]
  ].filter(([k]) => rows.some((z) => z[k]));
  const html = `<div class="wrap sec" id="sizes"><h2>${t.sizes}</h2>
    <p class="lead" style="margin:0 0 20px">${t.sizesNote}</p>
    <div class="tblwrap"><table class="sztbl">
      <thead><tr>${cols.map(([, n]) => `<th>${n}</th>`).join("")}</tr></thead>
      <tbody>${rows.map((z) => `<tr>${cols.map(([k]) => `<td>${esc(z[k] || "—")}</td>`).join("")}</tr>`).join("")}</tbody>
    </table></div></div>`;
  return { html, rows, cols };
}

function productPage(data, item, lang) {
  const t = UI[lang], d = pick(item, lang);
  const sz = sizesTable(item, t);
  const img = item.img ? (item.img.startsWith("http") ? item.img : `${SITE}/${item.img}`) : "";
  const used = (data.projects || []).filter((p) => (p.products || []).includes(item.id));
  const others = (data.products || []).filter((p) => p.id !== item.id).slice(0, 4);
  const specs = (d.s || []).filter(Boolean);

  const body = `
<div class="wrap crumb">
  <a href="${prefix(lang)}/">${t.home}</a> · <a href="${prefix(lang)}/#products">${t.products}</a>
</div>
<div class="wrap top">
  <div class="fig">${item.code ? `<span class="tag">${esc(item.code)}</span>` : ""}
    ${item.img ? `<img src="/${esc(item.img)}" alt="${esc(d.n)}">` : ""}</div>
  <div>
    <h1>${esc(d.n)}</h1>
    ${d.d ? `<p class="lead">${esc(d.d)}</p>` : ""}
    ${specs.length ? `<h2 class="mono" style="margin-top:26px;color:var(--signal-dim)">${t.specs}</h2>
      <ul class="specs">${specs.map((x) => `<li>${esc(x)}</li>`).join("")}</ul>` : ""}
    ${sz.rows.length ? `<p class="szhint"><a href="#sizes">${t.sizesCount.replace("{n}", sz.rows.length)} \u2193</a></p>` : ""}
    <a class="btn" href="#order">${t.order}</a>
  </div>
</div>

${sz.html}

${used.length ? `<div class="wrap sec"><h2>${t.usedIn}</h2><div class="cards">${used.map((p) => {
    const pd = pick(p, lang);
    return `<a class="card" href="${prefix(lang)}/obyekt/${p.slug}">
      <b>${esc(pd.n)}</b><span>${[p.year, pd.c].filter(Boolean).map(esc).join(" · ")}</span></a>`;
  }).join("")}</div></div>` : ""}

<div class="wrap sec"><div class="order" id="order">
  <h2>${t.orderH}</h2><p>${t.orderP}</p>
  <form id="orderForm" data-product="${esc(d.n)}">
    <div class="f2">
      <label><span>${t.fName}</span><input name="name" required></label>
      <label><span>${t.fPhone}</span><input name="phone" type="tel" placeholder="+998 __ ___ __ __" required></label>
    </div>
    <label><span>${t.fMsg}</span><textarea name="message" placeholder="${esc(d.n)}"></textarea></label>
    <button type="submit">${t.fSend}</button>
    <div id="ok"></div>
  </form>
</div></div>

${others.length ? `<div class="wrap sec"><h2>${t.other}</h2><div class="cards">${others.map((p) => {
    const pd = pick(p, lang);
    return `<a class="card" href="${prefix(lang)}/mahsulot/${p.slug}">
      <b>${esc(pd.n)}</b><span>${esc((pd.d || "").slice(0, 70))}</span></a>`;
  }).join("")}</div></div>` : ""}`;

  const jsonld = {
    "@context": "https://schema.org", "@type": "Product",
    name: d.n, description: d.d || d.n,
    ...(img ? { image: img } : {}),
    ...(item.code ? { sku: item.code } : {}),
    brand: { "@type": "Brand", name: "Qarshi Beton Klaster" },
    manufacturer: { "@type": "Organization", name: "Qarshi Beton Klaster", url: SITE + "/" },
    ...(specs.length ? {
      additionalProperty: specs.map((x) => ({ "@type": "PropertyValue", name: x.split(":")[0].trim(), value: (x.split(":")[1] || x).trim() }))
    } : {}),
    ...(sz.rows.length ? {
      hasVariant: sz.rows.slice(0, 40).map((z) => ({
        "@type": "Product",
        name: [d.n, z.c].filter(Boolean).join(" ").trim(),
        ...(z.c ? { sku: z.c } : {}),
        ...(z.d ? { size: z.d } : {}),
        ...(z.w ? { weight: z.w } : {})
      }))
    } : {})
  };

  return shell({
    lang,
    title: `${d.n} — Qarshi Beton Klaster`,
    desc: (d.d || d.n) + (sz.rows.length ? ` ${t.sizesCount.replace("{n}", sz.rows.length)}.` : "")
          + (specs.length ? " " + specs.slice(0, 3).join("; ") : ""),
    canonical: `${SITE}${prefix(lang)}/mahsulot/${item.slug}`,
    alternates: altsFor("product", item.slug),
    image: img, body, jsonld, contacts: data.contacts
  });
}

/* ---------- obyekt sahifasi ---------- */
function projectPage(data, item, lang) {
  const t = UI[lang], d = pick(item, lang);
  const imgs = Array.isArray(item.img) ? item.img : (item.img ? [item.img] : []);
  const linked = (data.products || []).filter((p) => (item.products || []).includes(p.id));
  const others = (data.projects || []).filter((p) => p.id !== item.id).slice(0, 4);
  const items = (d.s || []).filter(Boolean);

  const body = `
<div class="wrap crumb">
  <a href="${prefix(lang)}/">${t.home}</a> · <a href="${prefix(lang)}/#projects">${t.projects}</a>
</div>
<div class="wrap top">
  <div>
    <div class="fig">${item.year ? `<span class="tag">${esc(item.year)}</span>` : ""}
      ${imgs[0] ? `<img src="/${esc(imgs[0])}" alt="${esc(d.n)}" style="mix-blend-mode:normal;max-height:380px">` : ""}</div>
    ${imgs.length > 1 ? `<div class="gal">${imgs.slice(1).map((x) => `<img src="/${esc(x)}" alt="${esc(d.n)}" loading="lazy">`).join("")}</div>` : ""}
  </div>
  <div>
    <h1>${esc(d.n)}</h1>
    ${d.d ? `<p class="lead">${esc(d.d)}</p>` : ""}
    <div class="meta">
      ${d.c ? `<div><b>${t.client}</b><span>${esc(d.c)}</span></div>` : ""}
      ${d.l ? `<div><b>${t.loc}</b><span>${esc(d.l)}</span></div>` : ""}
      ${item.year ? `<div><b>${t.year}</b><span>${esc(item.year)}</span></div>` : ""}
    </div>
    ${items.length ? `<h2 class="mono" style="margin-top:26px;color:var(--signal-dim)">${t.supplied}</h2>
      <ul class="specs">${items.map((x) => `<li>${esc(x)}</li>`).join("")}</ul>` : ""}
    <a class="btn" href="#order">${t.order}</a>
  </div>
</div>

${linked.length ? `<div class="wrap sec"><h2>${t.supplied}</h2><div class="cards">${linked.map((p) => {
    const pd = pick(p, lang);
    return `<a class="card" href="${prefix(lang)}/mahsulot/${p.slug}">
      <b>${esc(pd.n)}</b><span>${esc(p.code || "")}</span></a>`;
  }).join("")}</div></div>` : ""}

<div class="wrap sec"><div class="order" id="order">
  <h2>${t.orderH}</h2><p>${t.orderP}</p>
  <form id="orderForm" data-product="${esc(d.n)}">
    <div class="f2">
      <label><span>${t.fName}</span><input name="name" required></label>
      <label><span>${t.fPhone}</span><input name="phone" type="tel" placeholder="+998 __ ___ __ __" required></label>
    </div>
    <label><span>${t.fMsg}</span><textarea name="message"></textarea></label>
    <button type="submit">${t.fSend}</button>
    <div id="ok"></div>
  </form>
</div></div>

${others.length ? `<div class="wrap sec"><h2>${t.otherPr}</h2><div class="cards">${others.map((p) => {
    const pd = pick(p, lang);
    return `<a class="card" href="${prefix(lang)}/obyekt/${p.slug}">
      <b>${esc(pd.n)}</b><span>${[p.year, pd.c].filter(Boolean).map(esc).join(" · ")}</span></a>`;
  }).join("")}</div></div>` : ""}`;

  return shell({
    lang,
    title: `${d.n} — Qarshi Beton Klaster`,
    desc: (d.d || d.n) + (d.c ? ` ${t.client}: ${d.c}.` : ""),
    canonical: `${SITE}${prefix(lang)}/obyekt/${item.slug}`,
    alternates: altsFor("project", item.slug),
    image: imgs[0] ? `${SITE}/${imgs[0]}` : "", body,
    jsonld: {
      "@context": "https://schema.org", "@type": "CreativeWork",
      name: d.n, description: d.d || d.n,
      ...(item.year ? { dateCreated: String(item.year) } : {}),
      creator: { "@type": "Organization", name: "Qarshi Beton Klaster", url: SITE + "/" },
      ...(d.l ? { locationCreated: { "@type": "Place", name: d.l } } : {})
    },
    contacts: data.contacts
  });
}

/* ---------- handler ---------- */
export default async function handler(req, res) {
  const url = new URL(req.url, "http://x");
  const kind = url.searchParams.get("t") === "o" ? "project" : "product";
  const slug = (url.searchParams.get("s") || "").toLowerCase();
  const lang = LANGS.includes(url.searchParams.get("l")) ? url.searchParams.get("l") : "uz";

  let data;
  try { data = await loadData(); }
  catch (e) {
    return html(res, 500,
      `<!doctype html><meta charset="utf-8"><title>Xatolik</title>` +
      `<p style="font-family:sans-serif;padding:30px">Ma'lumotni o'qib bo'lmadi.</p>` +
      `<!-- ${String(e.message || e).replace(/-->/g, "")} -->`);
  }

  const list = kind === "product" ? data.products : data.projects;
  const item = (list || []).find((x) => x.slug === slug);

  if (!item) {
    const t = UI[lang];
    return html(res, 404, shell({
      lang, title: t.notFound + " — Qarshi Beton Klaster", desc: t.notFoundP,
      canonical: SITE + prefix(lang) + "/", alternates: [],
      body: `<div class="wrap" style="padding:80px 0"><h1>${t.notFound}</h1>
        <p class="lead">${t.notFoundP}</p>
        <a class="btn" href="${prefix(lang)}/#products">${t.products}</a></div>`,
      contacts: data.contacts
    }));
  }

  return html(res, 200, kind === "product"
    ? productPage(data, item, lang)
    : projectPage(data, item, lang));
}
