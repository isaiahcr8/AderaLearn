document.addEventListener("DOMContentLoaded", () => {

    console.log("AderaLearn loaded successfully.");

    /* ------------------------------------------------------------------ */
    /* shared helpers                                                      */
    /* ------------------------------------------------------------------ */

    function el(tag, className, text) {
        const node = document.createElement(tag);
        if (className) {
            node.className = className;
        }
        if (text !== undefined && text !== null) {
            node.textContent = text;
        }
        return node;
    }

    function safeGet(key) {
        try {
            return (localStorage.getItem(key) || "").trim();
        } catch (e) {
            return "";
        }
    }

    function safeSet(key, value) {
        try {
            localStorage.setItem(key, value);
        } catch (e) {
            /* storage unavailable — non-fatal */
        }
    }

    function setSelectValue(select, value) {
        if (!select || !value) {
            return;
        }
        const match = Array.from(select.options).find(
            (option) => option.value.toLowerCase() === value.toLowerCase()
        );
        if (match) {
            select.value = match.value;
        }
    }

    function typingDots() {
        const span = el("span", "typing-dots");
        span.appendChild(el("span"));
        span.appendChild(el("span"));
        span.appendChild(el("span"));
        return span;
    }

    // Wire a button so it triggers `onRetry` on click, but stays disabled with a
    // visible countdown for `cooldownSeconds` first (used after a RATE_LIMITED
    // error so students cannot fire more quota-consuming requests immediately).
    function wireRetryButton(button, onRetry, cooldownSeconds, onReady) {
        const label = button.textContent || "Try again";
        let remaining = Math.ceil(Number(cooldownSeconds) || 0);
        let timer = null;

        function stop() {
            if (timer) {
                clearInterval(timer);
                timer = null;
            }
        }

        function ready() {
            stop();
            button.disabled = false;
            button.textContent = label;
            if (typeof onReady === "function") {
                onReady();
            }
        }

        function tick() {
            if (remaining <= 0) {
                ready();
                return;
            }
            button.disabled = true;
            button.textContent = `${label} (${remaining}s)`;
            remaining -= 1;
        }

        button.addEventListener("click", () => {
            if (button.disabled) {
                return;
            }
            stop();
            onRetry();
        });

        if (remaining > 0) {
            tick();
            timer = setInterval(tick, 1000);
        } else if (typeof onReady === "function") {
            onReady();
        }
    }

    // Seconds to wait before a retry is allowed, from a thrown AI error.
    function cooldownFor(err) {
        if (err && err.code === "RATE_LIMITED") {
            const secs = Number(err.retryAfter);
            return Number.isFinite(secs) && secs > 0 ? secs : 60;
        }
        return 0;
    }

    /* ------------------------------------------------------------------ */
    /* smooth in-page anchor scrolling                                     */
    /* ------------------------------------------------------------------ */

    document.querySelectorAll('a[href^="#"]').forEach((link) => {
        link.addEventListener("click", function (event) {
            const href = this.getAttribute("href");

            if (!href || href === "#" || href.length < 2) {
                return;
            }

            const target = document.querySelector(href);

            if (target) {
                event.preventDefault();
                target.scrollIntoView({ behavior: "smooth" });
            }
        });
    });

    /* ------------------------------------------------------------------ */
    /* dashboard: subject selection + topic entry                          */
    /* ------------------------------------------------------------------ */

    function initDashboard() {
        const subjectCards = document.querySelectorAll(".subject-card");
        const learnButton = document.getElementById("learnButton");
        const topicInput = document.getElementById("topicInput");

        if (!subjectCards.length && !learnButton) {
            return;
        }

        let selectedSubject = safeGet("learningSubject") || null;

        subjectCards.forEach((card) => {
            if (card.dataset.subject === selectedSubject) {
                card.classList.add("selected");
            }

            card.addEventListener("click", () => {
                subjectCards.forEach((item) => item.classList.remove("selected"));
                card.classList.add("selected");
                selectedSubject = card.dataset.subject;
            });
        });

        if (!learnButton || !topicInput) {
            return;
        }

        learnButton.addEventListener("click", () => {
            const topic = topicInput.value.trim();

            if (!selectedSubject) {
                alert("Please choose a subject first.");
                return;
            }

            if (topic === "") {
                alert("Please enter a topic you want to learn.");
                return;
            }

            // Any non-empty topic is accepted here. Whether it actually fits the
            // chosen subject is judged by the lesson request itself (see
            // js/ai.js -> generateLesson and the Edge Function "lesson" type),
            // so there is no separate classification call and no keyword list.
            safeSet("learningSubject", selectedSubject);
            safeSet("learningTopic", topic);
            window.location.href = "lesson.html";
        });
    }

    /* ------------------------------------------------------------------ */
    /* lesson page: AI-generated structured lesson                         */
    /* ------------------------------------------------------------------ */

    function initLessonPage() {
        const content = document.getElementById("lessonContent");
        const controls = document.getElementById("lessonControls");

        if (!content || !controls) {
            return;
        }

        const subjectSelect = document.getElementById("lessonSubjectSelect");
        const topicInput = document.getElementById("lessonTopicInput");
        const difficultySelect = document.getElementById("lessonDifficultySelect");
        const generateBtn = document.getElementById("generateLessonBtn");
        const titleEl = document.getElementById("lessonTitle");
        const subjectMeta = document.getElementById("lessonSubject");
        const difficultyMeta = document.getElementById("lessonDifficulty");

        setSelectValue(subjectSelect, safeGet("learningSubject"));
        setSelectValue(difficultySelect, safeGet("learningDifficulty"));
        if (topicInput && safeGet("learningTopic")) {
            topicInput.value = safeGet("learningTopic");
        }

        let busy = false;

        function mount(node) {
            content.innerHTML = "";
            content.appendChild(node);
        }

        function panel(variant, icon, title, message, actionLabel, onAction, cooldown) {
            const wrap = el("div", "lesson-panel " + variant);
            wrap.appendChild(el("div", "ai-small-icon", icon));
            wrap.appendChild(el("h2", null, title));
            wrap.appendChild(el("p", null, message));

            if (actionLabel && onAction) {
                const btn = el("button", "btn btn-primary", actionLabel);
                btn.type = "button";
                wireRetryButton(btn, onAction, cooldown);
                wrap.appendChild(btn);
            }

            return wrap;
        }

        function renderLesson(lesson) {
            const frag = document.createDocumentFragment();

            frag.appendChild(el("h2", null, "Introduction"));
            frag.appendChild(el("p", null, lesson.introduction));

            frag.appendChild(el("h2", null, "Explanation"));
            lesson.explanation.forEach((paragraph) => {
                frag.appendChild(el("p", null, paragraph));
            });

            if (lesson.examples.length) {
                frag.appendChild(el("h2", null, "Examples"));
                lesson.examples.forEach((example) => {
                    const box = el("div", "info-box");
                    box.appendChild(el("strong", null, "Example"));
                    box.appendChild(el("p", null, example));
                    frag.appendChild(box);
                });
            }

            if (lesson.keyPoints.length) {
                const kp = el("div", "key-points");
                kp.appendChild(el("h3", null, "Key points"));
                const ul = document.createElement("ul");
                lesson.keyPoints.forEach((point) => {
                    ul.appendChild(el("li", null, point));
                });
                kp.appendChild(ul);
                frag.appendChild(kp);
            }

            if (lesson.summary) {
                frag.appendChild(el("h2", null, "Summary"));
                frag.appendChild(el("p", null, lesson.summary));
            }

            content.innerHTML = "";
            content.appendChild(frag);

            if (titleEl) {
                titleEl.textContent = lesson.title;
            }
            document.title = lesson.title + " — AderaLearn";
        }

        function generate() {
            if (busy) {
                return;
            }

            const subject = subjectSelect ? subjectSelect.value.trim() : "";
            const topic = topicInput ? topicInput.value.trim() : "";
            const difficulty = difficultySelect
                ? difficultySelect.value.trim()
                : "Beginner";

            if (!topic) {
                mount(panel(
                    "is-notice", "✦", "Choose what to learn",
                    "Pick a subject, type a topic, then press Generate lesson.",
                    null, null
                ));
                return;
            }

            safeSet("learningSubject", subject);
            safeSet("learningTopic", topic);
            safeSet("learningDifficulty", difficulty);

            if (subjectMeta) {
                subjectMeta.textContent = subject || "Subject";
            }
            if (difficultyMeta) {
                difficultyMeta.textContent = difficulty;
            }
            if (titleEl) {
                titleEl.textContent = topic;
            }

            if (typeof window.generateLesson !== "function" || !window.ADERA_AI_READY) {
                mount(panel(
                    "is-error", "⚠", "AI lessons unavailable",
                    "AI lessons are not configured yet. Add your Supabase keys in js/config.js.",
                    "Try again", generate
                ));
                return;
            }

            busy = true;
            if (generateBtn) {
                generateBtn.disabled = true;
                generateBtn.textContent = "Generating...";
            }

            const loading = panel(
                "is-loading", "✦", "Preparing your lesson...",
                "AderaLearn is creating an easy-to-understand lesson for you.",
                null, null
            );
            loading.appendChild(typingDots());
            mount(loading);

            let coolingDown = 0;

            window.generateLesson({ subject, topic, difficulty })
                .then((result) => {
                    if (result && result.relevant === false) {
                        mount(panel(
                            "is-notice", "✦", "Try a different topic",
                            result.suggestion ||
                                `"${topic}" doesn't look like a ${subject} topic. ` +
                                "Try another topic or change the subject.",
                            null, null
                        ));
                        return;
                    }
                    renderLesson(result);
                })
                .catch((err) => {
                    coolingDown = cooldownFor(err);
                    mount(panel(
                        "is-error", "⚠", "That didn't work",
                        (err && err.message) || "We couldn't generate this lesson.",
                        "Try again", generate, coolingDown
                    ));

                    if (coolingDown > 0) {
                        if (generateBtn) {
                            generateBtn.textContent = "Please wait…";
                        }
                        // Release the lock only once the cooldown elapses, so a
                        // repeat request cannot fire early and burn more quota.
                        window.setTimeout(() => {
                            busy = false;
                            if (generateBtn) {
                                generateBtn.disabled = false;
                                generateBtn.textContent = "Generate lesson";
                            }
                        }, coolingDown * 1000);
                    }
                })
                .then(() => {
                    if (coolingDown > 0) {
                        return; // handled by the cooldown timer above
                    }
                    busy = false;
                    if (generateBtn) {
                        generateBtn.disabled = false;
                        generateBtn.textContent = "Generate lesson";
                    }
                });
        }

        controls.addEventListener("submit", (event) => {
            event.preventDefault();
            generate();
        });

        if (topicInput && topicInput.value.trim()) {
            generate();
        } else {
            mount(panel(
                "is-notice", "✦", "Choose what to learn",
                "Pick a subject, type a topic, then press Generate lesson.",
                null, null
            ));
        }
    }

    /* ------------------------------------------------------------------ */
    /* inline tutor (lesson page aside)                                    */
    /* ------------------------------------------------------------------ */

    function initInlineTutor() {
        if (document.body.classList.contains("tutor-page")) {
            return; // the standalone tutor page has its own controller
        }

        const form = document.getElementById("chatForm");
        const input = document.getElementById("questionInput");
        const messages = document.getElementById("chatMessages");

        if (!form || !input || !messages) {
            return;
        }

        const history = [];
        let busy = false;

        function setEnabled(on) {
            input.disabled = !on;
            const btn = form.querySelector("button[type=submit]");
            if (btn) {
                btn.disabled = !on;
            }
        }

        function addBubble(role, text) {
            const node = el(
                "div",
                role === "user" ? "student-message" : "ai-message",
                text
            );
            messages.appendChild(node);
            messages.scrollTop = messages.scrollHeight;
            return node;
        }

        function showError(message, retryText, cooldown) {
            const wrap = el("div", "ai-message is-error");
            wrap.appendChild(el(
                "p", "chat-error-text",
                message || "Something went wrong reaching the tutor."
            ));

            const retry = el("button", "chat-retry-btn", "Retry");
            retry.type = "button";
            wireRetryButton(
                retry,
                () => {
                    wrap.remove();

                    if (
                        history.length &&
                        history[history.length - 1].role === "user" &&
                        history[history.length - 1].text === retryText
                    ) {
                        history.pop();
                    }

                    const studentBubbles =
                        messages.querySelectorAll(".student-message");
                    if (studentBubbles.length) {
                        studentBubbles[studentBubbles.length - 1].remove();
                    }

                    ask(retryText);
                },
                cooldown,
                () => setEnabled(true)
            );
            wrap.appendChild(retry);

            messages.appendChild(wrap);
            messages.scrollTop = messages.scrollHeight;
        }

        function ask(rawText) {
            const text = (rawText || "").trim();

            if (busy || text === "") {
                return;
            }

            const last = history[history.length - 1];
            if (last && last.role === "user" && last.text === text) {
                return;
            }

            addBubble("user", text);
            history.push({ role: "user", text: text });

            busy = true;
            setEnabled(false);

            const pending = el("div", "ai-message is-pending");
            pending.appendChild(typingDots());
            messages.appendChild(pending);
            messages.scrollTop = messages.scrollHeight;

            const release = () => {
                busy = false;
                setEnabled(true);
                input.focus();
            };

            if (typeof window.askAderaAI !== "function" || !window.ADERA_AI_READY) {
                pending.remove();
                showError(
                    "The AI tutor is not configured yet. Add your Supabase keys in js/config.js.",
                    text,
                    0
                );
                release();
                return;
            }

            window.askAderaAI({
                messages: history.slice(-12),
                topic: safeGet("learningTopic") || "this lesson",
                subject: safeGet("learningSubject")
            })
                .then((reply) => {
                    pending.remove();
                    addBubble("ai", reply.text);
                    history.push({ role: "ai", text: reply.text });

                    if (reply.truncated) {
                        const note = el(
                            "div", "chat-note",
                            "That was a long answer and may still be shortened — ask a follow-up."
                        );
                        messages.appendChild(note);
                        messages.scrollTop = messages.scrollHeight;
                    }

                    release();
                })
                .catch((err) => {
                    pending.remove();
                    busy = false;

                    const cd = cooldownFor(err);
                    if (cd > 0) {
                        setEnabled(false); // re-enabled when the countdown ends
                    } else {
                        setEnabled(true);
                        input.focus();
                    }

                    showError(err && err.message, text, cd);
                });
        }

        form.addEventListener("submit", (event) => {
            event.preventDefault();

            if (busy) {
                return;
            }

            const text = input.value.trim();
            if (text === "") {
                return;
            }

            input.value = "";
            ask(text);
        });
    }

    /* ------------------------------------------------------------------ */
    /* quiz page: AI-generated multiple-choice quiz                        */
    /* ------------------------------------------------------------------ */

    function initQuizPage() {
        const container = document.querySelector(".quiz-container");
        const questionText = document.getElementById("questionText");
        const answerWrap = document.querySelector(".answer-options");
        const nextBtn = document.getElementById("nextQuestion");
        const prevBtn = document.getElementById("previousQuestion");

        if (!container || !questionText || !answerWrap || !nextBtn || !prevBtn) {
            return;
        }

        const topicHeading = document.getElementById("quizTopic");
        const questionNumber = document.getElementById("questionNumber");
        const answeredLabel = document.getElementById("quizScore");
        const quizProgress = document.getElementById("quizProgress");
        const questionCard = document.querySelector(".question-card");
        const questionLabel = document.querySelector(".question-label");
        const actions = document.querySelector(".quiz-actions");
        const progressTop = document.querySelector(".quiz-progress-top");

        const subject = safeGet("learningSubject");
        const topic = safeGet("learningTopic") || "Your Topic";
        const difficulty = safeGet("learningDifficulty") || "Beginner";

        if (topicHeading) {
            topicHeading.textContent = topic;
        }

        let questions = [];
        let answers = [];
        let current = 0;
        let loading = false;

        function setChrome(visible) {
            if (questionCard) {
                questionCard.style.display = visible ? "" : "none";
            }
            if (actions) {
                actions.style.display = visible ? "" : "none";
            }
            if (progressTop) {
                progressTop.style.display = visible ? "" : "none";
            }
        }

        function showPanel(variant, icon, title, message, actionLabel, onAction, cooldown) {
            setChrome(false);

            let panel = container.querySelector(".quiz-panel");
            if (!panel) {
                panel = el("div", "quiz-panel");
                container.appendChild(panel);
            }
            panel.className = "quiz-panel " + variant;
            panel.innerHTML = "";
            panel.appendChild(el("div", "ai-small-icon", icon));
            panel.appendChild(el("h2", null, title));
            panel.appendChild(el("p", null, message));

            if (actionLabel && onAction) {
                const btn = el("button", "btn btn-primary", actionLabel);
                btn.type = "button";
                wireRetryButton(btn, onAction, cooldown);
                panel.appendChild(btn);
            }
        }

        function clearPanel() {
            const panel = container.querySelector(".quiz-panel");
            if (panel) {
                panel.remove();
            }
            setChrome(true);
        }

        function answeredCount() {
            return answers.reduce(
                (total, value) => total + (Number.isInteger(value) ? 1 : 0),
                0
            );
        }

        function updateAnsweredLabel() {
            if (answeredLabel) {
                answeredLabel.textContent =
                    `Answered: ${answeredCount()} / ${questions.length}`;
            }
        }

        function renderQuestion() {
            clearPanel();

            const q = questions[current];

            questionText.textContent = q.question;

            if (questionNumber) {
                questionNumber.textContent =
                    `Question ${current + 1} of ${questions.length}`;
            }
            if (questionLabel) {
                questionLabel.textContent = `QUESTION ${current + 1}`;
            }
            if (quizProgress) {
                quizProgress.style.width =
                    `${((current + 1) / questions.length) * 100}%`;
            }

            answerWrap.innerHTML = "";
            q.options.forEach((optionText, index) => {
                const btn = el("button", "answer-option");
                btn.type = "button";
                btn.appendChild(el("span", null, String.fromCharCode(65 + index)));
                btn.appendChild(document.createTextNode(" " + optionText));

                if (answers[current] === index) {
                    btn.classList.add("selected");
                }

                btn.addEventListener("click", () => {
                    answers[current] = index;
                    answerWrap.querySelectorAll(".answer-option").forEach((other) => {
                        other.classList.remove("selected");
                    });
                    btn.classList.add("selected");
                    updateAnsweredLabel();
                });

                answerWrap.appendChild(btn);
            });

            prevBtn.disabled = current === 0;
            nextBtn.textContent =
                current === questions.length - 1 ? "Submit Quiz" : "Next Question →";

            updateAnsweredLabel();
        }

        function submit() {
            const missing = [];
            for (let i = 0; i < questions.length; i++) {
                if (!Number.isInteger(answers[i])) {
                    missing.push(i + 1);
                }
            }

            if (missing.length) {
                alert(
                    "Please answer every question before submitting. " +
                    "Still to answer: " + missing.join(", ")
                );
                return;
            }

            let score = 0;
            const review = questions.map((q, i) => {
                if (answers[i] === q.correctIndex) {
                    score++;
                }
                return {
                    question: q.question,
                    options: q.options,
                    correctIndex: q.correctIndex,
                    chosenIndex: answers[i],
                    explanation: q.explanation
                };
            });

            safeSet("quizScore", String(score));
            safeSet("quizTotal", String(questions.length));
            safeSet("quizReview", JSON.stringify(review));

            window.location.href = "result.html";
        }

        function goNext() {
            if (!Number.isInteger(answers[current])) {
                alert("Please choose an answer first.");
                return;
            }

            if (current < questions.length - 1) {
                current++;
                renderQuestion();
            } else {
                submit();
            }
        }

        function loadQuiz() {
            if (loading) {
                return;
            }

            questions = [];
            answers = [];
            current = 0;

            if (safeGet("learningTopic") === "") {
                showPanel(
                    "is-notice", "✦", "Pick a topic first",
                    "Choose a subject and topic on the dashboard, then come back for the quiz.",
                    "Go to dashboard",
                    () => { window.location.href = "dashboard.html"; }
                );
                return;
            }

            if (typeof window.generateQuiz !== "function" || !window.ADERA_AI_READY) {
                showPanel(
                    "is-error", "⚠", "Quiz unavailable",
                    "AI quizzes are not configured yet. Add your Supabase keys in js/config.js.",
                    "Try again", loadQuiz
                );
                return;
            }

            loading = true;

            showPanel(
                "is-loading", "✦", "Building your quiz...",
                `AderaLearn is writing questions about ${topic}.`,
                null, null
            );

            window.generateQuiz({ subject, topic, difficulty, count: 5 })
                .then((list) => {
                    questions = list;
                    answers = new Array(questions.length).fill(null);
                    renderQuestion();
                    loading = false;
                })
                .catch((err) => {
                    const cd = cooldownFor(err);
                    showPanel(
                        "is-error", "⚠", "That didn't work",
                        (err && err.message) || "We couldn't build this quiz.",
                        "Try again", loadQuiz, cd
                    );

                    if (cd > 0) {
                        // Keep the loader lock until the cooldown elapses so a
                        // retry cannot fire early and burn more quota.
                        window.setTimeout(() => { loading = false; }, cd * 1000);
                    } else {
                        loading = false;
                    }
                });
        }

        nextBtn.addEventListener("click", goNext);
        prevBtn.addEventListener("click", () => {
            if (current > 0) {
                current--;
                renderQuestion();
            }
        });

        loadQuiz();
    }

    /* ------------------------------------------------------------------ */
    /* result page: score + answer review                                 */
    /* ------------------------------------------------------------------ */

    function initResultPage() {
        const resultScore = document.getElementById("resultScore");
        const resultPercentage = document.getElementById("resultPercentage");
        const resultMessage = document.getElementById("resultMessage");
        const resultFeedback = document.getElementById("resultFeedback");
        const resultTopic = document.getElementById("resultTopic");

        if (
            !resultScore ||
            !resultPercentage ||
            !resultMessage ||
            !resultFeedback ||
            !resultTopic
        ) {
            return;
        }

        const score = Number(safeGet("quizScore")) || 0;
        const total = Number(safeGet("quizTotal")) || 5;
        const topic = safeGet("learningTopic") || "your topic";
        const subject = safeGet("learningSubject") || "your subject";
        const percentage = total ? Math.round((score / total) * 100) : 0;

        resultScore.textContent = `${score} / ${total}`;
        resultPercentage.textContent = `${percentage}%`;
        resultTopic.textContent =
            `You completed the ${topic} quiz in ${subject}.`;

        if (percentage >= 80) {
            resultMessage.textContent = "Excellent work! 🎉";
            resultFeedback.textContent =
                "You understood this lesson really well. Keep it up!";
        } else if (percentage >= 60) {
            resultMessage.textContent = "Good job! 🔥";
            resultFeedback.textContent =
                "You have a good understanding of the topic. A little review will make you even stronger.";
        } else {
            resultMessage.textContent = "Keep going! 💪";
            resultFeedback.textContent =
                "Review the lesson again and try the quiz one more time.";
        }

        renderReview();
    }

    function renderReview() {
        const mount = document.getElementById("quizReview");
        if (!mount) {
            return;
        }

        let review;
        try {
            review = JSON.parse(safeGet("quizReview") || "[]");
        } catch (e) {
            review = [];
        }

        if (!Array.isArray(review) || review.length === 0) {
            return;
        }

        mount.innerHTML = "";
        mount.appendChild(el("h3", "quiz-review-title", "Review"));

        review.forEach((item, index) => {
            const card = el("div", "review-item");
            card.appendChild(el("span", "review-q-label", `QUESTION ${index + 1}`));
            card.appendChild(el("p", "review-q", item.question));

            const list = el("div", "review-options");
            (item.options || []).forEach((optionText, optionIndex) => {
                const row = el("div", "review-option");

                if (optionIndex === item.correctIndex) {
                    row.classList.add("is-correct");
                }
                if (
                    optionIndex === item.chosenIndex &&
                    optionIndex !== item.correctIndex
                ) {
                    row.classList.add("is-wrong");
                }

                row.appendChild(el(
                    "span", "review-badge", String.fromCharCode(65 + optionIndex)
                ));
                row.appendChild(el("span", "review-text", optionText));

                const tags = [];
                if (optionIndex === item.chosenIndex) {
                    tags.push("Your answer");
                }
                if (optionIndex === item.correctIndex) {
                    tags.push("Correct");
                }
                if (tags.length) {
                    row.appendChild(el("span", "review-tag", tags.join(" · ")));
                }

                list.appendChild(row);
            });
            card.appendChild(list);

            if (item.explanation) {
                const explain = el("div", "review-explain");
                explain.appendChild(el("strong", null, "Why: "));
                explain.appendChild(document.createTextNode(item.explanation));
                card.appendChild(explain);
            }

            mount.appendChild(card);
        });
    }

    /* ------------------------------------------------------------------ */

    initDashboard();
    initLessonPage();
    initInlineTutor();
    initQuizPage();
    initResultPage();
});
