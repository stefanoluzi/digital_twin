import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { 
  X, 
  Download, 
  Printer, 
  FileText, 
  CheckCircle2, 
  AlertCircle, 
  Loader2, 
  RefreshCw,
  ExternalLink,
  Eye,
  ZoomIn,
  ZoomOut,
  Building2,
  LayoutGrid
} from 'lucide-react';
import { ParadaEvent, Task, ProjectInfo } from '../types';
import { PdfJsPreview } from './PdfJsPreview';
import { 
  generateInterventionPdfBlob, 
  generateThirdPartySummaryPdfBlob,
  downloadBlobAsFile, 
  getExportFileName,
  getThirdPartyExportFileName 
} from '../utils/pdfExport';

interface ExportPdfModalProps {
  isOpen: boolean;
  onClose: () => void;
  parada: ParadaEvent | null;
  allTasks: Task[];
  filteredTasks: Task[];
  planningStartDate: string;
  projectInfo?: ProjectInfo;
  initialDocType?: 'terceros' | 'plano';
}

export const ExportPdfModal: React.FC<ExportPdfModalProps> = ({
  isOpen,
  onClose,
  parada,
  allTasks,
  filteredTasks,
  planningStartDate,
  projectInfo,
  initialDocType = 'terceros'
}) => {
  const [docType, setDocType] = useState<'terceros' | 'plano'>(initialDocType);
  const [exportScope, setExportScope] = useState<'all' | 'filtered'>('all');
  const [zoomScale, setZoomScale] = useState(0.85); // Default scale
  const [isGenerating, setIsGenerating] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [infoMessage, setInfoMessage] = useState<string | null>(null);
  const [successToast, setSuccessToast] = useState(false);
  
  // Single Source of Truth PDF state
  const [pdfBlob, setPdfBlob] = useState<Blob | null>(null);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);

  const previewContainerRef = useRef<HTMLDivElement>(null);
  const naturalWidthRef = useRef<number>(842); // Default A4 Landscape (~842 points) or A3 (~1190 points)

  // Synchronize initialDocType when opened
  useEffect(() => {
    if (isOpen && initialDocType) {
      setDocType(initialDocType);
    }
  }, [isOpen, initialDocType]);

  // Stable task filtering
  const exportTasks = useMemo(() => {
    if (!parada) return [];
    const paradaTasks = allTasks.filter(
      t => t.paradaId === parada.id || (!t.paradaId && parada.id === 'parada-rex-1')
    );
    const filteredParadaTasks = filteredTasks.filter(
      t => t.paradaId === parada.id || (!t.paradaId && parada.id === 'parada-rex-1')
    );
    return exportScope === 'all' ? paradaTasks : filteredParadaTasks;
  }, [parada?.id, allTasks, filteredTasks, exportScope]);

  // Object URL lifecycle management
  useEffect(() => {
    if (!pdfBlob) {
      setPdfUrl(null);
      return;
    }

    const url = URL.createObjectURL(pdfBlob);
    setPdfUrl(url);

    return () => {
      URL.revokeObjectURL(url);
    };
  }, [pdfBlob]);

  // Generate once when opened, docType changes, or scope changes
  useEffect(() => {
    if (!isOpen || !parada) {
      setPdfBlob(null);
      setPdfUrl(null);
      setErrorMessage(null);
      setInfoMessage(null);
      return;
    }

    let isMounted = true;
    setIsGenerating(true);
    setErrorMessage(null);

    const generatePromise = docType === 'terceros'
      ? generateThirdPartySummaryPdfBlob(parada, exportTasks, planningStartDate, projectInfo)
      : generateInterventionPdfBlob(parada, exportTasks, planningStartDate, projectInfo);

    generatePromise
      .then(blob => {
        if (isMounted) {
          setPdfBlob(blob);
          setIsGenerating(false);
        }
      })
      .catch(err => {
        console.error('[PDF Export] Error al generar Blob:', err);
        if (isMounted) {
          setErrorMessage(err?.message || 'Error al compilar el PDF vectorial.');
          setIsGenerating(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [isOpen, parada?.id, docType, exportScope]);

  // Manual regenerate trigger
  const handleRegenerate = () => {
    if (!parada) return;
    setIsGenerating(true);
    setErrorMessage(null);

    const generatePromise = docType === 'terceros'
      ? generateThirdPartySummaryPdfBlob(parada, exportTasks, planningStartDate, projectInfo)
      : generateInterventionPdfBlob(parada, exportTasks, planningStartDate, projectInfo);

    generatePromise
      .then(blob => {
        setPdfBlob(blob);
        setIsGenerating(false);
      })
      .catch(err => {
        console.error('[PDF Export] Error al regenerar Blob:', err);
        setErrorMessage(err?.message || 'Error al compilar el PDF.');
        setIsGenerating(false);
      });
  };

  // Stable callback for PDF.js natural width
  const handleNaturalWidthCalculated = useCallback((w: number) => {
    naturalWidthRef.current = w;
  }, []);

  // Handler to adjust PDF.js zoom scale to fill available preview width
  const handleFitToWidth = () => {
    if (previewContainerRef.current && naturalWidthRef.current > 0) {
      const containerWidth = previewContainerRef.current.clientWidth - 48;
      const calculatedScale = Math.min(1.6, Math.max(0.3, containerWidth / naturalWidthRef.current));
      setZoomScale(calculatedScale);
    }
  };

  if (!isOpen || !parada) return null;

  const fileName = docType === 'terceros'
    ? getThirdPartyExportFileName(
        parada.title,
        parada.startDate || planningStartDate,
        parada.endDate || ''
      )
    : getExportFileName(
        parada.title,
        parada.startDate || planningStartDate,
        parada.endDate || ''
      );

  // 1. DOWNLOAD (Direct consumption of existing Blob)
  const handleDownloadPdf = () => {
    if (!pdfBlob) return;
    downloadBlobAsFile(pdfBlob, fileName);
    setSuccessToast(true);
    setTimeout(() => setSuccessToast(false), 4000);
  };

  // 2. OPEN IN NEW TAB (Direct consumption of existing Blob)
  const handleOpenInNewTab = () => {
    if (!pdfUrl) return;
    const newWindow = window.open(pdfUrl, '_blank', 'noopener,noreferrer');
    if (!newWindow) {
      setErrorMessage('El navegador bloqueó la pestaña emergente. Permití ventanas emergentes para abrir el PDF.');
    }
  };

  // 3. PRINT
  const handlePrintPdf = () => {
    if (!pdfUrl) return;
    const printWindow = window.open(pdfUrl, '_blank', 'noopener,noreferrer');
    if (printWindow) {
      setInfoMessage('PDF abierto para impresión. Podés usar Ctrl+P para imprimir directamente.');
      setTimeout(() => setInfoMessage(null), 8000);
    } else {
      setErrorMessage('El navegador bloqueó la nueva pestaña. Permití ventanas emergentes para abrir el PDF e imprimirlo.');
    }
  };

  return (
    <div className="fixed inset-0 z-60 flex items-center justify-center bg-black/75 backdrop-blur-xs p-3 overflow-hidden animate-in fade-in duration-200 no-print">
      <div 
        className="bg-white rounded-2xl shadow-2xl border border-gray-200 w-full max-w-7xl h-[94vh] flex flex-col overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* MODAL HEADER */}
        <div className="bg-[#003366] text-white px-6 py-3.5 flex items-center justify-between shrink-0 shadow-md">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center text-white">
              {docType === 'terceros' ? <Building2 className="w-5 h-5" /> : <FileText className="w-5 h-5" />}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-black uppercase tracking-widest text-blue-200 bg-white/10 px-2 py-0.5 rounded">
                  {docType === 'terceros' ? 'Informe Ejecutivo de Terceros (A4)' : 'Plano de Planificación A3 (420 × 297 mm)'}
                </span>
                <span className="text-[10px] font-bold text-blue-200">
                  Motor Vectorial jsPDF + AutoTable · Descarga Inmediata
                </span>
              </div>
              <h2 className="text-lg font-black tracking-tight flex items-center gap-2">
                Exportar: {parada.title}
              </h2>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            disabled={isGenerating}
            className="p-1.5 rounded-lg text-white/80 hover:text-white hover:bg-white/10 transition-colors cursor-pointer disabled:opacity-50"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* MODAL CONTROLS TOOLBAR */}
        <div className="bg-gray-50 border-b border-gray-200 px-6 py-2.5 flex flex-wrap items-center justify-between gap-3 shrink-0">
          {/* Document Type Tabs */}
          <div className="flex items-center gap-2">
            <span className="text-xs font-black text-gray-700 uppercase tracking-wider">
              Documento:
            </span>
            <div className="inline-flex bg-gray-200 p-0.5 rounded-lg">
              <button
                type="button"
                disabled={isGenerating}
                onClick={() => setDocType('terceros')}
                className={`px-3 py-1.5 text-xs font-black rounded-md transition-all cursor-pointer flex items-center gap-1.5 ${
                  docType === 'terceros'
                    ? 'bg-brand-blue text-white shadow-xs'
                    : 'text-gray-700 hover:text-gray-900'
                }`}
              >
                <Building2 className="w-3.5 h-3.5" />
                <span>Resumen de Terceros (HH)</span>
              </button>
              <button
                type="button"
                disabled={isGenerating}
                onClick={() => setDocType('plano')}
                className={`px-3 py-1.5 text-xs font-black rounded-md transition-all cursor-pointer flex items-center gap-1.5 ${
                  docType === 'plano'
                    ? 'bg-brand-blue text-white shadow-xs'
                    : 'text-gray-700 hover:text-gray-900'
                }`}
              >
                <LayoutGrid className="w-3.5 h-3.5" />
                <span>Plano de Planificación (A3)</span>
              </button>
            </div>
          </div>

          {/* Scope & Filtering Selector */}
          <div className="flex items-center gap-2">
            <span className="text-xs font-black text-gray-700 uppercase tracking-wider">
              Alcance:
            </span>
            <div className="inline-flex bg-gray-200 p-0.5 rounded-lg">
              <button
                type="button"
                disabled={isGenerating}
                onClick={() => setExportScope('all')}
                className={`px-3 py-1 text-xs font-black rounded-md transition-all cursor-pointer ${
                  exportScope === 'all'
                    ? 'bg-white text-[#003366] shadow-2xs'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                Intervención completa
              </button>
              <button
                type="button"
                disabled={isGenerating}
                onClick={() => setExportScope('filtered')}
                className={`px-3 py-1 text-xs font-black rounded-md transition-all cursor-pointer ${
                  exportScope === 'filtered'
                    ? 'bg-white text-[#003366] shadow-2xs'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                Vista filtrada
              </button>
            </div>
          </div>

          {/* Preview Zoom Controls */}
          <div className="flex items-center gap-2 bg-white border border-gray-300 rounded-lg px-2.5 py-1 shadow-2xs">
            <span className="text-[11px] font-bold text-gray-600 mr-1 flex items-center gap-1">
              <Eye className="w-3.5 h-3.5 text-[#003366]" /> Zoom:
            </span>
            <button
              type="button"
              onClick={() => setZoomScale(s => Math.max(0.3, s - 0.05))}
              className="p-1 text-gray-700 hover:bg-gray-100 rounded cursor-pointer"
              title="Reducir zoom"
            >
              <ZoomOut className="w-3.5 h-3.5" />
            </button>
            <span className="text-xs font-black text-[#003366] min-w-[42px] text-center">
              {Math.round(zoomScale * 100)}%
            </span>
            <button
              type="button"
              onClick={() => setZoomScale(s => Math.min(2.0, s + 0.05))}
              className="p-1 text-gray-700 hover:bg-gray-100 rounded cursor-pointer"
              title="Aumentar zoom"
            >
              <ZoomIn className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={handleFitToWidth}
              className="ml-1 text-[10.5px] font-bold text-[#003366] hover:bg-blue-50 px-2 py-0.5 rounded border border-blue-200 transition-colors cursor-pointer"
              title="Ajustar al ancho de pantalla"
            >
              Ajustar
            </button>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-3">
            {/* Regenerate if needed */}
            <button
              type="button"
              onClick={handleRegenerate}
              disabled={isGenerating}
              className="p-2 text-gray-700 bg-white hover:bg-gray-100 border border-gray-300 rounded-xl shadow-2xs transition-all cursor-pointer disabled:opacity-50"
              title="Regenerar PDF"
            >
              <RefreshCw className={`w-4 h-4 ${isGenerating ? 'animate-spin' : ''}`} />
            </button>

            {/* Print */}
            <button
              type="button"
              onClick={handlePrintPdf}
              disabled={isGenerating || !pdfUrl}
              className="px-3.5 py-2 text-xs font-bold text-gray-700 bg-white hover:bg-gray-100 border border-gray-300 rounded-xl shadow-2xs transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              title="Abrir PDF en pestaña nueva para impresión"
            >
              <Printer className="w-4 h-4 text-gray-600" />
              <span>{docType === 'terceros' ? 'Imprimir' : 'Imprimir A3'}</span>
            </button>

            {/* Download PDF */}
            <button
              type="button"
              onClick={handleDownloadPdf}
              disabled={isGenerating || !pdfBlob}
              className="px-5 py-2 text-xs font-black text-white bg-[#ff6600] hover:brightness-110 rounded-xl shadow-md transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50"
            >
              <Download className="w-4 h-4" />
              <span>{docType === 'terceros' ? 'Descargar Resumen Terceros (PDF)' : 'Descargar Plano A3 (PDF)'}</span>
            </button>
          </div>
        </div>

        {/* NOTICES & ALERTS */}
        {errorMessage && (
          <div className="bg-red-50 border-b border-red-200 px-6 py-2.5 flex items-center justify-between text-xs font-bold text-red-800 shrink-0">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
              <span>{errorMessage}</span>
            </div>
            <button
              type="button"
              onClick={() => setErrorMessage(null)}
              className="text-red-600 hover:text-red-800 p-1 cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {infoMessage && (
          <div className="bg-blue-50 border-b border-blue-200 px-6 py-2.5 flex items-center justify-between text-xs font-bold text-blue-900 shrink-0">
            <div className="flex items-center gap-2">
              <Printer className="w-4 h-4 text-blue-700 shrink-0" />
              <span>{infoMessage}</span>
            </div>
            <button
              type="button"
              onClick={() => setInfoMessage(null)}
              className="text-blue-700 hover:text-blue-900 p-1 cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {successToast && (
          <div className="bg-emerald-50 border-b border-emerald-200 px-6 py-2.5 flex items-center gap-2 text-xs font-bold text-emerald-800 shrink-0">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>¡Archivo PDF A3 descargado con éxito!</span>
          </div>
        )}

        {/* UNIFIED PREVIEW CONTAINER */}
        <div 
          ref={previewContainerRef}
          className="flex-1 bg-gray-400/80 overflow-auto flex flex-col items-center justify-start relative"
        >
          {isGenerating ? (
            <div className="m-auto flex flex-col items-center gap-3 bg-white p-8 rounded-2xl shadow-lg border border-gray-200">
              <Loader2 className="w-8 h-8 text-[#003366] animate-spin" />
              <div className="text-sm font-black text-gray-800">
                Generando plano de planificación A3...
              </div>
              <div className="text-xs text-gray-500">
                Compilando cronograma, empresas y distribución de personas-día
              </div>
            </div>
          ) : pdfBlob ? (
            <PdfJsPreview
              pdfBlob={pdfBlob}
              zoomScale={zoomScale}
              onNaturalWidthCalculated={handleNaturalWidthCalculated}
            />
          ) : (
            <div className="m-auto text-center text-gray-600 font-bold text-xs bg-white/90 p-4 rounded-xl shadow-xs">
              No hay documento generado para previsualizar.
            </div>
          )}
        </div>

        {/* MODAL FOOTER */}
        <div className="bg-white border-t border-gray-200 px-6 py-3 flex items-center justify-between text-xs text-gray-500 font-medium shrink-0">
          <div className="flex items-center gap-2">
            <span className="inline-block w-2 h-2 rounded-full bg-emerald-500"></span>
            Documento Técnico A3: <strong className="text-gray-800">420 mm × 297 mm (Área útil: 404 mm × 281 mm)</strong>
            {pdfBlob && (
              <span className="text-gray-400 ml-1">
                · Archivo compilado: <strong>{(pdfBlob.size / 1024 / 1024).toFixed(3)} MB</strong>
              </span>
            )}
          </div>
          <div className="flex items-center gap-3">
            {pdfUrl && (
              <button
                type="button"
                onClick={handleOpenInNewTab}
                className="text-[#003366] hover:underline font-bold text-xs flex items-center gap-1 cursor-pointer"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                Abrir en pestaña nueva
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-1.5 text-xs font-bold text-gray-700 hover:bg-gray-100 rounded-lg border border-gray-300 transition-colors cursor-pointer"
            >
              Cerrar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
