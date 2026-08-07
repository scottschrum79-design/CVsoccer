const creatorConfig = window.TEAMSIGNUPS_CONFIG || {};
const creatorPassword = typeof creatorConfig.creatorPassword === "string" ? creatorConfig.creatorPassword : "";
const sessionKey = "teamsignupsCreatorUnlocked";
const assetVersion = window.TEAMSIGNUPS_ASSET_VERSION || Date.now().toString();

function loadScript(src) {
    const script = document.createElement("script");
    const separator = src.includes("?") ? "&" : "?";
    script.src = `${src}${separator}v=${encodeURIComponent(assetVersion)}`;
    document.body.appendChild(script);
    return script;
}

function loadCreatorApp() {
    const appScript = loadScript("app.js");
    appScript.addEventListener("load", () => {
        loadScript("report.js");
        loadScript("volunteer-editor.js");
    });
}

function showCreatorContent() {
    const login = document.getElementById("creator-login");
    const content = document.getElementById("creator-content");
    if (login) login.hidden = true;
    if (content) content.hidden = false;
    loadCreatorApp();
}

function setAuthMessage(message, type = "error") {
    const status = document.getElementById("creator-auth-status");
    if (!status) return;
    status.hidden = !message;
    status.textContent = message;
    status.dataset.type = type;
}

function initCreatorAuth() {
    const form = document.getElementById("creator-auth-form");
    const passwordInput = document.getElementById("creator-password");
    if (!form || !passwordInput) { loadCreatorApp(); return; }
    if (!creatorPassword) { setAuthMessage("Creator password is not set in config.js."); return; }
    if (sessionStorage.getItem(sessionKey) === "true") { showCreatorContent(); return; }
    form.addEventListener("submit", (event) => {
        event.preventDefault();
        if (passwordInput.value === creatorPassword) {
            sessionStorage.setItem(sessionKey, "true"); passwordInput.value = ""; setAuthMessage(""); showCreatorContent(); return;
        }
        passwordInput.value = ""; passwordInput.focus(); setAuthMessage("Incorrect password. Please try again.");
    });
    passwordInput.focus();
}

initCreatorAuth();
