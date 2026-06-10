"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  BarChart3,
  Bell,
  Boxes,
  Building2,
  CircleDollarSign,
  ClipboardList,
  FileText,
  LayoutDashboard,
  Menu,
  Moon,
  ShoppingCart,
  ReceiptText,
  Search,
  ShieldCheck,
  LogOut,
  Sun,
  Users,
  X
} from "lucide-react";
import { useDeferredValue, useEffect, useMemo, useState } from "react";
import { cn } from "@/lib/utils";
import { useBusinessData } from "@/lib/use-business-data";
import { buildSmartNotifications, isSmartNotificationRead } from "@/lib/notifications";

const navigation = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/inventory", label: "Inventory", icon: Boxes },
  { href: "/cart", label: "Cart / POS", icon: ShoppingCart },
  { href: "/sales", label: "Sales", icon: ReceiptText },
  { href: "/debts", label: "Customer Debts", icon: Users },
  { href: "/suppliers", label: "Suppliers", icon: Building2 },
  { href: "/requests", label: "Customer Requests", icon: ClipboardList },
  { href: "/finance", label: "Finance", icon: CircleDollarSign },
  { href: "/reports", label: "Reports", icon: FileText },
  { href: "/notifications", label: "Notifications", icon: Bell }
];

let prefetchedRoutes = false;

export function AppShell({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [dark, setDark] = useState(false);
  const [themeReady, setThemeReady] = useState(false);
  const [notificationReadVersion, setNotificationReadVersion] = useState(0);
  const [search, setSearch] = useState("");
  const [sessionUser, setSessionUser] = useState({ name: "PayTrack User", role: "STAFF" });
  const data = useBusinessData();
  const { products, cart } = data;
  const deferredSearch = useDeferredValue(search);
  const searchValue = deferredSearch.trim().toLowerCase();
  const alerts = useMemo(() => buildSmartNotifications(data), [data]);
  const alertCount = useMemo(
    () => alerts.filter((item) => item.priority !== "Normal" && !isSmartNotificationRead(item.id)).length,
    [alerts, notificationReadVersion]
  );
  const cartCount = useMemo(() => cart.reduce((sum, item) => sum + item.quantity, 0), [cart]);
  const searchResults = useMemo(() => {
    if (!searchValue) return [];
    return products
      .filter((product) =>
        [product.name, product.serialCode, product.category, product.supplier]
          .some((field) => field.toLowerCase().includes(searchValue))
      )
      .slice(0, 6);
  }, [products, searchValue]);

  useEffect(() => {
    const storedTheme = localStorage.getItem("paytrack_theme");
    const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    setDark(storedTheme ? storedTheme === "dark" : prefersDark);
    setThemeReady(true);
  }, []);

  useEffect(() => {
    if (!themeReady) return;
    localStorage.setItem("paytrack_theme", dark ? "dark" : "light");
    document.documentElement.classList.toggle("dark", dark);
  }, [dark, themeReady]);

  useEffect(() => {
    setSessionUser({
      name: localStorage.getItem("paytrack_name") || "PayTrack User",
      role: localStorage.getItem("paytrack_role") || "STAFF"
    });
    const syncNotificationReads = () => setNotificationReadVersion((value) => value + 1);
    window.addEventListener("smart-notifications-read", syncNotificationReads);
    window.addEventListener("storage", syncNotificationReads);
    return () => {
      window.removeEventListener("smart-notifications-read", syncNotificationReads);
      window.removeEventListener("storage", syncNotificationReads);
    };
  }, []);

  useEffect(() => {
    if (prefetchedRoutes) return;
    prefetchedRoutes = true;
    const timer = window.setTimeout(() => {
      navigation.forEach((item) => router.prefetch(item.href));
    }, 250);
    return () => window.clearTimeout(timer);
  }, [router]);

  const signOut = () => {
    localStorage.removeItem("paytrack_token");
    localStorage.removeItem("paytrack_role");
    localStorage.removeItem("paytrack_name");
    document.cookie = "paytrack_session=; path=/; max-age=0; SameSite=Lax";
    router.replace("/");
    router.refresh();
  };

  return (
    <div className="min-h-screen text-ink dark:text-slate-100">
      {open && <button className="fixed inset-0 z-30 bg-slate-950/45 backdrop-blur-sm print:hidden lg:hidden" onClick={() => setOpen(false)} aria-label="Close menu overlay" />}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-40 w-72 border-r border-white/70 bg-white/90 px-4 py-5 shadow-2xl shadow-slate-900/10 backdrop-blur-xl transition-transform print:hidden dark:border-slate-800 dark:bg-slate-950/90 lg:translate-x-0 lg:shadow-none",
          open ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <div className="flex items-center justify-between rounded-lg border border-slate-200 bg-white p-3 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <Link href="/dashboard" className="flex items-center gap-3">
            <span className="grid size-10 place-items-center rounded-lg bg-brand-600 text-white shadow-md shadow-brand-600/25">
              <BarChart3 size={21} />
            </span>
            <span>
              <span className="block text-lg font-bold">PAYTRACK</span>
              <span className="text-xs font-medium text-slate-500 dark:text-slate-400">Kings Store Cosmetics</span>
            </span>
          </Link>
          <button className="grid size-9 place-items-center rounded-lg border border-slate-200 text-slate-500 transition hover:bg-slate-100 dark:border-slate-700 dark:hover:bg-slate-800 lg:hidden" onClick={() => setOpen(false)} aria-label="Close menu">
            <X size={20} />
          </button>
        </div>

        <nav className="mt-8 space-y-1">
          {navigation.map((item) => {
            const active = pathname === item.href;
            const Icon = item.icon;
            return (
              <Link
                href={item.href}
                key={item.href}
                onClick={() => setOpen(false)}
                className={cn(
                  "group flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-bold text-slate-600 transition hover:bg-slate-100 hover:text-slate-950 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white",
                  active && "bg-brand-50 text-brand-700 ring-1 ring-brand-100 dark:bg-brand-600/15 dark:text-brand-100 dark:ring-brand-600/25"
                )}
              >
                <span className={cn("grid size-8 place-items-center rounded-lg bg-slate-100 text-slate-500 transition group-hover:bg-white group-hover:text-brand-700 dark:bg-slate-800 dark:text-slate-300", active && "bg-brand-600 text-white group-hover:bg-brand-600 group-hover:text-white")}>
                  <Icon size={17} />
                </span>
                <span className="flex-1">{item.label}</span>
                {item.href === "/cart" && cartCount > 0 && (
                  <span className="rounded-full bg-brand-600 px-2 py-0.5 text-xs font-black text-white">
                    {cartCount}
                  </span>
                )}
                {item.href === "/notifications" && alertCount > 0 && (
                  <span className="rounded-full bg-red-600 px-2 py-0.5 text-xs font-black text-white">
                    {alertCount}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>

        <div className="absolute bottom-5 left-4 right-4 rounded-lg border border-emerald-200 bg-emerald-50 p-4 shadow-sm dark:border-emerald-900 dark:bg-emerald-950/35">
          <div className="flex items-center gap-3">
            <span className="grid size-10 place-items-center rounded-lg bg-white text-brand-600 shadow-sm dark:bg-slate-900">
              <ShieldCheck size={20} />
            </span>
            <div>
              <p className="text-sm font-black">{sessionUser.name}</p>
              <p className="text-xs text-slate-500 dark:text-slate-400">{sessionUser.role.toLowerCase()} account</p>
            </div>
          </div>
          <button
            type="button"
            onClick={signOut}
            className="mt-3 inline-flex h-9 w-full items-center justify-center gap-2 rounded-lg bg-white text-sm font-black text-slate-700 shadow-sm ring-1 ring-emerald-200 transition hover:bg-emerald-100 dark:bg-slate-900 dark:text-slate-100 dark:ring-emerald-900 dark:hover:bg-slate-800"
          >
            <LogOut size={15} /> Sign Out
          </button>
        </div>
      </aside>

      <div className="print:pl-0 lg:pl-72">
        <header className="sticky top-0 z-20 border-b border-white/70 bg-white/82 backdrop-blur-xl print:hidden dark:border-slate-800 dark:bg-slate-950/82">
          <div className="mx-auto flex h-16 max-w-[1500px] items-center gap-3 px-4 sm:px-6">
            <button className="grid size-10 place-items-center rounded-lg border border-slate-200 bg-white text-slate-600 shadow-sm transition hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800 lg:hidden" onClick={() => setOpen(true)} aria-label="Open menu">
              <Menu size={22} />
            </button>
            <div className="relative max-w-xl flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                className="h-10 w-full rounded-lg border border-slate-200 bg-white pl-10 pr-3 text-sm font-medium shadow-sm outline-none transition placeholder:text-slate-400 focus:border-brand-500 focus:ring-4 focus:ring-brand-600/10 dark:border-slate-700 dark:bg-slate-900 dark:focus:ring-brand-500/15"
                placeholder="Search products by name, barcode, category..."
              />
              {searchResults.length > 0 && (
                <div className="absolute left-0 right-0 top-12 z-40 overflow-hidden rounded-lg border border-slate-200 bg-white shadow-xl dark:border-slate-800 dark:bg-slate-900">
                  {searchResults.map((product) => (
                    <Link
                      key={product.id}
                      href={`/inventory?product=${encodeURIComponent(product.id)}`}
                      onClick={() => setSearch("")}
                      className="block px-4 py-3 text-sm transition hover:bg-brand-50 dark:hover:bg-slate-800"
                    >
                      <span className="block font-black">{product.name}</span>
                      <span className="text-xs font-semibold text-slate-500">{product.category} - {product.quantity.toLocaleString()} available</span>
                    </Link>
                  ))}
                </div>
              )}
            </div>
            <button
              onClick={() => setDark((value) => !value)}
              className="grid size-10 place-items-center rounded-lg border border-slate-200 bg-white text-slate-600 shadow-sm transition hover:-translate-y-0.5 hover:bg-slate-100 hover:text-slate-950 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
              aria-label="Toggle dark mode"
              title="Toggle dark mode"
            >
              {dark ? <Sun size={18} /> : <Moon size={18} />}
            </button>
          </div>
        </header>
        <main className="mx-auto max-w-[1500px] px-4 py-6 print:max-w-none print:p-0 sm:px-6">{children}</main>
      </div>
    </div>
  );
}
