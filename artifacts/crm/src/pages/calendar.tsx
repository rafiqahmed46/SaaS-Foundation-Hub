import { useEffect, useState, useMemo } from "react";
import Layout from "@/components/Layout";
import { useAuth } from "@/contexts/AuthContext";
import { getTasks, Task, getWorkOrders, WorkOrder, getTechnicians, Technician } from "@/lib/firestore";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { ChevronLeft, ChevronRight, CalendarDays, ClipboardCheck, CheckSquare } from "lucide-react";
import { useLocation } from "wouter";
import { cn } from "@/lib/utils";

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTH_NAMES = ["January","February","March","April","May","June","July","August","September","October","November","December"];

type CalEvent = {
  id: string; title: string; date: string;
  type: "task" | "work-order"; status: string;
  techName?: string; customerName?: string; priority?: string;
};

const TECH_COLORS = [
  "bg-blue-100 text-blue-700 border-blue-200",
  "bg-purple-100 text-purple-700 border-purple-200",
  "bg-green-100 text-green-700 border-green-200",
  "bg-orange-100 text-orange-700 border-orange-200",
  "bg-pink-100 text-pink-700 border-pink-200",
  "bg-teal-100 text-teal-700 border-teal-200",
];

export default function CalendarPage() {
  const { user } = useAuth();
  const [, navigate] = useLocation();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [workOrders, setWorkOrders] = useState<WorkOrder[]>([]);
  const [technicians, setTechnicians] = useState<Technician[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterTech, setFilterTech] = useState("all");
  const [view, setView] = useState<"month" | "week">("month");

  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth()); // 0-indexed

  useEffect(() => {
    if (!user?.companyId) return;
    (async () => {
      setLoading(true);
      try {
        const [t, wo, tech] = await Promise.all([getTasks(user.companyId!), getWorkOrders(user.companyId!), getTechnicians(user.companyId!)]);
        setTasks(t); setWorkOrders(wo); setTechnicians(tech);
      } finally { setLoading(false); }
    })();
  }, [user?.companyId]);

  const techColorMap = useMemo(() => {
    const map: Record<string, string> = {};
    technicians.forEach((t, i) => { map[t.id] = TECH_COLORS[i % TECH_COLORS.length]; });
    return map;
  }, [technicians]);

  const events: CalEvent[] = useMemo(() => {
    const result: CalEvent[] = [];
    tasks.forEach((t) => {
      if (!t.dueDate) return;
      result.push({ id: t.id, title: t.title, date: t.dueDate, type: "task", status: t.status, techName: t.assignedToName, customerName: t.customerName, priority: t.priority });
    });
    workOrders.forEach((wo) => {
      if (!wo.scheduledDate) return;
      result.push({ id: wo.id, title: wo.title, date: wo.scheduledDate, type: "work-order", status: wo.status, techName: wo.assignedToName, customerName: wo.customerName, priority: wo.priority });
    });
    return result;
  }, [tasks, workOrders]);

  const filteredEvents = useMemo(() => {
    if (filterTech === "all") return events;
    const tech = technicians.find((t) => t.id === filterTech);
    if (!tech) return events;
    return events.filter((e) => e.techName === tech.name);
  }, [events, filterTech, technicians]);

  function prevMonth() { if (month === 0) { setMonth(11); setYear(y => y - 1); } else { setMonth(m => m - 1); } }
  function nextMonth() { if (month === 11) { setMonth(0); setYear(y => y + 1); } else { setMonth(m => m + 1); } }

  // Build calendar grid
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells: Array<number | null> = [
    ...Array(firstDay).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];
  while (cells.length % 7 !== 0) cells.push(null);

  const todayStr = today.toISOString().slice(0, 10);

  function cellDate(day: number) {
    return `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  }

  function eventsOnDay(day: number) {
    const d = cellDate(day);
    return filteredEvents.filter((e) => e.date === d);
  }

  function getTechColor(techName?: string): string {
    if (!techName) return "bg-gray-100 text-gray-600 border-gray-200";
    const tech = technicians.find((t) => t.name === techName);
    if (!tech) return "bg-gray-100 text-gray-600 border-gray-200";
    return techColorMap[tech.id] || "bg-gray-100 text-gray-600 border-gray-200";
  }

  const totalThisMonth = filteredEvents.filter((e) => e.date.startsWith(`${year}-${String(month + 1).padStart(2, "0")}`)).length;

  return (
    <Layout>
      <div className="p-4 sm:p-6 max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Calendar</h1>
            <p className="text-sm text-muted-foreground mt-0.5">{totalThisMonth} events in {MONTH_NAMES[month]} {year}</p>
          </div>
          <div className="flex items-center gap-2">
            <Select value={filterTech} onValueChange={setFilterTech}>
              <SelectTrigger className="w-40 h-9 text-sm"><SelectValue placeholder="All technicians" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Technicians</SelectItem>
                {technicians.map((t) => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Month nav */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Button variant="outline" size="icon" onClick={prevMonth} className="h-8 w-8">
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <h2 className="text-lg font-semibold min-w-[160px] text-center">{MONTH_NAMES[month]} {year}</h2>
            <Button variant="outline" size="icon" onClick={nextMonth} className="h-8 w-8">
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
          <Button variant="outline" size="sm" onClick={() => { setMonth(today.getMonth()); setYear(today.getFullYear()); }} className="text-xs h-8">Today</Button>
        </div>

        {loading ? (
          <div className="space-y-2">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-24 w-full rounded-xl" />)}</div>
        ) : (
          <>
            {/* Weekday headers */}
            <div className="grid grid-cols-7 mb-1">
              {WEEKDAYS.map((d) => (
                <div key={d} className="text-center text-xs font-medium text-muted-foreground py-2">{d}</div>
              ))}
            </div>

            {/* Calendar grid */}
            <div className="grid grid-cols-7 gap-px bg-border rounded-xl overflow-hidden border">
              {cells.map((day, idx) => {
                if (!day) return <div key={`empty-${idx}`} className="bg-muted/30 min-h-[80px] sm:min-h-[100px]" />;
                const dayEvents = eventsOnDay(day);
                const isToday = cellDate(day) === todayStr;
                return (
                  <div key={day} className={cn("bg-card min-h-[80px] sm:min-h-[100px] p-1.5 flex flex-col gap-1", isToday && "bg-primary/5")}>
                    <span className={cn("text-xs font-medium w-6 h-6 flex items-center justify-center rounded-full shrink-0", isToday ? "bg-primary text-white" : "text-muted-foreground")}>{day}</span>
                    <div className="flex flex-col gap-0.5 overflow-hidden">
                      {dayEvents.slice(0, 3).map((ev) => (
                        <button
                          key={ev.id}
                          onClick={() => navigate(ev.type === "task" ? "/tasks" : `/work-orders/${ev.id}`)}
                          className={cn("text-left text-[10px] sm:text-xs px-1.5 py-0.5 rounded border truncate leading-tight hover:opacity-80 transition-opacity", getTechColor(ev.techName))}
                          title={`${ev.title}${ev.customerName ? ` — ${ev.customerName}` : ""}${ev.techName ? ` (${ev.techName})` : ""}`}
                        >
                          <span className="mr-1">{ev.type === "task" ? "☑" : "🔧"}</span>
                          <span className="truncate">{ev.title}</span>
                        </button>
                      ))}
                      {dayEvents.length > 3 && (
                        <span className="text-[10px] text-muted-foreground pl-1">+{dayEvents.length - 3} more</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Legend */}
            <div className="mt-4 flex flex-wrap gap-3 text-xs text-muted-foreground">
              <span className="flex items-center gap-1.5"><CheckSquare className="w-3.5 h-3.5" /> Task (due date)</span>
              <span className="flex items-center gap-1.5">🔧 Work Order (scheduled)</span>
              {technicians.slice(0, 4).map((t) => (
                <span key={t.id} className={cn("flex items-center gap-1.5 px-2 py-0.5 rounded border", techColorMap[t.id])}>{t.name}</span>
              ))}
            </div>
          </>
        )}
      </div>
    </Layout>
  );
}
