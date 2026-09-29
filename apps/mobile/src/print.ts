import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system/legacy';
import { format, type Minor } from '@openpocket/pos-core';
import { currencyOf, type Store } from './session';
import { profileOf } from './repos';
import { safeAccent, onAccent, contactLines, shopInitials, DEFAULT_FOOTER, THERMAL_WIDTH_PT } from './branding';

export interface PrintableReceipt {
  invoiceNo: string;
  soldAt: number;
  lines: { name: string; quantity: number; lineTotal: Minor }[];
  subtotal: Minor;
  discountTotal?: Minor;
  taxTotal: Minor;
  grandTotal: Minor;
  paymentLabel: string;
  received?: Minor;
  change?: Minor;
  staffName?: string;   // cashier who rang up the sale
  customerName?: string; // for credit / named-customer sales
}

const esc = (s: string) =>
  s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!));

/** Newlines in the footer/terms boxes become line breaks. */
const multiline = (s: string) => esc(s).replace(/\r?\n/g, '<br/>');

/** Read the shop logo as a data: URI so it prints/exports without file access. */
export async function loadLogoDataUri(store: Store): Promise<string | null> {
  const uri = store.logo_uri;
  if (!uri) return null;
  try {
    const b64 = await FileSystem.readAsStringAsync(uri, { encoding: FileSystem.EncodingType.Base64 });
    const ext = uri.split('.').pop()?.toLowerCase();
    const mime = ext === 'png' ? 'image/png' : ext === 'webp' ? 'image/webp' : 'image/jpeg';
    return `data:${mime};base64,${b64}`;
  } catch { return null; }
}

/**
 * The receipt/invoice for a sale, built from the shop's profile: logo, contact
 * details, tax id, accent color, footer message, terms and paper size are all
 * owner-configurable (More → Shop profile & receipts). A4 renders a full-page
 * invoice; 80 mm / 58 mm render a narrow thermal-roll receipt. Printing and PDF
 * export use the same HTML so the shared file matches what prints.
 */
export function invoiceHtml(store: Store, r: PrintableReceipt, logoDataUri: string | null = null): string {
  const p = profileOf(store);
  const currency = currencyOf(store);
  const m = (v: Minor) => format(v, currency);
  const accent = safeAccent(p.receiptAccent);
  const accentFg = onAccent(accent);
  const date = new Date(r.soldAt);
  const contact = p.showContact ? contactLines(p) : [];
  const thermal = p.receiptPaper !== 'a4';
  const logo = p.showLogo
    ? (logoDataUri ? `<img class="logo" src="${logoDataUri}"/>` : `<div class="logo mono">${esc(shopInitials(p.name))}</div>`)
    : '';
  const footer = p.receiptFooter.trim() || DEFAULT_FOOTER;

  const totalRow = (label: string, value: string, cls = '') =>
    `<tr class="${cls}"><td class="tl">${esc(label)}</td><td class="tr">${esc(value)}</td></tr>`;

  const payLine = r.received != null
    ? totalRow(`Paid · ${r.paymentLabel}`, m(r.received), 'pay') + (r.change != null ? totalRow('Change', m(r.change), 'pay') : '')
    : totalRow(`On account · ${r.paymentLabel}`, m(r.grandTotal), 'pay');

  const totals = `
    ${totalRow('Subtotal', m(r.subtotal))}
    ${r.discountTotal && r.discountTotal > 0 ? totalRow('Discount', `- ${m(r.discountTotal)}`) : ''}
    ${r.taxTotal > 0 ? totalRow('Tax', m(r.taxTotal)) : ''}
    <tr class="grand"><td class="tl">Total</td><td class="tr">${esc(m(r.grandTotal))}</td></tr>
    ${payLine}`;

  const metaItems = [
    ['Date', date.toLocaleString()],
    p.showStaff && r.staffName ? ['Served by', r.staffName] : null,
    r.customerName ? ['Customer', r.customerName] : null,
    ['Payment', r.paymentLabel],
  ].filter(Boolean) as string[][];

  const terms = p.receiptTerms.trim() ? `<div class="terms">${multiline(p.receiptTerms)}</div>` : '';
  const taxId = p.taxId.trim() ? `<div class="taxid">${esc(p.taxId.trim())}</div>` : '';

  if (thermal) {
    const w = p.receiptPaper === 'thermal58' ? '58mm' : '80mm';
    const rows = r.lines.map((l) => `<tr><td class="it">${esc(l.name)}<div class="sub">${l.quantity} × ${esc(m(l.quantity ? (Math.round(l.lineTotal / l.quantity) as Minor) : l.lineTotal))}</div></td><td class="tr">${esc(m(l.lineTotal))}</td></tr>`).join('');
    return `<!doctype html><html><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width"/>
<style>
  @page { size: ${w} auto; margin: 2mm; }
  * { box-sizing: border-box; }
  html { background: #fff; }
  body { width: 100%; margin: 0; background: #fff; font-family: 'Courier New', monospace; color: #000; font-size: ${p.receiptPaper === 'thermal58' ? 10 : 12}px; }
  .c { text-align: center; }
  .logo { display: block; margin: 0 auto 4px; max-width: 46mm; max-height: 22mm; object-fit: contain; }
  .logo.mono { width: 14mm; height: 14mm; line-height: 14mm; border-radius: 3mm; background: ${accent}; color: ${accentFg}; font-weight: 800; font-size: 16px; }
  .store { font-size: 1.35em; font-weight: 800; }
  .tag, .ct, .taxid { font-size: .9em; }
  .rule { border-top: 1px dashed #000; margin: 6px 0; }
  table { width: 100%; border-collapse: collapse; }
  td { padding: 2px 0; vertical-align: top; }
  .tr { text-align: right; white-space: nowrap; padding-left: 6px; }
  .sub { font-size: .85em; color: #333; }
  tr.grand td { border-top: 1px solid #000; padding-top: 4px; font-weight: 800; font-size: 1.2em; }
  .meta div { display: flex; justify-content: space-between; }
  .foot { margin-top: 8px; text-align: center; font-weight: 700; }
  .terms { margin-top: 6px; text-align: center; font-size: .8em; }
</style></head><body>
  <div class="c">
    ${logo}
    <div class="store">${esc(p.name)}</div>
    ${p.tagline.trim() ? `<div class="tag">${esc(p.tagline.trim())}</div>` : ''}
    ${contact.map((c) => `<div class="ct">${esc(c)}</div>`).join('')}
    ${taxId}
  </div>
  <div class="rule"></div>
  <div class="c"><b>INVOICE ${esc(r.invoiceNo)}</b></div>
  <div class="meta">${metaItems.map(([k, v]) => `<div><span>${esc(k!)}</span><span>${esc(v!)}</span></div>`).join('')}</div>
  <div class="rule"></div>
  <table>${rows}</table>
  <div class="rule"></div>
  <table>${totals}</table>
  <div class="rule"></div>
  <div class="foot">${multiline(footer)}</div>
  ${terms}
</body></html>`;
  }

  const rows = r.lines.map((l, i) => {
    const unit = l.quantity ? (Math.round(l.lineTotal / l.quantity) as Minor) : l.lineTotal;
    return `<tr>
        <td class="c">${i + 1}</td>
        <td>${esc(l.name)}</td>
        <td class="c">${l.quantity}</td>
        <td class="r">${esc(m(unit))}</td>
        <td class="r">${esc(m(l.lineTotal))}</td>
      </tr>`;
  }).join('');

  return `<!doctype html><html><head><meta charset="utf-8"/>
<style>
  @page { size: A4; margin: 18mm 16mm; }
  * { box-sizing: border-box; }
  html, body { background: #fff; }
  body { font-family: -apple-system, 'Helvetica Neue', Arial, sans-serif; color: #111827; margin: 0; font-size: 13px; }
  .top { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 3px solid ${accent}; padding-bottom: 16px; }
  .brand { display: flex; align-items: center; gap: 14px; }
  .logo { width: 64px; height: 64px; border-radius: 12px; object-fit: contain; }
  .logo.mono { background: ${accent}; color: ${accentFg}; font-weight: 800; font-size: 24px; display: flex; align-items: center; justify-content: center; }
  .store { font-size: 22px; font-weight: 800; }
  .tag { color: #6b7280; font-size: 12px; margin-top: 2px; }
  .ct { color: #4b5563; font-size: 11.5px; margin-top: 2px; }
  .taxid { color: #4b5563; font-size: 11.5px; margin-top: 2px; font-weight: 600; }
  .doc { text-align: right; }
  .doc .k { font-size: 26px; font-weight: 800; letter-spacing: 1px; color: ${accent}; }
  .doc .n { font-size: 14px; font-weight: 700; margin-top: 2px; }
  .meta { display: flex; flex-wrap: wrap; gap: 10px 40px; margin: 20px 0 8px; }
  .meta div { display: flex; flex-direction: column; }
  .meta span { color: #9ca3af; font-size: 10px; text-transform: uppercase; letter-spacing: 0.6px; }
  .meta b { font-size: 13px; font-weight: 600; margin-top: 2px; }
  table.items { width: 100%; border-collapse: collapse; margin-top: 18px; }
  table.items thead th { background: #f3f4f6; color: #374151; text-align: left; font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px; padding: 10px 12px; }
  table.items td { padding: 11px 12px; border-bottom: 1px solid #eceff3; }
  table.items .c { text-align: center; }
  table.items .r { text-align: right; }
  th.c { text-align: center; } th.r { text-align: right; }
  .totals { width: 46%; margin-left: auto; margin-top: 18px; border-collapse: collapse; }
  .totals td { padding: 7px 0; }
  .totals .tl { color: #6b7280; }
  .totals .tr { text-align: right; font-weight: 600; }
  .totals tr.grand td { border-top: 2px solid #111827; padding-top: 12px; font-size: 18px; font-weight: 800; color: ${accent}; }
  .totals tr.pay td { color: #6b7280; }
  .foot { margin-top: 40px; text-align: center; color: #6b7280; border-top: 1px solid #eceff3; padding-top: 16px; }
  .foot .thanks { font-weight: 700; color: #111827; }
  .terms { margin-top: 10px; font-size: 10.5px; color: #6b7280; line-height: 1.5; }
</style></head><body>
  <div class="top">
    <div class="brand">
      ${logo}
      <div>
        <div class="store">${esc(p.name)}</div>
        ${p.tagline.trim() ? `<div class="tag">${esc(p.tagline.trim())}</div>` : ''}
        ${contact.map((c) => `<div class="ct">${esc(c)}</div>`).join('')}
        ${taxId}
      </div>
    </div>
    <div class="doc">
      <div class="k">INVOICE</div>
      <div class="n">${esc(r.invoiceNo)}</div>
    </div>
  </div>

  <div class="meta">${metaItems.map(([k, v]) => `<div><span>${esc(k!)}</span><b>${esc(v!)}</b></div>`).join('')}</div>

  <table class="items">
    <thead><tr><th class="c">#</th><th>Item</th><th class="c">Qty</th><th class="r">Price</th><th class="r">Amount</th></tr></thead>
    <tbody>${rows}</tbody>
  </table>

  <table class="totals">${totals}</table>

  <div class="foot">
    <div class="thanks">${multiline(footer)}</div>
    ${terms}
  </div>
</body></html>`;
}

/** Page size for expo-print: thermal rolls are narrow; A4 uses the platform default. */
function pageSize(store: Store, lineCount: number): { width?: number; height?: number } {
  const paper = profileOf(store).receiptPaper;
  if (paper === 'a4') return {};
  return { width: THERMAL_WIDTH_PT[paper], height: 320 + lineCount * 34 };
}

/** Print the invoice through the OS print service (thermal, laser, or Save-as-PDF). */
export async function printInvoice(store: Store, receipt: PrintableReceipt): Promise<void> {
  const logo = await loadLogoDataUri(store);
  await Print.printAsync({ html: invoiceHtml(store, receipt, logo), ...pageSize(store, receipt.lines.length) });
}

/** Render the invoice to a real PDF file and open the share sheet with it. */
export async function shareInvoicePdf(store: Store, receipt: PrintableReceipt): Promise<void> {
  const logo = await loadLogoDataUri(store);
  const { uri } = await Print.printToFileAsync({ html: invoiceHtml(store, receipt, logo), ...pageSize(store, receipt.lines.length) });
  // Rename the temp UUID file so recipients get "INV-0008.pdf".
  const safe = receipt.invoiceNo.replace(/[^\w-]/g, '_');
  const named = `${FileSystem.cacheDirectory}${safe}.pdf`;
  let out = uri;
  try { await FileSystem.moveAsync({ from: uri, to: named }); out = named; } catch { /* keep temp name */ }
  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(out, { mimeType: 'application/pdf', dialogTitle: `${safe}.pdf`, UTI: 'com.adobe.pdf' });
  }
}

// Back-compat: existing callers use printReceipt for the print action.
export const printReceipt = printInvoice;
