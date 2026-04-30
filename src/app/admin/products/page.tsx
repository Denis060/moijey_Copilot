"use client";

import { useState, useEffect } from "react";
import { Package, Trash2, CheckCircle2, Clock, AlertCircle, Plus, Search, AlertTriangle } from "lucide-react";
import AdminLayout from "@/components/dashboard/AdminLayout";

interface Product {
    id: string;
    product_id: string;
    title: string;
    category: string | null;
    price: number | null;
    price_display: string | null;
    in_stock: boolean;
    diamond_shape: string | null;
    metal: string | null;
    style: string | null;
    image_url: string | null;
    shopify_url: string | null;
    updated_at: string;
}

interface ImportResult {
    inserted: number;
    failed: number;
    skipped_invalid: number;
    total_rows: number;
    errors?: string[];
}

export default function ProductsPage() {
    const [products, setProducts] = useState<Product[]>([]);
    const [stats, setStats] = useState({ total: 0, in_stock: 0, priced: 0 });
    const [loading, setLoading] = useState(true);
    const [uploading, setUploading] = useState(false);
    const [search, setSearch] = useState("");
    const [lastResult, setLastResult] = useState<ImportResult | null>(null);

    useEffect(() => { fetchProducts(); }, [search]);

    const fetchProducts = async () => {
        setLoading(true);
        try {
            const url = search ? `/api/admin/products?q=${encodeURIComponent(search)}` : "/api/admin/products";
            const res = await fetch(url);
            const data = await res.json();
            if (res.ok) {
                setProducts(data.products || []);
                setStats({ total: data.total || 0, in_stock: data.in_stock || 0, priced: data.priced || 0 });
            }
        } catch (err) {
            console.error("Failed to load products:", err);
        } finally {
            setLoading(false);
        }
    };

    const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        if (file.size > 4 * 1024 * 1024) {
            alert(`File too large (${(file.size / 1024 / 1024).toFixed(1)}MB). Max 4MB.`);
            e.target.value = "";
            return;
        }

        setUploading(true);
        setLastResult(null);

        const formData = new FormData();
        formData.append("file", file);

        try {
            const res = await fetch("/api/admin/products", { method: "POST", body: formData });
            let result: any;
            try { result = await res.json(); } catch { throw new Error(`Upload failed (status ${res.status})`); }
            if (!res.ok) throw new Error(result.error || "Import failed");

            setLastResult(result);
            fetchProducts();
        } catch (err: any) {
            alert(`Import failed: ${err.message}`);
        } finally {
            setUploading(false);
            e.target.value = "";
        }
    };

    const handleDelete = async (id: string, productId: string) => {
        if (!confirm(`Delete product "${productId}"? This cannot be undone.`)) return;
        try {
            const res = await fetch(`/api/admin/products/${id}`, { method: "DELETE" });
            if (!res.ok) {
                const data = await res.json();
                throw new Error(data.error || "Delete failed");
            }
            fetchProducts();
        } catch (err: any) {
            alert(`Failed to delete: ${err.message}`);
        }
    };

    const handleDeleteAll = async () => {
        if (!confirm(`Delete ALL ${stats.total} products? This cannot be undone.`)) return;
        if (!confirm("Are you absolutely sure? Type-confirmation is your only safety net here.")) return;
        try {
            const res = await fetch("/api/admin/products", { method: "DELETE" });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || "Delete failed");
            setLastResult(null);
            fetchProducts();
        } catch (err: any) {
            alert(`Failed to delete all: ${err.message}`);
        }
    };

    return (
        <AdminLayout>
            <div className="space-y-8 animate-in fade-in duration-500">
                {/* Actions Bar */}
                <div className="flex flex-col sm:flex-row gap-4 sm:items-center bg-surface/20 border border-border/50 p-4 sm:p-6 rounded-3xl backdrop-blur-sm">
                    <div className="relative flex-1 sm:max-w-sm">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted" />
                        <input
                            type="text"
                            placeholder="Search by title, ID, or category..."
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                            className="w-full bg-background border border-border/50 rounded-2xl py-3 pl-12 pr-4 focus:outline-none focus:border-accent/50 transition-all text-sm"
                        />
                    </div>
                    <label className={`cursor-pointer px-6 py-3 bg-accent text-background font-bold rounded-2xl hover:scale-105 active:scale-95 transition-all flex items-center justify-center gap-2 shrink-0 ${uploading ? "opacity-50 cursor-not-allowed" : ""}`}>
                        {uploading ? <Clock className="w-5 h-5 animate-spin" /> : <Plus className="w-5 h-5" />}
                        {uploading ? "Importing..." : "Upload CSV"}
                        <input type="file" accept=".csv,text/csv" className="hidden" onChange={handleUpload} disabled={uploading} />
                    </label>
                    {stats.total > 0 && (
                        <button
                            onClick={handleDeleteAll}
                            className="px-4 py-3 text-xs font-bold uppercase tracking-tighter text-red-400 hover:bg-red-500/10 border border-red-500/30 rounded-2xl transition-colors"
                        >
                            Delete All
                        </button>
                    )}
                </div>

                {/* Last import result */}
                {lastResult && (
                    <div className="rounded-2xl border border-green-500/30 bg-green-500/5 p-5">
                        <div className="flex items-start gap-3">
                            <CheckCircle2 className="w-5 h-5 text-green-400 mt-0.5 shrink-0" />
                            <div className="flex-1 text-sm">
                                <p className="font-semibold text-green-400 mb-1">Import complete</p>
                                <p className="text-muted">
                                    Inserted/updated: <span className="text-foreground font-semibold">{lastResult.inserted}</span> ·{" "}
                                    Failed: <span className="text-foreground font-semibold">{lastResult.failed}</span>
                                    {lastResult.skipped_invalid > 0 && <> · Skipped (missing required fields): <span className="text-foreground font-semibold">{lastResult.skipped_invalid}</span></>}{" "}
                                    out of {lastResult.total_rows} rows.
                                </p>
                                {lastResult.errors && lastResult.errors.length > 0 && (
                                    <details className="mt-2">
                                        <summary className="cursor-pointer text-xs text-yellow-400">Show first errors</summary>
                                        <ul className="mt-2 text-xs text-muted space-y-1 list-disc list-inside">
                                            {lastResult.errors.map((e, i) => <li key={i}>{e}</li>)}
                                        </ul>
                                    </details>
                                )}
                            </div>
                        </div>
                    </div>
                )}

                {/* CSV format hint */}
                {stats.total === 0 && !loading && (
                    <div className="rounded-2xl border border-yellow-500/30 bg-yellow-500/5 p-5 flex gap-3">
                        <AlertTriangle className="w-5 h-5 text-yellow-400 mt-0.5 shrink-0" />
                        <div className="text-sm text-muted">
                            <p className="text-foreground font-semibold mb-1">No products yet</p>
                            <p>Upload a CSV with headers matching your spreadsheet:</p>
                            <code className="block text-[11px] mt-2 px-3 py-2 rounded-lg bg-background/60 border border-border/40 text-foreground/80 break-all">
                                product_id, title, category, price, price_display, in_stock, shopify_product_id, shopify_url, image_url, diamond_shape, metal, style, description_short, tags, target_gender, notes_internal
                            </code>
                            <p className="mt-2 text-xs">Required: <code className="text-accent">product_id</code> and <code className="text-accent">title</code>. Other columns are optional.</p>
                        </div>
                    </div>
                )}

                {/* Stats */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <StatusCard title="Total Products" value={stats.total} icon={<Package />} color="text-accent" />
                    <StatusCard title="In Stock" value={stats.in_stock} icon={<CheckCircle2 />} color="text-green-400" />
                    <StatusCard title="With Price" value={stats.priced} icon={<AlertCircle />} color="text-blue-400" />
                </div>

                {/* Product table */}
                <div className="border border-border/50 rounded-3xl bg-surface/10 overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full min-w-[820px] text-left">
                            <thead className="bg-surface/30 border-b border-border/50">
                                <tr>
                                    <th className="px-6 py-5 text-xs font-semibold uppercase tracking-widest text-muted">Product</th>
                                    <th className="px-6 py-5 text-xs font-semibold uppercase tracking-widest text-muted">Category</th>
                                    <th className="px-6 py-5 text-xs font-semibold uppercase tracking-widest text-muted">Price</th>
                                    <th className="px-6 py-5 text-xs font-semibold uppercase tracking-widest text-muted">Shape / Metal</th>
                                    <th className="px-6 py-5 text-xs font-semibold uppercase tracking-widest text-muted">Stock</th>
                                    <th className="px-6 py-5 text-xs font-semibold uppercase tracking-widest text-muted text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-border/30">
                                {loading ? (
                                    <tr><td colSpan={6} className="px-8 py-12 text-center text-muted">Loading inventory...</td></tr>
                                ) : products.length === 0 ? (
                                    <tr><td colSpan={6} className="px-8 py-12 text-center text-muted">{search ? "No products match your search." : "No products yet. Upload a CSV to get started."}</td></tr>
                                ) : (
                                    products.map(p => (
                                        <tr key={p.id} className="hover:bg-accent/5 transition-colors group">
                                            <td className="px-6 py-4">
                                                <div className="flex items-center gap-3">
                                                    {p.image_url ? (
                                                        // eslint-disable-next-line @next/next/no-img-element
                                                        <img src={p.image_url} alt="" className="w-10 h-10 rounded-lg object-cover bg-surface/40" onError={e => { (e.target as HTMLImageElement).style.display = "none"; }} />
                                                    ) : (
                                                        <div className="w-10 h-10 rounded-lg bg-surface/40 flex items-center justify-center"><Package className="w-4 h-4 text-muted" /></div>
                                                    )}
                                                    <div className="min-w-0">
                                                        <p className="font-medium truncate max-w-[260px]">{p.title}</p>
                                                        <p className="text-[11px] text-muted">{p.product_id}</p>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 text-sm text-muted">{p.category || "—"}</td>
                                            <td className="px-6 py-4 text-sm">{p.price_display || (p.price ? `$${Number(p.price).toLocaleString()}` : <span className="text-muted">—</span>)}</td>
                                            <td className="px-6 py-4 text-sm text-muted">
                                                {[p.diamond_shape, p.metal].filter(Boolean).join(" · ") || "—"}
                                            </td>
                                            <td className="px-6 py-4">
                                                {p.in_stock ? (
                                                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-tighter border text-green-400 bg-green-400/10 border-green-400/20">
                                                        <CheckCircle2 className="w-3 h-3" />In Stock
                                                    </span>
                                                ) : (
                                                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-tighter border text-muted bg-muted/10 border-muted/20">
                                                        <AlertCircle className="w-3 h-3" />Out
                                                    </span>
                                                )}
                                            </td>
                                            <td className="px-6 py-4 text-right">
                                                <button
                                                    onClick={() => handleDelete(p.id, p.product_id)}
                                                    className="p-2 hover:bg-red-500/10 hover:text-red-400 rounded-xl transition-all"
                                                    title="Delete product"
                                                >
                                                    <Trash2 className="w-4 h-4" />
                                                </button>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                    {products.length > 0 && stats.total > products.length && (
                        <div className="px-6 py-3 text-xs text-muted text-center border-t border-border/30">
                            Showing first {products.length} of {stats.total}. Use search to narrow.
                        </div>
                    )}
                </div>
            </div>
        </AdminLayout>
    );
}

function StatusCard({ title, value, icon, color }: { title: string; value: number; icon: React.ReactNode; color: string }) {
    return (
        <div className="p-6 rounded-3xl bg-surface/20 border border-border/50 flex items-center justify-between">
            <div className="space-y-1">
                <p className="text-xs uppercase tracking-widest text-muted font-bold">{title}</p>
                <p className={`text-3xl font-serif ${color}`}>{value}</p>
            </div>
            <div className={`p-3 rounded-2xl bg-background/50 border border-border/50 ${color}`}>
                {icon}
            </div>
        </div>
    );
}
