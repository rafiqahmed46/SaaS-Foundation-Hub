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
  orderBy,
  serverTimestamp,
  setDoc,
} from "firebase/firestore";
import { db } from "./firebase";

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
  const q = query(
    collection(db, "customers"),
    where("companyId", "==", companyId),
    orderBy("createdAt", "desc")
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as Customer));
}

export async function addCustomer(data: Omit<Customer, "id" | "createdAt">) {
  return addDoc(collection(db, "customers"), {
    ...data,
    createdAt: new Date().toISOString(),
  });
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
  createdAt: string;
}

export async function getInvoices(companyId: string): Promise<Invoice[]> {
  const q = query(
    collection(db, "invoices"),
    where("companyId", "==", companyId),
    orderBy("createdAt", "desc")
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as Invoice));
}

export async function getInvoice(id: string): Promise<Invoice | null> {
  const snap = await getDoc(doc(db, "invoices", id));
  if (!snap.exists()) return null;
  return { id: snap.id, ...snap.data() } as Invoice;
}

export async function addInvoice(data: Omit<Invoice, "id" | "createdAt">) {
  return addDoc(collection(db, "invoices"), {
    ...data,
    createdAt: new Date().toISOString(),
  });
}

export async function updateInvoice(id: string, data: Partial<Invoice>) {
  return updateDoc(doc(db, "invoices", id), data);
}

export async function deleteInvoice(id: string) {
  return deleteDoc(doc(db, "invoices", id));
}

// ── Settings ──────────────────────────────────────────────────────────────────

export interface Settings {
  companyId: string;
  companyName: string;
  companyLogo?: string;
  currency: string;
  invoicePrefix: string;
  taxEnabled: boolean;
  taxRate: number;
  discountEnabled: boolean;
  address?: string;
  phone?: string;
  email?: string;
  website?: string;
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
  const next = snap.size + 1;
  return `${prefix}${String(next).padStart(4, "0")}`;
}
