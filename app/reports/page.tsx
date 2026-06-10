"use client";

import { AppShell } from "@/components/app-shell";
import { Button, PageHeader, Panel } from "@/components/ui";
import { sales } from "@/lib/data";
import { useBusinessData } from "@/lib/use-business-data";
import { downloadCsv } from "@/lib/utils";
import { Download, FileSpreadsheet, FileText } from "lucide-react";

export default function ReportsPage() {
  const { products, debts, expenses } = useBusinessData();
  const reports = [
    { title: "Daily Sales Report", description: "Invoice totals, collections, balances, and payment methods.", rows: sales },
    { title: "Inventory Report", description: "Stock quantities, reorder levels, costs, suppliers, and valuation.", rows: products },
    { title: "Customer Debt Report", description: "Outstanding customer balances, overdue ledgers, and payment history.", rows: debts },
    { title: "Financial Report", description: "Income, expense categories, cash flow, monthly profit and loss.", rows: expenses }
  ];
  return (
    <AppShell>
      <PageHeader title="Reporting System" description="Generate daily, weekly, monthly, customer debt, inventory, and financial reports." />
      <div className="grid gap-4 md:grid-cols-2">
        {reports.map((report) => (
          <Panel key={report.title} title={report.title}>
            <p className="mb-5 text-sm text-slate-500 dark:text-slate-400">{report.description}</p>
            <div className="flex flex-wrap gap-2">
              <Button onClick={() => window.print()}><FileText size={16} /> PDF</Button>
              <Button className="bg-slate-900 dark:bg-slate-700"><FileSpreadsheet size={16} /> Excel</Button>
              <Button className="bg-white text-slate-700 ring-1 ring-slate-200 hover:bg-slate-50 dark:bg-slate-900 dark:text-slate-100 dark:ring-slate-700" onClick={() => downloadCsv(`${report.title.toLowerCase().replaceAll(" ", "-")}.csv`, report.rows)}>
                <Download size={16} /> CSV
              </Button>
            </div>
          </Panel>
        ))}
      </div>
    </AppShell>
  );
}
