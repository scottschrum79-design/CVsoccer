(() => {
    const CACHE_KEY = "cvsoccer:last-successful-events";
    const MAX_ATTEMPTS = 3;
    const RETRY_DELAYS = [750, 1500];
    const RECONNECT_INTERVAL = 5000;
    const MAX_RECONNECT_ATTEMPTS = 6;

    let sharedStorageOnline = false;
    let reconnectTimer = null;
    let reconnectAttempts = 0;
    let reconnecting = false;

    const sleep = (milliseconds) =>
        new Promise((resolve) => window.setTimeout(resolve, milliseconds));

    function cacheEvents(events) {
        try {
            localStorage.setItem(CACHE_KEY, JSON.stringify(events));
        } catch (error) {
            console.warn("Unable to cache events:", error);
        }
    }

    function readCachedEvents() {
        try {
            const raw = localStorage.getItem(CACHE_KEY);
            if (!raw) return null;
            const events = JSON.parse(raw);
            return Array.isArray(events) ? events : null;
        } catch (error) {
            console.warn("Unable to read cached events:", error);
            return null;
        }
    }

    async function fetchEventsOnce() {
        const response = await fetch(buildEventsEndpoint(), {
            cache: "no-store",
            method: "GET"
        });

        if (!response.ok) {
            throw new Error(`Unable to load events (${response.status})`);
        }

        const text = await response.text();
        const payload = JSON.parse(text);
        return Array.isArray(payload.events) ? payload.events : [];
    }

    async function fetchEventsWithRetry() {
        let lastError;

        for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt += 1) {
            try {
                return await fetchEventsOnce();
            } catch (error) {
                lastError = error;
                if (attempt < RETRY_DELAYS.length) {
                    await sleep(RETRY_DELAYS[attempt]);
                }
            }
        }

        throw lastError || new Error("Unable to connect to shared storage");
    }

    async function refreshCurrentPage() {
        try {
            if (document.body.dataset.page === "create") {
                await renderAdminPage();
            } else {
                await renderPublicSignupPage();
            }
        } catch (error) {
            console.warn("Page refresh after reconnect failed:", error);
        }
    }

    function stopReconnectLoop() {
        if (reconnectTimer) {
            window.clearTimeout(reconnectTimer);
            reconnectTimer = null;
        }
        reconnecting = false;
        reconnectAttempts = 0;
    }

    function scheduleReconnect() {
        if (reconnecting) return;

        reconnecting = true;
        reconnectAttempts = 0;

        const tryReconnect = async () => {
            reconnectAttempts += 1;

            try {
                const events = await fetchEventsWithRetry();
                cacheEvents(events);
                sharedStorageOnline = true;
                isApiOnline = true;
                stopReconnectLoop();
                setSyncStatus(`Shared storage connected (${storageLabel}).`, "ok");
                await refreshCurrentPage();
                return;
            } catch (error) {
                console.warn(`Reconnect attempt ${reconnectAttempts} failed:`, error);
            }

            if (reconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
                reconnectTimer = window.setTimeout(tryReconnect, RECONNECT_INTERVAL);
            } else {
                reconnecting = false;
                reconnectTimer = null;
                setSyncStatus(
                    "Shared storage is temporarily unavailable. Showing the last saved event list; new signups cannot be saved until the connection returns.",
                    "error"
                );
            }
        };

        setSyncStatus(
            "Reconnecting to Google Sheets… Showing the last saved event list.",
            "info"
        );
        reconnectTimer = window.setTimeout(tryReconnect, 1000);
    }

    // Replace only the application's event-loading function. The browser's
    // native fetch implementation remains untouched so Google Apps Script
    // redirects continue to work normally.
    loadEvents = async function resilientLoadEvents() {
        try {
            const events = await fetchEventsWithRetry();
            cacheEvents(events);
            sharedStorageOnline = true;
            isApiOnline = true;
            stopReconnectLoop();
            setSyncStatus(`Shared storage connected (${storageLabel}).`, "ok");
            return events;
        } catch (error) {
            sharedStorageOnline = false;
            const cachedEvents = readCachedEvents();

            if (!cachedEvents) {
                throw error;
            }

            // Keep the page readable from the last successful response, but
            // block edits and signups until the live connection comes back.
            isApiOnline = true;
            scheduleReconnect();
            return cachedEvents;
        }
    };

    ensureOnline = function resilientEnsureOnline() {
        if (!sharedStorageOnline) {
            throw new Error("Shared storage is reconnecting. Please try again shortly.");
        }
    };

    window.addEventListener("online", () => {
        stopReconnectLoop();
        scheduleReconnect();
    });

    // app.js starts its own initial check immediately. Run one follow-up check
    // after app.js has loaded so a temporary first-request failure can recover
    // without requiring Ctrl+F5.
    window.setTimeout(async () => {
        try {
            await loadEvents();
            await refreshCurrentPage();
        } catch (error) {
            console.warn("Initial resilient storage check failed:", error);
        }
    }, 250);
})();
