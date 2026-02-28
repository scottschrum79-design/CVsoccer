let isApiOnline = false;

const storageConfig = window.TEAMSIGNUPS_CONFIG || {};
const googleScriptUrl = typeof storageConfig.googleScriptUrl === "string" ? storageConfig.googleScriptUrl.trim() : "";
const storageLabel = googleScriptUrl ? "Google Sheets" : "server storage";

function getAdminToken() {
  try {
    return (window.sessionStorage.getItem("TEAMSIGNUPS_ADMIN_TOKEN") || "").trim();
  } catch {
    return "";
  }
}

function setAdminToken(token) {
  try {
    if (token) window.sessionStorage.setItem("TEAMSIGNUPS_ADMIN_TOKEN", token.trim());
  } catch {
    // ignore
  }
}

function buildGoogleUrl(params) {
  const base = googleScriptUrl;
  const url = new URL(base);
  Object.entries(params || {}).forEach(([key, value]) => {
    if (value === undefined || value === null || value === "") return;
    url.searchParams.set(key, String(value));
  });
  return url.toString();
}


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
  if (!isApiOnline) {
    throw new Error("Storage offline");
  }
}

function buildEventsEndpoint() {
  if (!googleScriptUrl) return "/api/events";
  return googleScriptUrl;
}

function setupStorageDiagnostics() {
  const endpointNode = document.getElementById("storage-endpoint");
  if (endpointNode) {
    endpointNode.textContent = `Endpoint: ${buildEventsEndpoint()}`;
  }

  const verifyButton = document.getElementById("verify-storage");
  if (!verifyButton) return;

  verifyButton.addEventListener("click", async () => {
    verifyButton.disabled = true;
    setActionStatus("Checking shared storage connection...", "info");

    try {
      const events = await loadEvents({ admin: document.body.dataset.page === "create" });
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
      verifyButton.disabled = false;
    }
  });
}

async function loadEvents(options = {}) {
  const { admin = false } = options;
  const endpoint = googleScriptUrl
    ? (admin ? buildGoogleUrl({ token: getAdminToken() }) : buildGoogleUrl({ public: 1 }))
    : buildEventsEndpoint();

  const response = await fetch(endpoint, {
    cache: "no-store",
    method: "GET"
  });

  if (!response.ok) throw new Error(`Unable to load events (${response.status})`);

  const text = await response.text();
  const payload = JSON.parse(text);
  return Array.isArray(payload.events) ? payload.events : [];
}

async function saveEvents(events) {
  const payload = JSON.stringify({ events });

  if (googleScriptUrl) {
    const token = getAdminToken();
    if (!token) throw new Error("Missing admin token");

    const response = await fetch(buildGoogleUrl({ action: "saveAll", token }), {
      method: "POST",
      // CORS-simple content type (avoid preflight)
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: payload
    });

    if (!response.ok) throw new Error("Unable to save events");
    return;
  }

  const response = await fetch(buildEventsEndpoint(), {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: payload
  });

  if (!response.ok) throw new Error("Unable to save events");
}


function formatDate(rawDate) {
  const date = new Date(`${rawDate}T00:00:00`);
  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric"
  });
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

  if (googleScriptUrl) {
    const signup = {
      firstName: payload.firstName.trim(),
      lastName: payload.lastName.trim(),
      email: payload.email.trim(),
      phone: payload.phone.trim(),
      notes: payload.notes.trim(),
      publicName: publicDisplayName(payload.firstName, payload.lastName),
      timestamp: new Date().toISOString()
    };

    const response = await fetch(buildGoogleUrl({ action: "claimSlot" }), {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify({ eventId, slotId, signup })
    });

    if (!response.ok) throw new Error("Unable to save signup");

    const resultText = await response.text();
    let result;
    try {
      result = JSON.parse(resultText);
    } catch {
      result = {};
    }

    if (!result.ok) throw new Error(result.error || "Unable to save signup");

    setActionStatus("Thanks for volunteering! Your signup was saved.", "ok");
    return;
  }

  const events = await loadEvents({ admin: true });
  const event = events.find((item) => item.id === eventId);
  if (!event) return;

  const slot = event.slots.find((item) => item.id === slotId);
  if (!slot || slot.claimedBy.length >= slot.count) return;

  slot.claimedBy.push({
    id: uid(),
    firstName: payload.firstName.trim(),
    lastName: payload.lastName.trim(),
    email: payload.email.trim(),
    phone: payload.phone.trim(),
    notes: payload.notes.trim(),
    publicName: publicDisplayName(payload.firstName, payload.lastName)
  });

  await saveEvents(events);
  setActionStatus("Thanks for volunteering! Your signup was saved.", "ok");
}


async function removeEvent(eventId) {
  ensureOnline();

  const events = await loadEvents({ admin: true });
  const updated = events.filter((event) => event.id !== eventId);
  await saveEvents(updated);
  setActionStatus("Event removed.", "info");
}

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

    event.slots.forEach((slot) => {
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
          const formData = new FormData(e.currentTarget);
          await claimSlot(event.id, slot.id, {
            firstName: String(formData.get("firstName") || ""),
            lastName: String(formData.get("lastName") || ""),
            email: String(formData.get("email") || ""),
            phone: String(formData.get("phone") || ""),
            notes: String(formData.get("notes") || "")
          });
          await renderPublicSignupPage();
        } catch {
          handleApiOffline();
          setActionStatus("Could not save signup because shared storage is offline.", "error");
          showOfflineMessage(container);
        }
      });

      slotsWrap.appendChild(slotNode);
    });

    container.appendChild(wrapper);
  });
}

async function renderAdminPage() {
  const adminContainer = document.getElementById("admin-event-list");
  if (!adminContainer) return;

  if (!isApiOnline) {
    showOfflineMessage(adminContainer);
    return;
  }
  const events = (await loadEvents({ admin: true })).sort((a, b) => a.date.localeCompare(b.date));
  adminContainer.innerHTML = "";

  if (!events.length) {
    adminContainer.innerHTML = `<p class="empty">No events yet. Create one to get started.</p>`;
    return;
  }

  events.forEach((event) => {
    const wrapper = document.createElement("article");
    wrapper.className = "event";

    const slotsHtml = event.slots
      .map((slot) => {
        const rows = slot.claimedBy
          .map(
            (person) => `
              <tr>
                <td>${person.publicName}</td>
                <td>${person.firstName} ${person.lastName}</td>
                <td>${person.email}</td>
                <td>${person.phone}</td>
                <td>${person.notes || "-"}</td>
              </tr>
            `
          )
          .join("");

        return `
          <div class="admin-slot">
            <h4>${slot.name} <small>(${slot.claimedBy.length}/${slot.count})</small></h4>
            ${
              slot.claimedBy.length
                ? `<div class="table-wrap"><table>
                    <thead>
                      <tr>
                        <th>Public name</th>
                        <th>Full name</th>
                        <th>Email</th>
                        <th>Phone</th>
                        <th>Notes</th>
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
        await removeEvent(event.id);
        await renderAdminPage();
      } catch {
        handleApiOffline();
        showOfflineMessage(adminContainer);
      }
    });

    adminContainer.appendChild(wrapper);
  });
}

function initCreatePage() {
  const eventForm = document.getElementById("event-form");
  const slotInputs = document.getElementById("slot-inputs");
  const slotTemplate = document.getElementById("slot-template");
  const addSlotButton = document.getElementById("add-slot");
  const tokenInput = document.getElementById("admin-token");
  const saveTokenButton = document.getElementById("save-admin-token");

  if (tokenInput) {
    tokenInput.value = getAdminToken();
  }
  if (saveTokenButton && tokenInput) {
    saveTokenButton.addEventListener("click", async () => {
      const token = tokenInput.value.trim();
      if (!token) return;

      setAdminToken(token);
      setActionStatus("Admin token saved for this browser session.", "ok");

      // Re-verify shared storage with admin access
      try {
        await loadEvents({ admin: true });
        isApiOnline = true;
        setSyncStatus(`Shared storage online (${storageLabel}).`, "ok");
        await renderAdminPage();
      } catch {
        handleApiOffline();
        setSyncStatus("Admin token saved, but could not verify admin access.", "error");
      }
    });
  }


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
      ensureOnline();
      const events = await loadEvents({ admin: true });
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
      setActionStatus("Could not create event because shared storage is offline. Reconnect Google Sheets and redeploy the Apps Script web app.", "error");
      showOfflineMessage(document.getElementById("admin-event-list"));
    }
  });

  createSlotInput(slotInputs, slotTemplate, "Example: Snack table", 2);
  createSlotInput(slotInputs, slotTemplate, "Example: Cleanup", 1);
}

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
