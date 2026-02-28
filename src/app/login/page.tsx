"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Shield, Lock, Mail, ChevronRight, Loader2, AlertCircle } from "lucide-react";
import Link from "next/link";

export default function LoginPage() {
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");
    const router = useRouter();

    const isDomainValid = !email || email.toLowerCase().endsWith("@moijeydiamonds.com");

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError("");

        if (!email.toLowerCase().endsWith("@moijeydiamonds.com")) {
            setError("Only @moijeydiamonds.com email addresses are permitted.");
            return;
        }

        setLoading(true);

        try {
            const result = await signIn("credentials", {
                email,
                password,
                redirect: false,
            });

            if (result?.error) {
                setError("Invalid email or password. Please try again.");
            } else {
                router.push("/chat");
            }
        } catch (err) {
            setError("An unexpected error occurred.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-background text-foreground flex items-center justify-center p-6 bg-[radial-gradient(circle_at_top_right,_var(--tw-gradient-stops))] from-surface/20 via-background to-background">
            <div className="w-full max-w-md space-y-8 animate-in fade-in zoom-in duration-700">
                {/* Logo & Header */}
                <div className="text-center space-y-2">
                    <Link href="/" className="inline-flex items-center gap-2 group">
                        <div className="w-10 h-10 rounded-full bg-accent flex items-center justify-center group-hover:scale-110 transition-transform">
                            <span className="text-background font-bold text-sm">M</span>
                        </div>
                        <span className="font-serif text-3xl tracking-tight text-accent">MOIJEY</span>
                    </Link>
                    <h1 className="text-2xl font-serif pt-4">Welcome Back</h1>
                    <p className="text-muted text-sm">Sign in to access your AI Co-Pilot</p>
                </div>

                {/* Login Form */}
                <div className="p-8 rounded-3xl bg-surface/30 border border-border/50 backdrop-blur-xl shadow-2xl space-y-6">
                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div className="space-y-2">
                            <label className="text-xs font-semibold uppercase tracking-widest text-muted px-1">Email Address</label>
                            <div className="relative group">
                                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted group-focus-within:text-accent transition-colors" />
                                <input
                                    type="email"
                                    required
                                    value={email}
                                    onChange={(e) => { setEmail(e.target.value); setError(""); }}
                                    placeholder="name@moijeydiamonds.com"
                                    className={`w-full bg-background/50 border rounded-2xl py-3 pl-12 pr-4 focus:outline-none focus:ring-2 transition-all ${
                                        !isDomainValid
                                            ? "border-red-500/50 focus:ring-red-500/20 focus:border-red-500/60"
                                            : "border-border/50 focus:ring-accent/20 focus:border-accent/50"
                                    }`}
                                />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <label className="text-xs font-semibold uppercase tracking-widest text-muted px-1">Password</label>
                            <div className="relative group">
                                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted group-focus-within:text-accent transition-colors" />
                                <input
                                    type="password"
                                    required
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    placeholder="••••••••"
                                    className="w-full bg-background/50 border border-border/50 rounded-2xl py-3 pl-12 pr-4 focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent/50 transition-all"
                                />
                            </div>
                        </div>

                        {error && (
                            <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs flex items-start gap-2">
                                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                                <span>{error}</span>
                            </div>
                        )}

                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full py-4 rounded-2xl bg-accent text-background font-bold hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center justify-center gap-2 group disabled:opacity-50 disabled:scale-100"
                        >
                            {loading ? (
                                <Loader2 className="w-5 h-5 animate-spin" />
                            ) : (
                                <>
                                    Enter Co-Pilot
                                    <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                                </>
                            )}
                        </button>
                    </form>

                    <div className="pt-4 text-center">
                        <p className="text-muted text-xs">
                            Forgotten your password? <span className="text-accent cursor-pointer hover:underline">Contact Administrator</span>
                        </p>
                    </div>
                </div>

                {/* Footer Security Note */}
                <div className="flex items-center justify-center gap-2 text-muted/50 text-[10px] uppercase tracking-[0.2em]">
                    <Shield className="w-3 h-3" />
                    Secure Enterprise Authentication
                </div>
            </div>
        </div>
    );
}
