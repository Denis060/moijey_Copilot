import {
    Shield,
    BookOpen,
    MessageSquare,
    ChevronRight,
    Sparkles,
    Wand2,
    Mic,
    Send,
    User,
    AlertTriangle,
    Gem,
} from "lucide-react";
import Link from "next/link";

export default function Home() {
    return (
        <div className="min-h-screen bg-background text-foreground flex flex-col items-center">
            {/* Navigation */}
            <nav className="w-full max-w-7xl px-6 py-6 lg:py-8 flex justify-between items-center bg-background/80 backdrop-blur-md sticky top-0 z-50">
                <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-full bg-accent flex items-center justify-center">
                        <span className="text-background font-bold text-xs">M</span>
                    </div>
                    <div className="flex flex-col leading-none">
                        <span className="font-serif text-2xl tracking-tight text-accent">MOIJEY</span>
                        <span className="text-[9px] uppercase tracking-widest text-muted">Sales Co-Pilot</span>
                    </div>
                </div>
                <div className="flex items-center gap-4 text-sm font-medium">
                    <a
                        href="https://moijeydiamonds.com"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="hidden sm:inline-block text-muted hover:text-accent transition-colors"
                    >
                        Visit storefront
                    </a>
                    <Link
                        href="/login"
                        className="px-5 py-2 rounded-full border border-accent/30 hover:bg-accent/10 hover:border-accent/60 transition-all text-accent"
                    >
                        Sign In
                    </Link>
                </div>
            </nav>

            <main className="flex-1 w-full max-w-7xl px-6 flex flex-col items-center">
                {/* ─── Hero ───────────────────────────────────────────────── */}
                <section className="w-full text-center pt-16 pb-20 lg:pt-24 lg:pb-28 animate-in fade-in slide-in-from-bottom-4 duration-1000">
                    <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-accent/10 border border-accent/20 text-accent text-xs font-semibold tracking-wider uppercase">
                        <Sparkles className="w-3 h-3" />
                        For Moijey Sales Specialists
                    </div>
                    <h1 className="text-4xl sm:text-5xl md:text-7xl font-serif leading-tight mt-6">
                        The Intelligence Behind <br />
                        <span className="text-accent italic">Every Appointment.</span>
                    </h1>
                    <p className="text-muted text-base lg:text-lg max-w-2xl mx-auto leading-relaxed mt-6">
                        Ask any client question, recommend the perfect piece from live inventory, and send
                        a polished customer email — all without leaving the room.
                    </p>
                    <div className="flex flex-col sm:flex-row gap-3 justify-center pt-8">
                        <Link
                            href="/login"
                            className="px-8 py-4 rounded-full bg-accent text-background font-bold hover:scale-105 active:scale-95 transition-all flex items-center justify-center gap-2 group"
                        >
                            Sign In to Co-Pilot
                            <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                        </Link>
                        <a
                            href="#how-it-works"
                            className="px-8 py-4 rounded-full border border-border/50 hover:border-accent/40 hover:text-accent transition-all flex items-center justify-center gap-2"
                        >
                            See how it works
                        </a>
                    </div>
                    <p className="text-[11px] text-muted mt-6 uppercase tracking-widest">
                        Internal tool · Moijey staff access only
                    </p>
                </section>

                {/* ─── The three modes ─────────────────────────────────────── */}
                <section className="w-full grid grid-cols-1 md:grid-cols-3 gap-6 pb-16 lg:pb-24">
                    <ModeCard
                        icon={<MessageSquare className="w-5 h-5" />}
                        eyebrow="Questions Mode"
                        title="Ask anything in front of a client"
                        description="Warranty, sizing, sourcing, sapphire grades. Synthesized answers ready to speak word-for-word, with the source document one click away."
                    />
                    <ModeCard
                        icon={<Wand2 className="w-5 h-5" />}
                        eyebrow="Recommend Mode"
                        title="Match a piece. Send the email."
                        description="Enter the client's preferences and budget. Get the top three matches from live inventory plus a draft customer email — sent in one click."
                    />
                    <ModeCard
                        icon={<Mic className="w-5 h-5" />}
                        eyebrow="Voice & Continuity"
                        title="Speak, don't type"
                        description="Hands-free voice input for in-store appointments. The co-pilot remembers earlier turns, so follow-ups like 'what about for women?' just work."
                    />
                </section>

                {/* ─── Mock chat preview ───────────────────────────────────── */}
                <section id="how-it-works" className="w-full py-16 lg:py-24 border-t border-border/40">
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 lg:gap-16 items-center">
                        <div className="space-y-6">
                            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-accent/10 border border-accent/20 text-accent text-xs font-semibold tracking-wider uppercase">
                                A live preview
                            </div>
                            <h2 className="text-3xl lg:text-5xl font-serif leading-tight">
                                Cited answers,<br />
                                <span className="text-accent italic">live inventory.</span>
                            </h2>
                            <p className="text-muted leading-relaxed">
                                Behind every answer: vector search across your knowledge base, business facts,
                                and the live products catalog from moijeydiamonds.com. When the model isn&apos;t
                                confident in a source, it tells the rep before they quote it to the client.
                            </p>
                            <ul className="space-y-3 text-sm">
                                <li className="flex items-start gap-3">
                                    <BookOpen className="w-4 h-4 text-accent mt-0.5 shrink-0" />
                                    <span><span className="text-foreground font-semibold">Click any citation</span> to see the exact source excerpt — no blind trust.</span>
                                </li>
                                <li className="flex items-start gap-3">
                                    <AlertTriangle className="w-4 h-4 text-yellow-400 mt-0.5 shrink-0" />
                                    <span><span className="text-foreground font-semibold">A &ldquo;verify&rdquo; warning</span> appears when the answer comes from weak matches — protects against hallucinated quotes.</span>
                                </li>
                                <li className="flex items-start gap-3">
                                    <Shield className="w-4 h-4 text-accent mt-0.5 shrink-0" />
                                    <span><span className="text-foreground font-semibold">Audit trail of every question</span> for compliance and follow-up coaching.</span>
                                </li>
                            </ul>
                        </div>

                        {/* Mock chat */}
                        <div className="rounded-3xl border border-border/50 bg-surface/20 backdrop-blur-sm p-5 lg:p-6 space-y-4 shadow-2xl">
                            {/* User question */}
                            <div className="flex gap-3 justify-end">
                                <div className="px-4 py-3 rounded-2xl bg-accent text-background font-medium text-sm max-w-[80%]">
                                    Do you have a yellow gold band under $2,000?
                                </div>
                                <div className="w-8 h-8 rounded-xl bg-surface border border-border flex items-center justify-center text-muted shrink-0 mt-1">
                                    <User className="w-4 h-4" />
                                </div>
                            </div>

                            {/* Assistant answer */}
                            <div className="flex gap-3">
                                <div className="w-8 h-8 rounded-xl bg-accent/10 border border-accent/20 flex items-center justify-center text-accent shrink-0 mt-1">
                                    <Sparkles className="w-4 h-4" />
                                </div>
                                <div className="flex-1 space-y-3">
                                    <div className="px-4 py-3 rounded-2xl bg-surface/30 border border-border/50 text-sm leading-relaxed text-foreground/90">
                                        We have a few beautiful options — the 14K Yellow Gold 1.7mm
                                        Comfort-Fit Band at $1,286 is a timeless choice, and our 14K Yellow
                                        Gold 2mm Round Band at $825 is perfect if you&apos;re looking for
                                        something a touch lighter. Would you like me to bring either one over?
                                    </div>
                                    <div className="space-y-2">
                                        <p className="text-[10px] uppercase tracking-widest text-muted font-bold">Matching from inventory</p>
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                            <ProductCardMock title="14K Yellow Gold 1.7mm Comfort-Fit Band" price="$1,286" />
                                            <ProductCardMock title="14K Yellow Gold 2mm Round Wedding Band" price="$825" />
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2 flex-wrap">
                                        <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-surface/50 border border-border/50 text-[10px] text-muted">
                                            <BookOpen className="w-3 h-3 text-accent" />
                                            2026 MOIJEY KB · 87% match
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Mock input bar (decorative) */}
                            <div className="relative pt-2">
                                <div className="w-full bg-surface/40 border border-border/50 rounded-2xl py-3 pl-4 pr-20 text-sm text-muted/40 italic">
                                    Query the MOIJEY intelligence base...
                                </div>
                                <div className="absolute right-2 top-1/2 -translate-y-1/2 mt-1 flex gap-1">
                                    <div className="w-9 h-9 rounded-xl text-muted/40 flex items-center justify-center">
                                        <Mic className="w-4 h-4" />
                                    </div>
                                    <div className="w-9 h-9 rounded-xl bg-accent/30 text-background/60 flex items-center justify-center">
                                        <Send className="w-4 h-4" />
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </section>

                {/* ─── Bottom CTA ─────────────────────────────────────────── */}
                <section className="w-full py-16 lg:py-24 text-center border-t border-border/40">
                    <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-accent/10 border border-accent/20 text-accent mb-6">
                        <Gem className="w-5 h-5" />
                    </div>
                    <h2 className="text-3xl lg:text-4xl font-serif leading-tight">
                        Ready when your client walks in.
                    </h2>
                    <p className="text-muted max-w-xl mx-auto leading-relaxed mt-4">
                        Sign in with your Moijey email to start. Co-Pilot remembers every conversation
                        you&apos;ve had so you can pick up where you left off.
                    </p>
                    <Link
                        href="/login"
                        className="inline-flex items-center gap-2 mt-8 px-8 py-4 rounded-full bg-accent text-background font-bold hover:scale-105 active:scale-95 transition-all group"
                    >
                        Sign In
                        <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                    </Link>
                </section>
            </main>

            <footer className="w-full max-w-7xl px-6 py-10 border-t border-border text-sm">
                <div className="flex flex-col sm:flex-row justify-between items-center gap-4 text-muted">
                    <p>&copy; {new Date().getFullYear()} Moijey Diamonds · Internal sales tool</p>
                    <div className="flex items-center gap-6">
                        <a href="https://moijeydiamonds.com" target="_blank" rel="noopener noreferrer" className="hover:text-accent transition-colors">
                            moijeydiamonds.com
                        </a>
                        <Link href="/login" className="hover:text-accent transition-colors">Staff sign-in</Link>
                    </div>
                </div>
            </footer>
        </div>
    );
}

function ModeCard({
    icon,
    eyebrow,
    title,
    description,
}: {
    icon: React.ReactNode;
    eyebrow: string;
    title: string;
    description: string;
}) {
    return (
        <div className="p-7 rounded-3xl bg-surface/30 border border-border/50 text-left space-y-4 hover:border-accent/40 hover:bg-surface/40 transition-all group">
            <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-2xl bg-accent/5 border border-accent/20 flex items-center justify-center text-accent group-hover:bg-accent group-hover:text-background transition-all">
                    {icon}
                </div>
                <span className="text-[10px] uppercase tracking-widest text-accent/70 font-bold">
                    {eyebrow}
                </span>
            </div>
            <h3 className="text-xl font-serif leading-snug">{title}</h3>
            <p className="text-muted leading-relaxed text-sm">{description}</p>
        </div>
    );
}

function ProductCardMock({ title, price }: { title: string; price: string }) {
    return (
        <div className="flex gap-2.5 p-2.5 rounded-2xl border border-border/50 bg-surface/20">
            <div className="w-12 h-12 rounded-xl bg-linear-to-br from-accent/30 to-accent/5 border border-accent/20 flex items-center justify-center shrink-0">
                <Gem className="w-4 h-4 text-accent/80" />
            </div>
            <div className="min-w-0 flex-1">
                <p className="text-[11px] font-medium text-foreground/90 line-clamp-2 leading-snug">{title}</p>
                <p className="text-[11px] text-accent font-semibold mt-0.5">{price}</p>
            </div>
        </div>
    );
}
