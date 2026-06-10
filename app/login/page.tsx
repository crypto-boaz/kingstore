"use client";

import { Button } from "@/components/ui";
import { BarChart3, BookOpenCheck, CreditCard, Lock, Mail, ReceiptText, ShieldCheck, User, WalletCards } from "lucide-react";
import { useState } from "react";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/api";
const REGISTRATION_ENABLED = process.env.NEXT_PUBLIC_REGISTRATION_ENABLED === "true" || process.env.NODE_ENV !== "production";

type AuthMode = "signin" | "register";
type UserRole = "STAFF" | "ACCOUNTANT" | "WAREHOUSE";

const roleOptions: Array<{ value: UserRole; label: string }> = [
  { value: "STAFF", label: "Staff" },
  { value: "ACCOUNTANT", label: "Accountant" },
  { value: "WAREHOUSE", label: "Warehouse" }
];

export default function LoginPage() {
  const [mode, setMode] = useState<AuthMode>("signin");
  const [username, setUsername] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [role, setRole] = useState<UserRole>("STAFF");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const finishSignIn = (token: string, user: { name?: string; role?: string }) => {
    localStorage.setItem("paytrack_token", token);
    localStorage.setItem("paytrack_role", user.role ?? "STAFF");
    localStorage.setItem("paytrack_name", user.name ?? "PayTrack User");
    const secureCookie = window.location.protocol === "https:" ? "; Secure" : "";
    document.cookie = `paytrack_session=${encodeURIComponent(token)}; path=/; max-age=28800; SameSite=Strict${secureCookie}`;
    window.location.href = "/dashboard?welcome=1";
  };

  const submitAuth = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");

    if (mode === "register" && !REGISTRATION_ENABLED) {
      setError("Registration is disabled.");
      return;
    }
    if (mode === "register" && password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setLoading(true);
    try {
      const endpoint = mode === "signin" ? "login" : "register";
      const body = mode === "signin"
        ? { username, password }
        : { username, name, email, password, role };
      const response = await fetch(`${API_URL}/auth/${endpoint}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body)
      });
      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(data.message ?? (mode === "signin" ? "Invalid username or password" : "Unable to create account"));
      }

      finishSignIn(data.token, data.user ?? {});
    } catch (authError) {
      setError(authError instanceof Error ? authError.message : "Authentication failed.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="login-scene relative min-h-screen overflow-hidden px-4 py-8 text-slate-950">
      <div className="login-grid" />
      <div className="login-scanline" />
      <div className="relative z-10 mx-auto grid min-h-[calc(100vh-4rem)] w-full max-w-6xl items-center gap-8 lg:grid-cols-[1.05fr_0.8fr]">
        <section className="hidden lg:block">
          <div className="max-w-xl">
            <div className="inline-flex items-center gap-2 rounded-lg border border-emerald-200 bg-white/80 px-3 py-2 text-sm font-black text-brand-700 shadow-sm backdrop-blur">
              <ShieldCheck size={16} /> Secure payment tracking
            </div>
            <h1 className="mt-5 text-5xl font-black leading-tight tracking-normal text-slate-950">
              PayTrack runs Kings Store Cosmetics sales, inventory, credit records, supplier balances, receipts, and alerts in one polished workspace.
            </h1>
            <p className="mt-4 max-w-lg text-base font-semibold leading-7 text-slate-600">
              Built for Kings Store Cosmetics, PayTrack helps staff sell faster, print professional receipts, monitor stock, and follow every payment due.
            </p>
            <div className="mt-6 grid max-w-lg gap-3 sm:grid-cols-3">
              {[
                { label: "Records", text: "Clean payment history", icon: BookOpenCheck },
                { label: "Payments", text: "Cash, POS, transfer", icon: CreditCard },
                { label: "Receipts", text: "Invoices ready to print", icon: ReceiptText }
              ].map((item) => {
                const Icon = item.icon;
                return (
                  <div key={item.label} className="rounded-lg border border-white/75 bg-white/82 p-4 shadow-soft backdrop-blur">
                    <span className="grid size-9 place-items-center rounded-lg bg-brand-600 text-white">
                      <Icon size={17} />
                    </span>
                    <p className="mt-3 text-sm font-black">{item.label}</p>
                    <p className="mt-1 text-xs font-semibold leading-5 text-slate-500">{item.text}</p>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="login-visual mt-8 h-56 max-w-xl rounded-lg border border-white/70 bg-white/55 shadow-2xl shadow-slate-900/10 backdrop-blur">
            <div className="login-conveyor">
              <span />
              <span />
              <span />
            </div>
            <div className="login-bottle bottle-a" />
            <div className="login-bottle bottle-b" />
            <div className="login-bottle bottle-c" />
            <div className="login-panel panel-a">
              <p>Paid Today</p>
              <strong>Tracked</strong>
            </div>
            <div className="login-panel panel-b">
              <p>Receipts</p>
              <strong>Ready</strong>
            </div>
            <div className="login-ledger-card">
              <WalletCards size={18} />
              <span>Django backed</span>
            </div>
          </div>
        </section>

        <section className="paytrack-auth-card w-full rounded-lg border border-white/70 bg-white/92 p-6 shadow-2xl shadow-slate-900/15 backdrop-blur-xl dark:border-slate-800 dark:bg-slate-900/92">
          <div className="mb-6">
            <div className="flex items-center gap-3">
              <span className="grid size-11 place-items-center rounded-lg bg-brand-600 text-white shadow-md shadow-brand-600/25">
                <BarChart3 size={22} />
              </span>
              <div>
                <h2 className="text-xl font-black text-slate-950 dark:text-white">PAYTRACK Access</h2>
                <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Django-secured account access</p>
              </div>
            </div>
            <p className="mt-4 text-sm font-semibold leading-6 text-slate-600 dark:text-slate-300 lg:hidden">
              Track payments, printable receipts, customer balances, due alerts, and daily records.
            </p>
          </div>

          <div className={`mb-5 grid rounded-lg bg-slate-100 p-1 dark:bg-slate-950 ${REGISTRATION_ENABLED ? "grid-cols-2" : "grid-cols-1"}`}>
            {(["signin", ...(REGISTRATION_ENABLED ? ["register"] : [])] as AuthMode[]).map((item) => (
              <button
                key={item}
                type="button"
                onClick={() => {
                  setMode(item);
                  setError("");
                }}
                className={`h-10 rounded-lg text-sm font-black transition ${
                  mode === item
                    ? "bg-white text-brand-700 shadow-sm dark:bg-slate-900 dark:text-brand-100"
                    : "text-slate-500 hover:text-slate-950 dark:text-slate-400 dark:hover:text-white"
                }`}
              >
                {item === "signin" ? "Sign In" : "Register"}
              </button>
            ))}
          </div>

          <form className="space-y-4" onSubmit={submitAuth}>
            <label className="block text-sm font-semibold">
              Username
              <span className="mt-1 flex h-11 items-center gap-2 rounded-lg border border-slate-200 px-3 dark:border-slate-700">
                <User size={16} className="text-slate-400" />
                <input
                  className="w-full bg-transparent outline-none"
                  value={username}
                  onChange={(event) => setUsername(event.target.value)}
                  placeholder="admin"
                  autoComplete="username"
                />
              </span>
            </label>

            {mode === "register" && (
              <>
                <label className="block text-sm font-semibold">
                  Full Name
                  <span className="mt-1 flex h-11 items-center gap-2 rounded-lg border border-slate-200 px-3 dark:border-slate-700">
                    <User size={16} className="text-slate-400" />
                    <input
                      className="w-full bg-transparent outline-none"
                      value={name}
                      onChange={(event) => setName(event.target.value)}
                      placeholder="Enter full name"
                    />
                  </span>
                </label>

                <label className="block text-sm font-semibold">
                  Email
                  <span className="mt-1 flex h-11 items-center gap-2 rounded-lg border border-slate-200 px-3 dark:border-slate-700">
                    <Mail size={16} className="text-slate-400" />
                    <input
                      className="w-full bg-transparent outline-none"
                      value={email}
                      onChange={(event) => setEmail(event.target.value)}
                      placeholder="name@kingsstore.local"
                      type="email"
                    />
                  </span>
                </label>
              </>
            )}

            {mode === "register" && (
              <label className="block text-sm font-semibold">
                Role
                <select
                  value={role}
                  onChange={(event) => setRole(event.target.value as UserRole)}
                  className="mt-1 h-11 w-full rounded-lg border border-slate-200 px-3 dark:border-slate-700 dark:bg-slate-950"
                >
                  {roleOptions.map((item) => (
                    <option key={item.value} value={item.value}>{item.label}</option>
                  ))}
                </select>
              </label>
            )}

            <label className="block text-sm font-semibold">
              Password
              <span className="mt-1 flex h-11 items-center gap-2 rounded-lg border border-slate-200 px-3 dark:border-slate-700">
                <Lock size={16} className="text-slate-400" />
                <input
                  type="password"
                  className="w-full bg-transparent outline-none"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder="Enter password"
                  autoComplete={mode === "signin" ? "current-password" : "new-password"}
                />
              </span>
            </label>

            {mode === "register" && (
              <label className="block text-sm font-semibold">
                Confirm Password
                <span className="mt-1 flex h-11 items-center gap-2 rounded-lg border border-slate-200 px-3 dark:border-slate-700">
                  <Lock size={16} className="text-slate-400" />
                  <input
                    type="password"
                    className="w-full bg-transparent outline-none"
                    value={confirmPassword}
                    onChange={(event) => setConfirmPassword(event.target.value)}
                    placeholder="Confirm password"
                    autoComplete="new-password"
                  />
                </span>
              </label>
            )}

            {error && (
              <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm font-semibold text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-200">
                {error}
              </p>
            )}

            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Please wait..." : mode === "signin" ? "Sign In" : "Create Account"}
            </Button>
          </form>
        </section>
      </div>
    </main>
  );
}
