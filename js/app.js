document.addEventListener("DOMContentLoaded", () => {

    console.log("AderaLearn loaded successfully.");

    document.querySelectorAll('a[href^="#"]').forEach(link => {

        link.addEventListener("click", function (event) {

            const href = this.getAttribute("href");

            if (!href || href === "#" || href.length < 2) {
                return;
            }

            const target = document.querySelector(href);

            if (target) {
                event.preventDefault();

                target.scrollIntoView({
                    behavior: "smooth"
                });
            }

        });

    });

    function isTopicValidForSubject(subject, topic) {

        const topicText = topic.toLowerCase();

        const subjectKeywords = {

            Mathematics: [
                "algebra",
                "quadratic",
                "equation",
                "geometry",
                "trigonometry",
                "logarithm",
                "statistics",
                "probability",
                "coordinate",
                "mensuration",
                "calculus",
                "number",
                "fraction",
                "ratio",
                "percentage",
                "matrix",
                "sequence",
                "variation"
            ],

            Biology: [
                "photosynthesis",
                "cell",
                "respiration",
                "genetics",
                "ecology",
                "reproduction",
                "digestion",
                "circulation",
                "plant",
                "animal",
                "organism",
                "enzyme",
                "dna",
                "nutrition",
                "tissue",
                "blood",
                "heart"
            ],

            Chemistry: [
                "atom",
                "element",
                "compound",
                "reaction",
                "acid",
                "base",
                "salt",
                "mole",
                "periodic",
                "bond",
                "gas",
                "solution",
                "electrolysis",
                "mixture",
                "chemical",
                "oxidation",
                "reduction"
            ],

            Physics: [
                "motion",
                "force",
                "energy",
                "work",
                "power",
                "electricity",
                "current",
                "voltage",
                "resistance",
                "wave",
                "light",
                "sound",
                "gravity",
                "momentum",
                "pressure",
                "velocity",
                "acceleration",
                "speed",
                "density"
            ],

            English: [
                "grammar",
                "noun",
                "verb",
                "adjective",
                "adverb",
                "essay",
                "comprehension",
                "literature",
                "poetry",
                "sentence",
                "tense",
                "speech",
                "vocabulary",
                "pronoun",
                "conjunction",
                "preposition",
                "writing"
            ]

        };

        const keywords = subjectKeywords[subject];

        if (!keywords) {
            return true;
        }

        return keywords.some(keyword =>
            topicText.includes(keyword)
        );
    }

    const subjectCards =
        document.querySelectorAll(".subject-card");

    let selectedSubject =
        localStorage.getItem("learningSubject") || null;

    subjectCards.forEach(card => {

        if (card.dataset.subject === selectedSubject) {
            card.classList.add("selected");
        }

        card.addEventListener("click", () => {

            subjectCards.forEach(item => {
                item.classList.remove("selected");
            });

            card.classList.add("selected");

            selectedSubject =
                card.dataset.subject;

            console.log(
                "Selected subject:",
                selectedSubject
            );

        });

    });

    const learnButton =
        document.getElementById("learnButton");

    const topicInput =
        document.getElementById("topicInput");

    if (learnButton && topicInput) {

        learnButton.addEventListener("click", () => {

            const topic =
                topicInput.value.trim();

            if (!selectedSubject) {

                alert(
                    "Please choose a subject first."
                );

                return;
            }

            if (topic === "") {

                alert(
                    "Please enter a topic you want to learn."
                );

                return;
            }

            if (
                !isTopicValidForSubject(
                    selectedSubject,
                    topic
                )
            ) {

                alert(
                    `"${topic}" does not seem to belong to ${selectedSubject}. Please choose the correct subject or enter another topic.`
                );

                return;
            }

            localStorage.setItem(
                "learningSubject",
                selectedSubject
            );

            localStorage.setItem(
                "learningTopic",
                topic
            );

            window.location.href =
                "lesson.html";

        });

    }

    const lessonTitle =
        document.getElementById("lessonTitle");

    if (lessonTitle) {

        const savedTopic =
            localStorage.getItem("learningTopic");

        if (savedTopic) {

            lessonTitle.textContent =
                savedTopic;

        }

    }

    const lessonSubject =
        document.getElementById("lessonSubject");

    if (lessonSubject) {

        const savedSubject =
            localStorage.getItem("learningSubject");

        if (savedSubject) {

            lessonSubject.textContent =
                savedSubject;

        }

    }

    const lessonContent =
        document.getElementById("lessonContent");

    if (lessonContent) {

        const savedTopic =
            localStorage.getItem("learningTopic");

        const savedSubject =
            localStorage.getItem("learningSubject");

        if (savedTopic) {

            setTimeout(() => {

                lessonContent.innerHTML = `

                    <h2>
                        Introduction to ${savedTopic}
                    </h2>

                    <p>
                        Welcome to your AderaLearn lesson on
                        <strong>${savedTopic}</strong>.
                    </p>

                    ${
                        savedSubject
                            ? `
                                <p>
                                    Subject:
                                    <strong>${savedSubject}</strong>
                                </p>
                              `
                            : ""
                    }

                    <p>
                        This lesson will help you understand
                        the main ideas, important concepts,
                        and examples related to this topic.
                    </p>

                    <div class="info-box">

                        <strong>
                            💡 Key Idea
                        </strong>

                        <p>
                            Understanding ${savedTopic}
                            becomes easier when we break it
                            into smaller concepts.
                        </p>

                    </div>

                    <h2>
                        Understanding ${savedTopic}
                    </h2>

                    <p>
                        AderaLearn will eventually use AI here
                        to create a personalized explanation
                        based on the topic you chose.
                    </p>

                    <h2>
                        Example
                    </h2>

                    <p>
                        A relevant example for ${savedTopic}
                        will appear here when the AI lesson
                        generator is connected.
                    </p>

                    <div class="key-points">

                        <h3>
                            Key points
                        </h3>

                        <ul>

                            <li>
                                Understand the basic meaning
                                of ${savedTopic}.
                            </li>

                            <li>
                                Identify the important concepts.
                            </li>

                            <li>
                                Study real examples.
                            </li>

                            <li>
                                Ask AderaLearn AI when something
                                is unclear.
                            </li>

                            <li>
                                Take a quiz after completing
                                the lesson.
                            </li>

                        </ul>

                    </div>
                `;

            }, 1200);

        }

    }

    const chatForm =
        document.getElementById("chatForm");

    const questionInput =
        document.getElementById("questionInput");

    const chatMessages =
        document.getElementById("chatMessages");

    if (
        chatForm &&
        questionInput &&
        chatMessages
    ) {

        chatForm.addEventListener(
            "submit",
            (event) => {

                event.preventDefault();

                const question =
                    questionInput.value.trim();

                if (question === "") {
                    return;
                }

                const studentMessage =
                    document.createElement("div");

                studentMessage.classList.add(
                    "student-message"
                );

                studentMessage.textContent =
                    question;

                chatMessages.appendChild(
                    studentMessage
                );

                questionInput.value = "";

                const aiMessage =
                    document.createElement("div");

                aiMessage.classList.add(
                    "ai-message"
                );

                aiMessage.textContent =
                    "Thinking...";

                chatMessages.appendChild(
                    aiMessage
                );

                chatMessages.scrollTop =
                    chatMessages.scrollHeight;

                const topic =
                    localStorage.getItem("learningTopic") || "this topic";

                const subject =
                    localStorage.getItem("learningSubject") || "";

                const fallbackReply =
                    `That's a good question about ${topic}. ` +
                    `For now, this is a temporary response. ` +
                    `When the real AI is connected, AderaLearn will explain your question properly.`;

                const settle = (reply) => {
                    aiMessage.textContent = reply;
                    chatMessages.scrollTop =
                        chatMessages.scrollHeight;
                };

                if (
                    typeof window.askAderaAI === "function" &&
                    window.ADERA_AI_READY
                ) {

                    window.askAderaAI({
                        messages: [
                            { role: "user", text: question }
                        ],
                        topic: topic,
                        subject: subject
                    })
                        .then(settle)
                        .catch(() => settle(fallbackReply));

                } else {

                    setTimeout(() => settle(fallbackReply), 900);

                }

            }
        );

    }

    const quizTopic =
        document.getElementById("quizTopic");

    const questionText =
        document.getElementById("questionText");

    const questionNumber =
        document.getElementById("questionNumber");

    const quizScore =
        document.getElementById("quizScore");

    const quizProgress =
        document.getElementById("quizProgress");

    const answerButtons =
        document.querySelectorAll(".answer-option");

    const nextQuestion =
        document.getElementById("nextQuestion");

    const previousQuestion =
        document.getElementById("previousQuestion");

    const questionLabel =
        document.querySelector(".question-label");

    if (
        quizTopic &&
        questionText &&
        questionNumber &&
        quizScore &&
        quizProgress &&
        answerButtons.length > 0 &&
        nextQuestion &&
        previousQuestion
    ) {

        const savedTopic =
            localStorage.getItem(
                "learningTopic"
            ) || "Your Topic";

        quizTopic.textContent =
            savedTopic;

        const questions = [

            {
                question:
                    `What is one important thing to understand about ${savedTopic}?`,

                answers: [
                    "Its basic meaning",
                    "Only its spelling",
                    "Nothing about it",
                    "Only its name"
                ],

                correct: 0
            },

            {
                question:
                    `What is a good way to learn ${savedTopic}?`,

                answers: [
                    "Ignore examples",
                    "Study explanations and examples",
                    "Avoid asking questions",
                    "Skip the lesson"
                ],

                correct: 1
            },

            {
                question:
                    `What should you do if part of ${savedTopic} is unclear?`,

                answers: [
                    "Give up",
                    "Ignore it",
                    "Ask questions",
                    "Close the lesson"
                ],

                correct: 2
            },

            {
                question:
                    `Why are examples useful when learning ${savedTopic}?`,

                answers: [
                    "They make the topic harder",
                    "They help connect ideas to real situations",
                    "They replace learning completely",
                    "They are unnecessary"
                ],

                correct: 1
            },

            {
                question:
                    `What should you do after studying ${savedTopic}?`,

                answers: [
                    "Test your understanding",
                    "Forget everything",
                    "Avoid practice",
                    "Never review it"
                ],

                correct: 0
            }

        ];

        let currentQuestion = 0;
        let score = 0;
        let selectedAnswer = null;

        function showQuestion() {

            const current =
                questions[currentQuestion];

            questionText.textContent =
                current.question;

            questionNumber.textContent =
                `Question ${currentQuestion + 1} of ${questions.length}`;

            if (questionLabel) {

                questionLabel.textContent =
                    `QUESTION ${currentQuestion + 1}`;

            }

            answerButtons.forEach(
                (button, index) => {

                    const letter =
                        String.fromCharCode(
                            65 + index
                        );

                    button.innerHTML = `
                        <span>${letter}</span>
                        ${current.answers[index]}
                    `;

                    button.classList.remove(
                        "selected"
                    );

                }
            );

            quizProgress.style.width =
                `${((currentQuestion + 1) / questions.length) * 100}%`;

            selectedAnswer = null;

            previousQuestion.disabled =
                currentQuestion === 0;

        }

        answerButtons.forEach(
            (button, index) => {

                button.addEventListener(
                    "click",
                    () => {

                        answerButtons.forEach(
                            btn => {

                                btn.classList.remove(
                                    "selected"
                                );

                            }
                        );

                        button.classList.add(
                            "selected"
                        );

                        selectedAnswer =
                            index;

                    }
                );

            }
        );

        nextQuestion.addEventListener(
            "click",
            () => {

                if (
                    selectedAnswer === null
                ) {

                    alert(
                        "Please choose an answer first."
                    );

                    return;

                }

                if (
                    selectedAnswer ===
                    questions[currentQuestion].correct
                ) {

                    score++;

                }

                quizScore.textContent =
                    `Score: ${score}`;

                if (
                    currentQuestion <
                    questions.length - 1
                ) {

                    currentQuestion++;

                    showQuestion();

                } else {

                    localStorage.setItem(
                        "quizScore",
                        score
                    );

                    localStorage.setItem(
                        "quizTotal",
                        questions.length
                    );

                    window.location.href =
                        "result.html";

                }

            }
        );

        previousQuestion.addEventListener(
            "click",
            () => {

                if (
                    currentQuestion > 0
                ) {

                    currentQuestion--;

                    showQuestion();

                }

            }
        );

        showQuestion();

    }

    const resultScore =
        document.getElementById(
            "resultScore"
        );

    const resultPercentage =
        document.getElementById(
            "resultPercentage"
        );

    const resultMessage =
        document.getElementById(
            "resultMessage"
        );

    const resultFeedback =
        document.getElementById(
            "resultFeedback"
        );

    const resultTopic =
        document.getElementById(
            "resultTopic"
        );

    if (
        resultScore &&
        resultPercentage &&
        resultMessage &&
        resultFeedback &&
        resultTopic
    ) {

        const score =
            Number(
                localStorage.getItem(
                    "quizScore"
                )
            ) || 0;

        const total =
            Number(
                localStorage.getItem(
                    "quizTotal"
                )
            ) || 5;

        const topic =
            localStorage.getItem(
                "learningTopic"
            ) || "your topic";

        const subject =
            localStorage.getItem(
                "learningSubject"
            ) || "your subject";

        const percentage =
            Math.round(
                (score / total) * 100
            );

        resultScore.textContent =
            `${score} / ${total}`;

        resultPercentage.textContent =
            `${percentage}%`;

        resultTopic.textContent =
            `You completed the ${topic} quiz in ${subject}.`;

        if (percentage >= 80) {

            resultMessage.textContent =
                "Excellent work! 🎉";

            resultFeedback.textContent =
                "You understood this lesson really well. Keep it up!";

        } else if (percentage >= 60) {

            resultMessage.textContent =
                "Good job! 🔥";

            resultFeedback.textContent =
                "You have a good understanding of the topic. A little review will make you even stronger.";

        } else {

            resultMessage.textContent =
                "Keep going! 💪";

            resultFeedback.textContent =
                "Review the lesson again and try the quiz one more time.";

        }

    }

});