(() => {
    const container = document.getElementById("public-event-list");
    if (!container) return;

    function enhanceFilledPositions() {
        container.querySelectorAll(".slot").forEach((slotNode) => {
            if (slotNode.dataset.fullPositionEnhanced === "true") return;

            const status = slotNode.querySelector("small");
            const form = slotNode.querySelector(".signup-form");
            const button = form?.querySelector("button");

            if (!status || !form || !button) return;

            const match = status.textContent.match(/(\d+)\s*\/\s*(\d+)\s*filled/i);
            if (!match) return;

            const filled = Number(match[1]);
            const needed = Number(match[2]);
            if (needed <= 0 || filled < needed) return;

            slotNode.dataset.fullPositionEnhanced = "true";
            slotNode.classList.add("position-full");
            status.textContent = `${filled}/${needed} filled`;

            const signedUpList = slotNode.querySelector(".signed-up-list");
            if (signedUpList) {
                const names = signedUpList.textContent
                    .replace(/^Signed up:\s*/i, "")
                    .split(",")
                    .map((name) => name.trim())
                    .filter(Boolean);

                const summary = document.createElement("div");
                summary.className = "filled-volunteer-summary";

                const heading = document.createElement("div");
                heading.className = "filled-volunteer-heading";
                heading.textContent = "Signed up:";
                summary.appendChild(heading);

                const list = document.createElement("ul");
                names.forEach((name) => {
                    const item = document.createElement("li");
                    item.textContent = name;
                    list.appendChild(item);
                });
                summary.appendChild(list);

                signedUpList.replaceWith(summary);
            }

            const fields = form.querySelector(".fields-grid");
            if (fields) fields.remove();

            form.classList.add("signup-form-full");
            button.classList.add("btn-full");
            button.disabled = true;
            button.setAttribute("aria-disabled", "true");
            button.textContent = `Full (${filled}/${needed})`;
        });
    }

    enhanceFilledPositions();

    const observer = new MutationObserver(() => enhanceFilledPositions());
    observer.observe(container, {
        childList: true,
        subtree: true
    });
})();
