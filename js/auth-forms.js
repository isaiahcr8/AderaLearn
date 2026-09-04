document.addEventListener("DOMContentLoaded", function () {
    "use strict";

    var sb = window.sb;
    var signupForm = document.getElementById("signupForm");
    var loginForm = document.getElementById("loginForm");
    var notice = document.getElementById("authNotice");

    function setNotice(message, type) {
        if (!notice) return;
        notice.textContent = message || "";
        notice.className = "auth-notice" + (type ? " " + type : "");
        notice.hidden = !message;
    }

    function nextTarget() {
        var params = new URLSearchParams(window.location.search);
        var next = params.get("next") || "dashboard.html";
        if (/^https?:|^\/\//i.test(next)) {
            return "dashboard.html";
        }
        return next;
    }

    // Supabase sends the student back to this page after they click the
    // confirmation link in their email. On success it either lands a session
    // token in the URL hash (#access_token=...&type=signup) or, on newer
    // projects, a `?code=` query param to exchange; on failure — an expired or
    // already-used link — it attaches #error / #error_description instead.
    // Without reading these, a finished confirmation looks like a blank page
    // and a failed one looks like nothing happened at all.
    function readConfirmationOutcome() {
        var hash = new URLSearchParams(window.location.hash.replace(/^#/, ""));
        var query = new URLSearchParams(window.location.search);

        return {
            error: hash.get("error") || query.get("error"),
            errorDescription:
                hash.get("error_description") || query.get("error_description"),
            code: query.get("code"),
            confirmed: query.get("confirmed") === "1" || hash.get("type") === "signup"
        };
    }

    if (!sb) {
        setNotice(
            "Sign-in is not configured yet. Add your Supabase keys in js/config.js.",
            "error"
        );
        var form = signupForm || loginForm;
        if (form) {
            form.querySelectorAll("input, button").forEach(function (el) {
                el.disabled = true;
            });
        }
        return;
    }

    var outcome = readConfirmationOutcome();

    if (outcome.error) {
        var friendly = (outcome.errorDescription || "").replace(/\+/g, " ") ||
            "That confirmation link is no longer valid.";
        setNotice(
            friendly + " Request a new one by signing up again, or sign in below " +
                "if you already confirmed your email.",
            "error"
        );
    }

    // On newer Supabase projects the confirmation link comes back as
    // `?code=...` instead of a token in the hash — exchange it first so the
    // getSession() call below sees the resulting session either way.
    var exchange =
        outcome.code && !outcome.error && typeof sb.auth.exchangeCodeForSession === "function"
            ? sb.auth.exchangeCodeForSession(window.location.href).catch(function () {
                  /* ignore — getSession() below still covers the hash-based flow */
              })
            : Promise.resolve();

    exchange
        .then(function () {
            return sb.auth.getSession();
        })
        .then(function (res) {
            if (res && res.data && res.data.session) {
                window.location.replace(nextTarget());
                return;
            }

            if (outcome.confirmed && !outcome.error) {
                setNotice("Your email is confirmed. Sign in below to continue.", "success");
            }
        });

    if (signupForm) {
        signupForm.addEventListener("submit", function (e) {
            e.preventDefault();
            setNotice("");

            var name = document.getElementById("name").value.trim();
            var email = document.getElementById("email").value.trim();
            var password = document.getElementById("password").value;

            if (name === "" || email === "" || password.length < 6) {
                setNotice(
                    "Enter your name, a valid email, and a password of at least 6 characters.",
                    "error"
                );
                return;
            }

            var btn = signupForm.querySelector("button[type=submit]");
            btn.disabled = true;
            btn.textContent = "Creating account...";

            sb.auth
                .signUp({
                    email: email,
                    password: password,
                    options: {
                        data: { full_name: name },
                        // Send the student back to THIS deployment, not whatever
                        // "Site URL" happens to be set in the Supabase dashboard.
                        // That URL must also be added to Authentication -> URL
                        // Configuration -> Redirect URLs, or Supabase will refuse
                        // to redirect to it.
                        emailRedirectTo:
                            window.location.origin + "/login.html?confirmed=1"
                    }
                })
                .then(function (res) {
                    btn.disabled = false;
                    btn.textContent = "Create account";

                    if (res.error) {
                        setNotice(res.error.message, "error");
                        return;
                    }

                    if (res.data.session) {
                        window.location.replace("dashboard.html");
                    } else {
                        setNotice(
                            "Account created. Check your email to confirm, then sign in.",
                            "success"
                        );
                        signupForm.reset();
                    }
                });
        });
    }

    if (loginForm) {
        loginForm.addEventListener("submit", function (e) {
            e.preventDefault();
            setNotice("");

            var email = document.getElementById("email").value.trim();
            var password = document.getElementById("password").value;

            if (email === "" || password === "") {
                setNotice("Enter your email and password.", "error");
                return;
            }

            var btn = loginForm.querySelector("button[type=submit]");
            btn.disabled = true;
            btn.textContent = "Signing in...";

            sb.auth
                .signInWithPassword({ email: email, password: password })
                .then(function (res) {
                    btn.disabled = false;
                    btn.textContent = "Sign in";

                    if (res.error) {
                        setNotice(res.error.message, "error");
                        return;
                    }

                    window.location.replace(nextTarget());
                });
        });
    }
});
