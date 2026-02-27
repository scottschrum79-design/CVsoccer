function uid() {
  return Math.random().toString(36).slice(2, 10);
}

function setSyncStatus(message, type = "info") {
  const banner = document.getElementById("sync-status");
  if (!banner) return;
  banner.textContent = message;
  banner.dataset.type = type;
}

async function loadEvents() {
  const response = await fetch("/api/events", { cache: "no-store" });
  if (!response.ok) throw new Error("Unable to load events");
  const payload = await response.json();
  return Array.isArray(payload.events) ? payload.events : [];
}

async function saveEvents(events) {
  const response = await fetch("/api/events", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ events })
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
  const events = await loadEvents();
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
}

async function removeEvent(eventId) {
  const events = await loadEvents();
  const updated = events.filter((event) => event.id !== eventId);
  await saveEvents(updated);
}

async function renderPublicSignupPage() {
  const container = document.getElementById("public-event-list");
  if (!container) return;

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
        const formData = new FormData(e.currentTarget);
        await claimSlot(event.id, slot.id, {
          firstName: String(formData.get("firstName") || ""),
          lastName: String(formData.get("lastName") || ""),
          email: String(formData.get("email") || ""),
          phone: String(formData.get("phone") || ""),
          notes: String(formData.get("notes") || "")
        });
        await renderPublicSignupPage();
      });

      slotsWrap.appendChild(slotNode);
    });

    container.appendChild(wrapper);
  });
}

async function renderAdminPage() {
  const adminContainer = document.getElementById("admin-event-list");
  if (!adminContainer) return;

  const events = (await loadEvents()).sort((a, b) => a.date.localeCompare(b.date));
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
      await removeEvent(event.id);
      await renderAdminPage();
    });

    adminContainer.appendChild(wrapper);
  });
}

function initCreatePage() {
  const eventForm = document.getElementById("event-form");
  const slotInputs = document.getElementById("slot-inputs");
  const slotTemplate = document.getElementById("slot-template");
  const addSlotButton = document.getElementById("add-slot");

  if (!eventForm || !slotInputs || !slotTemplate || !addSlotButton) return;

  addSlotButton.addEventListener("click", () => createSlotInput(slotInputs, slotTemplate));

  eventForm.addEventListener("submit", async (e) => {
    e.preventDefault();

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

    const events = await loadEvents();
    events.push({ id: uid(), title, description, date, slots });
    await saveEvents(events);

    eventForm.reset();
    slotInputs.innerHTML = "";
    createSlotInput(slotInputs, slotTemplate, "Example: Snack table", 2);
    createSlotInput(slotInputs, slotTemplate, "Example: Cleanup", 1);
    await renderAdminPage();
  });

  createSlotInput(slotInputs, slotTemplate, "Example: Snack table", 2);
  createSlotInput(slotInputs, slotTemplate, "Example: Cleanup", 1);
  renderAdminPage();
}

async function init() {
  try {
    await loadEvents();
    setSyncStatus("Shared storage connected. Events and signups are visible to all users.", "ok");
  } catch {
    setSyncStatus("Server offline. Run `npm start` so all users can share the same data.", "error");
  }

  const currentPage = document.body.dataset.page;

  if (currentPage === "create") {
    try {
      await renderAdminPage();
      initCreatePage();
    } catch {
      // status already set above
    }
    return;
  }

  try {
    await renderPublicSignupPage();
  } catch {
    // status already set above
  }
}

init();
