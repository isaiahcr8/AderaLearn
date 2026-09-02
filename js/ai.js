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
