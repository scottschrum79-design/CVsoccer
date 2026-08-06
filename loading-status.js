(() => {
    const status = document.getElementById("sync-status");
    if (!status) return;

    const disclaimer =
        "The volunteer database may take several minutes to load depending on your internet connection.";

    function renderLoadingMessage() {
        if (status.dataset.loadingUi === "true") return;

        status.dataset.loadingUi = "true";
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
    }

    function clearLoadingUiFlag() {
        delete status.dataset.loadingUi;
        status.classList.remove("is-loading");
    }

    function updateStatusDisplay() {
        const text = status.textContent.trim().toLowerCase();
        const isOurLoadingUi = status.dataset.loadingUi === "true";
        const isLoading =
            text.includes("checking") ||
            text.includes("loading") ||
            text.includes("reconnecting");
        const isConnected = text.includes("connected");

        if (isLoading) {
            if (!isOurLoadingUi) renderLoadingMessage();
            return;
        }

        clearLoadingUiFlag();

        if (isConnected) {
            status.hidden = true;
            return;
        }

        // Keep genuine errors and other informational messages visible.
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
