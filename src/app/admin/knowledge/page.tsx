"use client";

import { useState, useEffect } from "react";
import { Upload, FileText, Trash2, CheckCircle2, Clock, AlertCircle, Plus, Search } from "lucide-react";
import AdminLayout from "@/components/dashboard/AdminLayout";

export default function KnowledgePage() {
    const [docs, setDocs] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [uploading, setUploading] = useState(false);

    useEffect(() => {
        fetchDocs();
        const interval = setInterval(fetchDocs, 5000); // Poll every 5s for progress updates
        return () => clearInterval(interval);
    }, []);

    const fetchDocs = async () => {
        try {
            const res = await fetch("/api/knowledge/upload");
            const data = await res.json();
            setDocs(Array.isArray(data) ? data : []);
            if (!Array.isArray(data) && data.error) {
                console.error("API Error:", data.error);
            }
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (!e.target.files?.[0]) return;
        setUploading(true);

        const file = e.target.files[0];
        const formData = new FormData();
        formData.append("file", file);

        try {
            await fetch("/api/knowledge/upload", {
                method: "POST",
                body: formData,
            });
            fetchDocs();
        } catch (err) {
            console.error(err);
        } finally {
            setUploading(false);
        }
    };

    return (
        <AdminLayout>
            <div className="space-y-8 animate-in fade-in duration-500">
                {/* Actions Bar */}
                <div className="flex justify-between items-center bg-surface/20 border border-border/50 p-6 rounded-3xl backdrop-blur-sm">
                    <div className="relative w-96">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted" />
                        <input
                            type="text"
                            placeholder="Search documents..."
                            className="w-full bg-background border border-border/50 rounded-2xl py-3 pl-12 pr-4 focus:outline-none focus:border-accent/50 transition-all text-sm"
                        />
                    </div>
                    <label className="cursor-pointer px-6 py-3 bg-accent text-background font-bold rounded-2xl hover:scale-105 active:scale-95 transition-all flex items-center gap-2">
                        <Plus className="w-5 h-5" />
                        New Document
                        <input type="file" className="hidden" onChange={handleUpload} disabled={uploading} />
                    </label>
                </div>

                {/* Status Grid */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <StatusCard title="Total Knowledge" value={docs.length} icon={<FileText />} color="text-accent" />
                    <StatusCard title="Processing" value={docs.filter(d => d.status === 'processing').length} icon={<Clock />} color="text-blue-400" />
                    <StatusCard title="Ready" value={docs.filter(d => d.status === 'completed').length} icon={<CheckCircle2 />} color="text-green-400" />
                </div>

                {/* Document Table */}
                <div className="border border-border/50 rounded-3xl bg-surface/10 overflow-hidden">
                    <table className="w-full text-left">
                        <thead className="bg-surface/30 border-b border-border/50">
                            <tr>
                                <th className="px-8 py-5 text-xs font-semibold uppercase tracking-widest text-muted">Title</th>
                                <th className="px-8 py-5 text-xs font-semibold uppercase tracking-widest text-muted">Category</th>
                                <th className="px-8 py-5 text-xs font-semibold uppercase tracking-widest text-muted">Status</th>
                                <th className="px-8 py-5 text-xs font-semibold uppercase tracking-widest text-muted">Created</th>
                                <th className="px-8 py-5 text-xs font-semibold uppercase tracking-widest text-muted text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-border/30">
                            {loading ? (
                                <tr><td colSpan={5} className="px-8 py-12 text-center text-muted">Loading intelligence base...</td></tr>
                            ) : docs.length === 0 ? (
                                <tr><td colSpan={5} className="px-8 py-12 text-center text-muted">No documents found. Start by uploading a file.</td></tr>
                            ) : (
                                docs.map((doc) => (
                                    <tr key={doc.id} className="hover:bg-accent/5 transition-colors group">
                                        <td className="px-8 py-5">
                                            <div className="flex items-center gap-3">
                                                <FileText className="w-5 h-5 text-accent/50" />
                                                <span className="font-medium">{doc.title}</span>
                                            </div>
                                        </td>
                                        <td className="px-8 py-5 text-sm text-muted">{doc.category}</td>
                                        <td className="px-8 py-5">
                                            <StatusBadge doc={doc} />
                                        </td>
                                        <td className="px-8 py-5 text-sm text-muted">
                                            {new Date(doc.created_at).toLocaleDateString()}
                                        </td>
                                        <td className="px-8 py-5 text-right">
                                            <button className="p-2 hover:bg-red-500/10 hover:text-red-400 rounded-xl transition-all opacity-0 group-hover:opacity-100">
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </AdminLayout>
    );
}

function StatusCard({ title, value, icon, color }: any) {
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

function StatusBadge({ doc }: { doc: any }) {
    const status = doc.status;
    const configs: any = {
        completed: { icon: CheckCircle2, text: "Ready", class: "text-green-400 bg-green-400/10 border-green-400/20" },
        processing: { icon: Clock, text: "Processing", class: "text-blue-400 bg-blue-400/10 border-blue-400/20" },
        failed: { icon: AlertCircle, text: "Failed", class: "text-red-400 bg-red-400/10 border-red-400/20" },
        pending: { icon: Clock, text: "Pending", class: "text-muted bg-muted/10 border-muted/20" },
    };

    const config = configs[status] || configs.pending;

    if (status === 'processing' && doc.total_chunks > 0) {
        const percent = Math.round((doc.processed_chunks / doc.total_chunks) * 100);
        return (
            <div className="w-40 space-y-1.5">
                <div className="flex justify-between text-[10px] font-bold text-blue-400 uppercase tracking-tighter">
                    <span>{percent}% Digitized</span>
                    <span>{doc.processed_chunks}/{doc.total_chunks}</span>
                </div>
                <div className="h-1 w-full bg-blue-400/10 rounded-full overflow-hidden border border-blue-400/20">
                    <div
                        className="h-full bg-blue-400 transition-all duration-500"
                        style={{ width: `${percent}%` }}
                    />
                </div>
            </div>
        );
    }

    return (
        <div className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-tighter border ${config.class}`}>
            <config.icon className="w-3 h-3" />
            {config.text}
        </div>
    );
}
