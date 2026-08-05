(() => {
    const container = document.getElementById("public-event-list");
    if (!container) return;

    function enhanceFilledPositions() {
        container.querySelectorAll(".slot").forEach((slotNode) => {
            const status = slotNode.querySelector("small");
            const form = slotNode.querySelector(".signup-form");
            const button = form?.querySelector("button");

            if (!status || !form || !button) return;

            const match = status.textContent.match(/(\d+)\s*\/\s*(\d+)\s*filled/i);
            if (!match) return;

            const filled = Number(match[1]);
            const needed = Number(match[2]);
            const isFull = needed > 0 && filled >= needed;

            slotNode.classList.toggle("position-full", isFull);
            form.classList.toggle("signup-form-full", isFull);
            button.classList.toggle("btn-full", isFull);

            if (isFull) {
                form.querySelectorAll("input, textarea").forEach((field) => {
                    field.disabled = true;
                    field.setAttribute("aria-disabled", "true");
                });

                button.disabled = true;
                button.setAttribute("aria-disabled", "true");
                button.textContent = `Full (${filled}/${needed})`;
            }
        });
    }

    enhanceFilledPositions();

    const observer = new MutationObserver(() => enhanceFilledPositions());
    observer.observe(container, {
        childList: true,
        subtree: true
    });
})();
