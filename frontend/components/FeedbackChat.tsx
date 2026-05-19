"use client";

import { useEffect, useRef, useState } from "react";
import { Send, Bot, User, Loader2 } from "lucide-react";
import clsx from "clsx";

const API = process.env.NEXT_PUBLIC_API_URL;

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  isStreaming?: boolean;
}

interface Props {
  sessionId: string;
  onCampaignsUpdated: (rawText: string) => void;
}

export default function FeedbackChat({ sessionId, onCampaignsUpdated }: Props) {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      role: "assistant",
      content:
        "Campaign plan is ready! Give me any feedback and I'll revise the copy. For example:\n• "Make the subject lines shorter"\n• "Add more urgency to email 2 for F&B"\n• "Change the CTA to ask for a 10-min call"",
    },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const send = async () => {
    const msg = input.trim();
    if (!msg || loading) return;
    setInput("");
    setLoading(true);

    setMessages((prev) => [...prev, { role: "user", content: msg }]);
    setMessages((prev) => [
      ...prev,
      { role: "assistant", content: "", isStreaming: true },
    ]);

    try {
      const res = await fetch(`${API}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ session_id: sessionId, message: msg }),
      });

      if (!res.ok || !res.body) throw new Error("Request failed");

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let fullText = "";

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
              fullText += evt.content;
              setMessages((prev) => {
                const updated = [...prev];
                updated[updated.length - 1] = {
                  role: "assistant",
                  content: fullText,
                  isStreaming: true,
                };
                return updated;
              });
            }
          } catch {}
        }
      }

      // Mark streaming done
      setMessages((prev) => {
        const updated = [...prev];
        updated[updated.length - 1] = {
          role: "assistant",
          content: fullText,
          isStreaming: false,
        };
        return updated;
      });

      // Let the parent try to parse updated campaigns from the response
      onCampaignsUpdated(fullText);
    } catch (e: any) {
      setMessages((prev) => {
        const updated = [...prev];
        updated[updated.length - 1] = {
          role: "assistant",
          content: "Sorry, something went wrong. Please try again.",
          isStreaming: false,
        };
        return updated;
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-4 py-3 border-b border-slate-100 flex items-center gap-2">
        <Bot className="w-4 h-4 text-flapkap-green" />
        <span className="text-sm font-semibold text-flapkap-dark">Feedback Chat</span>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4 scrollbar-thin">
        {messages.map((m, i) => (
          <div
            key={i}
            className={clsx(
              "flex gap-2",
              m.role === "user" ? "flex-row-reverse" : "flex-row"
            )}
          >
            <div
              className={clsx(
                "w-7 h-7 rounded-full flex items-center justify-center shrink-0 mt-0.5",
                m.role === "user"
                  ? "bg-flapkap-dark text-white"
                  : "bg-flapkap-green text-white"
              )}
            >
              {m.role === "user" ? (
                <User className="w-3.5 h-3.5" />
              ) : (
                <Bot className="w-3.5 h-3.5" />
              )}
            </div>
            <div
              className={clsx(
                "rounded-2xl px-3 py-2 text-sm max-w-[85%] leading-relaxed",
                m.role === "user"
                  ? "bg-flapkap-dark text-white rounded-tr-sm"
                  : "bg-white border border-slate-100 text-slate-700 rounded-tl-sm"
              )}
            >
              <pre className="whitespace-pre-wrap font-sans">{m.content}</pre>
              {m.isStreaming && (
                <span className="inline-flex gap-0.5 ml-1 align-middle">
                  <span className="w-1 h-1 rounded-full bg-current typing-dot" />
                  <span className="w-1 h-1 rounded-full bg-current typing-dot" />
                  <span className="w-1 h-1 rounded-full bg-current typing-dot" />
                </span>
              )}
            </div>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="px-4 py-3 border-t border-slate-100">
        <div className="flex gap-2">
          <input
            className="flex-1 text-sm border border-slate-200 rounded-xl px-3 py-2 outline-none focus:border-flapkap-green transition-colors placeholder:text-slate-300"
            placeholder="Give feedback on the copy…"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && send()}
            disabled={loading}
          />
          <button
            onClick={send}
            disabled={loading || !input.trim()}
            className="w-9 h-9 rounded-xl bg-flapkap-green flex items-center justify-center disabled:opacity-40 hover:opacity-90 transition-opacity"
          >
            {loading ? (
              <Loader2 className="w-4 h-4 text-white animate-spin" />
            ) : (
              <Send className="w-4 h-4 text-white" />
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
