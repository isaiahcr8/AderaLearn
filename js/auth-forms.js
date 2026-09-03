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

    if (!sb) {
        setNotice(
            "Sign-in is not configured yet. Add your Supabase keys in js/config.js (see README).",
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

    sb.auth.getSession().then(function (res) {
        if (res && res.data && res.data.session) {
            window.location.replace(nextTarget());
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
                    options: { data: { full_name: name } }
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
