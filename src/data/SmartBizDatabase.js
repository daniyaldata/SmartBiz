import * as SQLite from 'expo-sqlite';

// ─── Database singleton ───────────────────────────────────────────────────────
let _db = null;

const getDb = async () => {
  if (!_db) {
    _db = await SQLite.openDatabaseAsync('smartbiz_stats.db');
    await initSchema(_db);
  }
  return _db;
};

// ─── Schema ───────────────────────────────────────────────────────────────────
const initSchema = async (db) => {
  await db.execAsync(`
    PRAGMA journal_mode = WAL;

    CREATE TABLE IF NOT EXISTS sales_invoices (
      id TEXT PRIMARY KEY,
      business_id TEXT NOT NULL,
      customer_id TEXT,
      customer_name TEXT,
      date TEXT NOT NULL,
      total REAL DEFAULT 0,
      amount_paid REAL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS sales_invoice_lines (
      id TEXT PRIMARY KEY,
      invoice_id TEXT NOT NULL,
      item_id TEXT,
      item_name TEXT,
      qty REAL DEFAULT 0,
      rate REAL DEFAULT 0,
      amount REAL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS purchase_invoices (
      id TEXT PRIMARY KEY,
      business_id TEXT NOT NULL,
      supplier_id TEXT,
      supplier_name TEXT,
      date TEXT NOT NULL,
      total REAL DEFAULT 0,
      amount_paid REAL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS purchase_invoice_lines (
      id TEXT PRIMARY KEY,
      invoice_id TEXT NOT NULL,
      item_id TEXT,
      item_name TEXT,
      qty REAL DEFAULT 0,
      rate REAL DEFAULT 0,
      amount REAL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS transactions (
      id TEXT PRIMARY KEY,
      business_id TEXT NOT NULL,
      transaction_type TEXT NOT NULL,
      party_id TEXT,
      party_name TEXT,
      party_type TEXT,
      account_id TEXT,
      from_account_id TEXT,
      to_account_id TEXT,
      expense_account_id TEXT,
      expense_account_name TEXT,
      income_account_id TEXT,
      income_account_name TEXT,
      linked_invoice_id TEXT,
      amount REAL DEFAULT 0,
      date TEXT NOT NULL,
      is_write_off INTEGER DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS journal_entries (
      id TEXT PRIMARY KEY,
      business_id TEXT NOT NULL,
      date TEXT NOT NULL,
      description TEXT
    );

    CREATE TABLE IF NOT EXISTS journal_entry_lines (
      id TEXT PRIMARY KEY,
      journal_entry_id TEXT NOT NULL,
      account_id TEXT,
      account_category TEXT,
      linked_customer_id TEXT,
      linked_supplier_id TEXT,
      qty REAL DEFAULT 0,
      debit REAL DEFAULT 0,
      credit REAL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS inventory_write_offs (
      id TEXT PRIMARY KEY,
      business_id TEXT NOT NULL,
      item_id TEXT NOT NULL,
      item_name TEXT,
      qty REAL DEFAULT 0,
      cost_price REAL DEFAULT 0,
      amount REAL DEFAULT 0,
      date TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS customers (
      id TEXT PRIMARY KEY,
      business_id TEXT NOT NULL,
      display_name TEXT,
      opening_balance REAL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS suppliers (
      id TEXT PRIMARY KEY,
      business_id TEXT NOT NULL,
      display_name TEXT,
      opening_balance REAL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS items (
      id TEXT PRIMARY KEY,
      business_id TEXT NOT NULL,
      name TEXT NOT NULL,
      stock REAL DEFAULT 0,
      purchase_price REAL DEFAULT 0,
      opening_stock REAL DEFAULT 0,
      opening_stock_rate REAL DEFAULT 0,
      created_at TEXT
    );

    CREATE INDEX IF NOT EXISTS idx_si_biz  ON sales_invoices(business_id);
    CREATE INDEX IF NOT EXISTS idx_si_date ON sales_invoices(date);
    CREATE INDEX IF NOT EXISTS idx_sil_inv ON sales_invoice_lines(invoice_id);
    CREATE INDEX IF NOT EXISTS idx_sil_item ON sales_invoice_lines(item_name);
    CREATE INDEX IF NOT EXISTS idx_pi_biz  ON purchase_invoices(business_id);
    CREATE INDEX IF NOT EXISTS idx_pil_inv ON purchase_invoice_lines(invoice_id);
    CREATE INDEX IF NOT EXISTS idx_pil_item ON purchase_invoice_lines(item_name);
    CREATE INDEX IF NOT EXISTS idx_txn_biz  ON transactions(business_id);
    CREATE INDEX IF NOT EXISTS idx_txn_date ON transactions(date);
    CREATE INDEX IF NOT EXISTS idx_je_biz   ON journal_entries(business_id);
    CREATE INDEX IF NOT EXISTS idx_jel_je   ON journal_entry_lines(journal_entry_id);
  `);
};

// ─── Load business JSON into SQLite ──────────────────────────────────────────
// Called every time Statistics screen opens. Clears and repopulates so
// SQLite always reflects the latest AsyncStorage state.

export const initFromBusiness = async (biz) => {
  const db = await getDb();
  const bid = biz.id;

  await db.withTransactionAsync(async () => {
    // Clear existing data for this business
    await db.runAsync('DELETE FROM sales_invoice_lines WHERE invoice_id IN (SELECT id FROM sales_invoices WHERE business_id = ?)', [bid]);
    await db.runAsync('DELETE FROM sales_invoices WHERE business_id = ?', [bid]);
    await db.runAsync('DELETE FROM purchase_invoice_lines WHERE invoice_id IN (SELECT id FROM purchase_invoices WHERE business_id = ?)', [bid]);
    await db.runAsync('DELETE FROM purchase_invoices WHERE business_id = ?', [bid]);
    await db.runAsync('DELETE FROM transactions WHERE business_id = ?', [bid]);
    await db.runAsync('DELETE FROM journal_entry_lines WHERE journal_entry_id IN (SELECT id FROM journal_entries WHERE business_id = ?)', [bid]);
    await db.runAsync('DELETE FROM journal_entries WHERE business_id = ?', [bid]);
    await db.runAsync('DELETE FROM inventory_write_offs WHERE business_id = ?', [bid]);
    await db.runAsync('DELETE FROM customers WHERE business_id = ?', [bid]);
    await db.runAsync('DELETE FROM suppliers WHERE business_id = ?', [bid]);
    await db.runAsync('DELETE FROM items WHERE business_id = ?', [bid]);

    // Insert customers
    for (const c of biz.customers || []) {
      await db.runAsync(
        'INSERT INTO customers VALUES (?, ?, ?, ?)',
        [c.id, bid, c.displayName || '', c.openingBalance || 0]
      );
    }

    // Insert suppliers
    for (const s of biz.suppliers || []) {
      await db.runAsync(
        'INSERT INTO suppliers VALUES (?, ?, ?, ?)',
        [s.id, bid, s.displayName || '', s.openingBalance || 0]
      );
    }

    // Insert items
    for (const item of biz.items || []) {
      await db.runAsync(
        'INSERT INTO items VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
        [item.id, bid, item.name, item.stock || 0,
         item.purchasePrice || item.costPrice || 0,
         item.openingStock || 0,
         item.openingStockRate || item.costPrice || 0,
         item.createdAt || null]
      );
    }

    // Insert sales invoices + lines
    for (const inv of biz.salesInvoices || []) {
      await db.runAsync(
        'INSERT INTO sales_invoices VALUES (?, ?, ?, ?, ?, ?, ?)',
        [inv.id, bid, inv.customerId || null,
         inv.customerName || null, inv.date,
         inv.total || 0, inv.amountPaid || 0]
      );
      for (const line of inv.lines || []) {
        const lineId = `${inv.id}_${line.id || Math.random().toString(36).slice(2)}`;
        await db.runAsync(
          'INSERT INTO sales_invoice_lines VALUES (?, ?, ?, ?, ?, ?, ?)',
          [lineId, inv.id, line.itemId || null,
           line.description || '',
           parseFloat(line.qty) || 0,
           parseFloat(line.rate) || 0,
           (parseFloat(line.qty) || 0) * (parseFloat(line.rate) || 0)]
        );
      }
    }

    // Insert purchase invoices + lines
    for (const inv of biz.purchaseInvoices || []) {
      await db.runAsync(
        'INSERT INTO purchase_invoices VALUES (?, ?, ?, ?, ?, ?, ?)',
        [inv.id, bid, inv.supplierId || null,
         inv.supplierName || null, inv.date,
         inv.total || 0, inv.amountPaid || 0]
      );
      for (const line of inv.lines || []) {
        const lineId = `${inv.id}_${line.id || Math.random().toString(36).slice(2)}`;
        await db.runAsync(
          'INSERT INTO purchase_invoice_lines VALUES (?, ?, ?, ?, ?, ?, ?)',
          [lineId, inv.id, line.itemId || null,
           line.description || '',
           parseFloat(line.qty) || 0,
           parseFloat(line.rate) || 0,
           (parseFloat(line.qty) || 0) * (parseFloat(line.rate) || 0)]
        );
      }
    }

    // Insert transactions
    for (const t of biz.transactions || []) {
      await db.runAsync(
        `INSERT INTO transactions VALUES
         (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [t.id, bid, t.transactionType,
         t.partyId || null, t.partyName || null, t.partyType || null,
         t.accountId || null,
         t.fromAccountId || null, t.toAccountId || null,
         t.expenseAccountId || null, t.expenseAccountName || null,
         t.incomeAccountId || null, t.incomeAccountName || null,
         t.linkedInvoiceId || null,
         t.amount || 0, t.date,
         t.isWriteOff ? 1 : 0]
      );
    }

    // Insert journal entries + lines
    for (const je of biz.journalEntries || []) {
      await db.runAsync(
        'INSERT INTO journal_entries VALUES (?, ?, ?, ?)',
        [je.id, bid, je.date, je.description || '']
      );
      for (const line of je.lines || []) {
        const lineId = `${je.id}_${line.lineId || Math.random().toString(36).slice(2)}`;
        await db.runAsync(
          'INSERT INTO journal_entry_lines VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
          [lineId, je.id,
           line.accountId || null, line.accountCategory || null,
           line.linkedCustomerId || null, line.linkedSupplierId || null,
           parseFloat(line.qty) || 0,
           line.debit || 0, line.credit || 0]
        );
      }
    }

    // Insert write-offs
    for (const w of biz.inventoryWriteOffs || []) {
      await db.runAsync(
        'INSERT INTO inventory_write_offs VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
        [w.id, bid, w.itemId, w.itemName || '',
         w.qty || 0, w.costPrice || 0,
         w.amount || 0, w.date]
      );
    }
  });
};

// ─── SQL Query Functions ──────────────────────────────────────────────────────

// Total sales revenue in date range
export const querySalesRevenue = async (businessId, startDate, endDate) => {
  const db = await getDb();
  const result = await db.getFirstAsync(
    `SELECT
       COUNT(*) as invoice_count,
       COALESCE(SUM(total), 0) as total_sales
     FROM sales_invoices
     WHERE business_id = ?
       AND date >= ? AND date <= ?`,
    [businessId, startDate, endDate]
  );
  return result;
};

// Total payments (cash out) in date range — excludes write-offs and no-account txns
export const queryCashIn = async (businessId, startDate, endDate) => {
  const db = await getDb();
  const rows = await db.getAllAsync(
    `SELECT
       COALESCE(party_name, income_account_name, 'Other') as source,
       SUM(amount) as total
     FROM transactions
     WHERE business_id = ?
       AND transaction_type = 'receipt'
       AND date >= ? AND date <= ?
     GROUP BY source
     ORDER BY total DESC`,
    [businessId, startDate, endDate]
  );
  const total = rows.reduce((s, r) => s + r.total, 0);
  return { rows, total };
};

export const queryCashOut = async (businessId, startDate, endDate) => {
  const db = await getDb();
  const rows = await db.getAllAsync(
    `SELECT
       COALESCE(expense_account_name, party_name, 'Other') as category,
       SUM(amount) as total
     FROM transactions
     WHERE business_id = ?
       AND transaction_type = 'payment'
       AND date >= ? AND date <= ?
       AND is_write_off = 0
       AND account_id IS NOT NULL
     GROUP BY category
     ORDER BY total DESC`,
    [businessId, startDate, endDate]
  );
  const total = rows.reduce((s, r) => s + r.total, 0);
  return { rows, total };
};

// Journal cash movements (bank account credits/debits in journal entries)
export const queryJournalCashMovements = async (businessId, startDate, endDate) => {
  const db = await getDb();
  const cashIn = await db.getFirstAsync(
    `SELECT COALESCE(SUM(jel.debit), 0) as total
     FROM journal_entry_lines jel
     JOIN journal_entries je ON je.id = jel.journal_entry_id
     WHERE je.business_id = ?
       AND je.date >= ? AND je.date <= ?
       AND jel.account_category = 'bank'
       AND jel.debit > 0`,
    [businessId, startDate, endDate]
  );
  const cashOut = await db.getFirstAsync(
    `SELECT COALESCE(SUM(jel.credit), 0) as total
     FROM journal_entry_lines jel
     JOIN journal_entries je ON je.id = jel.journal_entry_id
     WHERE je.business_id = ?
       AND je.date >= ? AND je.date <= ?
       AND jel.account_category = 'bank'
       AND jel.credit > 0`,
    [businessId, startDate, endDate]
  );
  return {
    journalCashIn: cashIn?.total || 0,
    journalCashOut: cashOut?.total || 0,
  };
};

// Expense breakdown from payment transactions
export const queryExpenses = async (businessId, startDate, endDate) => {
  const db = await getDb();
  const rows = await db.getAllAsync(
    `SELECT
       COALESCE(expense_account_name, 'Other') as category,
       SUM(amount) as total
     FROM transactions
     WHERE business_id = ?
       AND transaction_type = 'payment'
       AND date >= ? AND date <= ?
       AND is_write_off = 0
       AND expense_account_id IS NOT NULL
     GROUP BY category
     ORDER BY total DESC`,
    [businessId, startDate, endDate]
  );
  return rows;
};

// Journal expense lines in date range
export const queryJournalExpenses = async (businessId, startDate, endDate) => {
  const db = await getDb();
  const rows = await db.getAllAsync(
    `SELECT
       jel.account_id as category,
       SUM(jel.debit) as total
     FROM journal_entry_lines jel
     JOIN journal_entries je ON je.id = jel.journal_entry_id
     WHERE je.business_id = ?
       AND je.date >= ? AND je.date <= ?
       AND jel.account_category = 'expense'
       AND jel.debit > 0
     GROUP BY jel.account_id`,
    [businessId, startDate, endDate]
  );
  return rows;
};

// Inventory purchase history for one item — for avg cost calculation
export const queryItemPurchaseHistory = async (businessId, itemName) => {
  const db = await getDb();
  const rows = await db.getAllAsync(
    `SELECT
       pi.date,
       pil.qty,
       pil.rate
     FROM purchase_invoice_lines pil
     JOIN purchase_invoices pi ON pi.id = pil.invoice_id
     WHERE pi.business_id = ?
       AND LOWER(TRIM(pil.item_name)) = LOWER(TRIM(?))
       AND pil.qty > 0
     ORDER BY pi.date ASC`,
    [businessId, itemName]
  );
  return rows;
};

// Sales of an item in a date range — for COGS calculation
export const queryItemSalesInPeriod = async (businessId, itemName, startDate, endDate) => {
  const db = await getDb();
  const rows = await db.getAllAsync(
    `SELECT
       si.date,
       sil.qty
     FROM sales_invoice_lines sil
     JOIN sales_invoices si ON si.id = sil.invoice_id
     WHERE si.business_id = ?
       AND LOWER(TRIM(sil.item_name)) = LOWER(TRIM(?))
       AND si.date >= ? AND si.date <= ?
       AND sil.qty > 0
     ORDER BY si.date ASC`,
    [businessId, itemName, startDate, endDate]
  );
  return rows;
};

// Total receivables (invoiced - paid + opening balances)
export const queryReceivables = async (businessId) => {
  const db = await getDb();

  // Opening balances
  const opening = await db.getFirstAsync(
    `SELECT COALESCE(SUM(opening_balance), 0) as total
     FROM customers WHERE business_id = ?`,
    [businessId]
  );

  // Total invoiced
  const invoiced = await db.getFirstAsync(
    `SELECT COALESCE(SUM(total), 0) as total
     FROM sales_invoices WHERE business_id = ?`,
    [businessId]
  );

  // Total received from customers
  const received = await db.getFirstAsync(
    `SELECT COALESCE(SUM(amount), 0) as total
     FROM transactions
     WHERE business_id = ?
       AND transaction_type = 'receipt'
       AND party_type = 'customer'`,
    [businessId]
  );

  // Journal adjustments on customers
  const journalDebits = await db.getFirstAsync(
    `SELECT COALESCE(SUM(jel.debit), 0) as total
     FROM journal_entry_lines jel
     JOIN journal_entries je ON je.id = jel.journal_entry_id
     WHERE je.business_id = ?
       AND jel.account_category = 'customer'`,
    [businessId]
  );
  const journalCredits = await db.getFirstAsync(
    `SELECT COALESCE(SUM(jel.credit), 0) as total
     FROM journal_entry_lines jel
     JOIN journal_entries je ON je.id = jel.journal_entry_id
     WHERE je.business_id = ?
       AND jel.account_category = 'customer'`,
    [businessId]
  );

  const total = Math.max(0,
    (opening?.total || 0) +
    (invoiced?.total || 0) +
    (journalDebits?.total || 0) -
    (received?.total || 0) -
    (journalCredits?.total || 0)
  );

  return total;
};

// Total payables
export const queryPayables = async (businessId) => {
  const db = await getDb();

  const opening = await db.getFirstAsync(
    `SELECT COALESCE(SUM(opening_balance), 0) as total
     FROM suppliers WHERE business_id = ?`,
    [businessId]
  );
  const billed = await db.getFirstAsync(
    `SELECT COALESCE(SUM(total), 0) as total
     FROM purchase_invoices WHERE business_id = ?`,
    [businessId]
  );
  const paid = await db.getFirstAsync(
    `SELECT COALESCE(SUM(amount), 0) as total
     FROM transactions
     WHERE business_id = ?
       AND transaction_type = 'payment'
       AND party_type = 'supplier'`,
    [businessId]
  );
  const journalDebits = await db.getFirstAsync(
    `SELECT COALESCE(SUM(jel.debit), 0) as total
     FROM journal_entry_lines jel
     JOIN journal_entries je ON je.id = jel.journal_entry_id
     WHERE je.business_id = ?
       AND jel.account_category = 'supplier'`,
    [businessId]
  );
  const journalCredits = await db.getFirstAsync(
    `SELECT COALESCE(SUM(jel.credit), 0) as total
     FROM journal_entry_lines jel
     JOIN journal_entries je ON je.id = jel.journal_entry_id
     WHERE je.business_id = ?
       AND jel.account_category = 'supplier'`,
    [businessId]
  );

  const total = Math.max(0,
    (opening?.total || 0) +
    (billed?.total || 0) +
    (journalCredits?.total || 0) -
    (paid?.total || 0) -
    (journalDebits?.total || 0)
  );

  return total;
};

// Write-off losses in period (using stored amount which uses weighted avg cost)
export const queryWriteOffLosses = async (businessId, startDate, endDate) => {
  const db = await getDb();
  const rows = await db.getAllAsync(
    `SELECT item_name, SUM(qty) as total_qty, SUM(amount) as total_loss
     FROM inventory_write_offs
     WHERE business_id = ?
       AND date >= ? AND date <= ?
     GROUP BY item_name`,
    [businessId, startDate, endDate]
  );
  const total = rows.reduce((s, r) => s + (r.total_loss || 0), 0);
  return { rows, total };
};

// Get all items for inventory valuation
export const queryItems = async (businessId) => {
  const db = await getDb();
  return await db.getAllAsync(
    `SELECT * FROM items WHERE business_id = ?`,
    [businessId]
  );
};