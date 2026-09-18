---
name: install-zhuazhua
description: >-
  Installs 爪爪 (PawWork_ZhuaZhua) into the user's daily Google Chrome as an
  unpacked MV3 extension: clone or pull, pack, launch with --load-extension on
  the default profile, then hand the human the Chrome gates (pin, Allow User
  Scripts, side panel, ⚙️ key). Use when the user asks to install 爪爪, PawWork,
  ZhuaZhua, load the unpacked extension, or pastes
  “按 skills/install-zhuazhua 把爪爪装进 Chrome”.
---

# Install 爪爪 into Chrome

Do every machine step, in order. Do not pause for a design review. The human only flips Chrome UI gates you cannot.

## Facts

- Official clone: `https://github.com/Player-YN/PawWork_ZhuaZhua.git`
- **Load root** = the folder whose root file is `manifest.json`. Repo root works. After pack, prefer `<repo>/extension/` when that folder has `manifest.json`.
- Chrome binary (quote paths):
  - macOS: `/Applications/Google Chrome.app/Contents/MacOS/Google Chrome`
  - Windows: `C:\Program Files\Google\Chrome\Application\chrome.exe`
  - Linux: `google-chrome` / `google-chrome-stable` on `PATH`, else `/usr/bin/google-chrome`
- Launch the **default** profile. Do not pass `--user-data-dir`.
- Do not write into Chrome's profile `Extensions` folder. Do not edit `Secure Preferences`. Do not drop a CRX.
- Display name on the card: `爪爪 · 完全解放版`.

## 1. Get the tree

Walk up from cwd (and, if needed, `./PawWork_ZhuaZhua` and `~/PawWork_ZhuaZhua`) until you find `manifest.json`.

This repo: `manifest.json` name is `爪爪 · 完全解放版`, or `git remote` contains `Player-YN/PawWork_ZhuaZhua`.

- Already this repo → `cd` there. If it is a git checkout of that remote, `git pull --ff-only`.
- Not this repo → `git clone https://github.com/Player-YN/PawWork_ZhuaZhua.git PawWork_ZhuaZhua` into cwd (or use the existing nearby clone) and `cd` into it.

## 2. Pack, then pick the load root

If `python3` or `python` exists:

```text
python3 scripts/pack_extension.py
```

Load root, in this order:

1. `<repo>/extension/` when it contains `manifest.json`
2. else the repo root (`manifest.json` is already there)

Print the absolute load root. You will give that path to Chrome and to the human.

If `skills/install-zhuazhua/scripts/resolve_chrome_load.py` exists, run it now (`python` if `python3` is missing) and reuse `os`, `chrome`, `load_root`, `chrome_running`. If the script is missing, keep the inline commands below.

```text
python3 skills/install-zhuazhua/scripts/resolve_chrome_load.py
```

## 3. Resolve Chrome

Pick the first existing binary (or `$CHROME_BIN` if set):

**macOS**

```text
/Applications/Google Chrome.app/Contents/MacOS/Google Chrome
$HOME/Applications/Google Chrome.app/Contents/MacOS/Google Chrome
```

**Windows**

```text
C:\Program Files\Google\Chrome\Application\chrome.exe
C:\Program Files (x86)\Google\Chrome\Application\chrome.exe
%LOCALAPPDATA%\Google\Chrome\Application\chrome.exe
```

**Linux**

```text
google-chrome-stable
google-chrome
/usr/bin/google-chrome-stable
/usr/bin/google-chrome
```

If no binary: tell the human Google Chrome is not at the usual path on this machine, then stop.

## 4. If Chrome is running, ask

Detect:

- macOS: `pgrep -x "Google Chrome"`
- Windows: `tasklist /FI "IMAGENAME eq chrome.exe"`
- Linux: `pgrep -x google-chrome` / `pgrep -x google-chrome-stable` / `pgrep -x chrome`

If it is running, **ask and wait**. Do not quit, kill, or relaunch until they answer. Do not invent a second profile.

Say:

> Chrome 正在运行。爪爪要装进你日常用的这个 Chrome（同一套登录）。要退出 Chrome 再拉起吗？所有窗口和标签会关掉。

- **No** → keep their Chrome. Open `chrome://extensions` in that Chrome. Tell them the one GUI step: Developer mode → **Load unpacked** → the absolute load root. Then go to step 6.
- **Yes** → quit, wait until the Chrome process is gone, then step 5.

Quit after yes:

- macOS: `osascript -e 'tell application "Google Chrome" to quit'`
- Windows: `taskkill /IM chrome.exe`
- Linux: `pkill -TERM -x google-chrome-stable`; `pkill -TERM -x google-chrome`; `pkill -TERM -x chrome`

If the process is still there, tell them to close the remaining Chrome windows and wait until it is gone.

Open extensions in an already-running Chrome:

- macOS: `open -a "Google Chrome" "chrome://extensions"`
- Windows: `"<chrome>" chrome://extensions`
- Linux: `"<chrome>" chrome://extensions`

## 5. Launch on the default profile

Chrome not running, or they said yes and it has quit:

```text
"<chrome>" --load-extension="<absolute-load-root>"
```

Then open the extensions page (same commands as the end of step 4).

On first install the extension opens `chrome://extensions/?id=<runtime.id>` itself (the details card). If you later know the id, open that URL.

## 6. Human gates (say this)

> 钉住「爪爪 · 完全解放版」→ 打开扩展详情 → 打开 **Allow User Scripts** → 点工具栏图标打开侧栏。

If the details tab is already open, they only need the User Scripts toggle, the pin, and the side panel.

## 7. Key

One line, then stop:

> ⚙️ 还没有 Key 的话，在那里贴一个 OpenAI 兼容 Key。
