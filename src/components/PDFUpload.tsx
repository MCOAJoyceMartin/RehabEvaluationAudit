import { useCallback, useRef, useState } from "react";

interface Props {
  onFileSelected: (file: File) => void;
  busy: boolean;
}

/**
 * PDFUpload
 * ==========
 * File picker + drag-and-drop for the source therapy PDF. Nothing here
 * touches the network — the File object is handed straight to the
 * in-browser parsing pipeline (see App.tsx / loadPdfBrowser.ts). PHI never
 * leaves the browser.
 */
export function PDFUpload({ onFileSelected, busy }: Props) {
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFiles = useCallback(
    (files: FileList | null) => {
      const file = files?.[0];
      if (file && file.type === "application/pdf") onFileSelected(file);
    },
    [onFileSelected],
  );

  return (
    <div
      className={`pdf-upload ${dragOver ? "pdf-upload--drag" : ""}`}
      onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
      onDragLeave={() => setDragOver(false)}
      onDrop={(e) => { e.preventDefault(); setDragOver(false); handleFiles(e.dataTransfer.files); }}
    >
      <input
        ref={inputRef}
        type="file"
        accept="application/pdf"
        hidden
        onChange={(e) => handleFiles(e.target.files)}
      />
      <div className="pdf-upload__icon" aria-hidden>📄</div>
      <h2>Upload a rehabilitation PDF</h2>
      <p>
        Upload a full therapy episode batch — Initial Evaluation, Progress Reports, Daily/Treatment Notes,
        Recertification, and Discharge Summary. Each discipline present (PT, OT, SLP) is detected and
        audited independently against the full rubric.
      </p>
      <button type="button" className="btn btn--primary" disabled={busy} onClick={() => inputRef.current?.click()}>
        {busy ? "Analyzing…" : "Choose PDF"}
      </button>
      <p className="pdf-upload__hint">or drag and drop a .pdf file here</p>
      <p className="pdf-upload__phi-note">
        Processed entirely in your browser. The file and its contents are not uploaded to any server.
      </p>
    </div>
  );
}
