import { useEffect, useRef, useState } from "react";

export interface PdfHandle {
  numPages: number;
  renderPageToCanvas: (pageNumber: number, canvas: HTMLCanvasElement, scale: number) => Promise<void>;
}

interface Props {
  pdfHandle: PdfHandle | null;
  page: number;
  onPageChange: (page: number) => void;
}

/**
 * PDFViewer
 * ==========
 * Renders the currently-selected page of the uploaded PDF to a canvas.
 * Controlled by `page`/`onPageChange` so "View Evidence" links elsewhere in
 * the dashboard can jump the viewer directly to the cited page.
 */
export function PDFViewer({ pdfHandle, page, onPageChange }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [rendering, setRendering] = useState(false);
  const [scale, setScale] = useState(1.2);

  useEffect(() => {
    let cancelled = false;
    if (!pdfHandle || !canvasRef.current) return;
    setRendering(true);
    pdfHandle
      .renderPageToCanvas(page, canvasRef.current, scale)
      .catch((err) => console.error("PDF render failed", err))
      .finally(() => { if (!cancelled) setRendering(false); });
    return () => { cancelled = true; };
  }, [pdfHandle, page, scale]);

  if (!pdfHandle) {
    return (
      <div className="pdf-viewer pdf-viewer--empty">
        <p>Upload a PDF to preview it here.</p>
      </div>
    );
  }

  return (
    <div className="pdf-viewer">
      <div className="pdf-viewer__toolbar">
        <button type="button" className="btn btn--small" disabled={page <= 1} onClick={() => onPageChange(page - 1)}>
          ← Prev
        </button>
        <span className="pdf-viewer__page-indicator">
          Page {page} of {pdfHandle.numPages}
        </span>
        <button type="button" className="btn btn--small" disabled={page >= pdfHandle.numPages} onClick={() => onPageChange(page + 1)}>
          Next →
        </button>
        <div className="pdf-viewer__zoom">
          <button type="button" className="btn btn--small" onClick={() => setScale((s) => Math.max(0.6, s - 0.2))}>−</button>
          <button type="button" className="btn btn--small" onClick={() => setScale((s) => Math.min(2.4, s + 0.2))}>+</button>
        </div>
      </div>
      <div className="pdf-viewer__canvas-wrap">
        {rendering && <div className="pdf-viewer__loading">Rendering…</div>}
        <canvas ref={canvasRef} />
      </div>
    </div>
  );
}
