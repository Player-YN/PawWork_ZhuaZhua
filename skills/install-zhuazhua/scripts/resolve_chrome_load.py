#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Print Chrome binary, load root, and whether Chrome is running. Stdlib only."""
from __future__ import annotations

import argparse
import os
import platform
import shutil
import subprocess
import sys
from pathlib import Path


def emit(key: str, value: object) -> None:
    print(f"{key}={value}")


def find_manifest_dir(start: Path) -> Path | None:
    p = start.resolve()
    for _ in range(8):
        if (p / "manifest.json").is_file():
            return p
        if p.parent == p:
            break
        p = p.parent
    return None


def resolve_load_root(start: Path) -> tuple[Path | None, Path | None]:
    found = find_manifest_dir(start)
    if found is None:
        return None, None
    packed = found / "extension"
    if (packed / "manifest.json").is_file():
        return packed.resolve(), found.resolve()
    return found.resolve(), found.resolve()


def chrome_candidates(system: str) -> list[Path]:
    home = Path.home()
    if system == "darwin":
        return [
            Path("/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"),
            home / "Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
        ]
    if system == "windows":
        local = os.environ.get("LOCALAPPDATA", "")
        return [
            Path(r"C:\Program Files\Google\Chrome\Application\chrome.exe"),
            Path(r"C:\Program Files (x86)\Google\Chrome\Application\chrome.exe"),
            Path(local) / "Google/Chrome/Application/chrome.exe" if local else None,
        ]
    return [
        Path("/usr/bin/google-chrome-stable"),
        Path("/usr/bin/google-chrome"),
        Path("/opt/google/chrome/google-chrome"),
    ]


def which_chrome_names(system: str) -> list[str]:
    if system == "darwin":
        return []
    if system == "windows":
        return ["chrome.exe"]
    return ["google-chrome-stable", "google-chrome"]


def resolve_chrome(system: str, override: str | None) -> Path | None:
    if override:
        p = Path(override).expanduser()
        return p.resolve() if p.is_file() else None
    for cand in chrome_candidates(system):
        if cand is not None and cand.is_file():
            return cand.resolve()
    for name in which_chrome_names(system):
        hit = shutil.which(name)
        if hit:
            return Path(hit).resolve()
    return None


def chrome_running(system: str) -> bool:
    if system == "darwin":
        r = subprocess.run(["pgrep", "-x", "Google Chrome"], capture_output=True, check=False)
        return r.returncode == 0
    if system == "windows":
        r = subprocess.run(
            ["tasklist", "/FI", "IMAGENAME eq chrome.exe"],
            capture_output=True,
            text=True,
            check=False,
        )
        return "chrome.exe" in (r.stdout or "").lower()
    for name in ("google-chrome-stable", "google-chrome", "chrome"):
        r = subprocess.run(["pgrep", "-x", name], capture_output=True, check=False)
        if r.returncode == 0:
            return True
    return False


def main() -> int:
    parser = argparse.ArgumentParser(description="Resolve Chrome --load-extension inputs")
    parser.add_argument("--cwd", default=os.getcwd(), help="Start directory for manifest walk")
    parser.add_argument("--chrome", default=os.environ.get("CHROME_BIN"), help="Chrome binary override")
    args = parser.parse_args()

    system = platform.system().lower()
    if system.startswith("mingw") or system.startswith("cygwin"):
        system = "windows"

    load_root, repo = resolve_load_root(Path(args.cwd))
    chrome = resolve_chrome(system, args.chrome)

    emit("os", system)
    emit("chrome", chrome if chrome else "")
    emit("load_root", load_root if load_root else "")
    emit("repo", repo if repo else "")
    emit("chrome_running", 1 if chrome_running(system) else 0)

    if chrome is None:
        emit("error", "chrome_not_found")
        return 2
    if load_root is None:
        emit("error", "load_root_not_found")
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
