# AderaLearn — Auth & AI setup

The site runs without any setup (demo mode: no login, canned AI replies).
To turn on real accounts and the real AI tutor, do the following once.
**Everything below is done in the browser — no Node.js and no Supabase CLI.**

---

## 1. Create a Supabase project

1. Go to <https://supabase.com>, sign in, **New project**.
2. Wait for it to finish provisioning.
3. Open **Project Settings → API** and copy:
   - **Project URL** — looks like `https://abcd1234.supabase.co`
     (no `/rest/v1/` or any path on the end)
   - **anon public** key

## 2. Add those keys to the site

Edit [`js/config.js`](js/config.js):

```js
window.ADERA_CONFIG = {
    SUPABASE_URL: "https://YOUR-PROJECT.supabase.co",
    SUPABASE_ANON_KEY: "eyJhbGciOi...your anon key..."
};
```

That is the only place these go. Both are safe to expose in the browser.

## 3. Auth settings

In the Supabase dashboard → **Authentication**:

- **Providers → Email** is on by default. Nothing to change.
- **URL Configuration → Site URL**: set it to wherever you serve the site
  (e.g. `http://localhost:3000`). Add the same to **Redirect URLs**.
- For quick testing you can turn **Confirm email** off
  (Authentication → Providers → Email). With it on, new users must click the
  link in their email before they can sign in.

## 4. Get an AI provider API key

Pick one:

| Provider | Get a key | Free tier |
|---|---|---|
| Google Gemini (default) | <https://aistudio.google.com/apikey> | yes |
| OpenAI | <https://platform.openai.com/api-keys> | no |
| Anthropic | <https://console.anthropic.com/settings/keys> | no |

Keep the key — it only ever goes in the Edge Function secrets, never in the site.

## 5. Create the Edge Function in the dashboard

1. Supabase dashboard → **Edge Functions** → **Create a new function**
   (or **Deploy a new function → via Editor**).
2. Name it exactly **`ask-ai`**.
3. Replace the sample code with the entire contents of
   [`supabase/functions/ask-ai/index.ts`](supabase/functions/ask-ai/index.ts).
4. Click **Deploy**.
5. Leave **Verify JWT** **on** (default) so only requests carrying a Supabase
   token — which the site always sends — can reach it.

## 6. Set the function secrets in the dashboard

Supabase dashboard → **Edge Functions → Secrets** (or **Project Settings →
Edge Functions → Secrets**). Add:

| Secret | Required | Value |
|---|---|---|
| `AI_API_KEY` | yes | the key from step 4 |
| `AI_PROVIDER` | no | `gemini` (default) · `openai` · `anthropic` |
| `AI_MODEL` | no | override the model, e.g. `gemini-3.6-flash`, `gpt-4o-mini`, `claude-haiku-4-5-20251001` (check your provider's docs for the current name) |
| `AI_BASE_URL` | no | custom base URL for an OpenAI-compatible API (Groq, OpenRouter, …) |
| `REQUIRE_AUTH` | no | `true` to also reject anyone who is not a signed-in user |
| `ALLOW_ORIGIN` | no | lock CORS to your site's origin instead of `*` |

No secret goes in any file — they live only in this dashboard panel.
After changing secrets, redeploy the function (or click **Deploy** again).

## 7. Serve the site over http (not file://)

Supabase auth needs a real origin. Use any static server — for example the
VS Code **Live Server** extension (right-click `index.html` → *Open with Live
Server*), or a hosted static host (Netlify drop, GitHub Pages, Supabase
Storage). Then open the served URL, not the file path.

---

## How it fits together

| Piece | File |
|---|---|
| Your Supabase keys | `js/config.js` |
| Shared Supabase client | `js/supabaseClient.js` |
| Login / signup pages | `login.html`, `signup.html`, `js/auth-forms.js` |
| Route guard + header + logout | `js/auth.js` (pages opt in with `<body data-auth-required>`) |
| Browser → Edge Function call | `js/ai.js` (`window.askAderaAI`) |
| Edge Function → AI provider | `supabase/functions/ask-ai/index.ts` (provider-neutral) |

Until step 2 is done, `window.sb` is `null`: no page redirects to login and the
tutor / lesson chat fall back to the built-in sample replies.

## Quick test of the function

In the dashboard function's **Test / Invoke** panel, send this body:

```json
{ "messages": [{ "role": "user", "text": "Explain photosynthesis simply" }],
  "topic": "Photosynthesis", "subject": "Biology" }
```

A working setup replies with `{ "text": "..." }`.
