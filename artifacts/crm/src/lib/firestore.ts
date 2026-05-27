import {
  collection,
  doc,
  getDocs,
  getDoc,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  setDoc,
} from "firebase/firestore";
import { db } from "./firebase";

function byCreatedAtDesc<T extends { createdAt: string }>(a: T, b: T) {
  return b.createdAt.localeCompare(a.createdAt);
}

function stripUndefined(obj: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== undefined));
}

// ── Customer ────────────────────────────────────────────────────────────────

export interface Customer {
  id: string;
  companyId: string;
  name: string;
  email: string;
  phone?: string;
  phones?: string[];
  address?: string;
  notes?: string;
  lat?: number;
  lng?: number;
  createdAt: string;
}

export function getCustomerPhones(c: Customer): string[] {
  if (c.phones && c.phones.length > 0) return c.phones.filter(Boolean);
  if (c.phone) return [c.phone];
  return [];
}

export async function getCustomers(companyId: string): Promise<Customer[]> {
  const q = query(collection(db, "customers"), where("companyId", "==", companyId));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as Customer)).sort(byCreatedAtDesc);
}

export async function getCustomer(id: string): Promise<Customer | null> {
  const snap = await getDoc(doc(db, "customers", id));
  if (!snap.exists()) return null;
  return { id: snap.id, ...snap.data() } as Customer;
}

export async function addCustomer(data: Omit<Customer, "id" | "createdAt">) {
  return addDoc(collection(db, "customers"), stripUndefined({ ...data, createdAt: new Date().toISOString() }));
}

export async function updateCustomer(id: string, data: Partial<Customer>) {
  return updateDoc(doc(db, "customers", id), stripUndefined(data as Record<string, unknown>));
}

export async function deleteCustomer(id: string) {
  return deleteDoc(doc(db, "customers", id));
}

// ── Customer Visits ──────────────────────────────────────────────────────────

export interface CustomerVisit {
  id: string;
  customerId: string;
  lat: number;
  lng: number;
  timestamp: string;
  note?: string;
}

export async function getCustomerVisits(customerId: string): Promise<CustomerVisit[]> {
  const snap = await getDocs(collection(db, "customers", customerId, "visits"));
  return snap.docs
    .map((d) => ({ id: d.id, ...d.data() } as CustomerVisit))
    .sort((a, b) => b.timestamp.localeCompare(a.timestamp));
}

export async function addCustomerVisit(
  customerId: string,
  data: Omit<CustomerVisit, "id">
) {
  return addDoc(collection(db, "customers", customerId, "visits"), data);
}

// ── Invoice ──────────────────────────────────────────────────────────────────

export interface InvoiceItem {
  description: string;
  quantity: number;
  unitPrice: number;
}

export interface Invoice {
  id: string;
  companyId: string;
  customerId: string;
  customerName: string;
  invoiceNumber: string;
  status: "draft" | "sent" | "paid" | "overdue" | "cancelled";
  items: InvoiceItem[];
  subtotal: number;
  taxEnabled: boolean;
  taxRate?: number;
  taxAmount?: number;
  discountEnabled: boolean;
  discountType?: "percent" | "fixed";
  discountValue?: number;
  discountAmount?: number;
  total: number;
  currency?: string;
  notes?: string;
  dueDate?: string;
  poNumber?: string;
  createdAt: string;
}

export async function getInvoices(companyId: string): Promise<Invoice[]> {
  const q = query(collection(db, "invoices"), where("companyId", "==", companyId));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as Invoice)).sort(byCreatedAtDesc);
}

export async function getInvoice(id: string): Promise<Invoice | null> {
  const snap = await getDoc(doc(db, "invoices", id));
  if (!snap.exists()) return null;
  return { id: snap.id, ...snap.data() } as Invoice;
}

export async function addInvoice(data: Omit<Invoice, "id" | "createdAt">) {
  return addDoc(collection(db, "invoices"), stripUndefined({ ...data, createdAt: new Date().toISOString() }));
}

export async function updateInvoice(id: string, data: Partial<Invoice>) {
  return updateDoc(doc(db, "invoices", id), stripUndefined(data as Record<string, unknown>));
}

export async function deleteInvoice(id: string) {
  return deleteDoc(doc(db, "invoices", id));
}

// ── Quotation ─────────────────────────────────────────────────────────────────

export interface Quotation {
  id: string;
  companyId: string;
  customerId: string;
  customerName: string;
  quoteNumber: string;
  status: "draft" | "sent" | "accepted" | "declined" | "expired";
  items: InvoiceItem[];
  subtotal: number;
  taxEnabled: boolean;
  taxRate?: number;
  taxAmount?: number;
  discountEnabled: boolean;
  discountType?: "percent" | "fixed";
  discountValue?: number;
  discountAmount?: number;
  total: number;
  currency?: string;
  notes?: string;
  validUntil?: string;
  createdAt: string;
}

export async function getQuotations(companyId: string): Promise<Quotation[]> {
  const q = query(collection(db, "quotations"), where("companyId", "==", companyId));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as Quotation)).sort(byCreatedAtDesc);
}

export async function getQuotation(id: string): Promise<Quotation | null> {
  const snap = await getDoc(doc(db, "quotations", id));
  if (!snap.exists()) return null;
  return { id: snap.id, ...snap.data() } as Quotation;
}

export async function addQuotation(data: Omit<Quotation, "id" | "createdAt">) {
  return addDoc(collection(db, "quotations"), stripUndefined({ ...data, createdAt: new Date().toISOString() }));
}

export async function updateQuotation(id: string, data: Partial<Quotation>) {
  return updateDoc(doc(db, "quotations", id), stripUndefined(data as Record<string, unknown>));
}

export async function deleteQuotation(id: string) {
  return deleteDoc(doc(db, "quotations", id));
}

export async function getNextQuoteNumber(companyId: string, prefix: string): Promise<string> {
  const q = query(collection(db, "quotations"), where("companyId", "==", companyId));
  const snap = await getDocs(q);
  return `${prefix}QT-${String(snap.size + 1).padStart(4, "0")}`;
}

// ── Task ─────────────────────────────────────────────────────────────────────

export interface Task {
  id: string;
  companyId: string;
  title: string;
  description?: string;
  customerId?: string;
  customerName?: string;
  status: "todo" | "in-progress" | "done";
  priority: "low" | "medium" | "high";
  dueDate?: string;
  createdAt: string;
}

export async function getTasks(companyId: string): Promise<Task[]> {
  const q = query(collection(db, "tasks"), where("companyId", "==", companyId));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as Task)).sort(byCreatedAtDesc);
}

export async function addTask(data: Omit<Task, "id" | "createdAt">) {
  return addDoc(collection(db, "tasks"), stripUndefined({ ...data, createdAt: new Date().toISOString() }));
}

export async function updateTask(id: string, data: Partial<Task>) {
  return updateDoc(doc(db, "tasks", id), stripUndefined(data as Record<string, unknown>));
}

export async function deleteTask(id: string) {
  return deleteDoc(doc(db, "tasks", id));
}

// ── Transaction (Income / Expense) ────────────────────────────────────────────

export const INCOME_CATEGORIES = ["Service", "AMC", "Sales", "Rental", "Consultation", "Commission", "Other"] as const;
export const EXPENSE_CATEGORIES = ["Stock", "Fuel", "Salary", "Commission", "Rent", "Utilities", "Maintenance", "Marketing", "Other"] as const;

export interface Transaction {
  id: string;
  companyId: string;
  type: "income" | "expense";
  category: string;
  amount: number;
  date: string;        // YYYY-MM-DD
  description: string;
  reference?: string;
  source?: "invoice" | "manual";
  invoiceId?: string;
  createdAt: string;
}

// Creates or overwrites an income transaction tied to a paid invoice.
// Uses a deterministic doc ID (inv_<invoiceId>) so it's idempotent.
export async function syncInvoiceIncome(params: {
  companyId: string;
  invoiceId: string;
  invoiceNumber: string;
  customerName: string;
  total: number;
  currency?: string;
  date?: string;
}): Promise<void> {
  const txId = `inv_${params.invoiceId}`;
  await setDoc(doc(db, "transactions", txId), {
    companyId: params.companyId,
    type: "income",
    category: "Sales",
    amount: params.total,
    date: params.date || new Date().toISOString().slice(0, 10),
    description: `Invoice ${params.invoiceNumber}${params.customerName ? ` — ${params.customerName}` : ""}`,
    reference: params.invoiceNumber,
    source: "invoice",
    invoiceId: params.invoiceId,
    createdAt: new Date().toISOString(),
  });
}

export async function getTransaction(id: string): Promise<Transaction | null> {
  const snap = await getDoc(doc(db, "transactions", id));
  if (!snap.exists()) return null;
  return { id: snap.id, ...snap.data() } as Transaction;
}

export async function getTransactions(companyId: string): Promise<Transaction[]> {
  const q = query(collection(db, "transactions"), where("companyId", "==", companyId));
  const snap = await getDocs(q);
  return snap.docs
    .map((d) => ({ id: d.id, ...d.data() } as Transaction))
    .sort((a, b) => b.date.localeCompare(a.date));
}

export async function addTransaction(data: Omit<Transaction, "id" | "createdAt">) {
  return addDoc(collection(db, "transactions"), { ...data, createdAt: new Date().toISOString() });
}

export async function updateTransaction(id: string, data: Partial<Transaction>) {
  return updateDoc(doc(db, "transactions", id), stripUndefined(data as Record<string, unknown>));
}

export async function deleteTransaction(id: string) {
  return deleteDoc(doc(db, "transactions", id));
}

// ── Settings ──────────────────────────────────────────────────────────────────

export interface Settings {
  companyId: string;
  companyName: string;
  companyLogo?: string;
  currency: string;
  invoicePrefix: string;
  quotationPrefix?: string;
  taxEnabled: boolean;
  taxRate: number;
  taxLabel?: string;
  trn?: string;
  discountEnabled: boolean;
  address?: string;
  phone?: string;
  email?: string;
  website?: string;
  bankName?: string;
  bankAccount?: string;
  bankIban?: string;
  paymentTerms?: string;
  invoiceFooter?: string;
  incomeCategories?: string[];
  expenseCategories?: string[];
}

export async function getSettings(companyId: string): Promise<Settings | null> {
  const snap = await getDoc(doc(db, "settings", companyId));
  if (!snap.exists()) return null;
  return { companyId, ...snap.data() } as Settings;
}

export async function saveSettings(companyId: string, data: Partial<Settings>) {
  return setDoc(doc(db, "settings", companyId), data, { merge: true });
}

// ── Company ───────────────────────────────────────────────────────────────────

export interface Company {
  id: string;
  name: string;
  ownerId: string;
  createdAt: string;
}

export async function getNextInvoiceNumber(companyId: string, prefix: string): Promise<string> {
  const q = query(collection(db, "invoices"), where("companyId", "==", companyId));
  const snap = await getDocs(q);
  return `${prefix}${String(snap.size + 1).padStart(4, "0")}`;
}
