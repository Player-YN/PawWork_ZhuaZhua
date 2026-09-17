"""Check a load root's manifest, literal local imports/resources, and optional source parity.

This is a static integrity check, not a Chrome runtime or model smoke test.
"""
from __future__ import annotations
import argparse
import fnmatch
import hashlib
import json
import re
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import unquote, urlsplit


class Resources(HTMLParser):
    def __init__(self):
        super().__init__()
        self.refs: list[str] = []

    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        if tag in {'script', 'img', 'iframe', 'source'} and attrs.get('src'):
            self.refs.append(attrs['src'])
        if tag == 'link' and attrs.get('href'):
            self.refs.append(attrs['href'])


def verify(root: Path, source: Path | None = None) -> dict:
    root = root.resolve()
    errors: list[str] = []
    checked = 0
    files = {p.relative_to(root).as_posix(): p for p in root.rglob('*') if p.is_file()}
    if 'manifest.json' not in files:
        raise ValueError('Missing manifest.json at the load root')
    manifest = json.loads((root / 'manifest.json').read_text(encoding='utf-8'))

    def require(ref: str, owner: str = 'manifest.json', wildcard: bool = False):
        nonlocal checked
        url = urlsplit(ref)
        if url.scheme or url.netloc or not url.path:
            return
        ref = unquote(url.path)
        path = ((root / ref.lstrip('/')) if ref.startswith('/') else (root / owner).parent / ref).resolve()
        if not path.is_relative_to(root):
            errors.append(f'{owner}: path escapes load root: {ref}')
            return
        relative = path.relative_to(root).as_posix()
        checked += 1
        if wildcard and any(char in relative for char in '*?['):
            if not any(fnmatch.fnmatch(name, relative) for name in files):
                errors.append(f'{owner}: missing resource pattern: {relative}')
        elif relative not in files:
            errors.append(f'{owner}: missing {relative}')

    for ref in manifest.get('icons', {}).values():
        require(ref)
    for section, field in [('background', 'service_worker'), ('side_panel', 'default_path'),
                           ('action', 'default_popup'), ('options_ui', 'page'), ('devtools_page', '')]:
        value = manifest.get(section, {})
        ref = value.get(field) if isinstance(value, dict) else value
        if ref:
            require(ref)
    for ref in manifest.get('sandbox', {}).get('pages', []):
        require(ref)
    for script in manifest.get('content_scripts', []):
        for ref in script.get('js', []) + script.get('css', []):
            require(ref)
    for group in manifest.get('web_accessible_resources', []):
        for ref in group.get('resources', []):
            require(ref, wildcard=True)

    # Literal imports only; computed URLs still need the browser smoke test.
    imports = re.compile(r'''(?:\b(?:import|export)\s+(?:[^;"'`]*?\s+from\s*)?["']([^"']+)["']|\bimport\(\s*["']([^"']+)["']\s*\))''')
    css_urls = re.compile(r'''url\(\s*["']?([^\s\)"']+)["']?\s*\)''')
    for name, path in sorted(files.items()):
        if path.suffix in {'.js', '.mjs'}:
            text = path.read_text(encoding='utf-8')
            for match in imports.finditer(text):
                ref = match.group(1) or match.group(2)
                if ref.startswith(('.', '/')):
                    require(ref, name)
        elif path.suffix == '.html':
            parser = Resources()
            parser.feed(path.read_text(encoding='utf-8'))
            for ref in parser.refs:
                require(ref, name)
        elif path.suffix == '.css':
            for ref in css_urls.findall(path.read_text(encoding='utf-8')):
                require(ref, name)
    if source:
        from pack_extension import runtime_files
        for name in runtime_files(source):
            packed = files.get(name)
            if not packed:
                errors.append(f'source parity: missing {name}')
            elif hashlib.sha256(packed.read_bytes()).digest() != hashlib.sha256((source / name).read_bytes()).digest():
                errors.append(f'source parity: different bytes in {name}')
    if errors:
        raise ValueError('\n'.join(errors))
    return {'version': manifest['version'], 'files': len(files), 'localReferences': checked,
            'sourceParity': source is not None, 'status': 'passed', 'browserRuntimeVerified': False}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('root', type=Path)
    parser.add_argument('--source', type=Path)
    args = parser.parse_args()
    try:
        result = verify(args.root, args.source)
    except (ValueError, OSError) as error:
        parser.exit(1, f'Extension integrity failed:\n{error}\n')
    print(json.dumps(result, indent=2))


if __name__ == '__main__':
    main()
