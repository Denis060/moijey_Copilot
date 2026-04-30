"use client";

import { useState, useEffect } from "react";
import {
    FileText, MessageSquare, Users, Database, Activity, Clock,
    Package, Wand2, Mail, AlertTriangle, TrendingUp, TrendingDown,
    BookOpen, Trophy, Award,
} from "lucide-react";
import AdminLayout from "@/components/dashboard/AdminLayout";

interface Metrics {
    totalDocs: number;
    completedDocs: number;
    totalChunks: number;
    totalFacts: number;

    totalUsers: number;

    totalProducts: number;
    inStockProducts: number;
    embeddedProducts: number;

    totalRecommendations: number;
    sentRecommendations: number;

    conversationsThisWeek: number;
    conversationsLastWeek: number;
    consultationsDeltaPct: number | null;
    recsThisWeek: number;
    recsLastWeek: number;
    recsDeltaPct: number | null;

    lowConfidenceCount: number;
    totalAssistantMessages: number;
    lowConfidenceRatePct: number;

    topReps: { email: string; conversations: number; recommendations: number }[];
    topProducts: { product_id: string; title: string; image_url: string | null; shopify_url: string | null; times_recommended: number }[];

    recentActivity: ActivityRow[];
}

interface ActivityRow {
    id: string;
    action: string;
    resource_type: string | null;
    resource_id: string | null;
    details: any;
    created_at: string;
    user_email: string | null;
}

export default function InsightsPage() {
    const [metrics, setMetrics] = useState<Metrics | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetch("/api/admin/insights")
            .then(r => r.json())
            .then(data => setMetrics(data))
            .catch(err => console.error("Failed to fetch metrics:", err))
            .finally(() => setLoading(false));
    }, []);

    if (loading || !metrics) {
        return (
            <AdminLayout>
                <div className="flex items-center justify-center h-64 text-muted">Loading insights...</div>
            </AdminLayout>
        );
    }

    return (
        <AdminLayout>
            <div className="space-y-10 animate-in fade-in duration-500">
                {/* ── Activity (the headline numbers — what happened this week) ── */}
                <Section label="This Week">
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                        <TrendCard
                            title="AI Consultations"
                            value={metrics.conversationsThisWeek}
                            sub={`${metrics.conversationsLastWeek} last week`}
                            delta={metrics.consultationsDeltaPct}
                            icon={<MessageSquare className="w-5 h-5" />}
                            color="text-accent"
                        />
                        <TrendCard
                            title="Recommendations Generated"
                            value={metrics.recsThisWeek}
                            sub={`${metrics.recsLastWeek} last week`}
                            delta={metrics.recsDeltaPct}
                            icon={<Wand2 className="w-5 h-5" />}
                            color="text-pink-400"
                        />
                        <ConfidenceCard
                            count={metrics.lowConfidenceCount}
                            total={metrics.totalAssistantMessages}
                            ratePct={metrics.lowConfidenceRatePct}
                        />
                    </div>
                </Section>

                {/* ── Knowledge stack ── */}
                <Section label="Knowledge Stack">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-5">
                        <MetricCard title="Documents" value={metrics.completedDocs} sub={`${metrics.totalDocs} total`} icon={<FileText className="w-5 h-5" />} color="text-accent" />
                        <MetricCard title="Chunks" value={metrics.totalChunks} sub="embedded vectors" icon={<Database className="w-5 h-5" />} color="text-purple-400" />
                        <MetricCard title="Business Facts" value={metrics.totalFacts} sub="structured KB" icon={<Activity className="w-5 h-5" />} color="text-blue-400" />
                        <MetricCard title="Team Members" value={metrics.totalUsers} sub="active reps" icon={<Users className="w-5 h-5" />} color="text-green-400" />
                    </div>
                </Section>

                {/* ── Catalog + Recommendations ── */}
                <Section label="Catalog & Outreach">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-5">
                        <MetricCard
                            title="Products"
                            value={metrics.totalProducts}
                            sub={`${metrics.inStockProducts} in stock`}
                            icon={<Package className="w-5 h-5" />}
                            color="text-accent"
                        />
                        <MetricCard
                            title="Embedded"
                            value={metrics.embeddedProducts}
                            sub={metrics.totalProducts > 0
                                ? `${Math.round((metrics.embeddedProducts / metrics.totalProducts) * 100)}% of catalog`
                                : "ready for chat"}
                            icon={<Database className="w-5 h-5" />}
                            color="text-purple-400"
                        />
                        <MetricCard
                            title="Recommendations"
                            value={metrics.totalRecommendations}
                            sub="all-time"
                            icon={<Wand2 className="w-5 h-5" />}
                            color="text-pink-400"
                        />
                        <MetricCard
                            title="Emails Sent"
                            value={metrics.sentRecommendations}
                            sub={metrics.totalRecommendations > 0
                                ? `${Math.round((metrics.sentRecommendations / metrics.totalRecommendations) * 100)}% send rate`
                                : "no recommendations yet"}
                            icon={<Mail className="w-5 h-5" />}
                            color="text-green-400"
                        />
                    </div>
                </Section>

                {/* ── Leaderboards ── */}
                <Section label="This Week's Highlights">
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                        <Panel title="Top Reps" icon={<Trophy className="w-4 h-4" />}>
                            {metrics.topReps.length === 0 ? (
                                <EmptyRow>No team activity yet this week.</EmptyRow>
                            ) : (
                                <div className="divide-y divide-border/30">
                                    <div className="grid grid-cols-[1fr_auto_auto] gap-4 px-5 py-2 text-[10px] font-bold uppercase tracking-widest text-muted/70">
                                        <span>Rep</span>
                                        <span>Convos</span>
                                        <span>Recs</span>
                                    </div>
                                    {metrics.topReps.map((rep, i) => (
                                        <div key={rep.email} className="grid grid-cols-[1fr_auto_auto] gap-4 items-center px-5 py-3 hover:bg-accent/5">
                                            <div className="flex items-center gap-3 min-w-0">
                                                <RankBadge rank={i + 1} />
                                                <span className="text-xs truncate">{rep.email}</span>
                                            </div>
                                            <span className="text-sm font-semibold text-accent w-12 text-right">{rep.conversations}</span>
                                            <span className="text-sm font-semibold text-pink-400 w-12 text-right">{rep.recommendations}</span>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </Panel>

                        <Panel title="Most Recommended" icon={<Award className="w-4 h-4" />}>
                            {metrics.topProducts.length === 0 ? (
                                <EmptyRow>No recommendations sent this week.</EmptyRow>
                            ) : (
                                <div className="divide-y divide-border/30">
                                    {metrics.topProducts.map((p, i) => (
                                        <a
                                            key={p.product_id || i}
                                            href={p.shopify_url || "#"}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="flex items-center gap-3 px-5 py-3 hover:bg-accent/5 transition-colors"
                                        >
                                            <RankBadge rank={i + 1} />
                                            {p.image_url ? (
                                                // eslint-disable-next-line @next/next/no-img-element
                                                <img src={p.image_url} alt="" className="w-10 h-10 rounded-lg object-cover bg-surface/40 shrink-0" onError={e => { (e.target as HTMLImageElement).style.display = "none"; }} />
                                            ) : (
                                                <div className="w-10 h-10 rounded-lg bg-surface/40 flex items-center justify-center shrink-0">
                                                    <Package className="w-4 h-4 text-muted" />
                                                </div>
                                            )}
                                            <p className="text-xs flex-1 line-clamp-2 leading-snug">{p.title}</p>
                                            <span className="text-sm font-semibold text-accent shrink-0">{p.times_recommended}×</span>
                                        </a>
                                    ))}
                                </div>
                            )}
                        </Panel>
                    </div>
                </Section>

                {/* ── Recent Activity ── */}
                <Section label="Recent Activity">
                    <div className="border border-border/50 rounded-3xl bg-surface/10 overflow-hidden">
                        <div className="divide-y divide-border/30">
                            {!metrics.recentActivity?.length ? (
                                <EmptyRow>No recent activity.</EmptyRow>
                            ) : (
                                metrics.recentActivity.map(log => <ActivityItem key={log.id} log={log} />)
                            )}
                        </div>
                    </div>
                </Section>
            </div>
        </AdminLayout>
    );
}

// ── Reusable bits ──────────────────────────────────────────────────────────────

function Section({ label, children }: { label: string; children: React.ReactNode }) {
    return (
        <div className="space-y-3">
            <h2 className="text-[11px] font-bold uppercase tracking-widest text-muted/70">{label}</h2>
            {children}
        </div>
    );
}

function MetricCard({ title, value, sub, icon, color }: { title: string; value: number; sub: string; icon: React.ReactNode; color: string }) {
    return (
        <div className="p-5 rounded-3xl bg-surface/20 border border-border/50 space-y-3">
            <div className={`p-2 rounded-2xl bg-background/50 border border-border/50 w-fit ${color}`}>{icon}</div>
            <div>
                <p className={`text-2xl lg:text-3xl font-serif ${color}`}>{value.toLocaleString()}</p>
                <p className="text-[11px] font-bold uppercase tracking-widest text-muted mt-0.5">{title}</p>
                <p className="text-[11px] text-muted/70 mt-0.5">{sub}</p>
            </div>
        </div>
    );
}

function TrendCard({ title, value, sub, delta, icon, color }: { title: string; value: number; sub: string; delta: number | null; icon: React.ReactNode; color: string }) {
    return (
        <div className="p-5 rounded-3xl bg-surface/20 border border-border/50 space-y-3">
            <div className="flex items-start justify-between gap-3">
                <div className={`p-2 rounded-2xl bg-background/50 border border-border/50 ${color}`}>{icon}</div>
                <DeltaPill delta={delta} />
            </div>
            <div>
                <p className={`text-3xl lg:text-4xl font-serif ${color}`}>{value.toLocaleString()}</p>
                <p className="text-[11px] font-bold uppercase tracking-widest text-muted mt-1">{title}</p>
                <p className="text-[11px] text-muted/70 mt-0.5">{sub}</p>
            </div>
        </div>
    );
}

function ConfidenceCard({ count, total, ratePct }: { count: number; total: number; ratePct: number }) {
    // Higher rate = worse. Tint flips at thresholds so a glance tells you "are we OK?"
    const isHigh = ratePct >= 25;
    const isModerate = ratePct >= 10 && ratePct < 25;
    const color = isHigh ? "text-red-400" : isModerate ? "text-yellow-400" : "text-green-400";
    const label = isHigh ? "Investigate KB gaps" : isModerate ? "Watch trend" : "Healthy";

    return (
        <div className="p-5 rounded-3xl bg-surface/20 border border-border/50 space-y-3">
            <div className="flex items-start justify-between gap-3">
                <div className={`p-2 rounded-2xl bg-background/50 border border-border/50 ${color}`}>
                    <AlertTriangle className="w-5 h-5" />
                </div>
                <span className={`text-[10px] font-bold uppercase tracking-widest px-2.5 py-1 rounded-full border ${color} bg-current/10 border-current/30`}>
                    {label}
                </span>
            </div>
            <div>
                <p className={`text-3xl lg:text-4xl font-serif ${color}`}>{ratePct}%</p>
                <p className="text-[11px] font-bold uppercase tracking-widest text-muted mt-1">Low-Confidence Answers</p>
                <p className="text-[11px] text-muted/70 mt-0.5">{count} of {total} in last 30 days</p>
            </div>
        </div>
    );
}

function DeltaPill({ delta }: { delta: number | null }) {
    if (delta === null) return <span className="text-[10px] text-muted/50">—</span>;
    if (delta === 0) return <span className="text-[10px] text-muted/60 font-semibold">flat</span>;
    const positive = delta > 0;
    return (
        <span className={`inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-tighter px-2 py-0.5 rounded-full border ${
            positive
                ? "text-green-400 bg-green-500/10 border-green-500/30"
                : "text-red-400 bg-red-500/10 border-red-500/30"
        }`}>
            {positive ? <TrendingUp className="w-2.5 h-2.5" /> : <TrendingDown className="w-2.5 h-2.5" />}
            {positive ? "+" : ""}{delta}%
        </span>
    );
}

function Panel({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
    return (
        <div className="border border-border/50 rounded-3xl bg-surface/10 overflow-hidden">
            <div className="px-5 py-4 border-b border-border/40 flex items-center gap-2 text-accent">
                {icon}
                <h3 className="font-serif text-sm">{title}</h3>
            </div>
            {children}
        </div>
    );
}

function RankBadge({ rank }: { rank: number }) {
    const styles =
        rank === 1 ? "bg-accent/15 text-accent border-accent/40" :
        rank === 2 ? "bg-foreground/10 text-foreground/80 border-foreground/30" :
        rank === 3 ? "bg-yellow-500/10 text-yellow-400 border-yellow-500/30" :
        "bg-surface/40 text-muted border-border/40";
    return (
        <span className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-[10px] font-bold border ${styles} shrink-0`}>
            {rank}
        </span>
    );
}

function EmptyRow({ children }: { children: React.ReactNode }) {
    return <p className="px-6 py-10 text-center text-muted text-sm">{children}</p>;
}

function ActivityItem({ log }: { log: ActivityRow }) {
    const { label, detail, icon, color } = describeAction(log);
    return (
        <div className="px-6 py-4 flex items-center justify-between gap-4 hover:bg-accent/5 transition-colors">
            <div className="flex items-center gap-4 min-w-0">
                <div className={`p-2 rounded-xl bg-surface/50 border border-border/50 ${color}`}>{icon}</div>
                <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{label}</p>
                    <p className="text-xs text-muted truncate">
                        <span className="text-foreground/70">{log.user_email || "system"}</span>
                        {detail && <span className="text-muted/60"> · {detail}</span>}
                    </p>
                </div>
            </div>
            <div className="flex items-center gap-1.5 text-xs text-muted whitespace-nowrap shrink-0">
                <Clock className="w-3 h-3" />
                {relativeTime(log.created_at)}
            </div>
        </div>
    );
}

// ── Action label + detail extraction ───────────────────────────────────────────

interface ActionDescription {
    label: string;
    detail: string | null;
    icon: React.ReactNode;
    color: string;
}

function describeAction(log: ActivityRow): ActionDescription {
    const d = log.details || {};
    switch (log.action) {
        case "UPLOAD_DOC":
            return { label: "Document uploaded", detail: d.title || null, icon: <FileText className="w-4 h-4" />, color: "text-accent" };
        case "DELETE_DOC":
            return { label: "Document deleted", detail: d.title || null, icon: <FileText className="w-4 h-4" />, color: "text-red-400" };
        case "ASK_QUESTION":
            return { label: "AI consultation", detail: d.citations_count != null ? `${d.citations_count} citation${d.citations_count === 1 ? "" : "s"}` : null, icon: <MessageSquare className="w-4 h-4" />, color: "text-accent" };
        case "GENERATE_RECOMMENDATION":
            return { label: "Recommendation generated", detail: d.customer ? `for ${d.customer}` : null, icon: <Wand2 className="w-4 h-4" />, color: "text-pink-400" };
        case "IMPORT_PRODUCTS":
            return { label: "Product catalog imported", detail: d.inserted != null ? `${d.inserted} rows` : null, icon: <Package className="w-4 h-4" />, color: "text-accent" };
        case "DELETE_PRODUCT":
            return { label: "Product deleted", detail: d.product_id || null, icon: <Package className="w-4 h-4" />, color: "text-red-400" };
        case "DELETE_ALL_PRODUCTS":
            return { label: "Catalog wiped", detail: d.deleted != null ? `${d.deleted} products` : null, icon: <Package className="w-4 h-4" />, color: "text-red-400" };
        case "ARCHIVE_CONVERSATION":
            return { label: "Consultation archived", detail: d.title || null, icon: <BookOpen className="w-4 h-4" />, color: "text-muted" };
        case "UNARCHIVE_CONVERSATION":
            return { label: "Consultation restored", detail: d.title || null, icon: <BookOpen className="w-4 h-4" />, color: "text-accent" };
        case "CREATE_USER":
            return { label: "User created", detail: d.email ? `${d.email}${d.role ? ` · ${d.role}` : ""}` : null, icon: <Users className="w-4 h-4" />, color: "text-green-400" };
        case "DELETE_USER":
            return { label: "User deleted", detail: d.email || null, icon: <Users className="w-4 h-4" />, color: "text-red-400" };
        case "UPDATE_USER":
            return { label: "User updated", detail: d.email || null, icon: <Users className="w-4 h-4" />, color: "text-muted" };
        default:
            return {
                label: log.action.replace(/_/g, " ").toLowerCase().replace(/^./, c => c.toUpperCase()),
                detail: log.resource_id || null,
                icon: <Activity className="w-4 h-4" />,
                color: "text-accent/70",
            };
    }
}

function relativeTime(dateStr: string): string {
    const diffMin = Math.floor((Date.now() - new Date(dateStr).getTime()) / 60_000);
    if (diffMin < 1) return "just now";
    if (diffMin < 60) return `${diffMin}m ago`;
    const diffHr = Math.floor(diffMin / 60);
    if (diffHr < 24) return `${diffHr}h ago`;
    const diffDay = Math.floor(diffHr / 24);
    if (diffDay < 7) return `${diffDay}d ago`;
    return new Date(dateStr).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}
