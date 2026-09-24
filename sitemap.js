/**
 * /sitemap.xml — avtomatik yasaladi.
 * Admin paneldan mahsulot yoki obyekt qo'shilsa, darrov shu yerga tushadi.
 */
import { loadData, pick, prefix, SITE, LANGS } from "./_page.js";

const xmlEsc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

export default async function handler(req, res) {
  let data;
  try { data = await loadData(); } catch (e) { data = { products: [], projects: [] }; }

  const today = new Date().toISOString().slice(0, 10);
  const urls = [];

  const push = (path, priority, changefreq, alts) => {
    urls.push(`  <url>
    <loc>${xmlEsc(SITE + path)}</loc>
    <lastmod>${today}</lastmod>
    <changefreq>${changefreq}</changefreq>
    <priority>${priority}</priority>
${alts.map((a) => `    <xhtml:link rel="alternate" hreflang="${a.lang}" href="${xmlEsc(a.url)}"/>`).join("\n")}
  </url>`);
  };

  // bosh sahifa — uch tilda
  const homeAlts = LANGS.map((l) => ({ lang: l, url: `${SITE}${prefix(l)}/` }));
  LANGS.forEach((l) => push(`${prefix(l)}/`, "1.0", "weekly", homeAlts));

  // mahsulotlar
  (data.products || []).forEach((p) => {
    const alts = LANGS.map((l) => ({ lang: l, url: `${SITE}${prefix(l)}/mahsulot/${p.slug}` }));
    LANGS.forEach((l) => push(`${prefix(l)}/mahsulot/${p.slug}`, "0.8", "monthly", alts));
  });

  // obyektlar
  (data.projects || []).forEach((p) => {
    const alts = LANGS.map((l) => ({ lang: l, url: `${SITE}${prefix(l)}/obyekt/${p.slug}` }));
    LANGS.forEach((l) => push(`${prefix(l)}/obyekt/${p.slug}`, "0.7", "monthly", alts));
  });

  res.statusCode = 200;
  res.setHeader("Content-Type", "application/xml; charset=utf-8");
  res.setHeader("Cache-Control", "public, max-age=0, s-maxage=3600, stale-while-revalidate=86400");
  res.end(`<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">
${urls.join("\n")}
</urlset>
`);
}
