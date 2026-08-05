import React, { useEffect, useRef, useState } from 'react';
const MAX_RENDERED_PDF_PAGES = 100;
let pdfJsPromise;

function loadPdfJs() {
  if (!pdfJsPromise) {
    pdfJsPromise = Promise.all([
      import('pdfjs-dist'),
      import('pdfjs-dist/build/pdf.worker.min.mjs?url'),
    ]).then(([pdfjsLib, worker]) => {
      pdfjsLib.GlobalWorkerOptions.workerSrc = worker.default;
      return pdfjsLib;
    });
  }
  return pdfJsPromise;
}

function dataUrlToBytes(dataUrl) {
  const payload = dataUrl.slice(dataUrl.indexOf(',') + 1);
  const binary = window.atob(payload);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
}

// PDF.js has changed cleanup APIs across major versions. Disposal runs while
// a card is being removed, so it must never throw into the React render tree.
function disposePdf(pdf) {
  if (!pdf) return;
  try {
    const dispose = typeof pdf.destroy === 'function'
      ? pdf.destroy.bind(pdf)
      : typeof pdf.cleanup === 'function'
        ? pdf.cleanup.bind(pdf)
        : null;
    if (!dispose) return;
    const result = dispose();
    if (result && typeof result.catch === 'function') void result.catch(() => {});
  } catch {}
}

export default function PdfPreview({ dataUrl, name }) {
  const containerRef = useRef(null);
  const pageCanvasRefs = useRef([]);
  const pdfRef = useRef(null);
  const renderTokenRef = useRef(0);
  const [pageCount, setPageCount] = useState(0);
  const [totalPageCount, setTotalPageCount] = useState(0);
  const [status, setStatus] = useState('loading');
  const [zoom, setZoom] = useState(1);

  useEffect(() => {
    let cancelled = false;
    setStatus('loading');
    setPageCount(0);
    setTotalPageCount(0);
    pageCanvasRefs.current = [];

    const loadPdf = async () => {
      if (!dataUrl) return;
      try {
        const pdfjsLib = await loadPdfJs();
        if (cancelled) return;
        const source = dataUrl.startsWith('data:') ? dataUrlToBytes(dataUrl) : dataUrl;
        const pdf = await pdfjsLib.getDocument({ data: source }).promise;
        if (cancelled) {
          disposePdf(pdf);
          return;
        }
        pdfRef.current = pdf;
        setTotalPageCount(pdf.numPages);
        setPageCount(Math.min(pdf.numPages, MAX_RENDERED_PDF_PAGES));
        setStatus('rendering');
      } catch {
        if (!cancelled) setStatus('error');
      }
    };

    void loadPdf();
    return () => {
      cancelled = true;
      renderTokenRef.current += 1;
      const pdf = pdfRef.current;
      pdfRef.current = null;
      disposePdf(pdf);
    };
  }, [dataUrl]);

  useEffect(() => {
    if (!pageCount || !pdfRef.current) return undefined;

    let cancelled = false;
    const renderAllPages = async () => {
      const pdf = pdfRef.current;
      const container = containerRef.current;
      if (!pdf || !container) return;

      const token = ++renderTokenRef.current;
      try {
        for (let pageNumber = 1; pageNumber <= pageCount; pageNumber += 1) {
          const canvas = pageCanvasRefs.current[pageNumber - 1];
          if (!canvas) continue;

          const page = await pdf.getPage(pageNumber);
          if (cancelled || token !== renderTokenRef.current) return;

          const scale = Math.min(3, Math.max(0.5, zoom));
          const viewport = page.getViewport({ scale });
          const dpr = Math.min(2, window.devicePixelRatio || 1);

          canvas.width = Math.ceil(viewport.width * dpr);
          canvas.height = Math.ceil(viewport.height * dpr);
          canvas.style.width = `${viewport.width}px`;
          canvas.style.height = `${viewport.height}px`;

          const context = canvas.getContext('2d', { alpha: false });
          context.fillStyle = '#ffffff';
          context.fillRect(0, 0, canvas.width, canvas.height);
          await page.render({
            canvasContext: context,
            viewport,
            transform: dpr !== 1 ? [dpr, 0, 0, dpr, 0, 0] : null,
          }).promise;
          page.cleanup?.();
        }

        if (!cancelled && token === renderTokenRef.current) setStatus('ready');
      } catch (error) {
        if (!cancelled && token === renderTokenRef.current && error?.name !== 'RenderingCancelledException') {
          setStatus('error');
        }
      }
    };

    void renderAllPages();
    if (!('ResizeObserver' in window)) return undefined;

    const observer = new ResizeObserver(() => { void renderAllPages(); });
    if (containerRef.current) observer.observe(containerRef.current);
    return () => {
      cancelled = true;
      observer.disconnect();
      renderTokenRef.current += 1;
    };
  }, [pageCount, zoom]);

  return (
    <div ref={containerRef} className="canvas-pdf-preview" aria-label={`${name || 'PDF'} full preview`}>
      <div className="canvas-pdf-controls" onPointerDown={(event) => event.stopPropagation()}>
        <button type="button" onClick={() => setZoom((value) => Math.max(0.5, value - 0.25))} aria-label="Zoom out">-</button>
        <span>{Math.round(zoom * 100)}%</span>
        <button type="button" onClick={() => setZoom((value) => Math.min(3, value + 0.25))} aria-label="Zoom in">+</button>
      </div>
      {Array.from({ length: pageCount }, (_, index) => (
        <div className="canvas-pdf-page" key={index + 1}>
          <canvas ref={(element) => { pageCanvasRefs.current[index] = element; }} />
          <span className="canvas-pdf-page-number">{index + 1}</span>
        </div>
      ))}
      {status !== 'ready' && (
        <div className="canvas-pdf-status">
          {status === 'error' ? 'Preview unavailable - use Open file' : status === 'rendering' ? 'Rendering PDF...' : 'Loading PDF...'}
        </div>
      )}
      {pageCount > 0 && <span className="canvas-pdf-page-count">
        {totalPageCount > pageCount ? `Showing first ${pageCount} of ${totalPageCount} pages` : `${pageCount} ${pageCount === 1 ? 'page' : 'pages'}`}
      </span>}
    </div>
  );
}
