(() => {
    const status = document.getElementById("sync-status");
    if (!status) return;

    const disclaimer =
        "The volunteer database may take several minutes to load depending on your internet connection.";

    function renderLoadingMessage() {
        if (status.dataset.loadingUi === "true") return;

        delete status.dataset.errorUi;
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

    function renderErrorMessage() {
        if (status.dataset.errorUi === "true") return;

        delete status.dataset.loadingUi;
        status.dataset.errorUi = "true";
        status.hidden = false;
        status.classList.remove("is-loading");
        status.dataset.type = "error";
        status.setAttribute("role", "alert");
        status.setAttribute("aria-live", "assertive");
        status.innerHTML = `
            <strong>Error — the database is currently busy.</strong><br />
            Please try reloading the page in several minutes. If the problem continues,
            please email <a href="mailto:scott@cvsoccer.club">scott@cvsoccer.club</a>.
        `;
    }

    function clearCustomUiFlags() {
        delete status.dataset.loadingUi;
        delete status.dataset.errorUi;
        status.classList.remove("is-loading");
    }

    function updateStatusDisplay() {
        const text = status.textContent.trim().toLowerCase();
        const isOurLoadingUi = status.dataset.loadingUi === "true";
        const isOurErrorUi = status.dataset.errorUi === "true";
        const isLoading =
            text.includes("checking") ||
            text.includes("loading") ||
            text.includes("reconnecting");
        const isConnected = text.includes("connected");
        const isError =
            status.dataset.type === "error" ||
            text.includes("offline") ||
            text.includes("unable to load") ||
            text.includes("connection failed");

        if (isLoading) {
            if (!isOurLoadingUi) renderLoadingMessage();
            return;
        }

        if (isError) {
            if (!isOurErrorUi) renderErrorMessage();
            return;
        }

        clearCustomUiFlags();

        if (isConnected) {
            status.hidden = true;
            return;
        }

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
