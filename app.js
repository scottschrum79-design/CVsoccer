const STORAGE_KEY = "teamsignups-events";

const eventForm = document.getElementById("event-form");
const eventList = document.getElementById("event-list");
const slotInputs = document.getElementById("slot-inputs");
const slotTemplate = document.getElementById("slot-template");
const addSlotButton = document.getElementById("add-slot");

function uid() {
  return Math.random().toString(36).slice(2, 10);
}

function loadEvents() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY)) || [];
  } catch {
    return [];
  }
}

function saveEvents(events) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(events));
}

function addSlotInput(defaultName = "", defaultCount = 1) {
  const fragment = slotTemplate.content.cloneNode(true);
  const row = fragment.querySelector(".slot-row");
  const label = row.querySelector(".slot-label");
  const count = row.querySelector(".slot-count");
  const remove = row.querySelector(".remove-slot");

  label.value = defaultName;
  count.value = defaultCount;

  remove.addEventListener("click", () => {
    row.remove();
  });

  slotInputs.appendChild(row);
}

function formatDate(rawDate) {
  const date = new Date(`${rawDate}T00:00:00`);
  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric"
  });
}

function claimSlot(eventId, slotId, name) {
  if (!name.trim()) return;

  const events = loadEvents();
  const event = events.find((item) => item.id === eventId);
  if (!event) return;

  const slot = event.slots.find((item) => item.id === slotId);
  if (!slot || slot.claimedBy.length >= slot.count) return;

  slot.claimedBy.push(name.trim());
  saveEvents(events);
  renderEvents();
}

function renderEvents() {
  const events = loadEvents().sort((a, b) => a.date.localeCompare(b.date));
  eventList.innerHTML = "";

  if (!events.length) {
    eventList.innerHTML = `<p class="empty">No events yet. Create one on the left.</p>`;
    return;
  }

  events.forEach((event) => {
    const wrapper = document.createElement("article");
    wrapper.className = "event";

    const slots = event.slots
      .map((slot) => {
        const remaining = slot.count - slot.claimedBy.length;

        return `
          <div class="slot">
            <div>
              <strong>${slot.name}</strong><br />
              <small>${slot.claimedBy.length}/${slot.count} filled</small>
              ${slot.claimedBy.length ? `<small><br />Volunteers: ${slot.claimedBy.join(", ")}</small>` : ""}
            </div>
            <form class="inline" data-event-id="${event.id}" data-slot-id="${slot.id}">
              <input placeholder="Your name" ${remaining <= 0 ? "disabled" : "required"} />
              <button ${remaining <= 0 ? "disabled" : ""}>${remaining <= 0 ? "Full" : "Sign up"}</button>
            </form>
          </div>
        `;
      })
      .join("");

    wrapper.innerHTML = `
      <h3>${event.title}</h3>
      <div class="event-meta">${formatDate(event.date)}</div>
      <p>${event.description || "No description provided."}</p>
      ${slots}
    `;

    wrapper.querySelectorAll("form.inline").forEach((form) => {
      form.addEventListener("submit", (e) => {
        e.preventDefault();
        const name = form.querySelector("input").value;
        const { eventId, slotId } = form.dataset;
        claimSlot(eventId, slotId, name);
      });
    });

    eventList.appendChild(wrapper);
  });
}

addSlotButton.addEventListener("click", () => addSlotInput());

eventForm.addEventListener("submit", (e) => {
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

  if (!title || !date || !slots.length) {
    return;
  }

  const events = loadEvents();
  events.push({ id: uid(), title, description, date, slots });
  saveEvents(events);

  eventForm.reset();
  slotInputs.innerHTML = "";
  addSlotInput("Example: Snack table", 2);
  addSlotInput("Example: Cleanup", 1);

  renderEvents();
});

addSlotInput("Example: Snack table", 2);
addSlotInput("Example: Cleanup", 1);
renderEvents();