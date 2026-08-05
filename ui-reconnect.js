(() => {
    const RECHECK_DELAY = 5000;
    let reconnectTimer = null;
    let reconnecting = false;

    async function refreshCurrentPage() {
        if (document.body.dataset.page === "create") {
            await renderAdminPage();
        } else {
            await renderPublicSignupPage();
        }
    }

    async function tryReconnect() {
        try {
            await loadEvents();
            isApiOnline = true;
            setSyncStatus(`Shared storage connected (${storageLabel}).`, "ok");
            reconnecting = false;
            reconnectTimer = null;
            await refreshCurrentPage();
        } catch (error) {
            console.warn("Shared storage reconnect failed:", error);
            setSyncStatus(`Reconnecting to ${storageLabel}…`, "info");
            reconnectTimer = window.setTimeout(tryReconnect, RECHECK_DELAY);
        }
    }

    function startReconnect() {
        if (reconnecting || isApiOnline) return;
        reconnecting = true;
        setSyncStatus(`Reconnecting to ${storageLabel}…`, "info");
        reconnectTimer = window.setTimeout(tryReconnect, RECHECK_DELAY);
    }

    // app.js performs the first connection attempt. Check after it has had time
    // to finish. If that first request failed, keep trying and refresh the UI
    // as soon as Google Sheets responds again.
    window.setTimeout(startReconnect, 4000);

    window.addEventListener("online", () => {
        if (reconnectTimer) window.clearTimeout(reconnectTimer);
        reconnectTimer = null;
        reconnecting = false;
        startReconnect();
    });
})();
