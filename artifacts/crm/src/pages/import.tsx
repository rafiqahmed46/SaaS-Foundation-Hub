import { useState, useRef, useCallback } from "react";
import Papa from "papaparse";
import Layout from "@/components/Layout";
import { useAuth } from "@/contexts/AuthContext";
import { db } from "@/lib/firebase";
import { collection, writeBatch, doc } from "firebase/firestore";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Upload, CheckCircle2, AlertCircle, Users, CheckSquare, StickyNote, X, FileUp, Loader2, FileText, CalendarDays } from "lucide-react";
import { cn } from "@/lib/utils";

// ── Types ─────────────────────────────────────────────────────────────────────

type ParsedRow = Record<string, string>;

interface ColumnMap {
  [crmField: string]: string; // crmField → csvColumn
}

interface ImportResult {
  success: number;
  skipped: number;
  errors: string[];
}

// ── Field definitions per entity ──────────────────────────────────────────────

const CUSTOMER_FIELDS = [
  { key: "name",    label: "Name *",    required: true,  hints: ["name", "full name", "contact", "contact name", "customer", "customer name", "client"] },
  { key: "email",   label: "Email",     required: false, hints: ["email", "email address", "e-mail", "mail"] },
  { key: "phone",   label: "Phone",     required: false, hints: ["phone", "phone number", "mobile", "cell", "telephone", "tel", "contact number"] },
  { key: "address", label: "Address",   required: false, hints: ["address", "location", "city", "area"] },
  { key: "type",    label: "Type",      required: false, hints: ["type", "contact type", "category", "customer type", "lead type", "status", "stage"] },
  { key: "notes",   label: "Notes",     required: false, hints: ["notes", "note", "description", "comment", "remarks", "details"] },
];

const TASK_FIELDS = [
  { key: "title",       label: "Title *",      required: true,  hints: ["title", "task", "task name", "name", "subject", "summary"] },
  { key: "description", label: "Description",  required: false, hints: ["description", "details", "notes", "note", "body"] },
  { key: "status",      label: "Status",       required: false, hints: ["status", "state"] },
  { key: "priority",    label: "Priority",     required: false, hints: ["priority", "urgency"] },
  { key: "dueDate",     label: "Due Date",     required: false, hints: ["due date", "duedate", "deadline", "due", "due_date"] },
];

const NOTE_FIELDS = [
  { key: "customerName", label: "Customer Name *", required: true,  hints: ["contact", "customer", "name", "client", "contact name"] },
  { key: "note",         label: "Note Content *",  required: true,  hints: ["note", "description", "content", "body", "details", "text", "notes"] },
  { key: "title",        label: "Title",           required: false, hints: ["title", "subject", "summary"] },
];

const SCHEDULE_FIELDS = [
  { key: "title",        label: "Title / Task *",     required: true,  hints: ["title", "task", "task name", "subject", "name", "description", "activity", "schedule", "event"] },
  { key: "dueDate",      label: "Due Date / Date",    required: false, hints: ["date", "due date", "start date", "scheduled date", "deadline", "due", "day", "due_date"] },
  { key: "customerName", label: "Customer / Contact", required: false, hints: ["contact", "customer", "client", "name", "customer name", "contact name", "assigned to", "with"] },
  { key: "status",       label: "Status",             required: false, hints: ["status", "state", "outcome", "result", "done"] },
  { key: "priority",     label: "Priority",           required: false, hints: ["priority", "urgency", "importance"] },
  { key: "description",  label: "Notes / Description",required: false, hints: ["notes", "note", "description", "details", "remarks", "memo", "comments", "body"] },
];

// Invoice fields split into two groups: invoice-level and item-level
const INVOICE_HEADER_FIELDS = [
  { key: "customerName",    label: "Customer Name *",  required: true,  hints: ["customer", "client", "contact", "name", "customer name", "client name", "bill to"] },
  { key: "invoiceNumber",   label: "Invoice Number",   required: false, hints: ["invoice #", "invoice number", "invoice no", "inv #", "inv number", "number", "invoice id"] },
  { key: "status",          label: "Status",           required: false, hints: ["status", "payment status", "invoice status"] },
  { key: "createdAt",       label: "Invoice Date",     required: false, hints: ["date", "invoice date", "created", "created date", "issue date"] },
  { key: "dueDate",         label: "Due Date",         required: false, hints: ["due date", "due", "payment due", "due_date", "expiry"] },
  { key: "notes",           label: "Notes",            required: false, hints: ["notes", "note", "remarks", "memo", "comment"] },
];

const INVOICE_ITEM_FIELDS = [
  { key: "description", label: "Item Description *", required: true,  hints: ["description", "item", "product", "service", "item description", "details", "name"] },
  { key: "quantity",    label: "Quantity",            required: false, hints: ["qty", "quantity", "units", "count"] },
  { key: "unitPrice",   label: "Unit Price",          required: false, hints: ["rate", "price", "unit price", "unit cost", "amount", "cost"] },
  { key: "total",       label: "Line Total (fallback)",required: false, hints: ["total", "line total", "item total", "amount", "subtotal"] },
];

// ── Auto-map columns ──────────────────────────────────────────────────────────

function autoMap(csvColumns: string[], fields: typeof CUSTOMER_FIELDS): ColumnMap {
  const map: ColumnMap = {};
  const lowerCols = csvColumns.map((c) => c.toLowerCase().trim());
  for (const field of fields) {
    for (const hint of field.hints) {
      const idx = lowerCols.findIndex((c) => c === hint || c.includes(hint) || hint.includes(c));
      if (idx !== -1) { map[field.key] = csvColumns[idx]; break; }
    }
  }
  return map;
}

// ── Chunk array for Firestore batch (max 499) ──────────────────────────────────

function chunk<T>(arr: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < arr.length; i += size) chunks.push(arr.slice(i, i + size));
  return chunks;
}

// ── Normalise status / priority strings ───────────────────────────────────────

function normaliseStatus(raw: string): "todo" | "in-progress" | "done" {
  const v = raw.toLowerCase().trim();
  if (v.includes("progress") || v === "doing" || v === "active") return "in-progress";
  if (v.includes("done") || v === "complete" || v === "completed" || v === "closed") return "done";
  return "todo";
}

function normalisePriority(raw: string): "low" | "medium" | "high" {
  const v = raw.toLowerCase().trim();
  if (v === "high" || v === "urgent" || v === "critical") return "high";
  if (v === "low") return "low";
  return "medium";
}

// ── Drop-zone component ───────────────────────────────────────────────────────

function DropZone({ onFile, file, accept = ".csv" }: { onFile: (f: File) => void; file: File | null; accept?: string }) {
  const ref = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault(); setDragging(false);
    const f = e.dataTransfer.files[0];
    if (f) onFile(f);
  }, [onFile]);

  return (
    <div
      onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
      onDragLeave={() => setDragging(false)}
      onDrop={handleDrop}
      onClick={() => ref.current?.click()}
      className={cn(
        "flex flex-col items-center justify-center gap-2 border-2 border-dashed rounded-xl p-8 cursor-pointer transition-colors",
        dragging ? "border-primary bg-primary/5" : "border-border hover:border-primary/50 hover:bg-muted/30",
        file && "border-green-400 bg-green-50"
      )}
    >
      <input ref={ref} type="file" accept={accept} className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) onFile(f); }} />
      {file ? (
        <>
          <CheckCircle2 className="w-8 h-8 text-green-500" />
          <p className="font-medium text-green-700">{file.name}</p>
          <p className="text-xs text-muted-foreground">Click to choose a different file</p>
        </>
      ) : (
        <>
          <FileUp className="w-8 h-8 text-muted-foreground" />
          <p className="font-medium">Drop your CSV file here</p>
          <p className="text-xs text-muted-foreground">or click to browse</p>
        </>
      )}
    </div>
  );
}

// ── Column mapper UI ──────────────────────────────────────────────────────────

function ColumnMapper({
  fields, csvColumns, map, onChange,
}: {
  fields: typeof CUSTOMER_FIELDS;
  csvColumns: string[];
  map: ColumnMap;
  onChange: (map: ColumnMap) => void;
}) {
  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">Match your CSV columns to ClearCRM fields. Required fields must be mapped.</p>
      <div className="grid gap-2">
        {fields.map((f) => (
          <div key={f.key} className="flex items-center gap-3">
            <span className="w-32 text-sm font-medium shrink-0">{f.label}</span>
            <Select
              value={map[f.key] || "__none__"}
              onValueChange={(v) => onChange({ ...map, [f.key]: v === "__none__" ? "" : v })}
            >
              <SelectTrigger className="flex-1 h-8 text-sm">
                <SelectValue placeholder="— not mapped —" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">— not mapped —</SelectItem>
                {csvColumns.map((col) => <SelectItem key={col} value={col}>{col}</SelectItem>)}
              </SelectContent>
            </Select>
            {map[f.key] ? (
              <Badge variant="secondary" className="text-xs shrink-0">mapped</Badge>
            ) : f.required ? (
              <Badge variant="destructive" className="text-xs shrink-0">required</Badge>
            ) : (
              <span className="w-14 shrink-0" />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Preview table ─────────────────────────────────────────────────────────────

function PreviewTable({ rows, columns }: { rows: ParsedRow[]; columns: string[] }) {
  const preview = rows.slice(0, 5);
  return (
    <div className="overflow-x-auto rounded border text-xs">
      <table className="w-full">
        <thead className="bg-muted">
          <tr>{columns.map((c) => <th key={c} className="px-3 py-2 text-left font-medium whitespace-nowrap">{c}</th>)}</tr>
        </thead>
        <tbody>
          {preview.map((row, i) => (
            <tr key={i} className="border-t">
              {columns.map((c) => <td key={c} className="px-3 py-1.5 text-muted-foreground truncate max-w-[160px]">{row[c] || ""}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
      {rows.length > 5 && <p className="px-3 py-2 text-muted-foreground bg-muted/50">… and {rows.length - 5} more rows</p>}
    </div>
  );
}

// ── Result banner ─────────────────────────────────────────────────────────────

function ResultBanner({ result, onClear }: { result: ImportResult; onClear: () => void }) {
  return (
    <div className={cn("rounded-xl p-4 flex items-start gap-3", result.errors.length > 0 ? "bg-amber-50 border border-amber-200" : "bg-green-50 border border-green-200")}>
      {result.errors.length > 0 ? <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" /> : <CheckCircle2 className="w-5 h-5 text-green-600 shrink-0 mt-0.5" />}
      <div className="flex-1 min-w-0">
        <p className="font-semibold text-sm">{result.success} records imported successfully{result.skipped > 0 ? `, ${result.skipped} skipped` : ""}</p>
        {result.errors.length > 0 && (
          <ul className="mt-1 text-xs text-amber-700 space-y-0.5">
            {result.errors.slice(0, 5).map((e, i) => <li key={i}>• {e}</li>)}
            {result.errors.length > 5 && <li>• …and {result.errors.length - 5} more</li>}
          </ul>
        )}
      </div>
      <button onClick={onClear} className="text-muted-foreground hover:text-foreground shrink-0"><X className="w-4 h-4" /></button>
    </div>
  );
}

// ── Customers tab ─────────────────────────────────────────────────────────────

function CustomersTab({ companyId }: { companyId: string }) {
  const { toast } = useToast();
  const [file, setFile] = useState<File | null>(null);
  const [rows, setRows] = useState<ParsedRow[]>([]);
  const [columns, setColumns] = useState<string[]>([]);
  const [map, setMap] = useState<ColumnMap>({});
  const [importing, setImporting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState<ImportResult | null>(null);

  function handleFile(f: File) {
    setFile(f); setResult(null);
    Papa.parse<ParsedRow>(f, {
      header: true, skipEmptyLines: true,
      complete: ({ data, meta }) => {
        const cols = meta.fields || [];
        setColumns(cols); setRows(data);
        setMap(autoMap(cols, CUSTOMER_FIELDS));
      },
    });
  }

  async function handleImport() {
    if (!map["name"]) { toast({ title: "Map the Name column first", variant: "destructive" }); return; }
    setImporting(true); setProgress(0);
    const res: ImportResult = { success: 0, skipped: 0, errors: [] };
    const valid = rows.filter((r) => r[map["name"]]?.trim());
    res.skipped = rows.length - valid.length;
    const batches = chunk(valid, 499);
    for (let bi = 0; bi < batches.length; bi++) {
      const batch = writeBatch(db);
      for (const row of batches[bi]) {
        const ref = doc(collection(db, "customers"));
        batch.set(ref, {
          companyId,
          name:    row[map["name"]]?.trim() || "",
          email:   map["email"]   ? row[map["email"]]?.trim()   || "" : "",
          phone:   map["phone"]   ? row[map["phone"]]?.trim()   || "" : "",
          address: map["address"] ? row[map["address"]]?.trim() || "" : "",
          type:    map["type"]    ? normaliseCustomerType(row[map["type"]] || "") : "customer",
          notes:   map["notes"]   ? row[map["notes"]]?.trim()   || "" : "",
          createdAt: new Date().toISOString(),
        });
        res.success++;
      }
      try { await batch.commit(); } catch (e: unknown) { res.errors.push(`Batch ${bi + 1}: ${(e as Error).message}`); res.success -= batches[bi].length; }
      setProgress(Math.round(((bi + 1) / batches.length) * 100));
    }
    setImporting(false); setResult(res);
    if (res.success > 0) toast({ title: `${res.success} customers imported!` });
  }

  return (
    <div className="space-y-5">
      <DropZone file={file} onFile={handleFile} />
      {result && <ResultBanner result={result} onClear={() => setResult(null)} />}
      {columns.length > 0 && (
        <>
          <div>
            <p className="text-sm font-medium mb-2">Preview <span className="text-muted-foreground font-normal">({rows.length} rows detected)</span></p>
            <PreviewTable rows={rows} columns={columns} />
          </div>
          <ColumnMapper fields={CUSTOMER_FIELDS} csvColumns={columns} map={map} onChange={setMap} />
          <Button onClick={handleImport} disabled={importing} className="w-full gap-2">
            {importing ? <><Loader2 className="w-4 h-4 animate-spin" /> Importing… {progress}%</> : <><Upload className="w-4 h-4" /> Import {rows.length} Customers</>}
          </Button>
        </>
      )}
    </div>
  );
}

// ── Tasks tab ─────────────────────────────────────────────────────────────────

function TasksTab({ companyId }: { companyId: string }) {
  const { toast } = useToast();
  const [file, setFile] = useState<File | null>(null);
  const [rows, setRows] = useState<ParsedRow[]>([]);
  const [columns, setColumns] = useState<string[]>([]);
  const [map, setMap] = useState<ColumnMap>({});
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);

  function handleFile(f: File) {
    setFile(f); setResult(null);
    Papa.parse<ParsedRow>(f, {
      header: true, skipEmptyLines: true,
      complete: ({ data, meta }) => {
        const cols = meta.fields || [];
        setColumns(cols); setRows(data);
        setMap(autoMap(cols, TASK_FIELDS));
      },
    });
  }

  async function handleImport() {
    if (!map["title"]) { toast({ title: "Map the Title column first", variant: "destructive" }); return; }
    setImporting(true);
    const res: ImportResult = { success: 0, skipped: 0, errors: [] };
    const valid = rows.filter((r) => r[map["title"]]?.trim());
    res.skipped = rows.length - valid.length;
    const batches = chunk(valid, 499);
    for (let bi = 0; bi < batches.length; bi++) {
      const batch = writeBatch(db);
      for (const row of batches[bi]) {
        const ref = doc(collection(db, "tasks"));
        const rawDue = map["dueDate"] ? row[map["dueDate"]]?.trim() : "";
        let dueDate = "";
        if (rawDue) { try { dueDate = new Date(rawDue).toISOString().split("T")[0]; } catch { dueDate = ""; } }
        batch.set(ref, {
          companyId,
          title:       row[map["title"]]?.trim() || "",
          description: row[map["description"]]?.trim() || "",
          status:      map["status"] ? normaliseStatus(row[map["status"]] || "") : "todo",
          priority:    map["priority"] ? normalisePriority(row[map["priority"]] || "") : "medium",
          dueDate,
          customerId:  "",
          createdAt:   new Date().toISOString(),
        });
        res.success++;
      }
      try { await batch.commit(); } catch (e: unknown) { res.errors.push(`Batch ${bi + 1}: ${(e as Error).message}`); res.success -= batches[bi].length; }
    }
    setImporting(false); setResult(res);
    if (res.success > 0) toast({ title: `${res.success} tasks imported!` });
  }

  return (
    <div className="space-y-5">
      <DropZone file={file} onFile={handleFile} />
      {result && <ResultBanner result={result} onClear={() => setResult(null)} />}
      {columns.length > 0 && (
        <>
          <div>
            <p className="text-sm font-medium mb-2">Preview <span className="text-muted-foreground font-normal">({rows.length} rows detected)</span></p>
            <PreviewTable rows={rows} columns={columns} />
          </div>
          <ColumnMapper fields={TASK_FIELDS} csvColumns={columns} map={map} onChange={setMap} />
          <Button onClick={handleImport} disabled={importing} className="w-full gap-2">
            {importing ? <><Loader2 className="w-4 h-4 animate-spin" /> Importing…</> : <><Upload className="w-4 h-4" /> Import {rows.length} Tasks</>}
          </Button>
        </>
      )}
    </div>
  );
}

// ── Notes tab ─────────────────────────────────────────────────────────────────

function NotesTab({ companyId }: { companyId: string }) {
  const { toast } = useToast();
  const [file, setFile] = useState<File | null>(null);
  const [rows, setRows] = useState<ParsedRow[]>([]);
  const [columns, setColumns] = useState<string[]>([]);
  const [map, setMap] = useState<ColumnMap>({});
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);

  function handleFile(f: File) {
    setFile(f); setResult(null);
    Papa.parse<ParsedRow>(f, {
      header: true, skipEmptyLines: true,
      complete: ({ data, meta }) => {
        const cols = meta.fields || [];
        setColumns(cols); setRows(data);
        setMap(autoMap(cols, NOTE_FIELDS));
      },
    });
  }

  async function handleImport() {
    if (!map["customerName"] || !map["note"]) {
      toast({ title: "Map Customer Name and Note Content columns first", variant: "destructive" }); return;
    }
    setImporting(true);
    const res: ImportResult = { success: 0, skipped: 0, errors: [] };

    // Get existing customers to match by name
    const { getDocs, query, collection: col, where } = await import("firebase/firestore");
    const snap = await getDocs(query(col(db, "customers"), where("companyId", "==", companyId)));
    const customerMap: Record<string, string> = {};
    snap.forEach((d) => { customerMap[(d.data().name as string).toLowerCase().trim()] = d.id; });

    const valid = rows.filter((r) => r[map["customerName"]]?.trim() && r[map["note"]]?.trim());
    res.skipped = rows.length - valid.length;
    const batches = chunk(valid, 499);

    for (let bi = 0; bi < batches.length; bi++) {
      const batch = writeBatch(db);
      for (const row of batches[bi]) {
        const custName = row[map["customerName"]]?.trim().toLowerCase();
        const customerId = customerMap[custName];
        if (!customerId) { res.skipped++; res.errors.push(`Customer not found: "${row[map["customerName"]]}"`); res.success--; continue; }
        const noteText = [
          map["title"] && row[map["title"]] ? `${row[map["title"]]}: ` : "",
          row[map["note"]]?.trim(),
        ].filter(Boolean).join("");
        const ref = doc(collection(db, "customers"), customerId);
        batch.update(ref, { notes: noteText });
        res.success++;
      }
      try { await batch.commit(); } catch (e: unknown) { res.errors.push(`Batch ${bi + 1}: ${(e as Error).message}`); }
    }
    setImporting(false); setResult(res);
    if (res.success > 0) toast({ title: `${res.success} notes linked to customers!` });
  }

  return (
    <div className="space-y-5">
      <div className="rounded-lg bg-amber-50 border border-amber-200 p-3 text-sm text-amber-800">
        <strong>How this works:</strong> Notes are matched to your existing customers by name and saved into their Notes field. Import your customers first before importing notes.
      </div>
      <DropZone file={file} onFile={handleFile} />
      {result && <ResultBanner result={result} onClear={() => setResult(null)} />}
      {columns.length > 0 && (
        <>
          <div>
            <p className="text-sm font-medium mb-2">Preview <span className="text-muted-foreground font-normal">({rows.length} rows detected)</span></p>
            <PreviewTable rows={rows} columns={columns} />
          </div>
          <ColumnMapper fields={NOTE_FIELDS} csvColumns={columns} map={map} onChange={setMap} />
          <Button onClick={handleImport} disabled={importing} className="w-full gap-2">
            {importing ? <><Loader2 className="w-4 h-4 animate-spin" /> Importing…</> : <><Upload className="w-4 h-4" /> Import {rows.length} Notes</>}
          </Button>
        </>
      )}
    </div>
  );
}

// ── Schedule tab ──────────────────────────────────────────────────────────────

function normaliseScheduleStatus(raw: string): string {
  const v = raw.toLowerCase().trim();
  if (v === "done" || v === "completed" || v === "complete" || v === "finished") return "completed";
  if (v.includes("cancel")) return "cancelled";
  if (v === "in progress" || v === "inprogress" || v === "in-progress" || v === "started") return "in-progress";
  return "pending";
}

function normaliseCustomerType(raw: string): string {
  const v = raw.toLowerCase().trim();
  if (v === "lead" || v === "prospect" || v === "potential") return "lead";
  if (v === "lost" || v === "inactive" || v === "churned") return "lost";
  return "customer";
}

function ScheduleTab({ companyId }: { companyId: string }) {
  const { toast } = useToast();
  const [file, setFile] = useState<File | null>(null);
  const [rows, setRows] = useState<ParsedRow[]>([]);
  const [columns, setColumns] = useState<string[]>([]);
  const [map, setMap] = useState<ColumnMap>({});
  const [importing, setImporting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState<ImportResult | null>(null);

  function handleFile(f: File) {
    setFile(f); setResult(null);
    Papa.parse<ParsedRow>(f, {
      header: true, skipEmptyLines: true,
      complete: ({ data, meta }) => {
        const cols = meta.fields || [];
        setColumns(cols); setRows(data);
        setMap(autoMap(cols, SCHEDULE_FIELDS));
      },
    });
  }

  async function handleImport() {
    if (!map["title"]) { toast({ title: "Map the Title / Subject column first", variant: "destructive" }); return; }
    if (!map["date"])  { toast({ title: "Map the Date column first", variant: "destructive" }); return; }

    setImporting(true); setProgress(0);
    const res: ImportResult = { success: 0, skipped: 0, errors: [] };

    // Load customers for name → id lookup
    const { getDocs, query, collection: col, where } = await import("firebase/firestore");
    const snap = await getDocs(query(col(db, "customers"), where("companyId", "==", companyId)));
    const customerMap: Record<string, { id: string; name: string }> = {};
    snap.forEach((d) => {
      const name = (d.data().name as string || "").toLowerCase().trim();
      customerMap[name] = { id: d.id, name: d.data().name as string };
    });

    const batches = chunk(rows, 499);
    for (let bi = 0; bi < batches.length; bi++) {
      const batch = writeBatch(db);
      for (const row of batches[bi]) {
        const title = map["title"] ? row[map["title"]]?.trim() : "";
        if (!title) { res.skipped++; continue; }

        const custRaw = map["customerName"] ? row[map["customerName"]]?.trim() || "" : "";
        const custLookup = custRaw ? customerMap[custRaw.toLowerCase()] : undefined;

        batch.set(doc(collection(db, "tasks")), {
          companyId,
          title,
          dueDate:      map["dueDate"]      ? row[map["dueDate"]]?.trim()      || "" : "",
          status:       map["status"]       ? normaliseScheduleStatus(row[map["status"]] || "") : "pending",
          priority:     map["priority"]     ? row[map["priority"]]?.trim()     || "" : "",
          description:  map["description"]  ? row[map["description"]]?.trim()  || "" : "",
          customerName: custLookup?.name || custRaw,
          customerId:   custLookup?.id   || "",
          createdAt:    new Date().toISOString(),
        });
        res.success++;
      }
      try { await batch.commit(); } catch (e: unknown) {
        res.errors.push(`Batch ${bi + 1}: ${(e as Error).message}`);
        res.success -= batches[bi].length;
      }
      setProgress(Math.round(((bi + 1) / batches.length) * 100));
    }
    setImporting(false); setResult(res);
    if (res.success > 0) toast({ title: `${res.success} tasks imported!` });
  }

  return (
    <div className="space-y-5">
      <DropZone file={file} onFile={handleFile} />
      {result && <ResultBanner result={result} onClear={() => setResult(null)} />}
      {columns.length > 0 && (
        <>
          <div>
            <p className="text-sm font-medium mb-2">Preview <span className="text-muted-foreground font-normal">({rows.length} rows)</span></p>
            <PreviewTable rows={rows} columns={columns} />
          </div>
          <ColumnMapper fields={SCHEDULE_FIELDS} csvColumns={columns} map={map} onChange={setMap} />
          <Button onClick={handleImport} disabled={importing} className="w-full gap-2">
            {importing
              ? <><Loader2 className="w-4 h-4 animate-spin" /> Importing… {progress}%</>
              : <><Upload className="w-4 h-4" /> Import Tasks</>}
          </Button>
        </>
      )}
    </div>
  );
}

// ── Invoices tab ──────────────────────────────────────────────────────────────

function normaliseInvoiceStatus(raw: string): InvoiceStatus {
  const v = raw.toLowerCase().trim();
  if (v === "paid" || v === "complete" || v === "completed") return "paid";
  if (v.includes("cancel") || v === "void" || v === "voided") return "cancelled";
  if (v === "sent" || v === "issued" || v === "open") return "sent";
  if (v === "overdue" || v === "late") return "overdue";
  return "draft";
}

function parseDate(raw: string): string {
  if (!raw) return new Date().toISOString();
  try {
    // Handle DD/MM/YYYY
    if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(raw)) {
      const [d, m, y] = raw.split("/");
      return new Date(`${y}-${m.padStart(2,"0")}-${d.padStart(2,"0")}`).toISOString();
    }
    const parsed = new Date(raw);
    if (!isNaN(parsed.getTime())) return parsed.toISOString();
  } catch { /* fall through */ }
  return new Date().toISOString();
}

// Combined fields for the single mapper
const ALL_INVOICE_FIELDS = [...INVOICE_HEADER_FIELDS, ...INVOICE_ITEM_FIELDS];

type InvoiceStatus = "draft" | "sent" | "paid" | "overdue" | "cancelled";

function InvoicesTab({ companyId }: { companyId: string }) {
  const { toast } = useToast();
  const [file, setFile] = useState<File | null>(null);
  const [rows, setRows] = useState<ParsedRow[]>([]);
  const [columns, setColumns] = useState<string[]>([]);
  const [map, setMap] = useState<ColumnMap>({});
  const [importing, setImporting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [showHeaderFields, setShowHeaderFields] = useState(true);

  function handleFile(f: File) {
    setFile(f); setResult(null);
    Papa.parse<ParsedRow>(f, {
      header: true, skipEmptyLines: true,
      complete: ({ data, meta }) => {
        const cols = meta.fields || [];
        setColumns(cols); setRows(data);
        setMap(autoMap(cols, ALL_INVOICE_FIELDS));
      },
    });
  }

  async function handleImport() {
    if (!map["customerName"]) { toast({ title: "Map the Customer Name column first", variant: "destructive" }); return; }
    if (!map["description"]) { toast({ title: "Map the Item Description column first", variant: "destructive" }); return; }

    setImporting(true); setProgress(0);
    const res: ImportResult = { success: 0, skipped: 0, errors: [] };

    // Load customers for name→id lookup
    const { getDocs, query, collection: col, where } = await import("firebase/firestore");
    const snap = await getDocs(query(col(db, "customers"), where("companyId", "==", companyId)));
    const customerMap: Record<string, { id: string; name: string }> = {};
    snap.forEach((d) => {
      const name = (d.data().name as string || "").toLowerCase().trim();
      customerMap[name] = { id: d.id, name: d.data().name as string };
    });

    // Group rows by invoice number (or treat each row as its own invoice)
    const groups: Map<string, ParsedRow[]> = new Map();
    rows.forEach((row, idx) => {
      const invNum = map["invoiceNumber"] ? row[map["invoiceNumber"]]?.trim() : "";
      const key = invNum || `__row_${idx}`;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(row);
    });

    const invoiceList = Array.from(groups.entries());
    const batches = chunk(invoiceList, 200); // 200 invoices per batch (each has set op)

    for (let bi = 0; bi < batches.length; bi++) {
      const batch = writeBatch(db);
      for (const [invKey, invRows] of batches[bi]) {
        const firstRow = invRows[0];
        const custRaw = firstRow[map["customerName"]]?.trim() || "";
        const custLookup = customerMap[custRaw.toLowerCase()];

        if (!custRaw) { res.skipped++; res.errors.push(`Row missing customer name`); continue; }

        // Build line items
        const items = invRows
          .filter((r) => r[map["description"]]?.trim())
          .map((r) => {
            const qty = parseFloat(r[map["quantity"]] || "") || 1;
            const price = parseFloat(r[map["unitPrice"]] || "") || 0;
            const lineTotal = parseFloat(r[map["total"]] || "") || 0;
            const unitPrice = price || (qty > 0 ? lineTotal / qty : lineTotal);
            return { description: r[map["description"]]?.trim() || "", quantity: qty, unitPrice };
          });

        if (items.length === 0) { res.skipped++; res.errors.push(`Invoice ${invKey}: no valid items`); continue; }

        const subtotal = items.reduce((s, it) => s + it.quantity * it.unitPrice, 0);
        const invNumber = invKey.startsWith("__row_") ? "" : invKey;

        const ref = doc(collection(db, "invoices"));
        batch.set(ref, {
          companyId,
          customerId:      custLookup?.id || "",
          customerName:    custLookup?.name || custRaw,
          invoiceNumber:   invNumber,
          status:          map["status"] ? normaliseInvoiceStatus(firstRow[map["status"]] || "") : "draft",
          items,
          subtotal,
          taxEnabled:      false,
          discountEnabled: false,
          total:           subtotal,
          notes:           map["notes"] ? firstRow[map["notes"]]?.trim() || "" : "",
          dueDate:         map["dueDate"] ? firstRow[map["dueDate"]]?.trim() || "" : "",
          createdAt:       map["createdAt"] ? parseDate(firstRow[map["createdAt"]] || "") : new Date().toISOString(),
        });
        res.success++;
      }
      try { await batch.commit(); } catch (e: unknown) { res.errors.push(`Batch ${bi + 1}: ${(e as Error).message}`); res.success -= batches[bi].length; }
      setProgress(Math.round(((bi + 1) / batches.length) * 100));
    }
    setImporting(false); setResult(res);
    if (res.success > 0) toast({ title: `${res.success} invoices imported!` });
  }

  return (
    <div className="space-y-5">
      <div className="rounded-lg bg-blue-50 border border-blue-200 p-3 text-sm text-blue-800">
        <strong>How it works:</strong> If your CSV has one row per line item (multiple rows for the same invoice), map the Invoice Number column and rows will be grouped automatically. If each row is a separate invoice, leave Invoice Number unmapped.
      </div>
      <DropZone file={file} onFile={handleFile} />
      {result && <ResultBanner result={result} onClear={() => setResult(null)} />}
      {columns.length > 0 && (
        <>
          <div>
            <p className="text-sm font-medium mb-2">Preview <span className="text-muted-foreground font-normal">({rows.length} rows, ~{new Map(rows.map((r,i) => [map["invoiceNumber"] ? r[map["invoiceNumber"]]?.trim() || `r${i}` : `r${i}`, 1])).size} invoices detected)</span></p>
            <PreviewTable rows={rows} columns={columns} />
          </div>

          {/* Tabbed field groups */}
          <div className="space-y-3">
            <div className="flex gap-2">
              <button onClick={() => setShowHeaderFields(true)} className={cn("text-xs px-3 py-1 rounded-full border font-medium transition-colors", showHeaderFields ? "bg-primary text-white border-primary" : "border-border text-muted-foreground hover:border-primary")}>Invoice Fields</button>
              <button onClick={() => setShowHeaderFields(false)} className={cn("text-xs px-3 py-1 rounded-full border font-medium transition-colors", !showHeaderFields ? "bg-primary text-white border-primary" : "border-border text-muted-foreground hover:border-primary")}>Item Fields</button>
            </div>
            {showHeaderFields
              ? <ColumnMapper fields={INVOICE_HEADER_FIELDS} csvColumns={columns} map={map} onChange={setMap} />
              : <ColumnMapper fields={INVOICE_ITEM_FIELDS} csvColumns={columns} map={map} onChange={setMap} />}
          </div>

          <Button onClick={handleImport} disabled={importing} className="w-full gap-2">
            {importing ? <><Loader2 className="w-4 h-4 animate-spin" /> Importing… {progress}%</> : <><Upload className="w-4 h-4" /> Import Invoices</>}
          </Button>
        </>
      )}
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

const TABS = [
  { key: "customers", label: "Customers", icon: Users },
  { key: "invoices",  label: "Invoices",  icon: FileText },
  { key: "schedule",  label: "Schedule",  icon: CalendarDays },
  { key: "notes",     label: "Notes",     icon: StickyNote },
  { key: "tasks",     label: "Tasks",     icon: CheckSquare },
];

export default function ImportPage() {
  const { user } = useAuth();
  const [tab, setTab] = useState("customers");
  const companyId = user?.companyId || "";

  return (
    <Layout>
      <div className="max-w-2xl mx-auto px-4 py-8 space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold">Import Data</h1>
          <p className="text-muted-foreground mt-1">Import your contacts, tasks, and notes from Pocket CRM or any CSV file.</p>
        </div>

        {/* Step guide */}
        <Card className="bg-blue-50 border-blue-200">
          <CardContent className="pt-4 pb-3">
            <p className="text-sm font-semibold text-blue-800 mb-1">Recommended import order:</p>
            <ol className="text-sm text-blue-700 space-y-0.5 list-decimal list-inside">
              <li>Import <strong>Customers</strong> first</li>
              <li>Import <strong>Notes</strong> (they link to your customers by name)</li>
              <li>Import <strong>Tasks</strong></li>
            </ol>
            <p className="text-xs text-blue-600 mt-2">Invoices are complex (multiple line items per invoice) — for now, re-create important ones manually in ClearCRM.</p>
          </CardContent>
        </Card>

        {/* Tab bar */}
        <div className="flex gap-1 bg-muted p-1 rounded-xl">
          {TABS.map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={cn(
                "flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-sm font-medium transition-colors",
                tab === key ? "bg-white shadow text-foreground" : "text-muted-foreground hover:text-foreground"
              )}
            >
              <Icon className="w-4 h-4" />
              {label}
            </button>
          ))}
        </div>

        {/* Tab content */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">
              {tab === "customers" && "Import Customers"}
              {tab === "invoices"  && "Import Invoices"}
              {tab === "schedule"  && "Import Schedule"}
              {tab === "tasks"     && "Import Tasks"}
              {tab === "notes"     && "Import Notes"}
            </CardTitle>
            <CardDescription>
              {tab === "customers" && "Upload your contacts CSV. Map the columns, then click Import."}
              {tab === "invoices"  && "Upload your invoices CSV. Rows with the same invoice number are grouped as one invoice with multiple line items."}
              {tab === "schedule"  && "Upload your schedule CSV. Appointments are linked to customers by name."}
              {tab === "tasks"     && "Upload your tasks CSV. Status and priority are auto-converted."}
              {tab === "notes"     && "Upload your notes CSV. Notes will be matched to customers by name."}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {!companyId ? (
              <p className="text-sm text-muted-foreground">Your company workspace isn't ready yet. Complete setup first.</p>
            ) : tab === "customers" ? (
              <CustomersTab companyId={companyId} />
            ) : tab === "invoices" ? (
              <InvoicesTab companyId={companyId} />
            ) : tab === "schedule" ? (
              <ScheduleTab companyId={companyId} />
            ) : tab === "tasks" ? (
              <TasksTab companyId={companyId} />
            ) : (
              <NotesTab companyId={companyId} />
            )}
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}
