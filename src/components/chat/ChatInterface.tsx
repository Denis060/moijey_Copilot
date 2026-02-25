"use client";

import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
    Send,
    User,
    Sparkles,
    BookOpen,
    ChevronRight,
    MessageSquare,
    Bookmark,
    History,
    Zap,
    Info
} from "lucide-react";
import Link from "next/link";

interface Message {
    role: "user" | "assistant";
    content: string;
    citations?: { title: string; document_id: string }[];
}

export default function ChatInterface() {
    const [query, setQuery] = useState("");
    const [mode, setMode] = useState<"short" | "detailed">("short");
    const [messages, setMessages] = useState<Message[]>([]);
    const [loading, setLoading] = useState(false);
    const scrollRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [messages, loading]);

    const handleSend = async (e?: React.FormEvent) => {
        if (e) e.preventDefault();
        if (!query.trim() || loading) return;

        const userMessage = { role: "user" as const, content: query };
        setMessages(prev => [...prev, userMessage]);
        setQuery("");
        setLoading(true);

        try {
            const res = await fetch("/api/chat/ask", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ query: userMessage.content, mode }),
            });
            const data = await res.json();

            setMessages(prev => [...prev, {
                role: "assistant",
                content: data.answer,
                citations: data.citations
            }]);
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const quickFaqs = [
        "Warranty policy?",
        "Ethical sourcing statement",
        "Shipping time to New York",
        "Financing options",
        "Custom ring process"
    ];

    return (
        <div className="flex h-screen bg-background text-foreground overflow-hidden">
            {/* Sales Sidebar */}
            <aside className="w-80 border-r border-border bg-surface/10 backdrop-blur-xl flex flex-col hidden lg:flex">
                <div className="p-8">
                    <Link href="/" className="flex items-center gap-2 group">
                        <div className="w-8 h-8 rounded-full bg-accent flex items-center justify-center">
                            <span className="text-background font-bold text-xs">M</span>
                        </div>
                        <span className="font-serif text-xl tracking-tight text-accent">MOIJEY</span>
                    </Link>
                </div>

                <div className="flex-1 px-4 space-y-6">
                    <div className="space-y-4">
                        <h3 className="px-4 text-[10px] font-bold text-muted uppercase tracking-widest flex items-center gap-2">
                            <History className="w-3 h-3" />
                            Recent Consultations
                        </h3>
                        <div className="space-y-1">
                            {[1, 2, 3].map(i => (
                                <button key={i} className="w-full text-left px-4 py-3 rounded-2xl text-sm text-muted hover:bg-accent/5 hover:text-accent transition-all flex items-center justify-between group">
                                    <span className="truncate">Diamond Warranty Policy...</span>
                                    <ChevronRight className="w-3 h-3 opacity-0 group-hover:opacity-100" />
                                </button>
                            ))}
                        </div>
                    </div>

                    <div className="space-y-4">
                        <h3 className="px-4 text-[10px] font-bold text-muted uppercase tracking-widest flex items-center gap-2">
                            <Bookmark className="w-3 h-3" />
                            Saved Intelligence
                        </h3>
                        <div className="p-4 rounded-2xl bg-surface/20 border border-border/50 text-center text-xs text-muted">
                            No saved responses yet.
                        </div>
                    </div>
                </div>

                <div className="p-6 border-t border-border mt-auto">
                    <Link href="/admin/knowledge" className="flex items-center gap-3 px-4 py-3 rounded-2xl bg-surface hover:bg-surface/80 text-xs transition-all">
                        <SettingsIcon />
                        Admin Intelligence Access
                    </Link>
                </div>
            </aside>

            {/* Main Chat Area */}
            <main className="flex-1 flex flex-col relative px-4 lg:px-0">
                {/* Header */}
                <header className="h-20 border-b border-border flex items-center justify-between px-8 bg-background/50 backdrop-blur-md z-40">
                    <div className="flex items-center gap-4">
                        <div className="w-10 h-10 rounded-2xl bg-accent/10 border border-accent/20 flex items-center justify-center text-accent">
                            <Sparkles className="w-5 h-5" />
                        </div>
                        <div>
                            <h2 className="font-serif text-lg leading-none">AI Co-Pilot</h2>
                            <span className="text-[10px] text-green-400 font-bold uppercase tracking-tighter">Verified Logic Operational</span>
                        </div>
                    </div>

                    <div className="flex bg-surface rounded-full p-1 border border-border/50">
                        <button
                            onClick={() => setMode("short")}
                            className={`px-4 py-1.5 rounded-full text-xs font-semibold transition-all ${mode === 'short' ? 'bg-accent text-background' : 'text-muted hover:text-foreground'}`}
                        >
                            Short
                        </button>
                        <button
                            onClick={() => setMode("detailed")}
                            className={`px-4 py-1.5 rounded-full text-xs font-semibold transition-all ${mode === 'detailed' ? 'bg-accent text-background' : 'text-muted hover:text-foreground'}`}
                        >
                            Detailed
                        </button>
                    </div>
                </header>

                {/* Messages */}
                <div ref={scrollRef} className="flex-1 overflow-y-auto p-8 space-y-8 custom-scrollbar">
                    {messages.length === 0 && (
                        <div className="h-full flex flex-col items-center justify-center text-center space-y-6 max-w-lg mx-auto">
                            <div className="w-16 h-16 rounded-3xl bg-accent/5 flex items-center justify-center text-accent border border-accent/20">
                                <Zap className="w-8 h-8" />
                            </div>
                            <h1 className="text-3xl font-serif">How can I assist <br /> your client today?</h1>
                            <div className="grid grid-cols-2 gap-3 w-full">
                                {quickFaqs.map(faq => (
                                    <button
                                        key={faq}
                                        onClick={() => { setQuery(faq); }}
                                        className="p-4 rounded-2xl border border-border/50 bg-surface/10 hover:border-accent/30 hover:bg-accent/5 text-[10px] text-left transition-all group"
                                    >
                                        <span className="text-muted group-hover:text-foreground">{faq}</span>
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}

                    <AnimatePresence initial={false}>
                        {messages.map((m, idx) => (
                            <motion.div
                                key={idx}
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                className={`flex gap-4 ${m.role === 'assistant' ? 'max-w-4xl' : 'justify-end'}`}
                            >
                                {m.role === 'assistant' && (
                                    <div className="w-8 h-8 rounded-xl bg-accent/10 border border-accent/20 flex items-center justify-center text-accent shrink-0">
                                        <Sparkles className="w-4 h-4" />
                                    </div>
                                )}
                                <div className={`space-y-4 ${m.role === 'user' ? 'max-w-md' : ''}`}>
                                    <div className={`p-5 rounded-3xl leading-relaxed text-sm ${m.role === 'assistant' ? 'bg-surface/30 border border-border/50' : 'bg-accent text-background font-medium'}`}>
                                        {m.content}
                                    </div>
                                    {m.citations && m.citations.length > 0 && (
                                        <div className="flex flex-wrap gap-2 animate-in fade-in slide-in-from-left-2 duration-500">
                                            {m.citations.map((c, i) => (
                                                <div key={i} className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-surface/50 border border-border/50 text-[10px] text-muted">
                                                    <BookOpen className="w-3 h-3 text-accent" />
                                                    {c.title}
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                                {m.role === 'user' && (
                                    <div className="w-8 h-8 rounded-xl bg-surface border border-border flex items-center justify-center text-muted shrink-0">
                                        <User className="w-4 h-4" />
                                    </div>
                                )}
                            </motion.div>
                        ))}
                    </AnimatePresence>

                    {loading && (
                        <div className="flex gap-4">
                            <div className="w-8 h-8 rounded-xl bg-accent/10 border border-accent/20 flex items-center justify-center text-accent shrink-0">
                                <Sparkles className="w-4 h-4 animate-pulse" />
                            </div>
                            <div className="p-5 rounded-3xl bg-surface/10 border border-border/50 flex gap-2">
                                <div className="w-1.5 h-1.5 rounded-full bg-accent animate-bounce" />
                                <div className="w-1.5 h-1.5 rounded-full bg-accent animate-bounce [animation-delay:0.2s]" />
                                <div className="w-1.5 h-1.5 rounded-full bg-accent animate-bounce [animation-delay:0.4s]" />
                            </div>
                        </div>
                    )}
                </div>

                {/* Action Form */}
                <div className="p-8 border-t border-border bg-background/80 backdrop-blur-md">
                    <form onSubmit={handleSend} className="max-w-4xl mx-auto relative">
                        <textarea
                            rows={1}
                            value={query}
                            onChange={e => setQuery(e.target.value)}
                            onKeyDown={e => {
                                if (e.key === 'Enter' && !e.shiftKey) {
                                    e.preventDefault();
                                    handleSend();
                                }
                            }}
                            placeholder="Query the MOIJEY intelligence base..."
                            className="w-full bg-surface/30 border border-border/50 rounded-3xl py-4 pl-6 pr-16 focus:outline-none focus:border-accent/50 transition-all resize-none text-sm placeholder:text-muted/50"
                        />
                        <button
                            type="submit"
                            disabled={!query.trim() || loading}
                            className="absolute right-3 top-1/2 -translate-y-1/2 w-10 h-10 rounded-2xl bg-accent text-background flex items-center justify-center hover:scale-105 active:scale-95 transition-all disabled:opacity-50 disabled:scale-100"
                        >
                            <Send className="w-5 h-5" />
                        </button>
                        <p className="text-[10px] text-center text-muted mt-3 uppercase tracking-tighter flex items-center justify-center gap-2">
                            <Info className="w-3 h-3" />
                            Always verify pricing with the MOIJEY ERP before quoting.
                        </p>
                    </form>
                </div>
            </main>
        </div>
    );
}

function SettingsIcon() {
    return <div className="w-4 h-4 rounded-full border border-current flex items-center justify-center text-[8px] font-bold">A</div>;
}
