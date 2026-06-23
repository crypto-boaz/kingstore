"use client";

import { useMemo, useState } from "react";
import { AppShell } from "@/components/app-shell";
import { Badge, Button, DataTable, PageHeader, Panel, StatCard } from "@/components/ui";
import { useBusinessData } from "@/lib/use-business-data";
import { downloadCsv, money, shortDate } from "@/lib/utils";
import { Download, FileText } from "lucide-react";

type ReportMode = "today" | "date" | "week" | "month" | "year" | "range";

function isoDate(date: Date) {
  return date.toISOString().slice(0, 10);
}

function today() {
  return isoDate(new Date());
}

function monthStart(value: Date) {
  return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, "0")}-01`;
}

function yearStart(value: Date) {
  return `${value.getFullYear()}-01-01`;
}

function weekStart(value: Date) {
  const date = new Date(value);
  date.setDate(date.getDate() - date.getDay());
  return isoDate(date);
}

function labelForMode(mode: ReportMode) {
  const labels: Record<ReportMode, string> = {
    today: "Today's Sales",
    date: "Specific Date",
    week: "This Week",
    month: "This Month",
    year: "This Year",
    range: "Custom Range"
  };
  return labels[mode];
}

export default function ReportsPage() {
  const { sales, products, debts, expenses } = useBusinessData();
  const now = new Date();
  const todayValue = today();
  const [mode, setMode] = useState<ReportMode>("today");
  const [selectedDate, setSelectedDate] = useState(todayValue);
  const [rangeStart, setRangeStart] = useState(monthStart(now));
  const [rangeEnd, setRangeEnd] = useState(todayValue);

  const period = useMemo(() => {
    if (mode === "today") return { start: todayValue, end: todayValue };
    if (mode === "date") return { start: selectedDate, end: selectedDate };
    if (mode === "week") return { start: weekStart(now), end: todayValue };
    if (mode === "month") return { start: monthStart(now), end: todayValue };
    if (mode === "year") return { start: yearStart(now), end: todayValue };
    return rangeStart <= rangeEnd ? { start: rangeStart, end: rangeEnd } : { start: rangeEnd, end: rangeStart };
  }, [mode, now, rangeEnd, rangeStart, selectedDate, todayValue]);

  const filteredSales = useMemo(() => {
    return sales.filter((sale) => sale.date >= period.start && sale.date <= period.end);
  }, [period, sales]);

  const totalRevenue = filteredSales.reduce((sum, sale) => sum + sale.total, 0);
  const amountCollected = filteredSales.reduce((sum, sale) => sum + sale.paid, 0);
  const productsSold = filteredSales.reduce((sum, sale) => sum + sale.quantity, 0);
  const outstanding = filteredSales.reduce((sum, sale) => sum + Math.max(0, sale.total - sale.paid), 0);

  const inventoryValue = products.reduce((sum, product) => sum + Math.max(0, product.quantity) * product.costPrice, 0);
  const reports = [
    { title: "Sales History", rows: filteredSales },
    { title: "Inventory", rows: products },
    { title: "Customer Debts", rows: debts },
    { title: "Expenses", rows: expenses }
  ];

  return (
    <AppShell>
      <PageHeader title="Sales History & Reports" description="Review completed sales by day, week, month, year, or a custom date range." />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <StatCard label="Total Revenue" value={totalRevenue} tone="success" />
        <StatCard label="Transactions" value={String(filteredSales.length)} />
        <StatCard label="Products Sold" value={String(productsSold)} />
        <StatCard label="Amount Collected" value={amountCollected} tone="success" />
        <StatCard label="Outstanding" value={outstanding} tone={outstanding ? "warning" : "success"} />
      </div>

      <Panel title="Report Filters" className="mt-6">
        <div className="flex flex-wrap gap-2">
          {(["today", "date", "week", "month", "year", "range"] as ReportMode[]).map((item) => (
            <Button
              key={item}
              onClick={() => setMode(item)}
              className={mode === item ? "" : "bg-white text-slate-700 ring-1 ring-slate-200 hover:bg-slate-50 dark:bg-slate-900 dark:text-slate-100 dark:ring-slate-700"}
            >
              {labelForMode(item)}
            </Button>
          ))}
        </div>
        <div className="mt-4 grid gap-3 md:grid-cols-3">
          <label className="text-sm font-bold">Specific Date
            <input type="date" value={selectedDate} onChange={(event) => { setSelectedDate(event.target.value); setMode("date"); }} className="mt-1 h-10 w-full rounded-lg border border-slate-200 px-3 dark:border-slate-700 dark:bg-slate-950" />
          </label>
          <label className="text-sm font-bold">From
            <input type="date" value={rangeStart} onChange={(event) => { setRangeStart(event.target.value); setMode("range"); }} className="mt-1 h-10 w-full rounded-lg border border-slate-200 px-3 dark:border-slate-700 dark:bg-slate-950" />
          </label>
          <label className="text-sm font-bold">To
            <input type="date" value={rangeEnd} onChange={(event) => { setRangeEnd(event.target.value); setMode("range"); }} className="mt-1 h-10 w-full rounded-lg border border-slate-200 px-3 dark:border-slate-700 dark:bg-slate-950" />
          </label>
        </div>
        <p className="mt-4 text-sm font-semibold text-slate-500 dark:text-slate-400">
          Showing {labelForMode(mode).toLowerCase()} from {shortDate(period.start)} to {shortDate(period.end)}.
        </p>
      </Panel>

      <Panel title="Completed Sales" className="mt-6">
        <div className="mb-4 flex flex-wrap gap-2">
          <Button onClick={() => window.print()}><FileText size={16} /> PDF</Button>
          <Button className="bg-white text-slate-700 ring-1 ring-slate-200 hover:bg-slate-50 dark:bg-slate-900 dark:text-slate-100 dark:ring-slate-700" onClick={() => downloadCsv("sales-report.csv", filteredSales)}>
            <Download size={16} /> CSV
          </Button>
        </div>
        {filteredSales.length === 0 ? (
          <div className="rounded-lg border border-dashed border-slate-300 p-8 text-center dark:border-slate-700">
            <p className="font-black">No sales found</p>
            <p className="mt-1 text-sm font-semibold text-slate-500">Completed sales for the selected period will appear here.</p>
          </div>
        ) : (
          <DataTable
            headers={["Invoice", "Customer", "Products", "Qty", "Total", "Paid", "Balance", "Method", "Status", "Date"]}
            rows={filteredSales.map((sale) => [
              sale.id,
              sale.customer,
              sale.product,
              sale.quantity,
              money(sale.total),
              money(sale.paid),
              money(Math.max(0, sale.total - sale.paid)),
              sale.method,
              <Badge key={sale.id} tone={sale.status === "Paid" ? "success" : sale.status === "Partial" ? "warning" : "danger"}>{sale.status}</Badge>,
              shortDate(sale.date)
            ])}
          />
        )}
      </Panel>

      <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Inventory Value" value={inventoryValue} tone="success" />
        {reports.map((report) => (
          <Panel key={report.title} title={report.title}>
            <p className="mb-4 text-sm font-semibold text-slate-500 dark:text-slate-400">{report.rows.length.toLocaleString()} rows available.</p>
            <Button className="bg-white text-slate-700 ring-1 ring-slate-200 hover:bg-slate-50 dark:bg-slate-900 dark:text-slate-100 dark:ring-slate-700" onClick={() => downloadCsv(`${report.title.toLowerCase().replaceAll(" ", "-")}.csv`, report.rows)}>
              <Download size={16} /> CSV
            </Button>
          </Panel>
        ))}
      </div>
    </AppShell>
  );
}
