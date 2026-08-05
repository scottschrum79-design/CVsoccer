window.TEAMSIGNUPS_CONFIG = {
  // Paste your deployed Google Apps Script Web App URL here.
  // Leave blank to use local/server storage at /api/events.
  googleScriptUrl: "https://script.google.com/macros/s/AKfycbwicKv13R4Nxsx6G_-9eTNZSQqIuEXvNO7Zit3gI2sgUAlSYNVZ4Czd-2feDMRCw6bJ/exec",

  // Password for the creator page. This is a lightweight static-site gate.
  creatorPassword: "CVsoccer2026!"
};

// Make Google Sheets reads more resilient. Successful event data is cached in
// the browser. If Google Apps Script has a brief outage, the page keeps showing
// the last successful event list while it reconnects in the background.
// POST requests are never retried or cached, which prevents duplicate signups.
(() => {
  const originalFetch = window.fetch.bind(window);
  const scriptUrl = String(window.TEAMSIGNUPS_CONFIG.googleScriptUrl || "").trim();
  const cacheKey = "cvsoccer:lastSuccessfulEvents";
  const maxAttempts = 3;
  const retryableStatuses = new Set([408, 429, 500, 502, 503, 504]);
  let reconnectTimer = null;
  let reconnecting = false;

  if (!scriptUrl) return;

  const wait = (milliseconds) =>
    new Promise((resolve) => window.setTimeout(resolve, milliseconds));

  function setStorageStatus(message, type = "info") {
    const status = document.getElementById("sync-status");
    if (!status) return;
    status.textContent = message;
    status.dataset.type = type;
  }

  function isGoogleSheetsRead(resource, options) {
    const method = String(
      options?.method || (resource instanceof Request ? resource.method : "GET")
    ).toUpperCase();
    const url = resource instanceof Request ? resource.url : String(resource);
    return method === "GET" && url.startsWith(scriptUrl);
  }

  function addCacheBuster(resource, attempt) {
    const rawUrl = resource instanceof Request ? resource.url : String(resource);
    const url = new URL(rawUrl, window.location.href);
    url.searchParams.set("_ts", `${Date.now()}-${attempt}`);

    if (resource instanceof Request) {
      return new Request(url.toString(), resource);
    }

    return url.toString();
  }

  function saveCachedResponse(text) {
    try {
      const payload = JSON.parse(text);
      if (payload && Array.isArray(payload.events)) {
        localStorage.setItem(cacheKey, text);
      }
    } catch {
      // Ignore malformed responses; app.js will report the error normally.
    }
  }

  function cachedResponse() {
    const cached = localStorage.getItem(cacheKey);
    if (!cached) return null;

    return new Response(cached, {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "X-CV-Soccer-Cache": "stale"
      }
    });
  }

  async function requestWithRetries(resource, options = {}) {
    let lastError;

    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      try {
        const response = await originalFetch(addCacheBuster(resource, attempt), {
          ...options,
          cache: "no-store"
        });

        if (response.ok) {
          const text = await response.clone().text();
          saveCachedResponse(text);
          return response;
        }

        if (!retryableStatuses.has(response.status) || attempt === maxAttempts) {
          return response;
        }

        lastError = new Error(`Temporary storage error (${response.status})`);
      } catch (error) {
        lastError = error;
        if (attempt === maxAttempts) break;
      }

      await wait(750 * attempt);
    }

    throw lastError || new Error("Unable to connect to shared storage");
  }

  function scheduleBackgroundReconnect() {
    if (reconnecting) return;
    reconnecting = true;
    let reconnectAttempt = 0;

    const tryReconnect = async () => {
      reconnectAttempt += 1;

      try {
        const response = await requestWithRetries(scriptUrl, {
          method: "GET",
          cache: "no-store"
        });

        if (response.ok) {
          reconnecting = false;
          reconnectTimer = null;
          setStorageStatus("Shared storage connected (Google Sheets).", "ok");
          return;
        }
      } catch {
        // Keep trying below until the background reconnect window expires.
      }

      if (reconnectAttempt < 6) {
        reconnectTimer = window.setTimeout(tryReconnect, 5000);
      } else {
        reconnecting = false;
        reconnectTimer = null;
        setStorageStatus(
          "Shared storage is temporarily unavailable. Showing the last saved event list; signups may not save until the connection returns.",
          "error"
        );
      }
    };

    reconnectTimer = window.setTimeout(tryReconnect, 3000);
  }

  window.addEventListener("online", () => {
    if (reconnectTimer) window.clearTimeout(reconnectTimer);
    reconnectTimer = null;
    reconnecting = false;
    scheduleBackgroundReconnect();
  });

  window.fetch = async function resilientFetch(resource, options = {}) {
    if (!isGoogleSheetsRead(resource, options)) {
      return originalFetch(resource, options);
    }

    try {
      const response = await requestWithRetries(resource, options);

      if (response.ok) {
        setStorageStatus("Shared storage connected (Google Sheets).", "ok");
      }

      return response;
    } catch (error) {
      const fallback = cachedResponse();
      if (!fallback) throw error;

      setStorageStatus(
        "Reconnecting to Google Sheets… Showing the last saved event list.",
        "info"
      );
      scheduleBackgroundReconnect();
      return fallback;
    }
  };
})();
