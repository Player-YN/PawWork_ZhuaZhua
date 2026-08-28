/**
 * IdeaShell-like local fixture: 1440 nav, sticky rail, 3-card hero,
 * editorial type, remote-relative CSS/images, media query.
 * HTML > 32KB and CSS > 100KB so inspect paging is forced.
 */
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';

const dir = path.dirname(fileURLToPath(import.meta.url));

function solidPng(width, height, rgb) {
  const [r, g, b] = rgb;
  const raw = Buffer.alloc((width * 3 + 1) * height);
  for (let y = 0; y < height; y += 1) {
    const row = y * (width * 3 + 1);
    raw[row] = 0;
    for (let x = 0; x < width; x += 1) {
      const i = row + 1 + x * 3;
      raw[i] = r;
      raw[i + 1] = g;
      raw[i + 2] = b;
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 2;
  const chunk = (type, data) => {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length, 0);
    const t = Buffer.from(type);
    const crc = Buffer.alloc(4);
    crc.writeUInt32BE(zlib.crc32(Buffer.concat([t, data])) >>> 0, 0);
    return Buffer.concat([len, t, data, crc]);
  };
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0))
  ]);
}

function padComment(tag, minBytes, token) {
  const unit = `${token} `;
  const n = Math.ceil(minBytes / unit.length);
  return `/* ${tag} ${unit.repeat(n)} */`;
}

function padHtmlComment(minBytes, token) {
  const unit = `${token} `;
  const n = Math.ceil(minBytes / unit.length);
  return `<!-- fixture-pad ${unit.repeat(n)} -->`;
}

export function buildIdeaShellCss() {
  const layout = `
:root {
  --ink: #101418;
  --muted: #5c6570;
  --paper: #f6f3ee;
  --line: #d8d2c8;
  --card: #fffdf8;
  --accent: #1f6b4a;
}
* { box-sizing: border-box; }
html, body { margin: 0; padding: 0; background: var(--paper); color: var(--ink); }
body {
  font-family: "Iowan Old Style", "Palatino Linotype", Palatino, Georgia, serif;
  min-width: 320px;
}
.topnav {
  width: 1440px;
  max-width: 100%;
  margin: 0 auto;
  height: 72px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 32px;
  border-bottom: 1px solid var(--line);
}
.brand { font-weight: 700; letter-spacing: 0.04em; font-size: 18px; }
.topnav a { color: var(--ink); text-decoration: none; margin-left: 20px; }
.shell {
  width: 1440px;
  max-width: 100%;
  margin: 0 auto;
  display: grid;
  grid-template-columns: 220px 1fr;
  min-height: calc(100vh - 72px);
}
.rail {
  position: sticky;
  top: 0;
  align-self: start;
  padding: 28px 20px;
  border-right: 1px solid var(--line);
  height: 100vh;
}
.rail a { display: block; color: var(--muted); text-decoration: none; margin: 12px 0; }
.main { padding: 48px 56px 80px; }
.hero-copy {
  font-size: 56px;
  line-height: 1.15;
  max-width: 18ch;
  margin: 0 0 36px;
  font-weight: 600;
}
.cards {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 24px;
  width: 960px;
  max-width: 100%;
  margin: 0 auto 48px;
}
.card {
  background: var(--card);
  border: 1px solid var(--line);
  border-radius: 16px;
  overflow: hidden;
  transition: transform 220ms ease, box-shadow 220ms ease;
}
.card:hover { transform: translateY(-4px); box-shadow: 0 12px 32px rgba(16,20,24,0.08); }
.card img { width: 100%; height: 160px; object-fit: cover; display: block; }
.card h2 { font-size: 20px; margin: 16px 16px 8px; }
.card p { margin: 0 16px 20px; color: var(--muted); }
.editorial {
  font-size: 28px;
  line-height: 1.5;
  max-width: 36ch;
}
@keyframes rise {
  from { opacity: 0; transform: translateY(12px); }
  to { opacity: 1; transform: translateY(0); }
}
.hero-copy { animation: rise 480ms ease both; }
@font-face {
  font-family: "IdeaShell Display";
  src: url("./fonts/display.woff2") format("woff2");
  font-display: swap;
}
@media (max-width: 900px) {
  .shell { grid-template-columns: 1fr; }
  .rail { position: relative; height: auto; border-right: 0; border-bottom: 1px solid var(--line); }
  .cards { grid-template-columns: 1fr; width: 100%; }
  .hero-copy { font-size: 36px; }
  .main { padding: 28px 20px 56px; }
}
`;
  return `${layout}\n${padComment('ideashell-css-pad', 100 * 1024, 'GRID-FLEX-STICKY-TYPE')}\n`;
}

export function buildIdeaShellHtml() {
  const body = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>IdeaShell — Think in public</title>
  <link rel="stylesheet" href="style.css" />
  <script>window.__ideashell = { track: function(){} };</script>
</head>
<body>
  <header class="topnav">
    <div class="brand">IdeaShell</div>
    <nav>
      <a href="/library">Library</a>
      <a href="/notes">Notes</a>
      <a href="javascript:void(0)" onclick="alert('x')">Account</a>
    </nav>
  </header>
  <div class="shell">
    <aside class="rail">
      <a href="/today">Today</a>
      <a href="/saved">Saved</a>
      <a href="/studio">Studio</a>
    </aside>
    <main class="main">
      <h1 class="hero-copy">A quiet place to grow an idea until it can stand on its own.</h1>
      <section class="cards">
        <article class="card">
          <img src="hero-1.png" alt="Field notes" />
          <h2>Field notes</h2>
          <p>Capture the sentence you do not want to lose.</p>
        </article>
        <article class="card">
          <img src="hero-2.png" alt="Studio wall" />
          <h2>Studio wall</h2>
          <p>Three cards, one grid, no extra chrome.</p>
        </article>
        <article class="card">
          <img src="hero-3.png" alt="Evening read" />
          <h2>Evening read</h2>
          <p>Editorial type at a human scale.</p>
        </article>
      </section>
      <p class="editorial">IdeaShell is a reading room for unfinished thoughts — English copy stays English, and the layout holds at 1440.</p>
      <form action="/subscribe" method="post" onsubmit="return false">
        <input name="email" placeholder="email" />
        <button type="submit">Join</button>
      </form>
    </main>
  </div>
`;
  return `${body}\n${padHtmlComment(32 * 1024, 'IDEASHELL-HTML-PAD')}\n</body>\n</html>\n`;
}

export function writeIdeaShellFixture(targetDir = dir) {
  fs.mkdirSync(targetDir, { recursive: true });
  const html = buildIdeaShellHtml();
  const css = buildIdeaShellCss();
  fs.writeFileSync(path.join(targetDir, 'index.html'), html);
  fs.writeFileSync(path.join(targetDir, 'style.css'), css);
  fs.writeFileSync(path.join(targetDir, 'hero-1.png'), solidPng(320, 180, [196, 164, 116]));
  fs.writeFileSync(path.join(targetDir, 'hero-2.png'), solidPng(320, 180, [47, 122, 88]));
  fs.writeFileSync(path.join(targetDir, 'hero-3.png'), solidPng(320, 180, [42, 74, 128]));
  return {
    dir: targetDir,
    html,
    css,
    htmlBytes: Buffer.byteLength(html),
    cssBytes: Buffer.byteLength(css)
  };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const out = writeIdeaShellFixture();
  console.log(`ideashell fixture html=${out.htmlBytes} css=${out.cssBytes} dir=${out.dir}`);
}
