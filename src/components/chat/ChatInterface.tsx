"use client";

import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
    Send,
    User,
    Sparkles,
    BookOpen,
    ChevronRight,
    ChevronLeft,
    Bookmark,
    BookmarkCheck,
    History,
    Zap,
    Info,
    Plus,
    LogOut,
    MessageSquare,
    Trash2,
    X,
    Menu,
    Pencil,
    Mic,
    MicOff,
    Check,
    CornerDownRight,
    Wand2,
    Copy,
    Mail,
    Square,
    AlertTriangle,
    Search,
    Archive,
    ArchiveRestore,
    ThumbsUp,
    ThumbsDown,
} from "lucide-react";
import Link from "next/link";
import { useSession, signOut } from "next-auth/react";
import { toast } from "sonner";
import RecommendationMode from "@/components/copilot/RecommendationMode";

interface Citation {
    title: string;
    document_id: string;
    content?: string;
    score?: number;
}

interface SuggestedProduct {
    id: string;
    product_id: string;
    title: string;
    price: number | null;
    price_display: string | null;
    image_url: string | null;
    shopify_url: string | null;
    diamond_shape: string | null;
    metal: string | null;
    style: string | null;
    description_short: string | null;
    score: number;
}

interface Message {
    id?: string;                              // Set after streaming completes (from `done` SSE event) or on load
    role: "user" | "assistant";
    content: string;
    citations?: Citation[];
    products?: SuggestedProduct[];
    suggestions?: string[];
    lowConfidence?: boolean;
    aborted?: boolean;
    feedback?: "up" | "down" | null;          // Rep's vote on this answer (only meaningful for assistant role)
}

interface Conversation {
    id: string;
    title: string;
    created_at: string;
    last_message_at: string | null;
    message_count: number;
    archived_at?: string | null;
}

interface SavedResponse {
    id: string;
    title: string;
    content: string;
    citations: Citation[];
    created_at: string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function relativeTime(dateStr: string | null): string {
    if (!dateStr) return "";
    const date = new Date(dateStr);
    const diffMs = Date.now() - date.getTime();
    const diffMin = Math.floor(diffMs / 60_000);
    const diffHr = Math.floor(diffMs / 3_600_000);
    const diffDay = Math.floor(diffMs / 86_400_000);
    if (diffMin < 1) return "just now";
    if (diffMin < 60) return `${diffMin}m ago`;
    if (diffHr < 24) return `${diffHr}h ago`;
    if (diffDay === 1) return "yesterday";
    if (diffDay < 7) return `${diffDay}d ago`;
    return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function groupConversations(convs: Conversation[]): { label: string; items: Conversation[] }[] {
    const startOfToday = new Date().setHours(0, 0, 0, 0);
    const startOfYesterday = startOfToday - 86_400_000;
    const startOf7Days = startOfToday - 6 * 86_400_000;
    const groups: Record<string, Conversation[]> = { Today: [], Yesterday: [], "Last 7 Days": [], Earlier: [] };
    for (const c of convs) {
        const t = new Date(c.last_message_at ?? c.created_at).getTime();
        if (t >= startOfToday) groups["Today"].push(c);
        else if (t >= startOfYesterday) groups["Yesterday"].push(c);
        else if (t >= startOf7Days) groups["Last 7 Days"].push(c);
        else groups["Earlier"].push(c);
    }
    return Object.entries(groups).filter(([, i]) => i.length > 0).map(([label, items]) => ({ label, items }));
}

// ── Rename inline input ───────────────────────────────────────────────────────

function RenameInput({ defaultValue, onCommit, onCancel }: {
    defaultValue: string;
    onCommit: (val: string) => void;
    onCancel: () => void;
}) {
    const ref = useRef<HTMLInputElement>(null);
    useEffect(() => { ref.current?.select(); }, []);

    const commit = () => {
        const val = ref.current?.value.trim();
        if (val) onCommit(val);
        else onCancel();
    };

    return (
        <div className="flex items-center gap-1 flex-1 min-w-0">
            <input
                ref={ref}
                defaultValue={defaultValue}
                onKeyDown={e => {
                    if (e.key === "Enter") { e.preventDefault(); commit(); }
                    if (e.key === "Escape") onCancel();
                }}
                className="flex-1 min-w-0 bg-background border border-accent/40 rounded-lg px-2 py-0.5 text-xs text-foreground focus:outline-none focus:border-accent"
                autoFocus
            />
            <button onClick={commit} className="p-0.5 text-accent hover:text-accent/80 shrink-0">
                <Check className="w-3 h-3" />
            </button>
            <button onClick={onCancel} className="p-0.5 text-muted hover:text-foreground shrink-0">
                <X className="w-3 h-3" />
            </button>
        </div>
    );
}

// ── Content parser — splits answer text from SUGGESTIONS footer ───────────────

function parseContent(content: string): { text: string; suggestions: string[] } {
    const marker = "\nSUGGESTIONS:";
    const idx = content.indexOf(marker);
    if (idx === -1) return { text: content, suggestions: [] };
    const text = content.slice(0, idx);
    try {
        const suggestions = JSON.parse(content.slice(idx + marker.length).trim());
        if (Array.isArray(suggestions)) return { text, suggestions };
    } catch { }
    return { text, suggestions: [] };
}

// ── Markdown renderer styled for dark luxury theme ────────────────────────────

function MarkdownContent({ content }: { content: string }) {
    return (
        <ReactMarkdown
            remarkPlugins={[remarkGfm]}
            components={{
                h1: ({ children }) => <h1 className="text-lg font-serif font-semibold mb-2 mt-3 first:mt-0">{children}</h1>,
                h2: ({ children }) => <h2 className="text-base font-serif font-semibold mb-2 mt-3 first:mt-0">{children}</h2>,
                h3: ({ children }) => <h3 className="text-sm font-semibold mb-1.5 mt-2 first:mt-0">{children}</h3>,
                p: ({ children }) => <p className="mb-2 last:mb-0 leading-relaxed">{children}</p>,
                ul: ({ children }) => <ul className="list-disc list-outside pl-4 mb-2 space-y-0.5">{children}</ul>,
                ol: ({ children }) => <ol className="list-decimal list-outside pl-4 mb-2 space-y-0.5">{children}</ol>,
                li: ({ children }) => <li className="text-sm leading-relaxed">{children}</li>,
                strong: ({ children }) => <strong className="font-semibold text-foreground">{children}</strong>,
                em: ({ children }) => <em className="italic">{children}</em>,
                code: ({ children, className }) => {
                    const isBlock = className?.includes("language-");
                    return isBlock
                        ? <code className="block bg-surface/60 border border-border/40 rounded-lg p-3 text-xs font-mono overflow-x-auto my-2">{children}</code>
                        : <code className="bg-surface/60 border border-border/30 rounded px-1.5 py-0.5 text-xs font-mono">{children}</code>;
                },
                blockquote: ({ children }) => <blockquote className="border-l-2 border-accent/40 pl-3 text-muted italic my-2">{children}</blockquote>,
                hr: () => <hr className="border-border/40 my-3" />,
                a: ({ href, children }) => <a href={href} target="_blank" rel="noopener noreferrer" className="text-accent underline hover:text-accent/80">{children}</a>,
            }}
        >
            {content}
        </ReactMarkdown>
    );
}

// ── Sidebar content (shared between desktop + mobile drawer) ──────────────────

function SidebarContent({
    grouped, loadingConversations, conversationId, savedResponses, expandedSaved,
    onLoadConversation, onNewConversation, onDeleteSaved, onExpandSaved, onClose, isAdmin, isManager, savedSectionRef,
    renamingId, onStartRename, onCommitRename, onCancelRename,
    conversationSearch, onConversationSearchChange,
    showArchived, onToggleShowArchived, onArchive, archivingId,
    totalConversations, hasSearch,
}: {
    grouped: { label: string; items: Conversation[] }[];
    loadingConversations: boolean;
    conversationId: string | null;
    savedResponses: SavedResponse[];
    expandedSaved: string | null;
    onLoadConversation: (c: Conversation) => void;
    onNewConversation: () => void;
    onDeleteSaved: (id: string) => void;
    onExpandSaved: (id: string) => void;
    onClose: () => void;
    isAdmin: boolean;
    isManager: boolean;
    savedSectionRef?: React.RefObject<HTMLDivElement | null>;
    renamingId: string | null;
    onStartRename: (id: string, currentTitle: string) => void;
    onCommitRename: (id: string, newTitle: string) => void;
    onCancelRename: () => void;
    conversationSearch: string;
    onConversationSearchChange: (val: string) => void;
    showArchived: boolean;
    onToggleShowArchived: () => void;
    onArchive: (id: string, archive: boolean) => void;
    archivingId: string | null;
    totalConversations: number;
    hasSearch: boolean;
}) {
    return (
        <>
            {/* Header */}
            <div className="px-5 py-5 flex items-center justify-between border-b border-border/40 shrink-0">
                <Link href="/" className="flex items-center gap-2 group" onClick={onClose}>
                    <div className="w-8 h-8 rounded-full bg-accent flex items-center justify-center">
                        <span className="text-background font-bold text-xs">M</span>
                    </div>
                    <span className="font-serif text-xl tracking-tight text-accent">MOIJEY</span>
                </Link>
                <div className="flex items-center gap-1">
                    <button onClick={onNewConversation} title="New consultation"
                        className="p-2 rounded-xl hover:bg-accent/10 hover:text-accent text-muted transition-all">
                        <Plus className="w-4 h-4" />
                    </button>
                    {/* Desktop collapse — hidden on mobile */}
                    <button onClick={onClose} title="Collapse sidebar"
                        className="p-2 rounded-xl hover:bg-surface/60 text-muted hover:text-foreground transition-all hidden lg:flex">
                        <ChevronLeft className="w-4 h-4" />
                    </button>
                    {/* Mobile close — hidden on desktop */}
                    <button onClick={onClose} title="Close menu"
                        className="p-2 rounded-xl hover:bg-surface/60 text-muted hover:text-foreground transition-all lg:hidden">
                        <X className="w-4 h-4" />
                    </button>
                </div>
            </div>

            {/* Scrollable body */}
            <div className="flex-1 overflow-y-auto custom-scrollbar">

                {/* Recent Consultations */}
                <div className="py-4">
                    <div className="px-4 mb-3 flex items-center justify-between gap-2">
                        <h3 className="text-[10px] font-bold text-muted uppercase tracking-widest flex items-center gap-2">
                            <History className="w-3 h-3" /> {showArchived ? "Archived Consultations" : "Recent Consultations"}
                        </h3>
                    </div>

                    {/* Search box — only useful once you have something to search. */}
                    {(totalConversations > 0 || hasSearch) && (
                        <div className="px-3 mb-2">
                            <div className="relative">
                                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3 h-3 text-muted/50" />
                                <input
                                    type="text"
                                    value={conversationSearch}
                                    onChange={e => onConversationSearchChange(e.target.value)}
                                    placeholder={showArchived ? "Search archived..." : "Search consultations..."}
                                    className="w-full bg-surface/30 border border-border/40 rounded-lg pl-7 pr-7 py-1.5 text-[11px] focus:outline-none focus:border-accent/40 placeholder:text-muted/40"
                                />
                                {conversationSearch && (
                                    <button
                                        onClick={() => onConversationSearchChange("")}
                                        className="absolute right-2 top-1/2 -translate-y-1/2 text-muted/40 hover:text-muted"
                                        title="Clear"
                                    >
                                        <X className="w-3 h-3" />
                                    </button>
                                )}
                            </div>
                        </div>
                    )}

                    {loadingConversations ? (
                        <div className="px-4 space-y-2">
                            {[1, 2, 3].map(i => <div key={i} className="h-14 rounded-2xl bg-surface/20 animate-pulse" />)}
                        </div>
                    ) : grouped.length === 0 ? (
                        <div className="px-4 py-6 text-center">
                            <MessageSquare className="w-8 h-8 text-muted/30 mx-auto mb-2" />
                            {hasSearch ? (
                                <>
                                    <p className="text-xs text-muted">No matches.</p>
                                    <p className="text-[10px] text-muted/60 mt-1">Try a different search.</p>
                                </>
                            ) : showArchived ? (
                                <>
                                    <p className="text-xs text-muted">No archived consultations.</p>
                                    <p className="text-[10px] text-muted/60 mt-1">Archive a thread to hide it from your sidebar.</p>
                                </>
                            ) : (
                                <>
                                    <p className="text-xs text-muted">No consultations yet.</p>
                                    <p className="text-[10px] text-muted/60 mt-1">Ask your first question below.</p>
                                </>
                            )}
                        </div>
                    ) : (
                        <div className="space-y-4 px-3">
                            {grouped.map(({ label, items }) => (
                                <div key={label}>
                                    <p className="text-[9px] font-bold uppercase tracking-widest text-muted/50 px-2 mb-1.5">{label}</p>
                                    <div className="space-y-0.5">
                                        {items.map(conv => {
                                            const isActive = conversationId === conv.id;
                                            const isRenaming = renamingId === conv.id;
                                            const isArchiving = archivingId === conv.id;
                                            return (
                                                <div key={conv.id}
                                                    className={`w-full text-left px-3 py-2.5 rounded-xl transition-all group flex flex-col gap-0.5 ${isActive ? "bg-accent/10 border border-accent/20" : "hover:bg-surface/40 border border-transparent hover:border-border/30"} ${isArchiving ? "opacity-50" : ""}`}>
                                                    <div className="flex items-start justify-between gap-1">
                                                        {isRenaming ? (
                                                            <RenameInput
                                                                defaultValue={conv.title || ""}
                                                                onCommit={val => onCommitRename(conv.id, val)}
                                                                onCancel={onCancelRename}
                                                            />
                                                        ) : (
                                                            <>
                                                                <button
                                                                    onClick={() => { onLoadConversation(conv); onClose(); }}
                                                                    className="flex-1 text-left min-w-0"
                                                                >
                                                                    <span className={`text-xs font-medium truncate leading-tight block ${isActive ? "text-accent" : "text-foreground/80 group-hover:text-foreground"}`}>
                                                                        {conv.title || "Untitled"}
                                                                    </span>
                                                                </button>
                                                                {/* Always visible on touch devices (no hover); fades in on hover for desktop. */}
                                                                <div className="flex items-center shrink-0 opacity-60 lg:opacity-0 lg:group-hover:opacity-100 focus-within:opacity-100 transition-opacity">
                                                                    {!showArchived && (
                                                                        <button
                                                                            onClick={e => { e.stopPropagation(); onStartRename(conv.id, conv.title || ""); }}
                                                                            className="p-1 rounded-lg text-muted/40 hover:text-muted hover:bg-surface/60 transition-all"
                                                                            title="Rename"
                                                                        >
                                                                            <Pencil className="w-3 h-3" />
                                                                        </button>
                                                                    )}
                                                                    <button
                                                                        onClick={e => { e.stopPropagation(); onArchive(conv.id, !showArchived); }}
                                                                        disabled={isArchiving}
                                                                        className="p-1 rounded-lg text-muted/40 hover:text-muted hover:bg-surface/60 transition-all"
                                                                        title={showArchived ? "Restore consultation" : "Archive consultation (hides from sidebar; admins still see it)"}
                                                                    >
                                                                        {showArchived
                                                                            ? <ArchiveRestore className="w-3 h-3" />
                                                                            : <Archive className="w-3 h-3" />}
                                                                    </button>
                                                                </div>
                                                            </>
                                                        )}
                                                    </div>
                                                    {!isRenaming && (
                                                        <div className="flex items-center gap-2">
                                                            <span className="text-[10px] text-muted/60">{relativeTime(conv.last_message_at ?? conv.created_at)}</span>
                                                            {conv.message_count > 0 && (<>
                                                                <span className="text-muted/30 text-[10px]">·</span>
                                                                <span className="text-[10px] text-muted/60">{conv.message_count} {conv.message_count === 1 ? "msg" : "msgs"}</span>
                                                            </>)}
                                                            {showArchived && (
                                                                <>
                                                                    <span className="text-muted/30 text-[10px]">·</span>
                                                                    <span className="text-[10px] text-yellow-400/70">archived</span>
                                                                </>
                                                            )}
                                                        </div>
                                                    )}
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}

                    {/* Toggle: switch between active and archived views. Always visible —
                        a rep who archived everything has no way back to their archives if
                        we hide this. The active view shows nothing in that case, so this
                        link is the only path to recovery. */}
                    <div className="px-3 pt-3 mt-3 border-t border-border/30">
                        <button
                            onClick={onToggleShowArchived}
                            className="w-full text-left px-2 py-2 rounded-lg text-[11px] text-muted hover:text-accent hover:bg-accent/5 transition-colors flex items-center gap-2"
                        >
                            {showArchived ? <ArchiveRestore className="w-3 h-3" /> : <Archive className="w-3 h-3" />}
                            {showArchived ? "Back to active consultations" : "Show archived"}
                        </button>
                    </div>
                </div>

                {/* Saved Intelligence */}
                <div ref={savedSectionRef} className="py-4 border-t border-border/40">
                    <div className="px-4 mb-3">
                        <h3 className="text-[10px] font-bold text-muted uppercase tracking-widest flex items-center gap-2">
                            <Bookmark className="w-3 h-3" /> Saved Intelligence
                            {savedResponses.length > 0 && (
                                <span className="ml-auto bg-accent/20 text-accent text-[9px] font-bold px-1.5 py-0.5 rounded-full">
                                    {savedResponses.length}
                                </span>
                            )}
                        </h3>
                    </div>
                    {savedResponses.length === 0 ? (
                        <div className="px-4 py-4 text-center">
                            <p className="text-[10px] text-muted/60">Tap <Bookmark className="w-3 h-3 inline" /> on any AI response to save it here.</p>
                        </div>
                    ) : (
                        <div className="space-y-1 px-3">
                            {savedResponses.map(saved => (
                                <div key={saved.id} className="rounded-xl border border-border/30 hover:border-accent/20 transition-all overflow-hidden">
                                    <div onClick={() => onExpandSaved(saved.id)}
                                        className="w-full text-left px-3 py-2.5 flex items-start justify-between gap-2 group cursor-pointer">
                                        <div className="min-w-0">
                                            <p className="text-xs font-medium text-foreground/80 truncate group-hover:text-foreground">{saved.title}</p>
                                            <p className="text-[10px] text-muted/60 mt-0.5">{relativeTime(saved.created_at)}</p>
                                        </div>
                                        <div className="flex items-center gap-1 shrink-0">
                                            <button onClick={e => { e.stopPropagation(); onDeleteSaved(saved.id); }}
                                                className="p-1 rounded-lg hover:bg-red-500/10 hover:text-red-400 text-muted/40 transition-all" title="Remove">
                                                <Trash2 className="w-3 h-3" />
                                            </button>
                                            <X className={`w-3 h-3 text-muted/40 transition-transform ${expandedSaved === saved.id ? "rotate-0" : "rotate-45"}`} />
                                        </div>
                                    </div>
                                    {expandedSaved === saved.id && (
                                        <div className="px-3 pb-3 border-t border-border/20">
                                            <p className="text-[11px] text-foreground/70 leading-relaxed mt-2 line-clamp-6">{saved.content}</p>
                                            {saved.citations?.length > 0 && (
                                                <div className="flex flex-wrap gap-1 mt-2">
                                                    {saved.citations.map((c, i) => (
                                                        <span key={i} className="text-[9px] px-2 py-0.5 rounded-full bg-accent/10 text-accent/80">{c.title}</span>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            {/* Admin / Manager links */}
            {(isAdmin || isManager) && (
                <div className="px-4 pb-4 border-t border-border/40 pt-4 shrink-0 space-y-2">
                    {isAdmin && (
                        <Link href="/admin/knowledge" onClick={onClose}
                            className="flex items-center gap-3 px-4 py-3 rounded-2xl bg-surface hover:bg-surface/80 text-xs transition-all border border-border/40">
                            <div className="w-4 h-4 rounded-full border border-current flex items-center justify-center text-[8px] font-bold">A</div>
                            Admin Intelligence Access
                        </Link>
                    )}
                    <Link href="/manager" onClick={onClose}
                        className="flex items-center gap-3 px-4 py-3 rounded-2xl bg-surface hover:bg-surface/80 text-xs transition-all border border-border/40">
                        <div className="w-4 h-4 rounded-full border border-current flex items-center justify-center text-[8px] font-bold">M</div>
                        Manager Dashboard
                    </Link>
                </div>
            )}
        </>
    );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function ChatInterface() {
    const { data: session, status } = useSession();
    const role = (session?.user as any)?.role;
    const isAdmin = role === "admin";
    const isManager = role === "manager";

    const [query, setQuery] = useState("");
    const [mode, setMode] = useState<"short" | "detailed">("short");
    const [copilotMode, setCopilotMode] = useState<"questions" | "recommendations">("questions");
    const [messages, setMessages] = useState<Message[]>([]);
    const [loading, setLoading] = useState(false);
    const [streaming, setStreaming] = useState(false);
    const [copiedIdx, setCopiedIdx] = useState<number | null>(null);
    const [expandedCitation, setExpandedCitation] = useState<{ msgIdx: number; citIdx: number } | null>(null);
    const abortControllerRef = useRef<AbortController | null>(null);
    const [conversationId, setConversationId] = useState<string | null>(null);
    const [conversations, setConversations] = useState<Conversation[]>([]);
    const [loadingConversations, setLoadingConversations] = useState(true);
    const [savedResponses, setSavedResponses] = useState<SavedResponse[]>([]);
    const [savingIdx, setSavingIdx] = useState<number | null>(null);
    const [savedIdxSet, setSavedIdxSet] = useState<Set<number>>(new Set());
    const [expandedSaved, setExpandedSaved] = useState<string | null>(null);
    const [sidebarOpen, setSidebarOpen] = useState(true);
    const [renamingId, setRenamingId] = useState<string | null>(null);
    const [conversationSearch, setConversationSearch] = useState("");
    const [showArchived, setShowArchived] = useState(false);
    const [archivingId, setArchivingId] = useState<string | null>(null);
    const [isRecording, setIsRecording] = useState(false);
    const [isTranscribing, setIsTranscribing] = useState(false);
    const [micError, setMicError] = useState<string | null>(null);
    const recorderRef = useRef<{
        ctx: AudioContext;
        source: MediaStreamAudioSourceNode;
        node: AudioWorkletNode;
        stream: MediaStream;
        buffers: Float32Array[];
        sampleRate: number;
    } | null>(null);
    const scrollRef = useRef<HTMLDivElement>(null);
    const savedSectionRef = useRef<HTMLDivElement | null>(null);

    const [hasSpeechSupport, setHasSpeechSupport] = useState(false);
    useEffect(() => {
        setHasSpeechSupport(
            typeof navigator !== "undefined" &&
            !!navigator.mediaDevices?.getUserMedia &&
            (typeof window !== "undefined" && (("AudioContext" in window) || ("webkitAudioContext" in window)))
        );
    }, []);

    useEffect(() => {
        if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }, [messages, loading]);

    useEffect(() => {
        if (status !== "authenticated") return;
        fetchConversations();
        fetchSaved();
    }, [status]);

    // Refetch when the archived toggle flips so the list reflects the right view.
    useEffect(() => {
        if (status !== "authenticated") return;
        fetchConversations();
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [showArchived]);

    async function fetchConversations() {
        setLoadingConversations(true);
        try {
            const url = showArchived ? "/api/conversations?archived=1" : "/api/conversations";
            const res = await fetch(url);
            if (!res.ok) return;
            const data = await res.json();
            setConversations(Array.isArray(data) ? data : []);
        } catch (err) {
            console.error("Failed to fetch conversations:", err);
        } finally {
            setLoadingConversations(false);
        }
    }

    async function fetchSaved() {
        try {
            const res = await fetch("/api/saved");
            if (!res.ok) return;
            const data = await res.json();
            setSavedResponses(Array.isArray(data) ? data : []);
        } catch (err) {
            console.error("Failed to fetch saved:", err);
        }
    }

    const loadConversation = async (conv: Conversation) => {
        try {
            const res = await fetch(`/api/conversations/${conv.id}/messages`);
            const data = await res.json();
            if (Array.isArray(data)) {
                setMessages(data.map((m: any) => ({
                    id: m.id,
                    role: m.role,
                    content: m.content,
                    citations: m.citations ?? [],
                    products: m.products ?? [],
                    feedback: m.feedback === 1 ? "up" : m.feedback === -1 ? "down" : null,
                })));
                setConversationId(conv.id);
                setSavedIdxSet(new Set());
            }
        } catch (err) {
            console.error("Failed to load conversation:", err);
        }
    };

    const startNewConversation = () => {
        setMessages([]);
        setConversationId(null);
        setQuery("");
        setSavedIdxSet(new Set());
    };

    const handleSend = async (e?: React.FormEvent, overrideQuery?: string) => {
        if (e) e.preventDefault();
        const text = overrideQuery ?? query;
        if (!text.trim() || loading || streaming) return;

        const userMessage = { role: "user" as const, content: text };
        setMessages(prev => [...prev, userMessage]);
        if (!overrideQuery) setQuery("");
        setLoading(true);
        setStreaming(true);

        const controller = new AbortController();
        abortControllerRef.current = controller;

        try {
            const res = await fetch("/api/chat/ask", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ query: userMessage.content, mode, conversationId }),
                signal: controller.signal,
            });

            if (!res.ok) {
                const data = await res.json().catch(() => ({}));
                setMessages(prev => [...prev, {
                    role: "assistant",
                    content: res.status === 429
                        ? "You're sending messages too quickly. Please wait a moment before trying again."
                        : ((data as any).error || "Something went wrong. Please try again."),
                }]);
                setLoading(false);
                setStreaming(false);
                return;
            }

            // Consume SSE stream — text appears token-by-token
            const reader = res.body!.getReader();
            const decoder = new TextDecoder();
            let buffer = "";
            let pendingCitations: Citation[] = [];
            let pendingProducts: SuggestedProduct[] = [];
            let pendingLowConfidence = false;
            let firstToken = true;

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                buffer += decoder.decode(value, { stream: true });
                const lines = buffer.split("\n");
                buffer = lines.pop() ?? "";

                for (const line of lines) {
                    if (!line.startsWith("data: ")) continue;
                    let event: any;
                    try { event = JSON.parse(line.slice(6)); } catch { continue; }

                    if (event.type === "meta") {
                        pendingCitations = event.citations ?? [];
                        pendingProducts = event.products ?? [];
                        pendingLowConfidence = !!event.lowConfidence;
                        if (!conversationId && event.conversationId) {
                            setConversationId(event.conversationId);
                            // Optimistically add conversation to sidebar so it appears immediately
                            const newConvId = event.conversationId;
                            setConversations(prev => {
                                if (prev.find(c => c.id === newConvId)) return prev;
                                return [{
                                    id: newConvId,
                                    title: userMessage.content.substring(0, 60),
                                    created_at: new Date().toISOString(),
                                    last_message_at: new Date().toISOString(),
                                    message_count: 1,
                                }, ...prev];
                            });
                        }

                    } else if (event.type === "token") {
                        if (firstToken) {
                            firstToken = false;
                            setLoading(false);
                            setMessages(prev => [...prev, {
                                role: "assistant",
                                content: event.text,
                                citations: pendingCitations,
                                products: pendingProducts,
                                lowConfidence: pendingLowConfidence,
                            }]);
                        } else {
                            setMessages(prev => {
                                const last = prev[prev.length - 1];
                                if (last?.role === "assistant") {
                                    return [...prev.slice(0, -1), { ...last, content: last.content + event.text }];
                                }
                                return prev;
                            });
                        }

                    } else if (event.type === "done") {
                        // Server inserts the assistant message after streaming completes and
                        // sends back the row id so we can attach feedback to the just-rendered bubble.
                        if (event.messageId) {
                            setMessages(prev => {
                                const last = prev[prev.length - 1];
                                if (last?.role === "assistant" && !last.id) {
                                    return [...prev.slice(0, -1), { ...last, id: event.messageId as string }];
                                }
                                return prev;
                            });
                        }
                    } else if (event.type === "error") {
                        setLoading(false);
                        setMessages(prev => [...prev, { role: "assistant", content: event.message || "An error occurred." }]);
                    }
                }
            }

            // Always refresh sidebar after stream completes (gets accurate message count + timestamp)
            fetchConversations();

            // Parse suggestions out of the last assistant message now that streaming is done
            setMessages(prev => {
                const last = prev[prev.length - 1];
                if (last?.role === "assistant" && !last.suggestions) {
                    const { text, suggestions } = parseContent(last.content);
                    if (suggestions.length > 0) {
                        return [...prev.slice(0, -1), { ...last, content: text, suggestions }];
                    }
                }
                return prev;
            });
        } catch (err: any) {
            if (err?.name === "AbortError") {
                // User pressed Stop — keep whatever streamed in, mark it aborted, no error toast.
                setMessages(prev => {
                    const last = prev[prev.length - 1];
                    if (last?.role === "assistant") {
                        return [...prev.slice(0, -1), { ...last, aborted: true }];
                    }
                    return [...prev, { role: "assistant", content: "(Stopped before any response was generated.)", aborted: true }];
                });
                fetchConversations();
            } else {
                console.error(err);
                setMessages(prev => [...prev, { role: "assistant", content: "Connection error. Please try again." }]);
            }
        } finally {
            abortControllerRef.current = null;
            setLoading(false);
            setStreaming(false);
        }
    };

    const handleStop = () => {
        abortControllerRef.current?.abort();
    };

    const handleCopyMessage = async (idx: number, content: string) => {
        try {
            await navigator.clipboard.writeText(parseContent(content).text);
            setCopiedIdx(idx);
            setTimeout(() => setCopiedIdx(null), 1500);
        } catch (err) {
            console.error("Copy failed:", err);
        }
    };

    // Open Gmail's compose window in a new tab with the answer pre-filled.
    // We avoid the OS-level mailto: handler because Windows pops a "choose an app"
    // dialog when no email client is configured (Andy hit this on Monday demo).
    // Nearly the entire Moijey team uses Gmail, so going there directly is the
    // right tradeoff. Falls back to mailto only if window.open is blocked.
    const handleEmailMessage = (content: string) => {
        const body = parseContent(content).text;
        const subject = "From Moijey Diamonds";
        const gmailUrl = `https://mail.google.com/mail/?view=cm&fs=1&su=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
        const opened = window.open(gmailUrl, "_blank", "noopener,noreferrer");
        if (!opened) {
            // Popup blocked — fall back to mailto so the action still does something.
            window.location.href = `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
        }
    };

    /**
     * Toggle the rep's thumbs-up/down on an answer. Clicking the same vote again clears it.
     * Optimistic — flips local state first, rolls back on server failure.
     */
    const handleFeedback = async (idx: number, vote: "up" | "down") => {
        const msg = messages[idx];
        if (!msg?.id || msg.role !== "assistant") return;
        const next = msg.feedback === vote ? null : vote;
        const previous = msg.feedback ?? null;

        setMessages(prev => prev.map((m, i) => i === idx ? { ...m, feedback: next } : m));

        try {
            const res = await fetch(`/api/messages/${msg.id}/feedback`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ vote: next }),
            });
            if (!res.ok) throw new Error("Feedback save failed");
        } catch (err: any) {
            console.error("Feedback failed:", err);
            // Roll back the optimistic update so the UI stays honest.
            setMessages(prev => prev.map((m, i) => i === idx ? { ...m, feedback: previous } : m));
            toast.error("Couldn't record feedback", { description: "Please try again." });
        }
    };

    const handleSaveResponse = async (idx: number) => {
        const msg = messages[idx];
        if (!msg || msg.role !== "assistant" || savingIdx === idx || savedIdxSet.has(idx)) return;
        setSavingIdx(idx);
        try {
            const res = await fetch("/api/saved", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ content: msg.content, citations: msg.citations ?? [] }),
            });
            if (res.ok) {
                setSavedIdxSet(prev => new Set(prev).add(idx));
                await fetchSaved();
                setSidebarOpen(true); // reveal Saved Intelligence section
                setTimeout(() => savedSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 150);
            }
        } catch (err) {
            console.error("Failed to save response:", err);
        } finally {
            setSavingIdx(null);
        }
    };

    const handleCommitRename = async (id: string, newTitle: string) => {
        setRenamingId(null);
        try {
            const res = await fetch(`/api/conversations/${id}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ title: newTitle }),
            });
            if (res.ok) {
                setConversations(prev => prev.map(c => c.id === id ? { ...c, title: newTitle } : c));
            }
        } catch (err) {
            console.error("Failed to rename conversation:", err);
        }
    };

    /**
     * Archive (or restore) a consultation. Reps can hide noisy/test threads from
     * their sidebar; the row stays in the database with archived_at set, so admins
     * can still see it via /admin/logs and managers can audit if needed. Audit
     * log captures the action with user_id + conversation_id.
     */
    const handleArchive = async (id: string, archive: boolean) => {
        setArchivingId(id);
        try {
            const res = await fetch(`/api/conversations/${id}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ archived: archive }),
            });
            if (!res.ok) {
                const data = await res.json().catch(() => ({}));
                throw new Error((data as any).error || `${archive ? "Archive" : "Restore"} failed`);
            }
            // Drop the row from whichever view we're in (active vs archived):
            // archived items don't show in active view and vice versa.
            setConversations(prev => prev.filter(c => c.id !== id));
            // If the rep is currently viewing the conversation they just archived,
            // start a fresh consultation so the chat pane isn't pointing at a hidden row.
            if (archive && conversationId === id) {
                setConversationId(null);
                setMessages([]);
            }
        } catch (err: any) {
            console.error("Archive failed:", err);
            toast.error("Couldn't update consultation", {
                description: err.message || "Please try again.",
            });
        } finally {
            setArchivingId(null);
        }
    };

    // Encode mono Float32 PCM samples as a 16-bit little-endian WAV Blob.
    // Gemini accepts audio/wav directly; this avoids browser-only webm formats.
    const encodeWAV = (samples: Float32Array, sampleRate: number): Blob => {
        const buffer = new ArrayBuffer(44 + samples.length * 2);
        const view = new DataView(buffer);
        const writeStr = (off: number, s: string) => {
            for (let i = 0; i < s.length; i++) view.setUint8(off + i, s.charCodeAt(i));
        };
        writeStr(0, "RIFF");
        view.setUint32(4, 36 + samples.length * 2, true);
        writeStr(8, "WAVE");
        writeStr(12, "fmt ");
        view.setUint32(16, 16, true);
        view.setUint16(20, 1, true);            // PCM
        view.setUint16(22, 1, true);            // mono
        view.setUint32(24, sampleRate, true);
        view.setUint32(28, sampleRate * 2, true); // byte rate (mono * 16-bit)
        view.setUint16(32, 2, true);            // block align
        view.setUint16(34, 16, true);           // bits per sample
        writeStr(36, "data");
        view.setUint32(40, samples.length * 2, true);
        let off = 44;
        for (let i = 0; i < samples.length; i++) {
            const s = Math.max(-1, Math.min(1, samples[i]));
            view.setInt16(off, s < 0 ? s * 0x8000 : s * 0x7fff, true);
            off += 2;
        }
        return new Blob([buffer], { type: "audio/wav" });
    };

    const stopAndTranscribe = async () => {
        const rec = recorderRef.current;
        if (!rec) { setIsRecording(false); return; }
        recorderRef.current = null;
        setIsRecording(false);

        try {
            rec.node.port.onmessage = null;
            rec.node.disconnect();
            rec.source.disconnect();
            rec.stream.getTracks().forEach(t => t.stop());
            await rec.ctx.close();
        } catch { /* ignore teardown errors */ }

        const totalLen = rec.buffers.reduce((sum, b) => sum + b.length, 0);
        if (totalLen === 0) {
            setMicError("No audio captured. Please try again.");
            return;
        }
        const merged = new Float32Array(totalLen);
        let offset = 0;
        for (const b of rec.buffers) { merged.set(b, offset); offset += b.length; }

        const wav = encodeWAV(merged, rec.sampleRate);
        setIsTranscribing(true);
        try {
            const fd = new FormData();
            fd.append("audio", wav, "speech.wav");
            const res = await fetch("/api/transcribe", { method: "POST", body: fd });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || "Transcription failed");
            const text = (data.text || "").trim();
            if (!text) {
                setMicError("Couldn't make out any speech. Please try again.");
            } else {
                setQuery(prev => (prev ? prev.trimEnd() + " " : "") + text);
            }
        } catch (err: any) {
            setMicError(err.message || "Transcription failed.");
        } finally {
            setIsTranscribing(false);
        }
    };

    const toggleRecording = async () => {
        if (isRecording) {
            await stopAndTranscribe();
            return;
        }
        if (isTranscribing) return;
        setMicError(null);

        if (!navigator.mediaDevices?.getUserMedia) {
            setMicError("Voice input not supported in this browser. Try Chrome or Edge.");
            return;
        }

        let stream: MediaStream | null = null;
        let ctx: AudioContext | null = null;
        try {
            stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            const Ctx = (window as any).AudioContext || (window as any).webkitAudioContext;
            ctx = new Ctx() as AudioContext;

            // Inline AudioWorklet processor: forwards each input quantum to the main thread.
            // Doesn't write to outputs, so the destination receives silence (no mic feedback).
            const workletCode = `
                class PcmCaptureProcessor extends AudioWorkletProcessor {
                    process(inputs) {
                        const ch = inputs[0] && inputs[0][0];
                        if (ch && ch.length) this.port.postMessage(ch.slice(0));
                        return true;
                    }
                }
                registerProcessor('pcm-capture', PcmCaptureProcessor);
            `;
            const blobUrl = URL.createObjectURL(new Blob([workletCode], { type: "application/javascript" }));
            try {
                await ctx.audioWorklet.addModule(blobUrl);
            } finally {
                URL.revokeObjectURL(blobUrl);
            }

            const source = ctx.createMediaStreamSource(stream);
            const node = new AudioWorkletNode(ctx, "pcm-capture");
            const buffers: Float32Array[] = [];
            node.port.onmessage = (e: MessageEvent<Float32Array>) => buffers.push(e.data);
            source.connect(node);
            node.connect(ctx.destination); // required to keep the worklet running; output is silent

            recorderRef.current = { ctx, source, node, stream, buffers, sampleRate: ctx.sampleRate };
            setIsRecording(true);
        } catch (err: any) {
            // Roll back partial setup if anything failed (e.g. worklet loading)
            stream?.getTracks().forEach(t => t.stop());
            try { await ctx?.close(); } catch { /* ignore */ }
            const name = err?.name;
            if (name === "NotAllowedError" || name === "SecurityError") {
                setMicError("Microphone access denied — please allow microphone in your browser settings.");
            } else if (name === "NotFoundError") {
                setMicError("No microphone found. Please connect a microphone and try again.");
            } else {
                setMicError(err?.message || "Failed to start voice recording.");
            }
        }
    };

    const handleDeleteSaved = async (id: string) => {
        try {
            const res = await fetch(`/api/saved/${id}`, { method: "DELETE" });
            if (res.ok) setSavedResponses(prev => prev.filter(s => s.id !== id));
        } catch (err) {
            console.error("Failed to delete saved:", err);
        }
    };

    // Curated to demo both modes for new reps: the first three exercise the KB
    // (warranty, Gemshield insurance, rhodium plating — all in our uploaded docs),
    // the fourth triggers product retrieval, the fifth shows the custom-design pitch.
    const quickFaqs = [
        "What does our warranty cover?",
        "Tell me about Gemshield insurance",
        "How does rhodium replating work?",
        "Show me yellow gold bands under $2,000",
        "Walk me through a custom design",
    ];

    // Filter by search before grouping so empty groups disappear automatically.
    const searchTerm = conversationSearch.trim().toLowerCase();
    const filteredConversations = searchTerm
        ? conversations.filter(c => (c.title || "").toLowerCase().includes(searchTerm))
        : conversations;
    const grouped = groupConversations(filteredConversations);

    const sidebarProps = {
        grouped, loadingConversations, conversationId, savedResponses, expandedSaved,
        onLoadConversation: loadConversation,
        onNewConversation: startNewConversation,
        onDeleteSaved: handleDeleteSaved,
        onExpandSaved: (id: string) => setExpandedSaved(prev => prev === id ? null : id),
        onClose: () => setSidebarOpen(false),
        isAdmin,
        isManager,
        savedSectionRef,
        renamingId,
        onStartRename: (id: string, _currentTitle: string) => { setRenamingId(id); },
        onCommitRename: handleCommitRename,
        onCancelRename: () => setRenamingId(null),
        conversationSearch,
        onConversationSearchChange: setConversationSearch,
        showArchived,
        onToggleShowArchived: () => setShowArchived(v => !v),
        onArchive: handleArchive,
        archivingId,
        totalConversations: conversations.length,
        hasSearch: searchTerm.length > 0,
    };

    return (
        <div className="flex h-screen bg-background text-foreground overflow-hidden">

            {/* ── Mobile backdrop ───────────────────────────────────────────── */}
            {sidebarOpen && (
                <div
                    className="fixed inset-0 bg-black/50 z-40 lg:hidden"
                    onClick={() => setSidebarOpen(false)}
                />
            )}

            {/* ── Mobile drawer (fixed overlay) ────────────────────────────── */}
            <div className={`fixed inset-y-0 left-0 z-50 w-72 bg-surface/95 backdrop-blur-xl border-r border-border flex flex-col transition-transform duration-300 lg:hidden ${sidebarOpen ? "translate-x-0" : "-translate-x-full"}`}>
                <SidebarContent {...sidebarProps} onNewConversation={() => { startNewConversation(); setSidebarOpen(false); }} />
            </div>

            {/* ── Desktop sidebar (inline) ──────────────────────────────────── */}
            <aside className={`border-r border-border bg-surface/10 backdrop-blur-xl flex-col hidden lg:flex transition-all duration-300 overflow-hidden ${sidebarOpen ? "w-72" : "w-0 border-r-0"}`}>
                <div className={`flex flex-col h-full transition-all duration-300 ${sidebarOpen ? "w-72 opacity-100" : "w-0 opacity-0 pointer-events-none"}`}>
                    <SidebarContent {...sidebarProps} onClose={() => setSidebarOpen(false)} />
                </div>
            </aside>

            {/* ── Main Chat ─────────────────────────────────────────────────── */}
            <main className="flex-1 flex flex-col relative min-w-0">

                {/* Header */}
                <header className="h-16 lg:h-20 border-b border-border flex items-center justify-between gap-2 px-3 lg:px-8 bg-background/50 backdrop-blur-md z-30 shrink-0">
                    <div className="flex items-center gap-2 lg:gap-4 min-w-0">
                        {/* Mobile hamburger */}
                        <button onClick={() => setSidebarOpen(true)} title="Open menu"
                            className="p-2 rounded-xl hover:bg-surface/60 text-muted hover:text-foreground transition-all lg:hidden shrink-0">
                            <Menu className="w-5 h-5" />
                        </button>
                        {/* Desktop expand (when collapsed) */}
                        {!sidebarOpen && (
                            <button onClick={() => setSidebarOpen(true)} title="Open sidebar"
                                className="p-2 rounded-xl hover:bg-surface/60 text-muted hover:text-foreground transition-all hidden lg:flex shrink-0">
                                <ChevronRight className="w-4 h-4" />
                            </button>
                        )}
                        {/* Title block — hidden on small screens to save horizontal room for toggles. */}
                        <div className="w-8 h-8 lg:w-10 lg:h-10 rounded-xl lg:rounded-2xl bg-accent/10 border border-accent/20 hidden sm:flex items-center justify-center text-accent shrink-0">
                            <Sparkles className="w-4 h-4 lg:w-5 lg:h-5" />
                        </div>
                        <div className="hidden sm:block min-w-0">
                            <h2 className="font-serif text-base lg:text-lg leading-none whitespace-nowrap">AI Co-Pilot</h2>
                            <span className="hidden md:inline-block text-[9px] lg:text-[10px] text-green-400 font-bold uppercase tracking-tighter whitespace-nowrap mt-0.5">Verified Logic Operational</span>
                        </div>
                    </div>
                    <div className="flex items-center gap-1.5 lg:gap-3 shrink-0">
                        {/* Copilot Mode Selector — labels hide on phones, icons only there. */}
                        <div className="flex bg-surface rounded-full p-1 border border-border/50">
                            <button onClick={() => setCopilotMode("questions")}
                                title="Questions mode"
                                className={`px-2.5 sm:px-3 lg:px-4 py-1.5 rounded-full text-xs font-semibold transition-all flex items-center gap-1 ${copilotMode === 'questions' ? 'bg-accent text-background' : 'text-muted hover:text-foreground'}`}>
                                <MessageSquare className="w-3 h-3 shrink-0" />
                                <span className="hidden sm:inline">Questions</span>
                            </button>
                            <button onClick={() => setCopilotMode("recommendations")}
                                title="Recommendation mode"
                                className={`px-2.5 sm:px-3 lg:px-4 py-1.5 rounded-full text-xs font-semibold transition-all flex items-center gap-1 ${copilotMode === 'recommendations' ? 'bg-accent text-background' : 'text-muted hover:text-foreground'}`}>
                                <Wand2 className="w-3 h-3 shrink-0" />
                                <span className="hidden sm:inline">Recommend</span>
                            </button>
                        </div>

                        {/* Answer Mode Selector (only show for Questions mode) */}
                        {copilotMode === "questions" && (
                            <div className="flex bg-surface rounded-full p-1 border border-border/50">
                                <button onClick={() => setMode("short")}
                                    className={`px-2.5 sm:px-3 lg:px-4 py-1.5 rounded-full text-[11px] sm:text-xs font-semibold transition-all ${mode === 'short' ? 'bg-accent text-background' : 'text-muted hover:text-foreground'}`}>
                                    Short
                                </button>
                                <button onClick={() => setMode("detailed")}
                                    className={`px-2.5 sm:px-3 lg:px-4 py-1.5 rounded-full text-[11px] sm:text-xs font-semibold transition-all ${mode === 'detailed' ? 'bg-accent text-background' : 'text-muted hover:text-foreground'}`}>
                                    Detailed
                                </button>
                            </div>
                        )}

                        <button onClick={() => signOut({ callbackUrl: "/login" })} title="Sign out"
                            className="p-2 rounded-xl hover:bg-red-500/10 hover:text-red-400 text-muted transition-all">
                            <LogOut className="w-4 h-4" />
                        </button>
                    </div>
                </header>

                {/* Messages / Recommendations Content */}
                {copilotMode === "questions" ? (
                    <>
                        <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 lg:p-8 space-y-6 lg:space-y-8 custom-scrollbar">
                    {messages.length === 0 && (
                        <div className="h-full flex flex-col items-center justify-center text-center space-y-6 max-w-lg mx-auto px-2">
                            <div className="w-14 h-14 lg:w-16 lg:h-16 rounded-3xl bg-accent/5 flex items-center justify-center text-accent border border-accent/20">
                                <Zap className="w-7 h-7 lg:w-8 lg:h-8" />
                            </div>
                            <h1 className="text-2xl lg:text-3xl font-serif">How can I assist <br /> your client today?</h1>
                            <div className="grid grid-cols-2 gap-2 lg:gap-3 w-full">
                                {quickFaqs.map(faq => (
                                    <button key={faq} onClick={() => setQuery(faq)}
                                        className="p-3 lg:p-4 rounded-2xl border border-border/50 bg-surface/10 hover:border-accent/30 hover:bg-accent/5 text-[10px] text-left transition-all group">
                                        <span className="text-muted group-hover:text-foreground">{faq}</span>
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}

                    <AnimatePresence initial={false}>
                        {messages.map((m, idx) => (
                            <motion.div key={idx} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                                className={`flex gap-3 lg:gap-4 ${m.role === 'assistant' ? 'max-w-full lg:max-w-4xl' : 'justify-end'}`}>
                                {m.role === 'assistant' && (
                                    <div className="w-7 h-7 lg:w-8 lg:h-8 rounded-xl bg-accent/10 border border-accent/20 flex items-center justify-center text-accent shrink-0 mt-1">
                                        <Sparkles className="w-3.5 h-3.5 lg:w-4 lg:h-4" />
                                    </div>
                                )}
                                <div className={`space-y-2 lg:space-y-3 min-w-0 ${m.role === 'user' ? 'max-w-[80%]' : 'flex-1'}`}>
                                    <div className={`px-4 py-3 lg:p-5 rounded-2xl lg:rounded-3xl leading-relaxed text-sm ${m.role === 'assistant' ? 'bg-surface/30 border border-border/50' : 'bg-accent text-background font-medium'}`}>
                                        {m.role === 'assistant'
                                            ? <MarkdownContent content={parseContent(m.content).text} />
                                            : m.content}
                                    </div>
                                    {m.role === 'assistant' && m.products && m.products.length > 0 && (
                                        <div className="space-y-2">
                                            <p className="text-[10px] uppercase tracking-widest text-muted font-bold">Matching from inventory</p>
                                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                                {m.products.slice(0, 4).map(p => (
                                                    <a
                                                        key={p.id}
                                                        href={p.shopify_url || "#"}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        className="group flex gap-3 p-2.5 rounded-2xl border border-border/50 bg-surface/20 hover:border-accent/40 hover:bg-accent/5 transition-colors"
                                                    >
                                                        {p.image_url ? (
                                                            // eslint-disable-next-line @next/next/no-img-element
                                                            <img
                                                                src={p.image_url}
                                                                alt=""
                                                                className="w-14 h-14 rounded-xl object-cover bg-surface/40 shrink-0"
                                                                onError={e => { (e.target as HTMLImageElement).style.display = "none"; }}
                                                            />
                                                        ) : (
                                                            <div className="w-14 h-14 rounded-xl bg-surface/40 flex items-center justify-center shrink-0">
                                                                <BookOpen className="w-4 h-4 text-muted" />
                                                            </div>
                                                        )}
                                                        <div className="min-w-0 flex-1">
                                                            <p className="text-xs font-medium text-foreground/90 line-clamp-2 group-hover:text-accent transition-colors">{p.title}</p>
                                                            <p className="text-[11px] text-accent font-semibold mt-0.5">
                                                                {p.price_display || (p.price !== null ? `$${p.price.toLocaleString()}` : "Price on request")}
                                                            </p>
                                                            <p className="text-[10px] text-muted truncate mt-0.5">
                                                                {[p.diamond_shape, p.metal, p.style].filter(Boolean).join(" · ") || "—"}
                                                            </p>
                                                        </div>
                                                    </a>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                    {m.role === 'assistant' && (
                                        <div className="flex items-center gap-2 flex-wrap">
                                            {m.lowConfidence && (
                                                <div
                                                    title="No source passed the similarity threshold — verify before quoting"
                                                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-yellow-500/10 border border-yellow-500/30 text-[10px] text-yellow-400 font-semibold uppercase tracking-tighter"
                                                >
                                                    <AlertTriangle className="w-3 h-3 shrink-0" />
                                                    Verify before quoting
                                                </div>
                                            )}
                                            {m.citations && m.citations.map((c, i) => (
                                                <button
                                                    key={i}
                                                    onClick={() => setExpandedCitation({ msgIdx: idx, citIdx: i })}
                                                    disabled={!c.content}
                                                    title={c.content ? "Click to view source excerpt" : c.title}
                                                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-surface/50 border border-border/50 text-[10px] text-muted hover:border-accent/40 hover:text-accent hover:bg-accent/5 transition-colors disabled:cursor-default disabled:hover:border-border/50 disabled:hover:text-muted disabled:hover:bg-surface/50"
                                                >
                                                    <BookOpen className="w-3 h-3 text-accent shrink-0" />{c.title}
                                                </button>
                                            ))}
                                            <div className="ml-auto flex items-center gap-1">
                                                {/* Thumbs up/down — only enabled once the message has an id (after stream completes). */}
                                                <button
                                                    onClick={() => handleFeedback(idx, "up")}
                                                    disabled={!m.id}
                                                    title={m.feedback === "up" ? "Remove thumbs up" : "Mark this answer helpful"}
                                                    className={`p-1.5 rounded-full text-[10px] font-medium transition-all border disabled:opacity-40 disabled:cursor-default ${
                                                        m.feedback === "up"
                                                            ? "bg-green-500/15 border-green-500/40 text-green-400"
                                                            : "border-border/40 text-muted hover:border-green-500/40 hover:text-green-400 hover:bg-green-500/5"
                                                    }`}
                                                >
                                                    <ThumbsUp className="w-3 h-3" />
                                                </button>
                                                <button
                                                    onClick={() => handleFeedback(idx, "down")}
                                                    disabled={!m.id}
                                                    title={m.feedback === "down" ? "Remove thumbs down" : "Mark this answer unhelpful"}
                                                    className={`p-1.5 rounded-full text-[10px] font-medium transition-all border disabled:opacity-40 disabled:cursor-default ${
                                                        m.feedback === "down"
                                                            ? "bg-red-500/15 border-red-500/40 text-red-400"
                                                            : "border-border/40 text-muted hover:border-red-500/40 hover:text-red-400 hover:bg-red-500/5"
                                                    }`}
                                                >
                                                    <ThumbsDown className="w-3 h-3" />
                                                </button>
                                                <button
                                                    onClick={() => handleCopyMessage(idx, m.content)}
                                                    title="Copy answer"
                                                    className="flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-medium transition-all border border-border/40 text-muted hover:border-accent/30 hover:text-accent hover:bg-accent/5"
                                                >
                                                    {copiedIdx === idx
                                                        ? <><Check className="w-3 h-3" /> Copied</>
                                                        : <><Copy className="w-3 h-3" /> Copy</>}
                                                </button>
                                                <button
                                                    onClick={() => handleEmailMessage(m.content)}
                                                    title="Email this answer to a client"
                                                    className="flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-medium transition-all border border-border/40 text-muted hover:border-accent/30 hover:text-accent hover:bg-accent/5"
                                                >
                                                    <Mail className="w-3 h-3" /> Email
                                                </button>
                                                <button
                                                    onClick={() => handleSaveResponse(idx)}
                                                    disabled={savingIdx === idx || savedIdxSet.has(idx)}
                                                    title={savedIdxSet.has(idx) ? "Bookmarked" : "Bookmark to Saved Intelligence"}
                                                    className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-medium transition-all border ${
                                                        savedIdxSet.has(idx)
                                                            ? "bg-accent/10 border-accent/30 text-accent"
                                                            : "border-border/40 text-muted hover:border-accent/30 hover:text-accent hover:bg-accent/5"
                                                    } disabled:opacity-50`}
                                                >
                                                    {savedIdxSet.has(idx)
                                                        ? <><BookmarkCheck className="w-3 h-3" /> Bookmarked</>
                                                        : <><Bookmark className="w-3 h-3" /> Bookmark</>}
                                                </button>
                                            </div>
                                        </div>
                                    )}
                                    {m.role === 'assistant' && m.suggestions && m.suggestions.length > 0 && (
                                        <div className="flex flex-wrap gap-2 pt-1">
                                            {m.suggestions.map((s, si) => (
                                                <button
                                                    key={si}
                                                    onClick={() => handleSend(undefined, s)}
                                                    disabled={loading}
                                                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-border/50 bg-surface/10 text-[11px] text-muted hover:border-accent/40 hover:text-accent hover:bg-accent/5 transition-all text-left disabled:opacity-40"
                                                >
                                                    <CornerDownRight className="w-3 h-3 shrink-0" />
                                                    {s}
                                                </button>
                                            ))}
                                        </div>
                                    )}
                                </div>
                                {m.role === 'user' && (
                                    <div className="w-7 h-7 lg:w-8 lg:h-8 rounded-xl bg-surface border border-border flex items-center justify-center text-muted shrink-0 mt-1">
                                        <User className="w-3.5 h-3.5 lg:w-4 lg:h-4" />
                                    </div>
                                )}
                            </motion.div>
                        ))}
                    </AnimatePresence>

                    {loading && (
                        <div className="flex gap-3 lg:gap-4">
                            <div className="w-7 h-7 lg:w-8 lg:h-8 rounded-xl bg-accent/10 border border-accent/20 flex items-center justify-center text-accent shrink-0 mt-1">
                                <Sparkles className="w-3.5 h-3.5 animate-pulse" />
                            </div>
                            <div className="px-4 py-3 lg:p-5 rounded-2xl lg:rounded-3xl bg-surface/10 border border-border/50 flex gap-2 items-center">
                                <div className="w-1.5 h-1.5 rounded-full bg-accent animate-bounce" />
                                <div className="w-1.5 h-1.5 rounded-full bg-accent animate-bounce [animation-delay:0.2s]" />
                                <div className="w-1.5 h-1.5 rounded-full bg-accent animate-bounce [animation-delay:0.4s]" />
                            </div>
                        </div>
                    )}
                </div>

                {/* Input */}
                <div className="p-3 lg:p-8 border-t border-border bg-background/80 backdrop-blur-md shrink-0">
                    <form onSubmit={handleSend} className="max-w-4xl mx-auto">
                        {/* Textarea + buttons share their own relative wrapper so absolute
                            positioning is anchored to the input row, not the whole form
                            (which includes the helper-text line below). */}
                        <div className="relative">
                            <textarea rows={1} value={query} onChange={e => { setQuery(e.target.value); if (micError) setMicError(null); }}
                                onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
                                placeholder={isRecording ? "Listening..." : isTranscribing ? "Transcribing..." : "Query the MOIJEY intelligence base..."}
                                className={`w-full bg-surface/30 border rounded-2xl lg:rounded-3xl py-3 lg:py-4 pl-4 lg:pl-6 pr-24 lg:pr-28 focus:outline-none transition-all resize-none text-sm placeholder:text-muted/50 align-middle block ${isRecording ? "border-red-400/50 placeholder:text-red-400/60" : "border-border/50 focus:border-accent/50"}`}
                            />
                            {/* Mic button */}
                            {hasSpeechSupport && (
                                <button
                                    type="button"
                                    onClick={toggleRecording}
                                    disabled={isTranscribing}
                                    title={isRecording ? "Stop recording" : isTranscribing ? "Transcribing..." : "Speak your question"}
                                    className={`absolute right-12 lg:right-14 top-1/2 -translate-y-1/2 w-9 h-9 lg:w-10 lg:h-10 rounded-xl lg:rounded-2xl flex items-center justify-center transition-all disabled:cursor-wait ${
                                        isRecording
                                            ? "bg-red-500/10 text-red-400 animate-pulse"
                                            : isTranscribing
                                                ? "text-accent/60 animate-pulse"
                                                : "text-muted hover:text-accent hover:bg-accent/10"
                                    }`}
                                >
                                    {isRecording ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
                                </button>
                            )}
                            {/* Send / Stop button — toggles to Stop while a stream is in flight */}
                            {streaming ? (
                                <button
                                    type="button"
                                    onClick={handleStop}
                                    title="Stop generating"
                                    className="absolute right-2 lg:right-3 top-1/2 -translate-y-1/2 w-9 h-9 lg:w-10 lg:h-10 rounded-xl lg:rounded-2xl bg-red-500/15 text-red-400 border border-red-500/30 flex items-center justify-center hover:bg-red-500/25 active:scale-95 transition-all"
                                >
                                    <Square className="w-3.5 h-3.5 lg:w-4 lg:h-4" />
                                </button>
                            ) : (
                                <button
                                    type="submit"
                                    disabled={!query.trim() || loading}
                                    className="absolute right-2 lg:right-3 top-1/2 -translate-y-1/2 w-9 h-9 lg:w-10 lg:h-10 rounded-xl lg:rounded-2xl bg-accent text-background flex items-center justify-center hover:scale-105 active:scale-95 transition-all disabled:opacity-50 disabled:scale-100"
                                >
                                    <Send className="w-4 h-4 lg:w-5 lg:h-5" />
                                </button>
                            )}
                        </div>
                        {isRecording && (
                            <p className="text-[10px] text-red-400 text-center mt-2 flex items-center justify-center gap-1.5 animate-pulse">
                                <span className="w-1.5 h-1.5 rounded-full bg-red-400 inline-block" />
                                Recording — speak now, then click stop or the send button
                            </p>
                        )}
                        {isTranscribing && !isRecording && (
                            <p className="text-[10px] text-accent text-center mt-2 flex items-center justify-center gap-1.5 animate-pulse">
                                <span className="w-1.5 h-1.5 rounded-full bg-accent inline-block" />
                                Transcribing...
                            </p>
                        )}
                        {micError && !isRecording && !isTranscribing && (
                            <p className="text-[10px] text-red-400 text-center mt-2 flex items-center justify-center gap-1.5">
                                <MicOff className="w-3 h-3 shrink-0" />
                                {micError}
                            </p>
                        )}
                        {!isRecording && !isTranscribing && !micError && (
                            <p className="text-[9px] lg:text-[10px] text-center text-muted mt-2 uppercase tracking-tighter hidden sm:flex items-center justify-center gap-2">
                                <Info className="w-3 h-3" />
                                Always verify pricing with the MOIJEY ERP before quoting.
                            </p>
                        )}
                    </form>
                </div>
                    </>
                ) : (
                    <RecommendationMode />
                )}
            </main>

            {/* Citation source viewer — opens when a citation badge is clicked */}
            {expandedCitation && (() => {
                const msg = messages[expandedCitation.msgIdx];
                const cit = msg?.citations?.[expandedCitation.citIdx];
                if (!cit) return null;
                const scorePct = typeof cit.score === "number" ? Math.round(cit.score * 100) : null;
                return (
                    <div
                        className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4"
                        onClick={() => setExpandedCitation(null)}
                    >
                        <div
                            onClick={e => e.stopPropagation()}
                            className="w-full max-w-2xl max-h-[80vh] overflow-y-auto bg-background border border-border/60 rounded-3xl shadow-2xl"
                        >
                            <div className="flex items-start justify-between gap-4 p-6 border-b border-border/40">
                                <div className="flex items-start gap-3 min-w-0">
                                    <div className="w-9 h-9 rounded-xl bg-accent/10 border border-accent/20 flex items-center justify-center text-accent shrink-0">
                                        <BookOpen className="w-4 h-4" />
                                    </div>
                                    <div className="min-w-0">
                                        <p className="text-[10px] uppercase tracking-widest text-muted font-bold">Source excerpt</p>
                                        <p className="font-serif text-lg truncate">{cit.title}</p>
                                        {scorePct !== null && (
                                            <p className="text-[11px] text-muted mt-0.5">
                                                Match strength: <span className="text-foreground font-semibold">{scorePct}%</span>
                                            </p>
                                        )}
                                    </div>
                                </div>
                                <button
                                    onClick={() => setExpandedCitation(null)}
                                    className="p-2 rounded-xl hover:bg-surface/60 text-muted shrink-0"
                                    title="Close"
                                >
                                    <X className="w-4 h-4" />
                                </button>
                            </div>
                            <div className="p-6 text-sm leading-relaxed text-foreground/90 whitespace-pre-wrap">
                                {cit.content || <span className="text-muted italic">No excerpt available for this citation.</span>}
                            </div>
                        </div>
                    </div>
                );
            })()}
        </div>
    );
}
