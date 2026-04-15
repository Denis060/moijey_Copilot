"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { Send, Loader2, Package, AlertCircle } from "lucide-react";

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
  customOrderSuggested: boolean;
}

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

  const handleInputChange = (
    field: keyof RecommendationFormData,
    value: any
  ) => {
    setFormData((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/copilot/recommend", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
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
    try {
      // Re-submit with sendEmail flag
      const response = await fetch("/api/copilot/recommend", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
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
      setError(null);
    } catch (err: any) {
      setError(err.message || "Failed to send email");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="h-full flex flex-col">
      {/* Form Section */}
      {!result ? (
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6">
          <div className="max-w-2xl mx-auto space-y-6">
            <div>
              <h2 className="text-2xl font-bold text-white mb-2">
                Generate Product Recommendation
              </h2>
              <p className="text-gray-400">
                Enter customer details and Moju will find the perfect matches
              </p>
            </div>

            {/* Customer Info */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-white">Customer Info</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <input
                  type="text"
                  placeholder="Customer Name"
                  value={formData.customerName}
                  onChange={(e) =>
                    handleInputChange("customerName", e.target.value)
                  }
                  className="bg-gray-800 border border-gray-700 rounded px-3 py-2 text-white placeholder-gray-500 focus:outline-none focus:border-yellow-500"
                  required
                />
                <input
                  type="email"
                  placeholder="Customer Email"
                  value={formData.customerEmail}
                  onChange={(e) =>
                    handleInputChange("customerEmail", e.target.value)
                  }
                  className="bg-gray-800 border border-gray-700 rounded px-3 py-2 text-white placeholder-gray-500 focus:outline-none focus:border-yellow-500"
                  required
                />
              </div>
            </div>

            {/* Product Preferences */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-white">
                Product Preferences
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <select
                  value={formData.productType}
                  onChange={(e) =>
                    handleInputChange("productType", e.target.value)
                  }
                  className="bg-gray-800 border border-gray-700 rounded px-3 py-2 text-white focus:outline-none focus:border-yellow-500"
                >
                  <option value="">Product Type</option>
                  <option value="engagement ring">Engagement Ring</option>
                  <option value="wedding band">Wedding Band</option>
                  <option value="bracelet">Bracelet</option>
                  <option value="necklace">Necklace</option>
                  <option value="earrings">Earrings</option>
                  <option value="other">Other</option>
                </select>

                <select
                  value={formData.diamondShape}
                  onChange={(e) =>
                    handleInputChange("diamondShape", e.target.value)
                  }
                  className="bg-gray-800 border border-gray-700 rounded px-3 py-2 text-white focus:outline-none focus:border-yellow-500"
                >
                  <option value="">Diamond Shape</option>
                  <option value="round">Round</option>
                  <option value="oval">Oval</option>
                  <option value="emerald">Emerald</option>
                  <option value="cushion">Cushion</option>
                  <option value="asscher">Asscher</option>
                  <option value="marquise">Marquise</option>
                  <option value="radiant">Radiant</option>
                </select>

                <select
                  value={formData.metal}
                  onChange={(e) => handleInputChange("metal", e.target.value)}
                  className="bg-gray-800 border border-gray-700 rounded px-3 py-2 text-white focus:outline-none focus:border-yellow-500"
                >
                  <option value="">Metal Type</option>
                  <option value="white gold">White Gold</option>
                  <option value="yellow gold">Yellow Gold</option>
                  <option value="rose gold">Rose Gold</option>
                  <option value="platinum">Platinum</option>
                </select>

                <select
                  value={formData.style}
                  onChange={(e) => handleInputChange("style", e.target.value)}
                  className="bg-gray-800 border border-gray-700 rounded px-3 py-2 text-white focus:outline-none focus:border-yellow-500"
                >
                  <option value="">Style</option>
                  <option value="classic">Classic</option>
                  <option value="modern">Modern</option>
                  <option value="vintage">Vintage</option>
                  <option value="contemporary">Contemporary</option>
                </select>
              </div>
            </div>

            {/* Budget */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-white">Budget</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <input
                  type="number"
                  placeholder="Minimum (optional)"
                  value={formData.budgetMin}
                  onChange={(e) =>
                    handleInputChange("budgetMin", e.target.value)
                  }
                  className="bg-gray-800 border border-gray-700 rounded px-3 py-2 text-white placeholder-gray-500 focus:outline-none focus:border-yellow-500"
                />
                <input
                  type="number"
                  placeholder="Maximum (optional)"
                  value={formData.budgetMax}
                  onChange={(e) =>
                    handleInputChange("budgetMax", e.target.value)
                  }
                  className="bg-gray-800 border border-gray-700 rounded px-3 py-2 text-white placeholder-gray-500 focus:outline-none focus:border-yellow-500"
                />
              </div>
            </div>

            {/* Additional Info */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-white">
                Additional Info
              </h3>
              <select
                value={formData.timeline}
                onChange={(e) => handleInputChange("timeline", e.target.value)}
                className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-white focus:outline-none focus:border-yellow-500"
              >
                <option value="">Purchase Timeline</option>
                <option value="within 2 weeks">Within 2 weeks</option>
                <option value="within 1 month">Within 1 month</option>
                <option value="within 3 months">Within 3 months</option>
                <option value="flexible">Flexible</option>
              </select>

              <textarea
                placeholder="Additional notes from conversation..."
                value={formData.notes}
                onChange={(e) => handleInputChange("notes", e.target.value)}
                className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-white placeholder-gray-500 focus:outline-none focus:border-yellow-500 h-20 resize-none"
              />
            </div>

            {error && (
              <div className="bg-red-900/30 border border-red-500 rounded px-4 py-3 text-red-200 flex gap-2">
                <AlertCircle className="w-5 h-5 flex-shrink-0" />
                <p>{error}</p>
              </div>
            )}

            {/* Submit */}
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-yellow-500 hover:bg-yellow-600 disabled:bg-gray-600 text-black font-semibold py-3 rounded flex items-center justify-center gap-2 transition"
            >
              {loading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <Send className="w-5 h-5" />
                  Generate Recommendation
                </>
              )}
            </button>
          </div>
        </form>
      ) : (
        /* Results Section */
        <div className="flex-1 overflow-y-auto p-6">
          <div className="max-w-3xl mx-auto space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-2xl font-bold text-white">
                  Recommendations for {result.customerName}
                </h2>
                <p className="text-gray-400 mt-1">
                  {result.matches.length} matching products found
                </p>
              </div>
              <button
                onClick={() => setResult(null)}
                className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded"
              >
                New Search
              </button>
            </div>

            {/* Summary */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-gray-800/50 border border-gray-700 rounded-lg p-4"
            >
              <h3 className="text-lg font-semibold text-white mb-2">
                Internal Summary
              </h3>
              <p className="text-gray-300">{result.internalSummary}</p>
            </motion.div>

            {/* Matches */}
            {result.matches.length > 0 && (
              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-white">
                  Top Matches
                </h3>
                {result.matches.slice(0, 3).map((product, idx) => (
                  <motion.div
                    key={product.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: idx * 0.1 }}
                    className="bg-gray-800/50 border border-gray-700 rounded-lg overflow-hidden hover:border-yellow-500/50 transition"
                  >
                    <div className="flex gap-4 p-4">
                      {product.image_url && (
                        <img
                          src={product.image_url}
                          alt={product.title}
                          className="w-24 h-24 object-cover rounded"
                        />
                      )}
                      <div className="flex-1">
                        <h4 className="text-white font-semibold">
                          {product.title}
                        </h4>
                        <p className="text-yellow-400 font-bold">
                          ${product.price.toLocaleString()}
                        </p>
                        <div className="text-xs text-gray-400 mt-2 space-y-1">
                          <p>
                            {product.diamond_shape && `${product.diamond_shape} `}
                            {product.metal && `${product.metal} `}
                            {product.style && `${product.style}`}
                          </p>
                        </div>
                      </div>
                      <a
                        href={product.shopify_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="px-3 py-2 bg-yellow-500 hover:bg-yellow-600 text-black rounded text-sm font-semibold h-fit"
                      >
                        View
                      </a>
                    </div>
                  </motion.div>
                ))}
              </div>
            )}

            {/* Custom Order Suggestion */}
            {result.customOrderSuggested && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-blue-900/30 border border-blue-500 rounded-lg p-4 flex gap-3"
              >
                <Package className="w-5 h-5 text-blue-400 flex-shrink-0" />
                <div>
                  <h4 className="text-white font-semibold">
                    No exact matches found
                  </h4>
                  <p className="text-gray-300 text-sm mt-1">
                    Consider offering a custom design service to this customer.
                    Our team can create a bespoke piece that matches their
                    preferences perfectly.
                  </p>
                </div>
              </motion.div>
            )}

            {/* Email Draft */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-3"
            >
              <button
                onClick={() => setShowDraft(!showDraft)}
                className="text-yellow-400 hover:text-yellow-300 font-semibold flex items-center gap-2"
              >
                {showDraft ? "▼" : "▶"} View Email Draft
              </button>

              {showDraft && (
                <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-4">
                  <div className="bg-gray-900 rounded p-4 text-gray-300 whitespace-pre-wrap text-sm font-mono">
                    {result.emailDraft}
                  </div>
                </div>
              )}
            </motion.div>

            {/* Send Email */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex gap-4"
            >
              {!result.emailSent ? (
                <>
                  <button
                    onClick={handleSendEmail}
                    disabled={loading || result.matches.length === 0}
                    className="flex-1 bg-yellow-500 hover:bg-yellow-600 disabled:bg-gray-600 text-black font-semibold py-3 rounded flex items-center justify-center gap-2 transition"
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
                      // Copy draft to clipboard
                      navigator.clipboard.writeText(result.emailDraft);
                      alert("Email draft copied to clipboard!");
                    }}
                    className="px-4 py-3 bg-gray-700 hover:bg-gray-600 text-white rounded font-semibold"
                  >
                    Copy Draft
                  </button>
                </>
              ) : (
                <div className="w-full bg-green-900/30 border border-green-500 rounded px-4 py-3 text-green-200 text-center font-semibold">
                  ✓ Email sent successfully!
                </div>
              )}
            </motion.div>
          </div>
        </div>
      )}
    </div>
  );
}
