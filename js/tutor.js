document.addEventListener("DOMContentLoaded", () => {

    const chatMessages = document.getElementById("chatMessages");
    const chatForm = document.getElementById("chatForm");
    const questionInput = document.getElementById("questionInput");
    const conversationList = document.getElementById("conversationList");
    const newChatBtn = document.getElementById("newChatBtn");
    const clearChatBtn = document.getElementById("clearChatBtn");
    const suggested = document.getElementById("suggestedQuestions");
    const topicName = document.getElementById("tutorTopicName");
    const topicSub = document.getElementById("tutorTopicSub");
    const chipTopic = document.getElementById("chipTopic");

    if (!chatMessages || !chatForm || !conversationList) {
        return;
    }

    const CHATS_KEY = "tutorChats";
    const ACTIVE_KEY = "tutorActiveChat";
    const DEFAULT_TITLE = "New conversation";

    let chats = loadChats();
    let activeId = "";

    try {
        activeId = localStorage.getItem(ACTIVE_KEY) || "";
    } catch (e) {
        activeId = "";
    }

    function getTopic() {
        let stored = "";

        try {
            stored = (localStorage.getItem("learningTopic") || "").trim();
        } catch (e) {
            stored = "";
        }

        return stored || "General learning";
    }

    function getSubject() {
        try {
            return (localStorage.getItem("learningSubject") || "").trim();
        } catch (e) {
            return "";
        }
    }

    function uid() {
        return "c" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
    }

    function loadChats() {
        try {
            const parsed = JSON.parse(localStorage.getItem("tutorChats") || "[]");
            return Array.isArray(parsed) ? parsed : [];
        } catch (e) {
            return [];
        }
    }

    function saveChats() {
        try {
            localStorage.setItem(CHATS_KEY, JSON.stringify(chats));
            localStorage.setItem(ACTIVE_KEY, activeId);
        } catch (e) {
            return;
        }
    }

    function greetingText(topic) {
        return "Hi! 👋 I'm AderaLearn AI. Ask me anything about " + topic + ".";
    }

    function createChat() {
        const topic = getTopic();
        const subject = getSubject();

        const chat = {
            id: uid(),
            title: DEFAULT_TITLE,
            topic: topic,
            subject: subject,
            messages: [{ role: "ai", text: greetingText(topic) }],
            createdAt: Date.now(),
            updatedAt: Date.now()
        };

        chats.unshift(chat);
        activeId = chat.id;
        return chat;
    }

    function getActive() {
        return chats.find(chat => chat.id === activeId) || null;
    }

    function timeAgo(ts) {
        const minutes = Math.floor((Date.now() - ts) / 60000);

        if (minutes < 1) {
            return "just now";
        }

        if (minutes < 60) {
            return minutes + "m ago";
        }

        const hours = Math.floor(minutes / 60);

        if (hours < 24) {
            return hours + "h ago";
        }

        const days = Math.floor(hours / 24);

        if (days < 7) {
            return days + "d ago";
        }

        return new Date(ts).toLocaleDateString();
    }

    function makeBubble(role, text) {
        const el = document.createElement("div");
        el.className = role === "user" ? "student-message" : "ai-message";
        el.textContent = text;
        return el;
    }

    function renderMessages() {
        const chat = getActive();
        chatMessages.innerHTML = "";

        if (!chat) {
            return;
        }

        chat.messages.forEach(message => {
            chatMessages.appendChild(makeBubble(message.role, message.text));
        });

        chatMessages.scrollTop = chatMessages.scrollHeight;
    }

    function renderTopic() {
        const chat = getActive();
        const topic = chat ? chat.topic : getTopic();
        const subject = chat ? chat.subject : getSubject();

        if (topicName) {
            topicName.textContent = topic;
        }

        if (topicSub) {
            topicSub.textContent = subject || "AI Tutor";
        }

        if (chipTopic) {
            chipTopic.textContent = topic;
        }
    }

    function renderList() {
        conversationList.innerHTML = "";

        if (chats.length === 0) {
            const empty = document.createElement("div");
            empty.className = "conversation-empty";
            empty.textContent = "No conversations yet.";
            conversationList.appendChild(empty);
            return;
        }

        chats.forEach(chat => {
            const item = document.createElement("button");
            item.type = "button";
            item.className = "conversation-item" + (chat.id === activeId ? " active" : "");
            item.dataset.id = chat.id;

            const title = document.createElement("span");
            title.className = "c-title";
            title.textContent = chat.title;

            const lastMessage = chat.messages[chat.messages.length - 1];
            const preview = document.createElement("span");
            preview.className = "c-preview";
            preview.textContent = lastMessage ? lastMessage.text : "";

            const meta = document.createElement("span");
            meta.className = "c-meta";

            const label = document.createElement("span");
            label.textContent = chat.topic + " · " + timeAgo(chat.updatedAt);

            const del = document.createElement("span");
            del.className = "conversation-delete";
            del.dataset.delete = chat.id;
            del.setAttribute("role", "button");
            del.setAttribute("aria-label", "Delete conversation");
            del.textContent = "✕";

            meta.appendChild(label);
            meta.appendChild(del);

            item.appendChild(title);
            item.appendChild(preview);
            item.appendChild(meta);
            conversationList.appendChild(item);
        });
    }

    function renderAll() {
        renderList();
        renderMessages();
        renderTopic();
    }

    let sending = false;

    function setComposerEnabled(on) {
        questionInput.disabled = !on;

        const submitBtn = chatForm.querySelector("button[type=submit]");
        if (submitBtn) {
            submitBtn.disabled = !on;
        }

        if (suggested) {
            suggested.querySelectorAll("button").forEach((button) => {
                button.disabled = !on;
            });
        }
    }

    function makePending() {
        const el = document.createElement("div");
        el.className = "ai-message is-pending";
        el.setAttribute("aria-label", "AderaLearn AI is typing");
        el.innerHTML =
            '<span class="typing-dots"><span></span><span></span><span></span></span>';
        return el;
    }

    // Seconds to keep retry disabled after an error (only for quota limits).
    function cooldownFor(err) {
        if (err && err.code === "RATE_LIMITED") {
            const secs = Number(err.retryAfter);
            return isFinite(secs) && secs > 0 ? secs : 60;
        }
        return 0;
    }

    // Disable `button` with a visible "(Ns)" countdown, then re-enable and call
    // onReady(). Repeated clicks while disabled are ignored by the caller.
    function wireCountdown(button, seconds, onReady) {
        let remaining = Math.ceil(Number(seconds) || 0);
        let timer = null;
        const label = button.textContent || "Retry";

        const finish = () => {
            if (timer) {
                clearInterval(timer);
                timer = null;
            }
            button.disabled = false;
            button.textContent = label;
            if (typeof onReady === "function") {
                onReady();
            }
        };

        const tick = () => {
            if (remaining <= 0) {
                finish();
                return;
            }
            button.disabled = true;
            button.textContent = `${label} (${remaining}s)`;
            remaining -= 1;
        };

        if (remaining > 0) {
            tick();
            timer = setInterval(tick, 1000);
        }
    }

    function sendMessage(rawText) {
        const chat = getActive();
        const text = (rawText || "").trim();

        if (!chat || sending || text === "") {
            return;
        }

        // Block an identical, still-unanswered question from being sent twice.
        const last = chat.messages[chat.messages.length - 1];
        if (last && last.role === "user" && last.text === text) {
            return;
        }

        chat.messages.push({ role: "user", text: text });

        if (chat.title === DEFAULT_TITLE) {
            chat.title = text.length > 40 ? text.slice(0, 40) + "…" : text;
        }

        chat.updatedAt = Date.now();
        saveChats();
        renderAll();

        sending = true;
        setComposerEnabled(false);

        const pending = makePending();
        chatMessages.appendChild(pending);
        chatMessages.scrollTop = chatMessages.scrollHeight;

        const release = () => {
            sending = false;
            setComposerEnabled(true);
            questionInput.focus();
        };

        const sameChat = () => {
            const current = getActive();
            return current && current.id === chat.id;
        };

        const finish = (reply) => {
            if (!sameChat()) {
                release();
                return;
            }

            pending.remove();

            const current = getActive();
            current.messages.push({ role: "ai", text: reply.text });
            current.updatedAt = Date.now();
            saveChats();
            renderAll();

            if (reply.truncated) {
                const note = document.createElement("div");
                note.className = "chat-note";
                note.textContent =
                    "That was a long answer and may still be shortened — ask a follow-up for more detail.";
                chatMessages.appendChild(note);
                chatMessages.scrollTop = chatMessages.scrollHeight;
            }

            release();
        };

        const showError = (message, cooldown) => {
            if (!sameChat()) {
                release();
                return;
            }

            pending.remove();
            sending = false;

            const wrap = document.createElement("div");
            wrap.className = "ai-message is-error";

            const line = document.createElement("p");
            line.className = "chat-error-text";
            line.textContent =
                message || "Something went wrong reaching the tutor.";
            wrap.appendChild(line);

            const retry = document.createElement("button");
            retry.type = "button";
            retry.className = "chat-retry-btn";
            retry.textContent = "Retry";
            retry.addEventListener("click", () => {
                if (retry.disabled) {
                    return;
                }

                wrap.remove();

                const current = getActive();
                const tail = current && current.messages[current.messages.length - 1];
                if (tail && tail.role === "user" && tail.text === text) {
                    current.messages.pop();
                    saveChats();
                    renderAll();
                }

                sendMessage(text);
            });
            wrap.appendChild(retry);

            chatMessages.appendChild(wrap);
            chatMessages.scrollTop = chatMessages.scrollHeight;

            if (cooldown && cooldown > 0) {
                // Keep the composer locked too, so a fresh question cannot be
                // sent during the quota cooldown.
                setComposerEnabled(false);
                wireCountdown(retry, cooldown, () => setComposerEnabled(true));
            } else {
                setComposerEnabled(true);
                questionInput.focus();
            }
        };

        if (typeof window.askAderaAI === "function" && window.ADERA_AI_READY) {
            const history = chat.messages.slice(-12);

            window
                .askAderaAI({
                    messages: history,
                    topic: chat.topic,
                    subject: chat.subject
                })
                .then(finish)
                .catch((err) => showError(err && err.message, cooldownFor(err)));
        } else {
            showError(
                "The AI tutor is not configured yet. Add your Supabase keys in js/config.js.",
                0
            );
        }
    }

    if (chats.length === 0) {
        createChat();
    } else if (!chats.some(chat => chat.id === activeId)) {
        activeId = chats[0].id;
    }

    saveChats();

    chatForm.addEventListener("submit", (event) => {
        event.preventDefault();

        if (sending) {
            return;
        }

        const text = questionInput.value.trim();

        if (text === "") {
            return;
        }

        questionInput.value = "";
        sendMessage(text);
    });

    if (newChatBtn) {
        newChatBtn.addEventListener("click", () => {
            createChat();
            saveChats();
            renderAll();
            questionInput.focus();
        });
    }

    if (clearChatBtn) {
        clearChatBtn.addEventListener("click", () => {
            const chat = getActive();

            if (!chat) {
                return;
            }

            if (!window.confirm("Clear all messages in this conversation?")) {
                return;
            }

            chat.messages = [{ role: "ai", text: greetingText(chat.topic) }];
            chat.title = DEFAULT_TITLE;
            chat.updatedAt = Date.now();
            saveChats();
            renderAll();
        });
    }

    conversationList.addEventListener("click", (event) => {
        const deleteId = event.target && event.target.dataset
            ? event.target.dataset.delete
            : null;

        if (deleteId) {
            event.stopPropagation();

            if (!window.confirm("Delete this conversation?")) {
                return;
            }

            chats = chats.filter(chat => chat.id !== deleteId);

            if (activeId === deleteId) {
                if (chats.length === 0) {
                    createChat();
                } else {
                    activeId = chats[0].id;
                }
            }

            saveChats();
            renderAll();
            return;
        }

        const item = event.target.closest(".conversation-item");

        if (item && item.dataset.id && item.dataset.id !== activeId) {
            activeId = item.dataset.id;
            saveChats();
            renderAll();
        }
    });

    if (suggested) {
        suggested.addEventListener("click", (event) => {
            const button = event.target.closest("button");

            if (!button) {
                return;
            }

            sendMessage(button.textContent.trim());
        });
    }

    renderAll();
    questionInput.focus();
});
