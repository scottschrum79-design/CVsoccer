let isApiOnline = false;

const storageConfig = window.TEAMSIGNUPS_CONFIG || {};
const googleScriptUrl = typeof storageConfig.googleScriptUrl === "string" ? storageConfig.googleScriptUrl.trim() : "";
let resolvedGoogleUrl = "";
const storageLabel = googleScriptUrl ? "Google Sheets" : "server storage";

// ---------- Helpers ----------
function uid() {
    return Math.random().toString(36).slice(2, 10);
}

function setSyncStatus(message, type = "info") {
    const banner = document.getElementById("sync-status");
    if (!banner) return;
    banner.textContent = message;
    banner.dataset.type = type;
}

function setActionStatus(message, type = "info") {
    const banner = document.getElementById("action-status");
    if (!banner) return;

    if (!message) {
        banner.hidden = true;
        banner.textContent = "";
        banner.dataset.type = "info";
        return;
    }

    banner.hidden = false;
    banner.textContent = message;
    banner.dataset.type = type;
}

function showLoading(message = "Updating…") {
    const overlay = document.getElementById("loadingOverlay");
    if (!overlay) return;
    overlay.classList.remove("hidden");
    const text = overlay.querySelector(".loading-text");
    if (text) text.textContent = message;
}

function hideLoading() {
    const overlay = document.getElementById("loadingOverlay");
    if (!overlay) return;
    overlay.classList.add("hidden");
}

function waitForPaint() {
    return new Promise((resolve) => requestAnimationFrame(() => resolve()));
}

function showOfflineMessage(container) {
    if (!container) return;
    container.innerHTML = `
    <p class="empty">
      Shared storage is offline. Connect Google Sheets or run the Node server so events/signups are saved for everyone.
    </p>
  `;
}

function handleApiOffline() {
    isApiOnline = false;
    setSyncStatus(`Shared storage offline (${storageLabel}). Events are not shared.`, "error");
}

function ensureOnline() {
    if (!isApiOnline) throw new Error("Storage offline");
}

function buildEventsEndpoint() {
    if (!googleScriptUrl) return "/api/events";
    // If we have learned the final redirected Apps Script URL (googleusercontent echo), use it.
    if (resolvedGoogleUrl) return resolvedGoogleUrl;
    return googleScriptUrl;
}

// ---------- Storage diagnostics ----------
function setupStorageDiagnostics() {
    const endpointNode = document.getElementById("storage-endpoint");
    if (endpointNode) endpointNode.textContent = `Endpoint: ${buildEventsEndpoint()}`;

    const verifyButton = document.getElementById("verify-storage");
    if (!verifyButton) return;

    verifyButton.addEventListener("click", async () => {
        verifyButton.disabled = true;
        setActionStatus("Checking shared storage connection...", "info");

        try {
            showLoading("Checking connection...");
            await waitForPaint();

            const events = await loadEvents();
            isApiOnline = true;

            setSyncStatus(`Shared storage connected (${storageLabel}). Events and signups are visible to all users.`, "ok");
            setActionStatus(`Connection OK. Loaded ${events.length} event(s).`, "ok");

            if (document.body.dataset.page === "create") {
                await renderAdminPage();
            } else {
                await renderPublicSignupPage();
            }
        } catch (error) {
            handleApiOffline();
            setActionStatus(
                `Connection failed. Verify the Apps Script deployment uses /exec and public access. ${error instanceof Error ? error.message : ""}`,
                "error"
            );
        } finally {
            hideLoading();
            verifyButton.disabled = false;
        }
    });
}

// ---------- API ----------
async function loadEvents() {
    const response = await fetch(buildEventsEndpoint(), { cache: "no-store", method: "GET" });
    if (!response.ok) throw new Error(`Unable to load events (${response.status})`);

    if (googleScriptUrl && response.url) {
        resolvedGoogleUrl = response.url;
    }

    const text = await response.text();
    const payload = JSON.parse(text);
    return Array.isArray(payload.events) ? payload.events : [];
}

async function saveEvents(events) {
    const payload = JSON.stringify({ events });

    // Google Apps Script can redirect POSTs, which often triggers CORS issues on GitHub Pages.
    // Using no-cors makes the request "fire-and-forget"; the next GET will confirm success.
    if (googleScriptUrl) {
        await fetch(buildEventsEndpoint(), {
            method: "POST",
            mode: "no-cors",
            cache: "no-store",
            body: payload,
        });
        return;
    }

    // Node server fallback
    const response = await fetch(buildEventsEndpoint(), {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: payload,
    });

    if (!response.ok) throw new Error("Unable to save events");
}


// ---------- Domain logic ----------
function formatDate(rawDate) {
    const date = new Date(`${rawDate}T00:00:00`);
    return date.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

function publicDisplayName(firstName, lastName) {
    const initial = (firstName || "").trim().charAt(0).toUpperCase();
    const safeLastName = (lastName || "").trim();
    if (!initial && !safeLastName) return "Anonymous";
    return `${initial}. ${safeLastName}`.trim();
}

function createSlotInput(slotInputs, slotTemplate, defaultName = "", defaultCount = 1) {
    const fragment = slotTemplate.content.cloneNode(true);
    const row = fragment.querySelector(".slot-row");
    const label = row.querySelector(".slot-label");
    const count = row.querySelector(".slot-count");
    const remove = row.querySelector(".remove-slot");

    label.value = defaultName;
    count.value = defaultCount;
    remove.addEventListener("click", () => row.remove());

    slotInputs.appendChild(row);
}

async function claimSlot(eventId, slotId, payload) {
    ensureOnline();

    const events = await loadEvents();
    const event = events.find((item) => item.id === eventId);
    if (!event) return;

    const slot = (event.slots || []).find((item) => item.id === slotId);
    if (!slot) return;

    slot.claimedBy = Array.isArray(slot.claimedBy) ? slot.claimedBy : [];
    if (slot.claimedBy.length >= slot.count) return;

    slot.claimedBy.push({
        id: uid(),
        firstName: payload.firstName.trim(),
        lastName: payload.lastName.trim(),
        email: payload.email.trim(),
        phone: payload.phone.trim(),
        notes: payload.notes.trim(),
        publicName: publicDisplayName(payload.firstName, payload.lastName),
    });

    await saveEvents(events);
    setActionStatus("Thanks for volunteering! Your signup was saved.", "ok");
}

async function removeEvent(eventId) {
    ensureOnline();
    const events = await loadEvents();
    const updated = events.filter((event) => event.id !== eventId);
    await saveEvents(updated);
    setActionStatus("Event removed.", "info");
}

async function removeSignup(eventId, slotId, personId) {
    ensureOnline();

    const events = await loadEvents();
    const event = events.find((item) => item.id === eventId);
    if (!event) return;

    const slot = (event.slots || []).find((item) => item.id === slotId);
    if (!slot || !Array.isArray(slot.claimedBy)) return;

    const before = slot.claimedBy.length;
    slot.claimedBy = slot.claimedBy.filter((person) => person.id !== personId);
    if (slot.claimedBy.length === before) return;

    await saveEvents(events);
    setActionStatus("Signup removed.", "info");
}

// ---------- Rendering: Public ----------
async function renderPublicSignupPage() {
    const container = document.getElementById("public-event-list");
    if (!container) return;

    if (!isApiOnline) {
        showOfflineMessage(container);
        return;
    }

    const events = (await loadEvents()).sort((a, b) => a.date.localeCompare(b.date));
    container.innerHTML = "";

    if (!events.length) {
        container.innerHTML = `<p class="empty">No events available yet.</p>`;
        return;
    }

    events.forEach((event) => {
        const wrapper = document.createElement("article");
        wrapper.className = "event";
        wrapper.innerHTML = `
      <h3>${event.title}</h3>
      <div class="event-meta">${formatDate(event.date)}</div>
      <p>${event.description || "No description provided."}</p>
      <div class="slots-wrap"></div>
    `;

        const slotsWrap = wrapper.querySelector(".slots-wrap");

        (event.slots || []).forEach((slot) => {
            slot.claimedBy = Array.isArray(slot.claimedBy) ? slot.claimedBy : [];
            const remaining = slot.count - slot.claimedBy.length;
            const volunteerList = slot.claimedBy.map((person) => person.publicName).join(", ");

            const slotNode = document.createElement("div");
            slotNode.className = "slot";
            slotNode.innerHTML = `
        <div>
          <strong>${slot.name}</strong><br />
          <small>${slot.claimedBy.length}/${slot.count} filled</small>
          ${volunteerList ? `<p class="signed-up-list">Signed up: ${volunteerList}</p>` : ""}
        </div>
        <form class="signup-form" data-event-id="${event.id}" data-slot-id="${slot.id}">
          <div class="fields-grid">
            <input name="firstName" placeholder="First name" ${remaining <= 0 ? "disabled" : "required"} />
            <input name="lastName" placeholder="Last name" ${remaining <= 0 ? "disabled" : "required"} />
            <input name="email" type="email" placeholder="Email" ${remaining <= 0 ? "disabled" : "required"} />
            <input name="phone" placeholder="Phone" ${remaining <= 0 ? "disabled" : "required"} />
            <input name="notes" placeholder="Any notes (optional)" ${remaining <= 0 ? "disabled" : ""} />
          </div>
          <button ${remaining <= 0 ? "disabled" : ""}>${remaining <= 0 ? "Full" : "Sign up"}</button>
        </form>
      `;

            slotNode.querySelector("form").addEventListener("submit", async (e) => {
                e.preventDefault();
                setActionStatus("");

                try {
                    showLoading("Signing you up...");
                    await waitForPaint();

                    const formData = new FormData(e.currentTarget);
                    await claimSlot(event.id, slot.id, {
                        firstName: String(formData.get("firstName") || ""),
                        lastName: String(formData.get("lastName") || ""),
                        email: String(formData.get("email") || ""),
                        phone: String(formData.get("phone") || ""),
                        notes: String(formData.get("notes") || ""),
                    });

                    await renderPublicSignupPage();
                } catch {
                    handleApiOffline();
                    setActionStatus("Could not save signup because shared storage is offline.", "error");
                    showOfflineMessage(container);
                } finally {
                    hideLoading();
                }
            });

            slotsWrap.appendChild(slotNode);
        });

        container.appendChild(wrapper);
    });
}

// ---------- Rendering: Admin ----------
async function renderAdminPage() {
    const adminContainer = document.getElementById("admin-event-list");
    if (!adminContainer) return;

    if (!isApiOnline) {
        showOfflineMessage(adminContainer);
        return;
    }

    const events = (await loadEvents()).sort((a, b) => a.date.localeCompare(b.date));
    adminContainer.innerHTML = "";

    if (!events.length) {
        adminContainer.innerHTML = `<p class="empty">No events yet. Create one to get started.</p>`;
        return;
    }

    events.forEach((event) => {
        const wrapper = document.createElement("article");
        wrapper.className = "event";

        const slotsHtml = (event.slots || [])
            .map((slot) => {
                slot.claimedBy = Array.isArray(slot.claimedBy) ? slot.claimedBy : [];

                const rows = slot.claimedBy
                    .map(
                        (person) => `
              <tr>
                <td>${person.publicName}</td>
                <td>${person.firstName || ""} ${person.lastName || ""}</td>
                <td>${person.email || ""}</td>
                <td>${person.phone || ""}</td>
                <td>${person.notes || "-"}</td>
                <td>
                  <button type="button"
                          class="danger small remove-signup"
                          data-event-id="${event.id}"
                          data-slot-id="${slot.id}"
                          data-person-id="${person.id}">
                    Remove
                  </button>
                </td>
              </tr>
            `
                    )
                    .join("");

                return `
          <div class="admin-slot">
            <h4>${slot.name} <small>(${slot.claimedBy.length}/${slot.count})</small></h4>
            ${slot.claimedBy.length
                        ? `<div class="table-wrap"><table>
                    <thead>
                      <tr>
                        <th>Public name</th>
                        <th>Full name</th>
                        <th>Email</th>
                        <th>Phone</th>
                        <th>Notes</th>
                        <th>Action</th>
                      </tr>
                    </thead>
                    <tbody>${rows}</tbody>
                  </table></div>`
                        : `<p class="empty">No signups yet.</p>`
                    }
          </div>
        `;
            })
            .join("");

        wrapper.innerHTML = `
      <div class="event-head">
        <h3>${event.title}</h3>
        <button type="button" class="danger remove-event" data-event-id="${event.id}">Remove event</button>
      </div>
      <div class="event-meta">${formatDate(event.date)}</div>
      <p>${event.description || "No description provided."}</p>
      ${slotsHtml}
    `;

        wrapper.querySelector(".remove-event")?.addEventListener("click", async () => {
            const shouldRemove = window.confirm("Remove this event and all signups?");
            if (!shouldRemove) return;

            try {
                showLoading("Removing event...");
                await waitForPaint();

                await removeEvent(event.id);
                await renderAdminPage();
            } catch {
                handleApiOffline();
                showOfflineMessage(adminContainer);
            } finally {
                hideLoading();
            }
        });

        wrapper.querySelectorAll(".remove-signup").forEach((button) => {
            button.addEventListener("click", async () => {
                const eventId = button.dataset.eventId;
                const slotId = button.dataset.slotId;
                const personId = button.dataset.personId;

                const shouldRemove = window.confirm("Remove this signup?");
                if (!shouldRemove) return;

                try {
                    showLoading("Removing signup...");
                    await waitForPaint();

                    await removeSignup(eventId, slotId, personId);
                    await renderAdminPage();
                } catch {
                    handleApiOffline();
                    showOfflineMessage(adminContainer);
                } finally {
                    hideLoading();
                }
            });
        });

        adminContainer.appendChild(wrapper);
    });
}

// ---------- Create page ----------
function initCreatePage() {
    const eventForm = document.getElementById("event-form");
    const slotInputs = document.getElementById("slot-inputs");
    const slotTemplate = document.getElementById("slot-template");
    const addSlotButton = document.getElementById("add-slot");

    if (!eventForm || !slotInputs || !slotTemplate || !addSlotButton) return;

    addSlotButton.addEventListener("click", () => createSlotInput(slotInputs, slotTemplate));

    eventForm.addEventListener("submit", async (e) => {
        e.preventDefault();
        setActionStatus("");

        const title = document.getElementById("event-title").value.trim();
        const description = document.getElementById("event-description").value.trim();
        const date = document.getElementById("event-date").value;

        const slots = Array.from(slotInputs.querySelectorAll(".slot-row"))
            .map((row) => {
                const name = row.querySelector(".slot-label").value.trim();
                const count = Number.parseInt(row.querySelector(".slot-count").value, 10);
                return { id: uid(), name, count, claimedBy: [] };
            })
            .filter((slot) => slot.name && slot.count > 0);

        if (!title || !date || !slots.length) return;

        try {
            showLoading("Creating event...");
            await waitForPaint();

            ensureOnline();
            const events = await loadEvents();
            events.push({ id: uid(), title, description, date, slots });
            await saveEvents(events);

            eventForm.reset();
            slotInputs.innerHTML = "";
            createSlotInput(slotInputs, slotTemplate, "Example: Snack table", 2);
            createSlotInput(slotInputs, slotTemplate, "Example: Cleanup", 1);

            setActionStatus("Event created and shared successfully.", "ok");
            await renderAdminPage();
        } catch {
            handleApiOffline();
            setActionStatus(
                "Could not create event because shared storage is offline. Reconnect Google Sheets and redeploy the Apps Script web app.",
                "error"
            );
            showOfflineMessage(document.getElementById("admin-event-list"));
        } finally {
            hideLoading();
        }
    });

    createSlotInput(slotInputs, slotTemplate, "Example: Snack table", 2);
    createSlotInput(slotInputs, slotTemplate, "Example: Cleanup", 1);
}

// ---------- Bootstrap ----------
async function init() {
    setupStorageDiagnostics();

    try {
        await loadEvents();
        isApiOnline = true;
        setSyncStatus(`Shared storage connected (${storageLabel}). Events and signups are visible to all users.`, "ok");
    } catch {
        handleApiOffline();
    }

    const currentPage = document.body.dataset.page;

    if (currentPage === "create") {
        initCreatePage();
        await renderAdminPage();
        return;
    }

    await renderPublicSignupPage();
}

init();
