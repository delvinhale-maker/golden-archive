import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

export interface AuditExportRow {
  occurredAt: string;
  passportCode: string;
  agentName: string;
  actionKey: string;
  target: string | null;
  decision: string;
  reason: string;
  approvalStatus: string | null;
  approvedBy: string | null;
  receiptCode: string | null;
  evidenceLevel: string | null;
  executionStatus: string | null;
}

const CSV_HEADERS: (keyof AuditExportRow)[] = [
  "occurredAt",
  "passportCode",
  "agentName",
  "actionKey",
  "target",
  "decision",
  "reason",
  "approvalStatus",
  "approvedBy",
  "receiptCode",
  "evidenceLevel",
  "executionStatus",
];

function csvCell(value: unknown): string {
  const text = value == null ? "" : String(value);
  return `"${text.replaceAll('"', '""')}"`;
}

export function generateAuditCsv(rows: AuditExportRow[]): string {
  const header = CSV_HEADERS.map(csvCell).join(",");
  const body = rows.map((row) => CSV_HEADERS.map((key) => csvCell(row[key])).join(","));
  return [header, ...body].join("\n");
}

function safePdfText(value: string, max = 100): string {
  return value.replace(/[\r\n\t]+/g, " ").replace(/[^\x20-\x7E]/g, "?").slice(0, max);
}

export async function generateAuditPdf(input: {
  organizationName: string;
  exportedAt: string;
  filters: string;
  rows: AuditExportRow[];
}): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  const regular = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const navy = rgb(15 / 255, 30 / 255, 53 / 255);
  const gold = rgb(184 / 255, 134 / 255, 11 / 255);
  const margin = 42;
  const width = 612;
  const height = 792;
  const lineHeight = 14;
  let page = pdf.addPage([width, height]);
  let y = height - margin;

  const drawLine = (text: string, size = 9, font = regular) => {
    if (y < margin + 20) {
      page = pdf.addPage([width, height]);
      y = height - margin;
    }
    page.drawText(safePdfText(text, 118), { x: margin, y, size, font, color: navy });
    y -= lineHeight;
  };

  page.drawText("AURUMVAULT", { x: margin, y, size: 11, font: bold, color: gold });
  y -= 20;
  page.drawText("AI Agent Authority Passport - Audit Report", { x: margin, y, size: 18, font: bold, color: navy });
  y -= 24;
  drawLine(`Organization: ${input.organizationName}`, 10, bold);
  drawLine(`Exported: ${input.exportedAt}`);
  drawLine(`Filters: ${input.filters || "All included records"}`);
  y -= 8;

  const counts = input.rows.reduce(
    (acc, row) => {
      const key = row.decision === "ALLOW" || row.decision === "APPROVAL_REQUIRED" || row.decision === "BLOCK" ? row.decision : "OTHER";
      acc[key] += 1;
      return acc;
    },
    { ALLOW: 0, APPROVAL_REQUIRED: 0, BLOCK: 0, OTHER: 0 },
  );
  drawLine("Decision Summary", 12, bold);
  drawLine(`ALLOW: ${counts.ALLOW}    APPROVAL REQUIRED: ${counts.APPROVAL_REQUIRED}    BLOCK: ${counts.BLOCK}`);
  y -= 8;
  drawLine("Audit Ledger", 12, bold);

  for (const row of input.rows) {
    drawLine(`${row.occurredAt} | ${row.passportCode} | ${row.agentName}`, 9, bold);
    drawLine(`Action: ${row.actionKey} | Decision: ${row.decision} | Reason: ${row.reason}`);
    if (row.receiptCode || row.evidenceLevel || row.executionStatus) {
      drawLine(
        `Receipt: ${row.receiptCode ?? "-"} | Evidence: ${row.evidenceLevel ?? "-"} | Execution: ${row.executionStatus ?? "-"}`,
      );
    }
    y -= 5;
  }

  y -= 4;
  drawLine("Evidence labels distinguish declared records from independently confirmed execution. No API keys, webhook secrets, tokens, or raw sensitive payloads are included in this report.", 8);
  return pdf.save();
}
