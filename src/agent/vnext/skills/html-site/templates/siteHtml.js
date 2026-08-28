export const SITE_HTML = `<!DOCTYPE html>
<html lang="zh-CN" data-paw-kind="site">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>{{title}}</title>
  <style>
    :root { color-scheme: light; }
    body { margin: 0; font-family: system-ui, "Segoe UI", "PingFang SC", "Microsoft YaHei", sans-serif; color: #1a1a1a; background: #fff; }
    header, main, footer { max-width: 720px; margin: 0 auto; padding: 32px 20px; }
    h1 { font-size: 2rem; letter-spacing: -0.03em; margin: 0 0 12px; }
    p { line-height: 1.6; margin: 0 0 16px; color: #444; }
    a.cta { display: inline-block; padding: 10px 16px; background: #f43f8c; color: #fff; text-decoration: none; border-radius: 10px; font-weight: 650; }
  </style>
</head>
<body>
  <header>
    <h1>{{title}}</h1>
    <p>{{lead}}</p>
    <a class="cta" href="{{ctaHref}}">{{cta}}</a>
  </header>
  <main>
    <h2>{{sectionTitle}}</h2>
    <p>{{sectionCopy}}</p>
  </main>
  <footer>
    <p>{{footer}}</p>
  </footer>
</body>
</html>
`;
