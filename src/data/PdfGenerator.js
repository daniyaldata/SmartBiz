import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';

const getStatusStyle = (balance, paid) => {
  if (balance <= 0) return { color: '#16A34A', label: 'PAID' };
  if (paid > 0) return { color: '#D97706', label: 'PARTIALLY PAID' };
  return { color: '#DC2626', label: 'PAYMENT DUE' };
};

const buildHtml = ({
  accentColor,
  bizName,
  logoHtml,
  docType,
  docNumber,
  statusColor,
  statusLabel,
  partyLabel,
  partyName,
  date,
  dueDate,
  lineRows,
  cur,
  total,
  paid,
  balance,
  notes,
  extraFields,
}) => `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <style>
    * { margin:0; padding:0; box-sizing:border-box; }
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
      border-bottom: 2px solid ${accentColor};
    }
    .biz-block { display: flex; align-items: center; gap: 14px; }
    .biz-name { font-size: 20px; font-weight: 700; color: ${accentColor}; }
    .doc-block { text-align: right; }
    .doc-type {
      font-size: 26px;
      font-weight: 700;
      color: ${accentColor};
      letter-spacing: 2px;
    }
    .doc-num { font-size: 14px; color: #6B7280; margin-top: 4px; }
    .status-badge {
      display: inline-block;
      padding: 4px 14px;
      border-radius: 20px;
      font-size: 11px;
      font-weight: 700;
      letter-spacing: 1px;
      margin-top: 8px;
      color: ${statusColor};
      border: 2px solid ${statusColor};
    }
    .info-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 16px;
      margin-bottom: 28px;
    }
    .info-box {
      background: #F5F7FA;
      border-radius: 10px;
      padding: 14px;
    }
    .info-label {
      font-size: 10px;
      font-weight: 700;
      color: #6B7280;
      text-transform: uppercase;
      letter-spacing: 0.8px;
      margin-bottom: 5px;
    }
    .info-value { font-size: 14px; font-weight: 600; color: #1a1a2e; }
    .info-sub { font-size: 12px; color: #6B7280; margin-top: 3px; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
    thead tr { background: ${accentColor}; color: #fff; }
    thead th {
      padding: 11px 13px;
      text-align: left;
      font-size: 12px;
      font-weight: 600;
    }
    tbody tr { border-bottom: 1px solid #E5E7EB; }
    tbody tr:nth-child(even) { background: #F9FAFB; }
    tbody td { padding: 11px 13px; font-size: 13px; }
    .totals { display: flex; justify-content: flex-end; margin-bottom: 28px; }
    .totals-box { width: 260px; }
    .totals-row {
      display: flex;
      justify-content: space-between;
      padding: 7px 0;
      border-bottom: 1px solid #E5E7EB;
      font-size: 13px;
    }
    .totals-row.grand {
      font-size: 15px;
      font-weight: 700;
      color: ${accentColor};
      border-bottom: 2px solid ${accentColor};
      padding: 11px 0;
    }
    .totals-row.balance {
      font-size: 14px;
      font-weight: 700;
      color: ${statusColor};
    }
    .notes-box {
      background: #F5F7FA;
      border-radius: 10px;
      padding: 14px;
      margin-bottom: 28px;
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
      padding-top: 18px;
      border-top: 1px solid #E5E7EB;
    }
    .footer strong { color: ${accentColor}; }
  </style>
</head>
<body>

  <div class="header">
    <div class="biz-block">
      ${logoHtml}
      <div class="biz-name">${bizName}</div>
    </div>
    <div class="doc-block">
      <div class="doc-type">${docType}</div>
      <div class="doc-num">#${docNumber}</div>
      ${statusLabel
        ? `<div class="status-badge" style="color:${statusColor};border-color:${statusColor}">
             ${statusLabel}
           </div>`
        : ''}
    </div>
  </div>

  <div class="info-grid">
    <div class="info-box">
      <div class="info-label">${partyLabel}</div>
      <div class="info-value">${partyName || '—'}</div>
    </div>
    <div class="info-box">
      <div class="info-label">Details</div>
      <div class="info-value">Date: ${date}</div>
      ${dueDate ? `<div class="info-sub">Due: ${dueDate}</div>` : ''}
      ${extraFields || ''}
    </div>
  </div>

  ${lineRows ? `
  <table>
    <thead>
      <tr>
        <th style="width:45%">Description</th>
        <th style="text-align:center;width:10%">Qty</th>
        <th style="text-align:right;width:20%">Rate</th>
        <th style="text-align:right;width:25%">Amount</th>
      </tr>
    </thead>
    <tbody>${lineRows}</tbody>
  </table>` : ''}

  <div class="totals">
    <div class="totals-box">
      <div class="totals-row grand">
        <span>Total</span>
        <span>${cur} ${total.toLocaleString()}</span>
      </div>
      ${paid > 0 ? `
      <div class="totals-row">
        <span>Amount Paid</span>
        <span style="color:#16A34A">
          ${docType === 'RECEIPT' || docType === 'PAYMENT' ? '' : '− '}
          ${cur} ${paid.toLocaleString()}
        </span>
      </div>` : ''}
      ${balance !== null ? `
      <div class="totals-row balance">
        <span>Balance Due</span>
        <span>${cur} ${balance.toLocaleString()}</span>
      </div>` : ''}
    </div>
  </div>

  ${notes ? `
  <div class="notes-box">
    <div class="notes-label">Notes</div>
    <div>${notes}</div>
  </div>` : ''}

  <div class="footer">
    Generated by <strong>SmartBiz</strong> · Your pocket accountant
  </div>

</body>
</html>
`;

const shareDocument = async (html, fileName) => {
  const { uri } = await Print.printToFileAsync({ html, base64: false });
  await Sharing.shareAsync(uri, {
    mimeType: 'application/pdf',
    dialogTitle: `Share ${fileName}`,
    UTI: 'com.adobe.pdf',
  });
};

const getLogoHtml = (business) => {
  const bizName = business.meta?.name || 'B';
  const logo = business.meta?.logo || null;
  if (logo) {
    return `<img src="${logo}"
      style="height:56px;width:56px;border-radius:12px;object-fit:contain;" />`;
  }
  return `
    <div style="width:56px;height:56px;background:#0077C5;border-radius:12px;
      display:flex;align-items:center;justify-content:center;
      font-size:22px;font-weight:700;color:#fff;">
      ${bizName[0]?.toUpperCase() || 'B'}
    </div>`;
};

const buildLineRows = (lines = []) =>
  lines.map(line => {
    const qty = parseFloat(line.qty) || 0;
    const rate = parseFloat(line.rate) || 0;
    const amount = qty * rate;
    return `
      <tr>
        <td>${line.description || ''}</td>
        <td style="text-align:center">${qty}</td>
        <td style="text-align:right">${rate.toLocaleString()}</td>
        <td style="text-align:right"><strong>${amount.toLocaleString()}</strong></td>
      </tr>`;
  }).join('');

const fmtDate = (d) => {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-GB');
};

// ─── SALES INVOICE ───────────────────────────────────────────────────────────
export const generateInvoicePdf = async (invoice, business) => {
  const cur = business.meta?.currency || 'PKR';
  const total = invoice.total || 0;
  const paid = invoice.amountPaid || 0;
  const balance = total - paid;
  const { color: statusColor, label: statusLabel } = getStatusStyle(balance, paid);

  const html = buildHtml({
    accentColor: '#0077C5',
    bizName: business.meta?.name || 'My Business',
    logoHtml: getLogoHtml(business),
    docType: 'INVOICE',
    docNumber: `INV-${invoice.number || invoice.id?.slice(-4) || '0001'}`,
    statusColor,
    statusLabel,
    partyLabel: 'Bill To',
    partyName: invoice.customerName,
    date: fmtDate(invoice.date),
    dueDate: invoice.dueDate ? fmtDate(invoice.dueDate) : null,
    lineRows: buildLineRows(invoice.lines),
    cur,
    total,
    paid,
    balance,
    notes: invoice.notes,
    extraFields: null,
  });

  await shareDocument(
    html,
    `Invoice_${invoice.customerName?.replace(/\s+/g, '_')}_${
      invoice.number || invoice.id?.slice(-4)
    }.pdf`
  );
};

// ─── PURCHASE BILL ────────────────────────────────────────────────────────────
export const generatePurchasePdf = async (invoice, business) => {
  const cur = business.meta?.currency || 'PKR';
  const total = invoice.total || 0;
  const paid = invoice.amountPaid || 0;
  const balance = total - paid;
  const { color: statusColor, label: statusLabel } = getStatusStyle(balance, paid);

  const html = buildHtml({
    accentColor: '#EF4444',
    bizName: business.meta?.name || 'My Business',
    logoHtml: getLogoHtml(business),
    docType: 'PURCHASE BILL',
    docNumber: `BILL-${invoice.number || invoice.id?.slice(-4) || '0001'}`,
    statusColor,
    statusLabel,
    partyLabel: 'Supplier',
    partyName: invoice.supplierName,
    date: fmtDate(invoice.date),
    dueDate: invoice.dueDate ? fmtDate(invoice.dueDate) : null,
    lineRows: buildLineRows(invoice.lines),
    cur,
    total,
    paid,
    balance,
    notes: invoice.notes,
    extraFields: null,
  });

  await shareDocument(
    html,
    `Bill_${invoice.supplierName?.replace(/\s+/g, '_')}_${
      invoice.number || invoice.id?.slice(-4)
    }.pdf`
  );
};

// ─── RECEIPT ──────────────────────────────────────────────────────────────────
export const generateReceiptPdf = async (receipt, business) => {
  const cur = business.meta?.currency || 'PKR';
  const amount = receipt.amount || 0;

  const html = buildHtml({
    accentColor: '#10B981',
    bizName: business.meta?.name || 'My Business',
    logoHtml: getLogoHtml(business),
    docType: 'RECEIPT',
    docNumber: `REC-${receipt.id?.slice(-4) || '0001'}`,
    statusColor: '#16A34A',
    statusLabel: 'RECEIVED',
    partyLabel: 'Received From',
    partyName: receipt.customerName,
    date: fmtDate(receipt.date),
    dueDate: null,
    lineRows: null,
    cur,
    total: amount,
    paid: 0,
    balance: null,
    notes: receipt.notes,
    extraFields: `
      <div class="info-sub">Account: ${receipt.accountName || 'Cash'}</div>
      ${receipt.reference
        ? `<div class="info-sub">Ref: ${receipt.reference}</div>`
        : ''}
    `,
  });

  await shareDocument(
    html,
    `Receipt_${receipt.customerName?.replace(/\s+/g, '_')}_${
      receipt.id?.slice(-4)
    }.pdf`
  );
};

// ─── PAYMENT ──────────────────────────────────────────────────────────────────
export const generatePaymentPdf = async (payment, business) => {
  const cur = business.meta?.currency || 'PKR';
  const amount = payment.amount || 0;

  const html = buildHtml({
    accentColor: '#8B5CF6',
    bizName: business.meta?.name || 'My Business',
    logoHtml: getLogoHtml(business),
    docType: 'PAYMENT',
    docNumber: `PAY-${payment.id?.slice(-4) || '0001'}`,
    statusColor: '#16A34A',
    statusLabel: 'PAID',
    partyLabel: 'Paid To',
    partyName: payment.supplierName,
    date: fmtDate(payment.date),
    dueDate: null,
    lineRows: null,
    cur,
    total: amount,
    paid: 0,
    balance: null,
    notes: payment.notes,
    extraFields: `
      <div class="info-sub">Account: ${payment.accountName || 'Cash'}</div>
      ${payment.reference
        ? `<div class="info-sub">Ref: ${payment.reference}</div>`
        : ''}
    `,
  });

  await shareDocument(
    html,
    `Payment_${payment.supplierName?.replace(/\s+/g, '_')}_${
      payment.id?.slice(-4)
    }.pdf`
  );
};