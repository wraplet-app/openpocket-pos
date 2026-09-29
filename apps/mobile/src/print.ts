import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system/legacy';
import { format, type Minor } from '@openpocket/pos-core';
import { currencyOf, type Store } from './session';

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

/**
 * A full-page A4 invoice. Fills the sheet on a normal printer (the old 58mm
 * layout rendered as a stamp in the corner of Letter/A4). Prints and exports to
 * PDF from the same HTML so the shared file matches what prints.
 */
export function invoiceHtml(store: Store, r: PrintableReceipt): string {
  const currency = currencyOf(store);
  const m = (v: Minor) => format(v, currency);
  const initials = store.name.trim().split(/\s+/).slice(0, 2).map((w: string) => w[0]?.toUpperCase() ?? '').join('') || '?';
  const date = new Date(r.soldAt);

  const rows = r.lines
    .map((l, i) => {
      const unit = l.quantity ? (Math.round(l.lineTotal / l.quantity) as Minor) : l.lineTotal;
      return `<tr>
        <td class="c">${i + 1}</td>
        <td>${esc(l.name)}</td>
        <td class="c">${l.quantity}</td>
        <td class="r">${esc(m(unit))}</td>
        <td class="r">${esc(m(l.lineTotal))}</td>
      </tr>`;
    })
    .join('');

  const totalRow = (label: string, value: string, cls = '') =>
    `<tr class="${cls}"><td class="tl">${esc(label)}</td><td class="tr">${esc(value)}</td></tr>`;

  const payLine = r.received != null
    ? totalRow(`Paid · ${r.paymentLabel}`, m(r.received)) + (r.change != null ? totalRow('Change', m(r.change)) : '')
    : totalRow(`On account · ${r.paymentLabel}`, m(r.grandTotal));

  const meta = [
    `<div><span>Date</span><b>${esc(date.toLocaleString())}</b></div>`,
    r.staffName ? `<div><span>Served by</span><b>${esc(r.staffName)}</b></div>` : '',
    r.customerName ? `<div><span>Customer</span><b>${esc(r.customerName)}</b></div>` : '',
    `<div><span>Payment</span><b>${esc(r.paymentLabel)}</b></div>`,
  ].join('');

  return `<!doctype html><html><head><meta charset="utf-8"/>
<style>
  @page { size: A4; margin: 18mm 16mm; }
  * { box-sizing: border-box; }
  body { font-family: -apple-system, 'Helvetica Neue', Arial, sans-serif; color: #111827; margin: 0; font-size: 13px; }
  .top { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 3px solid #0ca678; padding-bottom: 16px; }
  .brand { display: flex; align-items: center; gap: 12px; }
  .logo { width: 48px; height: 48px; border-radius: 12px; background: #0ca678; color: #fff; font-weight: 800; font-size: 20px; display: flex; align-items: center; justify-content: center; }
  .store { font-size: 22px; font-weight: 800; }
  .tag { color: #6b7280; font-size: 12px; margin-top: 2px; }
  .doc { text-align: right; }
  .doc .k { font-size: 26px; font-weight: 800; letter-spacing: 1px; color: #0ca678; }
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
  .totals tr.grand td { border-top: 2px solid #111827; padding-top: 12px; font-size: 18px; font-weight: 800; color: #0ca678; }
  .totals tr.pay td { color: #6b7280; }
  .foot { margin-top: 40px; text-align: center; color: #6b7280; border-top: 1px solid #eceff3; padding-top: 16px; }
  .foot .thanks { font-weight: 700; color: #111827; }
  .foot .ppd { font-size: 10px; color: #9ca3af; margin-top: 4px; }
</style></head><body>
  <div class="top">
    <div class="brand">
      <div class="logo">${esc(initials)}</div>
      <div>
        <div class="store">${esc(store.name)}</div>
        <div class="tag">Point of sale · ${esc(currency.code)}</div>
      </div>
    </div>
    <div class="doc">
      <div class="k">INVOICE</div>
      <div class="n">${esc(r.invoiceNo)}</div>
    </div>
  </div>

  <div class="meta">${meta}</div>

  <table class="items">
    <thead><tr><th class="c">#</th><th>Item</th><th class="c">Qty</th><th class="r">Price</th><th class="r">Amount</th></tr></thead>
    <tbody>${rows}</tbody>
  </table>

  <table class="totals">
    ${totalRow('Subtotal', m(r.subtotal))}
    ${r.discountTotal && r.discountTotal > 0 ? totalRow('Discount', `- ${m(r.discountTotal)}`) : ''}
    ${r.taxTotal > 0 ? totalRow('Tax', m(r.taxTotal)) : ''}
    <tr class="grand"><td class="tl">Total</td><td class="tr">${esc(m(r.grandTotal))}</td></tr>
    ${payLine.replace(/<tr>/g, '<tr class="pay">')}
  </table>

  <div class="foot">
    <div class="thanks">Thank you for your business!</div>
    <div class="ppd">Generated by OpenPocket POS · offline-first point of sale</div>
  </div>
</body></html>`;
}

/** Print the invoice through the OS print service (thermal, laser, or Save-as-PDF). */
export async function printInvoice(store: Store, receipt: PrintableReceipt): Promise<void> {
  await Print.printAsync({ html: invoiceHtml(store, receipt) });
}

/** Render the invoice to a real PDF file and open the share sheet with it. */
export async function shareInvoicePdf(store: Store, receipt: PrintableReceipt): Promise<void> {
  const { uri } = await Print.printToFileAsync({ html: invoiceHtml(store, receipt) });
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
