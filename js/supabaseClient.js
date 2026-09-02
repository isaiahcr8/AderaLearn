/*
 * Creates a single shared Supabase client from the values in js/config.js.
 * Exposes:
 *   window.sb           -> the Supabase client, or null if not configured
 *   window.ADERA_READY  -> true when the client is usable
 */
(function () {
    "use strict";

    var cfg = window.ADERA_CONFIG || {};
    var hasConfig = Boolean(cfg.SUPABASE_URL && cfg.SUPABASE_ANON_KEY);
    var hasLib =
        typeof window.supabase !== "undefined" &&
        typeof window.supabase.createClient === "function";

    if (hasConfig && hasLib) {
        window.sb = window.supabase.createClient(
            cfg.SUPABASE_URL,
            cfg.SUPABASE_ANON_KEY
        );
        window.ADERA_READY = true;
        return;
    }

    window.sb = null;
    window.ADERA_READY = false;

    if (!hasConfig) {
        console.warn(
            "[AderaLearn] Supabase is not configured. Add your keys in js/config.js " +
            "(see SETUP.md). Login and live AI stay disabled until then."
        );
    } else if (!hasLib) {
        console.warn(
            "[AderaLearn] The supabase-js library did not load from the CDN."
        );
    }
})();
