import React, { useState, useEffect, useCallback } from 'react';
import {
  FileCheck2,
  Download,
  Printer,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Cpu,
  RefreshCw,
  ShieldCheck,
  Ruler,
  Award,
  Wrench,
  BarChart3,
  Camera,
  Briefcase,
  ClipboardCheck,
  Sliders,
  Eye
} from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  PieChart,
  Pie,
  Cell
} from 'recharts';
import { API_BASE_URL } from '../config';
import { useSimulation } from '../context/SimulationContext';

const CHART_COLORS = ['#DC2626', '#EA580C', '#2563EB', '#7C3AED', '#0D9488'];

export default function ReportPage() {
  const { recentDetections } = useSimulation();

  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [downloadingPdf, setDownloadingPdf] = useState(false);
  const [scope, setScope] = useState('latest_session');
  const [showAllLogs, setShowAllLogs] = useState(false);

  // Optional factory configuration inputs for roll length & financial calculation
  const [showConfigPanel, setShowConfigPanel] = useState(false);
  const [rollLengthInput, setRollLengthInput] = useState('');
  const [fabricPriceInput, setFabricPriceInput] = useState('');
  const [reworkCostInput, setReworkCostInput] = useState('');

  const buildQueryParams = useCallback(() => {
    const params = new URLSearchParams();
    params.set('scope', scope);
    if (rollLengthInput && Number(rollLengthInput) > 0) {
      params.set('roll_length_m', String(Number(rollLengthInput)));
    }
    if (fabricPriceInput && Number(fabricPriceInput) > 0) {
      params.set('fabric_price_per_m', String(Number(fabricPriceInput)));
    }
    if (reworkCostInput && Number(reworkCostInput) > 0) {
      params.set('rework_cost_per_m', String(Number(reworkCostInput)));
    }
    return params.toString();
  }, [scope, rollLengthInput, fabricPriceInput, reworkCostInput]);

  const fetchReport = useCallback(async () => {
    setLoading(true);
    try {
      const qs = buildQueryParams();
      const res = await fetch(`${API_BASE_URL}/api/report?${qs}`);
      if (res.ok) {
        const data = await res.json();
        setReport(data);
      }
    } catch (err) {
      console.error('Failed to load quality report:', err);
    } finally {
      setLoading(false);
    }
  }, [buildQueryParams]);

  useEffect(() => {
    fetchReport();
  }, [fetchReport, recentDetections?.length]);

  // 1. Download Native Multi-Page PDF from Backend (/api/report/pdf)
  const handleDownloadPDF = async () => {
    setDownloadingPdf(true);
    try {
      const qs = buildQueryParams();
      const res = await fetch(`${API_BASE_URL}/api/report/pdf?${qs}`);
      if (!res.ok) throw new Error('PDF generation failed');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const reportId = report?.summary?.report_id || 'WK-RPT';
      a.download = `${reportId}_Weave_Kiran_Quality_Report.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Direct PDF download failed, falling back to browser print:', err);
      handlePrintReport();
    } finally {
      setDownloadingPdf(false);
    }
  };

  // 2. Download Excel-Compatible CSV Report
  const handleDownloadCSV = () => {
    if (!report) return;
    const s = report.summary;
    const lines = [
      [report.title],
      [report.subtitle],
      ['Report ID', s.report_id],
      ['Loom ID', s.loom_id],
      ['Roll ID', s.roll_id],
      ['Inspection Start', s.inspection_start_display],
      ['Inspection End', s.inspection_end_display],
      ['Report Generated', s.report_generated_display],
      ['Active Duration', s.inspection_duration_display],
      ['Total Fabric Inspected', s.total_fabric_inspected_display],
      ['Total Defects Detected', s.total_defects],
      ['High / Medium / Low Defects', `${s.high_defects} High / ${s.medium_defects} Medium / ${s.low_defects} Low`],
      ['Defect-Free Fabric %', s.defect_free_display],
      ['Final Fabric Quality Grade', s.quality_grade],
      ['Final Inspection Status', s.final_status],
      ['Executive Summary', `"${s.plain_english_summary}"`],
      [],
      ['SECTION 2 - UNDERSTAND THE DEFECTS'],
      ['Defect Name', 'Number of Defects', 'Share (%)', 'Severity', 'What Does It Mean?', 'Why Does It Matter?', 'What Should the Factory Do?'],
      ...report.defect_breakdown.rows.map(r => [
        r.defect_name,
        r.count,
        `${r.share_pct}%`,
        `"${r.severity}"`,
        `"${r.what_it_means}"`,
        `"${r.why_it_matters}"`,
        `"${r.factory_action}"`
      ]),
      [],
      ['SECTION 4 - COMMERCIAL FABRIC QUALITY DECISION'],
      ['Category', 'Fabric Quantity', 'Calculation Basis', 'Explanation'],
      ...report.quality_decision.rows.map(q => [
        q.category,
        `"${q.quantity}"`,
        `"${q.basis}"`,
        `"${q.meaning}"`
      ]),
      [],
      ['SECTION 5 - BUSINESS IMPACT ANALYSIS'],
      ['Business Metric', 'Value', 'Data Classification', 'Notes'],
      ...report.business_impact.rows.map(b => [
        b.metric,
        `"${b.value}"`,
        b.classification,
        `"${b.notes}"`
      ]),
      [],
      ['SECTION 6 - RECOMMENDED FACTORY ACTIONS'],
      ['Step', 'Priority', 'Action Title', 'Detailed Instruction'],
      ...report.recommendations.map((rec, i) => [
        i + 1,
        rec.priority,
        `"${rec.title}"`,
        `"${rec.detail}"`
      ]),
      [],
      ['SECTION 7 - COMPLETE DEFECT POSITION & DETECTION LOG'],
      ['#', 'Unique Event ID', 'Timestamp', 'Defect Type', 'Confidence (%)', 'Severity', 'Meter Position', 'Bounding Box (px)'],
      ...report.defect_log.map(d => [
        d.index,
        d.event_id,
        `"${d.timestamp_display}"`,
        d.defect_name,
        `${d.confidence_pct}%`,
        d.severity,
        d.meter_position,
        `"${d.bbox_display}"`
      ])
    ];

    const csvContent = '\uFEFF' + lines.map(row => row.join(',')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${s.report_id}_Weave_Kiran_Quality_Report.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // 3. Browser Print View (Clean Multi-Page Print Layout)
  const handlePrintReport = () => {
    if (!report) return;
    const s = report.summary;
    const td = report.technical_details;
    const qav = report.qa_verification;
    const mf = report.defect_breakdown.most_frequent_defect;

    const printWindow = window.open('', '_blank', 'width=1024,height=840');
    if (!printWindow) {
      window.print();
      return;
    }

    const statusColor =
      s.verdict_level === 'PASS' ? '#15803D' : s.verdict_level === 'CONDITIONAL' ? '#D97706' : '#DC2626';
    const statusBg =
      s.verdict_level === 'PASS' ? '#DCFCE7' : s.verdict_level === 'CONDITIONAL' ? '#FEF3C7' : '#FEE2E2';

    const defectSummaryRowsHtml = report.defect_breakdown.rows
      .map(
        r => `
        <tr>
          <td><strong>${r.defect_name}</strong> ${mf && mf.defect_name === r.defect_name && r.count > 0 ? '<span style="color:#DC2626;font-size:10px;font-weight:800;">(Most Frequent)</span>' : ''}</td>
          <td style="text-align:center;"><strong>${r.count}</strong> (${r.share_pct}%)</td>
          <td>${r.severity}</td>
          <td>${r.what_it_means}</td>
          <td>${r.why_it_matters}</td>
          <td>${r.factory_action}</td>
        </tr>`
      )
      .join('');

    const barSvgRowsHtml = report.defect_breakdown.rows
      .map((r, i) => {
        const widthPct = Math.max(2, r.share_pct);
        const col = CHART_COLORS[i % CHART_COLORS.length];
        return `
          <div style="display:flex;align-items:center;margin-bottom:6px;font-size:11px;">
            <div style="width:155px;font-weight:700;">${r.defect_name}</div>
            <div style="flex:1;background:#E2E8F0;height:14px;border-radius:4px;overflow:hidden;margin:0 10px;">
              <div style="width:${widthPct}%;background:${col};height:100%;"></div>
            </div>
            <div style="width:85px;text-align:right;font-weight:800;">${r.count} (${r.share_pct}%)</div>
          </div>`;
      })
      .join('');

    const decisionRowsHtml = report.quality_decision.rows
      .map(
        q => `
        <tr>
          <td><strong>${q.category}</strong></td>
          <td><strong>${q.quantity}</strong></td>
          <td>${q.basis}</td>
          <td>${q.meaning}</td>
        </tr>`
      )
      .join('');

    const majorRowsHtml = report.quality_decision.major_defect_locations
      .map(
        m => `
        <tr>
          <td style="font-family:monospace;">${m.event_id}</td>
          <td><strong>${m.defect_name}</strong></td>
          <td><strong>${m.confidence_pct}%</strong></td>
          <td>${m.timestamp_display}</td>
          <td>${m.meter_position}</td>
          <td style="font-family:monospace;">${m.bbox_display}</td>
        </tr>`
      )
      .join('');

    const businessRowsHtml = report.business_impact.rows
      .map(
        b => `
        <tr>
          <td><strong>${b.metric}</strong></td>
          <td><strong>${b.value}</strong></td>
          <td>${b.classification}</td>
          <td>${b.notes}</td>
        </tr>`
      )
      .join('');

    const recRowsHtml = report.recommendations
      .map(
        (rec, i) => `
        <tr>
          <td style="text-align:center;"><strong>#${i + 1}</strong></td>
          <td><strong>${rec.priority}</strong></td>
          <td><strong>${rec.title}</strong></td>
          <td>${rec.detail}</td>
        </tr>`
      )
      .join('');

    const logRowsHtml = report.defect_log
      .map(
        d => `
        <tr>
          <td>${d.index}</td>
          <td style="font-family:monospace;">${d.event_id}</td>
          <td>${d.timestamp_display}</td>
          <td><strong>${d.defect_name}</strong></td>
          <td>${d.confidence_pct}%</td>
          <td><strong>${d.severity}</strong></td>
          <td>${d.meter_position}</td>
          <td style="font-family:monospace;">${d.bbox_display}</td>
        </tr>`
      )
      .join('');

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>${s.report_id} - ${report.title}</title>
        <style>
          @page { size: A4; margin: 14mm; }
          body { font-family: 'Segoe UI', Arial, sans-serif; color: #0F172A; background: #FFFFFF; margin: 0; padding: 16px; line-height: 1.45; font-size: 12px; }
          .header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 3px solid #EA580C; padding-bottom: 12px; margin-bottom: 14px; }
          .title { font-size: 20px; font-weight: 900; color: #0F172A; margin: 0; }
          .subtitle { font-size: 12px; color: #475569; margin-top: 2px; }
          .kpi-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; margin-bottom: 12px; }
          .kpi { border: 1px solid #CBD5E1; border-radius: 8px; padding: 10px; background: #F8FAFC; }
          .kpi-lbl { font-size: 10px; color: #64748B; text-transform: uppercase; font-weight: 800; }
          .kpi-val { font-size: 16px; font-weight: 900; color: #0F172A; margin-top: 3px; }
          .exec-box { background: ${statusBg}; border: 1.5px solid ${statusColor}; border-radius: 8px; padding: 12px 14px; margin: 12px 0; }
          h2 { font-size: 13px; text-transform: uppercase; color: #EA580C; border-bottom: 1px solid #E2E8F0; padding-bottom: 4px; margin: 18px 0 8px 0; page-break-after: avoid; }
          table { width: 100%; border-collapse: collapse; font-size: 11px; margin-bottom: 10px; }
          thead { display: table-header-group; }
          tr { page-break-inside: avoid; }
          th, td { border: 1px solid #CBD5E1; padding: 6px 8px; text-align: left; vertical-align: top; }
          th { background: #F1F5F9; font-weight: 800; }
          .page-break { page-break-before: always; }
        </style>
      </head>
      <body>
        <div class="header">
          <div>
            <h1 class="title">${report.title}</h1>
            <div class="subtitle">${report.subtitle}</div>
          </div>
          <div style="text-align:right;font-size:11px;">
            <div><strong>Report ID:</strong> ${s.report_id}</div>
            <div><strong>Generated:</strong> ${s.report_generated_display}</div>
            <div><strong>Loom / Roll:</strong> ${s.loom_id} / ${s.roll_id}</div>
          </div>
        </div>

        <h2>Section 1 – Inspection Summary</h2>
        <div class="kpi-grid">
          <div class="kpi">
            <div class="kpi-lbl">Total Fabric Inspected</div>
            <div class="kpi-val">${s.total_fabric_inspected_display}</div>
          </div>
          <div class="kpi">
            <div class="kpi-lbl">Total Defects Detected</div>
            <div class="kpi-val" style="color:#DC2626;">${s.total_defects} <span style="font-size:11px;color:#64748B;">(${s.high_defects} High)</span></div>
          </div>
          <div class="kpi">
            <div class="kpi-lbl">Defect-Free Fabric %</div>
            <div class="kpi-val" style="color:#15803D;">${s.defect_free_display}</div>
          </div>
          <div class="kpi">
            <div class="kpi-lbl">Final Quality Grade</div>
            <div class="kpi-val" style="color:#EA580C;">${s.quality_grade}</div>
          </div>
        </div>

        <table>
          <tbody>
            <tr>
              <td><strong>Report ID:</strong> ${s.report_id}</td>
              <td><strong>Loom ID:</strong> ${s.loom_id}</td>
              <td><strong>Roll ID:</strong> ${s.roll_id}</td>
            </tr>
            <tr>
              <td><strong>Inspection Date & Time:</strong> ${s.inspection_start_display} – ${s.inspection_end_display}</td>
              <td><strong>Inspection Duration:</strong> ${s.inspection_duration_display}</td>
              <td><strong>Final Status:</strong> <strong>${s.final_status}</strong></td>
            </tr>
          </tbody>
        </table>

        <div class="exec-box">
          <div><strong>Executive Summary:</strong> ${s.plain_english_summary}</div>
          <div style="font-size:11px;color:#475569;margin-top:6px;"><strong>How Grade & Defect-Free % Are Calculated:</strong> ${s.grade_explanation} ${s.defect_free_note}</div>
        </div>

        <h2>Section 2 – Understand the Defects</h2>
        <div style="border:1px solid #E2E8F0;background:#F8FAFC;border-radius:8px;padding:10px 14px;margin-bottom:10px;">
          <div style="font-weight:800;margin-bottom:8px;">Defect Distribution Chart</div>
          ${barSvgRowsHtml}
        </div>
        <table>
          <thead>
            <tr>
              <th>Defect Name</th>
              <th>Number of Defects</th>
              <th>Severity</th>
              <th>What Does It Mean?</th>
              <th>Why Does It Matter?</th>
              <th>What Should the Factory Do?</th>
            </tr>
          </thead>
          <tbody>${defectSummaryRowsHtml}</tbody>
        </table>

        <h2>Section 3 – Visual Inspection Evidence</h2>
        <div style="border:1px solid #F97316;background:#FFF7ED;border-radius:8px;padding:10px 12px;margin-bottom:10px;">
          ${report.visual_evidence.notice}
        </div>

        <h2>Section 4 – Fabric Quality Decision</h2>
        <table>
          <thead>
            <tr>
              <th>Category</th>
              <th>Fabric Quantity</th>
              <th>Calculation Basis</th>
              <th>What This Decision Means</th>
            </tr>
          </thead>
          <tbody>${decisionRowsHtml}</tbody>
        </table>

        <div style="font-weight:800;margin:8px 0 4px 0;">Locations of All Major (High-Severity) Defects (${report.quality_decision.major_defect_locations.length} found):</div>
        <table>
          <thead>
            <tr>
              <th>Event ID</th>
              <th>Defect Name</th>
              <th>Confidence</th>
              <th>Detection Time</th>
              <th>Meter Position</th>
              <th>Camera Pixel Bounding Box</th>
            </tr>
          </thead>
          <tbody>${majorRowsHtml || '<tr><td colspan="6">No High-severity defects recorded.</td></tr>'}</tbody>
        </table>

        <h2>Section 5 – Business Impact</h2>
        <table>
          <thead>
            <tr>
              <th>Business Metric</th>
              <th>Value</th>
              <th>Data Classification</th>
              <th>Explanation & Basis</th>
            </tr>
          </thead>
          <tbody>${businessRowsHtml}</tbody>
        </table>

        <h2>Section 6 – Recommended Factory Actions</h2>
        <table>
          <thead>
            <tr>
              <th>Step</th>
              <th>Priority</th>
              <th>Recommended Action</th>
              <th>Execution Detail</th>
            </tr>
          </thead>
          <tbody>${recRowsHtml}</tbody>
        </table>

        <h2>QA Verification & Final Approval Sign-Off</h2>
        <table>
          <thead>
            <tr>
              <th>Final Inspection Verification</th>
              <th>QA Inspector Sign-Off</th>
              <th>Production / Dispatch Approval</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>
                <strong>Final Status:</strong> ${qav.approval_status}<br/>
                <strong>Final Grade:</strong> ${qav.quality_grade}<br/>
                <strong>Audit:</strong> ${qav.system_verification}
              </td>
              <td>
                <strong>Role:</strong> ${qav.inspector_role}<br/><br/>
                <strong>Signature:</strong> _____________________
              </td>
              <td>
                <strong>Role:</strong> ${qav.manager_role}<br/><br/>
                <strong>Signature:</strong> _____________________
              </td>
            </tr>
          </tbody>
        </table>

        <div class="page-break"></div>
        <h2>Section 7 – Technical Details & Complete Defect Detection Log</h2>
        <table>
          <tbody>
            <tr><td><strong>YOLO Model Name</strong></td><td>${td.ai_model_name}</td></tr>
            <tr><td><strong>Model Weights (best.pt)</strong></td><td>${td.weights_file} (Mean Confidence: ${td.mean_confidence_pct}%, Peak: ${td.peak_confidence_pct}%)</td></tr>
            <tr><td><strong>Image Resolution</strong></td><td>${td.image_resolution}</td></tr>
            <tr><td><strong>Detection Confidence</strong></td><td>${td.confidence_threshold}</td></tr>
            <tr><td><strong>IoU Threshold</strong></td><td>${td.iou_threshold}</td></tr>
            <tr><td><strong>Defect Tracking Methodology</strong></td><td>${td.tracking_methodology}</td></tr>
            <tr><td><strong>Fabric Grading Methodology</strong></td><td>${td.grading_methodology_note}</td></tr>
            <tr><td><strong>Camera Information</strong></td><td>${td.camera_info}</td></tr>
            <tr><td><strong>Arduino Integration</strong></td><td>${td.arduino_integration}</td></tr>
            <tr><td><strong>System Verification</strong></td><td>${td.system_verification}</td></tr>
          </tbody>
        </table>

        <div style="font-weight:800;margin:10px 0 4px 0;">Complete Defect Detection Log (${report.defect_log.length} actual database records):</div>
        <table>
          <thead>
            <tr>
              <th>#</th>
              <th>Unique Event ID</th>
              <th>Timestamp</th>
              <th>Defect Type</th>
              <th>Confidence</th>
              <th>Severity</th>
              <th>Meter Pos</th>
              <th>Bounding Box (px)</th>
            </tr>
          </thead>
          <tbody>${logRowsHtml}</tbody>
        </table>

        <script>
          window.onload = function() { setTimeout(function() { window.print(); }, 300); };
        </script>
      </body>
      </html>
    `);
    printWindow.document.close();
  };

  if (loading && !report) {
    return (
      <div className="h-full flex items-center justify-center p-8 bg-[#F5F6F8]">
        <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-xs flex items-center gap-3">
          <RefreshCw className="w-5 h-5 text-[#EA580C] animate-spin" />
          <span className="text-sm font-bold text-slate-700">
            Generating Industrial Fabric Quality & Inspection Report from Database...
          </span>
        </div>
      </div>
    );
  }

  if (!report) return null;

  const s = report.summary;
  const mf = report.defect_breakdown.most_frequent_defect;
  const ve = report.visual_evidence;
  const qd = report.quality_decision;
  const bi = report.business_impact;
  const td = report.technical_details;
  const qav = report.qa_verification;
  const allLogs = report.defect_log || [];
  const visibleLogs = showAllLogs ? allLogs : allLogs.slice(0, 30);
  const pieData = report.defect_breakdown.rows.filter(r => r.count > 0);

  return (
    <div className="h-full overflow-y-auto p-4 md:p-6 flex flex-col gap-5 bg-[#F5F6F8]">
      {/* REPORT HEADER & ACTIONS BAR */}
      <div className="bg-white rounded-2xl p-5 border border-[#E5E7EB] shadow-xs flex flex-col xl:flex-row xl:items-center justify-between gap-4">
        <div className="flex items-start gap-3.5">
          <div
            style={{ backgroundColor: '#EA580C', color: '#FFFFFF' }}
            className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 shadow-sm"
          >
            <FileCheck2 className="w-6 h-6 stroke-[2.2]" />
          </div>
          <div>
            <h1 className="text-lg md:text-xl font-black text-[#0F172A] tracking-tight">
              {report.title}
            </h1>
            <p className="text-xs font-semibold text-[#475569] mt-0.5">
              {report.subtitle}
            </p>
            <div className="flex flex-wrap items-center gap-2 mt-2">
              <span className="text-[11px] font-bold text-slate-600 bg-slate-100 px-2.5 py-0.5 rounded-md border border-slate-200">
                Scope: {report.scope_label}
              </span>
              <span className="text-[11px] font-mono font-bold text-emerald-800 bg-emerald-50 px-2.5 py-0.5 rounded-md border border-emerald-200">
                Database Verified: {report.total_db_records} Total Stored Records
              </span>
            </div>
          </div>
        </div>

        {/* Scope Selector & Download Buttons */}
        <div className="flex flex-wrap items-center gap-2.5">
          <select
            value={scope}
            onChange={e => setScope(e.target.value)}
            className="px-3 py-2 text-xs font-bold rounded-xl border border-slate-300 bg-slate-50 text-[#0F172A] focus:outline-none focus:border-[#EA580C]"
          >
            <option value="latest_session">Latest Inspection Session</option>
            <option value="all">All Stored Records ({report.total_db_records})</option>
            {(report.available_dates || []).map(d => (
              <option key={d.date} value={`date:${d.date}`}>
                Session {d.date} ({d.count} records)
              </option>
            ))}
          </select>

          <button
            type="button"
            onClick={() => setShowConfigPanel(prev => !prev)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-xs font-bold text-slate-700 cursor-pointer whitespace-nowrap"
          >
            <Sliders className="w-3.5 h-3.5 text-[#EA580C]" />
            <span>Roll & Cost Params</span>
          </button>

          <button
            type="button"
            onClick={handleDownloadPDF}
            disabled={downloadingPdf}
            style={{ backgroundColor: '#EA580C', color: '#FFFFFF', padding: '8px 16px' }}
            className="flex items-center gap-2 rounded-xl text-xs font-extrabold shadow-sm transition-all cursor-pointer whitespace-nowrap disabled:opacity-60"
          >
            <Download className="w-4 h-4 flex-shrink-0" />
            <span>{downloadingPdf ? 'Generating PDF…' : 'Download PDF Report'}</span>
          </button>

          <button
            type="button"
            onClick={handlePrintReport}
            style={{ backgroundColor: '#1E293B', color: '#FFFFFF', padding: '8px 14px' }}
            className="flex items-center gap-1.5 rounded-xl text-xs font-extrabold shadow-sm transition-all cursor-pointer whitespace-nowrap"
          >
            <Printer className="w-4 h-4 flex-shrink-0" />
            <span>Print View</span>
          </button>

          <button
            type="button"
            onClick={handleDownloadCSV}
            style={{ backgroundColor: '#0F172A', color: '#FFFFFF', padding: '8px 14px' }}
            className="flex items-center gap-1.5 rounded-xl text-xs font-extrabold shadow-sm transition-all cursor-pointer whitespace-nowrap"
          >
            <Download className="w-4 h-4 flex-shrink-0" />
            <span>Export CSV</span>
          </button>
        </div>
      </div>

      {/* Optional Roll Length & Pricing Configuration Bar */}
      {showConfigPanel && (
        <div className="bg-white rounded-2xl p-4 border border-orange-200 shadow-xs flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div className="flex-1 grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-[11px] font-bold text-slate-600 mb-1">
                Configured Roll Length (metres)
              </label>
              <input
                type="number"
                min="0"
                step="0.5"
                placeholder="e.g. 100 (leave blank if unmeasured)"
                value={rollLengthInput}
                onChange={e => setRollLengthInput(e.target.value)}
                className="w-full px-3 py-1.5 text-xs rounded-lg border border-slate-300"
              />
            </div>
            <div>
              <label className="block text-[11px] font-bold text-slate-600 mb-1">
                Factory Fabric Price (INR / metre)
              </label>
              <input
                type="number"
                min="0"
                step="10"
                placeholder="e.g. 250 (optional)"
                value={fabricPriceInput}
                onChange={e => setFabricPriceInput(e.target.value)}
                className="w-full px-3 py-1.5 text-xs rounded-lg border border-slate-300"
              />
            </div>
            <div>
              <label className="block text-[11px] font-bold text-slate-600 mb-1">
                Rework Cost Rate (INR / metre)
              </label>
              <input
                type="number"
                min="0"
                step="5"
                placeholder="e.g. 35 (optional)"
                value={reworkCostInput}
                onChange={e => setReworkCostInput(e.target.value)}
                className="w-full px-3 py-1.5 text-xs rounded-lg border border-slate-300"
              />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={fetchReport}
              style={{ backgroundColor: '#EA580C', color: '#FFFFFF', padding: '7px 14px' }}
              className="rounded-lg text-xs font-bold cursor-pointer"
            >
              Apply Parameters
            </button>
            <button
              type="button"
              onClick={() => {
                setRollLengthInput('');
                setFabricPriceInput('');
                setReworkCostInput('');
              }}
              className="px-3 py-1.5 rounded-lg border border-slate-300 text-xs font-bold text-slate-600 cursor-pointer"
            >
              Reset to Hardware Only
            </button>
          </div>
        </div>
      )}

      {/* ==================== SECTION 1: INSPECTION SUMMARY ==================== */}
      <div className="bg-white rounded-2xl p-5 border border-[#E5E7EB] shadow-xs flex flex-col gap-4">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2.5">
            <Award className="w-5 h-5 text-[#EA580C]" />
            <h2 className="text-sm font-black text-[#0F172A] uppercase tracking-wide">
              Section 1 – Inspection Summary
            </h2>
          </div>
          <span
            className={`px-3 py-1 rounded-full text-xs font-black ${
              s.verdict_level === 'PASS'
                ? 'bg-emerald-100 text-emerald-800'
                : s.verdict_level === 'CONDITIONAL'
                ? 'bg-amber-100 text-amber-800'
                : 'bg-red-100 text-red-800'
            }`}
          >
            {s.final_status}
          </span>
        </div>

        {/* 4 Main KPI Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
          <div className="rounded-xl p-4 bg-slate-50 border border-slate-200">
            <div className="flex items-center justify-between text-[11px] font-bold text-slate-500 uppercase">
              <span>Total Fabric Inspected</span>
              <Ruler className="w-4 h-4 text-[#EA580C]" />
            </div>
            <div className="text-xl font-black text-[#0F172A] mt-1.5">
              {s.total_fabric_inspected_display}
            </div>
            <div className="text-[11px] text-slate-500 mt-0.5">{s.length_source}</div>
          </div>

          <div className="rounded-xl p-4 bg-slate-50 border border-slate-200">
            <div className="flex items-center justify-between text-[11px] font-bold text-slate-500 uppercase">
              <span>Total Defects Detected</span>
              <AlertTriangle className="w-4 h-4 text-red-600" />
            </div>
            <div className="text-xl font-black text-red-600 mt-1.5">
              {s.total_defects}
            </div>
            <div className="text-[11px] text-slate-600 font-semibold mt-0.5">
              {s.high_defects} High • {s.medium_defects} Medium • {s.low_defects} Low
            </div>
          </div>

          <div className="rounded-xl p-4 bg-slate-50 border border-slate-200">
            <div className="flex items-center justify-between text-[11px] font-bold text-slate-500 uppercase">
              <span>Defect-Free Fabric %</span>
              <ShieldCheck className="w-4 h-4 text-emerald-600" />
            </div>
            <div className="text-xl font-black text-emerald-700 mt-1.5">
              {s.defect_free_display}
            </div>
            <div className="text-[11px] text-slate-500 mt-0.5">Verified quality ratio</div>
          </div>

          <div className="rounded-xl p-4 bg-slate-50 border border-slate-200">
            <div className="flex items-center justify-between text-[11px] font-bold text-slate-500 uppercase">
              <span>Final Fabric Quality Grade</span>
              <Award className="w-4 h-4 text-[#EA580C]" />
            </div>
            <div className="text-xl font-black text-[#EA580C] mt-1.5">
              {s.quality_grade}
            </div>
            <div className="text-[11px] text-slate-600 font-semibold mt-0.5">{s.final_status}</div>
          </div>
        </div>

        {/* Metadata Strip */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2.5 text-xs bg-slate-50/70 p-3.5 rounded-xl border border-slate-200">
          <div>
            <span className="text-[10px] font-bold uppercase text-slate-400 block">Report ID</span>
            <span className="font-mono font-bold text-[#0F172A]">{s.report_id}</span>
          </div>
          <div>
            <span className="text-[10px] font-bold uppercase text-slate-400 block">Loom ID</span>
            <span className="font-bold text-[#0F172A]">{s.loom_id}</span>
          </div>
          <div>
            <span className="text-[10px] font-bold uppercase text-slate-400 block">Roll ID</span>
            <span className="font-bold text-[#0F172A]">{s.roll_id}</span>
          </div>
          <div>
            <span className="text-[10px] font-bold uppercase text-slate-400 block">Inspection Date & Time</span>
            <span className="font-semibold text-[#0F172A]">{s.inspection_end_display}</span>
          </div>
          <div>
            <span className="text-[10px] font-bold uppercase text-slate-400 block">Inspection Duration</span>
            <span className="font-semibold text-[#0F172A]">{s.inspection_duration_display}</span>
          </div>
          <div>
            <span className="text-[10px] font-bold uppercase text-slate-400 block">Final Status</span>
            <span className="font-bold text-[#EA580C]">{s.final_status}</span>
          </div>
        </div>

        {/* Dynamic Plain-English Explanation Box */}
        <div
          className={`rounded-xl p-4 border-l-4 ${
            s.verdict_level === 'PASS'
              ? 'bg-emerald-50/70 border-emerald-600'
              : s.verdict_level === 'CONDITIONAL'
              ? 'bg-amber-50/70 border-amber-500'
              : 'bg-red-50/70 border-red-600'
          }`}
        >
          <div className="text-xs font-black uppercase tracking-wider text-slate-700 mb-1">
            Executive Summary (Plain English)
          </div>
          <p className="text-sm font-semibold text-[#0F172A] leading-relaxed">
            {s.plain_english_summary}
          </p>
          <div className="mt-2.5 pt-2.5 border-t border-slate-200/80 text-xs text-slate-600 space-y-1">
            <div>
              <strong>How Final Grade Is Calculated:</strong> {s.grade_explanation}
            </div>
            <div>
              <strong>How Defect-Free % Is Calculated:</strong> {s.defect_free_note}
            </div>
          </div>
        </div>
      </div>

      {/* ==================== SECTION 2: UNDERSTAND THE DEFECTS ==================== */}
      <div className="bg-white rounded-2xl p-5 border border-[#E5E7EB] shadow-xs flex flex-col gap-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2.5">
            <BarChart3 className="w-5 h-5 text-[#EA580C]" />
            <div>
              <h2 className="text-sm font-black text-[#0F172A] uppercase tracking-wide">
                Section 2 – Understand the Defects
              </h2>
              <p className="text-xs text-slate-500">
                Simple guide explaining what each defect is, why it matters, and what the factory should do
              </p>
            </div>
          </div>

          {mf && (
            <div className="px-3 py-1.5 rounded-xl bg-red-50 border border-red-200 text-xs font-bold text-red-800">
              Most Frequent Defect: <strong>{mf.defect_name}</strong> ({mf.count} detected — {mf.share_pct}%)
            </div>
          )}
        </div>

        {/* Defect Distribution Charts (Bar Chart + Pie Chart) */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="bg-slate-50 rounded-xl p-4 border border-slate-200">
            <div className="text-xs font-black text-slate-700 uppercase mb-2">
              Defect Count by Category (Bar Chart)
            </div>
            <div className="h-52 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={report.defect_breakdown.rows}
                  layout="vertical"
                  margin={{ top: 5, right: 24, left: 25, bottom: 5 }}
                >
                  <XAxis type="number" tick={{ fontSize: 11 }} />
                  <YAxis dataKey="defect_name" type="category" width={135} tick={{ fontSize: 11, fontWeight: 700 }} />
                  <Tooltip formatter={(val) => [`${val} defects`, 'Count']} />
                  <Bar dataKey="count" fill="#EA580C" radius={[0, 6, 6, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="bg-slate-50 rounded-xl p-4 border border-slate-200 flex flex-col">
            <div className="text-xs font-black text-slate-700 uppercase mb-2">
              Defect Share Distribution (Pie Chart)
            </div>
            <div className="h-52 w-full flex items-center">
              {pieData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={pieData}
                      dataKey="count"
                      nameKey="defect_name"
                      cx="50%"
                      cy="50%"
                      outerRadius={72}
                      label={({ defect_name, share_pct }) => `${defect_name}: ${share_pct}%`}
                    >
                      {pieData.map((entry, idx) => (
                        <Cell key={entry.defect_name} fill={CHART_COLORS[idx % CHART_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(val, name) => [`${val} defects`, name]} />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="w-full text-center text-xs font-bold text-emerald-700">
                  No Defects Detected (100% Clean)
                </div>
              )}
            </div>
          </div>
        </div>

        {/* 6-Column Simple Defect Summary Table */}
        <div className="overflow-x-auto border border-slate-200 rounded-xl">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-100 text-slate-700 font-extrabold uppercase border-b border-slate-200">
              <tr>
                <th className="py-3 px-3.5">Defect Name</th>
                <th className="py-3 px-3.5">Number of Defects</th>
                <th className="py-3 px-3.5">Severity</th>
                <th className="py-3 px-3.5">What Does It Mean?</th>
                <th className="py-3 px-3.5">Why Does It Matter?</th>
                <th className="py-3 px-3.5">What Should the Factory Do?</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {report.defect_breakdown.rows.map(row => {
                const isTop = mf && mf.defect_name === row.defect_name && row.count > 0;
                return (
                  <tr key={row.defect_name} className={isTop ? 'bg-red-50/40' : 'hover:bg-slate-50'}>
                    <td className="py-3 px-3.5 font-black text-[#0F172A]">
                      {row.defect_name}
                      {isTop && (
                        <span className="ml-1.5 inline-block px-2 py-0.5 text-[10px] font-black bg-red-100 text-red-700 rounded-full">
                          Most Frequent
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-3.5 font-extrabold text-[#0F172A]">
                      {row.count} <span className="text-slate-500 font-semibold">({row.share_pct}%)</span>
                    </td>
                    <td className="py-3 px-3.5 font-semibold text-slate-700">{row.severity}</td>
                    <td className="py-3 px-3.5 text-slate-700 leading-relaxed">{row.what_it_means}</td>
                    <td className="py-3 px-3.5 text-slate-700 leading-relaxed">{row.why_it_matters}</td>
                    <td className="py-3 px-3.5 font-semibold text-[#EA580C] leading-relaxed">
                      {row.factory_action}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* ==================== SECTION 3: VISUAL INSPECTION EVIDENCE ==================== */}
      <div className="bg-white rounded-2xl p-5 border border-[#E5E7EB] shadow-xs flex flex-col gap-4">
        <div className="flex items-center gap-2.5 border-b border-slate-100 pb-3">
          <Camera className="w-5 h-5 text-[#EA580C]" />
          <div>
            <h2 className="text-sm font-black text-[#0F172A] uppercase tracking-wide">
              Section 3 – Visual Inspection Evidence
            </h2>
            <p className="text-xs text-slate-500">
              Actual camera images and AI bounding-box detections captured by the inspection system
            </p>
          </div>
        </div>

        {ve.has_captured_images ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {ve.captured_images.map(item => (
              <div key={item.event_id} className="border border-slate-200 rounded-xl p-3.5 bg-slate-50 flex flex-col gap-3">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-black text-[#0F172A]">
                    {item.defect_name} — {item.confidence_pct}% Confidence
                  </span>
                  <span className="font-mono text-[11px] text-slate-500">
                    {item.event_id} • {item.meter_position}
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-2.5">
                  <div>
                    <div className="text-[10px] font-bold text-slate-500 uppercase mb-1">
                      Original Fabric Camera Image
                    </div>
                    {item.original_image ? (
                      <img
                        src={item.original_image}
                        alt="Original camera capture"
                        className="w-full h-36 object-cover rounded-lg border border-slate-300"
                      />
                    ) : (
                      <div className="h-36 rounded-lg border border-slate-300 flex items-center justify-center text-xs text-slate-400">
                        Not archived
                      </div>
                    )}
                  </div>
                  <div>
                    <div className="text-[10px] font-bold text-[#EA580C] uppercase mb-1">
                      AI-Detected Defect (Bounding Box)
                    </div>
                    {item.annotated_image ? (
                      <img
                        src={item.annotated_image}
                        alt="AI bounding box detection"
                        className="w-full h-36 object-cover rounded-lg border-2 border-[#EA580C]"
                      />
                    ) : (
                      <div className="h-36 rounded-lg border border-slate-300 flex items-center justify-center text-xs text-slate-400">
                        Not archived
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="rounded-xl p-4 bg-orange-50/80 border border-orange-200 text-xs text-slate-800 flex items-start gap-3">
            <Eye className="w-5 h-5 text-[#EA580C] flex-shrink-0 mt-0.5" />
            <div className="leading-relaxed">
              <div className="font-extrabold text-[#0F172A] mb-0.5">
                No Stored Camera Frame Bitmaps in Historical Database Records
              </div>
              {ve.notice}
            </div>
          </div>
        )}
      </div>

      {/* ==================== SECTION 4: FABRIC QUALITY DECISION ==================== */}
      <div className="bg-white rounded-2xl p-5 border border-[#E5E7EB] shadow-xs flex flex-col gap-4">
        <div className="flex items-center gap-2.5 border-b border-slate-100 pb-3">
          <CheckCircle2 className="w-5 h-5 text-[#EA580C]" />
          <div>
            <h2 className="text-sm font-black text-[#0F172A] uppercase tracking-wide">
              Section 4 – Fabric Quality Decision
            </h2>
            <p className="text-xs text-slate-500">{qd.policy_note}</p>
          </div>
        </div>

        <div className="overflow-x-auto border border-slate-200 rounded-xl">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-100 text-slate-700 font-extrabold uppercase border-b border-slate-200">
              <tr>
                <th className="py-3 px-4">Category</th>
                <th className="py-3 px-4">Fabric Quantity</th>
                <th className="py-3 px-4">Calculation Basis</th>
                <th className="py-3 px-4">What This Decision Means</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {qd.rows.map(row => (
                <tr key={row.category} className="hover:bg-slate-50">
                  <td className="py-3 px-4 font-black text-[#0F172A]">{row.category}</td>
                  <td className="py-3 px-4 font-extrabold text-[#EA580C]">{row.quantity}</td>
                  <td className="py-3 px-4 text-slate-600">{row.basis}</td>
                  <td className="py-3 px-4 text-slate-700 leading-relaxed">{row.meaning}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* All Major (HIGH severity) Defect Locations */}
        <div>
          <h3 className="text-xs font-black uppercase text-slate-700 mb-2">
            Locations of All Major (High-Severity ≥ 80% Confidence) Defects ({qd.major_defect_locations.length} Found)
          </h3>
          {qd.major_defect_locations.length > 0 ? (
            <div className="overflow-x-auto border border-red-200 rounded-xl">
              <table className="w-full text-left text-xs">
                <thead className="bg-red-50 text-red-900 font-extrabold uppercase border-b border-red-200">
                  <tr>
                    <th className="py-2.5 px-3">Unique Event ID</th>
                    <th className="py-2.5 px-3">Defect Name</th>
                    <th className="py-2.5 px-3">Confidence</th>
                    <th className="py-2.5 px-3">Detection Timestamp</th>
                    <th className="py-2.5 px-3">Meter Position</th>
                    <th className="py-2.5 px-3">Camera Pixel Bounding Box</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-red-100">
                  {qd.major_defect_locations.map(m => (
                    <tr key={m.event_id} className="hover:bg-red-50/40">
                      <td className="py-2.5 px-3 font-mono font-bold text-slate-700">{m.event_id}</td>
                      <td className="py-2.5 px-3 font-black text-red-700">{m.defect_name}</td>
                      <td className="py-2.5 px-3 font-extrabold text-[#0F172A]">{m.confidence_pct}%</td>
                      <td className="py-2.5 px-3 text-slate-600">{m.timestamp_display}</td>
                      <td className="py-2.5 px-3 font-mono font-semibold text-slate-700">{m.meter_position}</td>
                      <td className="py-2.5 px-3 font-mono text-[11px] text-slate-600">{m.bbox_display}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-xs font-bold text-emerald-800">
              No High-severity (≥ 80% confidence) major defects were detected in this scope.
            </div>
          )}
        </div>
      </div>

      {/* ==================== SECTION 5: BUSINESS IMPACT ==================== */}
      <div className="bg-white rounded-2xl p-5 border border-[#E5E7EB] shadow-xs flex flex-col gap-4">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2.5">
            <Briefcase className="w-5 h-5 text-[#EA580C]" />
            <div>
              <h2 className="text-sm font-black text-[#0F172A] uppercase tracking-wide">
                Section 5 – Business Impact Analysis
              </h2>
              <p className="text-xs text-slate-500">
                Clearly separates Actual Measured Results, Estimated Values (from factory inputs), and Not Available metrics
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setShowConfigPanel(true)}
            className="text-xs font-bold text-[#EA580C] hover:underline cursor-pointer"
          >
            Configure Roll Length & Fabric Price →
          </button>
        </div>

        <div className="overflow-x-auto border border-slate-200 rounded-xl">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-100 text-slate-700 font-extrabold uppercase border-b border-slate-200">
              <tr>
                <th className="py-3 px-4">Business Metric</th>
                <th className="py-3 px-4">Result / Value</th>
                <th className="py-3 px-4">Data Classification</th>
                <th className="py-3 px-4">Explanation & Basis</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {bi.rows.map(row => (
                <tr key={row.metric} className="hover:bg-slate-50">
                  <td className="py-3 px-4 font-black text-[#0F172A]">{row.metric}</td>
                  <td className="py-3 px-4 font-extrabold text-[#0F172A]">{row.value}</td>
                  <td className="py-3 px-4">
                    <span
                      className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase ${
                        row.classification.startsWith('Actual')
                          ? 'bg-emerald-100 text-emerald-800'
                          : row.classification.startsWith('Not')
                          ? 'bg-slate-100 text-slate-600'
                          : 'bg-amber-100 text-amber-800'
                      }`}
                    >
                      {row.classification}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-slate-600">{row.notes}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* ==================== SECTION 6: RECOMMENDED FACTORY ACTIONS & QA VERIFICATION ==================== */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        <div className="lg:col-span-7 bg-white rounded-2xl p-5 border border-[#E5E7EB] shadow-xs flex flex-col gap-3.5">
          <div className="flex items-center gap-2.5 border-b border-slate-100 pb-3">
            <Wrench className="w-5 h-5 text-[#EA580C]" />
            <div>
              <h2 className="text-sm font-black text-[#0F172A] uppercase tracking-wide">
                Section 6 – Recommended Factory Actions
              </h2>
              <p className="text-xs text-slate-500">
                Step-by-step actions generated dynamically from the detected defects
              </p>
            </div>
          </div>

          <div className="flex flex-col gap-2.5">
            {report.recommendations.map((rec, i) => (
              <div key={i} className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 flex items-start gap-3">
                <span
                  style={{ backgroundColor: '#EA580C', color: '#FFFFFF' }}
                  className="w-6 h-6 rounded-full font-black text-xs flex items-center justify-center flex-shrink-0 mt-0.5"
                >
                  {i + 1}
                </span>
                <div className="text-xs">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-black text-[#0F172A]">{rec.title}</span>
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-orange-100 text-[#EA580C]">
                      {rec.priority}
                    </span>
                  </div>
                  <p className="text-slate-600 mt-1 leading-relaxed">{rec.detail}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Point 12: QA Verification & Inspector Sign-Off */}
        <div className="lg:col-span-5 bg-white rounded-2xl p-5 border border-[#E5E7EB] shadow-xs flex flex-col justify-between gap-4">
          <div className="flex flex-col gap-3">
            <div className="flex items-center gap-2.5 border-b border-slate-100 pb-3">
              <ClipboardCheck className="w-5 h-5 text-[#EA580C]" />
              <div>
                <h2 className="text-sm font-black text-[#0F172A] uppercase tracking-wide">
                  QA Verification & Final Sign-Off
                </h2>
                <p className="text-xs text-slate-500">
                  Official quality approval and inspector verification block
                </p>
              </div>
            </div>

            <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 text-xs space-y-2">
              <div className="flex justify-between">
                <span className="text-slate-500 font-semibold">Final Approval Status:</span>
                <span className="font-black text-[#0F172A]">{qav.approval_status}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500 font-semibold">Assigned Quality Grade:</span>
                <span className="font-black text-[#EA580C]">{qav.quality_grade}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500 font-semibold">Automated Audit:</span>
                <span className="font-bold text-emerald-700">{qav.system_verification}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500 font-semibold">Verification Time:</span>
                <span className="font-mono text-slate-700">{qav.verification_timestamp}</span>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div className="p-3.5 rounded-xl border border-dashed border-slate-300 bg-white">
                <div className="font-bold text-slate-700">{qav.inspector_role}</div>
                <div className="mt-6 border-b border-slate-400" />
                <div className="text-[10px] text-slate-400 mt-1">Inspector Signature & Date</div>
              </div>
              <div className="p-3.5 rounded-xl border border-dashed border-slate-300 bg-white">
                <div className="font-bold text-slate-700">{qav.manager_role}</div>
                <div className="mt-6 border-b border-slate-400" />
                <div className="text-[10px] text-slate-400 mt-1">Dispatch Approval Stamp</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ==================== SECTION 7: TECHNICAL DETAILS & COMPLETE DEFECT LOG ==================== */}
      <div className="bg-white rounded-2xl p-5 border border-[#E5E7EB] shadow-xs flex flex-col gap-4">
        <div className="flex items-center gap-2.5 border-b border-slate-100 pb-3">
          <Cpu className="w-5 h-5 text-blue-600" />
          <div>
            <h2 className="text-sm font-black text-[#0F172A] uppercase tracking-wide">
              Section 7 – Technical Details & Complete Defect Detection Log
            </h2>
            <p className="text-xs text-slate-500">
              Engineering parameters, AI model telemetry, data integrity audit, and full database record log
            </p>
          </div>
        </div>

        {/* Technical Configuration Table */}
        <div className="overflow-x-auto border border-slate-200 rounded-xl">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-100 text-slate-700 font-extrabold uppercase border-b border-slate-200">
              <tr>
                <th className="py-2.5 px-3.5">Technical Parameter</th>
                <th className="py-2.5 px-3.5">System Value / Specification</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              <tr>
                <td className="py-2.5 px-3.5 font-bold text-[#0F172A]">YOLO AI Model</td>
                <td className="py-2.5 px-3.5 text-slate-700">{td.ai_model_name}</td>
              </tr>
              <tr>
                <td className="py-2.5 px-3.5 font-bold text-[#0F172A]">Custom Model Weights (best.pt)</td>
                <td className="py-2.5 px-3.5 text-slate-700">
                  {td.weights_file} — Mean Confidence: <strong>{td.mean_confidence_pct}%</strong> (Peak: <strong>{td.peak_confidence_pct}%</strong>)
                </td>
              </tr>
              <tr>
                <td className="py-2.5 px-3.5 font-bold text-[#0F172A]">Image Resolution</td>
                <td className="py-2.5 px-3.5 text-slate-700">{td.image_resolution}</td>
              </tr>
              <tr>
                <td className="py-2.5 px-3.5 font-bold text-[#0F172A]">Detection Confidence Threshold</td>
                <td className="py-2.5 px-3.5 text-slate-700">{td.confidence_threshold}</td>
              </tr>
              <tr>
                <td className="py-2.5 px-3.5 font-bold text-[#0F172A]">IoU Tracking Threshold</td>
                <td className="py-2.5 px-3.5 text-slate-700">{td.iou_threshold}</td>
              </tr>
              <tr>
                <td className="py-2.5 px-3.5 font-bold text-[#0F172A]">Defect Tracking Methodology</td>
                <td className="py-2.5 px-3.5 text-slate-700">{td.tracking_methodology}</td>
              </tr>
              <tr>
                <td className="py-2.5 px-3.5 font-bold text-[#0F172A]">Fabric Grading & ASTM D5430 Note</td>
                <td className="py-2.5 px-3.5 text-slate-700">{td.grading_methodology_note}</td>
              </tr>
              <tr>
                <td className="py-2.5 px-3.5 font-bold text-[#0F172A]">Camera Information</td>
                <td className="py-2.5 px-3.5 text-slate-700">{td.camera_info}</td>
              </tr>
              <tr>
                <td className="py-2.5 px-3.5 font-bold text-[#0F172A]">Arduino Hardware Integration</td>
                <td className="py-2.5 px-3.5 text-slate-700">{td.arduino_integration}</td>
              </tr>
              <tr>
                <td className="py-2.5 px-3.5 font-bold text-[#0F172A]">System Verification</td>
                <td className="py-2.5 px-3.5 font-semibold text-emerald-700">{td.system_verification}</td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Data Integrity & Audit Verification Flags */}
        <div>
          <h3 className="text-xs font-black uppercase text-slate-700 mb-2">
            Data Integrity & Audit Flags (Historical Data Preserved Unmodified)
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
            {td.audit_flags.map(af => (
              <div key={af.type} className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs">
                <div className="flex items-center justify-between font-bold text-[#0F172A]">
                  <span>{af.type}</span>
                  <span className="text-[10px] px-2 py-0.5 rounded bg-slate-200 text-slate-700">
                    {af.status}
                  </span>
                </div>
                <p className="text-slate-600 mt-1 leading-relaxed">{af.detail}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Complete Defect Detection Log */}
        <div>
          <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
            <h3 className="text-xs font-black uppercase text-slate-700">
              Complete Defect Position & Detection Log (Showing {visibleLogs.length} of {allLogs.length} Actual Database Records)
            </h3>
            {allLogs.length > 30 && (
              <button
                type="button"
                onClick={() => setShowAllLogs(prev => !prev)}
                className="px-3 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-xs font-bold text-[#0F172A] cursor-pointer"
              >
                {showAllLogs ? 'Show Top 30 Records' : `Show All ${allLogs.length} Records`}
              </button>
            )}
          </div>

          <div className="overflow-x-auto border border-slate-200 rounded-xl max-h-[420px]">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-100 text-slate-700 font-extrabold uppercase border-b border-slate-200 sticky top-0">
                <tr>
                  <th className="py-2.5 px-3">#</th>
                  <th className="py-2.5 px-3">Unique Event ID</th>
                  <th className="py-2.5 px-3">Timestamp</th>
                  <th className="py-2.5 px-3">Defect Type</th>
                  <th className="py-2.5 px-3">Confidence</th>
                  <th className="py-2.5 px-3">Severity</th>
                  <th className="py-2.5 px-3">Meter Position</th>
                  <th className="py-2.5 px-3">Bounding Box (px)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {visibleLogs.map(item => (
                  <tr key={item.event_id} className="hover:bg-slate-50">
                    <td className="py-2 px-3 font-bold text-slate-500">{item.index}</td>
                    <td className="py-2 px-3 font-mono text-[11px] text-slate-700">{item.event_id}</td>
                    <td className="py-2 px-3 text-slate-600">{item.timestamp_display}</td>
                    <td className="py-2 px-3 font-bold text-[#0F172A]">{item.defect_name}</td>
                    <td className="py-2 px-3 font-extrabold text-[#0F172A]">{item.confidence_pct}%</td>
                    <td className="py-2 px-3">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                          item.severity === 'HIGH'
                            ? 'bg-red-100 text-red-700'
                            : item.severity === 'MEDIUM'
                            ? 'bg-amber-100 text-amber-700'
                            : 'bg-emerald-100 text-emerald-700'
                        }`}
                      >
                        {item.severity}
                      </span>
                    </td>
                    <td className="py-2 px-3 font-mono text-slate-700">{item.meter_position}</td>
                    <td className="py-2 px-3 font-mono text-[11px] text-slate-500">{item.bbox_display}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
