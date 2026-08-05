(() => {
    const config = window.TEAMSIGNUPS_CONFIG || {};
    const endpoint = typeof config.googleScriptUrl === "string"
        ? config.googleScriptUrl.trim()
        : "";

    if (!endpoint) return;

    const nativeFetch = window.fetch.bind(window);
    const CACHE_KEY = "cvsoccer:last-good-events-response";
    const RETRY_DELAYS = [700, 1400];

    let activeRead = null;
    let usingCachedData = false;

    const sleep = (milliseconds) =>
        new Promise((resolve) => window.setTimeout(resolve, milliseconds));

    function requestMethod(resource, options) {
        if (options && options.method) return String(options.method).toUpperCase();
        if (resource instanceof Request) return String(resource.method || "GET").toUpperCase();
        return "GET";
    }

    function requestUrl(resource) {
        return resource instanceof Request ? resource.url : String(resource);
    }

    function isEventsRequest(resource) {
        return requestUrl(resource) === endpoint;
    }

    function saveResponse(text) {
        try {
            const payload = JSON.parse(text);
            if (payload && Array.isArray(payload.events)) {
                localStorage.setItem(CACHE_KEY, text);
            }
        } catch {
            // app.js will handle malformed JSON normally.
        }
    }

    function cachedResponse() {
        try {
            const text = localStorage.getItem(CACHE_KEY);
            if (!text) return null;

            return new Response(text, {
                status: 200,
                headers: {
                    "Content-Type": "application/json",
                    "X-CV-Soccer-Source": "cache"
                }
            });
        } catch {
            return null;
        }
    }

    function updateBanner(message, type) {
        const banner = document.getElementById("sync-status");
        if (!banner) return;
        banner.textContent = message;
        banner.dataset.type = type;
    }

    async function readEvents(resource, options) {
        let lastError;

        for (let attempt = 0; attempt < 3; attempt += 1) {
            try {
                const response = await nativeFetch(resource, {
                    ...options,
                    cache: "no-store"
                });

                if (!response.ok) {
                    throw new Error(`Unable to load events (${response.status})`);
                }

                const text = await response.clone().text();
                saveResponse(text);
                usingCachedData = false;
                return response;
            } catch (error) {
                lastError = error;
                if (attempt < RETRY_DELAYS.length) {
                    await sleep(RETRY_DELAYS[attempt]);
                }
            }
        }

        const fallback = cachedResponse();
        if (!fallback) throw lastError;

        usingCachedData = true;
        window.setTimeout(() => {
            updateBanner(
                "Reconnecting to Google Sheets… Showing the last saved event list. New signups are temporarily disabled.",
                "info"
            );
        }, 0);
        return fallback;
    }

    window.fetch = function cvsStorageFetch(resource, options = {}) {
        if (!isEventsRequest(resource)) {
            return nativeFetch(resource, options);
        }

        const method = requestMethod(resource, options);

        if (method === "GET") {
            // app.js can request the list more than once during startup/rendering.
            // Share one in-flight request instead of creating overlapping Google
            // Apps Script redirects.
            if (!activeRead) {
                activeRead = readEvents(resource, options).finally(() => {
                    activeRead = null;
                });
            }

            return activeRead.then((response) => response.clone());
        }

        if (usingCachedData) {
            return Promise.reject(
                new Error("Shared storage is reconnecting. Please try again shortly.")
            );
        }

        // Never retry writes; a retry could duplicate a signup.
        return nativeFetch(resource, options);
    };
})();
