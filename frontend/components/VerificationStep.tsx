"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, AlertTriangle, XCircle, Loader2, ChevronDown, ChevronUp } from "lucide-react";
import clsx from "clsx";

const API = process.env.NEXT_PUBLIC_API_URL;

export interface VerifyResult {
  email: string;
  result: string;
  quality: "valid" | "risky" | "invalid";
  free?: boolean;
  role?: boolean;
  disposable?: boolean;
  error?: string;
}

interface Summary {
  valid: number;
  risky: number;
  invalid: number;
}

interface Props {
  emails: string[];
  onDone: (results: VerifyResult[], includeRisky: boolean) => void;
}

const QUALITY_META = {
  valid:   { icon: CheckCircle2, color: "text-emerald-600", bg: "bg-emerald-50", border: "border-emerald-200", label: "Valid" },
  risky:   { icon: AlertTriangle, color: "text-amber-500",  bg: "bg-amber-50",   border: "border-amber-200",  label: "Risky" },
  invalid: { icon: XCircle,       color: "text-red-500",    bg: "bg-red-50",     border: "border-red-200",    label: "Invalid" },
};

export default function VerificationStep({ emails, onDone }: Props) {
  const [results, setResults] = useState<VerifyResult[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [includeRisky, setIncludeRisky] = useState(true);
  const [showDetails, setShowDetails] = useState(false);

  useEffect(() => {
    async function run() {
      try {
        const res = await fetch(`${API}/verify-emails`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ emails }),
        });
        if (!res.ok) throw new Error(`Server error ${res.status}`);
        const data = await res.json();
        setResults(data.results);
        setSummary(data.summary);
      } catch (e: any) {
        setError(e.message ?? "Verification failed");
      } finally {
        setLoading(false);
      }
    }
    run();
  }, [emails]);

  const validCount = summary?.valid ?? 0;
  const riskyCount = summary?.risky ?? 0;
  const invalidCount = summary?.invalid ?? 0;
  const proceedCount = validCount + (includeRisky ? riskyCount : 0);

  const grouped = {
    valid:   results.filter((r) => r.quality === "valid"),
    risky:   results.filter((r) => r.quality === "risky"),
    invalid: results.filter((r) => r.quality === "invalid"),
  };

  return (
    <div className="min-h-[calc(100vh-49px)] bg-flapkap-light flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-xl">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-flapkap-dark">Email Verification</h1>
          <p className="text-slate-500 mt-1 text-sm">
            Checking {emails.length} email{emails.length !== 1 ? "s" : ""} with Millionverifier
          </p>
        </div>

        {/* Loading */}
        {loading && (
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-10 flex flex-col items-center gap-4">
            <Loader2 className="w-8 h-8 text-flapkap-green animate-spin" />
            <p className="text-sm text-slate-500">Verifying emails…</p>
            <p className="text-xs text-slate-400">This may take a few seconds</p>
          </div>
        )}

        {/* Error */}
        {!loading && error && (
          <div className="bg-white rounded-2xl border border-red-100 shadow-sm p-8 text-center">
            <XCircle className="w-8 h-8 text-red-400 mx-auto mb-3" />
            <p className="text-sm text-red-600 font-medium mb-1">Verification failed</p>
            <p className="text-xs text-slate-400 mb-6">{error}</p>
            <button
              onClick={() => onDone([], true)}
              className="px-6 py-2.5 rounded-xl bg-flapkap-green text-white text-sm font-semibold hover:opacity-90"
            >
              Skip & Continue
            </button>
          </div>
        )}

        {/* Results */}
        {!loading && !error && summary && (
          <div className="space-y-4">
            {/* Summary cards */}
            <div className="grid grid-cols-3 gap-3">
              {(["valid", "risky", "invalid"] as const).map((q) => {
                const meta = QUALITY_META[q];
                const count = summary[q];
                const Icon = meta.icon;
                return (
                  <div
                    key={q}
                    className={clsx(
                      "rounded-2xl border p-4 flex flex-col items-center gap-2",
                      meta.bg, meta.border
                    )}
                  >
                    <Icon className={clsx("w-5 h-5", meta.color)} />
                    <span className={clsx("text-2xl font-bold", meta.color)}>{count}</span>
                    <span className={clsx("text-xs font-medium", meta.color)}>{meta.label}</span>
                  </div>
                );
              })}
            </div>

            {/* Risky toggle */}
            {riskyCount > 0 && (
              <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-flapkap-dark">
                    Include {riskyCount} risky email{riskyCount !== 1 ? "s" : ""}?
                  </p>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Catch-all & unknown — may or may not be deliverable
                  </p>
                </div>
                <button
                  onClick={() => setIncludeRisky((v) => !v)}
                  className={clsx(
                    "w-11 h-6 rounded-full transition-colors relative",
                    includeRisky ? "bg-flapkap-green" : "bg-slate-200"
                  )}
                >
                  <span
                    className={clsx(
                      "absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-transform",
                      includeRisky ? "translate-x-6" : "translate-x-1"
                    )}
                  />
                </button>
              </div>
            )}

            {/* Collapsible details */}
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
              <button
                onClick={() => setShowDetails((v) => !v)}
                className="w-full flex items-center justify-between px-5 py-3.5 hover:bg-slate-50 transition-colors text-left"
              >
                <span className="text-sm font-medium text-flapkap-dark">View details</span>
                {showDetails
                  ? <ChevronUp className="w-4 h-4 text-slate-400" />
                  : <ChevronDown className="w-4 h-4 text-slate-400" />
                }
              </button>
              {showDetails && (
                <div className="border-t border-slate-100 divide-y divide-slate-50 max-h-72 overflow-y-auto scrollbar-thin">
                  {(["invalid", "risky", "valid"] as const).map((q) =>
                    grouped[q].map((r) => {
                      const meta = QUALITY_META[q];
                      const Icon = meta.icon;
                      return (
                        <div key={r.email} className="flex items-center gap-3 px-5 py-2.5">
                          <Icon className={clsx("w-3.5 h-3.5 shrink-0", meta.color)} />
                          <span className="text-xs text-slate-600 font-mono flex-1 truncate">{r.email}</span>
                          <div className="flex gap-1 shrink-0">
                            {r.disposable && <span className="text-xs bg-red-50 text-red-400 px-1.5 py-0.5 rounded">disposable</span>}
                            {r.role && <span className="text-xs bg-slate-100 text-slate-400 px-1.5 py-0.5 rounded">role</span>}
                            {r.free && <span className="text-xs bg-slate-100 text-slate-400 px-1.5 py-0.5 rounded">free</span>}
                          </div>
                          <span className={clsx("text-xs font-medium shrink-0", meta.color)}>{r.result}</span>
                        </div>
                      );
                    })
                  )}
                </div>
              )}
            </div>

            {/* Proceed button */}
            <button
              onClick={() => onDone(results, includeRisky)}
              className="w-full py-3 rounded-2xl bg-flapkap-green text-white font-semibold text-sm hover:opacity-90 transition-opacity shadow-sm"
            >
              Generate Campaign Plan ({proceedCount} lead{proceedCount !== 1 ? "s" : ""})
            </button>

            {invalidCount > 0 && (
              <p className="text-center text-xs text-slate-400">
                {invalidCount} invalid email{invalidCount !== 1 ? "s" : ""} will be automatically excluded
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
