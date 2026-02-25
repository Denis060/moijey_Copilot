"use client";

import { useSession } from "next-auth/react";
import {
    LayoutDashboard,
    BookOpen,
    Database,
    Users,
    History,
    LogOut,
    Settings,
    ChevronRight
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs));
}

export default function AdminLayout({ children }: { children: React.ReactNode }) {
    const pathname = usePathname();

    const menuItems = [
        { name: "Insights", icon: LayoutDashboard, href: "/admin" },
        { name: "Knowledge Base", icon: BookOpen, href: "/admin/knowledge" },
        { name: "Business Facts", icon: Database, href: "/admin/facts" },
        { name: "User Management", icon: Users, href: "/admin/users" },
        { name: "Audit Logs", icon: History, href: "/admin/logs" },
    ];

    return (
        <div className="flex min-h-screen bg-background text-foreground">
            {/* Sidebar */}
            <aside className="w-72 border-r border-border bg-surface/10 backdrop-blur-xl flex flex-col">
                <div className="p-8">
                    <Link href="/admin" className="flex items-center gap-2 group">
                        <div className="w-8 h-8 rounded-full bg-accent flex items-center justify-center">
                            <span className="text-background font-bold text-xs">M</span>
                        </div>
                        <div className="flex flex-col leading-none">
                            <span className="font-serif text-lg tracking-tight text-accent">MOIJEY</span>
                            <span className="text-[10px] uppercase tracking-widest text-muted">Admin Portal</span>
                        </div>
                    </Link>
                </div>

                <nav className="flex-1 px-4 space-y-1">
                    {menuItems.map((item) => {
                        const isActive = pathname === item.href;
                        return (
                            <Link
                                key={item.href}
                                href={item.href}
                                className={cn(
                                    "flex items-center justify-between px-4 py-3 rounded-2xl transition-all group",
                                    isActive
                                        ? "bg-accent text-background font-semibold"
                                        : "hover:bg-accent/10 hover:text-accent"
                                )}
                            >
                                <div className="flex items-center gap-3">
                                    <item.icon className={cn("w-5 h-5", isActive ? "" : "text-muted group-hover:text-accent")} />
                                    <span>{item.name}</span>
                                </div>
                                {isActive && <ChevronRight className="w-4 h-4" />}
                            </Link>
                        );
                    })}
                </nav>

                <div className="p-6 border-t border-border mt-auto">
                    <button className="flex items-center gap-3 px-4 py-3 w-full text-muted hover:text-red-400 transition-colors">
                        <LogOut className="w-5 h-5" />
                        <span>Sign Out</span>
                    </button>
                </div>
            </aside>

            {/* Main Content */}
            <main className="flex-1 overflow-y-auto">
                <header className="h-20 border-b border-border flex items-center justify-between px-12 bg-background/50 backdrop-blur-md sticky top-0 z-40">
                    <h2 className="font-serif text-xl">
                        {menuItems.find(i => i.href === pathname)?.name || "Dashboard"}
                    </h2>
                    <div className="flex items-center gap-4">
                        <div className="text-right">
                            <p className="text-sm font-medium">Administrator</p>
                            <p className="text-[10px] text-muted uppercase">Main Workspace</p>
                        </div>
                        <div className="w-10 h-10 rounded-2xl bg-surface border border-border flex items-center justify-center">
                            <Settings className="w-5 h-5 text-muted" />
                        </div>
                    </div>
                </header>
                <div className="p-12">
                    {children}
                </div>
            </main>
        </div>
    );
}
