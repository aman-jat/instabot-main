# 🤖 Instagram Echo Bot

An Instagram DM auto-reply bot built with **Node.js + Express** and the **Instagram Graph API**. It listens for incoming DMs via Meta Webhooks and automatically replies with the exact same message.

---

## ✅ Prerequisites

Before you start, make sure you have:

- [Node.js](https://nodejs.org/) (v16+)
- [ngrok](https://ngrok.com/download) installed
- A **Meta Developer Account** → [developers.facebook.com](https://developers.facebook.com)
- A **Facebook Page** with a connected **Instagram Business / Creator Account**

---

## 📁 Project Structure

```
instabot/
├── index.js          # Main server — webhook + echo logic
├── .env              # Your secrets (create from .env.example)
├── .env.example      # Template for environment variables
├── package.json
└── README.md
```

---

## 🛠️ Setup Guide

### Step 1 — Install Dependencies

```bash
npm install
```

---

### Step 2 — Create Your Meta Developer App

1. Go to [developers.facebook.com](https://developers.facebook.com) → **My Apps** → **Create App**
2. Choose **Business** app type → Fill in details
3. Under **Add Products**, add **Instagram** (Instagram Graph API)
4. In the left sidebar: **Instagram → API Setup with Instagram Login** OR **Instagram → Settings**

---

### Step 3 — Connect Your Instagram Business Account

1. In your Meta App → **Instagram** → **API Setup**
2. Under **Generate access tokens**, click **Add Instagram Account**
3. Log in with your Instagram Business account
4. Note your **Instagram Business Account ID** (displayed on the page)
5. Click **Generate Token** → copy the **User Access Token**

> **Tip**: Use the [Access Token Debugger](https://developers.facebook.com/tools/debug/accesstoken/) to inspect and convert to a **Long-Lived Page Access Token**.

To get a Page Access Token:
```
GET https://graph.facebook.com/v19.0/me/accounts?access_token=YOUR_USER_TOKEN
```
Use the `access_token` from the response for the connected page.

---

### Step 4 — Configure Permissions

In your Meta App:
1. Go to **App Review → Permissions and Features**
2. Request / enable:
   - `instagram_manage_messages`
   - `instagram_basic`
   - `pages_messaging`
3. For **development/testing** these work without review — just make sure your test account is added as a **Tester** or **Developer** in App Roles.

---

### Step 5 — Set Up Environment Variables

```bash
copy .env.example .env
```

Open `.env` and fill in:

```env
VERIFY_TOKEN=any_secret_string_you_choose
PAGE_ACCESS_TOKEN=your_page_access_token_here
INSTAGRAM_ACCOUNT_ID=your_instagram_business_account_id
PORT=3000
```

---

### Step 6 — Start the Server

```bash
npm start
```

You should see:
```
🚀  Instagram Echo Bot running on http://localhost:3000
    Webhook endpoint: http://localhost:3000/webhook
```

---

### Step 7 — Expose with ngrok

In a **new terminal**:

```bash
ngrok http 3000
```

Copy the **HTTPS** forwarding URL, e.g.:
```
https://abc123.ngrok-free.app
```

---

### Step 8 — Configure Meta Webhook

1. In your Meta App → **Instagram** → **Webhooks** (or main **Webhooks** product)
2. Click **Subscribe to events** → **Instagram**
3. Set:
   - **Callback URL**: `https://abc123.ngrok-free.app/webhook`
   - **Verify Token**: same value as `VERIFY_TOKEN` in your `.env`
4. Click **Verify and Save**
5. Under **Webhook Fields**, subscribe to **`messages`**

---

### Step 9 — Test It!

1. From a **different Instagram account** (or a tester account), send a DM to your Instagram Business account
2. Your bot should reply with the exact same message within seconds
3. Watch the server logs for real-time activity:
   ```
   📨  Message from 123456789: "Hello!"
   📤  Echoed back to 123456789: "Hello!"
   ```

---

## 🔄 Development Mode (Auto-Restart)

```bash
npm run dev
```

Uses `nodemon` to auto-restart when you change `index.js`.

---

## 🧪 Test Webhook Verification Manually

```bash
curl "http://localhost:3000/webhook?hub.mode=subscribe&hub.verify_token=YOUR_VERIFY_TOKEN&hub.challenge=test123"
```

Expected response: `test123`

---

## ❗ Troubleshooting

| Issue | Fix |
|---|---|
| Webhook verification fails | Ensure `VERIFY_TOKEN` in `.env` matches the token in Meta dashboard exactly |
| Bot doesn't reply | Check `PAGE_ACCESS_TOKEN` is valid; use [Token Debugger](https://developers.facebook.com/tools/debug/accesstoken/) |
| Replies to itself in a loop | The `is_echo` guard in `index.js` prevents this — make sure you haven't removed it |
| `403` from Graph API | Ensure `instagram_manage_messages` permission is granted |
| ngrok session expired | Restart ngrok and update the callback URL in Meta Webhooks |

---

## 📚 Useful Links

- [Meta Graph API Explorer](https://developers.facebook.com/tools/explorer/)
- [Instagram Messaging Docs](https://developers.facebook.com/docs/messenger-platform/instagram)
- [Webhook Reference](https://developers.facebook.com/docs/graph-api/webhooks/)
- [Access Token Debugger](https://developers.facebook.com/tools/debug/accesstoken/)
