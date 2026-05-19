"use client";

import { useCallback, useState } from "react";
import { useDropzone } from "react-dropzone";
import { Upload, FileSpreadsheet, AlertCircle, Loader2 } from "lucide-react";
import clsx from "clsx";

const API = process.env.NEXT_PUBLIC_API_URL;

interface IndustrySummary {
  industry: string;
  count: number;
}

interface UploadResult {
  session_id: string;
  total_leads: number;
  industry_groups: Record<string, any[]>;
  leads_summary: IndustrySummary[];
}

interface Props {
  onUploaded: (result: UploadResult) => void;
}

export default function SheetUpload({ onUploaded }: Props) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);

  const onDrop = useCallback(
    async (acceptedFiles: File[]) => {
      if (!acceptedFiles.length) return;
      const file = acceptedFiles[0];
      setFileName(file.name);
      setError(null);
      setUploading(true);

      try {
        const form = new FormData();
        form.append("file", file);

        const res = await fetch(`${API}/upload`, { method: "POST", body: form });
        if (!res.ok) {
          const err = await res.json().catch(() => ({ detail: res.statusText }));
          throw new Error(err.detail || "Upload failed");
        }
        const data: UploadResult = await res.json();
        onUploaded(data);
      } catch (e: any) {
        setError(e.message);
      } finally {
        setUploading(false);
      }
    },
    [onUploaded]
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": [".xlsx"],
      "application/vnd.ms-excel": [".xls"],
      "text/csv": [".csv"],
    },
    maxFiles: 1,
    disabled: uploading,
  });

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] px-4">
      {/* Logo / Header */}
      <div className="mb-8 text-center">
        <div className="inline-flex items-center gap-2 mb-3">
          <div className="w-8 h-8 rounded-lg bg-flapkap-green flex items-center justify-center">
            <span className="text-white font-bold text-sm">F</span>
          </div>
          <span className="text-2xl font-bold text-flapkap-dark">FlapKap GTM Agent</span>
        </div>
        <p className="text-slate-500 text-sm">
          Upload your leads sheet and let the AI build your cold email campaigns
        </p>
      </div>

      {/* Drop zone */}
      <div
        {...getRootProps()}
        className={clsx(
          "w-full max-w-lg border-2 border-dashed rounded-2xl p-12 flex flex-col items-center cursor-pointer transition-all",
          isDragActive
            ? "border-flapkap-green bg-emerald-50"
            : "border-slate-200 bg-white hover:border-flapkap-green hover:bg-emerald-50/30",
          uploading && "opacity-60 cursor-not-allowed"
        )}
      >
        <input {...getInputProps()} />

        {uploading ? (
          <>
            <Loader2 className="w-12 h-12 text-flapkap-green animate-spin mb-4" />
            <p className="text-flapkap-dark font-medium">Parsing {fileName}…</p>
          </>
        ) : (
          <>
            {isDragActive ? (
              <Upload className="w-12 h-12 text-flapkap-green mb-4" />
            ) : (
              <FileSpreadsheet className="w-12 h-12 text-slate-300 mb-4" />
            )}
            <p className="text-flapkap-dark font-medium mb-1">
              {isDragActive ? "Drop it here" : "Drag & drop your leads sheet"}
            </p>
            <p className="text-slate-400 text-sm">or click to browse — .xlsx, .xls, .csv</p>
            <p className="text-slate-300 text-xs mt-3">Max 10 MB</p>
          </>
        )}
      </div>

      {error && (
        <div className="mt-4 flex items-center gap-2 text-red-500 text-sm">
          <AlertCircle className="w-4 h-4 shrink-0" />
          {error}
        </div>
      )}

      {/* Column hint */}
      <div className="mt-6 text-center text-xs text-slate-400 max-w-sm">
        Expected columns: <span className="font-mono">email, first_name, last_name, company, title, industry</span>
        <br />Extra columns (phone, linkedin, revenue) are welcome.
      </div>
    </div>
  );
}
