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

// ── Customer ────────────────────────────────────────────────────────────────

export interface Customer {
  id: string;
  companyId: string;
  name: string;
  email: string;
  phone?: string;
  address?: string;
  notes?: string;
  createdAt: string;
}

export async function getCustomers(companyId: string): Promise<Customer[]> {
  const q = query(collection(db, "customers"), where("companyId", "==", companyId));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as Customer)).sort(byCreatedAtDesc);
}

export async function addCustomer(data: Omit<Customer, "id" | "createdAt">) {
  return addDoc(collection(db, "customers"), { ...data, createdAt: new Date().toISOString() });
}

export async function updateCustomer(id: string, data: Partial<Customer>) {
  return updateDoc(doc(db, "customers", id), data);
}

export async function deleteCustomer(id: string) {
  return deleteDoc(doc(db, "customers", id));
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
  return addDoc(collection(db, "invoices"), { ...data, createdAt: new Date().toISOString() });
}

export async function updateInvoice(id: string, data: Partial<Invoice>) {
  return updateDoc(doc(db, "invoices", id), data);
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
  return addDoc(collection(db, "quotations"), { ...data, createdAt: new Date().toISOString() });
}

export async function updateQuotation(id: string, data: Partial<Quotation>) {
  return updateDoc(doc(db, "quotations", id), data);
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
  return addDoc(collection(db, "tasks"), { ...data, createdAt: new Date().toISOString() });
}

export async function updateTask(id: string, data: Partial<Task>) {
  return updateDoc(doc(db, "tasks", id), data);
}

export async function deleteTask(id: string) {
  return deleteDoc(doc(db, "tasks", id));
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
