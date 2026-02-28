"use client";

import { useState, useEffect } from "react";
import { FileText, MessageSquare, Users, Database, Activity, Clock } from "lucide-react";
import AdminLayout from "@/components/dashboard/AdminLayout";

interface Metrics {
    totalDocs: number;
    completedDocs: number;
    totalChunks: number;
    totalFacts: number;
    totalUsers: number;
    conversationsThisWeek: number;
    recentActivity: any[];
}

export default function InsightsPage() {
    const [metrics, setMetrics] = useState<Metrics | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        async function fetchMetrics() {
            try {
                const res = await fetch("/api/admin/insights");
                const data = await res.json();
                setMetrics(data);
            } catch (err) {
                console.error("Failed to fetch metrics:", err);
            } finally {
                setLoading(false);
            }
        }
        fetchMetrics();
    }, []);

    if (loading) {
        return (
            <AdminLayout>
                <div className="flex items-center justify-center h-64 text-muted">Loading insights...</div>
            </AdminLayout>
        );
    }

    return (
        <AdminLayout>
            <div className="space-y-8 animate-in fade-in duration-500">
                {/* Stats Grid */}
                <div className="grid grid-cols-2 md:grid-cols-3 gap-6">
                    <MetricCard
                        title="Knowledge Documents"
                        value={metrics?.completedDocs ?? 0}
                        sub={`${metrics?.totalDocs ?? 0} total`}
                        icon={<FileText className="w-5 h-5" />}
                        color="text-accent"
                    />
                    <MetricCard
                        title="Knowledge Chunks"
                        value={metrics?.totalChunks ?? 0}
                        sub="embedded vectors"
                        icon={<Database className="w-5 h-5" />}
                        color="text-purple-400"
                    />
                    <MetricCard
                        title="Business Facts"
                        value={metrics?.totalFacts ?? 0}
                        sub="structured knowledge"
                        icon={<Activity className="w-5 h-5" />}
                        color="text-blue-400"
                    />
                    <MetricCard
                        title="Team Members"
                        value={metrics?.totalUsers ?? 0}
                        sub="active users"
                        icon={<Users className="w-5 h-5" />}
                        color="text-green-400"
                    />
                    <MetricCard
                        title="AI Consultations"
                        value={metrics?.conversationsThisWeek ?? 0}
                        sub="this week"
                        icon={<MessageSquare className="w-5 h-5" />}
                        color="text-pink-400"
                    />
                </div>

                {/* Recent Activity */}
                <div className="border border-border/50 rounded-3xl bg-surface/10 overflow-hidden">
                    <div className="px-8 py-5 border-b border-border/50">
                        <h2 className="text-sm font-semibold uppercase tracking-widest text-muted">Recent Activity</h2>
                    </div>
                    <div className="divide-y divide-border/30">
                        {!metrics?.recentActivity?.length ? (
                            <p className="px-8 py-12 text-center text-muted">No recent activity.</p>
                        ) : (
                            metrics.recentActivity.map((log: any) => (
                                <div key={log.id} className="px-8 py-4 flex items-center justify-between hover:bg-accent/5 transition-colors">
                                    <div className="flex items-center gap-4">
                                        <div className="p-2 rounded-xl bg-surface/50 border border-border/50">
                                            <Activity className="w-4 h-4 text-accent/70" />
                                        </div>
                                        <div>
                                            <p className="text-sm font-medium">{formatAction(log.action)}</p>
                                            <p className="text-xs text-muted">{log.user_email}</p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-1.5 text-xs text-muted">
                                        <Clock className="w-3 h-3" />
                                        {new Date(log.created_at).toLocaleString()}
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>
            </div>
        </AdminLayout>
    );
}

function MetricCard({ title, value, sub, icon, color }: any) {
    return (
        <div className="p-6 rounded-3xl bg-surface/20 border border-border/50 space-y-3">
            <div className={`p-2.5 rounded-2xl bg-background/50 border border-border/50 w-fit ${color}`}>
                {icon}
            </div>
            <div>
                <p className={`text-3xl font-serif ${color}`}>{value.toLocaleString()}</p>
                <p className="text-xs font-bold uppercase tracking-widest text-muted mt-0.5">{title}</p>
                <p className="text-xs text-muted/70 mt-0.5">{sub}</p>
            </div>
        </div>
    );
}

function formatAction(action: string) {
    const map: Record<string, string> = {
        UPLOAD_DOC: "Document uploaded",
        DELETE_DOC: "Document deleted",
        ASK_QUESTION: "AI consultation",
    };
    return map[action] ?? action.replace(/_/g, " ").toLowerCase();
}
