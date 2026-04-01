import AsyncStorage from '@react-native-async-storage/async-storage';

const BUSINESSES_INDEX_KEY = 'smartbiz_businesses';

export const createEmptyBusiness = (name, currency = 'PKR') => ({
  id: Date.now().toString(),
  meta: {
    name,
    currency,
    logo: null,
    createdAt: new Date().toISOString(),
    version: 1,
  },
  settings: {
    pin: null,
    numberFormat: '0,0.00',
    dateFormat: 'DD/MM/YYYY',
    taxRate: 0,
  },
  chartOfAccounts: getDefaultChartOfAccounts(),
  bankAccounts: [
    { id: 'cash-1', name: 'Cash on Hand', type: 'cash', balance: 0 },
  ],
  customers: [],
  suppliers: [],
  items: [],
  salesInvoices: [],
  purchaseInvoices: [],
  salesQuotes: [],
  salesOrders: [],
  purchaseQuotes: [],
  purchaseOrders: [],
  receipts: [],
  payments: [],
  transfers: [],
  journalEntries: [],
  capitalAccounts: [],
});

function getDefaultChartOfAccounts() {
  return [
    { id: 'acc-1', code: '1000', name: 'Cash & Bank', type: 'asset', group: 'Current Assets' },
    { id: 'acc-2', code: '1100', name: 'Accounts Receivable', type: 'asset', group: 'Current Assets' },
    { id: 'acc-3', code: '1200', name: 'Inventory', type: 'asset', group: 'Current Assets' },
    { id: 'acc-4', code: '2000', name: 'Accounts Payable', type: 'liability', group: 'Current Liabilities' },
    { id: 'acc-5', code: '3000', name: 'Owner Equity', type: 'equity', group: 'Equity' },
    { id: 'acc-6', code: '4000', name: 'Sales Revenue', type: 'income', group: 'Revenue' },
    { id: 'acc-7', code: '5000', name: 'Cost of Goods Sold', type: 'expense', group: 'Cost of Sales' },
    { id: 'acc-8', code: '6000', name: 'General Expenses', type: 'expense', group: 'Expenses' },
    { id: 'acc-9', code: '6100', name: 'Rent', type: 'expense', group: 'Expenses' },
    { id: 'acc-10', code: '6200', name: 'Utilities', type: 'expense', group: 'Expenses' },
    { id: 'acc-11', code: '6300', name: 'Salaries', type: 'expense', group: 'Expenses' },
  ];
}

export const getBusinessIndex = async () => {
  try {
    const raw = await AsyncStorage.getItem(BUSINESSES_INDEX_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    return [];
  }
};

export const saveBusinessIndex = async (index) => {
  try {
    await AsyncStorage.setItem(BUSINESSES_INDEX_KEY, JSON.stringify(index));
  } catch (e) {
    console.log('saveBusinessIndex error:', e);
  }
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
    if (existing >= 0) {
      index[existing] = entry;
    } else {
      index.push(entry);
    }
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
    return raw ? JSON.parse(raw) : null;
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
  } catch (e) {
    console.log('deleteBusiness error:', e);
  }
};

export const getCustomerBalance = (business, customerId) => {
  try {
    const invoiced = (business.salesInvoices || [])
      .filter(inv => inv.customerId === customerId)
      .reduce((sum, inv) => sum + (inv.total || 0), 0);
    const received = (business.receipts || [])
      .filter(r => r.customerId === customerId)
      .reduce((sum, r) => sum + (r.amount || 0), 0);
    return invoiced - received;
  } catch (e) {
    return 0;
  }
};

export const getSupplierBalance = (business, supplierId) => {
  try {
    const billed = (business.purchaseInvoices || [])
      .filter(inv => inv.supplierId === supplierId)
      .reduce((sum, inv) => sum + (inv.total || 0), 0);
    const paid = (business.payments || [])
      .filter(p => p.supplierId === supplierId)
      .reduce((sum, p) => sum + (p.amount || 0), 0);
    return billed - paid;
  } catch (e) {
    return 0;
  }
};

export const getTotalReceivables = (business) => {
  try {
    return (business.customers || []).reduce(
      (sum, c) => sum + Math.max(0, getCustomerBalance(business, c.id)),
      0
    );
  } catch (e) {
    return 0;
  }
};

export const getTotalPayables = (business) => {
  try {
    return (business.suppliers || []).reduce(
      (sum, s) => sum + Math.max(0, getSupplierBalance(business, s.id)),
      0
    );
  } catch (e) {
    return 0;
  }
};

export const getCashBalance = (business) => {
  try {
    return (business.bankAccounts || [])
      .filter(a => a.type === 'cash')
      .reduce((sum, a) => sum + (a.balance || 0), 0);
  } catch (e) {
    return 0;
  }
};

export const getBankBalance = (business) => {
  try {
    return (business.bankAccounts || [])
      .filter(a => a.type === 'bank')
      .reduce((sum, a) => sum + (a.balance || 0), 0);
  } catch (e) {
    return 0;
  }
};

export const getInvoiceStatus = (invoice) => {
  try {
    const paid = invoice.amountPaid || 0;
    if (paid >= invoice.total) return 'paid';
    if (paid > 0) return 'partial';
    return 'due';
  } catch (e) {
    return 'due';
  }
};

export const generateId = () =>
  Date.now().toString() + Math.random().toString(36).slice(2, 6);