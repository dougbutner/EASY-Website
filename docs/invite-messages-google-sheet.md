# Invite request messages (Google Sheet)

Static `dist/` deploy has no Node server. Optional “why I want in” text is stored in a **Google Sheet** via an **Apps Script web app**.

## One-time setup

1. Create a Google Sheet (any name).
2. **Extensions → Apps Script** → paste `scripts/google-sheets-invite-messages.gs` → **Save**.
3. **Project Settings → Script properties** → add `INVITE_SECRET` = a long random string.
4. In the script editor, run **`ensureSheet`** once (authorize when asked). A tab `invite_messages` appears with headers.
5. **Deploy → New deployment → Web app**
   - Execute as: **Me**
   - Who has access: **Anyone**
6. Copy the **`/exec`** URL (not `/dev`).

## Build / deploy

Create `.env` from `.env.example`:

```bash
VITE_INVITE_MESSAGES_URL=https://script.google.com/macros/s/....../exec
VITE_INVITE_MESSAGES_SECRET=same-as-INVITE_SECRET
```

Rebuild and upload `dist/` as usual. The secret is embedded in the client bundle—use a dedicated secret and rotate if needed.

## Sheet columns

| account | requester | message | created_at |
|---------|-----------|---------|------------|

New rows are appended when someone submits **Request a welcome** with an optional message. The UI reads the latest row per account for the queue table.

## Local dev

No separate API process. Set `.env` and run `npm run dev` only.

If `VITE_INVITE_MESSAGES_URL` is unset, the site still works; queue messages show as `—`.
