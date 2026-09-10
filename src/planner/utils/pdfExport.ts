import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { ParadaEvent, Task, ProjectInfo, Specialty, Company } from '../types';
import { 
  getParadaDays, 
  getTaskRequirementsForDay,
  isTaskActiveOnDay,
  SPECIALTY_LABELS
} from '../constants';
import { buildInterventionThirdPartyStats } from './thirdPartyAnalytics';

/**
 * Sanitizes text to be safe for filenames
 */
export function sanitizeFileName(name: string): string {
  return name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // remove accents
    .replace(/[^a-zA-Z0-9_\-]/g, '_')
    .replace(/_{2,}/g, '_')
    .replace(/^_|_$/g, '');
}

/**
 * Builds standard export filename for A3 Landscape:
 * Planificacion_<nombre_intervencion>_A3_<fecha_inicio>_<fecha_fin>.pdf
 */
export function getExportFileName(
  paradaTitle: string,
  startDateStr: string,
  endDateStr: string
): string {
  const cleanTitle = sanitizeFileName(paradaTitle || 'Intervencion');
  const cleanStart = (startDateStr || '').replace(/[^0-9]/g, '-');
  const cleanEnd = (endDateStr || '').replace(/[^0-9]/g, '-');
  
  if (cleanStart && cleanEnd) {
    return `Planificacion_${cleanTitle}_A3_${cleanStart}_${cleanEnd}.pdf`;
  }
  return `Planificacion_${cleanTitle}_A3.pdf`;
}

/**
 * Builds standard export filename for Resumen de Terceros:
 * Resumen_Terceros_<nombre_intervencion>_<fecha_inicio>_<fecha_fin>.pdf
 */
export function getThirdPartyExportFileName(
  paradaTitle: string,
  startDateStr: string,
  endDateStr: string
): string {
  const cleanTitle = sanitizeFileName(paradaTitle || 'Intervencion');
  const cleanStart = (startDateStr || '').replace(/[^0-9]/g, '-');
  const cleanEnd = (endDateStr || '').replace(/[^0-9]/g, '-');
  
  if (cleanStart && cleanEnd) {
    return `Resumen_Terceros_${cleanTitle}_${cleanStart}_${cleanEnd}.pdf`;
  }
  return `Resumen_Terceros_${cleanTitle}.pdf`;
}

/**
 * Downloads an existing Blob as a file with zero re-rendering
 */
export function downloadBlobAsFile(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}

/**
 * Interface representing a consolidated resource row for a task
 */
export interface TaskResourceDistributionRow {
  specialty: Specialty;
  company: string; // e.g. 'COMIBOR', 'BFB', 'EMPRESA PENDIENTE'
  dailyCounts: Record<number, number>; // dayIndex -> count
  personDays: number; // sum of daily counts across all days
}

/**
 * Interface representing full resource distribution of a single task
 */
export interface TaskResourceDistribution {
  taskId: string;
  taskTitle: string;
  zone: string;
  responsable: string;
  criticality: string;
  durationDays: number;
  startDayOffset: number;
  rows: TaskResourceDistributionRow[];
  totalPersonDays: number; // total person-days without double-counting
  companyTotals: Record<string, number>; // company -> total personDays
  dailyTotalPersons: Record<number, number>; // dayIndex -> total persons on that day
}

/**
 * Helper function to consolidate resource and contractor distribution per task.
 * Strictly guarantees NO DOUBLE-COUNTING:
 * Each person on each active day belongs to exactly one specialty & assigned company (or PENDIENTE).
 */
export function buildTaskResourceDistribution(
  tasks: Task[],
  durationDays: number
): TaskResourceDistribution[] {
  return tasks.map(task => {
    // Key: `${specialty}__${company}`
    const rowMap: Record<string, {
      specialty: Specialty;
      company: string;
      dailyCounts: Record<number, number>;
    }> = {};

    const dailyTotalPersons: Record<number, number> = {};
    for (let d = 0; d < durationDays; d++) {
      dailyTotalPersons[d] = 0;
    }

    for (let d = 0; d < durationDays; d++) {
      if (!isTaskActiveOnDay(task, d)) continue;

      const reqs = getTaskRequirementsForDay(task, d);
      reqs.forEach(req => {
        if (!req.count || req.count <= 0) return;

        const specialty = req.specialty;
        const totalNeeded = req.count;
        dailyTotalPersons[d] = (dailyTotalPersons[d] || 0) + totalNeeded;

        // Tally allocated companies
        const allocations = req.companyAllocations || [];
        let allocatedCount = 0;

        allocations.forEach(alloc => {
          if (alloc.count > 0) {
            allocatedCount += alloc.count;
            const compKey = `${specialty}__${alloc.company}`;
            if (!rowMap[compKey]) {
              rowMap[compKey] = {
                specialty,
                company: alloc.company,
                dailyCounts: {}
              };
            }
            rowMap[compKey].dailyCounts[d] = (rowMap[compKey].dailyCounts[d] || 0) + alloc.count;
          }
        });

        // Unassigned / Pending difference
        const pendingCount = Math.max(0, totalNeeded - allocatedCount);
        if (pendingCount > 0) {
          const pendingKey = `${specialty}__EMPRESA PENDIENTE`;
          if (!rowMap[pendingKey]) {
            rowMap[pendingKey] = {
              specialty,
              company: 'EMPRESA PENDIENTE',
              dailyCounts: {}
            };
          }
          rowMap[pendingKey].dailyCounts[d] = (rowMap[pendingKey].dailyCounts[d] || 0) + pendingCount;
        }
      });
    }

    // Convert rowMap to structured list
    const rows: TaskResourceDistributionRow[] = Object.values(rowMap).map(item => {
      let personDays = 0;
      Object.values(item.dailyCounts).forEach(cnt => {
        personDays += cnt;
      });
      return {
        specialty: item.specialty,
        company: item.company,
        dailyCounts: item.dailyCounts,
        personDays
      };
    });

    // Sort rows: by specialty, then company
    rows.sort((a, b) => {
      if (a.specialty !== b.specialty) return a.specialty.localeCompare(b.specialty);
      if (a.company === 'EMPRESA PENDIENTE') return 1;
      if (b.company === 'EMPRESA PENDIENTE') return -1;
      return a.company.localeCompare(b.company);
    });

    // Calculate totals
    let totalPersonDays = 0;
    const companyTotals: Record<string, number> = {};

    rows.forEach(r => {
      totalPersonDays += r.personDays;
      companyTotals[r.company] = (companyTotals[r.company] || 0) + r.personDays;
    });

    return {
      taskId: task.id,
      taskTitle: task.title,
      zone: task.zone || 'GENERAL',
      responsable: task.responsable || 'Sin Supervisor',
      criticality: task.criticality || 'Media',
      durationDays: task.durationDays,
      startDayOffset: task.startDayOffset,
      rows,
      totalPersonDays,
      companyTotals,
      dailyTotalPersons
    };
  });
}

/**
 * Pure vector A3 Landscape PDF Generator (420mm x 297mm) using jsPDF + jspdf-autotable.
 * - Multi-page day chunking for legibility (max 4-5 days per planning table).
 * - Rich per-day task cells showing Specialty, assigned Contractor(s) and Pending counts.
 * - Comprehensive "DISTRIBUCIÓN DE PERSONAL POR TAREA" section calculating Personas-Día.
 */
export async function generateInterventionPdfBlob(
  parada: ParadaEvent,
  tasks: Task[],
  planningStartDate: string,
  projectInfo?: ProjectInfo,
  onProgress?: (current: number, total: number) => void
): Promise<Blob> {
  // Step 1: Create jsPDF A3 Landscape Document (420mm x 297mm)
  const doc = new jsPDF({
    orientation: 'landscape',
    unit: 'mm',
    format: 'a3',
    compress: true
  });

  const pageWidth = doc.internal.pageSize.getWidth();   // ~420 mm
  const pageHeight = doc.internal.pageSize.getHeight(); // ~297 mm

  const margin = 8;
  const usableWidth = pageWidth - margin * 2;   // 404 mm
  const usableHeight = pageHeight - margin * 2; // 281 mm

  // Step 2: Prepare Planning Timeline & Distribution Models
  const fallbackDate = new Date(planningStartDate || parada.startDate || '2026-08-17');
  const { days, durationDays } = getParadaDays(parada, fallbackDate);

  const totalTasks = tasks.length;
  const criticalTasksCount = tasks.filter(t => t.criticality === 'Alta').length;

  // Build resource distribution model for all tasks
  const distributionData = buildTaskResourceDistribution(tasks, durationDays);
  const grandTotalPersonDays = distributionData.reduce((acc, t) => acc + t.totalPersonDays, 0);

  onProgress?.(1, 4);

  // Step 3: Determine Day Chunks for Legibility in A3 Planning Grid
  // Maximum 4 to 5 days per page ensures cell widths of >= 45mm for clear company breakdowns
  const MAX_DAYS_PER_CHUNK = 5;
  const dayChunks: { startIndex: number; endIndex: number; days: typeof days }[] = [];

  if (durationDays <= MAX_DAYS_PER_CHUNK) {
    dayChunks.push({ startIndex: 0, endIndex: durationDays - 1, days });
  } else {
    // Split into even chunks of 4-5 days
    let start = 0;
    while (start < durationDays) {
      const remaining = durationDays - start;
      const chunkSize = remaining <= 5 ? remaining : (remaining === 6 ? 3 : (remaining === 7 ? 4 : 5));
      const end = start + chunkSize - 1;
      dayChunks.push({
        startIndex: start,
        endIndex: end,
        days: days.slice(start, end + 1)
      });
      start = end + 1;
    }
  }

  // Common Header Drawer Helper
  const drawPageHeader = (subtitleTag: string, dateRangeStr: string) => {
    const headerHeight = 26;
    
    // Header background bar (Industrial Navy #003366)
    doc.setFillColor(0, 51, 102);
    doc.rect(margin, margin, usableWidth, headerHeight, 'F');

    // Accent line (#FF6600 Orange)
    doc.setFillColor(255, 102, 0);
    doc.rect(margin, margin + headerHeight - 1.2, usableWidth, 1.2, 'F');

    // Title text
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(13);
    doc.text('PLAN DE INTERVENCIÓN TÉCNICA - PARADA DE PLANTA', margin + 5, margin + 8);

    // Subtitle / Parada Name + Scope Tag
    doc.setFontSize(9.5);
    doc.setTextColor(220, 235, 252);
    doc.text(`INTERVENCIÓN: ${parada.title.toUpperCase()}  ·  ${subtitleTag}`, margin + 5, margin + 15);

    // Date range info
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(200, 220, 245);
    doc.text(`Período: ${dateRangeStr} (Total: ${durationDays} días programados)`, margin + 5, margin + 21);

    // Project / Line info on Right side
    const rightX = margin + usableWidth - 5;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(255, 255, 255);
    doc.text(`PLANTA: ${(projectInfo?.line || 'Línea de Producción').toUpperCase()}`, rightX, margin + 8, { align: 'right' });

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(220, 235, 252);
    const emissionFormatted = format(new Date(), "dd/MM/yyyy HH:mm");
    doc.text(`Emisión: ${emissionFormatted} · Plano A3 (420 x 297 mm)`, rightX, margin + 14, { align: 'right' });

    // Stats badge box
    doc.setFillColor(255, 255, 255);
    doc.roundedRect(rightX - 145, margin + 17, 145, 6.5, 1, 1, 'F');
    doc.setTextColor(0, 51, 102);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7);
    doc.text(
      `TAREAS: ${totalTasks}  |  CRÍTICAS: ${criticalTasksCount}  |  TOTAL CARGA: ${grandTotalPersonDays} pers-día`,
      rightX - 72.5,
      margin + 21.5,
      { align: 'center' }
    );

    return margin + headerHeight + 3; // return startY for tables
  };

  // Fixed column definitions for the Planning Grid
  const colWidthItem = 8;
  const colWidthZone = 18;
  const colWidthSup = 24;
  const colWidthTitle = 54;
  const colWidthExec = 14;
  const colWidthCrit = 14;
  const colWidthDur = 12;
  const colWidthReq = 32;

  const totalFixedColsWidth = colWidthItem + colWidthZone + colWidthSup + colWidthTitle + colWidthExec + colWidthCrit + colWidthDur + colWidthReq; // 176 mm
  const remainingForDays = usableWidth - totalFixedColsWidth; // 404 - 176 = 228 mm

  // ==========================================
  // STEP 4: RENDER PLANNING GRID CHUNKS
  // ==========================================
  for (let chunkIdx = 0; chunkIdx < dayChunks.length; chunkIdx++) {
    const chunk = dayChunks[chunkIdx];
    const chunkDaysCount = chunk.days.length;
    const dayColWidth = remainingForDays / chunkDaysCount;

    if (chunkIdx > 0) {
      doc.addPage('a3', 'landscape');
    }

    const chunkSubtitle = dayChunks.length > 1
      ? `CRONOGRAMA (DÍAS ${chunk.startIndex + 1} A ${chunk.endIndex + 1} DE ${durationDays})`
      : 'CRONOGRAMA GENERAL DE EJECUCIÓN';
    
    const chunkDateRange = `${chunk.days[0]?.dateStr} al ${chunk.days[chunkDaysCount - 1]?.dateStr}`;
    const tableStartY = drawPageHeader(chunkSubtitle, chunkDateRange);

    // Table Headers
    const headRow: string[] = [
      'N°',
      'ZONA',
      'RESPONSABLE',
      'TAREA / ACTIVIDAD',
      'EJEC.',
      'CRIT.',
      'DUR.',
      'RECURSOS'
    ];

    chunk.days.forEach(d => {
      headRow.push(`${d.label.toUpperCase()}\n${d.dateStr}`);
    });

    // Build Table Body Rows
    const bodyRows: any[][] = [];

    tasks.forEach((task, index) => {
      // Global requirements summary text
      const reqSummary = (task.requirements || [])
        .map(r => `${r.specialty}: ${r.count}`)
        .join(', ');

      const row: any[] = [
        (index + 1).toString(),
        task.zone || 'GENERAL',
        task.responsable || '-',
        task.title || '',
        task.executedBy || 'GMB',
        task.criticality || 'Media',
        `${task.durationDays}d`,
        reqSummary || '-'
      ];

      // Build daily cell details for each day in this chunk
      for (let dayOffset = chunk.startIndex; dayOffset <= chunk.endIndex; dayOffset++) {
        const isActive = isTaskActiveOnDay(task, dayOffset);
        if (isActive) {
          const dayReqs = getTaskRequirementsForDay(task, dayOffset);
          if (dayReqs.length > 0) {
            const cellLines: string[] = [];
            dayReqs.forEach(req => {
              if (req.count <= 0) return;
              cellLines.push(`${req.specialty} ${req.count}`);

              let allocatedTotal = 0;
              if (req.companyAllocations && req.companyAllocations.length > 0) {
                req.companyAllocations.forEach(alloc => {
                  if (alloc.count > 0) {
                    allocatedTotal += alloc.count;
                    cellLines.push(`  · ${alloc.company} ${alloc.count}`);
                  }
                });
              }

              const pending = Math.max(0, req.count - allocatedTotal);
              if (pending > 0) {
                if (allocatedTotal === 0) {
                  cellLines.push(`  · Empresa pendiente`);
                } else {
                  cellLines.push(`  · Pendiente ${pending}`);
                }
              }
            });
            row.push(cellLines.join('\n') || 'ACTIVO');
          } else {
            row.push('ACTIVO');
          }
        } else {
          row.push('');
        }
      }

      bodyRows.push(row);
    });

    // Column styles mapping
    const columnStylesConfig: Record<number, any> = {
      0: { cellWidth: colWidthItem, halign: 'center' },
      1: { cellWidth: colWidthZone, fontStyle: 'bold', fontSize: 6.5 },
      2: { cellWidth: colWidthSup, fontSize: 6.5 },
      3: { cellWidth: colWidthTitle, fontStyle: 'bold', fontSize: 7 },
      4: { cellWidth: colWidthExec, halign: 'center', fontSize: 6.5 },
      5: { cellWidth: colWidthCrit, halign: 'center', fontSize: 6.5 },
      6: { cellWidth: colWidthDur, halign: 'center', fontSize: 6.5 },
      7: { cellWidth: colWidthReq, fontSize: 6.5 }
    };

    // Add width for day columns in this chunk
    for (let i = 0; i < chunkDaysCount; i++) {
      columnStylesConfig[8 + i] = {
        cellWidth: dayColWidth,
        halign: 'left',
        fontSize: 6.2,
        valign: 'middle'
      };
    }

    // AutoTable for Planning Grid Chunk
    autoTable(doc, {
      startY: tableStartY,
      head: [headRow],
      body: bodyRows,
      margin: { left: margin, right: margin, bottom: 14, top: tableStartY },
      tableWidth: usableWidth,
      theme: 'grid',
      styles: {
        font: 'helvetica',
        fontSize: 6.8,
        cellPadding: 1.2,
        textColor: [20, 20, 20],
        lineColor: [200, 210, 220],
        lineWidth: 0.15,
        valign: 'middle',
        overflow: 'linebreak'
      },
      headStyles: {
        fillColor: [0, 51, 102],
        textColor: [255, 255, 255],
        fontStyle: 'bold',
        fontSize: 7,
        halign: 'center',
        valign: 'middle',
        lineWidth: 0.2,
        lineColor: [0, 35, 70]
      },
      alternateRowStyles: {
        fillColor: [249, 251, 253]
      },
      didDrawCell: (data) => {
        // Highlight active day cells with clear industrial backgrounds
        if (data.section === 'body' && data.column.index >= 8) {
          const text = data.cell.text.join('');
          if (text && text.trim().length > 0) {
            const rawRow = bodyRows[data.row.index];
            const crit = rawRow?.[5];

            doc.saveGraphicsState();
            if (crit === 'Alta') {
              doc.setFillColor(254, 242, 242); // Very soft red
              doc.setDrawColor(239, 68, 68);
            } else {
              doc.setFillColor(240, 249, 255); // Very soft cyan-blue
              doc.setDrawColor(14, 165, 233);
            }
            doc.rect(data.cell.x + 0.2, data.cell.y + 0.2, data.cell.width - 0.4, data.cell.height - 0.4, 'FD');
            
            // Re-render text with clean typography
            doc.setFont('helvetica', 'normal');
            doc.setFontSize(6.2);
            
            const lines = data.cell.text;
            let currentY = data.cell.y + 2.5;
            const lineStep = 2.7;

            lines.forEach(line => {
              if (line.includes('· Empresa pendiente') || line.includes('· Pendiente')) {
                doc.setTextColor(194, 65, 12); // Rust orange
                doc.setFont('helvetica', 'bold');
              } else if (line.startsWith('  ·')) {
                doc.setTextColor(51, 65, 85); // Slate gray
                doc.setFont('helvetica', 'normal');
              } else {
                doc.setTextColor(0, 51, 102); // Navy for specialty title
                doc.setFont('helvetica', 'bold');
              }
              doc.text(line, data.cell.x + 1, currentY);
              currentY += lineStep;
            });

            doc.restoreGraphicsState();
          }
        }

        // Highlight Criticality column
        if (data.section === 'body' && data.column.index === 5) {
          const crit = data.cell.text.join('');
          if (crit === 'Alta') {
            doc.saveGraphicsState();
            doc.setFillColor(254, 226, 226);
            doc.rect(data.cell.x + 0.3, data.cell.y + 0.3, data.cell.width - 0.6, data.cell.height - 0.6, 'F');
            doc.setTextColor(185, 28, 28);
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(6.5);
            doc.text('ALTA', data.cell.x + data.cell.width / 2, data.cell.y + data.cell.height / 2 + 0.8, { align: 'center' });
            doc.restoreGraphicsState();
          }
        }
      }
    });
  }

  onProgress?.(2, 4);

  // ==========================================
  // STEP 5: RENDER "DISTRIBUCIÓN DE PERSONAL POR TAREA"
  // ==========================================
  doc.addPage('a3', 'landscape');

  const startSummaryY = drawPageHeader(
    'DISTRIBUCIÓN DE PERSONAL Y CONTRATISTAS POR TAREA',
    `${days[0]?.dateStr} al ${days[durationDays - 1]?.dateStr}`
  );

  // Build Summary Table Columns & Headers
  const summaryHeadRow: string[] = [
    'N°',
    'TAREA / ACTIVIDAD',
    'ZONA',
    'RESPONSABLE',
    'ESPECIALIDAD',
    'EMPRESA / CONTRATISTA'
  ];

  days.forEach(d => {
    summaryHeadRow.push(`${d.label.toUpperCase()}\n${d.dateStr.slice(0, 5)}`);
  });

  summaryHeadRow.push('PERSONAS-DÍA');

  // Summary Table Column Widths
  const sumColItem = 8;
  const sumColTitle = 68;
  const sumColZone = 18;
  const sumColResp = 24;
  const sumColSpec = 20;
  const sumColComp = 36;
  const sumColPd = 26;

  const totalFixedSummary = sumColItem + sumColTitle + sumColZone + sumColResp + sumColSpec + sumColComp + sumColPd; // 200 mm
  const sumDayColWidth = Math.max(12, (usableWidth - totalFixedSummary) / durationDays);

  const summaryBodyRows: any[][] = [];

  distributionData.forEach((taskDist, tIndex) => {
    if (taskDist.rows.length === 0) {
      // Task with duration but no specialty requirements declared
      const row: any[] = [
        (tIndex + 1).toString(),
        taskDist.taskTitle,
        taskDist.zone,
        taskDist.responsable,
        '-',
        'Personal Interno / Sin Dotación Externa'
      ];
      for (let d = 0; d < durationDays; d++) {
        row.push(isTaskActiveOnDay(tasks[tIndex], d) ? 'Act.' : '-');
      }
      row.push('0 p-d');
      summaryBodyRows.push(row);
    } else {
      taskDist.rows.forEach((r, rIdx) => {
        const row: any[] = [
          rIdx === 0 ? (tIndex + 1).toString() : '',
          rIdx === 0 ? taskDist.taskTitle : '',
          rIdx === 0 ? taskDist.zone : '',
          rIdx === 0 ? taskDist.responsable : '',
          r.specialty,
          r.company === 'EMPRESA PENDIENTE' ? 'EMPRESA PENDIENTE' : r.company
        ];

        for (let d = 0; d < durationDays; d++) {
          const count = r.dailyCounts[d];
          row.push(count !== undefined && count > 0 ? count.toString() : '-');
        }

        row.push(`${r.personDays} pers-día`);
        summaryBodyRows.push(row);
      });

      // Subtotal row for task if multiple rows exist
      if (taskDist.rows.length > 1) {
        const subtotalRow: any[] = [
          '',
          `>> TOTAL ${taskDist.taskTitle.toUpperCase()}`,
          '',
          '',
          '',
          'Subtotal acumulado tarea'
        ];

        for (let d = 0; d < durationDays; d++) {
          const totalDay = taskDist.dailyTotalPersons[d] || 0;
          subtotalRow.push(totalDay > 0 ? totalDay.toString() : '-');
        }

        subtotalRow.push(`${taskDist.totalPersonDays} pers-día`);
        summaryBodyRows.push(subtotalRow);
      }
    }
  });

  // Grand Total Summary Row
  const grandTotalRow: any[] = [
    '',
    'TOTAL GENERAL INTERVENCIÓN (CARGA CONSOLIDADA)',
    '',
    '',
    '',
    'TODAS LAS EMPRESAS'
  ];

  for (let d = 0; d < durationDays; d++) {
    let daySum = 0;
    distributionData.forEach(td => {
      daySum += td.dailyTotalPersons[d] || 0;
    });
    grandTotalRow.push(daySum > 0 ? daySum.toString() : '-');
  }

  grandTotalRow.push(`${grandTotalPersonDays} pers-día`);
  summaryBodyRows.push(grandTotalRow);

  // Column styles mapping for Summary table
  const summaryColStyles: Record<number, any> = {
    0: { cellWidth: sumColItem, halign: 'center' },
    1: { cellWidth: sumColTitle, fontStyle: 'bold', fontSize: 6.8 },
    2: { cellWidth: sumColZone, fontSize: 6.5 },
    3: { cellWidth: sumColResp, fontSize: 6.5 },
    4: { cellWidth: sumColSpec, halign: 'center', fontStyle: 'bold', fontSize: 6.8 },
    5: { cellWidth: sumColComp, fontSize: 6.8 }
  };

  for (let i = 0; i < durationDays; i++) {
    summaryColStyles[6 + i] = {
      cellWidth: sumDayColWidth,
      halign: 'center',
      fontSize: 6.8
    };
  }

  summaryColStyles[6 + durationDays] = {
    cellWidth: sumColPd,
    halign: 'right',
    fontStyle: 'bold',
    fontSize: 7
  };

  onProgress?.(3, 4);

  // AutoTable for Distribution by Task Section
  autoTable(doc, {
    startY: startSummaryY,
    head: [summaryHeadRow],
    body: summaryBodyRows,
    margin: { left: margin, right: margin, bottom: 14, top: startSummaryY },
    tableWidth: usableWidth,
    theme: 'grid',
    styles: {
      font: 'helvetica',
      fontSize: 6.8,
      cellPadding: 1.2,
      textColor: [20, 20, 20],
      lineColor: [200, 210, 220],
      lineWidth: 0.15,
      valign: 'middle',
      overflow: 'linebreak'
    },
    headStyles: {
      fillColor: [0, 51, 102],
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 7,
      halign: 'center',
      valign: 'middle',
      lineWidth: 0.2,
      lineColor: [0, 35, 70]
    },
    didDrawCell: (data) => {
      const rawText = data.cell.text.join(' ');

      // Highlight Grand Total Row
      if (rawText.includes('TOTAL GENERAL INTERVENCIÓN') || data.row.index === summaryBodyRows.length - 1) {
        doc.saveGraphicsState();
        doc.setFillColor(0, 51, 102);
        doc.rect(data.cell.x, data.cell.y, data.cell.width, data.cell.height, 'F');
        doc.setTextColor(255, 255, 255);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(7);
        const align = data.column.index === 6 + durationDays ? 'right' : (data.column.index >= 6 ? 'center' : 'left');
        const textX = align === 'right' ? data.cell.x + data.cell.width - 2 : (align === 'center' ? data.cell.x + data.cell.width / 2 : data.cell.x + 1.5);
        doc.text(rawText, textX, data.cell.y + data.cell.height / 2 + 1, { align: align as any });
        doc.restoreGraphicsState();
      }
      // Highlight Subtotal Row
      else if (rawText.startsWith('>> TOTAL')) {
        doc.saveGraphicsState();
        doc.setFillColor(241, 245, 249); // light slate
        doc.rect(data.cell.x, data.cell.y, data.cell.width, data.cell.height, 'F');
        doc.setTextColor(0, 51, 102);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(6.5);
        const align = data.column.index === 6 + durationDays ? 'right' : (data.column.index >= 6 ? 'center' : 'left');
        const textX = align === 'right' ? data.cell.x + data.cell.width - 2 : (align === 'center' ? data.cell.x + data.cell.width / 2 : data.cell.x + 1.5);
        doc.text(rawText, textX, data.cell.y + data.cell.height / 2 + 1, { align: align as any });
        doc.restoreGraphicsState();
      }
      // Highlight Pending Company
      else if (data.column.index === 5 && rawText === 'EMPRESA PENDIENTE') {
        doc.saveGraphicsState();
        doc.setTextColor(194, 65, 12);
        doc.setFont('helvetica', 'bold');
        doc.text('EMPRESA PENDIENTE', data.cell.x + 1.5, data.cell.y + data.cell.height / 2 + 1);
        doc.restoreGraphicsState();
      }
    },
    columnStyles: summaryColStyles
  });

  onProgress?.(4, 4);

  // ==========================================
  // STEP 6: DRAW FOOTER ON ALL PAGES
  // ==========================================
  const totalPages = (doc as any).internal.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    
    // Bottom border line
    doc.setDrawColor(200, 210, 220);
    doc.setLineWidth(0.2);
    doc.line(margin, pageHeight - 9, margin + usableWidth, pageHeight - 9);

    // Left: Document System info
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.8);
    doc.setTextColor(100, 116, 139);
    doc.text('Sistema de Planificación de Paradas de Planta · Ingeniería de Mantenimiento', margin, pageHeight - 4.5);

    // Center: Legend & Metric clarification
    doc.text(
      'Métrica Personas-Día = Carga diaria acumulada (personas × días) · [CRIT: Alta (Rojo), Media, Baja] · Formato A3 Horizontal',
      margin + usableWidth / 2,
      pageHeight - 4.5,
      { align: 'center' }
    );

    // Right: Page number
    doc.setFont('helvetica', 'bold');
    doc.text(`Página ${i} de ${totalPages}`, margin + usableWidth, pageHeight - 4.5, { align: 'right' });
  }

  // Step 7: Export to ArrayBuffer and strict application/pdf Blob
  const pdfArrayBuffer = doc.output('arraybuffer');
  const pdfBlob = new Blob([pdfArrayBuffer], { type: 'application/pdf' });
  
  console.log('[PDF Diagnostics] A3 Landscape Blob Created:', {
    size: `${(pdfBlob.size / 1024 / 1024).toFixed(3)} MB (${pdfBlob.size} bytes)`,
    type: pdfBlob.type,
    totalPages,
    pageWidth,
    pageHeight
  });

  return pdfBlob;
}

/**
 * Pure vector Executive Report PDF Generator for Resumen de Terceros (A4 Landscape, 297mm x 210mm)
 * - Executive Summary with KPI Highlights (Total HH, Promedio/Día, Picos, % Asignado)
 * - Table 1: Especialidades Computadas en HH (MEH, TUB, COB, LUB)
 * - Table 2: Adjudicación por Empresa Contratista
 * - Table 3: Demanda Diaria de Dotación y Horas-Hombre
 * - Table 4: Ranking Top Tareas Tercerizadas por Demanda de HH (con indicación de 12h)
 */
export async function generateThirdPartySummaryPdfBlob(
  parada: ParadaEvent,
  tasks: Task[],
  planningStartDate: string,
  projectInfo?: ProjectInfo
): Promise<Blob> {
  const doc = new jsPDF({
    orientation: 'landscape',
    unit: 'mm',
    format: 'a4',
    compress: true
  });

  const pageWidth = doc.internal.pageSize.getWidth();   // 297 mm
  const pageHeight = doc.internal.pageSize.getHeight(); // 210 mm
  const margin = 8;
  const usableWidth = pageWidth - margin * 2;   // 281 mm
  const usableHeight = pageHeight - margin * 2; // 194 mm

  // Calculate analytics
  const stats = buildInterventionThirdPartyStats(parada, tasks);
  const fallbackDate = new Date(planningStartDate || parada.startDate || '2026-08-17');
  const { days, durationDays } = getParadaDays(parada, fallbackDate);

  const startFormatted = parada.startDate || days[0]?.dateStr || '';
  const endFormatted = parada.endDate || days[days.length - 1]?.dateStr || '';
  const dateRangeStr = `${startFormatted} al ${endFormatted}`;

  // Common Header Drawer Helper
  const drawPageHeader = (subtitleTag: string) => {
    const headerHeight = 22;
    
    // Header background bar (Industrial Navy #003366)
    doc.setFillColor(0, 51, 102);
    doc.rect(margin, margin, usableWidth, headerHeight, 'F');

    // Accent line (#FF6600 Orange)
    doc.setFillColor(255, 102, 0);
    doc.rect(margin, margin + headerHeight - 1, usableWidth, 1, 'F');

    // Title text
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.text('INFORME EJECUTIVO DE TERCEROS Y HORAS-HOMBRE (HH)', margin + 4, margin + 7);

    // Subtitle
    doc.setFontSize(8.5);
    doc.setTextColor(220, 235, 252);
    doc.text(`INTERVENCIÓN: ${parada.title.toUpperCase()}  ·  ${subtitleTag}`, margin + 4, margin + 13);

    // Date range info
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(200, 220, 245);
    doc.text(`Período: ${dateRangeStr} (${durationDays} días) · Exclusivo MEH, TUB, COB, LUB`, margin + 4, margin + 18.5);

    // Right info
    const rightX = margin + usableWidth - 4;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(255, 255, 255);
    doc.text(`PLANTA: ${(projectInfo?.line || 'Línea de Producción').toUpperCase()}`, rightX, margin + 7, { align: 'right' });

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(220, 235, 252);
    doc.text(`Generado: ${format(new Date(), "dd/MM/yyyy HH:mm'h'", { locale: es })}`, rightX, margin + 13, { align: 'right' });

    return margin + headerHeight + 3;
  };

  // ==========================================
  // PAGE 1: KPIS + ESPECIALIDADES + EMPRESAS
  // ==========================================
  let currentY = drawPageHeader('BALANCE GENERAL Y CONTRATISTAS');

  // Draw Executive KPI Cards (6 cards in a row)
  const kpiCount = 6;
  const kpiGap = 2.5;
  const kpiWidth = (usableWidth - kpiGap * (kpiCount - 1)) / kpiCount;
  const kpiHeight = 21;

  const kpis = [
    {
      title: 'TOTAL HORAS-HOMBRE',
      value: `${stats.totalHH.toLocaleString()} HH`,
      sub: `${stats.totalPeopleDays} pers-día acumuladas`,
      color: [0, 51, 102]
    },
    {
      title: 'PROMEDIO HH / DÍA',
      value: `${stats.avgHhPerDay.toLocaleString()} HH/d`,
      sub: `Ritmo diario estimado`,
      color: [16, 185, 129]
    },
    {
      title: 'PICO DE DOTACIÓN',
      value: `${stats.peakPeopleDay ? stats.peakPeopleDay.count : 0} pers.`,
      sub: stats.peakPeopleDay ? `${stats.peakPeopleDay.dayLabel} (${stats.peakPeopleDay.dateStr.slice(5)})` : '-',
      color: [255, 102, 0]
    },
    {
      title: 'PICO DE HH',
      value: `${stats.peakHHDay ? stats.peakHHDay.hh.toLocaleString() : 0} HH`,
      sub: stats.peakHHDay ? `${stats.peakHHDay.dayLabel} (${stats.peakHHDay.dateStr.slice(5)})` : '-',
      color: [147, 51, 234]
    },
    {
      title: 'EMPRESA ASIGNADA',
      value: `${stats.assignedPercentage}%`,
      sub: `${stats.assignedCompanyHH} HH asign / ${stats.pendingCompanyHH} pend`,
      color: stats.pendingPercentage === 0 ? [16, 185, 129] : [217, 119, 6]
    },
    {
      title: 'TAREAS TERCERIZADAS',
      value: `${stats.thirdPartyTasksCount} tareas`,
      sub: `${stats.companyStats.filter(c => !c.isPending).length} contratistas activos`,
      color: [71, 85, 105]
    }
  ];

  kpis.forEach((kpi, idx) => {
    const cardX = margin + idx * (kpiWidth + kpiGap);
    
    // Card background
    doc.setFillColor(248, 250, 252);
    doc.setDrawColor(226, 232, 240);
    doc.setLineWidth(0.3);
    doc.roundedRect(cardX, currentY, kpiWidth, kpiHeight, 1.5, 1.5, 'FD');

    // Title
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6.2);
    doc.setTextColor(100, 116, 139);
    doc.text(kpi.title, cardX + 2.5, currentY + 4.5);

    // Value
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10.5);
    doc.setTextColor(kpi.color[0], kpi.color[1], kpi.color[2]);
    doc.text(kpi.value, cardX + 2.5, currentY + 11.5);

    // Subtext
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(5.8);
    doc.setTextColor(100, 116, 139);
    doc.text(kpi.sub, cardX + 2.5, currentY + 17);
  });

  currentY += kpiHeight + 5;

  // Render Table 1: Desglose por Especialidad & Table 2: Empresas Contratistas side by side
  const halfWidth = (usableWidth - 4) / 2;

  // Left Table: Especialidades
  const specialtyTableBody = stats.specialtyStats.map(s => [
    s.specialty,
    s.label,
    `${s.totalHH.toLocaleString()} HH`,
    `${s.totalPeopleDays} p-d`,
    `${s.percentage}%`
  ]);

  // Total specialty row
  specialtyTableBody.push([
    'TOTAL',
    'Total Horas-Hombre Computadas',
    `${stats.totalHH.toLocaleString()} HH`,
    `${stats.totalPeopleDays} p-d`,
    '100%'
  ]);

  autoTable(doc, {
    startY: currentY,
    margin: { left: margin, right: margin + halfWidth + 4 },
    tableWidth: halfWidth,
    head: [['OFICIO', 'ESPECIALIDAD', 'TOTAL HH', 'PERS-DÍA', '% TOTAL']],
    body: specialtyTableBody,
    theme: 'grid',
    headStyles: {
      fillColor: [0, 51, 102],
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 7.2,
      halign: 'center',
      cellPadding: 1.8
    },
    bodyStyles: {
      fontSize: 7,
      textColor: [30, 41, 59],
      cellPadding: 1.8
    },
    columnStyles: {
      0: { fontStyle: 'bold', halign: 'center', cellWidth: 16 },
      1: { cellWidth: 'auto' },
      2: { fontStyle: 'bold', halign: 'right', cellWidth: 24, textColor: [0, 51, 102] },
      3: { halign: 'center', cellWidth: 20 },
      4: { halign: 'center', fontStyle: 'bold', cellWidth: 18 }
    },
    didParseCell: (data) => {
      if (data.row.index === specialtyTableBody.length - 1) {
        data.cell.styles.fontStyle = 'bold';
        data.cell.styles.fillColor = [241, 245, 249];
      }
    }
  });

  // Right Table: Distribución por Empresa Contratista
  const companyTableBody = stats.companyStats.map(c => [
    c.label,
    `${c.totalHH.toLocaleString()} HH`,
    `${c.percentage}%`,
    Object.entries(c.hhBySpecialty)
      .filter(([_, hh]) => hh > 0)
      .map(([spec, hh]) => `${spec}: ${hh}h`)
      .join(', ') || '-',
    c.isPending ? 'PENDIENTE' : 'ASIGNADA'
  ]);

  autoTable(doc, {
    startY: currentY,
    margin: { left: margin + halfWidth + 4, right: margin },
    tableWidth: halfWidth,
    head: [['EMPRESA / CONTRATISTA', 'TOTAL HH', '% PARADA', 'ESPECIALIDADES', 'ESTADO']],
    body: companyTableBody,
    theme: 'grid',
    headStyles: {
      fillColor: [255, 102, 0],
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 7.2,
      halign: 'center',
      cellPadding: 1.8
    },
    bodyStyles: {
      fontSize: 7,
      textColor: [30, 41, 59],
      cellPadding: 1.8
    },
    columnStyles: {
      0: { fontStyle: 'bold', cellWidth: 34 },
      1: { fontStyle: 'bold', halign: 'right', cellWidth: 22, textColor: [0, 51, 102] },
      2: { halign: 'center', fontStyle: 'bold', cellWidth: 18 },
      3: { cellWidth: 'auto', fontSize: 6.5 },
      4: { halign: 'center', fontStyle: 'bold', cellWidth: 22 }
    },
    didParseCell: (data) => {
      if (data.section === 'body') {
        const row = stats.companyStats[data.row.index];
        if (row?.isPending && data.column.index === 4) {
          data.cell.styles.textColor = [220, 38, 38];
          data.cell.styles.fillColor = [254, 242, 242];
        } else if (!row?.isPending && data.column.index === 4) {
          data.cell.styles.textColor = [16, 185, 129];
        }
      }
    }
  });

  // Table 3: Demanda Diaria de Dotación y Horas-Hombre
  const lastTableY = (doc as any).lastAutoTable.finalY || currentY + 40;
  const table3StartY = Math.max(lastTableY + 6, currentY + 45);

  // Section Heading
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(0, 51, 102);
  doc.text('CRONOGRAMA DIARIO: DOTACIÓN Y HORAS-HOMBRE POR ESPECIALIDAD', margin, table3StartY - 1.5);

  const dailyTableHead = [
    'DÍA',
    'FECHA',
    'MEH (pers/hh)',
    'TUB (pers/hh)',
    'COB (pers/hh)',
    'LUB (pers/hh)',
    'DOTACIÓN FÍSICA',
    'TOTAL HH DÍA',
    'CONTRATISTAS ACTIVOS'
  ];

  const dailyTableBody = stats.dailyStats.map(d => {
    const activeCompanies = Object.keys(d.companiesHH).join(', ') || '-';
    return [
      d.dayLabel,
      d.formattedDate,
      d.peopleBySpecialty.MEH > 0 ? `${d.peopleBySpecialty.MEH} p · ${d.hhBySpecialty.MEH}h` : '-',
      d.peopleBySpecialty.TUB > 0 ? `${d.peopleBySpecialty.TUB} p · ${d.hhBySpecialty.TUB}h` : '-',
      d.peopleBySpecialty.COB > 0 ? `${d.peopleBySpecialty.COB} p · ${d.hhBySpecialty.COB}h` : '-',
      d.peopleBySpecialty.LUB > 0 ? `${d.peopleBySpecialty.LUB} p · ${d.hhBySpecialty.LUB}h` : '-',
      `${d.totalPeople} personas`,
      `${d.totalHH.toLocaleString()} HH`,
      activeCompanies
    ];
  });

  // Total summary row
  dailyTableBody.push([
    'TOTAL',
    `${durationDays} días`,
    `${stats.specialtyStats.find(s => s.specialty === 'MEH')?.totalHH || 0} HH`,
    `${stats.specialtyStats.find(s => s.specialty === 'TUB')?.totalHH || 0} HH`,
    `${stats.specialtyStats.find(s => s.specialty === 'COB')?.totalHH || 0} HH`,
    `${stats.specialtyStats.find(s => s.specialty === 'LUB')?.totalHH || 0} HH`,
    `${stats.totalPeopleDays} pers-día`,
    `${stats.totalHH.toLocaleString()} HH`,
    `${stats.companyStats.filter(c => !c.isPending).length} empresas`
  ]);

  autoTable(doc, {
    startY: table3StartY,
    margin: { left: margin, right: margin },
    tableWidth: usableWidth,
    head: [dailyTableHead],
    body: dailyTableBody,
    theme: 'grid',
    headStyles: {
      fillColor: [0, 51, 102],
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 7.2,
      halign: 'center',
      cellPadding: 1.8
    },
    bodyStyles: {
      fontSize: 7,
      textColor: [30, 41, 59],
      cellPadding: 1.8
    },
    columnStyles: {
      0: { fontStyle: 'bold', halign: 'center', cellWidth: 20 },
      1: { halign: 'center', cellWidth: 22 },
      2: { halign: 'center', cellWidth: 28 },
      3: { halign: 'center', cellWidth: 28 },
      4: { halign: 'center', cellWidth: 28 },
      5: { halign: 'center', cellWidth: 28 },
      6: { halign: 'center', fontStyle: 'bold', cellWidth: 28, textColor: [255, 102, 0] },
      7: { halign: 'right', fontStyle: 'bold', cellWidth: 26, textColor: [0, 51, 102] },
      8: { cellWidth: 'auto', fontSize: 6.5 }
    },
    didParseCell: (data) => {
      if (data.row.index === dailyTableBody.length - 1) {
        data.cell.styles.fontStyle = 'bold';
        data.cell.styles.fillColor = [241, 245, 249];
      }
    }
  });

  // ==========================================
  // PAGE 2: RANKING TOP TAREAS TERCERIZADAS
  // ==========================================
  doc.addPage('a4', 'landscape');
  let p2StartY = drawPageHeader('RANKING DETALLADO DE TAREAS TERCERIZADAS POR DEMANDA DE HH');

  // Task Ranking Table
  const taskTableHead = [
    'N°',
    'ZONA',
    'SUPERVISOR',
    'TAREA TERCERIZADA',
    'JORNADA',
    'ESPECIALIDADES ASIGNADAS',
    'EMPRESAS CONTRATISTAS',
    'TOTAL HH'
  ];

  const taskTableBody = stats.taskStats.map((item, idx) => {
    // Check if 12h
    const is12h = item.shiftsDescription.includes('12') || item.task.workHours === 12;
    const jornadaStr = is12h ? '12 h (Extendida)' : (item.shiftsDescription || '9 h');

    const specSummary = Object.entries(item.hhBySpecialty)
      .filter(([_, hh]) => hh > 0)
      .map(([spec, hh]) => `${spec}: ${hh} HH`)
      .join(', ');

    return [
      (idx + 1).toString(),
      item.zone,
      item.task.responsable || 'Sin Supervisor',
      item.task.title,
      jornadaStr,
      specSummary || '—',
      item.companiesSummary,
      `${item.totalHH.toLocaleString()} HH`
    ];
  });

  autoTable(doc, {
    startY: p2StartY,
    margin: { left: margin, right: margin },
    tableWidth: usableWidth,
    head: [taskTableHead],
    body: taskTableBody,
    theme: 'grid',
    headStyles: {
      fillColor: [0, 51, 102],
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 7.2,
      halign: 'center',
      cellPadding: 2
    },
    bodyStyles: {
      fontSize: 6.8,
      textColor: [30, 41, 59],
      cellPadding: 1.8
    },
    columnStyles: {
      0: { fontStyle: 'bold', halign: 'center', cellWidth: 10 },
      1: { fontStyle: 'bold', halign: 'center', cellWidth: 20 },
      2: { cellWidth: 28 },
      3: { fontStyle: 'bold', cellWidth: 70 },
      4: { halign: 'center', cellWidth: 26 },
      5: { cellWidth: 44, fontSize: 6.5 },
      6: { cellWidth: 48, fontSize: 6.5 },
      7: { fontStyle: 'bold', halign: 'right', cellWidth: 24, textColor: [0, 51, 102] }
    },
    didParseCell: (data) => {
      if (data.section === 'body') {
        const item = stats.taskStats[data.row.index];
        const is12h = item && (item.shiftsDescription.includes('12') || item.task.workHours === 12);
        if (is12h && data.column.index === 4) {
          data.cell.styles.textColor = [79, 70, 229];
          data.cell.styles.fontStyle = 'bold';
          data.cell.styles.fillColor = [238, 242, 255];
        }
        if (item?.companiesSummary.includes('Pendiente') && data.column.index === 6) {
          data.cell.styles.textColor = [180, 83, 9];
        }
      }
    }
  });

  // Footer note on last page
  const finalY = (doc as any).lastAutoTable.finalY || pageHeight - 20;
  if (finalY < pageHeight - 18) {
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(6.5);
    doc.setTextColor(100, 116, 139);
    doc.text(
      '* Nota: El cómputo de Horas-Hombre (HH) se realiza exclusivamente sobre las especialidades mecánicas y de soporte técnico directo (MEH, TUB, COB, LUB). Andamios (AND), Topografía (TOP) y Obras Civiles (CIV) se gestionan por partida separada según estándar de parada.',
      margin,
      finalY + 6
    );
  }

  // Draw Page Numbering and Footer on all pages
  const totalPages = (doc as any).internal.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    
    // Bottom border line
    doc.setDrawColor(200, 210, 220);
    doc.setLineWidth(0.2);
    doc.line(margin, pageHeight - 7, margin + usableWidth, pageHeight - 7);

    // Left: Document System info
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.5);
    doc.setTextColor(100, 116, 139);
    doc.text('Sistema de Planificación de Paradas de Planta · Resumen Ejecutivo de Terceros', margin, pageHeight - 3.5);

    // Center: Intervención tag
    doc.text(
      `Intervención: ${parada.title} · Período ${dateRangeStr}`,
      margin + usableWidth / 2,
      pageHeight - 3.5,
      { align: 'center' }
    );

    // Right: Page number
    doc.setFont('helvetica', 'bold');
    doc.text(`Página ${i} de ${totalPages}`, margin + usableWidth, pageHeight - 3.5, { align: 'right' });
  }

  const pdfArrayBuffer = doc.output('arraybuffer');
  const pdfBlob = new Blob([pdfArrayBuffer], { type: 'application/pdf' });

  return pdfBlob;
}
