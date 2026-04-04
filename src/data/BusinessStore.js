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
  { id: 'exp-1',  name: 'Cost of Goods Sold', code: '5000', type: 'expense', group: 'Cost of Sales', isDefault: true },
  { id: 'exp-2',  name: 'Rent', code: '6000', type: 'expense', group: 'Operating Expenses', isDefault: true },
  { id: 'exp-3',  name: 'Salaries', code: '6100', type: 'expense', group: 'Operating Expenses', isDefault: true },
  { id: 'exp-4',  name: 'Utilities', code: '6200', type: 'expense', group: 'Operating Expenses', isDefault: true },
  { id: 'exp-5',  name: 'Transport', code: '6300', type: 'expense', group: 'Operating Expenses', isDefault: true },
  { id: 'exp-6',  name: 'Fuel', code: '6400', type: 'expense', group: 'Operating Expenses', isDefault: true },
  { id: 'exp-7',  name: 'Repairs & Maintenance', code: '6500', type: 'expense', group: 'Operating Expenses', isDefault: true },
  { id: 'exp-8',  name: 'Stationery', code: '6600', type: 'expense', group: 'Operating Expenses', isDefault: true },
  { id: 'exp-9',  name: 'Telephone & Internet', code: '6700', type: 'expense', group: 'Operating Expenses', isDefault: true },
  { id: 'exp-10', name: 'Discount Provided', code: '6800', type: 'expense', group: 'Operating Expenses', isDefault: true },
  { id: 'exp-11', name: 'Bank Charges', code: '6900', type: 'expense', group: 'Operating Expenses', isDefault: true },
  { id: 'exp-12', name: 'Miscellaneous', code: '7000', type: 'expense', group: 'Operating Expenses', isDefault: true },
  { id: 'exp-13', name: 'Inventory Write-off Loss', code: '7100', type: 'expense', group: 'Operating Expenses', isDefault: true },
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
  bankAccounts: [...DEFAULT_BANK_ACCOUNTS],
  incomeAccounts: [...DEFAULT_INCOME_ACCOUNTS],
  expenseAccounts: [...DEFAULT_EXPENSE_ACCOUNTS],
  customers: [],
  suppliers: [],
  items: [],
  salesInvoices: [],
  purchaseInvoices: [],
  salesQuotes: [],
  salesOrders: [],
  purchaseQuotes: [],
  purchaseOrders: [],
  transactions: [],   // universal — replaces receipts, payments, transfers
  journalEntries: [],
  inventoryWriteOffs: [],
  capitalAccounts: [],
});

// ─── STORAGE ─────────────────────────────────────────────────────────────────

export const getBusinessIndex = async () => {
  try {
    const raw = await AsyncStorage.getItem(BUSINESSES_INDEX_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (e) { return []; }
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
    // Migrate old businesses that have receipts/payments arrays
    return migrateBusiness(biz);
  } catch (e) {
    console.log('loadBusiness error:', e);
    return null;
  }
};

// Migrate v1 business files to v2 structure
const migrateBusiness = (biz) => {
  if (biz.meta?.version >= 2) return biz;
  const migrated = { ...biz };

  // Ensure new arrays exist
  if (!migrated.transactions) migrated.transactions = [];
  if (!migrated.journalEntries) migrated.journalEntries = [];
  if (!migrated.inventoryWriteOffs) migrated.inventoryWriteOffs = [];
  if (!migrated.incomeAccounts) migrated.incomeAccounts = [...DEFAULT_INCOME_ACCOUNTS];
  if (!migrated.expenseAccounts) migrated.expenseAccounts = [...DEFAULT_EXPENSE_ACCOUNTS];

  // Migrate old receipts to transactions
  if (biz.receipts?.length > 0) {
    const migratedReceipts = biz.receipts.map(r => ({
      ...r,
      transactionType: 'receipt',
      partyType: 'customer',
      partyId: r.customerId,
      partyName: r.customerName,
      accountId: r.accountId,
      accountName: r.accountName,
      incomeAccountId: null,
      incomeAccountName: null,
      linkedInvoiceId: null,
    }));
    migrated.transactions = [...migrated.transactions, ...migratedReceipts];
    delete migrated.receipts;
  }

  // Migrate old payments to transactions
  if (biz.payments?.length > 0) {
    const migratedPayments = biz.payments.map(p => ({
      ...p,
      transactionType: 'payment',
      partyType: 'supplier',
      partyId: p.supplierId,
      partyName: p.supplierName,
      accountId: p.accountId,
      accountName: p.accountName,
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

export const deleteBusiness = async (id) => {
  try {
    await AsyncStorage.removeItem(`smartbiz_biz_${id}`);
    const index = await getBusinessIndex();
    await saveBusinessIndex(index.filter(b => b.id !== id));
  } catch (e) { console.log('deleteBusiness error:', e); }
};

// ─── TRANSACTION HELPERS ──────────────────────────────────────────────────────

// Save a receipt transaction + apply FIFO to invoices + update bank balance
export const saveReceiptTransaction = async (biz, txn) => {
  const updated = { ...biz };
  const transactions = [...(biz.transactions || [])];

  // Remove old version if editing
  const existingIdx = transactions.findIndex(t => t.id === txn.id);
  let oldAmount = 0;
  let oldAccountId = null;
  let oldInvoiceId = null;

  if (existingIdx >= 0) {
    oldAmount = transactions[existingIdx].amount || 0;
    oldAccountId = transactions[existingIdx].accountId;
    oldInvoiceId = transactions[existingIdx].linkedInvoiceId;
    transactions.splice(existingIdx, 1);

    // Reverse old invoice payment
    if (oldInvoiceId) {
      updated.salesInvoices = (biz.salesInvoices || []).map(inv =>
        inv.id === oldInvoiceId
          ? { ...inv, amountPaid: Math.max(0, (inv.amountPaid || 0) - oldAmount) }
          : inv
      );
    } else if (txn.partyId) {
      // Reverse FIFO
      updated.salesInvoices = reverseFifoReceipt(
        updated.salesInvoices || [],
        txn.partyId,
        oldAmount
      );
    }

    // Reverse old bank balance
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

  // Apply to specific invoice
  if (txn.linkedInvoiceId) {
    updated.salesInvoices = (updated.salesInvoices || biz.salesInvoices || []).map(inv =>
      inv.id === txn.linkedInvoiceId
        ? { ...inv, amountPaid: Math.min(inv.total, (inv.amountPaid || 0) + txn.amount) }
        : inv
    );
  } else if (txn.partyId && txn.partyType === 'customer') {
    // FIFO allocation
    updated.salesInvoices = applyFifoReceipt(
      updated.salesInvoices || biz.salesInvoices || [],
      txn.partyId,
      txn.amount
    );
  }

  // Update bank account balance
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

// Save a payment transaction + apply FIFO to purchase invoices + update bank balance
export const savePaymentTransaction = async (biz, txn) => {
  const updated = { ...biz };
  const transactions = [...(biz.transactions || [])];

  const existingIdx = transactions.findIndex(t => t.id === txn.id);
  let oldAmount = 0;
  let oldAccountId = null;
  let oldInvoiceId = null;

  if (existingIdx >= 0) {
    oldAmount = transactions[existingIdx].amount || 0;
    oldAccountId = transactions[existingIdx].accountId;
    oldInvoiceId = transactions[existingIdx].linkedInvoiceId;
    transactions.splice(existingIdx, 1);

    if (oldInvoiceId) {
      updated.purchaseInvoices = (biz.purchaseInvoices || []).map(inv =>
        inv.id === oldInvoiceId
          ? { ...inv, amountPaid: Math.max(0, (inv.amountPaid || 0) - oldAmount) }
          : inv
      );
    } else if (txn.partyId) {
      updated.purchaseInvoices = reverseFifoPayment(
        updated.purchaseInvoices || [],
        txn.partyId,
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

// Save a transfer between two bank/cash accounts
export const saveTransferTransaction = async (biz, txn) => {
  const updated = { ...biz };
  const transactions = [...(biz.transactions || [])];

  const existingIdx = transactions.findIndex(t => t.id === txn.id);
  if (existingIdx >= 0) {
    const old = transactions[existingIdx];
    // Reverse old transfer
    updated.bankAccounts = (biz.bankAccounts || []).map(a => {
      if (a.id === old.fromAccountId) return { ...a, balance: (a.balance || 0) + old.amount };
      if (a.id === old.toAccountId) return { ...a, balance: (a.balance || 0) - old.amount };
      return a;
    });
    transactions.splice(existingIdx, 1);
  }

  transactions.push(txn);
  updated.transactions = transactions;

  // Apply transfer
  updated.bankAccounts = (updated.bankAccounts || biz.bankAccounts || []).map(a => {
    if (a.id === txn.fromAccountId) return { ...a, balance: (a.balance || 0) - txn.amount };
    if (a.id === txn.toAccountId) return { ...a, balance: (a.balance || 0) + txn.amount };
    return a;
  });

  await saveBusiness(updated);
  return updated;
};

// Delete any transaction and reverse its effects
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
    } else if (txn.partyId) {
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
    } else if (txn.partyId) {
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
      if (a.id === txn.fromAccountId) return { ...a, balance: (a.balance || 0) + txn.amount };
      if (a.id === txn.toAccountId) return { ...a, balance: (a.balance || 0) - txn.amount };
      return a;
    });
  }

  await saveBusiness(updated);
  return updated;
};

// ─── FIFO HELPERS ─────────────────────────────────────────────────────────────

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

// ─── BALANCE CALCULATORS ─────────────────────────────────────────────────────

export const getCustomerBalance = (business, customerId) => {
  try {
    const invoiced = (business.salesInvoices || [])
      .filter(inv => inv.customerId === customerId)
      .reduce((sum, inv) => sum + (inv.total || 0), 0);
    const received = (business.transactions || [])
      .filter(t => t.transactionType === 'receipt' && t.partyId === customerId)
      .reduce((sum, t) => sum + (t.amount || 0), 0);
    return invoiced - received;
  } catch (e) { return 0; }
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
  } catch (e) { return 0; }
};

export const getTotalReceivables = (business) => {
  try {
    return (business.customers || []).reduce(
      (sum, c) => sum + Math.max(0, getCustomerBalance(business, c.id)), 0
    );
  } catch (e) { return 0; }
};

export const getTotalPayables = (business) => {
  try {
    return (business.suppliers || []).reduce(
      (sum, s) => sum + Math.max(0, getSupplierBalance(business, s.id)), 0
    );
  } catch (e) { return 0; }
};

export const getCashBalance = (business) => {
  try {
    return (business.bankAccounts || [])
      .filter(a => a.type === 'cash')
      .reduce((sum, a) => sum + (a.balance || 0), 0);
  } catch (e) { return 0; }
};

export const getBankBalance = (business) => {
  try {
    return (business.bankAccounts || [])
      .filter(a => a.type === 'bank')
      .reduce((sum, a) => sum + (a.balance || 0), 0);
  } catch (e) { return 0; }
};

export const getInvoiceStatus = (invoice) => {
  try {
    const paid = invoice.amountPaid || 0;
    if (paid >= invoice.total) return 'paid';
    if (paid > 0) return 'partial';
    return 'due';
  } catch (e) { return 'due'; }
};

export const generateId = () =>
  Date.now().toString() + Math.random().toString(36).slice(2, 6);

// ─── EXPENSE BALANCE ──────────────────────────────────────────────────────────

export const getExpenseAccountBalance = (business, accountId) => {
  try {
    return (business.transactions || [])
      .filter(t =>
        t.transactionType === 'payment' &&
        t.expenseAccountId === accountId
      )
      .reduce((sum, t) => sum + (t.amount || 0), 0);
  } catch (e) { return 0; }
};

export const getIncomeAccountBalance = (business, accountId) => {
  try {
    return (business.transactions || [])
      .filter(t =>
        t.transactionType === 'receipt' &&
        t.incomeAccountId === accountId
      )
      .reduce((sum, t) => sum + (t.amount || 0), 0);
  } catch (e) { return 0; }
};