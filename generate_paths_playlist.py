#!/usr/bin/env python3
"""Generate paths.json from paths_playlist.txt.

Each line in paths_playlist.txt: label, /path/to/directory
Lines starting with # are comments.

Usage:
  python generate_paths_playlist.py
  python generate_paths_playlist.py -i paths_playlist.txt -o public/paths.json
"""

import argparse
import json
from pathlib import Path


def parse_paths_file(filepath):
    entries = []
    with open(filepath, 'r', encoding='utf-8-sig') as f:
        for line in f:
            line = line.strip()
            if not line or line.startswith('#'):
                continue
            parts = line.split(',', 1)
            if len(parts) != 2:
                continue
            label = parts[0].strip()
            path = parts[1].strip()
            if label and path:
                entries.append({'label': label, 'path': path})
    # Sort alphabetically by label
    entries.sort(key=lambda x: x['label'].lower())
    return entries


def main():
    parser = argparse.ArgumentParser(description='Generate paths.json from paths_playlist.txt')
    parser.add_argument('-i', '--input', default='paths_playlist.txt',
                        help='Input file (default: paths_playlist.txt)')
    parser.add_argument('-o', '--output', default='public/paths.json',
                        help='Output JSON file (default: public/paths.json)')
    args = parser.parse_args()

    input_file = Path(args.input)
    if not input_file.exists():
        print(f'File not found: {input_file}')
        return 1

    entries = parse_paths_file(input_file)
    if not entries:
        print('No entries found.')
        return 1

    print(f'Parsed {len(entries)} path(s):')
    for e in entries:
        print(f'  {e["label"]} -> {e["path"]}')

    output_path = Path(args.output)
    output_path.parent.mkdir(parents=True, exist_ok=True)

    with open(output_path, 'w', encoding='utf-8') as f:
        json.dump(entries, f, indent=2, ensure_ascii=False)

    print(f'\n-> Wrote {len(entries)} path(s) to {output_path}')

    # Print commands to sync to Dropbox and update Vercel env var
    print(f'\nrclone copy public/paths.json dropbox:/vercel')
    print(f'rclone link dropbox:/vercel/paths.json')
    print(f'\n# Then update Vercel with the link (append &raw=1):')
    print(f'vercel env rm DROPBOX_PATHLINKS_URL production -y')
    print(f'echo "<LINK>&raw=1" | vercel env add DROPBOX_PATHLINKS_URL production')

    return 0


if __name__ == '__main__':
    raise SystemExit(main())
