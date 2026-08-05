(() => {
    const status = document.getElementById("sync-status");
    if (!status) return;

    function updateLoadingState() {
        const text = status.textContent.toLowerCase();
        const isLoading =
            text.includes("checking") ||
            text.includes("loading") ||
            text.includes("reconnecting");

        status.classList.toggle("is-loading", isLoading);
    }

    updateLoadingState();

    const observer = new MutationObserver(updateLoadingState);
    observer.observe(status, {
        childList: true,
        characterData: true,
        subtree: true,
        attributes: true,
        attributeFilter: ["data-type"]
    });
})();
