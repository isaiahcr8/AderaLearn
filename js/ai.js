(function () {
    "use strict";

    var sb = window.sb;

    window.ADERA_AI_READY = Boolean(sb);

    // Build an Error from the Edge Function's structured JSON body, carrying the
    // machine-readable `code` (e.g. "RATE_LIMITED") and `retryAfter` seconds so
    // the UI can show a countdown. Never surfaces provider/model/billing text —
    // the function already strips that.
    function errorFromBody(body, fallbackMessage) {
        var message =
            body && typeof body.error === "string" && body.error
                ? body.error
                : fallbackMessage;

        var e = new Error(message || "The AI service had a problem. Please try again.");

        if (body && typeof body.code === "string") {
            e.code = body.code;
        }
        if (body && typeof body.retryAfter === "number") {
            e.retryAfter = body.retryAfter;
        }

        return e;
    }

    // Pull the clearest possible message out of a failed functions.invoke() call.
    // supabase-js wraps a non-2xx response in a FunctionsHttpError whose `context`
    // is the raw Response, so the server's structured error JSON is one step away.
    function readError(err) {
        var fallback =
            "The AI service could not be reached. Check your connection and try again.";

        if (!err) {
            return new Error(fallback);
        }

        var ctx = err.context;

        if (ctx && typeof ctx.json === "function") {
            return ctx
                .json()
                .then(function (body) {
                    return errorFromBody(body, err.message || fallback);
                })
                .catch(function () {
                    return new Error(err.message || fallback);
                });
        }

        return new Error(err.message || fallback);
    }

    // Single entry point to the Edge Function. Always resolves with the parsed
    // data object or rejects with a real Error carrying a useful message.
    function callAskAI(payload) {
        if (!sb) {
            return Promise.reject(new Error("AI backend not configured"));
        }

        return sb.functions
            .invoke("ask-ai", { body: payload })
            .then(function (res) {
                if (res.error) {
                    // Some supabase-js versions still parse the error body into
                    // res.data — prefer that structured payload when present.
                    if (
                        res.data &&
                        typeof res.data.error === "string" &&
                        res.data.error
                    ) {
                        throw errorFromBody(res.data, res.error.message);
                    }

                    return Promise.resolve(readError(res.error)).then(function (e) {
                        throw e;
                    });
                }

                var data = res.data || {};

                if (typeof data.error === "string" && data.error) {
                    throw errorFromBody(data, "The AI service had a problem.");
                }

                return data;
            });
    }

    // --- Tutor ------------------------------------------------------------
    // Resolves with { text, truncated }. Kept backwards compatible: callers
    // that only read the resolved value as a string still work because the
    // object is returned, but tutor.js / app.js now read `.text`.
    window.askAderaAI = function (opts) {
        opts = opts || {};

        var payload = {
            type: "tutor",
            messages: Array.isArray(opts.messages) ? opts.messages : [],
            topic: opts.topic || "",
            subject: opts.subject || ""
        };

        return callAskAI(payload).then(function (data) {
            if (typeof data.text !== "string" || data.text.trim() === "") {
                throw new Error("The AI returned an empty response. Please try again.");
            }
            return { text: data.text, truncated: Boolean(data.truncated) };
        });
    };

    // --- Lesson ---------------------------------------------------------
    // Resolves with either
    //   { relevant: true, title, introduction, explanation[], examples[],
    //     keyPoints[], summary }
    // or, when the topic clearly belongs to another subject,
    //   { relevant: false, suggestion: "<friendly sentence>" }.
    // The relevance judgement happens inside this same request — there is no
    // separate classification call.
    window.generateLesson = function (opts) {
        opts = opts || {};

        var topic = (opts.topic || "").trim();
        if (!topic) {
            return Promise.reject(new Error("Enter a topic to generate a lesson."));
        }

        var payload = {
            type: "lesson",
            topic: topic,
            subject: (opts.subject || "").trim(),
            difficulty: (opts.difficulty || "Beginner").trim()
        };

        return callAskAI(payload).then(function (data) {
            if (data && data.relevant === false) {
                return {
                    relevant: false,
                    suggestion: String(data.suggestion || "").trim()
                };
            }

            var lesson = data.lesson;

            if (
                !lesson ||
                typeof lesson.title !== "string" ||
                !lesson.title.trim() ||
                !Array.isArray(lesson.explanation) ||
                lesson.explanation.length === 0
            ) {
                throw new Error(
                    "The lesson came back in an unexpected shape. Please try again."
                );
            }

            return {
                relevant: true,
                title: String(lesson.title).trim(),
                introduction: String(lesson.introduction || "").trim(),
                explanation: lesson.explanation.map(String),
                examples: Array.isArray(lesson.examples)
                    ? lesson.examples.map(String)
                    : [],
                keyPoints: Array.isArray(lesson.keyPoints)
                    ? lesson.keyPoints.map(String)
                    : [],
                summary: String(lesson.summary || "").trim()
            };
        });
    };

    // --- Quiz ---------------------------------------------------------
    // Resolves with an array of
    // { question, options[4], correctIndex, explanation }.
    window.generateQuiz = function (opts) {
        opts = opts || {};

        var topic = (opts.topic || "").trim();
        if (!topic) {
            return Promise.reject(new Error("Enter a topic to generate a quiz."));
        }

        var payload = {
            type: "quiz",
            topic: topic,
            subject: (opts.subject || "").trim(),
            difficulty: (opts.difficulty || "Beginner").trim(),
            count: opts.count || 5
        };

        return callAskAI(payload).then(function (data) {
            var quiz = data.quiz;
            var list = quiz && Array.isArray(quiz.questions) ? quiz.questions : [];

            var cleaned = list
                .map(function (q) {
                    if (!q || typeof q.question !== "string") {
                        return null;
                    }

                    var options = Array.isArray(q.options)
                        ? q.options.map(String)
                        : [];
                    var correctIndex = Number(q.correctIndex);

                    if (
                        options.length !== 4 ||
                        !Number.isInteger(correctIndex) ||
                        correctIndex < 0 ||
                        correctIndex > 3
                    ) {
                        return null;
                    }

                    return {
                        question: q.question.trim(),
                        options: options,
                        correctIndex: correctIndex,
                        explanation: String(q.explanation || "").trim()
                    };
                })
                .filter(Boolean);

            if (cleaned.length < 3) {
                throw new Error(
                    "The quiz could not be built this time. Please try again."
                );
            }

            return cleaned;
        });
    };
})();
