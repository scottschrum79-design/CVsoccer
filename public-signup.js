(() => {
    const config = window.TEAMSIGNUPS_CONFIG || {};
    const endpoint = typeof config.googleScriptUrl === "string" ? config.googleScriptUrl.trim() : "";
    const container = document.getElementById("public-event-list");
    const status = document.getElementById("sync-status");
    const overlay = document.getElementById("loadingOverlay");

    if (!container || !endpoint) {
        if (status) {
            status.textContent = "Unable to load signup form.";
            status.dataset.type = "error";
        }
        return;
    }

    function setStatus(message, type = "info") {
        if (!status) return;
        status.hidden = !message;
        status.textContent = message;
        status.dataset.type = type;
    }

    function showLoading(message) {
        if (!overlay) return;
        const text = overlay.querySelector(".loading-text");
        if (text) text.textContent = message;
        overlay.classList.remove("hidden");
    }

    function hideLoading() {
        if (overlay) overlay.classList.add("hidden");
    }

    async function loadEvents() {
        const response = await fetch(endpoint, { method: "GET", cache: "no-store" });
        if (!response.ok) throw new Error(`Unable to load events (${response.status})`);
        const payload = JSON.parse(await response.text());
        return Array.isArray(payload.events) ? payload.events : [];
    }

    async function saveEvents(events) {
        const response = await fetch(endpoint, {
            method: "POST",
            headers: { "Content-Type": "text/plain;charset=utf-8" },
            body: JSON.stringify({ events })
        });
        if (!response.ok) throw new Error("Unable to save signup");
    }

    function formatDate(rawDate) {
        const date = new Date(`${rawDate}T00:00:00`);
        return date.toLocaleDateString(undefined, {
            month: "short",
            day: "numeric",
            year: "numeric"
        });
    }

    function uid() {
        return Math.random().toString(36).slice(2, 10);
    }

    function publicName(firstName, lastName) {
        const firstInitial = String(firstName || "").trim().charAt(0).toUpperCase();
        const safeLastName = String(lastName || "").trim();
        return `${firstInitial}. ${safeLastName}`.trim();
    }

    function render(events) {
        container.replaceChildren();

        const sorted = [...events].sort((a, b) => Number(a.order ?? 0) - Number(b.order ?? 0));
        if (!sorted.length) {
            container.innerHTML = '<p class="empty">No events available yet.</p>';
            return;
        }

        sorted.forEach((event) => {
            const article = document.createElement("article");
            article.className = "event";
            article.innerHTML = `
                <h3>${event.title}</h3>
                <div class="event-meta">Teams due by ${formatDate(event.date)}</div>
                <p>${event.description || "No description provided."}</p>
                <div class="slots-wrap"></div>
            `;

            const slotsWrap = article.querySelector(".slots-wrap");
            (event.slots || []).forEach((slot) => {
                const claimedBy = Array.isArray(slot.claimedBy) ? slot.claimedBy : [];
                const remaining = Number(slot.count || 0) - claimedBy.length;
                const isFull = remaining <= 0;
                const slotNode = document.createElement("div");
                slotNode.className = isFull ? "slot position-full" : "slot";

                const names = claimedBy.map((person) => person.publicName).filter(Boolean).join(", ");
                const signupForm = isFull ? "" : `
                    <form class="signup-form">
                        <div class="fields-grid">
                            <input name="firstName" placeholder="First name" required />
                            <input name="lastName" placeholder="Last name" required />
                            <input name="email" type="email" placeholder="Email" required />
                            <input name="phone" placeholder="Phone" required />
                            <input name="notes" placeholder="Any notes (optional)" />
                        </div>
                        <button type="submit">Sign up</button>
                    </form>
                `;

                slotNode.innerHTML = `
                    <div>
                        <strong>${slot.name}</strong><br />
                        <small>${isFull ? "FULL" : `${claimedBy.length}/${slot.count} filled`}</small>
                        ${names ? `<p class="signed-up-list">Signed up: ${names}</p>` : ""}
                    </div>
                    ${signupForm}
                `;

                const form = slotNode.querySelector("form");
                if (form) form.addEventListener("submit", async (eventSubmit) => {
                    eventSubmit.preventDefault();
                    const formData = new FormData(form);
                    showLoading("Saving signup...");

                    try {
                        const latestEvents = await loadEvents();
                        const latestEvent = latestEvents.find((item) => String(item.id) === String(event.id));
                        const latestSlot = latestEvent?.slots?.find((item) => String(item.id) === String(slot.id));
                        if (!latestEvent || !latestSlot) throw new Error("Position no longer exists");
                        latestSlot.claimedBy = Array.isArray(latestSlot.claimedBy) ? latestSlot.claimedBy : [];
                        if (latestSlot.claimedBy.length >= Number(latestSlot.count || 0)) {
                            throw new Error("This position has just been filled");
                        }

                        const firstName = String(formData.get("firstName") || "").trim();
                        const lastName = String(formData.get("lastName") || "").trim();
                        latestSlot.claimedBy.push({
                            id: uid(),
                            firstName,
                            lastName,
                            email: String(formData.get("email") || "").trim(),
                            phone: String(formData.get("phone") || "").trim(),
                            notes: String(formData.get("notes") || "").trim(),
                            publicName: publicName(firstName, lastName)
                        });

                        await saveEvents(latestEvents);
                        setStatus("Thanks for volunteering! Your signup was saved.", "ok");
                        render(await loadEvents());
                    } catch (error) {
                        setStatus(error instanceof Error ? error.message : "Unable to save signup.", "error");
                    } finally {
                        hideLoading();
                    }
                });

                slotsWrap.appendChild(slotNode);
            });

            container.appendChild(article);
        });
    }

    (async () => {
        try {
            setStatus("Loading volunteer signups... This may take several minutes depending on your connection.", "info");
            render(await loadEvents());
            setStatus("", "ok");
        } catch (error) {
            setStatus("The volunteer database is currently unavailable. Please try again shortly.", "error");
            container.innerHTML = '<p class="empty">Unable to load coaching positions.</p>';
        }
    })();
})();
