import nodemailer, { type Transporter } from "nodemailer";

const GMAIL_USER = process.env.GMAIL_USER?.trim();
const GMAIL_APP_PASSWORD = process.env.GMAIL_APP_PASSWORD?.trim();
const OWNER_EMAIL = process.env.OWNER_EMAIL?.trim();

function missingVars(): string[] {
  const missing: string[] = [];
  if (!GMAIL_USER) missing.push("GMAIL_USER");
  if (!GMAIL_APP_PASSWORD) missing.push("GMAIL_APP_PASSWORD");
  if (!OWNER_EMAIL) missing.push("OWNER_EMAIL");
  return missing;
}

let transporter: Transporter | null = null;

function getTransporter(): Transporter | null {
  if (!GMAIL_USER || !GMAIL_APP_PASSWORD || !OWNER_EMAIL) return null;
  if (transporter) return transporter;
  transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: GMAIL_USER,
      pass: GMAIL_APP_PASSWORD,
    },
  });
  return transporter;
}

export function logEmailStatus(): void {
  const missing = missingVars();
  if (missing.length === 0) {
    console.log(
      `[email] Email notifications: enabled (from=${GMAIL_USER}, to=${OWNER_EMAIL})`,
    );
  } else {
    console.log(
      `[email] Email notifications: disabled (missing ${missing.join(", ")})`,
    );
  }
}

export interface NewOrderEmailPayload {
  customerName: string;
  customerCompany?: string | null;
  salesPersonName: string;
  productName: string;
  sizeName?: string | null;
  quantity: number;
  unitPrice: string;
  discount: string;
  totalAmount: string;
  note?: string | null;
  createdAt: Date;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function formatDateBs(date: Date): string {
  try {
    return new Intl.DateTimeFormat("bs-BA", {
      dateStyle: "short",
      timeStyle: "short",
    }).format(date);
  } catch {
    return date.toISOString();
  }
}

function buildSubject(p: NewOrderEmailPayload): string {
  const customer = p.customerCompany
    ? `${p.customerName} (${p.customerCompany})`
    : p.customerName;
  return `Nova narudžba — ${customer} — ${p.totalAmount} KM`;
}

function buildText(p: NewOrderEmailPayload): string {
  const lines = [
    "Nova narudžba je kreirana u Magic Shop sistemu.",
    "",
    `Kupac:          ${p.customerName}${p.customerCompany ? ` (${p.customerCompany})` : ""}`,
    `Komercijalista: ${p.salesPersonName}`,
    `Datum:          ${formatDateBs(p.createdAt)}`,
    "",
    "Stavka:",
    `  Artikal:   ${p.productName}${p.sizeName ? ` (veličina ${p.sizeName})` : ""}`,
    `  Količina:  ${p.quantity}`,
    `  Cijena:    ${p.unitPrice} KM`,
    `  Rabat:     ${p.discount}%`,
    `  Ukupno:    ${p.totalAmount} KM`,
  ];
  if (p.note && p.note.trim()) {
    lines.push("", `Napomena: ${p.note.trim()}`);
  }
  return lines.join("\n");
}

function buildHtml(p: NewOrderEmailPayload): string {
  const customer = p.customerCompany
    ? `${escapeHtml(p.customerName)} <span style="color:#666">(${escapeHtml(p.customerCompany)})</span>`
    : escapeHtml(p.customerName);
  const sizeRow = p.sizeName
    ? `<tr><td style="padding:4px 8px;color:#666">Veličina</td><td style="padding:4px 8px"><b>${escapeHtml(p.sizeName)}</b></td></tr>`
    : "";
  const noteBlock =
    p.note && p.note.trim()
      ? `<p style="margin:16px 0 0;padding:12px;background:#f6f6f6;border-radius:4px"><b>Napomena:</b><br>${escapeHtml(p.note.trim()).replace(/\n/g, "<br>")}</p>`
      : "";
  return `<!DOCTYPE html>
<html lang="bs">
<body style="font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#222;background:#fff;padding:16px">
  <h2 style="margin:0 0 12px">Nova narudžba</h2>
  <p style="margin:0 0 16px;color:#444">Kreirana u Magic Shop sistemu.</p>
  <table style="border-collapse:collapse;font-size:14px;margin-bottom:16px">
    <tr><td style="padding:4px 8px;color:#666">Kupac</td><td style="padding:4px 8px">${customer}</td></tr>
    <tr><td style="padding:4px 8px;color:#666">Komercijalista</td><td style="padding:4px 8px">${escapeHtml(p.salesPersonName)}</td></tr>
    <tr><td style="padding:4px 8px;color:#666">Datum</td><td style="padding:4px 8px">${escapeHtml(formatDateBs(p.createdAt))}</td></tr>
  </table>
  <table style="border-collapse:collapse;font-size:14px;border:1px solid #e5e5e5;border-radius:4px;overflow:hidden">
    <tr><td style="padding:4px 8px;color:#666">Artikal</td><td style="padding:4px 8px"><b>${escapeHtml(p.productName)}</b></td></tr>
    ${sizeRow}
    <tr><td style="padding:4px 8px;color:#666">Količina</td><td style="padding:4px 8px">${p.quantity}</td></tr>
    <tr><td style="padding:4px 8px;color:#666">Cijena</td><td style="padding:4px 8px">${escapeHtml(p.unitPrice)} KM</td></tr>
    <tr><td style="padding:4px 8px;color:#666">Rabat</td><td style="padding:4px 8px">${escapeHtml(p.discount)}%</td></tr>
    <tr><td style="padding:4px 8px;color:#666">Ukupno</td><td style="padding:4px 8px"><b>${escapeHtml(p.totalAmount)} KM</b></td></tr>
  </table>
  ${noteBlock}
</body>
</html>`;
}

export async function sendNewOrderEmail(
  payload: NewOrderEmailPayload,
): Promise<void> {
  try {
    const tx = getTransporter();
    if (!tx) {
      return;
    }
    await tx.sendMail({
      from: `"Magic Shop" <${GMAIL_USER}>`,
      to: OWNER_EMAIL,
      subject: buildSubject(payload),
      text: buildText(payload),
      html: buildHtml(payload),
    });
  } catch (err) {
    console.error("[email] Failed to send new order notification:", err);
  }
}
