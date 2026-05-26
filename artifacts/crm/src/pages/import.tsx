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
import { Upload, CheckCircle2, AlertCircle, Users, CheckSquare, StickyNote, X, FileUp, Loader2 } from "lucide-react";
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
          email:   row[map["email"]]?.trim() || "",
          phone:   row[map["phone"]]?.trim() || "",
          address: row[map["address"]]?.trim() || "",
          notes:   row[map["notes"]]?.trim() || "",
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

// ── Main page ─────────────────────────────────────────────────────────────────

const TABS = [
  { key: "customers", label: "Customers", icon: Users },
  { key: "tasks",     label: "Tasks",     icon: CheckSquare },
  { key: "notes",     label: "Notes",     icon: StickyNote },
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
              {tab === "tasks" && "Import Tasks"}
              {tab === "notes" && "Import Notes"}
            </CardTitle>
            <CardDescription>
              {tab === "customers" && "Upload your customers CSV. Map the columns, then click Import."}
              {tab === "tasks" && "Upload your tasks CSV. Status and priority are auto-converted."}
              {tab === "notes" && "Upload your notes CSV. Notes will be matched to customers by name."}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {!companyId ? (
              <p className="text-sm text-muted-foreground">Your company workspace isn't ready yet. Complete setup first.</p>
            ) : tab === "customers" ? (
              <CustomersTab companyId={companyId} />
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
