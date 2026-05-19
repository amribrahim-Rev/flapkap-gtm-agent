"use client";

import { useState, useCallback } from "react";
import { RefreshCw, LayoutGrid } from "lucide-react";
import SheetUpload from "@/components/SheetUpload";
import CampaignPreview, { Campaign } from "@/components/CampaignPreview";
import FeedbackChat from "@/components/FeedbackChat";
import LaunchButton from "@/components/LaunchButton";

const API = process.env.NEXT_PUBLIC_API_URL;

type AppState = "upload" | "generating" | "preview";

interface UploadResult {
  session_id: string;
  total_leads: number;
  industry_groups: Record<string, any[]>;
  leads_summary: { industry: string; count: number }[];
}

function parseCampaigns(text: string, industryGroups: Record<string, any[]>): Campaign[] {
  // Try to extract JSON campaign plan from agent response
  const jsonMatch = text.match(/```json\s*([\s\S]*?)\s*```/);
  if (jsonMatch) {
    try {
      const parsed = JSON.parse(jsonMatch[1]);
      if (Array.isArray(parsed)) return parsed;
      if (parsed.campaigns) return parsed.campaigns;
    } catch {}
  }

  // Fallback: try bare JSON array
  const arrayMatch = text.match(/\[\s*\{[\s\S]*\}\s*\]/);
  if (arrayMatch) {
    try {
      const parsed = JSON.parse(arrayMatch[0]);
      if (Array.isArray(parsed)) return parsed;
    } catch {}
  }

  return [];
}

export default function Home() {
  const [appState, setAppState] = useState<AppState>("upload");
  const [uploadResult, setUploadResult] = useState<UploadResult | null>(null);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [streamingText, setStreamingText] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);

  const handleUploaded = useCallback(async (result: UploadResult) => {
    setUploadResult(result);
    setAppState("generating");
    setIsStreaming(true);
    setStreamingText("");
    setCampaigns([]);

    // Build prompt with the leads data
    const leadsJson = JSON.stringify(result.industry_groups, null, 2);
    const prompt =
      `I've uploaded a leads sheet with ${result.total_leads} leads across ${result.leads_summary.length} industries:\n` +
      result.leads_summary.map((s) => `- ${s.industry}: ${s.count} leads`).join("\n") +
      `\n\nPlease:\n` +
      `1. First check HubSpot ownership for all email addresses\n` +
      `2. Then generate a complete cold email campaign plan for each industry group\n` +
      `3. Return the plan as a JSON array of campaigns with this structure:\n` +
      `[\n  {\n    "industry": "F&B",\n    "leads_count": 12,\n    "lead_emails": ["email@co.ae"],\n` +
      `    "conflicts": [{"email": "...", "owner": "BDR Name"}],\n` +
      `    "touchpoints": [\n` +
      `      {"seq_number": 1, "delay_days": 0, "subject": "...", "email_body": "..."},\n` +
      `      ...\n    ]\n  }\n]\n\n` +
      `<leads_data>\n${leadsJson}\n</leads_data>`;

    try {
      const res = await fetch(`${API}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ session_id: result.session_id, message: prompt }),
      });

      if (!res.ok || !res.body) throw new Error("Failed to generate plan");

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
              setStreamingText(fullText);
            }
          } catch {}
        }
      }

      const parsed = parseCampaigns(fullText, result.industry_groups);
      setCampaigns(parsed);
      setAppState("preview");
    } catch (e) {
      console.error(e);
      setAppState("preview");
    } finally {
      setIsStreaming(false);
    }
  }, []);

  const handleCampaignsUpdated = useCallback(
    (rawText: string) => {
      const updated = parseCampaigns(rawText, uploadResult?.industry_groups ?? {});
      if (updated.length > 0) setCampaigns(updated);
    },
    [uploadResult]
  );

  const reset = () => {
    setAppState("upload");
    setUploadResult(null);
    setCampaigns([]);
    setStreamingText("");
  };

  return (
    <div className="min-h-screen bg-flapkap-light">
      {/* Top bar */}
      <header className="bg-flapkap-dark text-white px-6 py-3 flex items-center justify-between sticky top-0 z-10">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-flapkap-green flex items-center justify-center">
            <span className="text-white font-bold text-xs">F</span>
          </div>
          <span className="font-semibold text-sm">FlapKap GTM Agent</span>
        </div>
        {appState !== "upload" && (
          <div className="flex items-center gap-4">
            {uploadResult && (
              <span className="text-xs text-slate-400">
                <LayoutGrid className="w-3.5 h-3.5 inline mr-1" />
                {uploadResult.total_leads} leads · {uploadResult.leads_summary.length} industries
              </span>
            )}
            <button
              onClick={reset}
              className="flex items-center gap-1.5 text-xs text-slate-300 hover:text-white transition-colors"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              New upload
            </button>
          </div>
        )}
      </header>

      {/* Content */}
      {appState === "upload" && <SheetUpload onUploaded={handleUploaded} />}

      {(appState === "generating" || appState === "preview") && uploadResult && (
        <div className="flex h-[calc(100vh-49px)]">
          {/* Left: Campaign Preview */}
          <div className="flex-1 overflow-y-auto p-6 scrollbar-thin">
            <div className="max-w-2xl mx-auto">
              {appState === "generating" && (
                <CampaignPreview
                  campaigns={[]}
                  isStreaming={isStreaming}
                  streamingText={streamingText}
                />
              )}
              {appState === "preview" && (
                <>
                  <div className="mb-6">
                    <h2 className="text-xl font-bold text-flapkap-dark">Campaign Plan</h2>
                    <p className="text-sm text-slate-400 mt-0.5">
                      {campaigns.length} campaign{campaigns.length !== 1 ? "s" : ""} ready
                      {campaigns.some((c) => c.conflicts?.length) &&
                        " · some leads have HubSpot conflicts"}
                    </p>
                  </div>
                  <CampaignPreview
                    campaigns={campaigns}
                    isStreaming={false}
                    streamingText=""
                  />
                  {campaigns.length > 0 && (
                    <div className="mt-6">
                      <LaunchButton sessionId={uploadResult.session_id} />
                    </div>
                  )}
                  {campaigns.length === 0 && (
                    <div className="bg-white rounded-2xl border border-slate-100 p-6 text-center">
                      <p className="text-sm text-slate-400">
                        The agent response is displayed in the chat. Use the chat to ask it to
                        format the plan or make adjustments.
                      </p>
                      <pre className="mt-4 text-xs text-slate-500 whitespace-pre-wrap font-sans text-left bg-slate-50 rounded-xl p-4 max-h-96 overflow-y-auto scrollbar-thin">
                        {streamingText}
                      </pre>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>

          {/* Right: Chat sidebar */}
          <div className="w-80 border-l border-slate-200 bg-white flex flex-col shrink-0">
            {appState === "preview" ? (
              <FeedbackChat
                sessionId={uploadResult.session_id}
                onCampaignsUpdated={handleCampaignsUpdated}
              />
            ) : (
              <div className="flex flex-col items-center justify-center h-full text-slate-300">
                <span className="text-sm">Chat available after plan is ready</span>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
