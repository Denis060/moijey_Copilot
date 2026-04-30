"use client";

import { useState, useEffect } from "react";
import { useSession, signOut } from "next-auth/react";
import { useRouter } from "next/navigation";
import { LayoutDashboard, LogOut, MessageSquare, ChevronRight, Menu, X } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs));
}

const menuItems = [
    { name: "Team Overview", icon: LayoutDashboard, href: "/manager" },
];

function NavLinks({ pathname, onNavigate }: { pathname: string; onNavigate?: () => void }) {
    return (
        <nav className="flex-1 px-4 space-y-1 py-4">
            {menuItems.map((item) => {
                const isActive = pathname === item.href;
                return (
                    <Link
                        key={item.href}
                        href={item.href}
                        onClick={onNavigate}
                        className={cn(
                            "flex items-center justify-between px-4 py-3 rounded-2xl transition-all group",
                            isActive
                                ? "bg-accent text-background font-semibold"
                                : "hover:bg-accent/10 hover:text-accent"
                        )}
                    >
                        <div className="flex items-center gap-3">
                            <item.icon className={cn("w-5 h-5", isActive ? "" : "text-muted group-hover:text-accent")} />
                            <span className="text-sm">{item.name}</span>
                        </div>
                        {isActive && <ChevronRight className="w-4 h-4" />}
                    </Link>
                );
            })}
            <Link
                href="/chat"
                className="flex items-center gap-3 px-4 py-3 rounded-2xl transition-all group hover:bg-accent/10 hover:text-accent mt-4"
            >
                <MessageSquare className="w-5 h-5 text-muted group-hover:text-accent" />
                <span className="text-sm">Go to Co-Pilot</span>
            </Link>
        </nav>
    );
}

export default function ManagerLayout({ children }: { children: React.ReactNode }) {
    const pathname = usePathname();
    const router = useRouter();
    const { data: session, status } = useSession();
    const [mobileOpen, setMobileOpen] = useState(false);

    const role = (session?.user as any)?.role;

    useEffect(() => {
        if (status === "loading") return;
        if (status === "unauthenticated") { router.replace("/login"); return; }
        if (role !== "admin" && role !== "manager") router.replace("/chat");
    }, [status, role, router]);

    if (status === "loading" || (role !== "admin" && role !== "manager")) return null;

    const currentPage = menuItems.find(i => i.href === pathname)?.name || "Team Overview";

    return (
        <div className="flex h-screen overflow-hidden bg-background text-foreground">

            {/* ── Mobile backdrop ───────────────────────────────────────────── */}
            {mobileOpen && (
                <div
                    className="fixed inset-0 bg-black/50 z-40 lg:hidden"
                    onClick={() => setMobileOpen(false)}
                />
            )}

            {/* ── Mobile drawer ─────────────────────────────────────────────── */}
            <div className={`fixed inset-y-0 left-0 z-50 w-72 bg-background border-r border-border flex flex-col transition-transform duration-300 lg:hidden ${mobileOpen ? "translate-x-0" : "-translate-x-full"}`}>
                <div className="px-6 py-6 flex items-center justify-between border-b border-border/40">
                    <Link href="/manager" onClick={() => setMobileOpen(false)} className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-full bg-accent flex items-center justify-center">
                            <span className="text-background font-bold text-xs">M</span>
                        </div>
                        <div className="flex flex-col leading-none">
                            <span className="font-serif text-lg tracking-tight text-accent">MOIJEY</span>
                            <span className="text-[10px] uppercase tracking-widest text-muted">Manager View</span>
                        </div>
                    </Link>
                    <button onClick={() => setMobileOpen(false)} className="p-2 rounded-xl hover:bg-surface/60 text-muted">
                        <X className="w-4 h-4" />
                    </button>
                </div>
                <NavLinks pathname={pathname} onNavigate={() => setMobileOpen(false)} />
                <div className="p-4 border-t border-border">
                    <button onClick={() => signOut({ callbackUrl: "/login" })}
                        className="flex items-center gap-3 px-4 py-3 w-full text-muted hover:text-red-400 transition-colors rounded-2xl hover:bg-red-500/5">
                        <LogOut className="w-5 h-5" />
                        <span className="text-sm">Sign Out</span>
                    </button>
                </div>
            </div>

            {/* ── Desktop sidebar ───────────────────────────────────────────── */}
            <aside className="w-72 border-r border-border bg-surface/10 backdrop-blur-xl flex-col hidden lg:flex shrink-0">
                <div className="p-6 border-b border-border/40">
                    <Link href="/manager" className="flex items-center gap-2 group">
                        <div className="w-8 h-8 rounded-full bg-accent flex items-center justify-center">
                            <span className="text-background font-bold text-xs">M</span>
                        </div>
                        <div className="flex flex-col leading-none">
                            <span className="font-serif text-lg tracking-tight text-accent">MOIJEY</span>
                            <span className="text-[10px] uppercase tracking-widest text-muted">Manager View</span>
                        </div>
                    </Link>
                </div>
                <NavLinks pathname={pathname} />
                <div className="p-4 border-t border-border mt-auto">
                    <button onClick={() => signOut({ callbackUrl: "/login" })}
                        className="flex items-center gap-3 px-4 py-3 w-full text-muted hover:text-red-400 transition-colors rounded-2xl hover:bg-red-500/5">
                        <LogOut className="w-5 h-5" />
                        <span className="text-sm">Sign Out</span>
                    </button>
                </div>
            </aside>

            {/* ── Main Content ──────────────────────────────────────────────── */}
            <main className="flex-1 overflow-y-auto min-w-0">
                <header className="h-16 lg:h-20 border-b border-border flex items-center justify-between px-4 lg:px-10 bg-background/50 backdrop-blur-md sticky top-0 z-30">
                    <div className="flex items-center gap-3">
                        <button onClick={() => setMobileOpen(true)}
                            className="p-2 rounded-xl hover:bg-surface/60 text-muted lg:hidden">
                            <Menu className="w-5 h-5" />
                        </button>
                        <h2 className="font-serif text-lg lg:text-xl">{currentPage}</h2>
                    </div>
                    <div className="flex items-center gap-3">
                        <div className="text-right hidden sm:block">
                            <p className="text-sm font-medium">{(session?.user as any)?.email}</p>
                            <p className="text-[10px] text-muted uppercase tracking-widest">Manager</p>
                        </div>
                    </div>
                </header>
                <div className="p-4 lg:p-10">
                    {children}
                </div>
            </main>
        </div>
    );
}
