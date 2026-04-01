import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';

export const generateInvoicePdf = async (invoice, business) => {
  const cur = business.meta?.currency || 'PKR';
  const bizName = business.meta?.name || 'My Business';
  const logo = business.meta?.logo || null;

  const lineRows = (invoice.lines || []).map(line => {
    const qty = parseFloat(line.qty) || 0;
    const rate = parseFloat(line.rate) || 0;
    const amount = qty * rate;
    return `
      <tr>
        <td>${line.description || ''}</td>
        <td style="text-align:center">${qty}</td>
        <td style="text-align:right">${cur} ${rate.toLocaleString()}</td>
        <td style="text-align:right"><strong>${cur} ${amount.toLocaleString()}</strong></td>
      </tr>
    `;
  }).join('');

  const total = invoice.total || 0;
  const paid = invoice.amountPaid || 0;
  const balance = total - paid;

  const statusColor =
    balance <= 0 ? '#16A34A' :
    paid > 0 ? '#D97706' : '#DC2626';

  const statusLabel =
    balance <= 0 ? 'PAID' :
    paid > 0 ? 'PARTIALLY PAID' : 'PAYMENT DUE';

  const logoHtml = logo
    ? `<img src="${logo}" style="height:60px;object-fit:contain;" />`
    : `<div style="width:60px;height:60px;background:#0077C5;border-radius:12px;display:flex;align-items:center;justify-content:center;">
        <span style="color:#fff;font-size:24px;font-weight:700;">
          ${bizName[0]?.toUpperCase() || 'B'}
        </span>
       </div>`;

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, Helvetica, Arial, sans-serif;
      font-size: 13px;
      color: #1a1a2e;
      background: #fff;
      padding: 40px;
    }
    .header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      margin-bottom: 36px;
      padding-bottom: 24px;
      border-bottom: 2px solid #0077C5;
    }
    .biz-info { display: flex; align-items: center; gap: 14px; }
    .biz-name { font-size: 22px; font-weight: 700; color: #0077C5; }
    .invoice-title { text-align: right; }
    .invoice-title h1 {
      font-size: 28px;
      font-weight: 700;
      color: #0077C5;
      letter-spacing: 2px;
    }
    .invoice-num { font-size: 15px; color: #6B7280; margin-top: 4px; }
    .status-badge {
      display: inline-block;
      padding: 4px 14px;
      border-radius: 20px;
      font-size: 12px;
      font-weight: 700;
      letter-spacing: 1px;
      margin-top: 8px;
      color: ${statusColor};
      border: 2px solid ${statusColor};
    }
    .info-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 24px;
      margin-bottom: 32px;
    }
    .info-box { background: #F5F7FA; border-radius: 10px; padding: 16px; }
    .info-label {
      font-size: 10px;
      font-weight: 700;
      color: #6B7280;
      text-transform: uppercase;
      letter-spacing: 0.8px;
      margin-bottom: 6px;
    }
    .info-value { font-size: 15px; font-weight: 600; color: #1a1a2e; }
    .info-sub { font-size: 12px; color: #6B7280; margin-top: 3px; }
    table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 24px;
    }
    thead tr {
      background: #0077C5;
      color: #fff;
    }
    thead th {
      padding: 12px 14px;
      text-align: left;
      font-size: 12px;
      font-weight: 600;
      letter-spacing: 0.5px;
    }
    tbody tr { border-bottom: 1px solid #E5E7EB; }
    tbody tr:nth-child(even) { background: #F9FAFB; }
    tbody td { padding: 12px 14px; font-size: 13px; }
    .totals {
      display: flex;
      justify-content: flex-end;
      margin-bottom: 32px;
    }
    .totals-box { width: 280px; }
    .totals-row {
      display: flex;
      justify-content: space-between;
      padding: 8px 0;
      border-bottom: 1px solid #E5E7EB;
      font-size: 13px;
    }
    .totals-row.grand {
      font-size: 16px;
      font-weight: 700;
      color: #0077C5;
      border-bottom: 2px solid #0077C5;
      padding: 12px 0;
    }
    .totals-row.balance {
      font-size: 15px;
      font-weight: 700;
      color: ${statusColor};
    }
    .notes-box {
      background: #F5F7FA;
      border-radius: 10px;
      padding: 16px;
      margin-bottom: 32px;
    }
    .notes-label {
      font-size: 10px;
      font-weight: 700;
      color: #6B7280;
      text-transform: uppercase;
      letter-spacing: 0.8px;
      margin-bottom: 6px;
    }
    .footer {
      text-align: center;
      color: #9CA3AF;
      font-size: 11px;
      padding-top: 20px;
      border-top: 1px solid #E5E7EB;
    }
    .footer strong { color: #0077C5; }
  </style>
</head>
<body>

  <div class="header">
    <div class="biz-info">
      ${logoHtml}
      <div>
        <div class="biz-name">${bizName}</div>
      </div>
    </div>
    <div class="invoice-title">
      <h1>INVOICE</h1>
      <div class="invoice-num">#INV-${invoice.number || invoice.id?.slice(-4) || '0001'}</div>
      <div class="status-badge">${statusLabel}</div>
    </div>
  </div>

  <div class="info-grid">
    <div class="info-box">
      <div class="info-label">Bill To</div>
      <div class="info-value">${invoice.customerName || '—'}</div>
    </div>
    <div class="info-box">
      <div class="info-label">Invoice Details</div>
      <div class="info-value">Date: ${invoice.date ? new Date(invoice.date).toLocaleDateString('en-GB') : '—'}</div>
      ${invoice.dueDate ? `<div class="info-sub">Due: ${new Date(invoice.dueDate).toLocaleDateString('en-GB')}</div>` : ''}
    </div>
  </div>

  <table>
    <thead>
      <tr>
        <th style="width:45%">Description</th>
        <th style="text-align:center;width:10%">Qty</th>
        <th style="text-align:right;width:20%">Rate</th>
        <th style="text-align:right;width:25%">Amount</th>
      </tr>
    </thead>
    <tbody>
      ${lineRows}
    </tbody>
  </table>

  <div class="totals">
    <div class="totals-box">
      <div class="totals-row grand">
        <span>Total</span>
        <span>${cur} ${total.toLocaleString()}</span>
      </div>
      ${paid > 0 ? `
      <div class="totals-row">
        <span>Amount Paid</span>
        <span style="color:#16A34A">− ${cur} ${paid.toLocaleString()}</span>
      </div>` : ''}
      <div class="totals-row balance">
        <span>Balance Due</span>
        <span>${cur} ${balance.toLocaleString()}</span>
      </div>
    </div>
  </div>

  ${invoice.notes ? `
  <div class="notes-box">
    <div class="notes-label">Notes</div>
    <div>${invoice.notes}</div>
  </div>` : ''}

  <div class="footer">
    Generated by <strong>SmartBiz</strong> · Your pocket accountant
  </div>

</body>
</html>
  `;

  const { uri } = await Print.printToFileAsync({ html, base64: false });

  const fileName = `Invoice_${invoice.customerName?.replace(/\s+/g, '_') || 'Invoice'}_${
    invoice.number || invoice.id?.slice(-4)
  }.pdf`;

  await Sharing.shareAsync(uri, {
    mimeType: 'application/pdf',
    dialogTitle: `Share Invoice ${fileName}`,
    UTI: 'com.adobe.pdf',
  });
};