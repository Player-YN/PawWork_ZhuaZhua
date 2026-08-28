export const REPORT_HTML = `<!DOCTYPE html>
<html lang="zh-CN" data-pawwork-preview="blocks" data-paw-kind="document">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <meta name="pawwork-preview" content="blocks" />
  <title>{{title}}</title>
  <style>
    body { font-family: system-ui, sans-serif; margin: 2rem auto; max-width: 40rem; line-height: 1.55; color: #0f172a; }
    h1 { font-size: 1.6rem; margin: 0 0 0.35em; }
    h2 { font-size: 1.15rem; margin: 0 0 0.4em; }
    p, ul { margin: 0 0 0.5em; }
    section[data-paw-block] { margin: 0 0 1.25rem; }
  </style>
</head>
<body>
  <section data-paw-block data-paw-block-id="hero">
    <h1 data-paw-slot="title">{{title}}</h1>
    <p data-paw-slot="lead">{{lead}}</p>
  </section>
  <section data-paw-block data-paw-block-id="about">
    <h2 data-paw-slot="aboutHeading">{{aboutHeading}}</h2>
    <p data-paw-slot="about">{{about}}</p>
  </section>
  <section data-paw-block data-paw-block-id="skills">
    <h2 data-paw-slot="skillsHeading">{{skillsHeading}}</h2>
    <ul data-paw-slot="skills">{{skills}}</ul>
  </section>
  <section data-paw-block data-paw-block-id="principles">
    <h2 data-paw-slot="principlesHeading">{{principlesHeading}}</h2>
    <ul data-paw-slot="principles">{{principles}}</ul>
  </section>
</body>
</html>
`;
