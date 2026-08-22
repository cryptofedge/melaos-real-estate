# Editing the website

**Where:** https://cryptofedge.github.io/melaos-real-estate/admin.html

Bookmark it. It is not linked from the public site and search engines are told to
ignore it, but it is a public URL — the protection is that nothing works without a
token that can write to the repository.

## Adding your brothers

Each brother needs a GitHub account. There is no way around that with how this is
built — the website's storage *is* GitHub, and it only knows how to recognise GitHub
accounts. Inviting by email does not skip it; it just makes the signup easy.

Signing up is free and takes about two minutes: an email address, a username, a
password. They never have to understand GitHub or use it for anything else. After the
one-time setup they only ever open the admin page.

**Send the invite** (Melao does this once per brother):

1. Go to
   **github.com/cryptofedge/melaos-real-estate/settings/access**
2. Click **Add people**
3. Type his **email address** and send it

**He accepts:**

4. He gets an email from GitHub. He clicks the link.
5. If he has no account, GitHub walks him through making one — email, username,
   password, confirm the email. Then it returns him to the invitation.
6. He clicks **Accept invitation**.

**Then he makes his token** using the steps below, and he is done forever.

If you would rather your brothers never see GitHub at all, that is possible, but it
needs a small server behind the website with its own email-and-password logins. That
is a different setup from the one we built — worth doing if GitHub signup turns out to
be a real obstacle for them, not worth doing pre-emptively.

## First time: get your token (about two minutes)

Each brother makes his own. Never share one — the commit history records who changed
what, which is the point.

1. Sign in to GitHub, then open
   **github.com/settings/personal-access-tokens/new**
2. Name it something like "Melao's website" and pick an expiry you are comfortable with.
3. **Repository access** → *Only select repositories* → `melaos-real-estate`
4. **Permissions → Repository permissions** → **Contents: Read and write**.
   Nothing else. That token can then edit this website and nothing else on GitHub.
5. Generate, copy, paste it into the admin page. GitHub shows it once.

Tick "keep me signed in" on your own phone or laptop. Leave it unticked on anything
shared.

If a token leaks, delete it on GitHub and make a new one — that instantly stops it
working.

## Day to day

**Edit a listing.** Click *Edit* on any card, change what you need, press *Done*.

**Add photos.** Open a listing, choose *Add photos*, pick as many as you like. Phone
photos are 3–8 MB each; they are resized to 1600px and compressed **on your own phone
or laptop**, landing at roughly 200–400 KB.

Nothing leaves your device until you press Publish. Until then a photo is marked *Not
published* and the card shows how many are still waiting. Remove one before publishing
and it is simply discarded — it was never uploaded. The **first photo is the one shown
on the card**; remove and re-add to change the order.

**Add a home or community.** Buttons at the top right. New listings need at minimum a
name, a price and a square footage to look right.

**Delete.** Open the listing, *Delete this listing*, confirm.

**Publish.** Nothing is live until you press **Publish changes** — photos included. The
site updates about a minute later. Photos upload first; if one fails, the listing file
is left alone, so the site never points at an image that did not make it.

## Things worth knowing

- **Two people editing at once.** If someone else publishes while you have the page
  open, your publish is refused rather than silently overwriting them. Reload and redo
  your change — annoying, but it never loses their work.
- **Everything is reversible.** Every change is a commit. Nothing is ever truly gone;
  ask for anything to be restored.
- **Publishing makes photos public.** They are on the open internet from that moment,
  and deleting a photo later does not erase it from the site's history. Do not publish
  anything you would not want seen.
- **Don't put anything private in a listing.** This is a public marketing site — buyer
  names, phone numbers, and anything about a specific resident do not belong here.

## If something goes wrong

| What you see | What it means |
| --- | --- |
| "That token was rejected" | Expired or mistyped. Make a new one. |
| "That token cannot write to this repository" | Missing **Contents: Read and write**, or the repo was not selected. |
| "Someone else published while you were editing" | Reload and redo. Their change is safe. |
| "Could not publish" after choosing photos | Nothing was changed. Press Publish again. |
| Site looks unchanged after publishing | Give it a minute, then hard-refresh (Ctrl+Shift+R). |
| "Our listings could not be loaded" on the public site | The data file is broken or missing — this needs a developer. |
