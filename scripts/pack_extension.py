# -*- coding: utf-8 -*-
"""Copy the Chrome load root into extension/ and optionally zip it.

Zip root contains manifest.json (unzip then Load unpacked — no nested junk).
"""
from __future__ import annotations

import argparse
import shutil
import subprocess
import zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DEST = ROOT / "extension"

SKIP_SUFFIXES = {".md"}


def tracked_files() -> list[str]:
    out = subprocess.check_output(
        ["git", "ls-files", "-z", "manifest.json", "LICENSE", "icons", "src"],
        cwd=ROOT,
    )
    return [p for p in out.decode("utf-8").split("\0") if p]


def include(rel: str) -> bool:
    path = Path(rel)
    if path.suffix.lower() in SKIP_SUFFIXES:
        return False
    return True


def copy_tree() -> list[str]:
    if DEST.exists():
        shutil.rmtree(DEST)
    DEST.mkdir(parents=True)
    copied: list[str] = []
    for rel in tracked_files():
        if not include(rel):
            continue
        src = ROOT / rel
        if not src.is_file():
            continue
        dst = DEST / rel
        dst.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(src, dst)
        copied.append(rel.replace("\\", "/"))
    return copied


def write_readme() -> None:
    (DEST / "README.md").write_text(
        """# 爪爪 · 完全解放版

Chrome MV3 **unpacked** load root. Not on the Chrome Web Store.

1. Chrome → `chrome://extensions` → Developer mode
2. **Load unpacked** → select **this folder** (it contains `manifest.json`)
3. Open the side panel → paste your API key → send a task on a normal webpage

Need Chrome 135+. Chrome 138+: allow **User Scripts** on the extension card for `sys.eval` / page fetch. Close F12 on the target tab before CDP.

After you change files here, click **重新加载** on the extension card. Restricted pages (`chrome://`, Web Store) return `NEED_PAGE`. You must bring your own model key.
""",
        encoding="utf-8",
    )


def write_zip(zip_path: Path) -> None:
    zip_path.parent.mkdir(parents=True, exist_ok=True)
    with zipfile.ZipFile(zip_path, "w", compression=zipfile.ZIP_DEFLATED) as zf:
        for path in sorted(DEST.rglob("*")):
            if path.is_file():
                zf.write(path, path.relative_to(DEST).as_posix())


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--zip", type=Path, help="Write a zip whose root is manifest.json")
    args = parser.parse_args()
    copied = copy_tree()
    write_readme()
    print(f"extension/ files: {len(copied) + 1}")
    print("top-level:", ", ".join(sorted(p.name for p in DEST.iterdir())))
    if args.zip:
        write_zip(args.zip.resolve())
        print("zip", args.zip.resolve(), args.zip.resolve().stat().st_size)


if __name__ == "__main__":
    main()
