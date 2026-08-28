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
                    shirtSize: person.shirtSize || "",
                    handbookAccess: person.handbookAccess || "N",
                    notes: person.notes || ""
                });
            });
        });
    });

    return rows;
}

function buildExcelReport(rows) {
    if (typeof XLSX === "undefined") {
        throw new Error("Excel report library did not load");
    }

    const headers = [
        "Event",
        "Date",
        "Role",
        "Public Name",
        "First Name",
        "Last Name",
        "Email",
        "Phone",
        "Shirt Size",
        "Soccer Handbook Access",
        "Notes"
    ];

    const data = rows.map((row) => [
        row.eventTitle,
        row.eventDate,
        row.role,
        row.publicName,
        row.firstName,
        row.lastName,
        row.email,
        row.phone,
        row.shirtSize,
        row.handbookAccess,
        row.notes
    ]);

    const worksheet = XLSX.utils.aoa_to_sheet([headers, ...data]);
    worksheet["!cols"] = [
        { wch: 24 },
        { wch: 12 },
        { wch: 20 },
        { wch: 20 },
        { wch: 16 },
        { wch: 18 },
        { wch: 30 },
        { wch: 18 },
        { wch: 12 },
        { wch: 24 },
        { wch: 40 }
    ];
    worksheet["!autofilter"] = { ref: worksheet["!ref"] };

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Coaches");
    return workbook;
}

function downloadReport(workbook) {
    const today = new Date().toISOString().slice(0, 10);
    XLSX.writeFile(workbook, `cv-soccer-coach-report-${today}.xlsx`, {
        bookType: "xlsx",
        compression: true
    });
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
