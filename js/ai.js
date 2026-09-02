/*
 * Calls the "ask-ai" Supabase Edge Function, which talks to Google Gemini on
 * the server side. The Gemini key never touches the browser.
 *
 * Exposes:
 *   window.askAderaAI({ messages, topic, subject }) -> Promise<string>
 *   window.ADERA_AI_READY                           -> boolean
 *
 * `messages` is an array of { role: "user" | "ai", text: string }.
 */
(function () {
    "use strict";

    var sb = window.sb;

    window.ADERA_AI_READY = Boolean(sb);

    window.askAderaAI = function (opts) {
        if (!sb) {
            return Promise.reject(new Error("AI backend not configured"));
        }

        opts = opts || {};

        var payload = {
            messages: Array.isArray(opts.messages) ? opts.messages : [],
            topic: opts.topic || "",
            subject: opts.subject || ""
        };

        return sb.functions
            .invoke("ask-ai", { body: payload })
            .then(function (res) {
                if (res.error) {
                    throw res.error;
                }
                if (!res.data || typeof res.data.text !== "string") {
                    throw new Error("Empty AI response");
                }
                return res.data.text;
            });
    };
})();
