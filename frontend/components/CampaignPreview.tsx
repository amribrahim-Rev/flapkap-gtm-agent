"use client";

import { useState } from "react";
import { Mail, Users, AlertTriangle, ChevronDown, ChevronUp, Pencil, Check, X } from "lucide-react";
import clsx from "clsx";

export interface Touchpoint {
  seq_number: number;
  delay_days: number;
  subject: string;
  email_body: string;
}

export interface Campaign {
  industry: string;
  leads_count: number;
  lead_emails: string[];
  touchpoints: Touchpoint[];
  conflicts?: { email: string; owner: string }[];
}

interface Props {
  campaigns: Campaign[];
  isStreaming: boolean;
  streamingText: string;
  onUpdate?: (campaigns: Campaign[]) => void;
}

function TouchpointCard({
  tp,
  onSave,
}: {
  tp: Touchpoint;
  onSave: (updated: Touchpoint) => void;
}) {
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [draftSubject, setDraftSubject] = useState(tp.subject);
  const [draftBody, setDraftBody] = useState(tp.email_body);

  function handleSave() {
    onSave({ ...tp, subject: draftSubject, email_body: draftBody });
    setEditing(false);
  }

  function handleCancel() {
    setDraftSubject(tp.subject);
    setDraftBody(tp.email_body);
    setEditing(false);
  }

  return (
    <div className="border border-slate-100 rounded-xl overflow-hidden">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-4 py-3 bg-white hover:bg-slate-50 transition-colors text-left"
      >
        <div className="flex items-center gap-3">
          <span className="w-6 h-6 rounded-full bg-flapkap-green text-white text-xs flex items-center justify-center font-bold shrink-0">
            {tp.seq_number}
          </span>
          <div>
            <p className="text-sm font-medium text-flapkap-dark truncate max-w-xs">{tp.subject}</p>
            <p className="text-xs text-slate-400">
              {tp.seq_number === 1 ? "Day 1" : `Day +${tp.delay_days} after previous`}
            </p>
          </div>
        </div>
        {open ? (
          <ChevronUp className="w-4 h-4 text-slate-400 shrink-0" />
        ) : (
          <ChevronDown className="w-4 h-4 text-slate-400 shrink-0" />
        )}
      </button>
      {open && (
        <div className="px-4 py-4 bg-slate-50 border-t border-slate-100">
          {/* Edit toggle button */}
          {!editing && (
            <div className="flex justify-end mb-3">
              <button
                onClick={() => setEditing(true)}
                className="flex items-center gap-1 text-xs text-slate-400 hover:text-flapkap-dark transition-colors"
                title="Edit touchpoint"
              >
                <Pencil className="w-3.5 h-3.5" />
                Edit
              </button>
            </div>
          )}

          {/* View mode */}
          {!editing && (
            <>
              <p className="text-xs font-semibold text-slate-400 uppercase mb-2">Subject</p>
              <p className="text-sm font-medium text-flapkap-dark mb-4">{tp.subject}</p>
              <p className="text-xs font-semibold text-slate-400 uppercase mb-2">Body</p>
              <pre className="text-sm text-slate-700 whitespace-pre-wrap font-sans leading-relaxed">
                {tp.email_body}
              </pre>
            </>
          )}

          {/* Edit mode */}
          {editing && (
            <>
              <p className="text-xs font-semibold text-slate-400 uppercase mb-2">Subject</p>
              <input
                type="text"
                value={draftSubject}
                onChange={(e) => setDraftSubject(e.target.value)}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm text-flapkap-dark bg-white focus:outline-none focus:ring-2 focus:ring-flapkap-green mb-4"
              />
              <p className="text-xs font-semibold text-slate-400 uppercase mb-2">Body</p>
              <textarea
                rows={12}
                value={draftBody}
                onChange={(e) => setDraftBody(e.target.value)}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm text-flapkap-dark bg-white focus:outline-none focus:ring-2 focus:ring-flapkap-green font-sans leading-relaxed resize-y"
              />
              <div className="flex gap-2 mt-3 justify-end">
                <button
                  onClick={handleCancel}
                  className="flex items-center gap-1 px-3 py-1.5 rounded-lg border border-slate-200 text-xs text-slate-600 hover:bg-slate-100 transition-colors"
                >
                  <X className="w-3.5 h-3.5" />
                  Cancel
                </button>
                <button
                  onClick={handleSave}
                  className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-flapkap-green text-white text-xs font-semibold hover:brightness-110 transition-all"
                >
                  <Check className="w-3.5 h-3.5" />
                  Save changes
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

function CampaignCard({
  campaign,
  onCampaignUpdate,
}: {
  campaign: Campaign;
  onCampaignUpdate: (updated: Campaign) => void;
}) {
  const hasConflicts = (campaign.conflicts?.length ?? 0) > 0;

  function handleTouchpointSave(updated: Touchpoint) {
    const newTouchpoints = campaign.touchpoints.map((tp) =>
      tp.seq_number === updated.seq_number ? updated : tp
    );
    onCampaignUpdate({ ...campaign, touchpoints: newTouchpoints });
  }

  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
      {/* Header */}
      <div className="px-5 py-4 border-b border-slate-100 flex items-start justify-between">
        <div>
          <h3 className="font-semibold text-flapkap-dark text-base">{campaign.industry}</h3>
          <div className="flex items-center gap-3 mt-1">
            <span className="flex items-center gap-1 text-xs text-slate-400">
              <Users className="w-3 h-3" />
              {campaign.leads_count} leads
            </span>
            <span className="flex items-center gap-1 text-xs text-slate-400">
              <Mail className="w-3 h-3" />
              {campaign.touchpoints.length} touchpoints
            </span>
          </div>
        </div>
        {hasConflicts && (
          <div className="flex items-center gap-1 bg-amber-50 text-amber-600 text-xs px-2 py-1 rounded-lg">
            <AlertTriangle className="w-3 h-3" />
            {campaign.conflicts!.length} conflict{campaign.conflicts!.length > 1 ? "s" : ""}
          </div>
        )}
      </div>

      {/* Conflicts */}
      {hasConflicts && (
        <div className="px-5 py-3 bg-amber-50 border-b border-amber-100">
          <p className="text-xs font-semibold text-amber-700 mb-2">HubSpot Ownership Conflicts</p>
          <div className="space-y-1">
            {campaign.conflicts!.map((c) => (
              <p key={c.email} className="text-xs text-amber-600">
                <span className="font-mono">{c.email}</span> — owned by <strong>{c.owner}</strong>
              </p>
            ))}
          </div>
        </div>
      )}

      {/* Touchpoints */}
      <div className="px-5 py-4 space-y-2">
        {campaign.touchpoints.map((tp) => (
          <TouchpointCard
            key={tp.seq_number}
            tp={tp}
            onSave={handleTouchpointSave}
          />
        ))}
      </div>
    </div>
  );
}

export default function CampaignPreview({ campaigns, isStreaming, streamingText, onUpdate }: Props) {
  if (isStreaming && campaigns.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 px-4">
        <div className="w-full max-w-2xl bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
          <div className="flex items-center gap-2 mb-4">
            <div className="flex gap-1">
              <span className="w-2 h-2 rounded-full bg-flapkap-green typing-dot" />
              <span className="w-2 h-2 rounded-full bg-flapkap-green typing-dot" />
              <span className="w-2 h-2 rounded-full bg-flapkap-green typing-dot" />
            </div>
            <span className="text-sm text-slate-400">Agent is building your campaign plan…</span>
          </div>
          {streamingText && (
            <pre className="text-sm text-slate-600 whitespace-pre-wrap font-sans leading-relaxed max-h-64 overflow-y-auto scrollbar-thin">
              {streamingText}
            </pre>
          )}
        </div>
      </div>
    );
  }

  if (campaigns.length === 0) return null;

  function handleCampaignUpdate(updated: Campaign) {
    const newCampaigns = campaigns.map((c) =>
      c.industry === updated.industry ? updated : c
    );
    onUpdate?.(newCampaigns);
  }

  return (
    <div className="space-y-4">
      {campaigns.map((c) => (
        <CampaignCard
          key={c.industry}
          campaign={c}
          onCampaignUpdate={handleCampaignUpdate}
        />
      ))}
    </div>
  );
}
