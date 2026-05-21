"use client";

import { useEffect, useState } from "react";
import clsx from "clsx";

const API = process.env.NEXT_PUBLIC_API_URL;

interface Bdr {
  id: string;
  name: string;
  email: string;
}

interface Props {
  onSelected: (name: string) => void;
}

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export default function BdrSelector({ onSelected }: Props) {
  const [bdrs, setBdrs] = useState<Bdr[]>([]);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [selected, setSelected] = useState<string>("");
  const [manualName, setManualName] = useState("");

  useEffect(() => {
    async function fetchBdrs() {
      try {
        const res = await fetch(`${API}/bdr-list`);
        if (!res.ok) throw new Error("fetch failed");
        const data = await res.json();
        const list: Bdr[] = data.bdrs ?? [];
        if (list.length === 0) {
          setFailed(true);
        } else {
          setBdrs(list);
        }
      } catch {
        setFailed(true);
      } finally {
        setLoading(false);
      }
    }
    fetchBdrs();
  }, []);

  const effectiveName = failed ? manualName : selected;
  const canContinue = effectiveName.trim().length > 0;

  return (
    <div className="min-h-[calc(100vh-49px)] bg-flapkap-light flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-2xl">
        {/* Title */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-flapkap-dark">Who are you?</h1>
          <p className="text-slate-500 mt-2 text-sm">Select your name to continue</p>
        </div>

        {/* Loading */}
        {loading && (
          <div className="flex justify-center items-center py-16">
            <div className="flex gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-flapkap-green animate-bounce [animation-delay:0ms]" />
              <span className="w-2.5 h-2.5 rounded-full bg-flapkap-green animate-bounce [animation-delay:150ms]" />
              <span className="w-2.5 h-2.5 rounded-full bg-flapkap-green animate-bounce [animation-delay:300ms]" />
            </div>
          </div>
        )}

        {/* BDR cards grid */}
        {!loading && !failed && (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mb-8">
            {bdrs.map((bdr) => {
              const isSelected = selected === bdr.name;
              return (
                <button
                  key={bdr.id}
                  onClick={() => setSelected(bdr.name)}
                  className={clsx(
                    "flex flex-col items-center gap-3 p-5 rounded-2xl border shadow-sm transition-all duration-150 cursor-pointer",
                    isSelected
                      ? "border-flapkap-green bg-green-50 shadow-md"
                      : "border-slate-100 bg-white hover:border-flapkap-green hover:shadow-md"
                  )}
                >
                  <div
                    className={clsx(
                      "w-14 h-14 rounded-full flex items-center justify-center text-lg font-bold transition-colors",
                      isSelected
                        ? "bg-flapkap-green text-white"
                        : "bg-slate-100 text-slate-600"
                    )}
                  >
                    {getInitials(bdr.name)}
                  </div>
                  <span
                    className={clsx(
                      "text-sm font-medium text-center leading-tight",
                      isSelected ? "text-flapkap-dark" : "text-slate-600"
                    )}
                  >
                    {bdr.name}
                  </span>
                </button>
              );
            })}
          </div>
        )}

        {/* Fallback: manual text input */}
        {!loading && failed && (
          <div className="mb-8">
            <p className="text-xs text-amber-600 text-center mb-4">
              Could not load team list. Enter your name to continue.
            </p>
            <input
              type="text"
              placeholder="Your full name"
              value={manualName}
              onChange={(e) => setManualName(e.target.value)}
              className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-flapkap-green bg-white text-flapkap-dark placeholder-slate-400"
            />
          </div>
        )}

        {/* Continue button */}
        {!loading && (
          <div className="flex justify-center">
            <button
              disabled={!canContinue}
              onClick={() => onSelected(effectiveName.trim())}
              className={clsx(
                "px-8 py-3 rounded-xl font-semibold text-sm transition-all duration-150",
                canContinue
                  ? "bg-flapkap-green text-white hover:brightness-110 shadow-sm hover:shadow-md"
                  : "bg-slate-200 text-slate-400 cursor-not-allowed"
              )}
            >
              Continue
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
