"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { AppShell } from "@/components/app-shell";
import { Badge, Button, DataTable, PageHeader, Panel, StatCard } from "@/components/ui";
import { Notice, type NoticeState } from "@/components/notice";
import { ProductQr } from "@/components/product-qr";
import {
  addToCart,
  backupLocalBusinessDataToBackend,
  getLastBackendSyncError,
  deleteCategory,
  resetInventory,
  saveCategory,
  saveProduct,
  type ProductInput
} from "@/lib/business-store";
import { useBusinessData } from "@/lib/use-business-data";
import { downloadCsv, money, shortDate } from "@/lib/utils";
import { Download, Edit3, Eye, PackageSearch, Plus, Search, ShoppingCart, X } from "lucide-react";
import type { Product } from "@/lib/data";

function priceDisplay(value: number) {
  return value > 0 ? money(value) : "Not set";
}

function quantityDisplay(value: number) {
  return value > 0 ? value.toLocaleString() : "";
}

function emptyProduct(category = ""): ProductInput {
  return {
    serialCode: "",
    name: "",
    description: "",
    category,
    quantity: 0,
    unitPrice: 0,
    costPrice: 0,
    supplier: "",
    lowStockAt: 20
  };
}

export default function InventoryPage() {
  const { products, categories } = useBusinessData();
  const [query, setQuery] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [lastCategory, setLastCategory] = useState("");
  const [form, setForm] = useState<ProductInput>(() => emptyProduct(lastCategory || categories[0] || ""));
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [notice, setNotice] = useState<NoticeState>(null);
  const [toast, setToast] = useState("");
  const [savingProduct, setSavingProduct] = useState(false);
  const [categoryName, setCategoryName] = useState("");
  const [editingCategory, setEditingCategory] = useState("");
  const formRef = useRef<HTMLDivElement | null>(null);

  const filteredProducts = useMemo(() => {
    const value = query.trim().toLowerCase();
    const source = value ? products.filter((product) =>
      [product.name, product.serialCode, product.category]
        .some((field) => field.toLowerCase().includes(value))
    ) : products;
    return [...source].sort((a, b) => {
      const sellingPriceRank = Number(a.unitPrice <= 0) - Number(b.unitPrice <= 0);
      if (sellingPriceRank) return sellingPriceRank;
      const barcodeRank = Number(!a.serialCode) - Number(!b.serialCode);
      if (barcodeRank) return barcodeRank;
      return a.category.localeCompare(b.category) || a.name.localeCompare(b.name);
    });
  }, [products, query]);

  const pricedProducts = useMemo(() => products.filter((product) => product.unitPrice > 0), [products]);
  const lowStock = useMemo(() => products.filter((product) => product.quantity <= product.lowStockAt), [products]);
  const inventoryExportRows = useMemo(() => products.map((product) => ({
    barcode: product.serialCode,
    name: product.name,
    category: product.category,
    quantity: product.quantity,
    sellingPrice: product.unitPrice,
    dateAdded: product.dateAdded,
    lowStockAt: product.lowStockAt,
    status: product.quantity <= product.lowStockAt ? "Low stock" : "In stock"
  })), [products]);
  const suggestions = query ? filteredProducts.slice(0, 5) : [];
  const productRows = useMemo(() => filteredProducts.map((product, index) => [
    index + 1,
    <button key={`${product.id}-name`} type="button" onClick={() => startEditProduct(product)} className="whitespace-normal break-words text-left font-black text-brand-700 hover:underline dark:text-brand-100">{product.name}</button>,
    product.category,
    quantityDisplay(product.quantity),
    priceDisplay(product.unitPrice),
    shortDate(product.dateAdded),
    <div key={`${product.id}-status`} className="flex min-w-[96px] justify-center">
      <Badge tone={product.quantity <= product.lowStockAt ? "danger" : "success"}>
        {product.quantity <= product.lowStockAt ? "Low stock" : "In stock"}
      </Badge>
    </div>,
    <div key={`${product.id}-actions`} className="inline-flex overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-900">
      <button
        type="button"
        onClick={() => startEditProduct(product)}
        className="inline-flex h-9 items-center gap-1.5 border-r border-slate-200 px-3 text-xs font-black text-brand-700 transition hover:bg-brand-50 dark:border-slate-700 dark:text-brand-100 dark:hover:bg-slate-800"
      >
        <Edit3 size={14} /> Edit
      </button>
      <button
        type="button"
        onClick={() => {
          try {
            addToCart(product.id);
            setNotice({ type: "success", message: `${product.name} added to cart.` });
          } catch (error) {
            setNotice({ type: "error", message: error instanceof Error ? error.message : "Unable to add to cart." });
          }
        }}
        className="inline-flex h-9 items-center gap-1.5 border-r border-slate-200 px-3 text-xs font-black text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:text-slate-100 dark:hover:bg-slate-800"
      >
        <ShoppingCart size={14} /> Cart
      </button>
      <button
        type="button"
        onClick={() => setSelectedProduct(product)}
        className="inline-flex h-9 items-center gap-1.5 px-3 text-xs font-black text-slate-500 transition hover:bg-slate-50 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white"
      >
        <PackageSearch size={14} /> Details
      </button>
    </div>
  ]), [filteredProducts]);

  useEffect(() => {
    const productId = new URLSearchParams(window.location.search).get("product");
    const product = productId ? products.find((item) => item.id === productId || item.serialCode === productId) : undefined;
    if (product) startEditProduct(product);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [products]);

  const rememberCategory = (category: string) => {
    if (!category) return;
    setLastCategory(category);
  };

  const updateForm = (key: keyof ProductInput, value: string | number) => {
    if (key === "category" && typeof value === "string") rememberCategory(value);
    setForm((current) => ({ ...current, [key]: value }));
  };

  const startAddProduct = () => {
    setForm(emptyProduct(lastCategory || categories[0] || ""));
    setShowForm(true);
    window.setTimeout(() => formRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 50);
  };

  function startEditProduct(product: Product) {
    rememberCategory(product.category);
    setForm(product);
    setShowForm(true);
    setSelectedProduct(null);
    window.setTimeout(() => formRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 50);
  }

  const playProductAddedSound = () => {
    try {
      const AudioContextClass = window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AudioContextClass) return;
      const audio = new AudioContextClass();
      const oscillator = audio.createOscillator();
      const gain = audio.createGain();
      oscillator.type = "sine";
      oscillator.frequency.setValueAtTime(760, audio.currentTime);
      oscillator.frequency.exponentialRampToValueAtTime(1080, audio.currentTime + 0.1);
      gain.gain.setValueAtTime(0.001, audio.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.18, audio.currentTime + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, audio.currentTime + 0.18);
      oscillator.connect(gain);
      gain.connect(audio.destination);
      oscillator.start();
      oscillator.stop(audio.currentTime + 0.2);
      window.setTimeout(() => audio.close(), 260);
    } catch {
      // Sound is optional; browsers may block audio in some cases.
    }
  };

  const showProductAddedToast = (message = "Product added") => {
    setToast(message);
    playProductAddedSound();
    window.setTimeout(() => setToast(""), 2600);
  };

  const handleSaveProduct = async () => {
    if (savingProduct) return;
    setSavingProduct(true);
    try {
      const product = saveProduct({ ...form, costPrice: 0 });
      const isNewProduct = !form.id;
      const synced = await backupLocalBusinessDataToBackend();
      rememberCategory(product.category);
      if (!synced) {
        const reason = getLastBackendSyncError();
        setNotice({ type: "error", message: `${product.name} was saved locally, but it did not reach the backend. ${reason || "Check login, API URL, Render status, and CORS settings."}` });
        return;
      }
      setNotice({ type: "success", message: `${product.name} was saved to the backend.` });
      showProductAddedToast(isNewProduct ? "Product added" : "Product updated");
      setForm(emptyProduct(product.category));
      setShowForm(false);
      setSelectedProduct(null);
    } catch (error) {
      setNotice({ type: "error", message: error instanceof Error ? error.message : "Unable to save product." });
    } finally {
      setSavingProduct(false);
    }
  };

  const handleSaveCategory = () => {
    try {
      const saved = saveCategory(categoryName, editingCategory || undefined);
      setNotice({ type: "success", message: `${saved} category saved.` });
      setCategoryName("");
      setEditingCategory("");
      rememberCategory(saved);
      setForm((current) => ({ ...current, category: saved }));
    } catch (error) {
      setNotice({ type: "error", message: error instanceof Error ? error.message : "Unable to save category." });
    }
  };

  const handleResetInventory = () => {
    if (!window.confirm("Reset inventory and clear all products, categories, stock, prices, and cart items?")) return;
    resetInventory();
    setSelectedProduct(null);
    setShowForm(false);
    setNotice({ type: "success", message: "Inventory was reset to a fresh state." });
  };

  return (
    <AppShell>
      {toast && (
        <div className="fixed bottom-5 left-5 z-[70] flex items-center gap-3 rounded-lg border border-emerald-200 bg-white px-4 py-3 text-sm font-black text-emerald-800 shadow-2xl shadow-emerald-900/15 dark:border-emerald-900 dark:bg-slate-900 dark:text-emerald-200">
          <span className="grid size-8 place-items-center rounded-lg bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-200">
            <Plus size={16} />
          </span>
          {toast}
        </div>
      )}
      <PageHeader
        title="Inventory Management"
        description="Manage products, categories, stock movement, prices, barcode entry, and cart-ready inventory."
      />
      <Notice notice={notice} />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Products" value={String(products.length)} />
        <StatCard label="Priced Products" value={String(pricedProducts.length)} />
        <StatCard label="Categories" value={String(categories.length)} />
        <StatCard label="Low Stock Items" value={String(lowStock.length)} tone="danger" />
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-[0.8fr_1.2fr]">
        <Panel title="Category Management">
          <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
            <input
              value={categoryName}
              onChange={(event) => setCategoryName(event.target.value)}
              className="h-10 rounded-lg border border-slate-200 px-3 text-sm font-semibold dark:border-slate-700 dark:bg-slate-950"
              placeholder="Create or rename category"
            />
            <Button onClick={handleSaveCategory}><Plus size={16} /> {editingCategory ? "Save" : "Add"} Category</Button>
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            {categories.length === 0 ? (
              <p className="text-sm font-semibold text-slate-500">No categories yet. Create one before adding products.</p>
            ) : categories.map((category) => (
              <span key={category} className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-3 py-1.5 text-xs font-black text-slate-700 ring-1 ring-slate-200 dark:bg-slate-800 dark:text-slate-100 dark:ring-slate-700">
                {category}
                <button type="button" onClick={() => { setEditingCategory(category); setCategoryName(category); }} aria-label={`Edit ${category}`}><Edit3 size={13} /></button>
                <button type="button" onClick={() => {
                  try {
                    deleteCategory(category);
                    setNotice({ type: "success", message: `${category} category deleted.` });
                  } catch (error) {
                    setNotice({ type: "error", message: error instanceof Error ? error.message : "Unable to delete category." });
                  }
                }} aria-label={`Delete ${category}`}><X size={13} /></button>
              </span>
            ))}
          </div>
        </Panel>

        <Panel title="Inventory Controls">
          <div className="flex flex-wrap gap-2">
            <Button onClick={startAddProduct}><Plus size={16} /> Add Product</Button>
            <Button className="bg-white text-slate-700 ring-1 ring-slate-200 hover:bg-slate-50 dark:bg-slate-900 dark:text-slate-100 dark:ring-slate-700" onClick={() => downloadCsv("inventory.csv", inventoryExportRows)}>
              <Download size={16} /> Export CSV
            </Button>
            <Button className="bg-red-600 hover:bg-red-700" onClick={handleResetInventory}>Reset Inventory</Button>
          </div>
          <p className="mt-3 text-sm font-semibold text-slate-500">
            Inventory has been reset to a fresh state for new product entry. Add categories, then add products from scratch.
          </p>
        </Panel>
      </div>

      <Panel title="Products" className="mt-6">
        <div className="mb-4">
          <div className="relative">
            <Search className="absolute left-3 top-3 text-slate-400" size={18} />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              className="h-11 w-full rounded-lg border border-slate-200 bg-slate-50 pl-10 pr-3 text-sm font-semibold dark:border-slate-700 dark:bg-slate-950"
              placeholder="Search products by name, barcode, or category"
            />
            {suggestions.length > 0 && (
              <div className="absolute left-0 right-0 top-12 z-20 overflow-hidden rounded-lg border border-slate-200 bg-white shadow-xl dark:border-slate-800 dark:bg-slate-900">
                {suggestions.map((product) => (
                  <button
                    key={product.id}
                    type="button"
                    onClick={() => {
                      startEditProduct(product);
                      setQuery(product.name);
                    }}
                    className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left text-sm transition hover:bg-brand-50 dark:hover:bg-slate-800"
                  >
                    <span>
                      <span className="block font-black">{product.name}</span>
                      <span className="text-xs font-semibold text-slate-500">{product.serialCode || product.category}</span>
                    </span>
                    <Eye size={16} className="text-slate-400" />
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {showForm && (
          <div ref={formRef} className="mb-5 scroll-mt-24 rounded-lg border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="font-black">{form.id ? "Edit Product" : "Add Product"}</h3>
              <Button className="size-9 bg-white p-0 text-slate-600 ring-1 ring-slate-200 hover:bg-slate-100 dark:bg-slate-900 dark:ring-slate-700" onClick={() => setShowForm(false)} aria-label="Close product form">
                <X size={16} />
              </Button>
            </div>
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              <label className="text-sm font-bold">Product Name<input className="mt-1 h-10 w-full rounded-lg border border-slate-200 px-3 dark:border-slate-700 dark:bg-slate-900" value={form.name} onChange={(event) => updateForm("name", event.target.value)} /></label>
              <label className="text-sm font-bold">Barcode<input className="mt-1 h-10 w-full rounded-lg border border-slate-200 px-3 dark:border-slate-700 dark:bg-slate-900" value={form.serialCode} onChange={(event) => updateForm("serialCode", event.target.value.toUpperCase())} placeholder="Scan or type barcode" /></label>
              <label className="text-sm font-bold">Category<select className="mt-1 h-10 w-full rounded-lg border border-slate-200 px-3 dark:border-slate-700 dark:bg-slate-900" value={form.category} onChange={(event) => updateForm("category", event.target.value)}><option value="">Select category</option>{categories.map((category) => <option key={category}>{category}</option>)}</select></label>
              <label className="text-sm font-bold">Quantity<input type="number" min={0} className="mt-1 h-10 w-full rounded-lg border border-slate-200 px-3 dark:border-slate-700 dark:bg-slate-900" value={form.quantity === 0 ? "" : form.quantity} onChange={(event) => updateForm("quantity", event.target.value === "" ? 0 : Number(event.target.value))} /></label>
              <label className="text-sm font-bold">Selling Price<input type="number" min={0} placeholder="Enter selling price" className="mt-1 h-10 w-full rounded-lg border border-slate-200 px-3 dark:border-slate-700 dark:bg-slate-900" value={form.unitPrice === 0 ? "" : form.unitPrice} onChange={(event) => updateForm("unitPrice", event.target.value === "" ? 0 : Number(event.target.value))} /></label>
              <label className="text-sm font-bold">Low Stock Level<input type="number" min={0} className="mt-1 h-10 w-full rounded-lg border border-slate-200 px-3 dark:border-slate-700 dark:bg-slate-900" value={form.lowStockAt} onChange={(event) => updateForm("lowStockAt", Number(event.target.value))} /></label>
              <label className="text-sm font-bold md:col-span-2 xl:col-span-4">Description<textarea className="mt-1 min-h-20 w-full rounded-lg border border-slate-200 p-3 dark:border-slate-700 dark:bg-slate-900" value={form.description ?? ""} onChange={(event) => updateForm("description", event.target.value)} /></label>
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              <Button onClick={handleSaveProduct} disabled={savingProduct}><Plus size={16} /> {savingProduct ? "Saving..." : "Save Product"}</Button>
            </div>
          </div>
        )}

        {filteredProducts.length === 0 ? (
          <div className="rounded-lg border border-dashed border-slate-300 p-8 text-center dark:border-slate-700">
            <p className="font-black">No products in inventory</p>
            <p className="mt-1 text-sm font-semibold text-slate-500">Create a category, then add your first product.</p>
            <Button className="mt-4" onClick={startAddProduct}><Plus size={16} /> Add Product</Button>
          </div>
        ) : (
        <DataTable
            headers={["S/N", "Product Name", "Category", "Quantity", "Selling Price", "Date", "Status", "Actions"]}
            rows={productRows}
          />
        )}
      </Panel>

      {selectedProduct && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/55 p-4 backdrop-blur-sm">
          <section className="max-h-[92vh] w-full max-w-5xl overflow-y-auto rounded-lg border border-slate-200 bg-white p-5 shadow-2xl dark:border-slate-800 dark:bg-slate-900">
            <div className="mb-5 flex items-start justify-between gap-3">
              <div>
                <h2 className="text-2xl font-black">{selectedProduct.name}</h2>
                {selectedProduct.serialCode && <p className="mt-1 text-sm font-bold text-slate-500">{selectedProduct.serialCode}</p>}
              </div>
              <Button className="size-10 bg-white p-0 text-slate-600 ring-1 ring-slate-200 hover:bg-slate-100 dark:bg-slate-900 dark:ring-slate-700" onClick={() => setSelectedProduct(null)} aria-label="Close product details">
                <X size={18} />
              </Button>
            </div>
            <div className="grid gap-5 lg:grid-cols-[220px_1fr]">
              <div>
                {selectedProduct.serialCode ? <ProductQr barcode={selectedProduct.serialCode} /> : (
                  <div className="grid min-h-44 place-items-center rounded-lg border border-dashed border-slate-300 p-4 text-center text-sm font-bold text-slate-500 dark:border-slate-700">
                    No barcode added yet
                  </div>
                )}
                <div className="mt-3 flex flex-wrap gap-2">
                  <Button className="h-9" onClick={() => startEditProduct(selectedProduct)}><Edit3 size={15} /> Edit</Button>
                  <Button className="h-9 bg-brand-600" onClick={() => {
                    try {
                      addToCart(selectedProduct.id);
                      setNotice({ type: "success", message: `${selectedProduct.name} added to cart.` });
                    } catch (error) {
                      setNotice({ type: "error", message: error instanceof Error ? error.message : "Unable to add to cart." });
                    }
                  }}><ShoppingCart size={15} /> Cart</Button>
                </div>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                {[
                  ["Quantity Available", quantityDisplay(selectedProduct.quantity)],
                  ["Selling Price", priceDisplay(selectedProduct.unitPrice)],
                  ["Product Category", selectedProduct.category],
                  ["Date Added", shortDate(selectedProduct.dateAdded)],
                  ["Low Stock Level", selectedProduct.lowStockAt.toLocaleString()]
                ].map(([label, value]) => (
                  <div key={label} className="rounded-lg border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950">
                    <p className="text-xs font-black uppercase text-slate-500">{label}</p>
                    <p className="mt-2 font-black">{value}</p>
                  </div>
                ))}
                <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950 sm:col-span-2">
                  <p className="text-xs font-black uppercase text-slate-500">Description</p>
                  <p className="mt-2 font-semibold">{selectedProduct.description || "No description provided."}</p>
                </div>
              </div>
            </div>
            <div className="mt-5 rounded-lg border border-slate-200 dark:border-slate-800">
              <div className="border-b border-slate-200 bg-slate-50 px-4 py-3 font-black dark:border-slate-800 dark:bg-slate-950">Last Transaction History</div>
              <div className="divide-y divide-slate-100 dark:divide-slate-800">
                {selectedProduct.transactionHistory.length === 0 ? (
                  <div className="px-4 py-3 text-sm font-semibold text-slate-500">No transactions yet.</div>
                ) : selectedProduct.transactionHistory.map((transaction) => (
                  <div key={transaction.id} className="grid gap-2 px-4 py-3 text-sm sm:grid-cols-[130px_90px_1fr_120px]">
                    <span className="font-black">{transaction.type}</span>
                    <span>{transaction.quantity.toLocaleString()}</span>
                    <span className="text-slate-600 dark:text-slate-300">{transaction.note}</span>
                    <span>{shortDate(transaction.date)}</span>
                  </div>
                ))}
              </div>
            </div>
          </section>
        </div>
      )}
    </AppShell>
  );
}
