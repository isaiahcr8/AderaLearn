(function () {
    "use strict";

    var KEY = "aderaTheme";
    var root = document.documentElement;

    function readStored() {
        try {
            return window.localStorage.getItem(KEY);
        } catch (e) {
            return null;
        }
    }

    function prefersLight() {
        return (
            typeof window.matchMedia === "function" &&
            window.matchMedia("(prefers-color-scheme: light)").matches
        );
    }

    function resolve() {
        var saved = readStored();
        if (saved === "light" || saved === "dark") {
            return saved;
        }
        return prefersLight() ? "light" : "dark";
    }

    function apply(mode) {
        root.setAttribute("data-theme", mode === "light" ? "light" : "dark");
    }

    // Runs immediately (this script is in <head>) so there is no flash of the
    // wrong theme before the stylesheet's default (dark) would otherwise show.
    apply(resolve());

    function iconFor(mode) {
        return mode === "light" ? "🌙" : "☀️"; // moon / sun
    }

    document.addEventListener("DOMContentLoaded", function () {
        var current =
            root.getAttribute("data-theme") === "light" ? "light" : "dark";

        var btn = document.createElement("button");
        btn.type = "button";
        btn.className = "theme-toggle";
        btn.setAttribute("aria-label", "Switch between light and dark mode");
        btn.setAttribute("title", "Toggle theme");
        btn.textContent = iconFor(current);

        btn.addEventListener("click", function () {
            current = current === "light" ? "dark" : "light";
            apply(current);
            btn.textContent = iconFor(current);
            try {
                window.localStorage.setItem(KEY, current);
            } catch (e) {
                /* storage unavailable — theme still applies for this page */
            }
        });

        var sidebarBottom = document.querySelector(".sidebar-bottom");
        var navActions = document.querySelector(".nav-actions");

        if (sidebarBottom) {
            sidebarBottom.insertBefore(btn, sidebarBottom.firstChild);
        } else if (navActions) {
            navActions.insertBefore(btn, navActions.firstChild);
        } else {
            btn.classList.add("theme-toggle-floating");
            document.body.appendChild(btn);
        }
    });
})();
