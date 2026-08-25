"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { AppShell } from "@/components/AppShell";
import { Card, SectionLabel } from "@/components/ui";
import { Upload, FileText } from "lucide-react";

type DocRow = { id: string; filename: string; uploaded_at: string };

function DocumentsInner() {
  const params = useSearchParams();
  const orgId = params.get("org");
  const [docs, setDocs] = useState<DocRow[] | null>(null);
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  function load() {
    if (!orgId) return;
    fetch(`/api/documents?org=${orgId}`)
      .then((r) => r.json())
      .then((d) => setDocs(d.documents ?? []));
  }

  useEffect(load, [orgId]);

  async function upload(e: React.FormEvent) {
    e.preventDefault();
    const file = fileInput.current?.files?.[0];
    if (!file || !orgId) return;
    setUploading(true);
    setMessage(null);
    const formData = new FormData();
    formData.append("organization_id", orgId);
    formData.append("file", file);
    const res = await fetch("/api/documents", { method: "POST", body: formData });
    const data = await res.json();
    setUploading(false);
    if (!res.ok) {
      setMessage("Error: " + (data.error ?? "upload failed"));
    } else {
      setMessage(`Indexed ${data.chunkCount} chunks from ${data.filename} (${data.extractedChars} characters extracted).`);
      if (fileInput.current) fileInput.current.value = "";
      load();
    }
  }

  return (
    <div className="max-w-3xl mx-auto px-6 py-10">
      <SectionLabel>Policy documents</SectionLabel>
      <h1 className="font-display text-2xl font-semibold mb-1">Upload policy documents</h1>
      <p className="text-ink-muted text-sm mb-6">
        Real PDF text extraction, chunking, and TF-IDF indexing — uploaded documents are what the Coverage Assistant on
        each claim actually searches against (see docs/02-architecture-decisions.md for exactly what &quot;real&quot; means
        here vs. what would need a hosted LLM later).
      </p>

      <Card className="p-5 mb-6">
        <form onSubmit={upload} className="flex items-center gap-3">
          <input ref={fileInput} type="file" accept="application/pdf" className="text-sm flex-1" />
          <button type="submit" disabled={uploading} className="btn-primary flex items-center gap-1.5 disabled:opacity-50">
            <Upload size={14} /> {uploading ? "Processing…" : "Upload & index"}
          </button>
        </form>
        {message && <p className="text-xs text-ink-muted mt-3">{message}</p>}
      </Card>

      <Card className="overflow-hidden">
        <div className="px-4 py-2.5 bg-surface-sunken text-xs font-mono uppercase tracking-wider text-ink-muted">
          Indexed documents
        </div>
        {docs === null && <div className="px-4 py-6 text-sm text-ink-muted">Loading…</div>}
        {docs?.length === 0 && <div className="px-4 py-6 text-sm text-ink-muted">No documents uploaded yet for this tenant.</div>}
        {docs?.map((d) => (
          <div key={d.id} className="flex items-center gap-3 px-4 py-3 border-t border-border text-sm">
            <FileText size={16} className="text-teal shrink-0" />
            <span className="flex-1 font-medium">{d.filename}</span>
            <span className="text-xs text-ink-muted font-mono">{d.uploaded_at}</span>
          </div>
        ))}
      </Card>

      <style jsx global>{`
        .btn-primary {
          background: var(--teal);
          color: white;
          padding: 8px 16px;
          border-radius: 6px;
          font-size: 14px;
          font-weight: 500;
        }
      `}</style>
    </div>
  );
}

export default function DocumentsPage() {
  return (
    <AppShell>
      <Suspense fallback={null}>
        <DocumentsInner />
      </Suspense>
    </AppShell>
  );
}
