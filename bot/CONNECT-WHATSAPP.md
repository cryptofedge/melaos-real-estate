# Connecting the bot to WhatsApp Business

Send this to Melao. It is written for him, not for a developer.

---

## What you are doing

Your website is going to be run from WhatsApp. You message the bot, it changes
the site. Before that can happen, WhatsApp has to be told the bot exists. That
is what these steps do. It takes about twenty minutes, once.

You will need: a Facebook account, and the phone number **432 606 9495** —
**not** already registered to a normal WhatsApp or WhatsApp Business app. If it
is, you must delete that account from inside the app first, or use a different
number for the bot.

---

## Step 1 — Make a Meta business account

1. Go to **business.facebook.com** and sign in with Facebook.
2. Create a business if you do not have one. Use your real business name and
   address — Meta checks this later.

## Step 2 — Create the app

1. Go to **developers.facebook.com/apps** → **Create App**.
2. Pick **Business** as the type.
3. Name it something like `Melao's Bot`. Link it to the business from step 1.
4. On the app dashboard find **WhatsApp** and press **Set up**.

## Step 3 — Add your number

1. In the left menu: **WhatsApp → API Setup**.
2. Under *From*, press **Add phone number**.
3. Enter **432 606 9495**, choose to verify by SMS or call, and enter the code.
4. Give the display name customers will see: `Melao's Real Estate Development`.

## Step 4 — Copy three things to your setup page

Still on **API Setup**, you will see:

| On Meta's screen | What to do with it |
| --- | --- |
| **Phone number ID** | Copy into the setup page's *Phone number ID* box |
| **Temporary access token** | Copy into *Access token* — see the note below |
| — | Invent any password-like phrase, put it in *Verify token* |

Then put **432 606 9495** in *Who can command the bot*, and press **Save**.

> **About the token.** The one Meta shows first expires in 24 hours, which is
> fine for testing. For a token that does not expire, go to
> **Business Settings → Users → System Users**, add a system user, give it your
> WhatsApp app, and generate a permanent token there. Do that before you rely
> on it day to day, or the bot will stop answering after a day.

## Step 5 — Point WhatsApp at the bot

1. In Meta: **WhatsApp → Configuration → Webhook → Edit**.
2. **Callback URL**: your bot's address followed by `/webhook`
   (for example `https://melaos-bot.onrender.com/webhook`).
3. **Verify token**: the exact phrase you invented in step 4.
4. Press **Verify and save**. It should go green immediately. If it does not,
   the phrase does not match, or the bot is not running.
5. Below that, press **Manage** and tick **messages**. This is the step people
   forget — without it, Meta never tells the bot anything.

## Step 6 — Try it

On the setup page press **Send me a test message**. Your phone should buzz.

Then message the bot yourself:

    help

It will list what it can do. Try:

    add

and it will walk you through putting a house on the website.

---

## Things worth knowing

**Only your number works.** Anyone else who messages the bot is ignored. If you
want a brother to be able to change the site too, add his number to the allow
list on the setup page.

**The 24-hour rule.** WhatsApp only lets a business message you freely within 24
hours of your last message. Since you are the one starting every conversation,
this never gets in your way — but it is why the bot cannot message you out of
the blue days later.

**Cost.** Conversations you start with your own bot are free. Meta charges for
business-initiated conversations to customers, which is not what this does.

**If the bot goes quiet:** message it `status`. It answers with a list of what is
connected and what is not. The usual cause is an expired access token — see the
note in step 4.

---

## If you get stuck

Take a screenshot of the screen you are stuck on and send it. The two steps that
trip people up are the webhook verify token not matching exactly, and forgetting
to tick **messages** in step 5.
