# Image Upload (Trinetra)

Upload an image to **Trinetra** and get a public URL. The
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
- A `401 {"error":"authentication required"}` on any `/api/*` call means the
  cached key no longer authenticates — the account is suspended, the key was
  revoked/deleted, or the account itself is gone (Trinetra treats a suspended user
  as unauthenticated for keys and sessions alike). **Do not blindly re-register** —
  first probe with the cached credentials to tell the cases apart:

  ```bash
  curl -sk -c /tmp/tri-probe.txt -X POST { base_url }/auth/login \
    -H 'Content-Type: application/json' \
    -d '{"username":"<username>","password":"<password>"}'
  ```

  Branch on the response (the credentials come from `trinetra.credentials`):

  | Login response | Meaning | What to do |
  |----------------|---------|------------|
  | `403 {"error":"this account has been suspended"}` | Account suspended on purpose. | **Stop, do not re-provision** (a fresh account would just get suspended too). Blacklist uploads for this run and tell the user to **contact support** — see *What to give support* below. |
  | `200 {"status":"authenticated"}` | Account is fine; only the **key** was revoked. | Mint a new key with the session cookie the probe just saved: `curl -sk -b /tmp/tri-probe.txt -X POST { base_url }/api/keys -H 'Content-Type: application/json' -d '{"label":"image-gen upload script"}'`, write the returned `key` into `trinetra.credentials`, and retry the upload. |
  | `401 {"error":"invalid credentials"}` | The cached account/password is dead (account deleted, or the password was changed elsewhere). | **Do not silently re-register** — a fresh account orphans the images already uploaded under the old one. Tell the user to **contact support** with the details below so an admin can recover the existing account. Only re-provision with a new `-U <username>` if the user confirms the old account is disposable. |
  | `200 {"status":"2fa_required"}` or `{"status":"enroll_2fa_required"}` | Account has 2FA — the cookie is only half-auth and can't mint a key. | Inform the user; this script can't complete a second factor. |

  Note the suspended check returns **`403`** (from `/auth/login`), even though the
  original `/api/*` call returned `401` — they are different endpoints reporting the
  same underlying state.

  **What to give support.** Support is **`trinetra@mahesvara.cloud`**. For the
  suspended and dead-account rows, an admin can look the account up in the admin
  panel from a few identifiers — gather what you have and give it to the user to
  email support:

  - **API-key prefix** — the **first 12 characters** of `api_key` in
    `trinetra.credentials` (e.g. `tri_qajj0PfS`). This is exactly the `key_prefix`
    an admin sees on the account, so it's the most direct lookup handle. Never share
    the full key — the prefix is enough and is not secret.
  - **Username** — from `trinetra.credentials`.
  - **Approx. last used** — roughly when you last uploaded successfully with this
    key (e.g. the timestamp of the last good upload this session, or "a few minutes
    ago"). Admins see the key's `last_used_at` on the account, so an approximate
    time helps them match the right key. If the key was never used before this
    failure, say so — the admin will see `last_used=never`.
  - **Image links + labels** — for every image uploaded this session, the
    `https://.../i/<hash>` URL and its `-l` purpose label. Admins see the matching
    images (name, size, sha256) on the account, so these let them confirm ownership
    and recover the right uploads.

  Present these to the user verbatim (e.g. "email support at
  `trinetra@mahesvara.cloud` and give them: key prefix `tri_qajj0PfS`, username
  `…`, last used ~a few minutes ago, images: `…/i/AbC123` (portrait_leo), …").
