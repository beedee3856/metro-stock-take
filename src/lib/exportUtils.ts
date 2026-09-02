import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

export function exportToExcel(data: Record<string, unknown>[], fileName: string, sheetName = "Report") {
  const worksheet = XLSX.utils.json_to_sheet(data);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);
  XLSX.writeFile(workbook, `${fileName}.xlsx`);
}

export function exportDetailedPDF(options: {
  title: string;
  stockTakeNumber: string;
  storeName: string;
  date: string;
  status: string;
  preparedBy: string;
  approvedBy?: string;
  summaryMetrics?: { label: string; value: string | number }[];
  columns: string[];
  rows: (string | number)[][];
  fileName: string;
}) {
  const doc = new jsPDF("landscape", "mm", "a4");

  // Header Banner
  doc.setFillColor(30, 41, 59); // Slate-800
  doc.rect(0, 0, 297, 28, "F");

  // Session / report title tag
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(16);
  doc.setFont("helvetica", "bold");
  doc.text(String(options.storeName || "STOCK TAKE REPORT").toUpperCase(), 14, 12);

  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.text("Stock Taking & Inventory Audit Management System", 14, 20);

  // Document Title
  doc.setFontSize(14);
  doc.text(options.title.toUpperCase(), 283, 12, { align: "right" });

  doc.setFontSize(9);
  doc.text(`Ref: ${options.stockTakeNumber}  |  Status: ${options.status}`, 283, 20, { align: "right" });

  // Metadata Panel
  doc.setTextColor(51, 65, 85);
  doc.setFontSize(9);
  doc.setFont("helvetica", "bold");
  doc.text("STORE:", 14, 36);
  doc.setFont("helvetica", "normal");
  doc.text(options.storeName, 32, 36);

  doc.setFont("helvetica", "bold");
  doc.text("AUDIT DATE:", 110, 36);
  doc.setFont("helvetica", "normal");
  doc.text(options.date, 135, 36);

  doc.setFont("helvetica", "bold");
  doc.text("PREPARED BY:", 200, 36);
  doc.setFont("helvetica", "normal");
  doc.text(options.preparedBy, 230, 36);

  let startY = 44;

  // Executive Summary Boxes if provided
  if (options.summaryMetrics && options.summaryMetrics.length > 0) {
    const boxWidth = Math.min(45, (297 - 28) / options.summaryMetrics.length);
    options.summaryMetrics.forEach((m, idx) => {
      const x = 14 + idx * (boxWidth + 4);
      doc.setFillColor(248, 250, 252);
      doc.setDrawColor(226, 232, 240);
      doc.roundedRect(x, startY, boxWidth, 16, 2, 2, "FD");

      doc.setFontSize(7);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(100, 116, 139);
      doc.text(m.label.toUpperCase(), x + 4, startY + 6);

      doc.setFontSize(10);
      doc.setTextColor(15, 23, 42);
      doc.text(String(m.value), x + 4, startY + 12);
    });
    startY += 22;
  }

  // Data Table
  autoTable(doc, {
    startY,
    head: [options.columns],
    body: options.rows,
    theme: "striped",
    headStyles: {
      fillColor: [225, 29, 72], // Rose/Red theme accent
      textColor: [255, 255, 255],
      fontSize: 8,
      fontStyle: "bold",
    },
    bodyStyles: {
      fontSize: 7.5,
      textColor: [30, 41, 59],
    },
    alternateRowStyles: {
      fillColor: [248, 250, 252],
    },
    margin: { left: 14, right: 14 },
  });

  // Sign-Off Section at the end of report
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const finalY = (doc as any).lastAutoTable?.finalY || startY + 40;
  let signY = finalY + 12;

  // Add new page if not enough space for signatures
  if (signY > 170) {
    doc.addPage();
    signY = 25;
  }

  doc.setDrawColor(203, 213, 225);
  doc.setLineWidth(0.5);
  doc.line(14, signY, 283, signY);

  signY += 8;
  doc.setFontSize(9);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(30, 41, 59);
  doc.text("PHYSICAL STOCK AUDIT SIGN-OFF & VERIFICATION", 14, signY);

  signY += 8;
  const colW = (297 - 28 - 20) / 3;

  // 1. Counted By
  doc.setFontSize(8);
  doc.setFont("helvetica", "bold");
  doc.text("COUNTED BY:", 14, signY);
  doc.setFont("helvetica", "normal");
  doc.text("Name: _______________________________", 14, signY + 6);
  doc.text("Signature: __________________________", 14, signY + 12);
  doc.text("Date: _______________________________", 14, signY + 18);

  // 2. Verified By
  const col2X = 14 + colW + 10;
  doc.setFont("helvetica", "bold");
  doc.text("VERIFIED BY (SUPERVISOR):", col2X, signY);
  doc.setFont("helvetica", "normal");
  doc.text("Name: _______________________________", col2X, signY + 6);
  doc.text("Signature: __________________________", col2X, signY + 12);
  doc.text("Date: _______________________________", col2X, signY + 18);

  // 3. Approved By
  const col3X = col2X + colW + 10;
  doc.setFont("helvetica", "bold");
  doc.text("APPROVED BY (STORE MANAGER / AUDITOR):", col3X, signY);
  doc.setFont("helvetica", "normal");
  doc.text("Name: _______________________________", col3X, signY + 6);
  doc.text("Signature: __________________________", col3X, signY + 12);
  doc.text("Date: _______________________________", col3X, signY + 18);

  // Page Numbers
  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setFontSize(7);
    doc.setTextColor(148, 163, 184);
    doc.text(`Page ${i} of ${totalPages}  |  Metro Stock-Taking System Confidential`, 14, 205);
  }

  doc.save(`${options.fileName}.pdf`);
}
