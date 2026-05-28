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
  getCountFromServer,
} from "firebase/firestore";
import { db } from "./firebase";

function byCreatedAtDesc<T extends { createdAt: string }>(a: T, b: T) {
  return b.createdAt.localeCompare(a.createdAt);
}

function stripUndefined(obj: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== undefined));
}

// ── TTL cache — 5 min per entry, keyed by "collection:companyId" ──────────────
const CACHE_TTL = 5 * 60 * 1000;
const _cache = new Map<string, { data: unknown; exp: number }>();

function cacheGet<T>(key: string): T | null {
  const e = _cache.get(key);
  if (!e || Date.now() > e.exp) { _cache.delete(key); return null; }
  return e.data as T;
}

function cacheSet<T>(key: string, data: T): void {
  _cache.set(key, { data, exp: Date.now() + CACHE_TTL });
}

export function cacheInvalidate(...prefixes: string[]): void {
  if (!prefixes.length) { _cache.clear(); return; }
  for (const key of Array.from(_cache.keys())) {
    if (prefixes.some((p) => key.startsWith(p))) _cache.delete(key);
  }
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
  area?: string;
  city?: string;
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
  const key = `customers:${companyId}`;
  const cached = cacheGet<Customer[]>(key);
  if (cached) return cached;
  const q = query(collection(db, "customers"), where("companyId", "==", companyId));
  const snap = await getDocs(q);
  const result = snap.docs.map((d) => ({ id: d.id, ...d.data() } as Customer)).sort(byCreatedAtDesc);
  cacheSet(key, result);
  return result;
}

export async function getCustomer(id: string): Promise<Customer | null> {
  const snap = await getDoc(doc(db, "customers", id));
  if (!snap.exists()) return null;
  return { id: snap.id, ...snap.data() } as Customer;
}

export async function addCustomer(data: Omit<Customer, "id" | "createdAt">) {
  const ref = await addDoc(collection(db, "customers"), stripUndefined({ ...data, createdAt: new Date().toISOString() }));
  cacheInvalidate(`customers:${data.companyId}`);
  return ref;
}

export async function updateCustomer(id: string, data: Partial<Customer>) {
  await updateDoc(doc(db, "customers", id), stripUndefined(data as Record<string, unknown>));
  cacheInvalidate("customers:");
}

export async function deleteCustomer(id: string) {
  await deleteDoc(doc(db, "customers", id));
  cacheInvalidate("customers:");
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

export async function addCustomerVisit(customerId: string, data: Omit<CustomerVisit, "id">) {
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
  amountPaid?: number;
  currency?: string;
  notes?: string;
  dueDate?: string;
  poNumber?: string;
  createdAt: string;
}

export async function getInvoices(companyId: string): Promise<Invoice[]> {
  const key = `invoices:${companyId}`;
  const cached = cacheGet<Invoice[]>(key);
  if (cached) return cached;
  const q = query(collection(db, "invoices"), where("companyId", "==", companyId));
  const snap = await getDocs(q);
  const result = snap.docs.map((d) => ({ id: d.id, ...d.data() } as Invoice)).sort(byCreatedAtDesc);
  cacheSet(key, result);
  return result;
}

export async function getInvoice(id: string): Promise<Invoice | null> {
  const snap = await getDoc(doc(db, "invoices", id));
  if (!snap.exists()) return null;
  return { id: snap.id, ...snap.data() } as Invoice;
}

export async function addInvoice(data: Omit<Invoice, "id" | "createdAt">) {
  const ref = await addDoc(collection(db, "invoices"), stripUndefined({ ...data, createdAt: new Date().toISOString() }));
  cacheInvalidate(`invoices:${data.companyId}`);
  return ref;
}

export async function updateInvoice(id: string, data: Partial<Invoice>) {
  await updateDoc(doc(db, "invoices", id), stripUndefined(data as Record<string, unknown>));
  cacheInvalidate("invoices:");
}

export async function deleteInvoice(id: string) {
  await deleteDoc(doc(db, "invoices", id));
  cacheInvalidate("invoices:");
}

// ── Payment (partial payments on invoices) ───────────────────────────────────

export type PaymentMethod = "cash" | "bank_transfer" | "cheque" | "card" | "online" | "other";

export interface Payment {
  id: string;
  companyId: string;
  invoiceId: string;
  invoiceNumber: string;
  customerId: string;
  customerName: string;
  amount: number;
  currency?: string;
  method: PaymentMethod;
  date: string;
  reference?: string;
  notes?: string;
  createdAt: string;
}

export async function getPayments(companyId: string): Promise<Payment[]> {
  const key = `payments:${companyId}`;
  const cached = cacheGet<Payment[]>(key);
  if (cached) return cached;
  const q = query(collection(db, "payments"), where("companyId", "==", companyId));
  const snap = await getDocs(q);
  const result = snap.docs.map((d) => ({ id: d.id, ...d.data() } as Payment)).sort(byCreatedAtDesc);
  cacheSet(key, result);
  return result;
}

export async function getPaymentsByInvoice(invoiceId: string): Promise<Payment[]> {
  const key = `paymentsByInvoice:${invoiceId}`;
  const cached = cacheGet<Payment[]>(key);
  if (cached) return cached;
  const q = query(collection(db, "payments"), where("invoiceId", "==", invoiceId));
  const snap = await getDocs(q);
  const result = snap.docs.map((d) => ({ id: d.id, ...d.data() } as Payment)).sort(byCreatedAtDesc);
  cacheSet(key, result);
  return result;
}

export async function addPayment(data: Omit<Payment, "id" | "createdAt">) {
  const ref = await addDoc(collection(db, "payments"), stripUndefined({ ...data, createdAt: new Date().toISOString() }));
  cacheInvalidate(`payments:${data.companyId}`, `paymentsByInvoice:${data.invoiceId}`);
  return ref;
}

export async function deletePayment(id: string) {
  await deleteDoc(doc(db, "payments", id));
  cacheInvalidate("payments:", "paymentsByInvoice:");
}

// ── Asset / Equipment ─────────────────────────────────────────────────────────

export interface Asset {
  id: string;
  companyId: string;
  customerId: string;
  customerName: string;
  name: string;
  type?: string;
  brand?: string;
  model?: string;
  serialNumber?: string;
  installDate?: string;
  warrantyExpiry?: string;
  location?: string;
  notes?: string;
  status: "active" | "inactive";
  lastServiceDate?: string;
  nextServiceDate?: string;
  createdAt: string;
}

export async function getAssets(companyId: string): Promise<Asset[]> {
  const key = `assets:${companyId}`;
  const cached = cacheGet<Asset[]>(key);
  if (cached) return cached;
  const q = query(collection(db, "assets"), where("companyId", "==", companyId));
  const snap = await getDocs(q);
  const result = snap.docs.map((d) => ({ id: d.id, ...d.data() } as Asset)).sort(byCreatedAtDesc);
  cacheSet(key, result);
  return result;
}

export async function getAssetsByCustomer(companyId: string, customerId: string): Promise<Asset[]> {
  const key = `assetsByCustomer:${companyId}:${customerId}`;
  const cached = cacheGet<Asset[]>(key);
  if (cached) return cached;
  const q = query(collection(db, "assets"), where("companyId", "==", companyId), where("customerId", "==", customerId));
  const snap = await getDocs(q);
  const result = snap.docs.map((d) => ({ id: d.id, ...d.data() } as Asset)).sort(byCreatedAtDesc);
  cacheSet(key, result);
  return result;
}

export async function getAsset(id: string): Promise<Asset | null> {
  const snap = await getDoc(doc(db, "assets", id));
  if (!snap.exists()) return null;
  return { id: snap.id, ...snap.data() } as Asset;
}

export async function addAsset(data: Omit<Asset, "id" | "createdAt">) {
  const ref = await addDoc(collection(db, "assets"), stripUndefined({ ...data, createdAt: new Date().toISOString() }));
  cacheInvalidate(`assets:${data.companyId}`, `assetsByCustomer:${data.companyId}`);
  return ref;
}

export async function updateAsset(id: string, data: Partial<Asset>) {
  await updateDoc(doc(db, "assets", id), stripUndefined(data as Record<string, unknown>));
  cacheInvalidate("assets:", "assetsByCustomer:");
}

export async function deleteAsset(id: string) {
  await deleteDoc(doc(db, "assets", id));
  cacheInvalidate("assets:", "assetsByCustomer:");
}

// ── Work Order ────────────────────────────────────────────────────────────────

export interface WorkOrderPart {
  name: string;
  quantity: number;
  unitPrice: number;
}

export interface WorkOrder {
  id: string;
  companyId: string;
  workOrderNumber: string;
  title: string;
  description?: string;
  customerId?: string;
  customerName?: string;
  assetId?: string;
  assetName?: string;
  assignedTo?: string;
  assignedToName?: string;
  status: "pending" | "in-progress" | "completed" | "cancelled";
  priority: "low" | "medium" | "high";
  scheduledDate?: string;
  completedDate?: string;
  parts: WorkOrderPart[];
  laborHours?: number;
  laborRate?: number;
  totalPartsAmount?: number;
  totalAmount?: number;
  notes?: string;
  technicianNotes?: string;
  customerSignature?: string;
  feedbackRating?: number;
  feedbackNote?: string;
  invoiceId?: string;
  contractId?: string;
  createdAt: string;
}

export async function getWorkOrders(companyId: string): Promise<WorkOrder[]> {
  const key = `workOrders:${companyId}`;
  const cached = cacheGet<WorkOrder[]>(key);
  if (cached) return cached;
  const q = query(collection(db, "workOrders"), where("companyId", "==", companyId));
  const snap = await getDocs(q);
  const result = snap.docs.map((d) => ({ id: d.id, ...d.data() } as WorkOrder)).sort(byCreatedAtDesc);
  cacheSet(key, result);
  return result;
}

export async function getWorkOrder(id: string): Promise<WorkOrder | null> {
  const snap = await getDoc(doc(db, "workOrders", id));
  if (!snap.exists()) return null;
  return { id: snap.id, ...snap.data() } as WorkOrder;
}

export async function addWorkOrder(data: Omit<WorkOrder, "id" | "createdAt">) {
  const ref = await addDoc(collection(db, "workOrders"), stripUndefined({ ...data, createdAt: new Date().toISOString() }));
  cacheInvalidate(`workOrders:${data.companyId}`);
  return ref;
}

export async function updateWorkOrder(id: string, data: Partial<WorkOrder>) {
  await updateDoc(doc(db, "workOrders", id), stripUndefined(data as Record<string, unknown>));
  cacheInvalidate("workOrders:");
}

export async function deleteWorkOrder(id: string) {
  await deleteDoc(doc(db, "workOrders", id));
  cacheInvalidate("workOrders:");
}

export async function getNextWorkOrderNumber(companyId: string): Promise<string> {
  const q = query(collection(db, "workOrders"), where("companyId", "==", companyId));
  const snap = await getCountFromServer(q);
  return `WO-${String(snap.data().count + 1).padStart(4, "0")}`;
}

// ── AMC Contract ──────────────────────────────────────────────────────────────

export interface ContractVisit {
  id: string;
  date: string;
  notes?: string;
  technicianName?: string;
  workOrderId?: string;
}

export interface Contract {
  id: string;
  companyId: string;
  contractNumber: string;
  customerId: string;
  customerName: string;
  title: string;
  description?: string;
  type: "amc" | "warranty" | "rental" | "service";
  status: "active" | "expired" | "pending" | "cancelled";
  startDate: string;
  endDate: string;
  value: number;
  currency?: string;
  visitsIncluded: number;
  visitsUsed: number;
  visits: ContractVisit[];
  autoRenew?: boolean;
  notes?: string;
  invoiceId?: string;
  createdAt: string;
}

export async function getContracts(companyId: string): Promise<Contract[]> {
  const key = `contracts:${companyId}`;
  const cached = cacheGet<Contract[]>(key);
  if (cached) return cached;
  const q = query(collection(db, "contracts"), where("companyId", "==", companyId));
  const snap = await getDocs(q);
  const result = snap.docs.map((d) => ({ id: d.id, ...d.data() } as Contract)).sort(byCreatedAtDesc);
  cacheSet(key, result);
  return result;
}

export async function getContract(id: string): Promise<Contract | null> {
  const snap = await getDoc(doc(db, "contracts", id));
  if (!snap.exists()) return null;
  return { id: snap.id, ...snap.data() } as Contract;
}

export async function addContract(data: Omit<Contract, "id" | "createdAt">) {
  const ref = await addDoc(collection(db, "contracts"), stripUndefined({ ...data, createdAt: new Date().toISOString() }));
  cacheInvalidate(`contracts:${data.companyId}`);
  return ref;
}

export async function updateContract(id: string, data: Partial<Contract>) {
  await updateDoc(doc(db, "contracts", id), stripUndefined(data as Record<string, unknown>));
  cacheInvalidate("contracts:");
}

export async function deleteContract(id: string) {
  await deleteDoc(doc(db, "contracts", id));
  cacheInvalidate("contracts:");
}

export async function getNextContractNumber(companyId: string): Promise<string> {
  const q = query(collection(db, "contracts"), where("companyId", "==", companyId));
  const snap = await getCountFromServer(q);
  return `CON-${String(snap.data().count + 1).padStart(4, "0")}`;
}

// ── Team Invite ───────────────────────────────────────────────────────────────

export type TeamRole = "admin" | "manager" | "technician" | "viewer";

export interface TeamInvite {
  id: string;
  companyId: string;
  email: string;
  role: TeamRole;
  status: "pending" | "accepted" | "cancelled";
  invitedBy: string;
  createdAt: string;
}

export async function getTeamInvites(companyId: string): Promise<TeamInvite[]> {
  const key = `teamInvites:${companyId}`;
  const cached = cacheGet<TeamInvite[]>(key);
  if (cached) return cached;
  const q = query(collection(db, "teamInvites"), where("companyId", "==", companyId));
  const snap = await getDocs(q);
  const result = snap.docs.map((d) => ({ id: d.id, ...d.data() } as TeamInvite)).sort(byCreatedAtDesc);
  cacheSet(key, result);
  return result;
}

export async function addTeamInvite(data: Omit<TeamInvite, "id" | "createdAt">) {
  const ref = await addDoc(collection(db, "teamInvites"), { ...data, createdAt: new Date().toISOString() });
  cacheInvalidate(`teamInvites:${data.companyId}`);
  return ref;
}

export async function updateTeamInvite(id: string, data: Partial<TeamInvite>) {
  await updateDoc(doc(db, "teamInvites", id), data as Record<string, unknown>);
  cacheInvalidate("teamInvites:");
}

export async function deleteTeamInvite(id: string) {
  await deleteDoc(doc(db, "teamInvites", id));
  cacheInvalidate("teamInvites:");
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
  const key = `quotations:${companyId}`;
  const cached = cacheGet<Quotation[]>(key);
  if (cached) return cached;
  const q = query(collection(db, "quotations"), where("companyId", "==", companyId));
  const snap = await getDocs(q);
  const result = snap.docs.map((d) => ({ id: d.id, ...d.data() } as Quotation)).sort(byCreatedAtDesc);
  cacheSet(key, result);
  return result;
}

export async function getQuotation(id: string): Promise<Quotation | null> {
  const snap = await getDoc(doc(db, "quotations", id));
  if (!snap.exists()) return null;
  return { id: snap.id, ...snap.data() } as Quotation;
}

export async function addQuotation(data: Omit<Quotation, "id" | "createdAt">) {
  const ref = await addDoc(collection(db, "quotations"), stripUndefined({ ...data, createdAt: new Date().toISOString() }));
  cacheInvalidate(`quotations:${data.companyId}`);
  return ref;
}

export async function updateQuotation(id: string, data: Partial<Quotation>) {
  await updateDoc(doc(db, "quotations", id), stripUndefined(data as Record<string, unknown>));
  cacheInvalidate("quotations:");
}

export async function deleteQuotation(id: string) {
  await deleteDoc(doc(db, "quotations", id));
  cacheInvalidate("quotations:");
}

export async function getNextQuoteNumber(companyId: string, prefix: string): Promise<string> {
  const q = query(collection(db, "quotations"), where("companyId", "==", companyId));
  const snap = await getCountFromServer(q);
  return `${prefix}QT-${String(snap.data().count + 1).padStart(4, "0")}`;
}

// ── Task ─────────────────────────────────────────────────────────────────────

export interface Task {
  id: string;
  companyId: string;
  title: string;
  description?: string;
  customerId?: string;
  customerName?: string;
  assignedTo?: string;
  assignedToName?: string;
  status: "todo" | "in-progress" | "done";
  priority: "low" | "medium" | "high";
  dueDate?: string;
  createdAt: string;
}

export async function getTasks(companyId: string): Promise<Task[]> {
  const key = `tasks:${companyId}`;
  const cached = cacheGet<Task[]>(key);
  if (cached) return cached;
  const q = query(collection(db, "tasks"), where("companyId", "==", companyId));
  const snap = await getDocs(q);
  const result = snap.docs.map((d) => ({ id: d.id, ...d.data() } as Task)).sort(byCreatedAtDesc);
  cacheSet(key, result);
  return result;
}

export async function addTask(data: Omit<Task, "id" | "createdAt">) {
  const ref = await addDoc(collection(db, "tasks"), stripUndefined({ ...data, createdAt: new Date().toISOString() }));
  cacheInvalidate(`tasks:${data.companyId}`);
  return ref;
}

export async function updateTask(id: string, data: Partial<Task>) {
  await updateDoc(doc(db, "tasks", id), stripUndefined(data as Record<string, unknown>));
  cacheInvalidate("tasks:");
}

export async function deleteTask(id: string) {
  await deleteDoc(doc(db, "tasks", id));
  cacheInvalidate("tasks:");
}

// ── Technician ────────────────────────────────────────────────────────────────

export interface Technician {
  id: string;
  companyId: string;
  name: string;
  email: string;
  phone?: string;
  phones?: string[];
  specialization?: string;
  status: "active" | "inactive";
  notes?: string;
  userId?: string;
  createdAt: string;
}

export async function getTechnicians(companyId: string): Promise<Technician[]> {
  const key = `technicians:${companyId}`;
  const cached = cacheGet<Technician[]>(key);
  if (cached) return cached;
  const q = query(collection(db, "technicians"), where("companyId", "==", companyId));
  const snap = await getDocs(q);
  const result = snap.docs.map((d) => ({ id: d.id, ...d.data() } as Technician)).sort(byCreatedAtDesc);
  cacheSet(key, result);
  return result;
}

export async function getTechnician(id: string): Promise<Technician | null> {
  const snap = await getDoc(doc(db, "technicians", id));
  if (!snap.exists()) return null;
  return { id: snap.id, ...snap.data() } as Technician;
}

export async function addTechnician(data: Omit<Technician, "id" | "createdAt">) {
  const ref = await addDoc(collection(db, "technicians"), stripUndefined({ ...data, createdAt: new Date().toISOString() }));
  cacheInvalidate(`technicians:${data.companyId}`);
  return ref;
}

export async function updateTechnician(id: string, data: Partial<Technician>) {
  await updateDoc(doc(db, "technicians", id), stripUndefined(data as Record<string, unknown>));
  cacheInvalidate("technicians:");
}

export async function deleteTechnician(id: string) {
  await deleteDoc(doc(db, "technicians", id));
  cacheInvalidate("technicians:");
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
  date: string;
  description: string;
  reference?: string;
  source?: "invoice" | "manual";
  invoiceId?: string;
  createdAt: string;
}

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
  const key = `transactions:${companyId}`;
  const cached = cacheGet<Transaction[]>(key);
  if (cached) return cached;
  const q = query(collection(db, "transactions"), where("companyId", "==", companyId));
  const snap = await getDocs(q);
  const result = snap.docs
    .map((d) => ({ id: d.id, ...d.data() } as Transaction))
    .sort((a, b) => b.date.localeCompare(a.date));
  cacheSet(key, result);
  return result;
}

export async function addTransaction(data: Omit<Transaction, "id" | "createdAt">) {
  const ref = await addDoc(collection(db, "transactions"), { ...data, createdAt: new Date().toISOString() });
  cacheInvalidate(`transactions:${data.companyId}`);
  return ref;
}

export async function updateTransaction(id: string, data: Partial<Transaction>) {
  await updateDoc(doc(db, "transactions", id), stripUndefined(data as Record<string, unknown>));
  cacheInvalidate("transactions:");
}

export async function deleteTransaction(id: string) {
  await deleteDoc(doc(db, "transactions", id));
  cacheInvalidate("transactions:");
}

// ── Roles & Permissions ───────────────────────────────────────────────────────

export type ModuleKey =
  | "dashboard" | "customers" | "quotations" | "invoices"
  | "finance" | "tasks" | "technicians" | "settings"
  | "work-orders" | "assets" | "contracts" | "reports" | "calendar";

export type RoleKey = "admin" | "manager" | "technician" | "viewer";
export type RolePermissions = Record<RoleKey, Record<ModuleKey, boolean>>;

export const DEFAULT_PERMISSIONS: RolePermissions = {
  admin:      { dashboard: true,  customers: true,  quotations: true,  invoices: true,  finance: true,  tasks: true,  technicians: true,  settings: true,  "work-orders": true,  assets: true,  contracts: true,  reports: true,  calendar: true  },
  manager:    { dashboard: true,  customers: true,  quotations: true,  invoices: true,  finance: true,  tasks: true,  technicians: true,  settings: false, "work-orders": true,  assets: true,  contracts: true,  reports: true,  calendar: true  },
  technician: { dashboard: false, customers: true,  quotations: false, invoices: false, finance: false, tasks: true,  technicians: false, settings: false, "work-orders": true,  assets: true,  contracts: false, reports: false, calendar: true  },
  viewer:     { dashboard: true,  customers: true,  quotations: true,  invoices: true,  finance: false, tasks: false, technicians: false, settings: false, "work-orders": false, assets: true,  contracts: true,  reports: true,  calendar: false },
};

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
  paymentLink?: string;
  paymentTerms?: string;
  invoiceFooter?: string;
  incomeCategories?: string[];
  expenseCategories?: string[];
  rolePermissions?: RolePermissions;
}

export async function getSettings(companyId: string): Promise<Settings | null> {
  const key = `settings:${companyId}`;
  const cached = cacheGet<Settings>(key);
  if (cached) return cached;
  const snap = await getDoc(doc(db, "settings", companyId));
  if (!snap.exists()) return null;
  const result = { companyId, ...snap.data() } as Settings;
  cacheSet(key, result);
  return result;
}

export async function saveSettings(companyId: string, data: Partial<Settings>) {
  await setDoc(doc(db, "settings", companyId), data, { merge: true });
  cacheInvalidate(`settings:${companyId}`);
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
  const snap = await getCountFromServer(q);
  return `${prefix}${String(snap.data().count + 1).padStart(4, "0")}`;
}
