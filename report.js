function escapeReportCell(value) {
    return String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;");
}

function getReportRows(events) {
    const rows = [];

    events.forEach((event) => {
        (event.slots || []).forEach((slot) => {
            (slot.claimedBy || []).forEach((person) => {
                rows.push({
                    eventTitle: event.title || "",
                    eventDate: event.date || "",
                    role: slot.name || "",
                    publicName: person.publicName || "",
                    firstName: person.firstName || "",
                    lastName: person.lastName || "",
                    email: person.email || "",
                    phone: person.phone || "",
                    notes: person.notes || ""
                });
            });
        });
    });

    return rows;
}

function buildExcelReport(rows) {
    const headers = [
        "Event",
        "Date",
        "Role",
        "Public Name",
        "First Name",
        "Last Name",
        "Email",
        "Phone",
        "Notes"
    ];

    const headerHtml = headers.map((header) => `<th>${escapeReportCell(header)}</th>`).join("");
    const rowHtml = rows
        .map((row) => `
            <tr>
                <td>${escapeReportCell(row.eventTitle)}</td>
                <td>${escapeReportCell(row.eventDate)}</td>
                <td>${escapeReportCell(row.role)}</td>
                <td>${escapeReportCell(row.publicName)}</td>
                <td>${escapeReportCell(row.firstName)}</td>
                <td>${escapeReportCell(row.lastName)}</td>
                <td>${escapeReportCell(row.email)}</td>
                <td>${escapeReportCell(row.phone)}</td>
                <td>${escapeReportCell(row.notes)}</td>
            </tr>
        `)
        .join("");

    return `
        <html>
            <head>
                <meta charset="UTF-8" />
            </head>
            <body>
                <table border="1">
                    <thead><tr>${headerHtml}</tr></thead>
                    <tbody>${rowHtml}</tbody>
                </table>
            </body>
        </html>
    `;
}

function downloadReport(content) {
    const today = new Date().toISOString().slice(0, 10);
    const blob = new Blob([content], { type: "application/vnd.ms-excel;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.href = url;
    link.download = `cv-soccer-coach-report-${today}.xls`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
}

function initReportDownload() {
    const button = document.getElementById("download-report");
    if (!button) return;

    button.addEventListener("click", async () => {
        button.disabled = true;
        const originalText = button.textContent;
        button.textContent = "Building report...";

        try {
            ensureOnline();
            const events = await loadEvents();
            const rows = getReportRows(events);

            if (!rows.length) {
                window.alert("There are no registered coaches to include in the report yet.");
                return;
            }

            downloadReport(buildExcelReport(rows));
        } catch (error) {
            console.error("Report download failed:", error);
            window.alert("Could not download the report because shared storage is offline.");
        } finally {
            button.disabled = false;
            button.textContent = originalText;
        }
    });
}

initReportDownload();
