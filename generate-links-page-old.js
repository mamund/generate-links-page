#!/usr/bin/env node

const fs = require("fs/promises");
const cheerio = require("cheerio");

const site = {
  title: "Interesting Links",
  subtitle: "Articles, references, and other useful things worth saving.",
  input: "links.txt",
  output: "index.html"
};

async function main() {
  const urls = await readUrls(site.input);
  const items = [];

  for (const url of urls) {
    console.log(`Fetching: ${url}`);
    items.push(await fetchMetadata(url));
  }

  const html = renderPage(site, items);
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
      title: cleanText(title),
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

function renderPage(site, items) {
  const cards = items.map(renderCard).join("\n");

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(site.title)}</title>
  <style>
    :root {
      color-scheme: light dark;
      --bg: #f7f7f4;
      --text: #1f2328;
      --muted: #666;
      --card: #ffffff;
      --border: #ddd;
      --link: #0645ad;
    }

    @media (prefers-color-scheme: dark) {
      :root {
        --bg: #111;
        --text: #eee;
        --muted: #aaa;
        --card: #1b1b1b;
        --border: #333;
        --link: #8ab4f8;
      }
    }

    body {
      margin: 0;
      font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      background: var(--bg);
      color: var(--text);
      line-height: 1.5;
    }

    main {
      max-width: 880px;
      margin: 0 auto;
      padding: 3rem 1rem;
    }

    header {
      margin-bottom: 2rem;
    }

    h1 {
      margin: 0 0 0.4rem;
      font-size: clamp(2rem, 5vw, 3.5rem);
      line-height: 1.1;
    }

    .subtitle {
      margin: 0;
      color: var(--muted);
      font-size: 1.1rem;
    }

    .links {
      display: grid;
      gap: 1rem;
    }

    .link-card {
      display: grid;
      grid-template-columns: 180px 1fr;
      gap: 1rem;
      padding: 1rem;
      background: var(--card);
      border: 1px solid var(--border);
      border-radius: 14px;
    }

    .link-card img {
      width: 100%;
      aspect-ratio: 16 / 10;
      object-fit: cover;
      border-radius: 10px;
      background: var(--border);
    }

    .link-card h2 {
      margin: 0 0 0.4rem;
      font-size: 1.2rem;
      line-height: 1.25;
    }

    .link-card a {
      color: var(--link);
      text-decoration-thickness: 0.08em;
      text-underline-offset: 0.15em;
    }

    .description {
      margin: 0 0 0.7rem;
      color: var(--text);
    }

    .source {
      margin: 0;
      color: var(--muted);
      font-size: 0.9rem;
    }

    .no-image {
      display: grid;
      place-items: center;
      aspect-ratio: 16 / 10;
      border-radius: 10px;
      background: var(--border);
      color: var(--muted);
      font-size: 0.9rem;
    }

    footer {
      margin-top: 2rem;
      color: var(--muted);
      font-size: 0.9rem;
    }

    @media (max-width: 650px) {
      .link-card {
        grid-template-columns: 1fr;
      }
    }
  </style>
</head>
<body>
  <main>
    <header>
      <h1>${escapeHtml(site.title)}</h1>
      <p class="subtitle">${escapeHtml(site.subtitle)}</p>
    </header>

    <section class="links">
${cards}
    </section>

    <footer>
      Generated from ${escapeHtml(site.input)}.
    </footer>
  </main>
</body>
</html>`;
}

function renderCard(item) {
  const image = item.image
    ? `<img src="${escapeHtml(item.image)}" alt="">`
    : `<div class="no-image">No image</div>`;

  const description = item.description
    ? `<p class="description">${escapeHtml(item.description)}</p>`
    : "";

  return `      <article class="link-card">
        <a href="${escapeHtml(item.url)}">${image}</a>
        <div>
          <h2><a href="${escapeHtml(item.url)}">${escapeHtml(item.title)}</a></h2>
          ${description}
          <p class="source">${escapeHtml(item.source)}</p>
        </div>
      </article>`;
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
