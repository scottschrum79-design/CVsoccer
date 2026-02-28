const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");
const { URL } = require("node:url");

const PORT = process.env.PORT || 8000;
const rootDir = __dirname;
const dataDir = path.join(rootDir, "data");
const dataFile = path.join(dataDir, "events.json");

const mimeTypes = {
  ".html": "text/html; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8"
};

function ensureDataFile() {
  if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
  if (!fs.existsSync(dataFile)) {
    fs.writeFileSync(dataFile, JSON.stringify({ events: [] }, null, 2));
  }
}

function readEvents() {
  ensureDataFile();
  const raw = fs.readFileSync(dataFile, "utf8");
  const payload = JSON.parse(raw);
  return Array.isArray(payload.events) ? payload.events : [];
}

function writeEvents(events) {
  ensureDataFile();
  fs.writeFileSync(dataFile, JSON.stringify({ events }, null, 2));
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

const server = http.createServer((req, res) => {
  const parsedUrl = new URL(req.url, `http://${req.headers.host}`);

  if (parsedUrl.pathname === "/api/events") {
    handleEventsApi(req, res);
    return;
  }

  serveStatic(parsedUrl.pathname, res);
});

server.listen(PORT, () => {
  console.log(`TeamSignups running on http://localhost:${PORT}`);
});
