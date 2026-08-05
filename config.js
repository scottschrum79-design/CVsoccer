window.TEAMSIGNUPS_CONFIG = {
  // Paste your deployed Google Apps Script Web App URL here.
  // Leave blank to use local/server storage at /api/events.
  googleScriptUrl: "https://script.google.com/macros/s/AKfycbwicKv13R4Nxsx6G_-9eTNZSQqIuEXvNO7Zit3gI2sgUAlSYNVZ4Czd-2feDMRCw6bJ/exec",

  // Password for the creator page. This is a lightweight static-site gate.
  creatorPassword: "CVsoccer2026!"
};

// Google Apps Script can occasionally have a brief timeout or return a
// temporary server error. Retry read-only requests before the app declares
// shared storage offline. POST requests are never retried to avoid duplicate
// signups or event changes.
(() => {
  const originalFetch = window.fetch.bind(window);
  const scriptUrl = String(window.TEAMSIGNUPS_CONFIG.googleScriptUrl || "").trim();
  const maxAttempts = 3;
  const retryableStatuses = new Set([408, 429, 500, 502, 503, 504]);

  if (!scriptUrl) return;

  const wait = (milliseconds) =>
    new Promise((resolve) => window.setTimeout(resolve, milliseconds));

  function isGoogleSheetsRead(resource, options) {
    const method = String(options?.method || (resource instanceof Request ? resource.method : "GET")).toUpperCase();
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

  window.fetch = async function resilientFetch(resource, options = {}) {
    if (!isGoogleSheetsRead(resource, options)) {
      return originalFetch(resource, options);
    }

    let lastError;

    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      try {
        const response = await originalFetch(addCacheBuster(resource, attempt), {
          ...options,
          cache: "no-store"
        });

        if (response.ok || !retryableStatuses.has(response.status) || attempt === maxAttempts) {
          return response;
        }

        lastError = new Error(`Temporary storage error (${response.status})`);
      } catch (error) {
        lastError = error;
        if (attempt === maxAttempts) throw error;
      }

      await wait(750 * attempt);
    }

    throw lastError || new Error("Unable to connect to shared storage");
  };
})();
