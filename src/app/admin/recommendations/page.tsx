"use client";

import { useState, useEffect } from "react";
import {
    Wand2, Search, ChevronLeft, ChevronRight, ChevronDown, ChevronUp,
    Mail, FileText, User, CheckCircle2, Clock, Calendar, Package,
} from "lucide-react";
import AdminLayout from "@/components/dashboard/AdminLayout";

interface MatchedProduct {
    id: string;
    product_id?: string;
    title: string;
    price?: number | null;
    image_url?: string | null;
    shopify_url?: string | null;
    diamond_shape?: string | null;
    metal?: string | null;
    style?: string | null;
}

interface RecRow {
    id: string;
    customer_name: string;
    customer_email: string;
    product_type: string | null;
    budget_min: string | null;
    budget_max: string | null;
    diamond_shape: string | null;
    metal: string | null;
    style: string | null;
    timeline: string | null;
    notes: string | null;
    matched_products: MatchedProduct[];
    email_draft: string | null;
    email_sent: boolean;
    sent_at: string | null;
    created_at: string;
    rep_email: string | null;
}

interface Stats {
    total: number;
    sent: number;
    drafts: number;
    this_week: number;
}

const PAGE_SIZE = 10;

export default function RecommendationsPage() {
    const [rows, setRows] = useState<RecRow[]>([]);
    const [stats, setStats] = useState<Stats>({ total: 0, sent: 0, drafts: 0, this_week: 0 });
    const [filteredTotal, setFilteredTotal] = useState(0);
    const [loading, setLoading] = useState(true);
    const [page, setPage] = useState(1);
    const [expandedId, setExpandedId] = useState<string | null>(null);

    // Filters
    const [q, setQ] = useState("");
    const [rep, setRep] = useState("");
    const [sent, setSent] = useState<"" | "1" | "0">("");
    const [from, setFrom] = useState("");
    const [to, setTo] = useState("");

    // Reset to page 1 whenever a filter changes.
    useEffect(() => { setPage(1); }, [q, rep, sent, from, to]);

    useEffect(() => {
        const t = setTimeout(fetchRows, 200); // debounce search a touch
        return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [q, rep, sent, from, to, page]);

    async function fetchRows() {
        setLoading(true);
        try {
            const params = new URLSearchParams({
                limit: String(PAGE_SIZE),
                offset: String((page - 1) * PAGE_SIZE),
            });
            if (q) params.set("q", q);
            if (rep) params.set("rep", rep);
            if (sent) params.set("sent", sent);
            if (from) params.set("from", from);
            if (to) params.set("to", new Date(to + "T23:59:59").toISOString());
            const res = await fetch(`/api/admin/recommendations?${params}`);
            if (!res.ok) return;
            const data = await res.json();
            setRows(data.requests || []);
            setStats(data.stats || stats);
            setFilteredTotal(data.filtered_total ?? 0);
        } catch (err) {
            console.error("Failed to load recommendations:", err);
        } finally {
            setLoading(false);
        }
    }

    const totalPages = Math.max(1, Math.ceil(filteredTotal / PAGE_SIZE));
    const rangeStart = filteredTotal === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
    const rangeEnd = Math.min(page * PAGE_SIZE, filteredTotal);
    const hasFilter = !!(q || rep || sent || from || to);

    return (
        <AdminLayout>
            <div className="space-y-8 animate-in fade-in duration-500">
                {/* Stats */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 lg:gap-6">
                    <StatCard title="Total" value={stats.total} icon={<Wand2 />} color="text-accent" />
                    <StatCard title="Emails Sent" value={stats.sent} icon={<Mail />} color="text-green-400" />
                    <StatCard title="Drafts Only" value={stats.drafts} icon={<FileText />} color="text-yellow-400" />
                    <StatCard title="Last 7 Days" value={stats.this_week} icon={<Calendar />} color="text-blue-400" />
                </div>

                {/* Filters */}
                <div className="bg-surface/20 border border-border/50 rounded-3xl p-4 sm:p-5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
                    <div className="relative lg:col-span-2">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted/60" />
                        <input
                            type="text"
                            placeholder="Customer name or email..."
                            value={q}
                            onChange={e => setQ(e.target.value)}
                            className="w-full bg-background border border-border/50 rounded-xl py-2.5 pl-9 pr-3 text-sm focus:outline-none focus:border-accent/50"
                        />
                    </div>
                    <div className="relative">
                        <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted/60" />
                        <input
                            type="text"
                            placeholder="Rep email..."
                            value={rep}
                            onChange={e => setRep(e.target.value)}
                            className="w-full bg-background border border-border/50 rounded-xl py-2.5 pl-9 pr-3 text-sm focus:outline-none focus:border-accent/50"
                        />
                    </div>
                    <select
                        value={sent}
                        onChange={e => setSent(e.target.value as "" | "1" | "0")}
                        className="bg-background border border-border/50 rounded-xl py-2.5 px-3 text-sm focus:outline-none focus:border-accent/50"
                    >
                        <option value="">All</option>
                        <option value="1">Email sent</option>
                        <option value="0">Drafts only</option>
                    </select>
                    <div className="flex gap-2 col-span-1">
                        <input
                            type="date"
                            value={from}
                            onChange={e => setFrom(e.target.value)}
                            className="flex-1 bg-background border border-border/50 rounded-xl py-2.5 px-3 text-xs focus:outline-none focus:border-accent/50 text-muted"
                            title="From date"
                        />
                        <input
                            type="date"
                            value={to}
                            onChange={e => setTo(e.target.value)}
                            className="flex-1 bg-background border border-border/50 rounded-xl py-2.5 px-3 text-xs focus:outline-none focus:border-accent/50 text-muted"
                            title="To date"
                        />
                    </div>
                    {hasFilter && (
                        <button
                            onClick={() => { setQ(""); setRep(""); setSent(""); setFrom(""); setTo(""); }}
                            className="lg:col-span-5 sm:col-span-2 text-[11px] uppercase tracking-widest text-muted hover:text-accent text-left mt-1"
                        >
                            Clear filters
                        </button>
                    )}
                </div>

                {/* Table */}
                <div className="border border-border/50 rounded-3xl bg-surface/10 overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full min-w-[820px] text-left">
                            <thead className="bg-surface/30 border-b border-border/50">
                                <tr>
                                    <th className="px-5 py-4 text-xs font-semibold uppercase tracking-widest text-muted">Customer</th>
                                    <th className="px-5 py-4 text-xs font-semibold uppercase tracking-widest text-muted">Rep</th>
                                    <th className="px-5 py-4 text-xs font-semibold uppercase tracking-widest text-muted">Looking For</th>
                                    <th className="px-5 py-4 text-xs font-semibold uppercase tracking-widest text-muted">Budget</th>
                                    <th className="px-5 py-4 text-xs font-semibold uppercase tracking-widest text-muted">Matches</th>
                                    <th className="px-5 py-4 text-xs font-semibold uppercase tracking-widest text-muted">Status</th>
                                    <th className="px-5 py-4 text-xs font-semibold uppercase tracking-widest text-muted">Created</th>
                                    <th className="px-5 py-4" />
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-border/30">
                                {loading ? (
                                    <tr><td colSpan={8} className="px-8 py-12 text-center text-muted">Loading recommendations...</td></tr>
                                ) : rows.length === 0 ? (
                                    <tr><td colSpan={8} className="px-8 py-12 text-center text-muted">
                                        {hasFilter ? "No recommendations match these filters." : "No recommendations yet."}
                                    </td></tr>
                                ) : (
                                    rows.map(row => {
                                        const isOpen = expandedId === row.id;
                                        const budget = formatBudget(row.budget_min, row.budget_max);
                                        return (
                                            <>
                                                <tr key={row.id}
                                                    className={`hover:bg-accent/5 transition-colors cursor-pointer ${isOpen ? "bg-accent/5" : ""}`}
                                                    onClick={() => setExpandedId(prev => prev === row.id ? null : row.id)}
                                                >
                                                    <td className="px-5 py-4">
                                                        <div className="font-medium truncate max-w-[200px]">{row.customer_name}</div>
                                                        <div className="text-[11px] text-muted truncate max-w-[200px]">{row.customer_email}</div>
                                                    </td>
                                                    <td className="px-5 py-4 text-sm text-muted truncate max-w-[180px]">{row.rep_email || "—"}</td>
                                                    <td className="px-5 py-4 text-sm text-muted">{row.product_type || "—"}</td>
                                                    <td className="px-5 py-4 text-sm text-muted">{budget}</td>
                                                    <td className="px-5 py-4 text-sm">
                                                        <span className="inline-flex items-center gap-1.5 text-foreground">
                                                            <Package className="w-3.5 h-3.5 text-accent/70" />
                                                            {row.matched_products?.length ?? 0}
                                                        </span>
                                                    </td>
                                                    <td className="px-5 py-4">
                                                        <SentBadge sent={row.email_sent} />
                                                    </td>
                                                    <td className="px-5 py-4 text-xs text-muted whitespace-nowrap">
                                                        {new Date(row.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                                                    </td>
                                                    <td className="px-5 py-4 text-right">
                                                        {isOpen ? <ChevronUp className="w-4 h-4 text-muted" /> : <ChevronDown className="w-4 h-4 text-muted" />}
                                                    </td>
                                                </tr>
                                                {isOpen && (
                                                    <tr className="bg-surface/20">
                                                        <td colSpan={8} className="px-6 py-6">
                                                            <DetailPanel row={row} />
                                                        </td>
                                                    </tr>
                                                )}
                                            </>
                                        );
                                    })
                                )}
                            </tbody>
                        </table>
                    </div>

                    {filteredTotal > 0 && (
                        <div className="px-6 py-3 flex items-center justify-between border-t border-border/30 text-xs text-muted">
                            <span>
                                Showing <span className="text-foreground font-semibold">{rangeStart}-{rangeEnd}</span> of{" "}
                                <span className="text-foreground font-semibold">{filteredTotal}</span>
                                {hasFilter && <span className="ml-1">(filtered)</span>}
                            </span>
                            <div className="flex items-center gap-2">
                                <button
                                    onClick={() => setPage(p => Math.max(1, p - 1))}
                                    disabled={page <= 1 || loading}
                                    className="p-2 rounded-lg border border-border/40 hover:bg-accent/10 hover:text-accent disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                                    title="Previous page"
                                >
                                    <ChevronLeft className="w-4 h-4" />
                                </button>
                                <span className="px-2 font-semibold text-foreground">
                                    Page {page} / {totalPages}
                                </span>
                                <button
                                    onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                                    disabled={page >= totalPages || loading}
                                    className="p-2 rounded-lg border border-border/40 hover:bg-accent/10 hover:text-accent disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                                    title="Next page"
                                >
                                    <ChevronRight className="w-4 h-4" />
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </AdminLayout>
    );
}

function StatCard({ title, value, icon, color }: { title: string; value: number; icon: React.ReactNode; color: string }) {
    return (
        <div className="p-5 lg:p-6 rounded-3xl bg-surface/20 border border-border/50 flex items-center justify-between">
            <div className="space-y-1">
                <p className="text-[10px] uppercase tracking-widest text-muted font-bold">{title}</p>
                <p className={`text-2xl lg:text-3xl font-serif ${color}`}>{value}</p>
            </div>
            <div className={`p-3 rounded-2xl bg-background/50 border border-border/50 ${color}`}>
                <div className="w-5 h-5">{icon}</div>
            </div>
        </div>
    );
}

function SentBadge({ sent }: { sent: boolean }) {
    return sent ? (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-tighter border text-green-400 bg-green-400/10 border-green-400/20">
            <CheckCircle2 className="w-3 h-3" /> Sent
        </span>
    ) : (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-tighter border text-muted bg-muted/10 border-muted/20">
            <Clock className="w-3 h-3" /> Draft
        </span>
    );
}

function DetailPanel({ row }: { row: RecRow }) {
    const products = Array.isArray(row.matched_products) ? row.matched_products : [];
    return (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Left: customer + criteria */}
            <div className="space-y-4">
                <Section title="Customer Brief">
                    <Field label="Looking for" value={row.product_type} />
                    <Field label="Budget" value={formatBudget(row.budget_min, row.budget_max)} />
                    <Field label="Diamond shape" value={row.diamond_shape} />
                    <Field label="Metal" value={row.metal} />
                    <Field label="Style" value={row.style} />
                    <Field label="Timeline" value={row.timeline} />
                </Section>
                {row.notes && (
                    <Section title="Rep Notes">
                        <p className="text-sm text-foreground/80 whitespace-pre-wrap">{row.notes}</p>
                    </Section>
                )}
                {row.sent_at && (
                    <Section title="Send Status">
                        <p className="text-xs text-muted">
                            Sent {new Date(row.sent_at).toLocaleString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" })}
                        </p>
                    </Section>
                )}
            </div>

            {/* Middle: matched products */}
            <div className="space-y-3 lg:col-span-1">
                <p className="text-[10px] uppercase tracking-widest text-muted font-bold">Matched Products</p>
                {products.length === 0 ? (
                    <p className="text-sm text-muted italic">No products matched at the time.</p>
                ) : (
                    <div className="space-y-2">
                        {products.map((p, i) => (
                            <a
                                key={p.id || i}
                                href={p.shopify_url || "#"}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex gap-3 p-2.5 rounded-2xl border border-border/50 bg-surface/20 hover:border-accent/40 hover:bg-accent/5 transition-colors"
                            >
                                {p.image_url ? (
                                    // eslint-disable-next-line @next/next/no-img-element
                                    <img
                                        src={p.image_url}
                                        alt=""
                                        className="w-12 h-12 rounded-xl object-cover bg-surface/40 shrink-0"
                                        onError={e => { (e.target as HTMLImageElement).style.display = "none"; }}
                                    />
                                ) : (
                                    <div className="w-12 h-12 rounded-xl bg-surface/40 flex items-center justify-center shrink-0">
                                        <Package className="w-4 h-4 text-muted" />
                                    </div>
                                )}
                                <div className="min-w-0 flex-1">
                                    <p className="text-xs font-medium line-clamp-2">{p.title}</p>
                                    {p.price !== null && p.price !== undefined && (
                                        <p className="text-[11px] text-accent font-semibold mt-0.5">${Number(p.price).toLocaleString()}</p>
                                    )}
                                    <p className="text-[10px] text-muted truncate mt-0.5">
                                        {[p.diamond_shape, p.metal, p.style].filter(Boolean).join(" · ") || "—"}
                                    </p>
                                </div>
                            </a>
                        ))}
                    </div>
                )}
            </div>

            {/* Right: email draft */}
            <div className="space-y-3">
                <p className="text-[10px] uppercase tracking-widest text-muted font-bold">Email Draft</p>
                <div className="rounded-2xl border border-border/50 bg-background/40 p-4 max-h-96 overflow-y-auto">
                    <pre className="text-[12px] text-foreground/85 whitespace-pre-wrap font-sans leading-relaxed">{row.email_draft || "No draft on file."}</pre>
                </div>
            </div>
        </div>
    );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
    return (
        <div className="space-y-2">
            <p className="text-[10px] uppercase tracking-widest text-muted font-bold">{title}</p>
            <div className="space-y-1">{children}</div>
        </div>
    );
}

function Field({ label, value }: { label: string; value: string | null | undefined }) {
    if (!value) return null;
    return (
        <div className="flex justify-between gap-3 text-xs">
            <span className="text-muted">{label}</span>
            <span className="text-foreground/85 text-right">{value}</span>
        </div>
    );
}

function formatBudget(min: string | null, max: string | null): string {
    const m = min ? `$${Number(min).toLocaleString()}` : "";
    const x = max ? `$${Number(max).toLocaleString()}` : "";
    if (m && x) return `${m} – ${x}`;
    if (m) return `${m}+`;
    if (x) return `up to ${x}`;
    return "—";
}
