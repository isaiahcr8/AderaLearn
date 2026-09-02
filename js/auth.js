/*
 * Shared auth behaviour for the signed-in pages.
 *
 * - Pages with  <body data-auth-required>  redirect to login.html when there is
 *   no active session.
 * - Fills the header profile (name / email / avatar initial) from the user.
 * - Turns every "Log Out" link into a real sign-out.
 *
 * If Supabase is not configured (js/config.js is blank) this does nothing and
 * the site keeps working in demo mode.
 */
(function () {
    "use strict";

    var sb = window.sb;
    var needsAuth =
        document.body && document.body.hasAttribute("data-auth-required");

    // Hide protected content until the session check finishes (no flash).
    if (sb && needsAuth) {
        document.documentElement.style.visibility = "hidden";
    }

    function reveal() {
        document.documentElement.style.visibility = "";
    }

    var auth = {
        get ready() {
            return Boolean(sb);
        },

        getUser: function () {
            if (!sb) return Promise.resolve(null);
            return sb.auth.getUser().then(function (res) {
                return res && res.data ? res.data.user : null;
            });
        },

        getSession: function () {
            if (!sb) return Promise.resolve(null);
            return sb.auth.getSession().then(function (res) {
                return res && res.data ? res.data.session : null;
            });
        },

        signOut: function () {
            var done = function () {
                window.location.href = "index.html";
            };
            if (!sb) return done();
            sb.auth.signOut().then(done, done);
        },

        hydrateHeader: function (user) {
            if (!user) return;

            var profile = document.querySelector(".user-profile");
            if (!profile) return;

            var meta = user.user_metadata || {};
            var name =
                meta.full_name ||
                meta.name ||
                (user.email ? user.email.split("@")[0] : "Student");

            var strong = profile.querySelector("strong");
            var small = profile.querySelector("small");
            var avatar = profile.querySelector(".avatar");

            if (strong) strong.textContent = name;
            if (small && user.email) small.textContent = user.email;
            if (avatar) avatar.textContent = (name.charAt(0) || "S").toUpperCase();
        },

        wireLogout: function () {
            var anchors = document.querySelectorAll("a");
            anchors.forEach(function (a) {
                var label = a.textContent.replace(/\s+/g, " ").trim().toLowerCase();
                if (label.indexOf("log out") !== -1 || label.indexOf("logout") !== -1) {
                    a.addEventListener("click", function (e) {
                        e.preventDefault();
                        auth.signOut();
                    });
                }
            });
        }
    };

    window.aderaAuth = auth;

    document.addEventListener("DOMContentLoaded", function () {
        auth.wireLogout();

        if (!sb) {
            reveal();
            return;
        }

        auth.getSession().then(function (session) {
            if (needsAuth && !session) {
                var here = window.location.pathname.split("/").pop() || "";
                var next = here ? "?next=" + encodeURIComponent(here) : "";
                window.location.replace("login.html" + next);
                return;
            }

            if (session) {
                auth.hydrateHeader(session.user);
            }

            reveal();

            sb.auth.onAuthStateChange(function (event, newSession) {
                if (needsAuth && !newSession) {
                    window.location.replace("login.html");
                } else if (newSession) {
                    auth.hydrateHeader(newSession.user);
                }
            });
        }, function () {
            // If the session check fails, don't leave the page blank.
            reveal();
        });
    });
})();
