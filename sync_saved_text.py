#!/usr/bin/env python3
"""Sync local saved text notes to Dropbox and build saved_text.json.

1. rclone sync local vercel_saved_notes -> dropbox:/vercel_saved_notes
2. Recursively scan dropbox:/vercel_saved_notes for .txt files
3. Read each file's content
4. Output saved_text.json

Usage:
  python sync_saved_text.py
  python sync_saved_text.py --dry-run
  python sync_saved_text.py --scan-only    # skip sync, just scan
"""

import argparse
import json
import os
import subprocess
import sys
from pathlib import Path

LOCAL_DIR = os.path.expanduser('~/documents/notes/vercel_saved_notes')
REMOTE_DIR = 'dropbox:/vercel_saved_notes'

TEXT_EXTS = {'.txt'}


def rclone(*args):
    result = subprocess.run(['rclone'] + list(args), capture_output=True, text=True)
    if result.returncode != 0:
        print(f"rclone error: {result.stderr.strip()}", file=sys.stderr)
        return None
    return result.stdout.strip()


def list_files(remote_path):
    """List files recursively, sorted newest first."""
    output = rclone('lsjson', '-R', '--files-only', remote_path)
    if output is None:
        return []
    items = json.loads(output)
    items.sort(key=lambda x: x.get('ModTime', ''), reverse=True)
    return items


def read_remote_file(remote_path):
    """Read the content of a remote file via rclone cat."""
    return rclone('cat', remote_path)


def main():
    parser = argparse.ArgumentParser(description='Sync saved text notes to Dropbox and build JSON')
    parser.add_argument('--dry-run', action='store_true', help='List files without reading content')
    parser.add_argument('--scan-only', action='store_true', help='Skip sync, just scan Dropbox')
    args = parser.parse_args()

    # Step 1: Sync local -> Dropbox
    if not args.scan_only:
        if not os.path.isdir(LOCAL_DIR):
            print(f'Local directory not found: {LOCAL_DIR}')
            return 1

        print(f'Syncing {LOCAL_DIR} -> {REMOTE_DIR} ...')
        sync_args = ['sync', LOCAL_DIR, REMOTE_DIR, '-v', '--exclude', '.DS_Store']
        if args.dry_run:
            sync_args.append('--dry-run')
        result = subprocess.run(['rclone'] + sync_args, text=True)
        if result.returncode != 0:
            print('Sync failed.')
            return 1
        print('Sync complete.\n')

    # Step 2: Scan Dropbox for text files
    print(f'Scanning {REMOTE_DIR} ...')
    all_files = list_files(REMOTE_DIR)
    text_files = [f for f in all_files if Path(f['Path']).suffix.lower() in TEXT_EXTS]

    print(f'Found {len(text_files)} text file(s) out of {len(all_files)} total files\n')

    if not text_files:
        print('No text files found.')
        return 1

    if args.dry_run:
        for f in text_files:
            print(f"  {f['Path']}")
        print(f'\nTotal: {len(text_files)} text files')
        return 0

    # Step 3: Read content of each text file
    notes = []
    for idx, f in enumerate(text_files, 1):
        path = f['Path']
        parts = path.split('/')
        folder = parts[0] if len(parts) > 1 else ''
        name = parts[-1]

        print(f'  [{idx}/{len(text_files)}] {path} ...', end=' ', flush=True)
        content = read_remote_file(f'{REMOTE_DIR}/{path}')
        if content is not None:
            notes.append({
                'name': Path(name).stem,
                'file': name,
                'folder': folder,
                'path': path,
                'content': content,
            })
            print('ok')
        else:
            print('FAILED')

    # Step 4: Write saved_text.json
    output_path = Path(__file__).resolve().parent / 'public' / 'saved_text.json'
    output_path.parent.mkdir(parents=True, exist_ok=True)
    with open(output_path, 'w', encoding='utf-8') as f:
        json.dump(notes, f, indent=2, ensure_ascii=False)

    print(f'\n-> Wrote {len(notes)} note(s) to {output_path}')

    # Step 5: Print deploy commands
    print(f'\n# Upload to Dropbox:')
    print(f'rclone copy public/saved_text.json dropbox:/vercel')
    print(f'rclone link dropbox:/vercel/saved_text.json')
    print(f'\n# Then update Vercel with the link (append &raw=1):')
    print(f'vercel env rm DROPBOX_SAVED_NOTES_URL production -y')
    print(f'echo "<LINK>&raw=1" | vercel env add DROPBOX_SAVED_NOTES_URL production')

    return 0


if __name__ == '__main__':
    raise SystemExit(main())
