"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { Badge, Button, PageHeader, Panel, StatCard } from "@/components/ui";
import { Notice, type NoticeState } from "@/components/notice";
import { addToCart, clearCart, removeFromCart, updateCartItem } from "@/lib/business-store";
import { useBusinessData } from "@/lib/use-business-data";
import { CheckCircle2, CreditCard, Minus, Plus, ReceiptText, Search, ShoppingCart, X } from "lucide-react";

const POS_PRODUCT_LIMIT = 240;

function cartAmount(value: number) {
  return new Intl.NumberFormat("en-NG", { maximumFractionDigits: 0 }).format(value);
}

export default function CartPage() {
  const router = useRouter();
  const { products, cart } = useBusinessData();
  const [query, setQuery] = useState("");
  const [discount, setDiscount] = useState(0);
  const [paymentMethod, setPaymentMethod] = useState("Transfer");
  const [showPayment, setShowPayment] = useState(false);
  const [paymentConfirmed, setPaymentConfirmed] = useState(false);
  const [notice, setNotice] = useState<NoticeState>(null);

  const results = useMemo(() => {
    const value = query.trim().toLowerCase();
    const source = [];
    if (!value) {
      source.push(...products.slice(0, POS_PRODUCT_LIMIT));
    } else {
      for (const product of products) {
        if ([product.name, product.serialCode, product.category].some((field) => field.toLowerCase().includes(value))) {
          source.push(product);
          if (source.length >= POS_PRODUCT_LIMIT) break;
        }
      }
    }
    return source.sort((a, b) => a.category.localeCompare(b.category) || a.name.localeCompare(b.name));
  }, [products, query]);

  const cartRows = cart
    .map((item) => {
      const product = products.find((entry) => entry.id === item.productId);
      return product ? { ...item, product, subtotal: item.quantity * product.unitPrice } : null;
    })
    .filter(Boolean) as Array<{ productId: string; quantity: number; product: typeof products[number]; subtotal: number }>;
  const subtotal = cartRows.reduce((sum, item) => sum + item.subtotal, 0);
  const total = Math.max(0, subtotal - discount);
  const groupedResults = Array.from(
    results.reduce((groups, product) => {
      const category = product.category || "Uncategorized";
      groups.set(category, [...(groups.get(category) ?? []), product]);
      return groups;
    }, new Map<string, typeof products>())
  );

  const safely = (fn: () => void, success?: string) => {
    try {
      fn();
      if (success) setNotice({ type: "success", message: success });
    } catch (error) {
      setNotice({ type: "error", message: error instanceof Error ? error.message : "Action failed." });
    }
  };

  const startPayment = () => {
    if (cartRows.length === 0) {
      setNotice({ type: "error", message: "Add products to the cart before making payment." });
      return;
    }
    setShowPayment(true);
    setPaymentConfirmed(false);
    setNotice({ type: "success", message: "Select a payment method and confirm the payment." });
  };

  const confirmPayment = () => {
    setPaymentConfirmed(true);
    setNotice({
      type: "success",
      message: paymentMethod === "Cash"
        ? "Cash payment confirmed. Continue to Sales to write and print the receipt."
        : `${paymentMethod} payment confirmed. Continue to Sales to print the invoice.`
    });
  };

  const goToSales = () => {
    router.push(`/sales?method=${encodeURIComponent(paymentMethod)}&amount=${total}&discount=${discount}`);
  };

  return (
    <AppShell>
      <PageHeader
        title="Point of Sale"
        description="Fast workflow: search products, select products, review cart, then proceed to payment."
      />
      <Notice notice={notice} />

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard label="Cart Items" value={cart.reduce((sum, item) => sum + item.quantity, 0)} />
        <StatCard label="Subtotal" value={subtotal} tone="success" />
        <StatCard label="Total Due" value={total} tone="warning" />
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-[1.35fr_0.9fr]">
        <Panel title="1. Search & Select Products">
          <div className="relative mb-4">
            <Search className="absolute left-3 top-3 text-slate-400" size={18} />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              className="h-11 w-full rounded-lg border border-slate-200 bg-slate-50 pl-10 pr-3 text-sm font-semibold dark:border-slate-700 dark:bg-slate-950"
              placeholder="Search products by name, category, or barcode"
            />
          </div>
          {products.length === 0 ? (
            <div className="rounded-lg border border-dashed border-slate-300 p-6 text-center dark:border-slate-700">
              <ShoppingCart className="mx-auto text-slate-400" size={34} />
              <p className="mt-3 font-black">No products in inventory yet</p>
              <p className="mt-1 text-sm font-semibold text-slate-500">Add products in Inventory before serving customers.</p>
              <Button className="mt-4" onClick={() => router.push("/inventory")}><Plus size={16} /> Add Products</Button>
            </div>
          ) : (
            <div className="max-h-[68vh] overflow-y-auto pr-1">
              {products.length > POS_PRODUCT_LIMIT && !query.trim() && (
                <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm font-semibold text-amber-900 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-100">
                  Showing the first {POS_PRODUCT_LIMIT.toLocaleString()} products. Search by product name, category, or barcode to find anything else instantly.
                </div>
              )}
              {groupedResults.map(([category, items]) => (
                <div key={category} className="mb-5">
                  <h3 className="sticky top-0 z-10 mb-2 rounded-lg bg-slate-100 px-3 py-2 text-xs font-black uppercase text-slate-500 dark:bg-slate-950 dark:text-slate-400">{category}</h3>
                  <div className="grid gap-3 md:grid-cols-2">
                    {(items ?? []).map((product) => (
                      <div key={product.id} className="flex min-h-28 flex-col justify-between gap-3 rounded-lg border border-slate-200 bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-950">
                        <div>
                          <p className="whitespace-normal break-words font-black leading-5">{product.name}</p>
                          <p className="mt-1 text-xs font-semibold text-slate-500">{product.category} - {product.quantity.toLocaleString()} available</p>
                          {product.quantity <= 0 && <p className="mt-1 text-xs font-black text-red-600 dark:text-red-300">Out of stock. Sale will still be recorded.</p>}
                          {product.quantity > 0 && product.quantity <= product.lowStockAt && <p className="mt-1 text-xs font-black text-amber-600 dark:text-amber-300">Low stock. Check restock soon.</p>}
                        </div>
                        <div className="flex items-center justify-between gap-3">
                          <Badge tone={product.quantity <= 0 ? "danger" : product.quantity <= product.lowStockAt ? "warning" : "success"}>{cartAmount(product.unitPrice)}</Badge>
                          <Button onClick={() => safely(() => addToCart(product.id), `${product.name} added to cart.`)}>
                            <Plus size={16} /> Add
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </Panel>

        <Panel title="2. Review Cart & 3. Proceed to Payment">
          {cartRows.length === 0 ? (
            <div className="rounded-lg border border-dashed border-slate-300 p-8 text-center dark:border-slate-700">
              <ShoppingCart className="mx-auto text-slate-400" size={38} />
              <p className="mt-3 font-black">Cart is empty</p>
              <p className="mt-1 text-sm font-semibold text-slate-500">Add products from the search list to start an order.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {cartRows.map((item) => (
                <div key={item.productId} className="grid gap-3 rounded-lg border border-slate-200 p-3 dark:border-slate-800 md:grid-cols-[1fr_auto_auto] md:items-center">
                  <div>
                    <p className="font-black">{item.product.name}</p>
                    <p className="text-xs font-semibold text-slate-500">{cartAmount(item.product.unitPrice)} each</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button className="size-8 bg-slate-900 p-0 dark:bg-slate-700" onClick={() => safely(() => updateCartItem(item.productId, item.quantity - 1))}><Minus size={14} /></Button>
                    <input
                      type="number"
                      min={1}
                      value={item.quantity}
                      onChange={(event) => safely(() => updateCartItem(item.productId, Number(event.target.value)))}
                      className="h-9 w-20 rounded-lg border border-slate-200 px-2 text-center text-sm font-black dark:border-slate-700 dark:bg-slate-950"
                    />
                    <Button className="size-8 bg-slate-900 p-0 dark:bg-slate-700" onClick={() => safely(() => updateCartItem(item.productId, item.quantity + 1))}><Plus size={14} /></Button>
                  </div>
                  <div className="flex items-center justify-between gap-3 md:justify-end">
                    {item.quantity > item.product.quantity && (
                      <Badge tone="warning">Insufficient stock</Badge>
                    )}
                    <span className="font-black">{cartAmount(item.subtotal)}</span>
                    <Button className="h-8 bg-red-600 px-3 hover:bg-red-700" onClick={() => safely(() => removeFromCart(item.productId))}>Remove</Button>
                  </div>
                </div>
              ))}

              <div className="rounded-lg bg-slate-50 p-4 dark:bg-slate-950">
                <label className="text-sm font-bold">Discount
                  <input type="number" min={0} max={subtotal} className="mt-1 h-10 w-full rounded-lg border border-slate-200 px-3 dark:border-slate-700 dark:bg-slate-900" value={discount} onChange={(event) => setDiscount(Number(event.target.value))} />
                </label>
                <div className="mt-4 space-y-2 text-sm">
                  <div className="flex justify-between"><span>Subtotal</span><strong>{cartAmount(subtotal)}</strong></div>
                  <div className="flex justify-between"><span>Discount</span><strong>{cartAmount(discount)}</strong></div>
                  <div className="flex justify-between text-lg"><span>Total</span><strong>{cartAmount(total)}</strong></div>
                </div>
              </div>

              {showPayment && (
                <div className="rounded-lg border border-brand-100 bg-brand-50/70 p-4 dark:border-brand-600/25 dark:bg-brand-600/10">
                  <label className="block text-sm font-bold">Payment Method
                    <select
                      className="mt-1 h-10 w-full rounded-lg border border-slate-200 px-3 dark:border-slate-700 dark:bg-slate-900"
                      value={paymentMethod}
                      onChange={(event) => {
                        setPaymentMethod(event.target.value);
                        setPaymentConfirmed(false);
                      }}
                    >
                      <option>Transfer</option>
                      <option>Cash</option>
                      <option>POS</option>
                      <option>Credit</option>
                    </select>
                  </label>
                  <div className="mt-3 rounded-lg bg-white p-3 text-sm font-semibold text-slate-600 shadow-sm dark:bg-slate-950 dark:text-slate-300">
                    {paymentMethod === "Cash"
                      ? "Cash selected. Confirm when the customer has handed over the cash."
                      : `${paymentMethod} selected. Confirm when the payment has been received.`}
                  </div>
                  <div className="mt-4 flex flex-wrap gap-2">
                    <Button onClick={confirmPayment}>
                      <CheckCircle2 size={16} /> {paymentMethod === "Cash" ? "Confirm Cash Payment" : `Confirm ${paymentMethod} Payment`}
                    </Button>
                    {paymentConfirmed && (
                      <Button className="bg-slate-900 dark:bg-slate-700" onClick={goToSales}>
                        <ReceiptText size={16} /> Go to Sales / Print Invoice
                      </Button>
                    )}
                  </div>
                </div>
              )}

              <div className="flex flex-wrap gap-2">
                <Button onClick={startPayment}><CreditCard size={16} /> Make Payment</Button>
                <Button className="bg-white text-slate-700 ring-1 ring-slate-200 hover:bg-slate-50 dark:bg-slate-900 dark:text-slate-100 dark:ring-slate-700" onClick={() => safely(clearCart, "Cart cleared.")}><X size={16} /> Clear Cart</Button>
              </div>
            </div>
          )}
        </Panel>
      </div>
    </AppShell>
  );
}
