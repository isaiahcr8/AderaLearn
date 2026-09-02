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
            /* storage unavailable — keep working in memory only */
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

    function buildReply(question, chat) {
        const q = question.toLowerCase();
        const topic = chat.topic;
        const subject = chat.subject ? " in " + chat.subject : "";

        if (q.indexOf("example") !== -1) {
            return "Here's how I'd set up an example for " + topic + subject + ". " +
                "Once the live AI is connected you'll get a worked example with every step explained.";
        }

        if (q.indexOf("quiz") !== -1 || q.indexOf("test") !== -1) {
            return "Practising is the best way to lock in " + topic + ". " +
                "Head to the Quiz page to test yourself, or ask me to explain any part first.";
        }

        if (q.indexOf("simpl") !== -1 || q.indexOf("explain") !== -1) {
            return topic + " is easiest to understand when you break it into small parts and " +
                "connect each one to something familiar. Ask me about any part that is still unclear.";
        }

        return "That's a good question about " + topic + subject + ". " +
            "For now this is a sample response — once the AI is connected, AderaLearn will give you a full explanation.";
    }

    function sendMessage(text) {
        const chat = getActive();

        if (!chat) {
            return;
        }

        chat.messages.push({ role: "user", text: text });

        if (chat.title === DEFAULT_TITLE) {
            chat.title = text.length > 40 ? text.slice(0, 40) + "…" : text;
        }

        chat.updatedAt = Date.now();
        saveChats();
        renderAll();

        const pending = makeBubble("ai", "Thinking…");
        chatMessages.appendChild(pending);
        chatMessages.scrollTop = chatMessages.scrollHeight;

        const finish = (replyText) => {
            const current = getActive();

            if (!current || current.id !== chat.id) {
                return;
            }

            current.messages.push({ role: "ai", text: replyText });
            current.updatedAt = Date.now();
            saveChats();
            renderAll();
        };

        if (typeof window.askAderaAI === "function" && window.ADERA_AI_READY) {
            const history = chat.messages.slice(-12);

            window.askAderaAI({
                messages: history,
                topic: chat.topic,
                subject: chat.subject
            })
                .then(finish)
                .catch(() => finish(buildReply(text, chat)));
        } else {
            window.setTimeout(() => finish(buildReply(text, chat)), 700);
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
