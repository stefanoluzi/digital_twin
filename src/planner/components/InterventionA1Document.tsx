import React from 'react';
import { format } from 'date-fns';
import { ParadaEvent, Task, ProjectInfo, Specialty, ExternalSpecialty } from '../types';
import { 
  getParadaDays, 
  SPECIALTIES_LIST, 
  EXTERNAL_SPECIALTIES, 
  getTaskRequirementsForDay,
  getEffectiveSpecialtyAvailability
} from '../constants';

export interface InterventionA1DocumentProps {
  parada: ParadaEvent;
  tasks: Task[];
  planningStartDate: string;
  projectInfo?: ProjectInfo;
  emissionDate?: string;
  maxDaysPerPage?: number;
  maxTasksPerPage?: number;
}

interface PrintableItem {
  type: 'zone-supervisor' | 'task';
  zone?: string;
  supervisor?: string;
  task?: Task;
}

export const InterventionA1Document: React.FC<InterventionA1DocumentProps> = ({
  parada,
  tasks,
  planningStartDate,
  projectInfo,
  emissionDate,
  maxDaysPerPage = 7,
  maxTasksPerPage = 14
}) => {
  // 1. Calculate dates and days
  const fallbackDate = new Date(planningStartDate || parada.startDate || '2026-08-17');
  const { days, durationDays } = getParadaDays(parada, fallbackDate);

  const emissionFormatted = emissionDate 
    ? emissionDate 
    : format(new Date(), "dd/MM/yyyy HH:mm");

  // 2. Global KPIs
  const totalTasks = tasks.length;
  const criticalTasksCount = tasks.filter(t => t.criticality === 'Alta').length;

  let pendingCompanyTasksCount = 0;
  tasks.forEach(t => {
    let hasPending = false;
    for (let d = 0; d < durationDays; d++) {
      const dayReqs = getTaskRequirementsForDay(t, d);
      dayReqs.forEach(req => {
        if (!EXTERNAL_SPECIALTIES.includes(req.specialty)) {
          const totalAssigned = (req.companyAllocations || []).reduce((sum, a) => sum + (a.count || 0), 0);
          if (totalAssigned < req.count) {
            hasPending = true;
          }
        }
      });
    }
    if (hasPending) pendingCompanyTasksCount++;
  });

  // Calculate daily specialty requirements & availability
  const dailyNeeds: Record<number, Record<string, number>> = {};
  for (let d = 0; d < durationDays; d++) {
    dailyNeeds[d] = {};
    SPECIALTIES_LIST.forEach(s => { dailyNeeds[d][s] = 0; });
  }

  tasks.forEach(t => {
    for (let d = 0; d < durationDays; d++) {
      const dayReqs = getTaskRequirementsForDay(t, d);
      dayReqs.forEach(r => {
        if (dailyNeeds[d][r.specialty] !== undefined) {
          dailyNeeds[d][r.specialty] += r.count;
        }
      });
    }
  });

  const getDaySpecialtyStatus = (dayIndex: number, spec: Specialty) => {
    const dayObj = days[dayIndex];
    if (!dayObj) return { needed: 0, available: null, isOverloaded: false, deficit: 0 };
    const dateStr = dayObj.dateStr;
    const needed = dailyNeeds[dayIndex]?.[spec] || 0;
    const avail = getEffectiveSpecialtyAvailability(parada, dateStr, spec as ExternalSpecialty);
    const isOverloaded = avail !== null && needed > avail;
    const deficit = isOverloaded ? needed - (avail as number) : 0;
    return { needed, available: avail, isOverloaded, deficit };
  };

  let totalOverloadedDays = 0;
  for (let d = 0; d < durationDays; d++) {
    const isDayOv = SPECIALTIES_LIST.some(s => getDaySpecialtyStatus(d, s).isOverloaded);
    if (isDayOv) totalOverloadedDays++;
  }

  // 3. Group tasks by Zone -> Supervisor -> Task
  const groupedStructure: Record<string, Record<string, Task[]>> = {};
  tasks.forEach(task => {
    const zoneKey = task.zone || 'GENERAL';
    const supKey = task.responsable || 'Sin Supervisor Asignado';
    if (!groupedStructure[zoneKey]) groupedStructure[zoneKey] = {};
    if (!groupedStructure[zoneKey][supKey]) groupedStructure[zoneKey][supKey] = [];
    groupedStructure[zoneKey][supKey].push(task);
  });

  // Flatten items with single combined zone-supervisor headers
  const allPrintableItems: PrintableItem[] = [];
  Object.keys(groupedStructure).forEach(zone => {
    Object.keys(groupedStructure[zone]).forEach(supervisor => {
      allPrintableItems.push({ type: 'zone-supervisor', zone, supervisor });
      groupedStructure[zone][supervisor].forEach(task => {
        allPrintableItems.push({ type: 'task', task });
      });
    });
  });

  // 4. Chunk vertically
  const verticalChunks: PrintableItem[][] = [];
  let currentChunk: PrintableItem[] = [];
  let currentTaskCount = 0;

  allPrintableItems.forEach(item => {
    if (item.type === 'task') {
      currentChunk.push(item);
      currentTaskCount++;
      if (currentTaskCount >= maxTasksPerPage) {
        verticalChunks.push(currentChunk);
        currentChunk = [];
        currentTaskCount = 0;
      }
    } else {
      currentChunk.push(item);
    }
  });

  if (currentChunk.length > 0) {
    verticalChunks.push(currentChunk);
  }
  if (verticalChunks.length === 0) {
    verticalChunks.push([]);
  }

  const cleanVerticalChunks = verticalChunks.filter(chunk => 
    chunk.some(i => i.type === 'task') || verticalChunks.length === 1
  );

  // 5. Chunk horizontally (days)
  const dayChunks: { dayIndexStart: number; dayIndexEnd: number; days: typeof days }[] = [];
  const chunkSize = Math.max(1, maxDaysPerPage);

  for (let i = 0; i < durationDays; i += chunkSize) {
    const slice = days.slice(i, i + chunkSize);
    dayChunks.push({
      dayIndexStart: i,
      dayIndexEnd: Math.min(i + chunkSize - 1, durationDays - 1),
      days: slice
    });
  }

  const totalVerticalPages = cleanVerticalChunks.length;
  const totalHorizontalPages = dayChunks.length;
  const totalDocumentPages = totalVerticalPages * totalHorizontalPages;

  let globalPageIndex = 0;
  const finalPages: {
    pageNumber: number;
    totalDocumentPages: number;
    vIndex: number;
    hIndex: number;
    isLastVerticalPage: boolean;
    dayChunk: typeof dayChunks[0];
    items: PrintableItem[];
  }[] = [];

  dayChunks.forEach((dayChunk, hIdx) => {
    cleanVerticalChunks.forEach((vChunk, vIdx) => {
      globalPageIndex++;
      finalPages.push({
        pageNumber: globalPageIndex,
        totalDocumentPages,
        vIndex: vIdx,
        hIndex: hIdx,
        isLastVerticalPage: vIdx === totalVerticalPages - 1,
        dayChunk,
        items: vChunk
      });
    });
  });

  const getCompanyText = (req: any): { isPending: boolean; text: string } => {
    if (EXTERNAL_SPECIALTIES.includes(req.specialty)) {
      return { isPending: false, text: 'Externo' };
    }
    const allocs = req.companyAllocations || [];
    const active = allocs.filter((a: any) => a.count > 0);
    const assignedCount = active.reduce((acc: number, curr: any) => acc + curr.count, 0);
    const pendingCount = req.count - assignedCount;

    if (active.length === 0) {
      return { isPending: true, text: 'Empresa pendiente' };
    }

    let text = active.map((a: any) => `${a.company} ${a.count}`).join(' + ');
    if (pendingCount > 0) {
      text += ` (${pendingCount} pend.)`;
    }
    return { isPending: pendingCount > 0, text };
  };

  return (
    <div className="pdf-a1-root" style={{ width: '100%', backgroundColor: '#ffffff', color: '#111827', fontFamily: 'Arial, Helvetica, sans-serif' }}>
      {finalPages.map(page => {
        const pageDays = page.dayChunk.days;
        const pageDuration = pageDays.length;
        const dayColPercent = `${(64 / pageDuration).toFixed(2)}%`;

        return (
          <div
            key={`a1-page-${page.pageNumber}`}
            className="a1-page print-page"
            style={{
              width: '825mm',
              minHeight: '578mm',
              padding: '10mm 12mm',
              boxSizing: 'border-box',
              backgroundColor: '#ffffff',
              color: '#111827',
              fontFamily: 'Arial, Helvetica, sans-serif',
              pageBreakAfter: 'always',
              breakAfter: 'page',
              marginBottom: '15mm'
            }}
          >
            {/* 1. SIMPLE TECHNICAL HEADER (Top-down flow, no absolute positioning) */}
            <div style={{ borderBottom: '2.5px solid #003366', paddingBottom: '3.5mm', marginBottom: '4mm' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                {/* Left Header info */}
                <div>
                  <div style={{ fontSize: '10pt', fontWeight: 'bold', color: '#003366', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    PLANNER DE MANTENIMIENTO GENERAL
                  </div>
                  <div style={{ fontSize: '16pt', fontWeight: 'bold', color: '#111827', marginTop: '1.5mm', marginBottom: '1.5mm' }}>
                    {parada.title}
                  </div>
                  <div style={{ fontSize: '9pt', color: '#4b5563', lineHeight: 1.3 }}>
                    <strong>Línea / Sector:</strong> {projectInfo?.line || 'Línea de Producción General'} &nbsp;|&nbsp;
                    <strong>Período:</strong> {format(days[0].date, 'dd/MM/yyyy')} → {format(days[days.length - 1].date, 'dd/MM/yyyy')} ({durationDays} días)
                    {totalHorizontalPages > 1 && (
                      <span style={{ color: '#ff6600', fontWeight: 'bold', marginLeft: '6px' }}>
                        (Mostrando Días {page.dayChunk.dayIndexStart + 1} a {page.dayChunk.dayIndexEnd + 1})
                      </span>
                    )}
                  </div>
                </div>

                {/* Right Header metadata */}
                <div style={{ textAlign: 'right', fontSize: '8.5pt', color: '#374151', lineHeight: 1.4 }}>
                  <div>
                    <strong>Tareas:</strong> {totalTasks} &nbsp;|&nbsp; 
                    <strong>Críticas:</strong> <span style={{ color: criticalTasksCount > 0 ? '#d92d20' : '#111827', fontWeight: 'bold' }}>{criticalTasksCount}</span> &nbsp;|&nbsp; 
                    <strong>Emp. Pendientes:</strong> <span style={{ color: pendingCompanyTasksCount > 0 ? '#b45309' : '#111827', fontWeight: 'bold' }}>{pendingCompanyTasksCount}</span>
                  </div>
                  <div>
                    <strong>Sobrecargas:</strong> <span style={{ color: totalOverloadedDays > 0 ? '#d92d20' : '#059669', fontWeight: 'bold' }}>{totalOverloadedDays > 0 ? `${totalOverloadedDays} días` : '0'}</span>
                  </div>
                  <div style={{ color: '#6b7280', fontSize: '8pt', marginTop: '1mm' }}>
                    Emisión: {emissionFormatted}
                  </div>
                </div>
              </div>
            </div>

            {/* 2. MAIN TECHNICAL TABLE (HTML Real Table, Fixed Layout, Automatic Row Height) */}
            <table 
              style={{ 
                width: '100%', 
                tableLayout: 'fixed', 
                borderCollapse: 'collapse', 
                textAlign: 'left',
                border: '1.5px solid #6b7280'
              }}
            >
              <colgroup>
                <col style={{ width: '22%' }} />
                <col style={{ width: '6%' }} />
                <col style={{ width: '8%' }} />
                {pageDays.map((_, dIdx) => (
                  <col key={dIdx} style={{ width: dayColPercent }} />
                ))}
              </colgroup>

              {/* Table Column Headers */}
              <thead>
                <tr style={{ backgroundColor: '#f3f4f6', borderBottom: '2px solid #003366' }}>
                  <th style={{ padding: '2.5mm 3mm', fontSize: '9pt', fontWeight: 'bold', color: '#003366', borderRight: '1px solid #9ca3af', textTransform: 'uppercase' }}>
                    TAREA
                  </th>
                  <th style={{ padding: '2.5mm 1.5mm', fontSize: '8.5pt', fontWeight: 'bold', color: '#003366', borderRight: '1px solid #9ca3af', textTransform: 'uppercase', textAlign: 'center' }}>
                    IMPACTO
                  </th>
                  <th style={{ padding: '2.5mm 2mm', fontSize: '8.5pt', fontWeight: 'bold', color: '#003366', borderRight: '1.5px solid #6b7280', textTransform: 'uppercase', textAlign: 'center' }}>
                    RECURSOS
                  </th>
                  {pageDays.map(day => {
                    const dayIdx = day.dayIndex;
                    const activeSpecs = SPECIALTIES_LIST.filter(s => (dailyNeeds[dayIdx]?.[s] || 0) > 0);
                    const hasOverload = activeSpecs.some(s => getDaySpecialtyStatus(dayIdx, s).isOverloaded);

                    return (
                      <th
                        key={dayIdx}
                        style={{
                          padding: '2mm 2.5mm',
                          backgroundColor: hasOverload ? '#fff1f1' : '#f9fafb',
                          borderRight: '1px solid #9ca3af',
                          verticalAlign: 'top',
                          textAlign: 'center'
                        }}
                      >
                        <div style={{ fontSize: '8.5pt', fontWeight: 'bold', color: '#003366', textTransform: 'uppercase' }}>
                          {day.label}
                        </div>
                        <div style={{ fontSize: '10pt', fontWeight: 'bold', color: '#111827', marginTop: '0.5mm' }}>
                          {format(day.date, 'dd/MM')}
                        </div>
                        {/* Day diagnostic balance */}
                        <div style={{ marginTop: '1.5mm', display: 'flex', flexDirection: 'column', gap: '0.8mm' }}>
                          {activeSpecs.slice(0, 3).map(spec => {
                            const st = getDaySpecialtyStatus(dayIdx, spec);
                            const availDisplay = st.available === null ? '—' : st.available;
                            return (
                              <div
                                key={spec}
                                style={{
                                  fontSize: '7.5pt',
                                  fontWeight: 'bold',
                                  color: st.isOverloaded ? '#d92d20' : '#374151',
                                  lineHeight: 1.2
                                }}
                              >
                                {spec} {st.needed}/{availDisplay}
                                {st.isOverloaded && ` (⚠ -${st.deficit})`}
                              </div>
                            );
                          })}
                        </div>
                      </th>
                    );
                  })}
                </tr>
              </thead>

              {/* Table Body */}
              <tbody>
                {page.items.map((item, idx) => {
                  // ZONE + SUPERVISOR ROW
                  if (item.type === 'zone-supervisor') {
                    return (
                      <tr 
                        key={`zs-${idx}`}
                        style={{ 
                          backgroundColor: '#e5e7eb', 
                          borderBottom: '1.5px solid #9ca3af',
                          pageBreakInside: 'avoid',
                          breakInside: 'avoid'
                        }}
                      >
                        <td 
                          colSpan={3 + pageDuration}
                          style={{
                            padding: '1.8mm 3mm',
                            fontSize: '8.5pt',
                            fontWeight: 'bold',
                            color: '#003366',
                            textTransform: 'uppercase',
                            letterSpacing: '0.03em'
                          }}
                        >
                          ZONA: {item.zone} &nbsp;|&nbsp; Supervisor: {item.supervisor}
                        </td>
                      </tr>
                    );
                  }

                  // TASK ROW
                  if (item.type === 'task' && item.task) {
                    const t = item.task;
                    const isCritical = t.criticality === 'Alta';

                    return (
                      <tr
                        key={`task-${t.id}-${idx}`}
                        style={{
                          backgroundColor: isCritical ? '#fffbfa' : '#ffffff',
                          borderBottom: '1px solid #d1d5db',
                          pageBreakInside: 'avoid',
                          breakInside: 'avoid'
                        }}
                      >
                        {/* Col 1: TAREA */}
                        <td 
                          style={{ 
                            padding: '2.5mm 3mm', 
                            verticalAlign: 'top', 
                            borderRight: '1px solid #d1d5db'
                          }}
                        >
                          {isCritical && (
                            <div style={{ color: '#d92d20', fontWeight: 'bold', fontSize: '8.5pt', textTransform: 'uppercase', marginBottom: '0.8mm' }}>
                              CRÍTICA
                            </div>
                          )}
                          <div style={{ fontSize: '9pt', fontWeight: 'bold', color: '#111827', lineHeight: 1.25, whiteSpace: 'normal', overflowWrap: 'anywhere' }}>
                            {t.title}
                          </div>
                          {t.justification && (
                            <div style={{ fontSize: '7.5pt', color: '#4b5563', fontStyle: 'italic', marginTop: '1mm', lineHeight: 1.25, whiteSpace: 'normal', overflowWrap: 'anywhere' }}>
                              "{t.justification}"
                            </div>
                          )}
                          <div style={{ fontSize: '7.5pt', color: '#6b7280', marginTop: '1mm' }}>
                            Zona: <strong style={{ color: '#111827' }}>{t.zone}</strong> &nbsp;|&nbsp; 
                            Supervisor: <strong style={{ color: '#111827' }}>{t.responsable || 'S/A'}</strong> 
                            {t.executedBy ? ` (${t.executedBy})` : ''}
                          </div>
                        </td>

                        {/* Col 2: IMPACTO */}
                        <td 
                          style={{ 
                            padding: '2.5mm 1.5mm', 
                            verticalAlign: 'top', 
                            textAlign: 'center', 
                            borderRight: '1px solid #d1d5db'
                          }}
                        >
                          {t.impacts.map(imp => (
                            <div key={imp} style={{ fontSize: '7.5pt', fontWeight: 'bold', color: '#374151', marginBottom: '0.8mm' }}>
                              {imp}
                            </div>
                          ))}
                        </td>

                        {/* Col 3: RECURSOS */}
                        <td 
                          style={{ 
                            padding: '2.5mm 2mm', 
                            verticalAlign: 'top', 
                            textAlign: 'center', 
                            borderRight: '1.5px solid #6b7280'
                          }}
                        >
                          {t.requirements.map(req => (
                            <div key={req.specialty} style={{ fontSize: '8pt', fontWeight: 'bold', color: '#111827', marginBottom: '1mm' }}>
                              {req.specialty} {req.count}
                            </div>
                          ))}
                        </td>

                        {/* Day Columns */}
                        {pageDays.map(day => {
                          const dayIdx = day.dayIndex;
                          const dayReqs = getTaskRequirementsForDay(t, dayIdx);
                          const isOccupied = dayReqs.length > 0;

                          return (
                            <td
                              key={dayIdx}
                              style={{
                                padding: '2mm 2.5mm',
                                verticalAlign: 'top',
                                borderRight: '1px solid #d1d5db',
                                backgroundColor: isOccupied ? (isCritical ? '#fff5f5' : '#f8fafc') : 'transparent'
                              }}
                            >
                              {isOccupied && (
                                <div>
                                  {dayReqs.map(req => {
                                    const cInfo = getCompanyText(req);
                                    return (
                                      <div key={req.specialty} style={{ marginBottom: '1.8mm', lineHeight: 1.2 }}>
                                        <div style={{ fontSize: '8.5pt', fontWeight: 'bold', color: '#111827' }}>
                                          {req.specialty} {req.count}
                                        </div>
                                        <div 
                                          style={{ 
                                            fontSize: '7.5pt', 
                                            color: cInfo.isPending ? '#b45309' : '#374151',
                                            fontStyle: cInfo.isPending ? 'italic' : 'normal',
                                            fontWeight: cInfo.isPending ? 'bold' : 'normal',
                                            marginTop: '0.4mm'
                                          }}
                                        >
                                          {cInfo.text}
                                        </div>
                                      </div>
                                    );
                                  })}
                                </div>
                              )}
                            </td>
                          );
                        })}
                      </tr>
                    );
                  }

                  return null;
                })}
              </tbody>

              {/* Table Footer: Daily Summation */}
              {page.isLastVerticalPage && (
                <tfoot>
                  <tr style={{ backgroundColor: '#f3f4f6', borderTop: '2px solid #003366' }}>
                    <td 
                      colSpan={3}
                      style={{ 
                        padding: '2.5mm 3mm', 
                        textAlign: 'right', 
                        fontSize: '8.5pt', 
                        fontWeight: 'bold', 
                        color: '#003366', 
                        textTransform: 'uppercase',
                        borderRight: '1.5px solid #6b7280'
                      }}
                    >
                      Sumatoria Terceros (Día):
                    </td>
                    {pageDays.map(day => {
                      const dayIdx = day.dayIndex;
                      const activeSpecs = SPECIALTIES_LIST.filter(s => (dailyNeeds[dayIdx]?.[s] || 0) > 0);

                      return (
                        <td 
                          key={dayIdx}
                          style={{ 
                            padding: '2mm 2.5mm', 
                            backgroundColor: '#fff4ed', 
                            borderRight: '1px solid #d1d5db',
                            verticalAlign: 'top',
                            textAlign: 'center'
                          }}
                        >
                          {activeSpecs.map(spec => {
                            const st = getDaySpecialtyStatus(dayIdx, spec);
                            const availDisplay = st.available === null ? '—' : st.available;
                            return (
                              <div
                                key={spec}
                                style={{
                                  fontSize: '7.5pt',
                                  fontWeight: 'bold',
                                  color: st.isOverloaded ? '#d92d20' : '#ff6600',
                                  lineHeight: 1.25,
                                  marginBottom: '0.8mm'
                                }}
                              >
                                {spec} {st.needed}/{availDisplay}
                                {st.isOverloaded && ` (⚠ -${st.deficit})`}
                              </div>
                            );
                          })}
                        </td>
                      );
                    })}
                  </tr>
                </tfoot>
              )}
            </table>

            {/* 3. SIMPLE FOOTER */}
            <div 
              style={{ 
                borderTop: '1px solid #d1d5db', 
                paddingTop: '2.5mm', 
                marginTop: '4mm', 
                display: 'flex', 
                justifyContent: 'space-between', 
                fontSize: '8pt', 
                color: '#6b7280'
              }}
            >
              <div>
                Planner de Mantenimiento General &nbsp;|&nbsp; Intervención: <strong style={{ color: '#111827' }}>{parada.title}</strong>
              </div>
              <div>
                Página <strong>{page.pageNumber}</strong> de <strong>{page.totalDocumentPages}</strong>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
};
