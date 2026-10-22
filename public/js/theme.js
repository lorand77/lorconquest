// The colour scheme, dark (the default) or light: the one setting the site keeps in the browser, in its local storage under
// "lorconquest.scheme" (privacy.html says so). game.css keys the light colours off <html data-scheme="light">. Every page
// loads this in its <head>, before anything is drawn, so it paints in the chosen colours at once — which is why it is a
// plain script and not a module (a module would run after the page had shown itself dark). Any button with
// data-scheme-toggle switches the scheme and is labelled with the one it switches to; another tab of the site follows.
(function () {
    const KEY = "lorconquest.scheme";
    let scheme = "dark";
    try { if (localStorage.getItem(KEY) === "light") scheme = "light"; } catch (e) { /* storage blocked: dark */ }

    function apply() {
        if (scheme === "light") document.documentElement.dataset.scheme = "light";
        else delete document.documentElement.dataset.scheme;
        for (const b of document.querySelectorAll("[data-scheme-toggle]")) {
            b.textContent = scheme === "light" ? "🌙 Dark" : "☀ Light";
            b.title = scheme === "light" ? "Switch to the dark colours" : "Switch to the light colours";
        }
    }

    apply();
    document.addEventListener("DOMContentLoaded", () => {
        apply();
        for (const b of document.querySelectorAll("[data-scheme-toggle]")) {
            b.addEventListener("click", () => {
                scheme = scheme === "light" ? "dark" : "light";
                try { localStorage.setItem(KEY, scheme); } catch (e) { /* storage blocked: this page only */ }
                apply();
            });
        }
    });
    window.addEventListener("storage", (e) => {
        if (e.key !== KEY) return;
        scheme = e.newValue === "light" ? "light" : "dark";
        apply();
    });
})();
