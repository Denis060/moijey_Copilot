"use client";

import { useState, useEffect } from "react";
import { Activity, Clock, Filter } from "lucide-react";
import AdminLayout from "@/components/dashboard/AdminLayout";

const ACTION_LABELS: Record<string, string> = {
    UPLOAD_DOC: "Document Uploaded",
    DELETE_DOC: "Document Deleted",
    ASK_QUESTION: "AI Consultation",
};

export default function LogsPage() {
    const [logs, setLogs] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState("ALL");

    useEffect(() => {
        async function fetchLogs() {
            try {
                const res = await fetch("/api/admin/logs");
                const data = await res.json();
                setLogs(Array.isArray(data) ? data : []);
            } catch (err) {
                console.error("Failed to fetch logs:", err);
            } finally {
                setLoading(false);
            }
        }
        fetchLogs();
    }, []);

    const filteredLogs = filter === "ALL" ? logs : logs.filter(l => l.action === filter);
    const actions = ["ALL", ...Array.from(new Set(logs.map(l => l.action)))];

    return (
        <AdminLayout>
            <div className="space-y-8 animate-in fade-in duration-500">
                {/* Filter Bar */}
                <div className="flex items-center gap-3 bg-surface/20 border border-border/50 p-4 rounded-3xl backdrop-blur-sm">
                    <Filter className="w-4 h-4 text-muted shrink-0" />
                    <div className="flex gap-2 flex-wrap">
                        {actions.map(action => (
                            <button
                                key={action}
                                onClick={() => setFilter(action)}
                                className={`px-4 py-1.5 rounded-full text-xs font-bold uppercase tracking-widest transition-all ${filter === action ? 'bg-accent text-background' : 'text-muted hover:text-foreground border border-border/50'}`}
                            >
                                {action === "ALL" ? "All Events" : (ACTION_LABELS[action] ?? action)}
                            </button>
                        ))}
                    </div>
                    <span className="ml-auto text-xs text-muted">{filteredLogs.length} entries</span>
                </div>

                {/* Logs Table */}
                <div className="border border-border/50 rounded-3xl bg-surface/10 overflow-hidden">
                    <div className="overflow-x-auto">
                    <table className="w-full min-w-[640px] text-left">
                        <thead className="bg-surface/30 border-b border-border/50">
                            <tr>
                                <th className="px-8 py-5 text-xs font-semibold uppercase tracking-widest text-muted">Timestamp</th>
                                <th className="px-8 py-5 text-xs font-semibold uppercase tracking-widest text-muted">User</th>
                                <th className="px-8 py-5 text-xs font-semibold uppercase tracking-widest text-muted">Action</th>
                                <th className="px-8 py-5 text-xs font-semibold uppercase tracking-widest text-muted">Resource</th>
                                <th className="px-8 py-5 text-xs font-semibold uppercase tracking-widest text-muted">Details</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-border/30">
                            {loading ? (
                                <tr><td colSpan={5} className="px-8 py-12 text-center text-muted">Loading audit trail...</td></tr>
                            ) : filteredLogs.length === 0 ? (
                                <tr><td colSpan={5} className="px-8 py-12 text-center text-muted">No log entries found.</td></tr>
                            ) : (
                                filteredLogs.map(log => (
                                    <tr key={log.id} className="hover:bg-accent/5 transition-colors">
                                        <td className="px-8 py-4">
                                            <div className="flex items-center gap-1.5 text-xs text-muted">
                                                <Clock className="w-3 h-3" />
                                                {new Date(log.created_at).toLocaleString()}
                                            </div>
                                        </td>
                                        <td className="px-8 py-4 text-sm">{log.user_email ?? "—"}</td>
                                        <td className="px-8 py-4">
                                            <ActionBadge action={log.action} />
                                        </td>
                                        <td className="px-8 py-4 text-xs text-muted">{log.resource_type}</td>
                                        <td className="px-8 py-4 text-xs text-muted max-w-xs truncate">
                                            {log.details ? JSON.stringify(log.details) : "—"}
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                    </div>
                </div>
            </div>
        </AdminLayout>
    );
}

function ActionBadge({ action }: { action: string }) {
    const colors: Record<string, string> = {
        UPLOAD_DOC: "text-blue-400 bg-blue-400/10 border-blue-400/20",
        DELETE_DOC: "text-red-400 bg-red-400/10 border-red-400/20",
        ASK_QUESTION: "text-green-400 bg-green-400/10 border-green-400/20",
    };
    const color = colors[action] ?? "text-muted bg-muted/10 border-muted/20";
    return (
        <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-tighter border ${color}`}>
            <Activity className="w-2.5 h-2.5" />
            {ACTION_LABELS[action] ?? action}
        </span>
    );
}
