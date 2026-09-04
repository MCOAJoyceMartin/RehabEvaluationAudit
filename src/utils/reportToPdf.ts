import { jsPDF } from "jspdf";
import html2canvas from "html2canvas";

/**
 * Renders a full standalone HTML document (as produced by buildExportHtml)
 * to a multi-page PDF, entirely client-side (no server, no print dialog).
 *
 * Approach: the HTML is loaded into an off-screen, hidden <iframe> via
 * `srcdoc` (so its own <style> tag and layout apply exactly as it would in
 * a real page — unlike setting innerHTML on a div, which can't safely
 * represent a full document), then html2canvas rasterizes the whole
 * <body> as ONE tall canvas. That canvas is then sliced into letter-size
 * pages ourselves and each slice is added to the PDF with `addImage`.
 *
 * An earlier version used jsPDF's own `.html()` convenience method (which
 * wraps html2canvas and does its own auto-pagination). That method has a
 * real bug for content like this: its "text" auto-paging mode redraws
 * text as a separate vector overlay whose positioning doesn't reliably
 * match the underlying raster for table-heavy layouts, causing visible
 * duplicated/overlapping text; switching to its "slice" mode fixed that
 * but a second bug remained where the rightmost ~10-15% of every page was
 * silently cropped off — confirmed (via html2canvas capturing the DOM
 * correctly at the expected width) to be in jsPDF's own width/scale
 * placement math, not in this app's HTML/CSS. Doing the capture and
 * pagination manually, as below, sidesteps both bugs entirely — it's a
 * few more lines of code but only depends on two well-worn, narrow APIs
 * (html2canvas's single-canvas capture, and jsPDF's addImage).
 *
 * This is still a "good enough for a working document" renderer, not a
 * pixel-perfect layout engine — a table row can occasionally split across
 * a page break. That's an accepted tradeoff for a zero-backend,
 * all-client-side PDF; if that ever becomes a real problem, the fix is a
 * server-side renderer (e.g. a headless-browser print-to-PDF step), which
 * is out of scope for this static-site app.
 */
export async function htmlReportToPdfBlob(htmlString: string): Promise<Blob> {
  const PAGE_WIDTH_PT = 612; // US Letter, portrait, at 72pt/in
  const PAGE_HEIGHT_PT = 792;
  const MARGIN_PT = 24;
  const CONTENT_WIDTH_PT = PAGE_WIDTH_PT - MARGIN_PT * 2;
  const CONTENT_HEIGHT_PT = PAGE_HEIGHT_PT - MARGIN_PT * 2;
  const RENDER_WINDOW_WIDTH_PX = 800; // matches the report's own `max-width: 960px` body style closely enough at typical zoom

  const iframe = document.createElement("iframe");
  iframe.style.position = "fixed";
  iframe.style.left = "-10000px";
  iframe.style.top = "0";
  iframe.style.width = `${RENDER_WINDOW_WIDTH_PX}px`;
  iframe.style.height = "600px";
  iframe.style.border = "0";
  document.body.appendChild(iframe);

  try {
    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error("Report took too long to render for PDF export.")), 15000);
      iframe.onload = () => {
        clearTimeout(timeout);
        resolve();
      };
      iframe.srcdoc = htmlString;
    });

    const doc = iframe.contentDocument;
    const body = doc?.body;
    if (!doc || !body) {
      throw new Error("Could not access the report content to render as PDF.");
    }

    // scale: 1 keeps canvas pixels == CSS pixels, so the px-to-pt ratio
    // below is exact rather than dependent on the capturing browser's
    // devicePixelRatio.
    const fullCanvas = await html2canvas(body, {
      useCORS: true,
      logging: false,
      scale: 1,
      windowWidth: RENDER_WINDOW_WIDTH_PX,
      width: RENDER_WINDOW_WIDTH_PX,
    });

    const ptPerPx = CONTENT_WIDTH_PT / fullCanvas.width;
    const pageHeightPx = Math.floor(CONTENT_HEIGHT_PT / ptPerPx);

    const pdf = new jsPDF({ unit: "pt", format: "letter", orientation: "portrait" });
    const sliceCanvas = document.createElement("canvas");
    const sliceCtx = sliceCanvas.getContext("2d");
    if (!sliceCtx) {
      throw new Error("Could not get a 2D canvas context to paginate the report for PDF export.");
    }
    sliceCanvas.width = fullCanvas.width;

    let offsetPx = 0;
    let pageIndex = 0;
    while (offsetPx < fullCanvas.height) {
      const sliceHeightPx = Math.min(pageHeightPx, fullCanvas.height - offsetPx);
      sliceCanvas.height = sliceHeightPx;
      sliceCtx.clearRect(0, 0, sliceCanvas.width, sliceCanvas.height);
      sliceCtx.drawImage(
        fullCanvas,
        0, offsetPx, fullCanvas.width, sliceHeightPx, // source rect
        0, 0, fullCanvas.width, sliceHeightPx, // dest rect
      );

      if (pageIndex > 0) pdf.addPage();
      pdf.addImage(
        // JPEG, not PNG: this is a full-page raster of mostly white
        // space with text, and PNG's lossless compression does
        // surprisingly poorly on it (anti-aliased text edges add a lot
        // of subtle per-pixel variation) — a 20-page report came out
        // ~45MB as PNG vs a couple MB as JPEG at this quality, and 45MB
        // is well past Gmail's 25MB attachment limit for the "Save to
        // OneDrive" relay email.
        sliceCanvas.toDataURL("image/jpeg", 0.9),
        "JPEG",
        MARGIN_PT,
        MARGIN_PT,
        CONTENT_WIDTH_PT,
        sliceHeightPx * ptPerPx,
      );

      offsetPx += sliceHeightPx;
      pageIndex += 1;
    }

    return pdf.output("blob");
  } finally {
    document.body.removeChild(iframe);
  }
}
