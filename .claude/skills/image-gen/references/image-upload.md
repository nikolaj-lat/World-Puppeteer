# Image Upload (Official Voyage Hosting)

Upload images through the Creator API and get a canonical Latitude-hosted URL. Requires Creator API setup (SETUP.md Step 5) and a pinned world; the upload is moderated before the URL is returned.

```bash
node .claude/skills/image-gen/scripts/upload-image.mjs -n <name> [-t TARGET] <path/to/image.png>
```

- Prints the canonical URL alone to stdout
- With `-n`, moves the file to `images/uploaded/{name}-{hash}.png` (and its metadata json alongside)
- `-t` picks the upload target: `NPC_PORTRAIT` (default), `AREA_IMAGE`, `LOCATION_IMAGE`, `REGION_MAP_IMAGE`
- Minimum 600x600, maximum 5 MiB; png, jpeg, or webp
- A moderation rejection is final for that image: the upload is cleaned up automatically, fix the image and run again
