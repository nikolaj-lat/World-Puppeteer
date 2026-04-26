# Image Upload (Catbox.moe)

Upload images and get a public URL. No setup required.

```bash
node .claude/skills/image-gen/scripts/upload-image.mjs -n <name> <path/to/image.png>
```

- Prints the direct URL to stdout: `https://files.catbox.moe/abc123.png`
- With `-n`, moves the file to `images/uploaded/{name}-{hash}.png`
- Without `-n`, uploads only (no move)
