const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");
const { URL } = require("node:url");

const PORT = process.env.PORT || 8000;
const rootDir = __dirname;
const dataDir = path.join(rootDir, "data");
const jsonDataFile = path.join(dataDir, "events.json");
const csvDataFile = path.join(dataDir, "events.csv");

const mimeTypes = {
  ".html": "text/html; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".csv": "text/csv; charset=utf-8"
};

function ensureStorageFiles() {
  if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

  if (!fs.existsSync(jsonDataFile)) {
    fs.writeFileSync(jsonDataFile, JSON.stringify({ events: [] }, null, 2));
  }

  if (!fs.existsSync(csvDataFile)) {
    fs.writeFileSync(
      csvDataFile,
      "eventId,eventTitle,eventDate,slotId,slotName,slotCapacity,signupId,publicName,firstName,lastName,email,phone,notes\n"
    );
  }
}

function csvCell(value) {
  const text = String(value ?? "");
  return `"${text.replace(/"/g, '""')}"`;
}

function eventsToCsv(events) {
  const header =
    "eventId,eventTitle,eventDate,slotId,slotName,slotCapacity,signupId,publicName,firstName,lastName,email,phone,notes";

  const rows = [];

  events.forEach((event) => {
    (event.slots || []).forEach((slot) => {
      const signups = Array.isArray(slot.claimedBy) ? slot.claimedBy : [];

      if (!signups.length) {
        rows.push(
          [
            event.id,
            event.title,
            event.date,
            slot.id,
            slot.name,
            slot.count,
            "",
            "",
            "",
            "",
            "",
            "",
            ""
          ]
            .map(csvCell)
            .join(",")
        );
        return;
      }

      signups.forEach((signup) => {
        rows.push(
          [
            event.id,
            event.title,
            event.date,
            slot.id,
            slot.name,
            slot.count,
            signup.id,
            signup.publicName,
            signup.firstName,
            signup.lastName,
            signup.email,
            signup.phone,
            signup.notes
          ]
            .map(csvCell)
            .join(",")
        );
      });
    });
  });

  return `${header}\n${rows.join("\n")}${rows.length ? "\n" : ""}`;
}

function readEvents() {
  ensureStorageFiles();
  const raw = fs.readFileSync(jsonDataFile, "utf8");
  const payload = JSON.parse(raw);
  return Array.isArray(payload.events) ? payload.events : [];
}

function writeEvents(events) {
  ensureStorageFiles();
  fs.writeFileSync(jsonDataFile, JSON.stringify({ events }, null, 2));
  fs.writeFileSync(csvDataFile, eventsToCsv(events));
}

function sendJson(res, statusCode, payload) {
  res.writeHead(statusCode, { "Content-Type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(payload));
}

function serveStatic(requestPath, res) {
  const normalized = requestPath === "/" ? "/index.html" : requestPath;
  const resolvedPath = path.normalize(path.join(rootDir, normalized));

  if (!resolvedPath.startsWith(rootDir)) {
    res.writeHead(403);
    res.end("Forbidden");
    return;
  }

  fs.readFile(resolvedPath, (err, content) => {
    if (err) {
      res.writeHead(404);
      res.end("Not found");
      return;
    }

    const ext = path.extname(resolvedPath).toLowerCase();
    res.writeHead(200, {
      "Content-Type": mimeTypes[ext] || "application/octet-stream"
    });
    res.end(content);
  });
}

function handleEventsApi(req, res) {
  if (req.method === "GET") {
    try {
      const events = readEvents();
      sendJson(res, 200, { events });
    } catch {
      sendJson(res, 500, { error: "Failed to load events." });
    }
    return;
  }

  if (req.method === "PUT") {
    let body = "";

    req.on("data", (chunk) => {
      body += chunk;
      if (body.length > 1_000_000) req.destroy();
    });

    req.on("end", () => {
      try {
        const parsed = JSON.parse(body || "{}");
        const events = Array.isArray(parsed.events) ? parsed.events : [];
        writeEvents(events);
        sendJson(res, 200, { ok: true });
      } catch {
        sendJson(res, 400, { error: "Invalid payload." });
      }
    });
    return;
  }

  sendJson(res, 405, { error: "Method not allowed." });
}

function handleEventsCsvApi(req, res) {
  if (req.method !== "GET") {
    sendJson(res, 405, { error: "Method not allowed." });
    return;
  }

  try {
    ensureStorageFiles();
    const csv = fs.readFileSync(csvDataFile, "utf8");
    res.writeHead(200, { "Content-Type": "text/csv; charset=utf-8" });
    res.end(csv);
  } catch {
    sendJson(res, 500, { error: "Failed to load CSV export." });
  }
}

const server = http.createServer((req, res) => {
  const parsedUrl = new URL(req.url, `http://${req.headers.host}`);

  if (parsedUrl.pathname === "/api/events") {
    handleEventsApi(req, res);
    return;
  }

  if (parsedUrl.pathname === "/api/events.csv") {
    handleEventsCsvApi(req, res);
    return;
  }

  serveStatic(parsedUrl.pathname, res);
});

server.listen(PORT, () => {
  console.log(`TeamSignups running on http://localhost:${PORT}`);
});
