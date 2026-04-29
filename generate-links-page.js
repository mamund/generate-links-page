#!/usr/bin/env node

const fs = require("fs/promises");
const cheerio = require("cheerio");

const site = {
  title: "Articles of Interest (AI)",
  subtitle: "Articles, references, and other useful things worth saving.",
  input: "links.txt",
  output: "index.html"
};

const CACHE_FILE = "cache.json";

async function main() {
  const urls = await readUrls(site.input);
  const cache = await loadCache();
  const items = [];

  for (const url of urls) {
    console.log(`Processing: ${url}`);
    const data = await fetchWithCache(url, cache);
    items.push(data);
  }

  await saveCache(cache);

  const generatedAt = new Date().toISOString();
  const html = renderPage(site, items, generatedAt);
  await fs.writeFile(site.output, html, "utf8");

  console.log(`Done. Wrote ${site.output} with ${items.length} links.`);
}

async function readUrls(filename) {
  const text = await fs.readFile(filename, "utf8");

  return text
    .split(/\r?\n/)
    .map(line => line.trim())
    .filter(line => line && !line.startsWith("#"));
}

/* -------------------- CACHE -------------------- */

async function loadCache() {
  try {
    const raw = await fs.readFile(CACHE_FILE, "utf8");
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

async function saveCache(cache) {
  await fs.writeFile(CACHE_FILE, JSON.stringify(cache, null, 2));
}

async function fetchWithCache(url, cache) {
  if (cache[url]) {
    console.log("  → cache hit");
    return cache[url];
  }

  console.log("  → fetching");
  const data = await fetchMetadata(url);
  cache[url] = data;

  return data;
}

/* -------------------- FETCH -------------------- */

async function fetchMetadata(url) {
  try {
    const response = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 link-page-generator"
      }
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const html = await response.text();
    const $ = cheerio.load(html);

    const title =
      getMeta($, "property", "og:title") ||
      getMeta($, "name", "twitter:title") ||
      $("title").first().text().trim() ||
      url;

    const description =
      getMeta($, "property", "og:description") ||
      getMeta($, "name", "twitter:description") ||
      getMeta($, "name", "description") ||
      "";

    const image =
      absolutizeUrl(
        getMeta($, "property", "og:image") ||
        getMeta($, "name", "twitter:image") ||
        "",
        url
      );

    return {
      url,
      title: cleanText(title) || url,
      description: cleanText(description),
      image,
      source: new URL(url).hostname.replace(/^www\./, ""),
      error: null
    };
  } catch (err) {
    return {
      url,
      title: url,
      description: `Could not read metadata: ${err.message}`,
      image: "",
      source: safeHostname(url),
      error: err.message
    };
  }
}

/* -------------------- HELPERS -------------------- */

function formatDate(iso) {
  return new Date(iso).toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short"
  });
}

function getMeta($, attr, value) {
  return $(`meta[${attr}="${value}"]`).attr("content")?.trim() || "";
}

function absolutizeUrl(maybeUrl, baseUrl) {
  if (!maybeUrl) return "";

  try {
    return new URL(maybeUrl, baseUrl).href;
  } catch {
    return "";
  }
}

function safeHostname(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

function cleanText(text) {
  return text.replace(/\s+/g, " ").trim();
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

/* -------------------- RENDER -------------------- */

function renderPage(site, items, generatedAt) {
  const cards = items.map(renderCard).join("\n");

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(site.title)}</title>
  <style>
    body { font-family: system-ui, sans-serif; margin: 2rem auto; max-width: 800px; }
    .link-card { display: flex; gap: 1rem; margin-bottom: 1.5rem; }
    img { width: 160px; height: auto; border-radius: 8px; }
    .no-image { width: 160px; height: 100px; background: #eee; display: flex; align-items: center; justify-content: center; }
    h2 { margin: 0 0 0.3rem; }
    .source { color: #666; font-size: 0.9rem; }
  </style>
</head>
<body>
  <h1>${escapeHtml(site.title)}</h1>
  <p>${escapeHtml(site.subtitle)}</p>
  <p><i>Generated on ${escapeHtml(formatDate(generatedAt))}</i></p>
  ${cards}
</body>
<footer>
  Generated on ${escapeHtml(formatDate(generatedAt))}
</footer>
</html>`;
}

function renderCard(item) {
  const image = item.image
    ? `<img src="${escapeHtml(item.image)}" alt="">`
    : `<div class="no-image">No image</div>`;

  return `<div class="link-card">
    <a href="${escapeHtml(item.url)}">${image}</a>
    <div>
      <h2><a href="${escapeHtml(item.url)}">${escapeHtml(item.title)}</a></h2>
      <p>${escapeHtml(item.description)}</p>
      <p class="source">${escapeHtml(item.source)}</p>
    </div>
  </div>`;
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
