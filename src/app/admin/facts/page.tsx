"use client";

import { useState, useEffect } from "react";
import { Plus, Database, Save, Trash2, Search, Info } from "lucide-react";
import AdminLayout from "@/components/dashboard/AdminLayout";

export default function FactsPage() {
    const [facts, setFacts] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [newFact, setNewFact] = useState({ key: "", value: "", category: "General" });

    useEffect(() => {
        fetchFacts();
    }, []);

    const fetchFacts = async () => {
        try {
            const res = await fetch("/api/knowledge/facts");
            const data = await res.json();
            setFacts(data);
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const handleSave = async (fact: any) => {
        setIsSaving(true);
        try {
            await fetch("/api/knowledge/facts", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(fact),
            });
            fetchFacts();
            if (fact === newFact) setNewFact({ key: "", value: "", category: "General" });
        } catch (err) {
            console.error(err);
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <AdminLayout>
            <div className="max-w-6xl space-y-12 animate-in fade-in duration-500">
                {/* Intro */}
                <div className="flex gap-4 p-6 rounded-3xl bg-accent/5 border border-accent/20">
                    <Info className="w-6 h-6 text-accent shrink-0" />
                    <p className="text-sm text-muted leading-relaxed">
                        <span className="text-accent font-bold">Business Facts</span> are structured pieces of information that the AI Co-Pilot prioritizes over general knowledge. Use them for specific policies, pricing updates, and core sourcing statements.
                    </p>
                </div>

                {/* Existing Facts Table */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-12">
                    {/* Form */}
                    <div className="lg:col-span-1 space-y-6">
                        <h3 className="font-serif text-2xl">Create New Fact</h3>
                        <div className="p-8 rounded-3xl bg-surface/20 border border-border/50 space-y-4">
                            <div className="space-y-1">
                                <label className="text-[10px] uppercase tracking-widest text-muted font-bold">Key (Internal identifier)</label>
                                <input
                                    type="text"
                                    placeholder="e.g., shipping_time_us"
                                    value={newFact.key}
                                    onChange={e => setNewFact({ ...newFact, key: e.target.value })}
                                    className="w-full bg-background border border-border/50 rounded-2xl py-3 px-4 focus:outline-none focus:border-accent/50 transition-all text-sm"
                                />
                            </div>
                            <div className="space-y-1">
                                <label className="text-[10px] uppercase tracking-widest text-muted font-bold">Value (Public policy text)</label>
                                <textarea
                                    rows={4}
                                    placeholder="Diamonds are sourced ethically from..."
                                    value={newFact.value}
                                    onChange={e => setNewFact({ ...newFact, value: e.target.value })}
                                    className="w-full bg-background border border-border/50 rounded-2xl py-3 px-4 focus:outline-none focus:border-accent/50 transition-all text-sm"
                                />
                            </div>
                            <button
                                onClick={() => handleSave(newFact)}
                                disabled={isSaving || !newFact.key || !newFact.value}
                                className="w-full py-3 bg-accent text-background font-bold rounded-2xl hover:scale-105 active:scale-95 transition-all flex items-center justify-center gap-2 group disabled:opacity-50"
                            >
                                <Plus className="w-4 h-4" />
                                Add Record
                            </button>
                        </div>
                    </div>

                    {/* List */}
                    <div className="lg:col-span-2 space-y-6">
                        <div className="flex items-center justify-between">
                            <h3 className="font-serif text-2xl">Active Records</h3>
                            <div className="text-xs text-muted">{facts.length} verified facts</div>
                        </div>

                        <div className="space-y-4">
                            {loading ? (
                                <div className="p-12 text-center text-muted">Synchronizing fact base...</div>
                            ) : facts.length === 0 ? (
                                <div className="p-12 text-center text-muted border border-dashed border-border rounded-3xl">No records yet.</div>
                            ) : (
                                facts.map((fact) => (
                                    <div key={fact.id} className="p-6 rounded-3xl bg-surface/10 border border-border/30 hover:border-accent/30 transition-all space-y-4 group">
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-2">
                                                <div className="w-2 h-2 rounded-full bg-accent" />
                                                <span className="font-mono text-xs text-accent font-bold uppercase tracking-wider">{fact.key}</span>
                                            </div>
                                            <button className="p-2 text-muted hover:text-red-400 transition-colors opacity-0 group-hover:opacity-100">
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                        </div>
                                        <p className="text-sm text-foreground/80 leading-relaxed">{fact.value}</p>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </AdminLayout>
    );
}
