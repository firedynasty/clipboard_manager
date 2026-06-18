# Screenshots Workflow

## Adding new screenshots

1. Add image files to `~/documents/notes/vercel_screenshots/` in subfolders (e.g. `claude_notes/`, `claude_learning/`)

2. Run the sync and scan script from the project root:

```
python sync_screenshots.py
```

This will:
- Sync local images to `dropbox:/vercel_screenshots` (skips already-uploaded files)
- Scan Dropbox for all images recursively
- Get a share link for each image
- Write `public/screenshots.json`
- Print the deploy commands

3. Copy and run the printed commands:

```
rclone copy public/screenshots.json dropbox:/vercel
rclone link dropbox:/vercel/screenshots.json
```

4. Take the link from `rclone link` and update the Vercel env var:

```
vercel env rm DROPBOX_SCREENSHOTS_URL production -y
echo "<LINK>&raw=1" | vercel env add DROPBOX_SCREENSHOTS_URL production
```

Replace `<LINK>` with the actual link output.

## Useful flags

- `python sync_screenshots.py --dry-run` - preview what would sync/scan without making changes
- `python sync_screenshots.py --scan-only` - skip the sync step, just rescan Dropbox and regenerate links

## How it works

```
~/documents/notes/vercel_screenshots/
    claude_notes/claude1.png
    claude_learning/claude1.png
        |
        v  rclone sync
dropbox:/vercel_screenshots/
        |
        v  rclone link (for each image)
public/screenshots.json
        |
        v  rclone copy
dropbox:/vercel/screenshots.json
        |
        v  DROPBOX_SCREENSHOTS_URL env var
/api/screenshots  (Vercel serverless function)
        |
        v
Screenshots UI  (search by name, modal with left/right navigation)
```

## In the app

1. Click **Screenshots** button in the header
2. Type a name (e.g. `claude1`) to search
3. Click a result to open the modal
4. Use **left/right arrow keys** or buttons to navigate between matches
5. Press **Escape** to close

# Saved Text Workflow

## Adding new saved text

1. Add `.txt` files to `~/documents/notes/vercel_saved_notes/` in subfolders (e.g. `career_future/`, `claude_notes/`)

2. Run the sync and scan script from the project root:

```
python sync_saved_text.py
```

This will:
- Sync local text files to `dropbox:/vercel_saved_notes` (skips already-uploaded files)
- Scan Dropbox for all `.txt` files recursively
- Read the content of each file via `rclone cat`
- Write `public/saved_text.json`
- Print the deploy commands

3. Copy and run the printed commands:

```
rclone copy public/saved_text.json dropbox:/vercel
rclone link dropbox:/vercel/saved_text.json
```

4. Take the link from `rclone link` and update the Vercel env var:

```
vercel env rm DROPBOX_SAVED_NOTES_URL production -y
echo "<LINK>&raw=1" | vercel env add DROPBOX_SAVED_NOTES_URL production
```

Replace `<LINK>` with the actual link output.

## Useful flags

- `python sync_saved_text.py --dry-run` - preview what would sync/scan without making changes
- `python sync_saved_text.py --scan-only` - skip the sync step, just rescan Dropbox and regenerate links

## How it works

```
~/documents/notes/vercel_saved_notes/
    career_future/career_future1.txt
    claude_notes/sample.txt
        |
        v  rclone sync
dropbox:/vercel_saved_notes/
        |
        v  rclone cat (read each file's content)
public/saved_text.json
        |
        v  rclone copy
dropbox:/vercel/saved_text.json
        |
        v  DROPBOX_SAVED_NOTES_URL env var
/api/saved_text  (Vercel serverless function)
        |
        v
Saved Text UI  (search by name, preview cards, copy to clipboard)
```

## In the app

1. Go to `/saved_text`
2. Type a name (e.g. `career_future`) to search
3. If one result, it auto-copies to clipboard
4. If multiple results, click a card to open the modal with full text
5. Click **Copy to clipboard** in the modal
6. Use **left/right arrow keys** to navigate between matches
7. Press **Escape** to close
