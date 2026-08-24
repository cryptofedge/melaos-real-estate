# Melao's WhatsApp bot

Runs the website from WhatsApp. Melao messages the bot; the bot commits to the
site's repository and GitHub Pages redeploys.

    add                          → walks through adding a house
    list                         → what is online now
    rent 3 1850                  → change a price
    rented 3 / available 3       → change status
    (send a photo)               → attaches it to the last house
    campaign meta 20 7 …         → create an ad campaign
    status                       → what is connected

Full command list: message it `help`.

## Deploying

It is a plain Node server with **no dependencies**. Node 18+.

### Render (easiest)

The repo has a `render.yaml`. In Render: **New → Blueprint**, point it at this
repo, and it builds the Dockerfile.

Render's free web services have **no persistent disk**, so the client's API keys
would be wiped on every restart. The blueprint solves that: it generates
`CONFIG_SECRET`, and you paste one `BOOTSTRAP_GITHUB_TOKEN` (a GitHub token with
only the **gist** scope). The config is then encrypted and kept in a private
gist, which survives restarts.

### Fly.io

`fly.toml` mounts a small volume instead, so no gist is needed:

    fly launch --no-deploy
    fly volumes create melao_data --size 1
    fly deploy

### Anywhere else

    node server.mjs

Set `PORT`, and either give it a writable `CONFIG_FILE` path on a persistent
disk, or set `CONFIG_SECRET` + `BOOTSTRAP_GITHUB_TOKEN` for gist storage.

## Setting it up

Everything else is entered by the client at `/setup` on the running bot — the
WhatsApp keys, the GitHub token, and the ad platform credentials. Nothing is
hardcoded and nothing is committed.

Give him [CONNECT-WHATSAPP.md](CONNECT-WHATSAPP.md); it is written for a
non-developer and covers the Meta side end to end.

## How it is kept safe

- **An allow list.** Only numbers on it can command the bot. Everyone else is
  ignored and logged. Without at least one number listed, the bot obeys nobody.
- **The setup page is password protected**, and keys are masked when read back —
  the server never returns a secret it was given.
- **Config never reaches the website.** It lives on the host, or encrypted in a
  private gist. `bot/.gitignore` keeps it out of the repo.
- **Campaigns are created paused** on every platform, so nothing spends money
  before a human looks at it.
- **Webhook verification** uses a constant-time comparison, and repeated message
  IDs are ignored, because Meta retries deliveries.

## What is real and what is not

The ad adapters make genuine API calls to Meta, Google Ads and TikTok. They
cannot work until the client supplies his own credentials, and getting those
means creating a developer app on each platform — Meta's review in particular
takes weeks. Until then, `campaign …` saves the campaign as a draft and replies
with exactly which credentials are missing rather than pretending it launched.

## Testing

The command layer takes its storage as an argument, so the whole surface can be
driven without credentials or a network:

    node --test          # if you add test files
    node server.mjs      # then POST a fake webhook at /webhook
