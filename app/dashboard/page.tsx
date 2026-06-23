"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
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
  const alerts = useMemo(() => buildSmartNotifications(data), [data]);
  const todayValue = today();
  const currentMonth = monthKey();
  const metrics = useMemo(() => {
    let dailySales = 0;
    let dailyTransactions = 0;
    let monthlySales = 0;
    for (const sale of sales) {
      if (sale.date === todayValue) {
        dailySales += sale.total;
        dailyTransactions += 1;
      }
      if (sale.date.startsWith(currentMonth)) monthlySales += sale.total;
    }

    let inventoryValue = 0;
    let totalUnits = 0;
    let lowStockCount = 0;
    let outOfStockCount = 0;
    for (const product of products) {
      inventoryValue += Math.max(0, product.quantity) * product.costPrice;
      totalUnits += product.quantity;
      if (product.quantity <= product.lowStockAt) lowStockCount += 1;
      if (product.quantity <= 0) outOfStockCount += 1;
    }

    return {
      dailySales,
      dailyTransactions,
      monthlySales,
      customerDebts: debts.reduce((sum, debt) => sum + Math.max(0, debt.total - debt.paid), 0),
      activeDebts: debts.filter((debt) => debt.status !== "Settled").length,
      supplierPayments: suppliers.reduce((sum, supplier) => sum + Math.max(0, supplier.total - supplier.paid), 0),
      expenseTotal: expenses.reduce((sum, expense) => sum + expense.amount, 0),
      inventoryValue,
      totalUnits,
      lowStockCount,
      outOfStockCount
    };
  }, [currentMonth, debts, expenses, products, sales, suppliers, todayValue]);
  const recentSales = useMemo(() => sales.slice(0, 8), [sales]);

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
          <StatCard label="Inventory Value" value={metrics.inventoryValue} detail={`${metrics.totalUnits.toLocaleString()} units in stock`} tone="success" />
        </DashboardCardLink>
        <DashboardCardLink href="/sales">
          <StatCard label="Today's Sales" value={metrics.dailySales} detail={`${metrics.dailyTransactions} transactions today`} tone="success" />
        </DashboardCardLink>
        <DashboardCardLink href="/reports">
          <StatCard label="Monthly Sales" value={metrics.monthlySales} detail="Current month sales history" tone="success" />
        </DashboardCardLink>
        <DashboardCardLink href="/inventory">
          <StatCard label="Total Products" value={String(products.length)} detail={`${metrics.totalUnits.toLocaleString()} total units`} />
        </DashboardCardLink>
        <DashboardCardLink href="/inventory">
          <StatCard label="Low Stock Items" value={String(metrics.lowStockCount)} detail="Products at or below reorder level" tone={metrics.lowStockCount ? "danger" : "success"} />
        </DashboardCardLink>
        <DashboardCardLink href="/inventory">
          <StatCard label="Out of Stock" value={String(metrics.outOfStockCount)} detail="Products currently at zero stock" tone={metrics.outOfStockCount ? "danger" : "success"} />
        </DashboardCardLink>
        <DashboardCardLink href="/debts">
          <StatCard label="Customer Debts" value={metrics.customerDebts} detail={`${metrics.activeDebts} active ledgers`} tone="warning" />
        </DashboardCardLink>
        <DashboardCardLink href="/suppliers">
          <StatCard label="Supplier Payments" value={metrics.supplierPayments} detail="Outstanding supplier balances" tone="warning" />
        </DashboardCardLink>
        <DashboardCardLink href="/finance">
          <StatCard label="Financial Overview" value={metrics.monthlySales - metrics.expenseTotal} detail="Sales minus recorded expenses" />
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
