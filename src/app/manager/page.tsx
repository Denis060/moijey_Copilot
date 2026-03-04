"use client";

import { useEffect, useState } from "react";
import ManagerLayout from "@/components/dashboard/ManagerLayout";
import { MessageSquare, Users, TrendingUp, Activity } from "lucide-react";

interface Stats {
    totalConsultationsToday: number;
    totalConsultationsWeek: number;
    activeRepsToday: number;
    totalUsers: number;
    repActivity: { email: string; conversations_today: number; conversations_week: number }[];
    recentQuestions: { content: string; created_at: string; rep_email: string }[];
}

function relativeTime(dateStr: string): string {
    const diffMin = Math.floor((Date.now() - new Date(dateStr).getTime()) / 60_000);
    if (diffMin < 1) return "just now";
    if (diffMin < 60) return `${diffMin}m ago`;
    const diffHr = Math.floor(diffMin / 60);
    if (diffHr < 24) return `${diffHr}h ago`;
    return `${Math.floor(diffHr / 24)}d ago`;
}

export default function ManagerPage() {
    const [stats, setStats] = useState<Stats | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetch("/api/manager/stats")
            .then(r => r.json())
            .then(data => { setStats(data); setLoading(false); })
            .catch(() => setLoading(false));
    }, []);

    const statCards = stats ? [
        { label: "Consultations Today", value: stats.totalConsultationsToday, icon: MessageSquare, color: "text-accent" },
        { label: "Consultations This Week", value: stats.totalConsultationsWeek, icon: TrendingUp, color: "text-accent" },
        { label: "Active Reps Today", value: stats.activeRepsToday, icon: Activity, color: "text-green-400" },
        { label: "Team Members", value: stats.totalUsers, icon: Users, color: "text-muted" },
    ] : [];

    return (
        <ManagerLayout>
            <div className="max-w-6xl space-y-8">

                {/* Stat cards */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                    {loading
                        ? Array.from({ length: 4 }).map((_, i) => (
                            <div key={i} className="h-28 rounded-2xl bg-surface/20 animate-pulse border border-border/30" />
                        ))
                        : statCards.map(card => (
                            <div key={card.label} className="bg-surface/10 border border-border/40 rounded-2xl p-5 flex flex-col gap-3">
                                <div className="flex items-center justify-between">
                                    <span className="text-[11px] text-muted uppercase tracking-widest font-bold">{card.label}</span>
                                    <card.icon className={`w-4 h-4 ${card.color}`} />
                                </div>
                                <p className={`text-3xl font-serif font-semibold ${card.color}`}>{card.value}</p>
                            </div>
                        ))
                    }
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

                    {/* Rep Activity */}
                    <div className="bg-surface/10 border border-border/40 rounded-2xl overflow-hidden">
                        <div className="px-6 py-4 border-b border-border/40">
                            <h3 className="font-serif text-base">Rep Activity</h3>
                            <p className="text-[11px] text-muted mt-0.5">Consultations per team member</p>
                        </div>
                        {loading ? (
                            <div className="p-6 space-y-3">
                                {[1, 2, 3].map(i => <div key={i} className="h-10 rounded-xl bg-surface/20 animate-pulse" />)}
                            </div>
                        ) : !stats || stats.repActivity.length === 0 ? (
                            <div className="px-6 py-10 text-center text-muted text-sm">No team activity yet.</div>
                        ) : (
                            <div className="divide-y divide-border/30">
                                <div className="grid grid-cols-3 px-6 py-2 text-[10px] text-muted uppercase tracking-widest font-bold">
                                    <span>Rep</span>
                                    <span className="text-center">Today</span>
                                    <span className="text-center">This Week</span>
                                </div>
                                {stats.repActivity.map(rep => (
                                    <div key={rep.email} className="grid grid-cols-3 px-6 py-3 items-center hover:bg-surface/20 transition-colors">
                                        <span className="text-xs text-foreground/80 truncate pr-2">{rep.email}</span>
                                        <span className={`text-center text-sm font-semibold ${rep.conversations_today > 0 ? "text-accent" : "text-muted"}`}>
                                            {rep.conversations_today}
                                        </span>
                                        <span className="text-center text-sm text-foreground/70">{rep.conversations_week}</span>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Recent Client Questions */}
                    <div className="bg-surface/10 border border-border/40 rounded-2xl overflow-hidden">
                        <div className="px-6 py-4 border-b border-border/40">
                            <h3 className="font-serif text-base">Recent Client Questions</h3>
                            <p className="text-[11px] text-muted mt-0.5">What clients are asking across the floor</p>
                        </div>
                        {loading ? (
                            <div className="p-6 space-y-3">
                                {[1, 2, 3, 4].map(i => <div key={i} className="h-12 rounded-xl bg-surface/20 animate-pulse" />)}
                            </div>
                        ) : !stats || stats.recentQuestions.length === 0 ? (
                            <div className="px-6 py-10 text-center text-muted text-sm">No questions yet.</div>
                        ) : (
                            <div className="divide-y divide-border/30 max-h-80 overflow-y-auto custom-scrollbar">
                                {stats.recentQuestions.map((q, i) => (
                                    <div key={i} className="px-6 py-3">
                                        <p className="text-xs text-foreground/80 leading-relaxed line-clamp-2">{q.content}</p>
                                        <div className="flex items-center gap-2 mt-1">
                                            <span className="text-[10px] text-muted">{q.rep_email}</span>
                                            <span className="text-muted/40 text-[10px]">·</span>
                                            <span className="text-[10px] text-muted">{relativeTime(q.created_at)}</span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </ManagerLayout>
    );
}
