# AderaLearn

An AI-powered learning companion. Pick a subject, get a structured lesson,
ask a tutor follow-up questions, then test yourself with an auto-generated quiz.

**Live demo:** _add your deployed URL_
**Built for:** _add hackathon name_

---

## What it does

Learning alone is hard when you get stuck and there is nobody to ask.
AderaLearn gives every learner a patient tutor and a feedback loop:

1. **Choose a topic** in Mathematics, Biology, Chemistry, Physics or English.
2. **Learn with AI** — a clear, beginner-friendly explanation with examples.
3. **Ask questions** — a full-page AI tutor that keeps your past conversations.
4. **Take a quiz** — multiple-choice questions on what you just learned, with a
   score and feedback on where to revise.

## Features

- Topic-aware AI lessons and quizzes
- Full-page **AI Tutor** with saved conversations, new-chat / clear-chat, and the
  current topic in view
- Email + password accounts with protected pages and session persistence
- Works with **zero setup** in demo mode (no login, sample tutor replies) so it is
  always runnable
- Fully responsive (desktop sidebar collapses on tablet / mobile)

## Tech stack

| Layer | Choice |
|---|---|
| Frontend | Vanilla HTML / CSS / JavaScript — no build step |
| Auth | Supabase Auth (email + password) |
| AI backend | Supabase Edge Function (Deno) as a provider-neutral proxy |
| AI model | Google Gemini (`gemini-3.6-flash`) — swappable to OpenAI or Anthropic via env vars |
| Hosting | Any static host |

The AI provider key never reaches the browser — it lives only as a Supabase
Edge Function secret. The frontend calls the `ask-ai` function, which calls the
model server-side.

## Run it locally

No install, no build. Serve the folder over HTTP (auth needs a real origin, so
`file://` will not work) — e.g. the VS Code **Live Server** extension, or any
static server — and open the served URL.

Without configuration the site runs in **demo mode**: no login is required and
the tutor uses built-in sample replies.

## Enable accounts and live AI

1. **Create a Supabase project** and from **Project Settings → API** copy the
   **Project URL** and the **anon public** key.
2. **Add them to [`js/config.js`](js/config.js)** (both are safe in the browser):
   ```js
   window.ADERA_CONFIG = {
       SUPABASE_URL: "https://YOUR-PROJECT.supabase.co",
       SUPABASE_ANON_KEY: "your-anon-key"
   };
   ```
3. **Auth settings** — in **Authentication → URL Configuration**, set the
   **Site URL** and **Redirect URLs** to where the site is served.
4. **Deploy the Edge Function** — in the Supabase dashboard, **Edge Functions →
   Create a new function**, name it `ask-ai`, paste
   [`supabase/functions/ask-ai/index.ts`](supabase/functions/ask-ai/index.ts),
   and Deploy. Leave **Verify JWT** on.
5. **Set the function secrets** — **Edge Functions → Secrets**:

   | Secret | Required | Notes |
   |---|---|---|
   | `AI_API_KEY` | yes | provider key (e.g. Google AI Studio for Gemini) |
   | `AI_PROVIDER` | no | `gemini` (default) · `openai` · `anthropic` |
   | `AI_MODEL` | no | override the default model name |
   | `AI_BASE_URL` | no | base URL for an OpenAI-compatible API |
   | `REQUIRE_AUTH` | no | `true` to reject non-signed-in callers |
   | `ALLOW_ORIGIN` | no | lock CORS to a single origin |

## Project structure

```
index.html                     landing page
dashboard.html                 subject picker + progress
lesson.html                    AI lesson + inline tutor
quiz.html  result.html         quiz flow and score
tutor.html                     full-page AI tutor
login.html  signup.html        auth pages
css/style.css                  all styles
js/app.js                      lesson + quiz logic
js/tutor.js                    tutor page + saved conversations
js/auth.js  js/auth-forms.js   route guard, header, sign in/up
js/ai.js                       browser -> ask-ai function
js/config.js                   Supabase URL + anon key
js/supabaseClient.js           shared Supabase client
supabase/functions/ask-ai/     Edge Function (AI proxy)
```

## Team

_add names / roles_
