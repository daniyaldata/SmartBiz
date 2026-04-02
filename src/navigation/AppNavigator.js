import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createStackNavigator } from '@react-navigation/stack';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../theme/colors';

import DashboardScreen from '../screens/DashboardScreen';
import MoneyScreen from '../screens/MoneyScreen';
import SalesScreen from '../screens/SalesScreen';
import PurchasesScreen from '../screens/PurchasesScreen';
import MoreScreen from '../screens/MoreScreen';

import CustomersScreen from '../screens/sales/CustomersScreen';
import CustomerFormScreen from '../screens/sales/CustomerFormScreen';
import CustomerLedgerScreen from '../screens/sales/CustomerLedgerScreen';
import SalesInvoicesScreen from '../screens/sales/SalesInvoicesScreen';
import SalesInvoiceFormScreen from '../screens/sales/SalesInvoiceFormScreen';
import SalesInvoiceViewScreen from '../screens/sales/SalesInvoiceViewScreen';

import SuppliersScreen from '../screens/purchases/SuppliersScreen';
import SupplierFormScreen from '../screens/purchases/SupplierFormScreen';
import SupplierLedgerScreen from '../screens/purchases/SupplierLedgerScreen';
import PurchaseInvoicesScreen from '../screens/purchases/PurchaseInvoicesScreen';
import PurchaseInvoiceFormScreen from '../screens/purchases/PurchaseInvoiceFormScreen';
import PurchaseInvoiceViewScreen from '../screens/purchases/PurchaseInvoiceViewScreen';

import AccountsScreen from '../screens/money/AccountsScreen';
import ReceiptsScreen from '../screens/money/ReceiptsScreen';
import ReceiptFormScreen from '../screens/money/ReceiptFormScreen';
import PaymentsScreen from '../screens/money/PaymentsScreen';
import PaymentFormScreen from '../screens/money/PaymentFormScreen';

import InventoryScreen from '../screens/more/InventoryScreen';
import ItemFormScreen from '../screens/more/ItemFormScreen';
import SettingsScreen from '../screens/more/SettingsScreen';
import BackupRestoreScreen from '../screens/more/BackupRestoreScreen';

const Tab = createBottomTabNavigator();
const Stack = createStackNavigator();

const tabs = [
  {
    name: 'Dashboard',
    component: DashboardScreen,
    icon: 'grid-outline',
    iconFocused: 'grid',
  },
  {
    name: 'Money',
    component: MoneyScreen,
    icon: 'wallet-outline',
    iconFocused: 'wallet',
  },
  {
    name: 'Sales',
    component: SalesScreen,
    icon: 'trending-up-outline',
    iconFocused: 'trending-up',
  },
  {
    name: 'Purchases',
    component: PurchasesScreen,
    icon: 'cart-outline',
    iconFocused: 'cart',
  },
  {
    name: 'More',
    component: MoreScreen,
    icon: 'menu-outline',
    iconFocused: 'menu',
  },
];

function TabNavigator({ route }) {
  const businessParams = route?.params;
  return (
    <Tab.Navigator
      screenOptions={({ route: r }) => {
        const tab = tabs.find(t => t.name === r.name);
        return {
          headerShown: false,
          tabBarActiveTintColor: colors.tabActive,
          tabBarInactiveTintColor: colors.tabInactive,
          tabBarStyle: {
            backgroundColor: '#fff',
            borderTopWidth: 1,
            borderTopColor: colors.border,
            height: 62,
            paddingBottom: 8,
            paddingTop: 6,
          },
          tabBarLabelStyle: { fontSize: 11, fontWeight: '600' },
          tabBarIcon: ({ focused, color }) => (
            <Ionicons
              name={focused ? tab.iconFocused : tab.icon}
              size={23}
              color={color}
            />
          ),
        };
      }}
    >
      {tabs.map(tab => (
        <Tab.Screen
          key={tab.name}
          name={tab.name}
          component={tab.component}
          initialParams={businessParams}
        />
      ))}
    </Tab.Navigator>
  );
}

export default function AppNavigator({ route }) {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen
        name="Tabs"
        component={TabNavigator}
        initialParams={route?.params}
      />

      <Stack.Screen name="Customers" component={CustomersScreen} />
      <Stack.Screen name="CustomerForm" component={CustomerFormScreen} />
      <Stack.Screen name="CustomerLedger" component={CustomerLedgerScreen} />
      <Stack.Screen name="SalesInvoices" component={SalesInvoicesScreen} />
      <Stack.Screen name="SalesInvoiceForm" component={SalesInvoiceFormScreen} />
      <Stack.Screen name="SalesInvoiceView" component={SalesInvoiceViewScreen} />

      <Stack.Screen name="Suppliers" component={SuppliersScreen} />
      <Stack.Screen name="SupplierForm" component={SupplierFormScreen} />
      <Stack.Screen name="SupplierLedger" component={SupplierLedgerScreen} />
      <Stack.Screen name="PurchaseInvoices" component={PurchaseInvoicesScreen} />
      <Stack.Screen name="PurchaseInvoiceForm" component={PurchaseInvoiceFormScreen} />
      <Stack.Screen name="PurchaseInvoiceView" component={PurchaseInvoiceViewScreen} />

      <Stack.Screen name="Accounts" component={AccountsScreen} />
      <Stack.Screen name="Receipts" component={ReceiptsScreen} />
      <Stack.Screen name="ReceiptForm" component={ReceiptFormScreen} />
      <Stack.Screen name="Payments" component={PaymentsScreen} />
      <Stack.Screen name="PaymentForm" component={PaymentFormScreen} />

      <Stack.Screen name="Inventory" component={InventoryScreen} />
      <Stack.Screen name="ItemForm" component={ItemFormScreen} />
      <Stack.Screen name="Settings" component={SettingsScreen} />
      <Stack.Screen name="BackupRestore" component={BackupRestoreScreen} />
    </Stack.Navigator>
  );
}