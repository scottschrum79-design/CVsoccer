const creatorConfig = window.TEAMSIGNUPS_CONFIG || {};
const sessionKey = "teamsignupsSupabaseSession";
const assetVersion = window.TEAMSIGNUPS_ASSET_VERSION || Date.now().toString();

function loadScript(src) {
    const script = document.createElement("script");
    script.src = `${src}?v=${encodeURIComponent(assetVersion)}`;
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
    document.getElementById("creator-login").hidden = true;
    document.getElementById("creator-content").hidden = false;
    document.getElementById("creator-signout").hidden = false;
    loadCreatorApp();
}

function setAuthMessage(message, type = "error") {
    const status = document.getElementById("creator-auth-status");
    status.hidden = !message;
    status.textContent = message;
    status.dataset.type = type;
}

function storedSession() {
    try {
        const session = JSON.parse(sessionStorage.getItem(sessionKey) || "null");
        return session?.access_token && Date.now() < Number(session.expires_at) * 1000 ? session : null;
    } catch {
        return null;
    }
}

async function signIn(email, password) {
    const response = await fetch(`${creatorConfig.supabaseUrl}/auth/v1/token?grant_type=password`, {
        method: "POST",
        headers: { apikey: creatorConfig.supabaseAnonKey, "Content-Type": "application/json" },
        body: JSON.stringify({ email, password })
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error_description || result.msg || "Unable to sign in");
    sessionStorage.setItem(sessionKey, JSON.stringify({
        access_token: result.access_token,
        refresh_token: result.refresh_token,
        expires_at: result.expires_at
    }));
}

const form = document.getElementById("creator-auth-form");
const emailInput = document.getElementById("creator-email");
const passwordInput = document.getElementById("creator-password");
const signoutButton = document.getElementById("creator-signout");
emailInput.value = creatorConfig.creatorEmail || "";

signoutButton.addEventListener("click", () => {
    sessionStorage.removeItem(sessionKey);
    window.location.reload();
});

if (storedSession()) {
    showCreatorContent();
} else {
    form.addEventListener("submit", async (event) => {
        event.preventDefault();
        setAuthMessage("Signing in…", "info");
        try {
            await signIn(emailInput.value.trim().toLowerCase(), passwordInput.value);
            passwordInput.value = "";
            setAuthMessage("");
            showCreatorContent();
        } catch (error) {
            passwordInput.value = "";
            passwordInput.focus();
            setAuthMessage(error.message || "Unable to sign in");
        }
    });
    passwordInput.focus();
}
