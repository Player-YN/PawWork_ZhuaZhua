# -*- coding: utf-8 -*-
"""Build product-native SVG scenes + motion specs for README GIFs."""
from pathlib import Path
import json

HERE = Path(__file__).resolve().parent
NAME = "\u722a\u722a \u00b7 \u5b8c\u5168\u89e3\u653e\u7248"
SHORT = "\u722a\u722a"
SANS = "Microsoft YaHei, Segoe UI, sans-serif"
MONO = "Consolas, Cascadia Mono, monospace"


def write(name, text):
    p = HERE / name
    p.write_text(text, encoding="utf-8")
    print("wrote", p.name, p.stat().st_size)


def paw(cx, cy, fill="#F43F8C", s=1.0):
    """Geometric paw: four pads + palm."""
    r = 7 * s
    pads = [
        (cx - 16 * s, cy - 18 * s, r * 0.85),
        (cx - 4 * s, cy - 22 * s, r),
        (cx + 8 * s, cy - 20 * s, r * 0.9),
        (cx + 18 * s, cy - 12 * s, r * 0.75),
    ]
    parts = [f'<circle cx="{x}" cy="{y}" r="{rr}" fill="{fill}"/>' for x, y, rr in pads]
    parts.append(
        f'<ellipse cx="{cx}" cy="{cy + 6 * s}" rx="{18 * s}" ry="{14 * s}" fill="{fill}"/>'
    )
    return "".join(parts)


# ── Intro ──────────────────────────────────────────────────────────────────
intro = f'''<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="440" viewBox="0 0 1200 440" role="img" aria-labelledby="title desc">
  <title id="title">{NAME} — Chrome is the computer</title>
  <desc id="desc">A Chrome window is the machine. The side panel agent docks onto it after you load the unpacked folder.</desc>
  <rect id="base-frame" width="1200" height="440" fill="#050506"/>

  <g id="stage-chrome">
    <text x="48" y="42" fill="#F43F8C" font-family="{MONO}" font-size="15">BROWSER = OS</text>
    <text x="48" y="78" fill="#F5F2F4" font-family="{SANS}" font-size="28" font-weight="700">{SHORT} sits inside the logged-in Chrome</text>
    <rect x="48" y="100" width="720" height="300" rx="16" fill="#121214" stroke="#2A2A30" stroke-width="1.5"/>
    <circle cx="76" cy="124" r="6" fill="#FB7185"/>
    <circle cx="96" cy="124" r="6" fill="#FBBF24"/>
    <circle cx="116" cy="124" r="6" fill="#34D399"/>
    <rect x="148" y="112" width="120" height="24" rx="8" fill="#1A1A1F"/>
    <rect x="156" y="119" width="10" height="10" rx="2" fill="#A39AA3"/>
    <text x="172" y="129" fill="#A39AA3" font-family="{SANS}" font-size="12">mail</text>
    <rect x="276" y="112" width="132" height="24" rx="8" fill="#0C0C0F" stroke="#F43F8C" stroke-width="1"/>
    <rect x="284" y="119" width="10" height="10" rx="2" fill="#F43F8C"/>
    <text x="300" y="129" fill="#F5F2F4" font-family="{SANS}" font-size="12">shop (logged in)</text>
    <rect x="416" y="112" width="88" height="24" rx="8" fill="#1A1A1F"/>
    <text x="432" y="129" fill="#A39AA3" font-family="{SANS}" font-size="12">docs</text>
    <rect x="72" y="148" width="672" height="28" rx="8" fill="#0C0C0F"/>
    <circle cx="90" cy="162" r="6" fill="none" stroke="#34D399" stroke-width="1.5"/>
    <text x="104" y="167" fill="#6B636B" font-family="{MONO}" font-size="13">https://store.example/orders</text>
  </g>

  <g id="page-scene">
    <rect x="72" y="188" width="672" height="196" rx="8" fill="#1A1A1F"/>
    <rect x="88" y="204" width="200" height="16" rx="4" fill="#F43F8C"/>
    <rect x="88" y="230" width="280" height="10" rx="3" fill="#3A3A42"/>
    <rect x="88" y="248" width="240" height="10" rx="3" fill="#2A2A30"/>
    <rect x="400" y="204" width="228" height="88" rx="8" fill="#121214"/>
    <rect x="416" y="220" width="80" height="56" rx="6" fill="#2A1020"/>
    <rect x="508" y="224" width="100" height="8" rx="3" fill="#A39AA3"/>
    <rect x="508" y="240" width="72" height="8" rx="3" fill="#6B636B"/>
    <rect x="508" y="260" width="48" height="16" rx="4" fill="#F43F8C"/>
    <rect x="88" y="292" width="160" height="28" rx="6" fill="#0C0C0F" stroke="#3A3A42"/>
    <rect x="100" y="302" width="90" height="8" rx="3" fill="#6B636B"/>
    <rect x="260" y="292" width="160" height="28" rx="6" fill="#0C0C0F" stroke="#3A3A42"/>
    <rect x="272" y="302" width="70" height="8" rx="3" fill="#6B636B"/>
    <rect x="436" y="292" width="88" height="28" rx="6" fill="#F43F8C"/>
    <text x="456" y="311" fill="#050506" font-family="{SANS}" font-size="13" font-weight="700">Pay</text>
    <rect x="88" y="336" width="40" height="28" rx="6" fill="#2A1020"/>
    {paw(108, 350, "#F43F8C", 0.55)}
  </g>

  <g id="side-panel">
    <rect x="792" y="100" width="360" height="300" rx="16" fill="#0C0C0F" stroke="#F43F8C" stroke-width="1.5"/>
    <rect x="808" y="116" width="328" height="36" rx="8" fill="#121214"/>
    {paw(828, 134, "#F43F8C", 0.45)}
    <text x="848" y="140" fill="#F5F2F4" font-family="{SANS}" font-size="16" font-weight="700">{SHORT}</text>
    <text x="980" y="140" fill="#6B636B" font-family="{MONO}" font-size="12">side panel</text>
    <rect x="820" y="168" width="220" height="44" rx="10" fill="#121214"/>
    <text x="834" y="196" fill="#A39AA3" font-family="{SANS}" font-size="13">Load unpacked folder</text>
    <rect x="900" y="224" width="228" height="52" rx="10" fill="#1A1020" stroke="#F43F8C"/>
    <text x="914" y="246" fill="#F5F2F4" font-family="{SANS}" font-size="14">Agent on this machine.</text>
    <text x="914" y="266" fill="#A39AA3" font-family="{SANS}" font-size="13">Cookies stay in Chrome.</text>
    <rect x="808" y="352" width="328" height="32" rx="8" fill="#121214"/>
    <text x="822" y="373" fill="#6B636B" font-family="{SANS}" font-size="13">Send a task on this tab</text>
    <circle cx="1120" cy="368" r="8" fill="#F43F8C"/>
  </g>

  <g id="claw-link">
    <path d="M748 250 C770 250 780 248 792 220" fill="none" stroke="#F43F8C" stroke-width="2.5"/>
    <path d="M748 270 C772 274 782 280 792 300" fill="none" stroke="#F43F8C" stroke-width="2" opacity="0.55"/>
    <path d="M748 230 C768 220 778 200 792 168" fill="none" stroke="#E879F9" stroke-width="1.5" opacity="0.7"/>
  </g>
</svg>
'''
write("intro.svg", intro)
write(
    "intro-motion.json",
    json.dumps(
        {
            "width": 1200,
            "fps": 30,
            "duration": 5.6,
            "colors": 256,
            "dither": "none",
            "clip_to_base_alpha": True,
            "max_size_mb": 2.4,
            "layers": [
                {"id": "side-panel", "enter": {"start": 0.35, "end": 1.25, "from": [36, 0]}, "exit": {"start": 4.7, "end": 5.5, "to": [20, 0]}},
                {"id": "claw-link", "enter": {"start": 1.15, "end": 1.9, "from": [14, 0]}, "exit": {"start": 4.7, "end": 5.5, "to": [10, 0]}},
            ],
        },
        indent=2,
    ),
)

# ── Features ───────────────────────────────────────────────────────────────
features = f'''<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="500" viewBox="0 0 1200 500" role="img" aria-labelledby="title desc">
  <title id="title">Mechanism: action, run+sys, sheet/doc/site</title>
  <desc id="desc">Live-page highlights, a page-identity fetch into a file, and three office canvases. sys is inside run.</desc>
  <rect id="base-frame" width="1200" height="500" fill="#050506"/>
  <text x="40" y="40" fill="#F43F8C" font-family="{MONO}" font-size="15">MECHANISM</text>
  <text x="40" y="74" fill="#F5F2F4" font-family="{SANS}" font-size="26" font-weight="700">Operate the tab. Keep artifacts.</text>

  <g id="live-page">
    <rect x="40" y="96" width="430" height="280" rx="16" fill="#121214" stroke="#2A2A30"/>
    <text x="56" y="122" fill="#6B636B" font-family="{MONO}" font-size="13">action  snapshot t12</text>
    <rect x="56" y="138" width="398" height="220" rx="10" fill="#1A1A1F"/>
    <rect x="72" y="156" width="140" height="12" rx="3" fill="#3A3A42"/>
    <rect x="72" y="184" width="210" height="32" rx="6" fill="#0C0C0F" stroke="#3A3A42"/>
    <rect x="84" y="194" width="80" height="10" rx="3" fill="#6B636B"/>
    <rect x="72" y="230" width="210" height="32" rx="6" fill="#0C0C0F" stroke="#3A3A42"/>
    <rect x="84" y="240" width="110" height="10" rx="3" fill="#6B636B"/>
    <rect x="72" y="280" width="96" height="32" rx="6" fill="#2A2A30"/>
    <text x="96" y="301" fill="#A39AA3" font-family="{SANS}" font-size="14" font-weight="700">Save</text>
    <text x="72" y="340" fill="#6B636B" font-family="{MONO}" font-size="12">same rev  /  no CSS selectors</text>
  </g>

  <g id="run-sys">
    <rect x="490" y="96" width="360" height="280" rx="16" fill="#0C0C0F" stroke="#34D399" stroke-width="1.5"/>
    <text x="506" y="122" fill="#34D399" font-family="{MONO}" font-size="13">run  +  sys.fetch as:page</text>
    <rect x="506" y="140" width="328" height="120" rx="10" fill="#050506"/>
    <text x="520" y="164" fill="#6B636B" font-family="{MONO}" font-size="13">await sys.fetch(&#123;</text>
    <text x="538" y="186" fill="#F5F2F4" font-family="{MONO}" font-size="13">as: "page",</text>
    <text x="538" y="208" fill="#F5F2F4" font-family="{MONO}" font-size="13">url: "/api/orders.csv",</text>
    <text x="538" y="230" fill="#F43F8C" font-family="{MONO}" font-size="13">saveTo: "/scratch/o.csv"</text>
    <text x="520" y="250" fill="#6B636B" font-family="{MONO}" font-size="13">&#125;)</text>
    <text x="506" y="360" fill="#A39AA3" font-family="{SANS}" font-size="13">Page cookies. Not a model tool.</text>
  </g>

  <g id="action-hl">
    <rect x="72" y="230" width="210" height="32" rx="6" fill="#0C0C0F" stroke="#F43F8C" stroke-width="2"/>
    <rect x="84" y="240" width="110" height="10" rx="3" fill="#F5F2F4"/>
    <rect x="288" y="226" width="36" height="18" rx="4" fill="#F43F8C"/>
    <text x="294" y="239" fill="#050506" font-family="{MONO}" font-size="11">a7</text>
    <rect x="72" y="280" width="96" height="32" rx="6" fill="#34D399"/>
    <text x="96" y="301" fill="#050506" font-family="{SANS}" font-size="14" font-weight="700">Save</text>
    <rect x="176" y="276" width="36" height="18" rx="4" fill="#F43F8C"/>
    <text x="182" y="289" fill="#050506" font-family="{MONO}" font-size="11">a9</text>
  </g>

  <g id="fetch-pipe">
    <circle cx="524" cy="292" r="16" fill="#2A1020" stroke="#F43F8C"/>
    <text x="517" y="297" fill="#F43F8C" font-family="{SANS}" font-size="12">ck</text>
    <path d="M544 292 H620" stroke="#F43F8C" stroke-width="2"/>
    <polygon points="620,286 632,292 620,298" fill="#F43F8C"/>
    <rect x="640" y="272" width="88" height="40" rx="8" fill="#121214"/>
    <rect x="652" y="282" width="22" height="20" rx="3" fill="#34D399"/>
    <text x="678" y="297" fill="#F5F2F4" font-family="{MONO}" font-size="12">o.csv</text>
  </g>

  <g id="canvas-sheet">
    <rect x="870" y="96" width="290" height="84" rx="12" fill="#121214"/>
    <text x="886" y="118" fill="#6B636B" font-family="{MONO}" font-size="12">sheet</text>
    <g>
      <rect x="886" y="128" width="28" height="18" rx="2" fill="#2A1020"/>
      <rect x="918" y="128" width="28" height="18" rx="2" fill="#1A1A1F"/>
      <rect x="950" y="128" width="28" height="18" rx="2" fill="#F43F8C"/>
      <rect x="982" y="128" width="28" height="18" rx="2" fill="#1A1A1F"/>
      <rect x="1014" y="128" width="28" height="18" rx="2" fill="#1A1A1F"/>
      <rect x="1046" y="128" width="28" height="18" rx="2" fill="#2A1020"/>
      <rect x="886" y="150" width="28" height="18" rx="2" fill="#1A1A1F"/>
      <rect x="918" y="150" width="28" height="18" rx="2" fill="#34D399"/>
      <rect x="950" y="150" width="28" height="18" rx="2" fill="#1A1A1F"/>
      <rect x="982" y="150" width="28" height="18" rx="2" fill="#2A1020"/>
      <rect x="1014" y="150" width="28" height="18" rx="2" fill="#1A1A1F"/>
      <rect x="1046" y="150" width="28" height="18" rx="2" fill="#1A1A1F"/>
    </g>
  </g>

  <g id="canvas-doc">
    <rect x="870" y="192" width="290" height="84" rx="12" fill="#121214"/>
    <text x="886" y="214" fill="#6B636B" font-family="{MONO}" font-size="12">doc</text>
    <rect x="886" y="224" width="70" height="8" rx="2" fill="#F5F2F4"/>
    <rect x="886" y="238" width="200" height="6" rx="2" fill="#3A3A42"/>
    <rect x="886" y="250" width="176" height="6" rx="2" fill="#2A2A30"/>
    <rect x="1100" y="220" width="40" height="44" rx="4" fill="#1A1A1F" stroke="#3A3A42"/>
  </g>

  <g id="canvas-site">
    <rect x="870" y="288" width="290" height="88" rx="12" fill="#121214"/>
    <text x="886" y="310" fill="#6B636B" font-family="{MONO}" font-size="12">web  site</text>
    <rect x="886" y="320" width="258" height="14" rx="3" fill="#2A1020"/>
    <rect x="886" y="340" width="80" height="22" rx="4" fill="#1A1A1F"/>
    <rect x="974" y="340" width="80" height="22" rx="4" fill="#1A1A1F"/>
    <rect x="1062" y="340" width="82" height="22" rx="4" fill="#F43F8C"/>
  </g>

  <g id="plan-card">
    <rect x="40" y="396" width="1120" height="76" rx="14" fill="#121214" stroke="#2A2A30"/>
    <rect x="56" y="414" width="14" height="14" rx="3" fill="none" stroke="#F43F8C" stroke-width="2"/>
    <rect x="60" y="418" width="6" height="6" rx="1" fill="#F43F8C"/>
    <text x="82" y="426" fill="#F5F2F4" font-family="{SANS}" font-size="16" font-weight="600">Plan card  /  this session only</text>
    <text x="82" y="450" fill="#A39AA3" font-family="{SANS}" font-size="14">clarify pauses the turn. acquire brings public web in. No Design/Slides.</text>
    {paw(1120, 434, "#F43F8C", 0.7)}
  </g>
</svg>
'''
write("features.svg", features)
write(
    "features-motion.json",
    json.dumps(
        {
            "width": 1200,
            "fps": 30,
            "duration": 5.8,
            "colors": 256,
            "dither": "none",
            "clip_to_base_alpha": True,
            "max_size_mb": 2.6,
            "layers": [
                {"id": "action-hl", "enter": {"start": 0.25, "end": 1.05, "from": [0, 16]}, "exit": {"start": 4.9, "end": 5.7, "to": [0, 10]}},
                {"id": "fetch-pipe", "enter": {"start": 0.7, "end": 1.5, "from": [20, 0]}, "exit": {"start": 4.9, "end": 5.7, "to": [12, 0]}},
                {"id": "plan-card", "enter": {"start": 1.4, "end": 2.2, "from": [0, 18]}, "exit": {"start": 4.9, "end": 5.7, "to": [0, 12]}},
            ],
        },
        indent=2,
    ),
)

# ── Use cases ──────────────────────────────────────────────────────────────
usecases = f'''<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="520" viewBox="0 0 1200 520" role="img" aria-labelledby="title desc">
  <title id="title">Userscript-class jobs on a logged-in browser</title>
  <desc id="desc">Restyle, logged-in scrape, form fill, page-identity download, tab batch, reading aid on an SPA. No userscript store. No tldraw.</desc>
  <rect id="base-frame" width="1200" height="520" fill="#050506"/>
  <text x="40" y="40" fill="#F43F8C" font-family="{MONO}" font-size="15">USERSCRIPT-CLASS</text>
  <text x="40" y="74" fill="#F5F2F4" font-family="{SANS}" font-size="26" font-weight="700">Same jobs. Agent instead of a script list.</text>

  <g id="uc-stage">
    <rect x="40" y="96" width="360" height="190" rx="16" fill="#121214"/>
    <text x="56" y="122" fill="#6B636B" font-family="{MONO}" font-size="12">restyle / hide clutter</text>
    <rect x="420" y="96" width="360" height="190" rx="16" fill="#121214"/>
    <text x="436" y="122" fill="#6B636B" font-family="{MONO}" font-size="12">logged-in scrape</text>
    <rect x="800" y="96" width="360" height="190" rx="16" fill="#121214"/>
    <text x="816" y="122" fill="#6B636B" font-family="{MONO}" font-size="12">form fill</text>
    <rect x="40" y="306" width="360" height="180" rx="16" fill="#121214"/>
    <text x="56" y="332" fill="#6B636B" font-family="{MONO}" font-size="12">download as the page</text>
    <rect x="420" y="306" width="360" height="180" rx="16" fill="#121214"/>
    <text x="436" y="332" fill="#6B636B" font-family="{MONO}" font-size="12">tab batch / SPA remount</text>
    <rect x="800" y="306" width="360" height="180" rx="16" fill="#121214"/>
    <text x="816" y="332" fill="#6B636B" font-family="{MONO}" font-size="12">reading aid</text>
  </g>

  <g id="uc-restyle">
    <rect x="56" y="138" width="150" height="128" rx="8" fill="#1A1A1F"/>
    <rect x="68" y="150" width="126" height="18" rx="3" fill="#3A3A42"/>
    <rect x="68" y="176" width="60" height="70" rx="4" fill="#2A2A30"/>
    <rect x="136" y="176" width="58" height="28" rx="3" fill="#3A3A42"/>
    <path d="M74 156 L188 160" stroke="#FB7185" stroke-width="3"/>
    <path d="M78 210 L118 236" stroke="#FB7185" stroke-width="3"/>
    <rect x="220" y="138" width="160" height="128" rx="8" fill="#1A1020"/>
    <rect x="232" y="150" width="136" height="18" rx="3" fill="#F43F8C"/>
    <rect x="232" y="178" width="136" height="10" rx="3" fill="#A39AA3"/>
    <rect x="232" y="196" width="100" height="10" rx="3" fill="#6B636B"/>
    <rect x="232" y="226" width="64" height="22" rx="4" fill="#34D399"/>
  </g>

  <g id="uc-scrape">
    <rect x="436" y="142" width="120" height="120" rx="8" fill="#0C0C0F"/>
    <circle cx="496" cy="186" r="18" fill="none" stroke="#34D399" stroke-width="2"/>
    <rect x="478" y="208" width="36" height="20" rx="4" fill="#2A1020"/>
    <text x="456" y="248" fill="#A39AA3" font-family="{MONO}" font-size="11">session cookie</text>
    <path d="M564 200 H600" stroke="#F43F8C" stroke-width="2"/>
    <polygon points="600,194 612,200 600,206" fill="#F43F8C"/>
    <g>
      <rect x="624" y="150" width="36" height="16" rx="2" fill="#F43F8C"/>
      <rect x="664" y="150" width="36" height="16" rx="2" fill="#2A2A30"/>
      <rect x="704" y="150" width="48" height="16" rx="2" fill="#2A2A30"/>
      <rect x="624" y="172" width="36" height="16" rx="2" fill="#1A1A1F"/>
      <rect x="664" y="172" width="36" height="16" rx="2" fill="#34D399"/>
      <rect x="704" y="172" width="48" height="16" rx="2" fill="#1A1A1F"/>
      <rect x="624" y="194" width="36" height="16" rx="2" fill="#1A1A1F"/>
      <rect x="664" y="194" width="36" height="16" rx="2" fill="#1A1A1F"/>
      <rect x="704" y="194" width="48" height="16" rx="2" fill="#F5F2F4"/>
      <rect x="624" y="216" width="36" height="16" rx="2" fill="#1A1A1F"/>
      <rect x="664" y="216" width="36" height="16" rx="2" fill="#2A1020"/>
      <rect x="704" y="216" width="48" height="16" rx="2" fill="#1A1A1F"/>
    </g>
  </g>

  <g id="uc-fill">
    <rect x="816" y="148" width="220" height="28" rx="6" fill="#0C0C0F" stroke="#F43F8C"/>
    <rect x="828" y="158" width="120" height="8" rx="2" fill="#F5F2F4"/>
    <rect x="1052" y="154" width="32" height="16" rx="3" fill="#F43F8C"/>
    <text x="1058" y="166" fill="#050506" font-family="{MONO}" font-size="10">a3</text>
    <rect x="816" y="188" width="220" height="28" rx="6" fill="#0C0C0F" stroke="#F43F8C"/>
    <rect x="828" y="198" width="88" height="8" rx="2" fill="#F5F2F4"/>
    <rect x="1052" y="194" width="32" height="16" rx="3" fill="#F43F8C"/>
    <text x="1058" y="206" fill="#050506" font-family="{MONO}" font-size="10">a4</text>
    <rect x="816" y="228" width="72" height="28" rx="6" fill="#34D399"/>
    <text x="832" y="247" fill="#050506" font-family="{SANS}" font-size="13" font-weight="700">fill</text>
  </g>

  <g id="uc-download">
    <rect x="80" y="356" width="72" height="88" rx="8" fill="#1A1A1F" stroke="#3A3A42"/>
    <rect x="92" y="368" width="48" height="36" rx="4" fill="#2A1020"/>
    <text x="100" y="432" fill="#A39AA3" font-family="{MONO}" font-size="11">PDF</text>
    <path d="M168 392 H220" stroke="#FBBF24" stroke-width="2"/>
    <polygon points="220,386 232,392 220,398" fill="#FBBF24"/>
    <rect x="248" y="360" width="120" height="96" rx="10" fill="#0C0C0F"/>
    <path d="M308 384 V424" stroke="#FBBF24" stroke-width="3"/>
    <polygon points="296,416 308,432 320,416" fill="#FBBF24"/>
    <circle cx="272" cy="384" r="10" fill="none" stroke="#34D399" stroke-width="2"/>
    <text x="264" y="444" fill="#6B636B" font-family="{MONO}" font-size="11">sys.download</text>
  </g>

  <g id="uc-tabs">
    <rect x="436" y="352" width="70" height="26" rx="8" fill="#F43F8C"/>
    <rect x="512" y="352" width="70" height="26" rx="8" fill="#F43F8C"/>
    <rect x="588" y="352" width="70" height="26" rx="8" fill="#1A1A1F"/>
    <rect x="664" y="352" width="70" height="26" rx="8" fill="#F43F8C"/>
    <rect x="436" y="396" width="328" height="64" rx="10" fill="#0C0C0F"/>
    <rect x="452" y="412" width="180" height="10" rx="3" fill="#3A3A42"/>
    <rect x="452" y="430" width="120" height="10" rx="3" fill="#2A2A30"/>
    <text x="640" y="434" fill="#34D399" font-family="{MONO}" font-size="12">navigate</text>
  </g>

  <g id="uc-read">
    <rect x="816" y="352" width="328" height="108" rx="10" fill="#1A1020"/>
    <text x="836" y="396" fill="#F5F2F4" font-family="{SANS}" font-size="28" font-weight="700">Larger type.</text>
    <text x="836" y="432" fill="#A39AA3" font-family="{SANS}" font-size="16">Injected overlay. Same tab.</text>
    {paw(1108, 420, "#F43F8C", 0.65)}
  </g>
</svg>
'''
write("usecases.svg", usecases)
write(
    "usecases-motion.json",
    json.dumps(
        {
            "width": 1200,
            "fps": 30,
            "duration": 6.0,
            "colors": 256,
            "dither": "none",
            "clip_to_base_alpha": True,
            "max_size_mb": 2.8,
            "layers": [
                {"id": "uc-restyle", "enter": {"start": 0.12, "end": 0.85, "from": [0, 22]}, "exit": {"start": 5.1, "end": 5.92, "to": [0, 14]}},
                {"id": "uc-scrape", "enter": {"start": 0.35, "end": 1.1, "from": [0, 22]}, "exit": {"start": 5.1, "end": 5.92, "to": [0, 14]}},
                {"id": "uc-fill", "enter": {"start": 0.58, "end": 1.35, "from": [0, 22]}, "exit": {"start": 5.1, "end": 5.92, "to": [0, 14]}},
                {"id": "uc-download", "enter": {"start": 0.9, "end": 1.7, "from": [0, 22]}, "exit": {"start": 5.1, "end": 5.92, "to": [0, 14]}},
                {"id": "uc-tabs", "enter": {"start": 1.15, "end": 1.95, "from": [0, 22]}, "exit": {"start": 5.1, "end": 5.92, "to": [0, 14]}},
                {"id": "uc-read", "enter": {"start": 1.4, "end": 2.2, "from": [0, 22]}, "exit": {"start": 5.1, "end": 5.92, "to": [0, 14]}},
            ],
        },
        indent=2,
    ),
)

hero = f'''<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="320" viewBox="0 0 1200 320" role="img" aria-labelledby="title desc">
  <title id="title">{NAME}</title>
  <desc id="desc">Treat the already-logged-in Chrome as a programmable computer. {SHORT} is the agent on that machine.</desc>
  <rect width="1200" height="320" rx="26" fill="#050506"/>
  <rect x="36" y="24" width="1128" height="272" rx="18" fill="#0C0C0F" stroke="#2A2A30"/>
  <text x="64" y="64" fill="#F43F8C" font-family="{MONO}" font-size="16">pawwork-sys-v1  /  unpacked  /  BYOK</text>
  <text x="64" y="124" fill="#F5F2F4" font-family="{SANS}" font-size="48" font-weight="700">{NAME}</text>
  <text x="64" y="168" fill="#A39AA3" font-family="{SANS}" font-size="20">The browser is the computer. {SHORT} is the agent inside it.</text>
  <g transform="translate(64 200)">
    <rect width="168" height="56" rx="10" fill="#121214" stroke="#F43F8C"/>
    <text x="16" y="24" fill="#6B636B" font-family="{MONO}" font-size="12">01 PANEL</text>
    <text x="16" y="44" fill="#F5F2F4" font-family="{SANS}" font-size="16">sidepanel</text>
    <rect x="184" width="168" height="56" rx="10" fill="#121214"/>
    <text x="200" y="24" fill="#6B636B" font-family="{MONO}" font-size="12">02 SW</text>
    <text x="200" y="44" fill="#F5F2F4" font-family="{SANS}" font-size="16">background</text>
    <rect x="368" width="200" height="56" rx="10" fill="#121214" stroke="#34D399"/>
    <text x="384" y="24" fill="#6B636B" font-family="{MONO}" font-size="12">03 OFFSCREEN</text>
    <text x="384" y="44" fill="#F5F2F4" font-family="{SANS}" font-size="16">ToolLoopAgent</text>
    <rect x="584" width="168" height="56" rx="10" fill="#121214"/>
    <text x="600" y="24" fill="#6B636B" font-family="{MONO}" font-size="12">04 PAGE</text>
    <text x="600" y="44" fill="#F5F2F4" font-family="{SANS}" font-size="16">action</text>
    <rect x="768" width="296" height="56" rx="10" fill="#121214"/>
    <text x="784" y="24" fill="#6B636B" font-family="{MONO}" font-size="12">05 CANVAS</text>
    <text x="784" y="44" fill="#F5F2F4" font-family="{SANS}" font-size="16">sheet / doc / site</text>
  </g>
  {paw(1128, 56, "#F43F8C", 0.85)}
</svg>
'''
write("hero.svg", hero)
print("ok")
