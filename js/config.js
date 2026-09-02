/*
 * AderaLearn configuration.
 *
 * Fill these in with the values from your Supabase project:
 *   Supabase dashboard -> Project Settings -> API
 *
 * Leave them blank to run the site in "demo mode":
 *   - no login is required
 *   - the AI tutor uses built-in sample replies
 *
 * These two values are safe to expose in the browser. Your Gemini API key is
 * NOT here on purpose - it lives only inside the Supabase Edge Function.
 */
window.ADERA_CONFIG = {
    SUPABASE_URL: "https://xqsjvlkfjiafhrlrqfhu.supabase.co",
    SUPABASE_ANON_KEY: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inhxc2p2bGtmamlhZmhybHJxZmh1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODgzNzQxNjcsImV4cCI6MjEwMzk1MDE2N30.lO1JlUPzPNTNNq89lFldSepr-6Hd9EHIfBu0V2ddnsM"
};
