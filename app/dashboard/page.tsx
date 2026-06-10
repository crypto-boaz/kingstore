"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { AppShell } from "@/components/app-shell";
import { Badge, DataTable, PageHeader, Panel, StatCard } from "@/components/ui";
import { buildSmartNotifications } from "@/lib/notifications";
import { useBusinessData } from "@/lib/use-business-data";
import { money, shortDate } from "@/lib/utils";
import { AlertTriangle, ArrowUpRight, BellRing } from "lucide-react";

function today() {
  return new Date().toISOString().slice(0, 10);
}

function monthKey() {
  return new Date().toISOString().slice(0, 7);
}

function DashboardCardLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link href={href} className="block rounded-lg transition hover:-translate-y-0.5 focus-visible:outline focus-visible:outline-4 focus-visible:outline-brand-600/25">
      {children}
    </Link>
  );
}

export default function DashboardPage() {
  const [showWelcome, setShowWelcome] = useState(false);
  const data = useBusinessData();
  const { products, debts, expenses, suppliers, sales } = data;
  const alerts = buildSmartNotifications(data);
  const todayValue = today();
  const currentMonth = monthKey();
  const dailySales = sales.filter((sale) => sale.date === todayValue).reduce((sum, sale) => sum + sale.total, 0);
  const monthlySales = sales.filter((sale) => sale.date.startsWith(currentMonth)).reduce((sum, sale) => sum + sale.total, 0);
  const customerDebts = debts.reduce((sum, debt) => sum + Math.max(0, debt.total - debt.paid), 0);
  const supplierPayments = suppliers.reduce((sum, supplier) => sum + Math.max(0, supplier.total - supplier.paid), 0);
  const expenseTotal = expenses.reduce((sum, expense) => sum + expense.amount, 0);
  const recentSales = sales.slice(0, 8);
  const lowStock = products.filter((product) => product.quantity <= product.lowStockAt);

  useEffect(() => {
    if (!window.location.search.includes("welcome=1")) return;
    setShowWelcome(true);
    const timer = window.setTimeout(() => {
      setShowWelcome(false);
      window.history.replaceState(null, "", "/dashboard");
    }, 1800);
    return () => window.clearTimeout(timer);
  }, []);

  return (
    <AppShell>
      {showWelcome && (
        <div className="fixed inset-0 z-[80] grid place-items-center bg-slate-950 text-white">
          <div className="text-center">
            <div className="mx-auto mb-6 size-16 animate-pulse rounded-lg bg-brand-600 shadow-2xl shadow-brand-600/40" />
            <p className="text-sm font-black uppercase tracking-[0.28em] text-brand-100">PayTrack</p>
            <h1 className="mt-3 text-3xl font-black sm:text-5xl">Welcome to Kings Store Cosmetics</h1>
            <div className="mx-auto mt-6 h-1.5 w-72 overflow-hidden rounded-full bg-white/10">
              <div className="h-full w-1/2 animate-[loadingBar_1.4s_ease-in-out_infinite] rounded-full bg-brand-400" />
            </div>
          </div>
        </div>
      )}
      <PageHeader
        title="Kings Store Cosmetics Dashboard"
        description="Real-time PayTrack control center for inventory, daily sales, debts, supplier payments, finances, alerts, and transactions."
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <DashboardCardLink href="/inventory">
          <StatCard label="Inventory Summary" value={String(products.length)} detail={`${products.reduce((sum, product) => sum + product.quantity, 0).toLocaleString()} units in stock`} />
        </DashboardCardLink>
        <DashboardCardLink href="/sales">
          <StatCard label="Daily Sales" value={dailySales} detail="Automatically resets each new day" tone="success" />
        </DashboardCardLink>
        <DashboardCardLink href="/reports">
          <StatCard label="Monthly Sales" value={monthlySales} detail="Current month sales history" tone="success" />
        </DashboardCardLink>
        <DashboardCardLink href="/debts">
          <StatCard label="Customer Debts" value={customerDebts} detail={`${debts.filter((debt) => debt.status !== "Settled").length} active ledgers`} tone="warning" />
        </DashboardCardLink>
        <DashboardCardLink href="/suppliers">
          <StatCard label="Supplier Payments" value={supplierPayments} detail="Outstanding supplier balances" tone="warning" />
        </DashboardCardLink>
        <DashboardCardLink href="/finance">
          <StatCard label="Financial Overview" value={monthlySales - expenseTotal} detail="Sales minus recorded expenses" />
        </DashboardCardLink>
        <DashboardCardLink href="/inventory">
          <StatCard label="Low Stock Alerts" value={String(lowStock.length)} detail="Products below reorder level" tone={lowStock.length ? "danger" : "success"} />
        </DashboardCardLink>
        <DashboardCardLink href="/notifications">
          <StatCard label="Notification Center" value={String(alerts.length)} detail="Smart system alerts" tone={alerts.length ? "warning" : "success"} />
        </DashboardCardLink>
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
        <Panel title="Recent Transactions">
          {recentSales.length === 0 ? (
            <Link href="/sales" className="block rounded-lg border border-dashed border-slate-300 p-8 text-center transition hover:bg-brand-50/70 dark:border-slate-700 dark:hover:bg-slate-800/80">
              <p className="font-black">No transactions yet</p>
              <p className="mt-1 text-sm font-semibold text-slate-500">Sales recorded in POS will appear here immediately.</p>
            </Link>
          ) : (
            <DataTable
              headers={["Invoice", "Customer", "Items", "Amount", "Paid", "Status", "Date"]}
              rowHrefs={recentSales.map(() => "/sales")}
              rows={recentSales.map((sale) => [
                sale.id,
                sale.customer,
                sale.product,
                money(sale.total),
                money(sale.paid),
                <Badge key={sale.id} tone={sale.status === "Paid" ? "success" : sale.status === "Partial" ? "warning" : "danger"}>{sale.status}</Badge>,
                shortDate(sale.date)
              ])}
            />
          )}
        </Panel>

        <Panel title="Notification Center">
          <div className="space-y-3">
            {alerts.length === 0 ? (
              <Link href="/notifications" className="block rounded-lg border border-dashed border-slate-300 p-6 text-center transition hover:bg-brand-50/70 dark:border-slate-700 dark:hover:bg-slate-800/80">
                <BellRing className="mx-auto text-slate-400" size={32} />
                <p className="mt-3 font-black">No critical alerts</p>
                <p className="mt-1 text-sm font-semibold text-slate-500">PayTrack will notify you when stock, debt, or supplier events need attention.</p>
              </Link>
            ) : alerts.slice(0, 8).map((item) => (
              <Link key={item.id} href={item.href} className="flex items-start gap-3 rounded-lg border border-slate-200 p-3 transition hover:bg-brand-50/70 dark:border-slate-800 dark:hover:bg-slate-800/80">
                <AlertTriangle className={item.priority === "High" ? "text-red-600" : "text-amber-500"} size={18} />
                <div className="flex-1">
                  <p className="font-semibold">{item.title}</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">{item.message}</p>
                </div>
                <ArrowUpRight size={16} className="text-slate-400" />
              </Link>
            ))}
          </div>
        </Panel>
      </div>
    </AppShell>
  );
}
