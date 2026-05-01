"use client";

import { useState } from "react";
import { useSession } from "next-auth/react";
import { motion } from "framer-motion";
import {
    Send, Loader2, Package, AlertCircle, User, Mail,
    Gem, Diamond, Sparkles, Wallet, Calendar, FileText,
    Wand2, ChevronDown, CheckCircle2, ExternalLink, Copy as CopyIcon,
    Tag, Eye,
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
    testEmailSent?: boolean;
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
    const { data: session } = useSession();
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
    const [testLoading, setTestLoading] = useState(false);
    const [result, setResult] = useState<RecommendationResult | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [showDraft, setShowDraft] = useState(false);
    // Rep edits applied at send time. All default to "use what the AI suggested" until
    // the rep touches them.
    const [editedDraft, setEditedDraft] = useState<string | null>(null);
    const [editedSubject, setEditedSubject] = useState("");
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

    const handleInputChange = (field: keyof RecommendationFormData, value: any) => {
        setFormData(prev => ({ ...prev, [field]: value }));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError(null);

        // Cheap client-side guard so the rep gets immediate feedback instead of waiting
        // for the server to bounce them back.
        const minN = formData.budgetMin ? parseFloat(formData.budgetMin) : NaN;
        const maxN = formData.budgetMax ? parseFloat(formData.budgetMax) : NaN;
        if (Number.isFinite(minN) && Number.isFinite(maxN) && minN > maxN) {
            toast.error("Budget range invalid", { description: "Minimum can't be greater than maximum." });
            setLoading(false);
            return;
        }

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
            // Reset rep-edit state for the new result so we don't leak edits across runs.
            setEditedDraft(null);
            setEditedSubject("");
            // Default selection = top 3 matches (matches the email-builder default).
            const top3 = (data.data?.matches ?? []).slice(0, 3).map((m: Match) => m.id);
            setSelectedIds(new Set(top3));
        } catch (err: any) {
            setError(err.message || "An error occurred");
        } finally {
            setLoading(false);
        }
    };

    /**
     * Send the email. When `mode === "test"` we route the email to the rep's own inbox
     * (the server reads session.user.email) so they can preview before sending for real.
     * Test sends do NOT mark email_sent on the recommendation row.
     */
    const sendCustomerEmail = async (mode: "real" | "test", testRecipient?: string) => {
        if (!result) return;
        if (mode === "real") setLoading(true); else setTestLoading(true);
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
                    emailDraftOverride: editedDraft ?? result.emailDraft,
                    selectedProductIds: Array.from(selectedIds),
                    subjectOverride: editedSubject.trim() || undefined,
                    testRecipient: mode === "test" ? testRecipient : undefined,
                }),
            });

            const data = await response.json();
            if (!response.ok) {
                setError(data.error || "Failed to send email");
                return;
            }

            // For real sends, swap in the new result so the success state appears.
            // For test sends, keep the current result (don't flip emailSent), just toast.
            if (mode === "real") {
                setResult(data.data);
                if (!data.data?.emailSent && data.data?.emailError) {
                    setError(`Email could not be sent: ${data.data.emailError}`);
                }
            } else {
                if (data.data?.testEmailSent) {
                    toast.success("Test email sent", {
                        description: `Check ${testRecipient}. The customer will see exactly that.`,
                    });
                } else if (data.data?.emailError) {
                    setError(`Test could not be sent: ${data.data.emailError}`);
                }
            }
        } catch (err: any) {
            setError(err.message || "Failed to send email");
        } finally {
            if (mode === "real") setLoading(false); else setTestLoading(false);
        }
    };

    const handleSendEmail = () => sendCustomerEmail("real");
    const handleSendTest = () => {
        if (!session?.user?.email) {
            toast.error("Can't send test", { description: "Your session email isn't available." });
            return;
        }
        sendCustomerEmail("test", session.user.email);
    };

    /** Toggle whether a product is included in the email cards. */
    const toggleProductSelection = (id: string) => {
        setSelectedIds(prev => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    };

    return (
        // flex-1 + min-h-0 instead of h-full so this fills the remaining vertical
        // space inside <main>'s flex column. With h-full the outer div had no
        // bounded height and the sticky footer collapsed off-screen.
        <div className="flex-1 flex flex-col min-h-0">
            {!result ? (
                // Form column splits into a scrollable body + a sticky CTA footer below,
                // so the "Generate" button is always visible without the rep scrolling
                // hunting for it.
                <form onSubmit={handleSubmit} className="flex-1 flex flex-col min-h-0">
                    <div className="flex-1 overflow-y-auto custom-scrollbar p-4 lg:p-8">
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
                        <FormSection
                            label={<>Customer <RequiredMark /></>}
                            hint="Required so we can address the email properly"
                        >
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                <FieldWithIcon icon={<User className="w-4 h-4" />}>
                                    <input
                                        type="text"
                                        placeholder="Customer name *"
                                        value={formData.customerName}
                                        onChange={e => handleInputChange("customerName", e.target.value)}
                                        required
                                        className={inputCls}
                                    />
                                </FieldWithIcon>
                                <FieldWithIcon icon={<Mail className="w-4 h-4" />}>
                                    <input
                                        type="email"
                                        placeholder="customer@email.com *"
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
                        </div>
                    </div>

                    {/* Sticky CTA footer — always in view, never hunting for it. */}
                    <div className="border-t border-border/40 bg-background/90 backdrop-blur-md p-4 lg:px-8 lg:py-5 shrink-0">
                        <div className="max-w-3xl mx-auto">
                            <button
                                type="submit"
                                disabled={loading}
                                className="w-full bg-accent text-background font-bold py-4 rounded-2xl flex items-center justify-center gap-2 hover:scale-[1.01] active:scale-95 transition-all disabled:opacity-60 disabled:scale-100 disabled:cursor-not-allowed shadow-lg shadow-accent/20"
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

                        {/* Match list — each card has a checkbox so the rep can curate which
                            products actually go in the email. The "View" link still opens Shopify
                            in a new tab, while clicking anywhere else on the card row toggles selection. */}
                        {result.matches.length > 0 && (
                            <div className="space-y-3">
                                <div className="flex items-baseline justify-between gap-3">
                                    <p className="text-[10px] uppercase tracking-widest text-muted/70 font-bold">Top Matches</p>
                                    <p className="text-[10px] text-muted">
                                        <span className="text-foreground font-semibold">{selectedIds.size}</span> selected for email
                                    </p>
                                </div>
                                {result.matches.slice(0, 3).map((product, idx) => {
                                    const checked = selectedIds.has(product.id);
                                    return (
                                        <motion.label
                                            key={product.id}
                                            initial={{ opacity: 0, y: 8 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            transition={{ delay: idx * 0.06 }}
                                            className={`flex gap-4 p-3 lg:p-4 rounded-2xl bg-surface/20 border transition-colors group cursor-pointer ${
                                                checked
                                                    ? "border-accent/50 bg-accent/5"
                                                    : "border-border/50 hover:border-accent/40 opacity-60 hover:opacity-100"
                                            }`}
                                        >
                                            <input
                                                type="checkbox"
                                                checked={checked}
                                                onChange={() => toggleProductSelection(product.id)}
                                                className="self-center w-4 h-4 accent-accent shrink-0"
                                            />
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
                                                <h4 className="font-medium text-foreground text-sm leading-snug line-clamp-2">{product.title}</h4>
                                                <p className="text-accent font-serif text-base mt-1">${product.price.toLocaleString()}</p>
                                                <p className="text-[11px] text-muted mt-0.5 truncate">
                                                    {[product.diamond_shape, product.metal, product.style].filter(Boolean).join(" · ") || "—"}
                                                </p>
                                            </div>
                                            <a
                                                href={product.shopify_url}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                onClick={e => e.stopPropagation()}
                                                className="self-center hidden sm:flex items-center gap-1.5 px-3 py-2 rounded-xl border border-accent/30 text-accent text-xs font-semibold hover:bg-accent hover:text-background transition-colors shrink-0"
                                            >
                                                View
                                                <ExternalLink className="w-3 h-3" />
                                            </a>
                                        </motion.label>
                                    );
                                })}
                                <p className="text-[11px] text-muted/70 italic px-1">
                                    Tip: uncheck any pieces you don&apos;t want in the email. The rep often knows the standout — one strong recommendation lands better than three competing options.
                                </p>
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

                        {/* Email subject + draft — both editable. Rep can tweak before
                            sending; send-time falls back to AI defaults if rep hasn't touched them. */}
                        <div className="space-y-2">
                            <div className="flex items-center justify-between gap-3">
                                <button
                                    type="button"
                                    onClick={() => setShowDraft(!showDraft)}
                                    className="text-accent text-sm font-semibold flex items-center gap-2 hover:text-accent/80 transition-colors"
                                >
                                    <ChevronDown className={`w-4 h-4 transition-transform ${showDraft ? "" : "-rotate-90"}`} />
                                    {showDraft ? "Hide email draft" : "View / edit email draft"}
                                </button>
                                {showDraft && (
                                    (editedDraft !== null && editedDraft !== result.emailDraft) || editedSubject.trim().length > 0
                                ) && (
                                    <button
                                        type="button"
                                        onClick={() => { setEditedDraft(null); setEditedSubject(""); }}
                                        className="text-[11px] text-muted hover:text-accent underline underline-offset-2"
                                        title="Discard your edits and use the AI's original draft + default subject"
                                    >
                                        Reset to original
                                    </button>
                                )}
                            </div>
                            {showDraft && (
                                <div className="rounded-2xl bg-surface/20 border border-border/50 p-3 space-y-3">
                                    <div className="flex items-center gap-2.5 px-3 py-2.5 bg-background/40 border border-border/40 rounded-xl focus-within:border-accent/50 transition-colors">
                                        <Tag className="w-4 h-4 text-muted/60 shrink-0" />
                                        <input
                                            type="text"
                                            value={editedSubject}
                                            onChange={e => setEditedSubject(e.target.value)}
                                            placeholder="Your Personalized Jewelry Recommendations from Moijey"
                                            className="w-full bg-transparent border-none focus:outline-none text-sm text-foreground placeholder:text-muted/50"
                                        />
                                    </div>
                                    <textarea
                                        value={editedDraft ?? result.emailDraft}
                                        onChange={e => setEditedDraft(e.target.value)}
                                        rows={Math.min(14, Math.max(6, (editedDraft ?? result.emailDraft).split("\n").length + 1))}
                                        className="w-full bg-background/40 border border-border/40 rounded-xl px-4 py-3 text-[13px] text-foreground/90 leading-relaxed font-sans focus:outline-none focus:border-accent/50 resize-y"
                                    />
                                    <p className="text-[11px] text-muted/70 italic px-1">
                                        Edit anything you&apos;d like — your version is what the customer receives. The greeting and signature are added automatically.
                                    </p>
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
                            <div className="flex flex-col sm:flex-row gap-3">
                                <button
                                    onClick={handleSendEmail}
                                    disabled={loading || testLoading || selectedIds.size === 0}
                                    title={selectedIds.size === 0 ? "Select at least one product to send" : ""}
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
                                            {selectedIds.size === 1
                                                ? "Send Email (1 piece)"
                                                : selectedIds.size > 1
                                                    ? `Send Email (${selectedIds.size} pieces)`
                                                    : "Send Email to Customer"}
                                        </>
                                    )}
                                </button>
                                {/* Sends to the rep's own inbox first as a preview. Doesn't mark
                                    the recommendation as sent. Andy: review-before-send safety net. */}
                                <button
                                    onClick={handleSendTest}
                                    disabled={loading || testLoading || selectedIds.size === 0}
                                    title="Send a copy to your own email so you can review what the customer will see"
                                    className="px-4 py-3.5 rounded-2xl border border-border/50 text-muted hover:border-accent/40 hover:text-accent transition-colors flex items-center justify-center gap-2 text-sm font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    {testLoading ? (
                                        <>
                                            <Loader2 className="w-4 h-4 animate-spin" />
                                            Testing...
                                        </>
                                    ) : (
                                        <>
                                            <Eye className="w-4 h-4" />
                                            Test → me
                                        </>
                                    )}
                                </button>
                                <button
                                    onClick={() => {
                                        navigator.clipboard.writeText(editedDraft ?? result.emailDraft);
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

function RequiredMark() {
    return <span className="text-red-400/80 ml-0.5" aria-label="required">*</span>;
}

function FormSection({ label, hint, children }: { label: React.ReactNode; hint?: string; children: React.ReactNode }) {
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
