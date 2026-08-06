(() => {
    const status = document.getElementById("sync-status");
    if (!status) return;

    const disclaimer =
        "The volunteer database may take several minutes to load depending on your internet connection.";

    let updating = false;

    function showLoadingMessage() {
        updating = true;
        status.hidden = false;
        status.classList.add("is-loading");
        status.dataset.type = "info";
        status.setAttribute("role", "status");
        status.setAttribute("aria-live", "polite");
        status.innerHTML = `
            <span class="loading-status-title">
                Loading volunteer signups<span class="loading-dots" aria-hidden="true"></span>
            </span>
            <span class="loading-status-note">${disclaimer}</span>
        `;
        updating = false;
    }

    function updateStatusDisplay() {
        if (updating) return;

        const text = status.textContent.trim().toLowerCase();
        const isLoading =
            text.includes("checking") ||
            text.includes("loading") ||
            text.includes("reconnecting");
        const isConnected = text.includes("connected");

        if (isLoading) {
            showLoadingMessage();
            return;
        }

        status.classList.remove("is-loading");

        if (isConnected) {
            status.hidden = true;
            return;
        }

        // Keep genuine error or informational messages visible.
        status.hidden = false;
    }

    updateStatusDisplay();

    const observer = new MutationObserver(updateStatusDisplay);
    observer.observe(status, {
        childList: true,
        characterData: true,
        subtree: true,
        attributes: true,
        attributeFilter: ["data-type"]
    });
})();
