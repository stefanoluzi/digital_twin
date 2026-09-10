import React, { useEffect, useRef, useState } from 'react';
import * as pdfjsLib from 'pdfjs-dist';
import { Loader2, AlertCircle } from 'lucide-react';

// Configure PDF.js worker in Vite
try {
  // @ts-ignore
  import('pdfjs-dist/build/pdf.worker.min.mjs?url').then(workerModule => {
    pdfjsLib.GlobalWorkerOptions.workerSrc = workerModule.default;
  }).catch(() => {
    // Fallback CDN if dynamic import fails
    pdfjsLib.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`;
  });
} catch {
  pdfjsLib.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`;
}

interface PdfPageCanvasProps {
  pdfDoc: pdfjsLib.PDFDocumentProxy;
  pageNumber: number;
  zoomScale: number;
}

const PdfPageCanvas: React.FC<PdfPageCanvasProps> = ({ pdfDoc, pageNumber, zoomScale }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const renderTaskRef = useRef<any>(null);

  useEffect(() => {
    let isCancelled = false;
    const canvas = canvasRef.current;
    if (!canvas || !pdfDoc) return;

    if (renderTaskRef.current) {
      try {
        renderTaskRef.current.cancel();
      } catch {
        // ignore cancellation error
      }
      renderTaskRef.current = null;
    }

    pdfDoc.getPage(pageNumber).then(page => {
      if (isCancelled) return;
      const viewport = page.getViewport({ scale: zoomScale });
      const dpr = window.devicePixelRatio || 1;

      canvas.width = Math.floor(viewport.width * dpr);
      canvas.height = Math.floor(viewport.height * dpr);
      canvas.style.width = `${Math.floor(viewport.width)}px`;
      canvas.style.height = `${Math.floor(viewport.height)}px`;

      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      const renderTask = page.render({
        canvas,
        canvasContext: ctx,
        viewport: viewport
      });
      renderTaskRef.current = renderTask;

      renderTask.promise.catch((err: any) => {
        if (err?.name !== 'RenderingCancelledException') {
          console.error(`[PdfJsPreview] Error rendering page ${pageNumber}:`, err);
        }
      });
    }).catch((err: any) => {
      if (!isCancelled) {
        console.error(`[PdfJsPreview] Error getting page ${pageNumber}:`, err);
      }
    });

    return () => {
      isCancelled = true;
      if (renderTaskRef.current) {
        try {
          renderTaskRef.current.cancel();
        } catch {
          // ignore
        }
        renderTaskRef.current = null;
      }
    };
  }, [pdfDoc, pageNumber, zoomScale]);

  return <canvas ref={canvasRef} className="block" />;
};

interface PdfJsPreviewProps {
  pdfBlob: Blob | null;
  zoomScale: number;
  onPageCountChange?: (count: number) => void;
  onNaturalWidthCalculated?: (width: number) => void;
}

export const PdfJsPreview: React.FC<PdfJsPreviewProps> = ({
  pdfBlob,
  zoomScale,
  onPageCountChange,
  onNaturalWidthCalculated
}) => {
  const [pdfDoc, setPdfDoc] = useState<pdfjsLib.PDFDocumentProxy | null>(null);
  const [numPages, setNumPages] = useState<number>(0);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  
  const containerRef = useRef<HTMLDivElement>(null);

  // Keep callback refs stable to prevent accidental re-triggering of PDF document parsing
  const onPageCountChangeRef = useRef(onPageCountChange);
  onPageCountChangeRef.current = onPageCountChange;
  const onNaturalWidthRef = useRef(onNaturalWidthCalculated);
  onNaturalWidthRef.current = onNaturalWidthCalculated;

  // 1. Load PDF Document from Blob (ONLY runs when pdfBlob identity changes)
  useEffect(() => {
    if (!pdfBlob) {
      setPdfDoc(null);
      setNumPages(0);
      return;
    }

    let isCancelled = false;
    setIsLoading(true);
    setError(null);

    const loadDoc = async () => {
      try {
        const arrayBuffer = await pdfBlob.arrayBuffer();
        if (isCancelled) return;

        const loadingTask = pdfjsLib.getDocument({
          data: arrayBuffer,
          cMapUrl: `https://unpkg.com/pdfjs-dist@${pdfjsLib.version}/cmaps/`,
          cMapPacked: true,
        });

        const pdf = await loadingTask.promise;
        if (isCancelled) return;

        setPdfDoc(pdf);
        setNumPages(pdf.numPages);
        onPageCountChangeRef.current?.(pdf.numPages);

        // Calculate natural width from page 1 for the "Ajustar" handler
        const firstPage = await pdf.getPage(1);
        if (isCancelled) return;
        const naturalViewport = firstPage.getViewport({ scale: 1 });
        onNaturalWidthRef.current?.(naturalViewport.width);

        setIsLoading(false);
      } catch (err: any) {
        console.error('[PdfJsPreview] Error cargando documento PDF:', err);
        if (!isCancelled) {
          setError('No se pudo procesar el PDF para la previsualización. El documento todavía puede descargarse.');
          setIsLoading(false);
        }
      }
    };

    loadDoc();

    return () => {
      isCancelled = true;
    };
  }, [pdfBlob]);

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center p-8 text-center bg-white rounded-2xl border border-gray-300 shadow-sm max-w-md my-auto">
        <AlertCircle className="w-8 h-8 text-amber-600 mb-2" />
        <div className="text-sm font-bold text-gray-800 mb-1">
          Aviso de visualización
        </div>
        <p className="text-xs text-gray-500 mb-4">
          {error}
        </p>
      </div>
    );
  }

  return (
    <div 
      ref={containerRef}
      className="w-full flex-1 overflow-auto flex flex-col items-center gap-8 p-6"
    >
      {isLoading && (
        <div className="flex flex-col items-center justify-center p-8 bg-white/90 backdrop-blur-xs rounded-2xl border border-gray-300 shadow-md my-auto">
          <Loader2 className="w-8 h-8 text-[#003366] animate-spin mb-2" />
          <div className="text-xs font-black text-gray-700">
            Cargando vista previa con PDF.js...
          </div>
        </div>
      )}

      {/* Pages Container */}
      {!isLoading && pdfDoc && numPages > 0 && Array.from({ length: numPages }).map((_, index) => {
        const pageNumber = index + 1;
        return (
          <div 
            key={`page-canvas-wrapper-${pageNumber}`}
            className="flex flex-col items-center gap-2"
          >
            {/* Page Indicator Tag */}
            <div className="text-[11px] font-bold text-gray-500 bg-white/80 px-3 py-0.5 rounded-full shadow-2xs border border-gray-300">
              Plano de Planificación A3 · Página {pageNumber} de {numPages}
            </div>

            {/* Pure PDF Canvas Page */}
            <div className="bg-white shadow-2xl rounded-sm overflow-hidden border border-gray-400">
              <PdfPageCanvas
                pdfDoc={pdfDoc}
                pageNumber={pageNumber}
                zoomScale={zoomScale}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
};
