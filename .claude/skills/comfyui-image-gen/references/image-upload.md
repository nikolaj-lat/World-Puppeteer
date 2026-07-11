# Image Upload (Trinetra)

Upload an image to a self-hosted **Trinetra** instance and get a public URL. The
instance requires an API key; the script provisions one for you with no browser
(register → mint key → cache), so first-run setup is a single flag.

```bash
node .claude/skills/comfyui-image-gen/scripts/upload-image.mjs -n <name> -l <purpose-label> -U <username> <path/to/image.png>
```

- Prints the direct URL to stdout: `https://trinetra.mahesvara.cloud/i/<hash>`
- With `-n`, moves the local file to `images/uploaded/{name}-{hash}.png`
- Without `-n`, uploads only (no move)

## Flags

| Flag | Purpose |
|------|---------|
| `-n <name>` | Local bookkeeping name; also triggers the move into `images/uploaded/`. |
| `-l <purpose-label>` | **Names the image on the server** (`PATCH /api/images/:id`, cosmetic `original_name`; URL/id unchanged) so `/i/<url>` is identifiable later via the gallery or `GET /api/images`. Use `<purpose>_<name>`: `portrait_leo`, `background_tavern`, `logo_trinetra`, `icon_app`. Lowercase, `_`/`-` separators, no spaces. Best-effort — a rename failure warns but the upload still succeeds. |
| `-U <username>` | **First run only.** Registration username (3–32 chars: letters, numbers, `.` `_` `-`). The script generates the password itself and mints an API key. Omit once credentials are cached. |
| `-c <path>` | Override the credentials file location (default `trinetra.credentials`). |

## Credentials (first run vs. later runs)

On the **first** run (no cached key) the script:

1. `POST /auth/register` with the supplied username, a generated policy-compliant
   password, and `accept_terms: true` → gets an authenticated session cookie.
2. `POST /api/keys` with that cookie → the plaintext API key (returned once).
3. Writes `{ base_url, username, password, api_key }` to **`trinetra.credentials`**
   in the project root (mode `600`).

**Later runs reuse `trinetra.credentials` automatically** — omit `-U`. Never
commit that file; it holds the password and API key in plaintext (it is
`.gitignore`d).

## Environment overrides

| Variable | Effect |
|----------|--------|
| `TRINETRA_BASE_URL` | Target a different instance (default `https://trinetra.mahesvara.cloud`). |
| `TRINETRA_USERNAME` | Provide the registration username instead of `-U`. |
| `TRINETRA_CREDENTIALS` | Credentials file path (same as `-c`). |
| `TRINETRA_API_KEY` | Use an existing key and skip provisioning entirely. |

## Notes

- A `409` on the first run means that username is already taken (or the
  credentials file was lost) — pick a different `-U <username>`.
- A suspended account (or a deleted/revoked key) makes every request `401`
  ("authentication required"), because Trinetra treats a suspended user as
  unauthenticated for API keys and sessions alike. Re-provision with a fresh
  username if that happens.
- The instance uses an internal/self-signed TLS certificate on the `.home`
  domain. If Node rejects it (`SELF_SIGNED_CERT_IN_CHAIN`), prefix the command
  with `NODE_TLS_REJECT_UNAUTHORIZED=0` (the equivalent of `curl -k`) — only do
  this for a trusted internal instance.
