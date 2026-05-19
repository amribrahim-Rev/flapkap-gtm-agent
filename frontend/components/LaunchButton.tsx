"use client";

import { useState } from "react";
import { Rocket, Loader2, CheckCircle2, AlertCircle } from "lucide-react";
import clsx from "clsx";

const API = process.env.NEXT_PUBLIC_API_URL;

type LaunchState = "idle" | "launching" | "success" | "error";

interface Props {
  sessionId: string;
  disabled?: boolean;
}

export default function LaunchButton({ sessionId, disabled }: Props) {
  const [state, setState] = useState<LaunchState>("idle");
  const [log, setLog] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  const launch = async () => {
    if (state === "launching") return;
    setLog([]);
    setError(null);
    setState("launching");

    try {
      const res = await fetch(`${API}/launch`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          session_id: sessionId,
          message: "launch",
        }),
      });

      if (!res.ok || !res.body) throw new Error("Launch request failed");

      const reader = res.body.getReader();
      const decoder = new TextDecoder();

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split("\n");
        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          try {
            const evt = JSON.parse(line.slice(6));
            if (evt.type === "text") {
              setLog((prev) => [...prev, evt.content]);
            } else if (evt.type === "tool_call") {
              setLog((prev) => [...prev, `⚙️ Running: ${evt.tool}…`]);
            } else if (evt.type === "tool_result") {
              setLog((prev) => [...prev, `✅ Done: ${evt.tool}`]);
            } else if (evt.type === "tool_error") {
              setLog((prev) => [...prev, `❌ Error in ${evt.tool}: ${evt.error}`]);
            } else if (evt.type === "done") {
              setState("success");
            }
          } catch {}
        }
      }

      if (state !== "success") setState("success");
    } catch (e: any) {
      setError(e.message);
      setState("error");
    }
  };

  return (
    <div className="space-y-3">
      <button
        onClick={launch}
        disabled={disabled || state === "launching" || state === "success"}
        className={clsx(
          "w-full flex items-center justify-center gap-2 py-3 px-6 rounded-2xl font-semibold text-white transition-all",
          state === "success"
            ? "bg-emerald-500 cursor-default"
            : state === "error"
            ? "bg-red-500 hover:bg-red-600"
            : "bg-flapkap-green hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed"
        )}
      >
        {state === "launching" && <Loader2 className="w-4 h-4 animate-spin" />}
        {state === "success" && <CheckCircle2 className="w-4 h-4" />}
        {state === "error" && <AlertCircle className="w-4 h-4" />}
        {state === "idle" && <Rocket className="w-4 h-4" />}
        {state === "idle" && "Approve & Launch Campaigns"}
        {state === "launching" && "Launching…"}
        {state === "success" && "All Campaigns Live!"}
        {state === "error" && "Retry Launch"}
      </button>

      {error && (
        <p className="text-xs text-red-500 flex items-center gap-1">
          <AlertCircle className="w-3 h-3" />
          {error}
        </p>
      )}

      {log.length > 0 && (
        <div className="bg-flapkap-dark rounded-xl p-3 max-h-48 overflow-y-auto scrollbar-thin">
          {log.map((line, i) => (
            <p key={i} className="text-xs text-emerald-300 font-mono leading-relaxed">
              {line}
            </p>
          ))}
        </div>
      )}
    </div>
  );
}
