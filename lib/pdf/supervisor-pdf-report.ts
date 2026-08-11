export interface SupervisorExportData {
  supervisorName: string;
  supervisorEmail?: string;
  interestTags: string[];
  supervisees: {
    name: string;
    email: string;
    assigned: string;
    statement: string;
  }[];
}

export async function generateSupervisorPDFReport(data: SupervisorExportData) {
  const { jsPDF } = await import("jspdf");
  const autoTable = (await import("jspdf-autotable")).default;

  const doc = new jsPDF({ orientation: "portrait", unit: "pt", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const marginL = 50;
  const marginR = pageW - 50;

  const localTimestamp = new Date().toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });

  const interests = data.interestTags.length > 0 ? data.interestTags.join(", ") : "General Supervision";

  // Header
  doc.setFontSize(8);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(0);
  doc.text("STUDENT SUPERVISION APPLICATION — SUPERVISOR REPORT", marginL, 45);

  doc.setDrawColor(0);
  doc.setLineWidth(1.5);
  doc.line(marginL, 52, marginR, 52);

  doc.setFontSize(16);
  doc.setFont("helvetica", "bold");
  doc.text("Supervision Allocation Report", marginL, 76);

  doc.setLineWidth(0.5);
  doc.line(marginL, 84, marginR, 84);

  // Metadata Block
  const metaStartY = 100;
  const lineH = 16;
  doc.setFontSize(9);
  doc.setFont("helvetica", "bold");
  doc.text("Supervisor Name:", marginL, metaStartY);
  if (data.supervisorEmail) {
    doc.text("Supervisor Email:", marginL, metaStartY + lineH);
  }
  doc.text("Areas of Interest:", marginL, metaStartY + (data.supervisorEmail ? lineH * 2 : lineH));
  doc.text("Date Generated:", marginL, metaStartY + (data.supervisorEmail ? lineH * 3 : lineH * 2));
  doc.text("Assigned Supervisees:", marginL, metaStartY + (data.supervisorEmail ? lineH * 4 : lineH * 3));

  doc.setFont("helvetica", "normal");
  doc.text(data.supervisorName, marginL + 120, metaStartY);
  if (data.supervisorEmail) {
    doc.text(data.supervisorEmail, marginL + 120, metaStartY + lineH);
  }

  const interestOffset = data.supervisorEmail ? lineH * 2 : lineH;
  const interestLines = doc.splitTextToSize(interests, marginR - marginL - 125);
  doc.text(interestLines, marginL + 120, metaStartY + interestOffset);
  const interestHeight = (interestLines.length - 1) * 12;

  doc.text(localTimestamp, marginL + 120, metaStartY + interestOffset + lineH + interestHeight);
  doc.text(String(data.supervisees.length), marginL + 120, metaStartY + interestOffset + lineH * 2 + interestHeight);

  const tableStartY = metaStartY + interestOffset + lineH * 3 + interestHeight + 10;

  doc.setLineWidth(0.5);
  doc.line(marginL, tableStartY - 6, marginR, tableStartY - 6);

  if (data.supervisees.length === 0) {
    doc.setFontSize(9);
    doc.setFont("helvetica", "italic");
    doc.text("No allocated supervisees currently assigned.", marginL, tableStartY + 15);
  } else {
    autoTable(doc, {
      startY: tableStartY,
      margin: { left: marginL, right: 50 },
      head: [["#", "Student Name", "Student Email", "Assigned Date", "Statement of Interest"]],
      body: data.supervisees.map((st, i) => [
        String(i + 1),
        st.name,
        st.email,
        st.assigned,
        st.statement || "(no statement provided)",
      ]),
      headStyles: {
        fillColor: [30, 41, 59] as any,
        textColor: 255,
        fontStyle: "bold",
        fontSize: 8.5,
      },
      bodyStyles: {
        textColor: 0,
        fontSize: 8.5,
        cellPadding: 5,
      },
      alternateRowStyles: {
        fillColor: [245, 247, 250] as any,
      },
      columnStyles: {
        0: { cellWidth: 22, halign: "center" },
        1: { cellWidth: 95 },
        2: { cellWidth: 125 },
        3: { cellWidth: 65, halign: "center" },
        4: { cellWidth: "auto" },
      },
    });
  }

  // Page Footer Pass
  const totalPages = doc.getNumberOfPages();
  for (let pg = 1; pg <= totalPages; pg++) {
    doc.setPage(pg);
    doc.setDrawColor(0);
    doc.setLineWidth(0.5);
    doc.line(marginL, pageH - 38, marginR, pageH - 38);

    doc.setFontSize(7.5);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(80);

    doc.text("Student Supervision Application — Supervisor Report", marginL, pageH - 24);
    doc.text(`Page ${pg} of ${totalPages}`, pageW / 2, pageH - 24, { align: "center" });

    doc.setTextColor(0);
  }

  doc.save(`supervisor-report-${new Date().toISOString().slice(0, 10)}.pdf`);
}
