(() => {
    const container = document.getElementById("public-event-list");
    if (!container) return;

    function readFillStatus(slotNode) {
        const status = slotNode.querySelector("small");
        if (!status) return null;

        const match = status.textContent.match(/(\d+)\s*\/\s*(\d+)\s*filled/i);
        if (!match) return null;

        const filled = Number(match[1]);
        const needed = Number(match[2]);
        return {
            filled,
            needed,
            isFull: needed > 0 && filled >= needed
        };
    }

    function enhanceFilledPositions() {
        container.querySelectorAll(".slot").forEach((slotNode) => {
            const fillStatus = readFillStatus(slotNode);
            if (!fillStatus || !fillStatus.isFull) return;
            if (slotNode.dataset.fullPositionEnhanced === "true") return;

            const form = slotNode.querySelector(".signup-form");
            const button = form?.querySelector("button");
            const status = slotNode.querySelector("small");

            if (!form || !button || !status) return;

            const { filled, needed } = fillStatus;

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

    function moveOpenPositionsFirst() {
        container.querySelectorAll(".slots-wrap").forEach((slotsWrap) => {
            const slots = Array.from(slotsWrap.querySelectorAll(":scope > .slot"));
            if (slots.length < 2) return;

            const sortedSlots = slots
                .map((slot, index) => ({
                    slot,
                    index,
                    isFull: readFillStatus(slot)?.isFull === true
                }))
                .sort((a, b) => {
                    if (a.isFull !== b.isFull) return a.isFull ? 1 : -1;
                    return a.index - b.index;
                });

            sortedSlots.forEach(({ slot }) => slotsWrap.appendChild(slot));
        });
    }

    let enhancementScheduled = false;

    function scheduleEnhancement() {
        if (enhancementScheduled) return;
        enhancementScheduled = true;

        window.requestAnimationFrame(() => {
            enhancementScheduled = false;
            enhanceFilledPositions();
            moveOpenPositionsFirst();
        });
    }

    scheduleEnhancement();

    const observer = new MutationObserver(scheduleEnhancement);
    observer.observe(container, {
        childList: true,
        subtree: true
    });
})();
