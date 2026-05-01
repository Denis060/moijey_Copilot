"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import {
    Send, Loader2, Package, AlertCircle, User, Mail,
    Gem, Diamond, Sparkles, Wallet, Calendar, FileText,
    Wand2, ChevronDown, CheckCircle2, ExternalLink, Copy as CopyIcon,
} from "lucide-react";
import { toast } from "sonner";

interface RecommendationFormData {
    customerName: string;
    customerEmail: string;
    productType: string;
    budgetMin: string;
    budgetMax: string;
    diamondShape: string;
    metal: string;
    style: string;
    timeline: string;
    notes: string;
    sendEmail: boolean;
}

interface Match {
    id: string;
    title: string;
    price: number;
    image_url: string;
    diamond_shape: string;
    metal: string;
    style: string;
    shopify_url: string;
}

interface RecommendationResult {
    customerName: string;
    matches: Match[];
    internalSummary: string;
    emailDraft: string;
    emailSent: boolean;
    emailError?: string | null;
    customOrderSuggested: boolean;
}

const PRODUCT_TYPES = [
    { value: "engagement ring", label: "Engagement Ring" },
    { value: "wedding band", label: "Wedding Band" },
    { value: "bracelet", label: "Bracelet" },
    { value: "necklace", label: "Necklace" },
    { value: "pendant", label: "Pendant" },
    { value: "earrings", label: "Earrings" },
    { value: "other", label: "Other" },
];

const DIAMOND_SHAPES = [
    "round", "oval", "emerald", "cushion", "asscher",
    "marquise", "radiant", "princess", "pear", "heart",
];

const METALS = [
    { value: "white gold", label: "White Gold" },
    { value: "yellow gold", label: "Yellow Gold" },
    { value: "rose gold", label: "Rose Gold" },
    { value: "platinum", label: "Platinum" },
    { value: "sterling silver", label: "Sterling Silver" },
];

const STYLES = ["classic", "modern", "vintage", "contemporary", "halo", "solitaire", "eternity"];

const TIMELINES = [
    { value: "within 2 weeks", label: "Within 2 weeks" },
    { value: "within 1 month", label: "Within 1 month" },
    { value: "within 3 months", label: "Within 3 months" },
    { value: "flexible", label: "Flexible" },
];

export default function RecommendationMode() {
    const [formData, setFormData] = useState<RecommendationFormData>({
        customerName: "",
        customerEmail: "",
        productType: "engagement ring",
        budgetMin: "",
        budgetMax: "",
        diamondShape: "",
        metal: "",
        style: "",
        timeline: "",
        notes: "",
        sendEmail: false,
    });

    const [loading, setLoading] = useState(false);
    const [result, setResult] = useState<RecommendationResult | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [showDraft, setShowDraft] = useState(false);

    const handleInputChange = (field: keyof RecommendationFormData, value: any) => {
        setFormData(prev => ({ ...prev, [field]: value }));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError(null);

        try {
            const response = await fetch("/api/copilot/recommend", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    ...formData,
                    budgetMin: formData.budgetMin ? parseFloat(formData.budgetMin) : null,
                    budgetMax: formData.budgetMax ? parseFloat(formData.budgetMax) : null,
                }),
            });

            const data = await response.json();
            if (!response.ok) {
                setError(data.error || "Failed to generate recommendation");
                return;
            }

            setResult(data.data);
            setShowDraft(false);
        } catch (err: any) {
            setError(err.message || "An error occurred");
        } finally {
            setLoading(false);
        }
    };

    const handleSendEmail = async () => {
        if (!result) return;
        setLoading(true);
        setError(null);
        try {
            const response = await fetch("/api/copilot/recommend", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    ...formData,
                    budgetMin: formData.budgetMin ? parseFloat(formData.budgetMin) : null,
                    budgetMax: formData.budgetMax ? parseFloat(formData.budgetMax) : null,
                    sendEmail: true,
                }),
            });

            const data = await response.json();
            if (!response.ok) {
                setError(data.error || "Failed to send email");
                return;
            }

            setResult(data.data);
            if (!data.data?.emailSent && data.data?.emailError) {
                setError(`Email could not be sent: ${data.data.emailError}`);
            }
        } catch (err: any) {
            setError(err.message || "Failed to send email");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="h-full flex flex-col">
            {!result ? (
                <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto custom-scrollbar p-4 lg:p-8">
                    <div className="max-w-3xl mx-auto space-y-8 animate-in fade-in duration-500">

                        {/* Hero */}
                        <div className="space-y-3">
                            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-accent/10 border border-accent/20 text-accent text-[10px] font-bold tracking-wider uppercase">
                                <Wand2 className="w-3 h-3" />
                                Recommendation Mode
                            </div>
                            <h2 className="text-2xl lg:text-3xl font-serif text-foreground">
                                Generate a personalized selection
                            </h2>
                            <p className="text-muted text-sm">
                                Tell the co-pilot about the customer. We&apos;ll match against live inventory and
                                draft a customer-ready email — you review before it sends.
                            </p>
                        </div>

                        {/* Customer */}
                        <FormSection label="Customer" hint="Required so we can address the email properly">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                <FieldWithIcon icon={<User className="w-4 h-4" />}>
                                    <input
                                        type="text"
                                        placeholder="Customer name"
                                        value={formData.customerName}
                                        onChange={e => handleInputChange("customerName", e.target.value)}
                                        required
                                        className={inputCls}
                                    />
                                </FieldWithIcon>
                                <FieldWithIcon icon={<Mail className="w-4 h-4" />}>
                                    <input
                                        type="email"
                                        placeholder="customer@email.com"
                                        value={formData.customerEmail}
                                        onChange={e => handleInputChange("customerEmail", e.target.value)}
                                        required
                                        className={inputCls}
                                    />
                                </FieldWithIcon>
                            </div>
                        </FormSection>

                        {/* Product preferences */}
                        <FormSection label="What are they looking for?" hint="Leave fields blank if unspecified — we'll match more loosely">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                <SelectField
                                    icon={<Gem className="w-4 h-4" />}
                                    value={formData.productType}
                                    onChange={v => handleInputChange("productType", v)}
                                    label="Product type"
                                    options={PRODUCT_TYPES}
                                />
                                <SelectField
                                    icon={<Diamond className="w-4 h-4" />}
                                    value={formData.diamondShape}
                                    onChange={v => handleInputChange("diamondShape", v)}
                                    label="Diamond shape"
                                    options={DIAMOND_SHAPES.map(s => ({ value: s, label: cap(s) }))}
                                />
                                <SelectField
                                    icon={<Sparkles className="w-4 h-4" />}
                                    value={formData.metal}
                                    onChange={v => handleInputChange("metal", v)}
                                    label="Metal type"
                                    options={METALS}
                                />
                                <SelectField
                                    icon={<Sparkles className="w-4 h-4" />}
                                    value={formData.style}
                                    onChange={v => handleInputChange("style", v)}
                                    label="Style"
                                    options={STYLES.map(s => ({ value: s, label: cap(s) }))}
                                />
                            </div>
                        </FormSection>

                        {/* Budget */}
                        <FormSection label="Budget" hint="A range helps us rank the closest options first">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                <FieldWithIcon icon={<Wallet className="w-4 h-4" />} prefix="$">
                                    <input
                                        type="number"
                                        inputMode="numeric"
                                        placeholder="Minimum (optional)"
                                        value={formData.budgetMin}
                                        onChange={e => handleInputChange("budgetMin", e.target.value)}
                                        className={`${inputCls} pl-1`}
                                    />
                                </FieldWithIcon>
                                <FieldWithIcon icon={<Wallet className="w-4 h-4" />} prefix="$">
                                    <input
                                        type="number"
                                        inputMode="numeric"
                                        placeholder="Maximum (optional)"
                                        value={formData.budgetMax}
                                        onChange={e => handleInputChange("budgetMax", e.target.value)}
                                        className={`${inputCls} pl-1`}
                                    />
                                </FieldWithIcon>
                            </div>
                        </FormSection>

                        {/* Additional info */}
                        <FormSection label="Additional context" hint="Optional but improves the email's tone">
                            <div className="space-y-3">
                                <SelectField
                                    icon={<Calendar className="w-4 h-4" />}
                                    value={formData.timeline}
                                    onChange={v => handleInputChange("timeline", v)}
                                    label="Purchase timeline"
                                    options={TIMELINES}
                                />
                                <FieldWithIcon icon={<FileText className="w-4 h-4" />} alignTop>
                                    <textarea
                                        placeholder="Notes from the conversation — occasion, partner's style preferences, deal-breakers, anything else worth mentioning."
                                        value={formData.notes}
                                        onChange={e => handleInputChange("notes", e.target.value)}
                                        rows={3}
                                        className={`${inputCls} resize-none`}
                                    />
                                </FieldWithIcon>
                            </div>
                        </FormSection>

                        {error && (
                            <div className="bg-red-500/10 border border-red-500/40 rounded-2xl px-4 py-3 text-red-300 flex gap-2.5 items-start text-sm">
                                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                                <p className="wrap-break-word">{error}</p>
                            </div>
                        )}

                        {/* Submit */}
                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full bg-accent text-background font-bold py-4 rounded-2xl flex items-center justify-center gap-2 hover:scale-[1.01] active:scale-95 transition-all disabled:opacity-60 disabled:scale-100 disabled:cursor-not-allowed"
                        >
                            {loading ? (
                                <>
                                    <Loader2 className="w-5 h-5 animate-spin" />
                                    Generating recommendation...
                                </>
                            ) : (
                                <>
                                    <Wand2 className="w-5 h-5" />
                                    Generate Recommendation
                                </>
                            )}
                        </button>
                    </div>
                </form>
            ) : (
                <div className="flex-1 overflow-y-auto custom-scrollbar p-4 lg:p-8">
                    <div className="max-w-3xl mx-auto space-y-6 animate-in fade-in duration-500">

                        {/* Header */}
                        <div className="flex items-start justify-between gap-3">
                            <div>
                                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-accent/10 border border-accent/20 text-accent text-[10px] font-bold tracking-wider uppercase mb-2">
                                    <Wand2 className="w-3 h-3" />
                                    Selection
                                </div>
                                <h2 className="text-xl lg:text-2xl font-serif">
                                    For {result.customerName}
                                </h2>
                                <p className="text-xs text-muted mt-1">
                                    {result.matches.length} matching {result.matches.length === 1 ? "piece" : "pieces"} found
                                </p>
                            </div>
                            <button
                                onClick={() => setResult(null)}
                                className="px-4 py-2 rounded-xl border border-border/50 text-muted text-sm hover:border-accent/40 hover:text-accent transition-colors shrink-0"
                            >
                                New search
                            </button>
                        </div>

                        {/* Internal summary */}
                        <Card label="Internal Summary">
                            <p className="text-sm text-foreground/85 leading-relaxed">{result.internalSummary}</p>
                        </Card>

                        {/* Match list */}
                        {result.matches.length > 0 && (
                            <div className="space-y-3">
                                <p className="text-[10px] uppercase tracking-widest text-muted/70 font-bold">Top Matches</p>
                                {result.matches.slice(0, 3).map((product, idx) => (
                                    <motion.a
                                        key={product.id}
                                        href={product.shopify_url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        initial={{ opacity: 0, y: 8 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        transition={{ delay: idx * 0.06 }}
                                        className="flex gap-4 p-3 lg:p-4 rounded-2xl bg-surface/20 border border-border/50 hover:border-accent/40 hover:bg-accent/5 transition-colors group"
                                    >
                                        {product.image_url ? (
                                            // eslint-disable-next-line @next/next/no-img-element
                                            <img
                                                src={product.image_url}
                                                alt={product.title}
                                                className="w-20 h-20 lg:w-24 lg:h-24 rounded-xl object-cover bg-surface/40 shrink-0"
                                                onError={e => { (e.target as HTMLImageElement).style.display = "none"; }}
                                            />
                                        ) : (
                                            <div className="w-20 h-20 lg:w-24 lg:h-24 rounded-xl bg-surface/40 flex items-center justify-center shrink-0">
                                                <Package className="w-5 h-5 text-muted" />
                                            </div>
                                        )}
                                        <div className="flex-1 min-w-0 flex flex-col justify-center">
                                            <h4 className="font-medium text-foreground text-sm leading-snug line-clamp-2 group-hover:text-accent transition-colors">{product.title}</h4>
                                            <p className="text-accent font-serif text-base mt-1">${product.price.toLocaleString()}</p>
                                            <p className="text-[11px] text-muted mt-0.5 truncate">
                                                {[product.diamond_shape, product.metal, product.style].filter(Boolean).join(" · ") || "—"}
                                            </p>
                                        </div>
                                        <span className="self-center hidden sm:flex items-center gap-1.5 px-3 py-2 rounded-xl border border-accent/30 text-accent text-xs font-semibold group-hover:bg-accent group-hover:text-background transition-colors shrink-0">
                                            View
                                            <ExternalLink className="w-3 h-3" />
                                        </span>
                                    </motion.a>
                                ))}
                            </div>
                        )}

                        {/* Custom order suggestion */}
                        {result.customOrderSuggested && (
                            <div className="rounded-2xl bg-blue-500/5 border border-blue-500/30 px-4 py-3 flex gap-3">
                                <Package className="w-5 h-5 text-blue-400 shrink-0 mt-0.5" />
                                <div className="text-sm">
                                    <p className="font-semibold text-foreground">No exact matches found</p>
                                    <p className="text-muted text-[13px] mt-0.5 leading-relaxed">
                                        Consider a custom-design pitch — our team can create a bespoke piece for this customer.
                                    </p>
                                </div>
                            </div>
                        )}

                        {/* Email draft */}
                        <div className="space-y-2">
                            <button
                                type="button"
                                onClick={() => setShowDraft(!showDraft)}
                                className="text-accent text-sm font-semibold flex items-center gap-2 hover:text-accent/80 transition-colors"
                            >
                                <ChevronDown className={`w-4 h-4 transition-transform ${showDraft ? "" : "-rotate-90"}`} />
                                {showDraft ? "Hide email draft" : "View email draft"}
                            </button>
                            {showDraft && (
                                <div className="rounded-2xl bg-surface/20 border border-border/50 p-4">
                                    <pre className="text-[13px] text-foreground/85 whitespace-pre-wrap font-sans leading-relaxed">{result.emailDraft}</pre>
                                </div>
                            )}
                        </div>

                        {error && (
                            <div className="bg-red-500/10 border border-red-500/40 rounded-2xl px-4 py-3 text-red-300 flex gap-2.5 items-start text-sm">
                                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                                <p className="wrap-break-word">{error}</p>
                            </div>
                        )}

                        {/* Send actions */}
                        {!result.emailSent ? (
                            <div className="flex gap-3">
                                <button
                                    onClick={handleSendEmail}
                                    disabled={loading || result.matches.length === 0}
                                    className="flex-1 bg-accent text-background font-bold py-3.5 rounded-2xl flex items-center justify-center gap-2 hover:scale-[1.01] active:scale-95 transition-all disabled:opacity-50 disabled:scale-100 disabled:cursor-not-allowed"
                                >
                                    {loading ? (
                                        <>
                                            <Loader2 className="w-5 h-5 animate-spin" />
                                            Sending...
                                        </>
                                    ) : (
                                        <>
                                            <Send className="w-5 h-5" />
                                            Send Email to Customer
                                        </>
                                    )}
                                </button>
                                <button
                                    onClick={() => {
                                        navigator.clipboard.writeText(result.emailDraft);
                                        toast.success("Email draft copied to clipboard");
                                    }}
                                    className="px-4 py-3.5 rounded-2xl border border-border/50 text-muted hover:border-accent/40 hover:text-accent transition-colors flex items-center gap-2 text-sm font-semibold"
                                >
                                    <CopyIcon className="w-4 h-4" />
                                    Copy
                                </button>
                            </div>
                        ) : (
                            <div className="rounded-2xl bg-green-500/10 border border-green-500/40 px-4 py-4 text-green-300 text-center font-semibold flex items-center justify-center gap-2">
                                <CheckCircle2 className="w-5 h-5" />
                                Email sent to {result.customerName}
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}

// ── Reusable form bits ────────────────────────────────────────────────────────

const inputCls = "w-full bg-transparent border-none focus:outline-none text-sm text-foreground placeholder:text-muted/50 py-1";

function FormSection({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
    return (
        <div className="space-y-3">
            <div>
                <p className="text-[10px] uppercase tracking-widest text-muted/70 font-bold">{label}</p>
                {hint && <p className="text-[11px] text-muted/60 mt-0.5">{hint}</p>}
            </div>
            {children}
        </div>
    );
}

function FieldWithIcon({
    icon, prefix, alignTop, children,
}: { icon: React.ReactNode; prefix?: string; alignTop?: boolean; children: React.ReactNode }) {
    return (
        <div className={`flex ${alignTop ? "items-start" : "items-center"} gap-2.5 px-3 py-2.5 bg-surface/20 border border-border/50 rounded-xl focus-within:border-accent/50 focus-within:bg-surface/30 transition-colors`}>
            <span className={`text-muted/60 ${alignTop ? "mt-1" : ""}`}>{icon}</span>
            {prefix && <span className="text-muted/80 text-sm select-none">{prefix}</span>}
            <div className="flex-1 min-w-0">{children}</div>
        </div>
    );
}

function SelectField({
    icon, value, onChange, label, options,
}: {
    icon: React.ReactNode;
    value: string;
    onChange: (v: string) => void;
    label: string;
    options: { value: string; label: string }[];
}) {
    return (
        <div className="relative flex items-center gap-2.5 px-3 py-2.5 bg-surface/20 border border-border/50 rounded-xl focus-within:border-accent/50 focus-within:bg-surface/30 transition-colors">
            <span className="text-muted/60">{icon}</span>
            <select
                value={value}
                onChange={e => onChange(e.target.value)}
                className="appearance-none bg-transparent border-none focus:outline-none text-sm text-foreground flex-1 pr-6 cursor-pointer"
            >
                <option value="">{label}</option>
                {options.map(opt => (
                    <option key={opt.value} value={opt.value} className="bg-background">{opt.label}</option>
                ))}
            </select>
            <ChevronDown className="w-4 h-4 text-muted/50 pointer-events-none absolute right-3" />
        </div>
    );
}

function Card({ label, children }: { label: string; children: React.ReactNode }) {
    return (
        <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-2xl bg-surface/20 border border-border/50 p-4 lg:p-5 space-y-2"
        >
            <p className="text-[10px] uppercase tracking-widest text-muted/70 font-bold">{label}</p>
            {children}
        </motion.div>
    );
}

function cap(s: string): string {
    return s.charAt(0).toUpperCase() + s.slice(1);
}
