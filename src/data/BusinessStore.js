import AsyncStorage from '@react-native-async-storage/async-storage';

const BUSINESSES_INDEX_KEY = 'smartbiz_businesses';

// ─── DEFAULT ACCOUNTS ────────────────────────────────────────────────────────

export const DEFAULT_INCOME_ACCOUNTS = [
  { id: 'inc-1', name: 'Sales Revenue', code: '4000', type: 'income', group: 'Revenue', isDefault: true },
  { id: 'inc-2', name: 'Other Income', code: '4100', type: 'income', group: 'Revenue', isDefault: true },
  { id: 'inc-3', name: 'Interest Received', code: '4200', type: 'income', group: 'Revenue', isDefault: true },
  { id: 'inc-4', name: 'Commission Received', code: '4300', type: 'income', group: 'Revenue', isDefault: true },
  { id: 'inc-5', name: 'Rental Income', code: '4400', type: 'income', group: 'Revenue', isDefault: true },
  { id: 'inc-6', name: 'Discount Received', code: '4500', type: 'income', group: 'Revenue', isDefault: true },
];

export const DEFAULT_EXPENSE_ACCOUNTS = [
  { id: 'exp-1',  name: 'Cost of Goods Sold',      code: '5000', type: 'expense', group: 'Cost of Sales',       isDefault: true },
  { id: 'exp-2',  name: 'Rent',                     code: '6000', type: 'expense', group: 'Operating Expenses',  isDefault: true },
  { id: 'exp-3',  name: 'Salaries',                 code: '6100', type: 'expense', group: 'Operating Expenses',  isDefault: true },
  { id: 'exp-4',  name: 'Utilities',                code: '6200', type: 'expense', group: 'Operating Expenses',  isDefault: true },
  { id: 'exp-5',  name: 'Transport',                code: '6300', type: 'expense', group: 'Operating Expenses',  isDefault: true },
  { id: 'exp-6',  name: 'Fuel',                     code: '6400', type: 'expense', group: 'Operating Expenses',  isDefault: true },
  { id: 'exp-7',  name: 'Repairs & Maintenance',    code: '6500', type: 'expense', group: 'Operating Expenses',  isDefault: true },
  { id: 'exp-8',  name: 'Stationery',               code: '6600', type: 'expense', group: 'Operating Expenses',  isDefault: true },
  { id: 'exp-9',  name: 'Telephone & Internet',     code: '6700', type: 'expense', group: 'Operating Expenses',  isDefault: true },
  { id: 'exp-10', name: 'Discount Provided',        code: '6800', type: 'expense', group: 'Operating Expenses',  isDefault: true },
  { id: 'exp-11', name: 'Bank Charges',             code: '6900', type: 'expense', group: 'Operating Expenses',  isDefault: true },
  { id: 'exp-12', name: 'Miscellaneous',            code: '7000', type: 'expense', group: 'Operating Expenses',  isDefault: true },
  { id: 'exp-13', name: 'Inventory Write-off Loss', code: '7100', type: 'expense', group: 'Operating Expenses',  isDefault: true },
];

export const DEFAULT_BANK_ACCOUNTS = [
  { id: 'cash-1', name: 'Cash on Hand', type: 'cash', openingBalance: 0, balance: 0 },
];

// ─── BUSINESS TEMPLATE ───────────────────────────────────────────────────────

export const createEmptyBusiness = (name, currency = 'PKR') => ({
  id: Date.now().toString(),
  meta: {
    name,
    currency,
    logo: null,
    createdAt: new Date().toISOString(),
    version: 2,
  },
  settings: {
    pin: null,
    numberFormat: '0,0.00',
    dateFormat: 'DD/MM/YYYY',
    taxRate: 0,
  },
  bankAccounts:    [...DEFAULT_BANK_ACCOUNTS],
  incomeAccounts:  [...DEFAULT_INCOME_ACCOUNTS],
  expenseAccounts: [...DEFAULT_EXPENSE_ACCOUNTS],
  customers:          [],
  suppliers:          [],
  items:              [],
  salesInvoices:      [],
  purchaseInvoices:   [],
  salesQuotes:        [],
  salesOrders:        [],
  purchaseQuotes:     [],
  purchaseOrders:     [],
  transactions:       [],
  journalEntries:     [],
  inventoryWriteOffs: [],
  capitalAccounts:    [],
});

// ─── STORAGE ─────────────────────────────────────────────────────────────────

export const getBusinessIndex = async () => {
  try {
    const raw = await AsyncStorage.getItem(BUSINESSES_INDEX_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
};

export const saveBusinessIndex = async (index) => {
  try {
    await AsyncStorage.setItem(BUSINESSES_INDEX_KEY, JSON.stringify(index));
  } catch (e) { console.log('saveBusinessIndex error:', e); }
};

export const saveBusiness = async (business) => {
  try {
    const key = `smartbiz_biz_${business.id}`;
    await AsyncStorage.setItem(key, JSON.stringify(business));
    const index = await getBusinessIndex();
    const existing = index.findIndex(b => b.id === business.id);
    const entry = {
      id: business.id,
      name: business.meta.name,
      updatedAt: new Date().toISOString(),
    };
    if (existing >= 0) index[existing] = entry;
    else index.push(entry);
    await saveBusinessIndex(index);
    return true;
  } catch (e) {
    console.log('saveBusiness error:', e);
    throw e;
  }
};

export const loadBusiness = async (id) => {
  try {
    const key = `smartbiz_biz_${id}`;
    const raw = await AsyncStorage.getItem(key);
    if (!raw) return null;
    const biz = JSON.parse(raw);
    return migrateBusiness(biz);
  } catch (e) {
    console.log('loadBusiness error:', e);
    return null;
  }
};

export const deleteBusiness = async (id) => {
  try {
    await AsyncStorage.removeItem(`smartbiz_biz_${id}`);
    const index = await getBusinessIndex();
    await saveBusinessIndex(index.filter(b => b.id !== id));
  } catch (e) { console.log('deleteBusiness error:', e); }
};

// ─── MIGRATION ────────────────────────────────────────────────────────────────

const migrateBusiness = (biz) => {
  if (biz.meta?.version >= 2) return biz;
  const migrated = { ...biz };

  if (!migrated.transactions)       migrated.transactions = [];
  if (!migrated.journalEntries)     migrated.journalEntries = [];
  if (!migrated.inventoryWriteOffs) migrated.inventoryWriteOffs = [];
  if (!migrated.incomeAccounts)     migrated.incomeAccounts = [...DEFAULT_INCOME_ACCOUNTS];
  if (!migrated.expenseAccounts)    migrated.expenseAccounts = [...DEFAULT_EXPENSE_ACCOUNTS];

  if (biz.receipts?.length > 0) {
    const migratedReceipts = biz.receipts.map(r => ({
      ...r,
      transactionType: 'receipt',
      partyType: 'customer',
      partyId: r.customerId,
      partyName: r.customerName,
      incomeAccountId: null,
      incomeAccountName: null,
      linkedInvoiceId: null,
    }));
    migrated.transactions = [...migrated.transactions, ...migratedReceipts];
    delete migrated.receipts;
  }

  if (biz.payments?.length > 0) {
    const migratedPayments = biz.payments.map(p => ({
      ...p,
      transactionType: 'payment',
      partyType: 'supplier',
      partyId: p.supplierId,
      partyName: p.supplierName,
      expenseAccountId: null,
      expenseAccountName: null,
      linkedInvoiceId: null,
    }));
    migrated.transactions = [...migrated.transactions, ...migratedPayments];
    delete migrated.payments;
  }

  migrated.meta = { ...migrated.meta, version: 2 };
  return migrated;
};

// ─── ID GENERATOR ─────────────────────────────────────────────────────────────

export const generateId = () =>
  Date.now().toString() + Math.random().toString(36).slice(2, 6);

// ─── INVOICE STATUS ───────────────────────────────────────────────────────────

export const getInvoiceStatus = (invoice) => {
  try {
    const paid = invoice.amountPaid || 0;
    if (paid >= invoice.total) return 'paid';
    if (paid > 0) return 'partial';
    return 'due';
  } catch { return 'due'; }
};

// ─── BALANCE CALCULATORS ──────────────────────────────────────────────────────

export const getCustomerBalance = (business, customerId) => {
  try {
    const invoiced = (business.salesInvoices || [])
      .filter(inv => inv.customerId === customerId)
      .reduce((sum, inv) => sum + (inv.total || 0), 0);
    const received = (business.transactions || [])
      .filter(t => t.transactionType === 'receipt' && t.partyId === customerId)
      .reduce((sum, t) => sum + (t.amount || 0), 0);
    return invoiced - received;
  } catch { return 0; }
};

export const getSupplierBalance = (business, supplierId) => {
  try {
    const billed = (business.purchaseInvoices || [])
      .filter(inv => inv.supplierId === supplierId)
      .reduce((sum, inv) => sum + (inv.total || 0), 0);
    const paid = (business.transactions || [])
      .filter(t => t.transactionType === 'payment' && t.partyId === supplierId)
      .reduce((sum, t) => sum + (t.amount || 0), 0);
    return billed - paid;
  } catch { return 0; }
};

export const getTotalReceivables = (business) => {
  try {
    return (business.customers || []).reduce(
      (sum, c) => sum + Math.max(0, getCustomerBalance(business, c.id)), 0
    );
  } catch { return 0; }
};

export const getTotalPayables = (business) => {
  try {
    return (business.suppliers || []).reduce(
      (sum, s) => sum + Math.max(0, getSupplierBalance(business, s.id)), 0
    );
  } catch { return 0; }
};

export const getCashBalance = (business) => {
  try {
    return (business.bankAccounts || [])
      .filter(a => a.type === 'cash')
      .reduce((sum, a) => sum + (a.balance || 0), 0);
  } catch { return 0; }
};

export const getBankBalance = (business) => {
  try {
    return (business.bankAccounts || [])
      .filter(a => a.type === 'bank')
      .reduce((sum, a) => sum + (a.balance || 0), 0);
  } catch { return 0; }
};

export const getExpenseAccountBalance = (business, accountId) => {
  try {
    return (business.transactions || [])
      .filter(t =>
        t.transactionType === 'payment' && t.expenseAccountId === accountId
      )
      .reduce((sum, t) => sum + (t.amount || 0), 0);
  } catch { return 0; }
};

export const getIncomeAccountBalance = (business, accountId) => {
  try {
    return (business.transactions || [])
      .filter(t =>
        t.transactionType === 'receipt' && t.incomeAccountId === accountId
      )
      .reduce((sum, t) => sum + (t.amount || 0), 0);
  } catch { return 0; }
};

// ─── FIFO HELPERS (internal) ──────────────────────────────────────────────────

const applyFifoReceipt = (invoices, customerId, amount) => {
  let remaining = amount;
  return invoices.map(inv => {
    if (inv.customerId !== customerId || remaining <= 0) return inv;
    const balance = inv.total - (inv.amountPaid || 0);
    if (balance <= 0) return inv;
    const apply = Math.min(balance, remaining);
    remaining -= apply;
    return { ...inv, amountPaid: (inv.amountPaid || 0) + apply };
  });
};

const reverseFifoReceipt = (invoices, customerId, amount) => {
  let remaining = amount;
  return [...invoices].reverse().map(inv => {
    if (inv.customerId !== customerId || remaining <= 0) return inv;
    const paid = inv.amountPaid || 0;
    if (paid <= 0) return inv;
    const reverse = Math.min(paid, remaining);
    remaining -= reverse;
    return { ...inv, amountPaid: paid - reverse };
  }).reverse();
};

const applyFifoPayment = (invoices, supplierId, amount) => {
  let remaining = amount;
  return invoices.map(inv => {
    if (inv.supplierId !== supplierId || remaining <= 0) return inv;
    const balance = inv.total - (inv.amountPaid || 0);
    if (balance <= 0) return inv;
    const apply = Math.min(balance, remaining);
    remaining -= apply;
    return { ...inv, amountPaid: (inv.amountPaid || 0) + apply };
  });
};

const reverseFifoPayment = (invoices, supplierId, amount) => {
  let remaining = amount;
  return [...invoices].reverse().map(inv => {
    if (inv.supplierId !== supplierId || remaining <= 0) return inv;
    const paid = inv.amountPaid || 0;
    if (paid <= 0) return inv;
    const reverse = Math.min(paid, remaining);
    remaining -= reverse;
    return { ...inv, amountPaid: paid - reverse };
  }).reverse();
};

// ─── TRANSACTION HELPERS ──────────────────────────────────────────────────────

export const saveReceiptTransaction = async (biz, txn) => {
  const updated = { ...biz };
  const transactions = [...(biz.transactions || [])];

  const existingIdx = transactions.findIndex(t => t.id === txn.id);
  let oldAmount = 0;
  let oldAccountId = null;
  let oldInvoiceId = null;

  if (existingIdx >= 0) {
    const old = transactions[existingIdx];
    oldAmount = old.amount || 0;
    oldAccountId = old.accountId;
    oldInvoiceId = old.linkedInvoiceId;
    transactions.splice(existingIdx, 1);

    if (oldInvoiceId) {
      updated.salesInvoices = (biz.salesInvoices || []).map(inv =>
        inv.id === oldInvoiceId
          ? { ...inv, amountPaid: Math.max(0, (inv.amountPaid || 0) - oldAmount) }
          : inv
      );
    } else if (old.partyId && old.partyType === 'customer') {
      updated.salesInvoices = reverseFifoReceipt(
        updated.salesInvoices || biz.salesInvoices || [],
        old.partyId,
        oldAmount
      );
    }

    if (oldAccountId) {
      updated.bankAccounts = (biz.bankAccounts || []).map(a =>
        a.id === oldAccountId
          ? { ...a, balance: (a.balance || 0) - oldAmount }
          : a
      );
    }
  }

  transactions.push(txn);
  updated.transactions = transactions;

  if (txn.linkedInvoiceId) {
    updated.salesInvoices = (updated.salesInvoices || biz.salesInvoices || []).map(inv =>
      inv.id === txn.linkedInvoiceId
        ? { ...inv, amountPaid: Math.min(inv.total, (inv.amountPaid || 0) + txn.amount) }
        : inv
    );
  } else if (txn.partyId && txn.partyType === 'customer') {
    updated.salesInvoices = applyFifoReceipt(
      updated.salesInvoices || biz.salesInvoices || [],
      txn.partyId,
      txn.amount
    );
  }

  if (txn.accountId) {
    updated.bankAccounts = (updated.bankAccounts || biz.bankAccounts || []).map(a =>
      a.id === txn.accountId
        ? { ...a, balance: (a.balance || 0) + txn.amount }
        : a
    );
  }

  await saveBusiness(updated);
  return updated;
};

export const savePaymentTransaction = async (biz, txn) => {
  const updated = { ...biz };
  const transactions = [...(biz.transactions || [])];

  const existingIdx = transactions.findIndex(t => t.id === txn.id);
  let oldAmount = 0;
  let oldAccountId = null;
  let oldInvoiceId = null;

  if (existingIdx >= 0) {
    const old = transactions[existingIdx];
    oldAmount = old.amount || 0;
    oldAccountId = old.accountId;
    oldInvoiceId = old.linkedInvoiceId;
    transactions.splice(existingIdx, 1);

    if (oldInvoiceId) {
      updated.purchaseInvoices = (biz.purchaseInvoices || []).map(inv =>
        inv.id === oldInvoiceId
          ? { ...inv, amountPaid: Math.max(0, (inv.amountPaid || 0) - oldAmount) }
          : inv
      );
    } else if (old.partyId && old.partyType === 'supplier') {
      updated.purchaseInvoices = reverseFifoPayment(
        updated.purchaseInvoices || biz.purchaseInvoices || [],
        old.partyId,
        oldAmount
      );
    }

    if (oldAccountId) {
      updated.bankAccounts = (biz.bankAccounts || []).map(a =>
        a.id === oldAccountId
          ? { ...a, balance: (a.balance || 0) + oldAmount }
          : a
      );
    }
  }

  transactions.push(txn);
  updated.transactions = transactions;

  if (txn.linkedInvoiceId) {
    updated.purchaseInvoices = (updated.purchaseInvoices || biz.purchaseInvoices || []).map(inv =>
      inv.id === txn.linkedInvoiceId
        ? { ...inv, amountPaid: Math.min(inv.total, (inv.amountPaid || 0) + txn.amount) }
        : inv
    );
  } else if (txn.partyId && txn.partyType === 'supplier') {
    updated.purchaseInvoices = applyFifoPayment(
      updated.purchaseInvoices || biz.purchaseInvoices || [],
      txn.partyId,
      txn.amount
    );
  }

  if (txn.accountId) {
    updated.bankAccounts = (updated.bankAccounts || biz.bankAccounts || []).map(a =>
      a.id === txn.accountId
        ? { ...a, balance: (a.balance || 0) - txn.amount }
        : a
    );
  }

  await saveBusiness(updated);
  return updated;
};

export const saveTransferTransaction = async (biz, txn) => {
  const updated = { ...biz };
  const transactions = [...(biz.transactions || [])];

  const existingIdx = transactions.findIndex(t => t.id === txn.id);
  if (existingIdx >= 0) {
    const old = transactions[existingIdx];
    updated.bankAccounts = (biz.bankAccounts || []).map(a => {
      if (a.id === old.fromAccountId)
        return { ...a, balance: (a.balance || 0) + old.amount };
      if (a.id === old.toAccountId)
        return { ...a, balance: (a.balance || 0) - old.amount };
      return a;
    });
    transactions.splice(existingIdx, 1);
  }

  transactions.push(txn);
  updated.transactions = transactions;

  updated.bankAccounts = (updated.bankAccounts || biz.bankAccounts || []).map(a => {
    if (a.id === txn.fromAccountId)
      return { ...a, balance: (a.balance || 0) - txn.amount };
    if (a.id === txn.toAccountId)
      return { ...a, balance: (a.balance || 0) + txn.amount };
    return a;
  });

  await saveBusiness(updated);
  return updated;
};

export const deleteTransaction = async (biz, txnId) => {
  const txn = (biz.transactions || []).find(t => t.id === txnId);
  if (!txn) return biz;

  const updated = { ...biz };
  updated.transactions = biz.transactions.filter(t => t.id !== txnId);

  if (txn.transactionType === 'receipt') {
    if (txn.linkedInvoiceId) {
      updated.salesInvoices = (biz.salesInvoices || []).map(inv =>
        inv.id === txn.linkedInvoiceId
          ? { ...inv, amountPaid: Math.max(0, (inv.amountPaid || 0) - txn.amount) }
          : inv
      );
    } else if (txn.partyId && txn.partyType === 'customer') {
      updated.salesInvoices = reverseFifoReceipt(
        biz.salesInvoices || [], txn.partyId, txn.amount
      );
    }
    if (txn.accountId) {
      updated.bankAccounts = (biz.bankAccounts || []).map(a =>
        a.id === txn.accountId
          ? { ...a, balance: (a.balance || 0) - txn.amount }
          : a
      );
    }
  }

  if (txn.transactionType === 'payment') {
    if (txn.linkedInvoiceId) {
      updated.purchaseInvoices = (biz.purchaseInvoices || []).map(inv =>
        inv.id === txn.linkedInvoiceId
          ? { ...inv, amountPaid: Math.max(0, (inv.amountPaid || 0) - txn.amount) }
          : inv
      );
    } else if (txn.partyId && txn.partyType === 'supplier') {
      updated.purchaseInvoices = reverseFifoPayment(
        biz.purchaseInvoices || [], txn.partyId, txn.amount
      );
    }
    if (txn.accountId) {
      updated.bankAccounts = (biz.bankAccounts || []).map(a =>
        a.id === txn.accountId
          ? { ...a, balance: (a.balance || 0) + txn.amount }
          : a
      );
    }
  }

  if (txn.transactionType === 'transfer') {
    updated.bankAccounts = (biz.bankAccounts || []).map(a => {
      if (a.id === txn.fromAccountId)
        return { ...a, balance: (a.balance || 0) + txn.amount };
      if (a.id === txn.toAccountId)
        return { ...a, balance: (a.balance || 0) - txn.amount };
      return a;
    });
  }

  await saveBusiness(updated);
  return updated;
};

// ─── JOURNAL ENTRY HELPERS ────────────────────────────────────────────────────

export const saveJournalEntry = async (biz, entry) => {
  let updated = { ...biz };

  // Reverse effects of existing entry if editing
  const existing = (biz.journalEntries || []).find(e => e.id === entry.id);
  if (existing) {
    updated.bankAccounts = reverseJournalBankEffects(
      updated.bankAccounts || [], existing.lines || []
    );
    updated.salesInvoices = reverseJournalArEffects(
      updated.salesInvoices || [], existing.lines || []
    );
    updated.purchaseInvoices = reverseJournalApEffects(
      updated.purchaseInvoices || [], existing.lines || []
    );
    updated.journalEntries = (biz.journalEntries || []).filter(
      e => e.id !== entry.id
    );
  }

  // Apply new entry effects
  updated.bankAccounts = applyJournalBankEffects(
    updated.bankAccounts || [], entry.lines || []
  );
  updated.salesInvoices = applyJournalArEffects(
    updated.salesInvoices || [], entry.lines || []
  );
  updated.purchaseInvoices = applyJournalApEffects(
    updated.purchaseInvoices || [], entry.lines || []
  );
  updated.journalEntries = [
    ...(updated.journalEntries || []),
    entry,
  ];

  await saveBusiness(updated);
  return updated;
};

export const deleteJournalEntry = async (biz, entryId) => {
  const entry = (biz.journalEntries || []).find(e => e.id === entryId);
  if (!entry) return biz;

  const updated = { ...biz };
  updated.bankAccounts = reverseJournalBankEffects(
    biz.bankAccounts || [], entry.lines || []
  );
  updated.salesInvoices = reverseJournalArEffects(
    biz.salesInvoices || [], entry.lines || []
  );
  updated.purchaseInvoices = reverseJournalApEffects(
    biz.purchaseInvoices || [], entry.lines || []
  );
  updated.journalEntries = (biz.journalEntries || []).filter(
    e => e.id !== entryId
  );

  await saveBusiness(updated);
  return updated;
};

// Bank/Cash: Debit = increase balance, Credit = decrease balance
const applyJournalBankEffects = (accounts, lines) => {
  return accounts.map(acc => {
    let delta = 0;
    lines.forEach(line => {
      if (line.accountId === acc.id && line.accountCategory === 'bank') {
        delta += (line.debit || 0) - (line.credit || 0);
      }
    });
    if (delta === 0) return acc;
    return { ...acc, balance: (acc.balance || 0) + delta };
  });
};

const reverseJournalBankEffects = (accounts, lines) => {
  return accounts.map(acc => {
    let delta = 0;
    lines.forEach(line => {
      if (line.accountId === acc.id && line.accountCategory === 'bank') {
        delta += (line.debit || 0) - (line.credit || 0);
      }
    });
    if (delta === 0) return acc;
    return { ...acc, balance: (acc.balance || 0) - delta };
  });
};

// A/R: Credit = reduces customer balance, Debit = increases customer balance
const applyJournalArEffects = (invoices, lines) => {
  let result = [...invoices];
  lines.forEach(line => {
    if (line.accountCategory !== 'customer') return;
    const credit = line.credit || 0;
    const debit  = line.debit  || 0;
    if (credit > 0) {
      if (line.linkedInvoiceId) {
        result = result.map(inv =>
          inv.id === line.linkedInvoiceId
            ? { ...inv, amountPaid: Math.min(inv.total, (inv.amountPaid || 0) + credit) }
            : inv
        );
      } else if (line.accountId) {
        result = applyFifoToCustomerInvoices(result, line.accountId, credit);
      }
    }
    if (debit > 0 && line.linkedInvoiceId) {
      result = result.map(inv =>
        inv.id === line.linkedInvoiceId
          ? { ...inv, amountPaid: Math.max(0, (inv.amountPaid || 0) - debit) }
          : inv
      );
    }
  });
  return result;
};

const reverseJournalArEffects = (invoices, lines) => {
  let result = [...invoices];
  lines.forEach(line => {
    if (line.accountCategory !== 'customer') return;
    const credit = line.credit || 0;
    const debit  = line.debit  || 0;
    if (credit > 0) {
      if (line.linkedInvoiceId) {
        result = result.map(inv =>
          inv.id === line.linkedInvoiceId
            ? { ...inv, amountPaid: Math.max(0, (inv.amountPaid || 0) - credit) }
            : inv
        );
      } else if (line.accountId) {
        result = applyFifoToCustomerInvoices(result, line.accountId, -credit);
      }
    }
    if (debit > 0 && line.linkedInvoiceId) {
      result = result.map(inv =>
        inv.id === line.linkedInvoiceId
          ? { ...inv, amountPaid: Math.min(inv.total, (inv.amountPaid || 0) + debit) }
          : inv
      );
    }
  });
  return result;
};

// A/P: Debit = reduces supplier balance, Credit = increases supplier balance
const applyJournalApEffects = (invoices, lines) => {
  let result = [...invoices];
  lines.forEach(line => {
    if (line.accountCategory !== 'supplier') return;
    const debit  = line.debit  || 0;
    const credit = line.credit || 0;
    if (debit > 0) {
      if (line.linkedInvoiceId) {
        result = result.map(inv =>
          inv.id === line.linkedInvoiceId
            ? { ...inv, amountPaid: Math.min(inv.total, (inv.amountPaid || 0) + debit) }
            : inv
        );
      } else if (line.accountId) {
        result = applyFifoToSupplierInvoices(result, line.accountId, debit);
      }
    }
    if (credit > 0 && line.linkedInvoiceId) {
      result = result.map(inv =>
        inv.id === line.linkedInvoiceId
          ? { ...inv, amountPaid: Math.max(0, (inv.amountPaid || 0) - credit) }
          : inv
      );
    }
  });
  return result;
};

const reverseJournalApEffects = (invoices, lines) => {
  let result = [...invoices];
  lines.forEach(line => {
    if (line.accountCategory !== 'supplier') return;
    const debit  = line.debit  || 0;
    const credit = line.credit || 0;
    if (debit > 0) {
      if (line.linkedInvoiceId) {
        result = result.map(inv =>
          inv.id === line.linkedInvoiceId
            ? { ...inv, amountPaid: Math.max(0, (inv.amountPaid || 0) - debit) }
            : inv
        );
      } else if (line.accountId) {
        result = applyFifoToSupplierInvoices(result, line.accountId, -debit);
      }
    }
    if (credit > 0 && line.linkedInvoiceId) {
      result = result.map(inv =>
        inv.id === line.linkedInvoiceId
          ? { ...inv, amountPaid: Math.min(inv.total, (inv.amountPaid || 0) + credit) }
          : inv
      );
    }
  });
  return result;
};

const applyFifoToCustomerInvoices = (invoices, customerId, amount) => {
  if (amount <= 0) return invoices;
  let remaining = amount;
  return invoices.map(inv => {
    if (inv.customerId !== customerId || remaining <= 0) return inv;
    const balance = inv.total - (inv.amountPaid || 0);
    if (balance <= 0) return inv;
    const apply = Math.min(balance, remaining);
    remaining -= apply;
    return { ...inv, amountPaid: (inv.amountPaid || 0) + apply };
  });
};

const applyFifoToSupplierInvoices = (invoices, supplierId, amount) => {
  if (amount <= 0) return invoices;
  let remaining = amount;
  return invoices.map(inv => {
    if (inv.supplierId !== supplierId || remaining <= 0) return inv;
    const balance = inv.total - (inv.amountPaid || 0);
    if (balance <= 0) return inv;
    const apply = Math.min(balance, remaining);
    remaining -= apply;
    return { ...inv, amountPaid: (inv.amountPaid || 0) + apply };
  });
};

// ─── INVENTORY STOCK HELPERS ──────────────────────────────────────────────────

// Called when a purchase invoice is saved — increases stock for matched items
export const applyPurchaseInvoiceToInventory = (biz, invoice, oldInvoice = null) => {
  let items = [...(biz.items || [])];

  // Reverse old invoice stock if editing
  if (oldInvoice) {
    (oldInvoice.lines || []).forEach(line => {
      const qty = parseFloat(line.qty) || 0;
      if (qty <= 0) return;
      const idx = items.findIndex(
        i => i.name?.toLowerCase() === line.description?.toLowerCase() ||
             i.id === line.itemId
      );
      if (idx >= 0) {
        items[idx] = {
          ...items[idx],
          stock: Math.max(0, (items[idx].stock || 0) - qty),
        };
      }
    });
  }

  // Apply new invoice stock
  (invoice.lines || []).forEach(line => {
    const qty  = parseFloat(line.qty) || 0;
    const rate = parseFloat(line.rate) || 0;
    if (qty <= 0) return;
    const idx = items.findIndex(
      i => i.name?.toLowerCase() === line.description?.toLowerCase() ||
           i.id === line.itemId
    );
    if (idx >= 0) {
      // Update stock and cost price with weighted average
      const currentStock = items[idx].stock || 0;
      const currentCost  = items[idx].costPrice || 0;
      const newStock     = currentStock + qty;
      const newAvgCost   = newStock > 0
        ? ((currentStock * currentCost) + (qty * rate)) / newStock
        : rate;
      items[idx] = {
        ...items[idx],
        stock:     newStock,
        costPrice: Math.round(newAvgCost * 100) / 100,
      };
    }
  });

  return items;
};

// Called when a purchase invoice is deleted — reverses stock
export const reversePurchaseInvoiceFromInventory = (biz, invoice) => {
  let items = [...(biz.items || [])];
  (invoice.lines || []).forEach(line => {
    const qty = parseFloat(line.qty) || 0;
    if (qty <= 0) return;
    const idx = items.findIndex(
      i => i.name?.toLowerCase() === line.description?.toLowerCase() ||
           i.id === line.itemId
    );
    if (idx >= 0) {
      items[idx] = {
        ...items[idx],
        stock: Math.max(0, (items[idx].stock || 0) - qty),
      };
    }
  });
  return items;
};

// Called when a sales invoice is saved — decreases stock for matched items
export const applySalesInvoiceToInventory = (biz, invoice, oldInvoice = null) => {
  let items = [...(biz.items || [])];

  // Reverse old invoice stock if editing
  if (oldInvoice) {
    (oldInvoice.lines || []).forEach(line => {
      const qty = parseFloat(line.qty) || 0;
      if (qty <= 0) return;
      const idx = items.findIndex(
        i => i.name?.toLowerCase() === line.description?.toLowerCase() ||
             i.id === line.itemId
      );
      if (idx >= 0) {
        items[idx] = {
          ...items[idx],
          stock: (items[idx].stock || 0) + qty,
        };
      }
    });
  }

  // Apply new invoice stock reduction
  (invoice.lines || []).forEach(line => {
    const qty = parseFloat(line.qty) || 0;
    if (qty <= 0) return;
    const idx = items.findIndex(
      i => i.name?.toLowerCase() === line.description?.toLowerCase() ||
           i.id === line.itemId
    );
    if (idx >= 0) {
      items[idx] = {
        ...items[idx],
        stock: Math.max(0, (items[idx].stock || 0) - qty),
      };
    }
  });

  return items;
};

// Called when a sales invoice is deleted — restores stock
export const reverseSalesInvoiceFromInventory = (biz, invoice) => {
  let items = [...(biz.items || [])];
  (invoice.lines || []).forEach(line => {
    const qty = parseFloat(line.qty) || 0;
    if (qty <= 0) return;
    const idx = items.findIndex(
      i => i.name?.toLowerCase() === line.description?.toLowerCase() ||
           i.id === line.itemId
    );
    if (idx >= 0) {
      items[idx] = {
        ...items[idx],
        stock: (items[idx].stock || 0) + qty,
      };
    }
  });
  return items;
};