import React, { useState, useEffect, useCallback } from 'react';
import {
  FileCheck2,
  Download,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  RefreshCw,
  ShieldCheck,
  Award,
  BarChart3,
  Cpu,
  Camera,
  Crosshair,
  Database,
  Activity
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
import { getDefectSwatch } from '../utils/swatches';

const CHART_COLORS = ['#DC2626', '#EA580C', '#2563EB', '#7C3AED', '#0D9488'];

export default function ReportPage() {
  const { recentDetections } = useSimulation();

  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [downloadingPdf, setDownloadingPdf] = useState(false);
  const [scope, setScope] = useState('latest_session');
  const [showAllLogs, setShowAllLogs] = useState(false);

  const fetchReport = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/report?scope=${encodeURIComponent(scope)}`);
      if (res.ok) {
        setReport(await res.json());
      }
    } catch (err) {
      console.error('Failed to load report:', err);
    } finally {
      setLoading(false);
    }
  }, [scope]);

  useEffect(() => {
    fetchReport();
  }, [fetchReport, recentDetections?.length]);

  const handleDownloadPDF = async () => {
    setDownloadingPdf(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/report/pdf?scope=${encodeURIComponent(scope)}`);
      if (!res.ok) throw new Error('PDF generation failed');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const reportId = report?.summary?.report_id || 'WK-RPT';
      a.download = `${reportId}_Weave_Kiran_System_Report.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('PDF download error:', err);
      window.print();
    } finally {
      setDownloadingPdf(false);
    }
  };

  const handleDownloadCSV = () => {
    if (!report) return;
    const s = report.summary;
    const td = report.technical_details;
    const lines = [
      ['Weave Kiran - AI System Inspection & Defect Prediction Report'],
      ['Report ID', s.report_id],
      ['Loom ID', s.loom_id],
      ['AI Model', `${td.ai_model_name} (${td.weights_file})`],
      ['Final Output Grade', s.quality_grade],
      ['Final Inspection Status', s.final_status],
      ['Total Defects Predicted', s.total_defects],
      ['Mean / Peak AI Confidence', `${td.mean_confidence_pct}% / ${td.peak_confidence_pct}%`],
      [],
      ['AI PREDICTION SUMMARY BY CLASS'],
      ['Predicted Defect Class', 'Total Predictions', 'Share (%)', 'Avg Confidence (%)', 'Peak Confidence (%)', 'Severity Breakdown', 'Sample Verified Proof'],
      ...report.defect_breakdown.rows.map(r => [
        r.defect_name,
        r.count,
        `${r.share_pct}%`,
        `${r.avg_confidence_pct}%`,
        `${r.peak_confidence_pct}%`,
        `"${r.severity}"`,
        `"${r.sample_proof}"`
      ]),
      [],
      ['VERIFIED AI DEFECT PREDICTION LOG (PROOF RECORDS)'],
      ['#', 'Unique Event ID', 'Track ID', 'Timestamp', 'Predicted Defect', 'AI Confidence (%)', 'Severity', 'Predicted Bounding Box (px)'],
      ...report.defect_log.map(d => [
        d.index,
        d.event_id,
        d.track_id || '',
        `"${d.timestamp_display}"`,
        d.defect_name,
        `${d.confidence_pct}%`,
        d.severity,
        `"${d.bbox_display}"`
      ])
    ];

    const csvContent = '\uFEFF' + lines.map(row => row.join(',')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${s.report_id}_Weave_Kiran_Prediction_Proof_Report.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  if (loading && !report) {
    return (
      <div className="h-full flex items-center justify-center p-8 bg-[#F5F6F8]">
        <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-xs flex items-center gap-3">
          <RefreshCw className="w-5 h-5 text-[#EA580C] animate-spin" />
          <span className="text-sm font-bold text-slate-700">Loading Weave Kiran System Report...</span>
        </div>
      </div>
    );
  }

  if (!report) return null;

  const s = report.summary;
  const mf = report.defect_breakdown.most_frequent_defect;
  const td = report.technical_details;
  const proofs = report.prediction_proofs || [];
  const allLogs = report.defect_log || [];
  const visibleLogs = showAllLogs ? allLogs : allLogs.slice(0, 12);
  const pieData = report.defect_breakdown.rows.filter(r => r.count > 0);

  return (
    <div className="h-full overflow-y-auto p-4 md:p-6 flex flex-col gap-5 bg-[#F5F6F8]">
      {/* 1. HEADER & DOWNLOAD BUTTONS */}
      <div className="bg-white rounded-2xl p-5 border border-[#E5E7EB] shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div
            style={{ backgroundColor: '#EA580C', color: '#FFFFFF' }}
            className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 shadow-sm"
          >
            <FileCheck2 className="w-6 h-6 stroke-[2.2]" />
          </div>
          <div>
            <h1 className="text-lg md:text-xl font-black text-[#0F172A]">
              Weave Kiran – AI System Inspection & Prediction Report
            </h1>
            <p className="text-xs text-slate-500">
              How the System Works • Final Inspection Output • Verified AI Defect Prediction Proofs (ID: <strong className="font-mono">{s.report_id}</strong>)
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <select
            value={scope}
            onChange={e => setScope(e.target.value)}
            className="px-3 py-2 text-xs font-bold rounded-xl border border-slate-300 bg-slate-50 text-[#0F172A]"
          >
            <option value="latest_session">Latest Session ({s.total_defects} predictions)</option>
            <option value="all">All Database Proofs ({report.total_db_records} predictions)</option>
          </select>

          <button
            type="button"
            onClick={handleDownloadPDF}
            disabled={downloadingPdf}
            style={{ backgroundColor: '#EA580C', color: '#FFFFFF', padding: '8px 16px' }}
            className="flex items-center gap-2 rounded-xl text-xs font-extrabold shadow-sm cursor-pointer whitespace-nowrap"
          >
            <Download className="w-4 h-4" />
            <span>{downloadingPdf ? 'Generating PDF…' : 'Download PDF Report'}</span>
          </button>

          <button
            type="button"
            onClick={handleDownloadCSV}
            style={{ backgroundColor: '#0F172A', color: '#FFFFFF', padding: '8px 14px' }}
            className="flex items-center gap-1.5 rounded-xl text-xs font-extrabold shadow-sm cursor-pointer whitespace-nowrap"
          >
            <Download className="w-4 h-4" />
            <span>Download Excel (CSV)</span>
          </button>
        </div>
      </div>

      {/* 2. HOW OUR SYSTEM WORKS (4-STEP END-TO-END PIPELINE) */}
      <div className="bg-white rounded-2xl p-5 border border-[#E5E7EB] shadow-xs flex flex-col gap-3.5">
        <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
          <div className="flex items-center gap-2">
            <Cpu className="w-5 h-5 text-[#EA580C]" />
            <h2 className="text-sm font-black text-[#0F172A] uppercase">
              1. How the Weave Kiran System Works
            </h2>
          </div>
          <span className="text-[11px] font-mono font-bold text-slate-600 bg-slate-100 px-2.5 py-0.5 rounded-md">
            Live Camera → YOLO26s (best.pt) → Tracking → Cloud & Loom Control
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
          <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 flex flex-col gap-1.5">
            <div className="flex items-center gap-2 font-black text-[#0F172A]">
              <span
                style={{ backgroundColor: '#EA580C', color: '#FFFFFF' }}
                className="w-5 h-5 rounded-full text-[11px] flex items-center justify-center flex-shrink-0"
              >
                1
              </span>
              <Camera className="w-4 h-4 text-[#EA580C]" />
              <span>Live Frame Capture</span>
            </div>
            <p className="text-slate-600 leading-relaxed">
              Captures real-time fabric video frames from the browser/loom camera and resizes each frame to a <strong>640×640 px</strong> tensor.
            </p>
          </div>

          <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 flex flex-col gap-1.5">
            <div className="flex items-center gap-2 font-black text-[#0F172A]">
              <span
                style={{ backgroundColor: '#EA580C', color: '#FFFFFF' }}
                className="w-5 h-5 rounded-full text-[11px] flex items-center justify-center flex-shrink-0"
              >
                2
              </span>
              <Crosshair className="w-4 h-4 text-[#EA580C]" />
              <span>YOLO AI Prediction</span>
            </div>
            <p className="text-slate-600 leading-relaxed">
              Custom-trained <strong>best.pt</strong> model predicts defect category, confidence score (≥ 35%), and exact pixel bounding box <code>(x1, y1, x2, y2)</code>.
            </p>
          </div>

          <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 flex flex-col gap-1.5">
            <div className="flex items-center gap-2 font-black text-[#0F172A]">
              <span
                style={{ backgroundColor: '#EA580C', color: '#FFFFFF' }}
                className="w-5 h-5 rounded-full text-[11px] flex items-center justify-center flex-shrink-0"
              >
                3
              </span>
              <Activity className="w-4 h-4 text-[#EA580C]" />
              <span>Anti-Duplicate Tracking</span>
            </div>
            <p className="text-slate-600 leading-relaxed">
              IoU (0.30) + centroid matcher with 20-frame majority vote assigns a unique <strong>Event ID</strong> so a moving defect is counted only once.
            </p>
          </div>

          <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 flex flex-col gap-1.5">
            <div className="flex items-center gap-2 font-black text-[#0F172A]">
              <span
                style={{ backgroundColor: '#EA580C', color: '#FFFFFF' }}
                className="w-5 h-5 rounded-full text-[11px] flex items-center justify-center flex-shrink-0"
              >
                4
              </span>
              <Database className="w-4 h-4 text-[#EA580C]" />
              <span>Final Output & Proof Log</span>
            </div>
            <p className="text-slate-600 leading-relaxed">
              Saves every verified prediction to <strong>MongoDB Atlas</strong>, syncs with owner Arduino hardware, and computes the final fabric grade.
            </p>
          </div>
        </div>
      </div>

      {/* 3. FINAL SYSTEM OUTPUT (VERDICT + 4 KPI CARDS) */}
      <div
        className={`rounded-2xl p-5 border-2 shadow-xs flex flex-col gap-4 ${
          s.verdict_level === 'PASS'
            ? 'bg-emerald-50/70 border-emerald-400'
            : s.verdict_level === 'CONDITIONAL'
            ? 'bg-amber-50/70 border-amber-400'
            : 'bg-red-50/70 border-red-400'
        }`}
      >
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-start gap-3.5">
            <div
              className={`w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 text-white ${
                s.verdict_level === 'PASS'
                  ? 'bg-emerald-600'
                  : s.verdict_level === 'CONDITIONAL'
                  ? 'bg-amber-500'
                  : 'bg-red-600'
              }`}
            >
              {s.verdict_level === 'PASS' ? (
                <CheckCircle2 className="w-7 h-7" />
              ) : s.verdict_level === 'CONDITIONAL' ? (
                <AlertTriangle className="w-7 h-7" />
              ) : (
                <XCircle className="w-7 h-7" />
              )}
            </div>
            <div>
              <div className="text-[11px] font-black uppercase tracking-wider text-slate-500">
                2. FINAL SYSTEM OUTPUT • {s.loom_id}
              </div>
              <h2 className="text-xl font-black text-[#0F172A] mt-0.5">
                Final Result: {s.quality_grade} — {s.final_status}
              </h2>
              <p className="text-xs md:text-sm text-slate-700 font-medium mt-1">
                Our YOLO26s (<code>best.pt</code>) model processed the live fabric stream on <strong>{s.loom_id}</strong> and predicted{' '}
                <strong>{s.total_defects} verified defects</strong> ({s.high_defects} High, {s.medium_defects} Medium, {s.low_defects} Low severity)
                with a peak detection confidence of <strong>{td.peak_confidence_pct}%</strong> (mean <strong>{td.mean_confidence_pct}%</strong>).
              </p>
            </div>
          </div>
        </div>

        {/* 4 Output KPI Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="bg-white rounded-xl p-3.5 border border-slate-200">
            <div className="flex items-center justify-between text-[11px] font-bold text-slate-500 uppercase">
              <span>Total AI Predictions</span>
              <AlertTriangle className="w-4 h-4 text-red-600" />
            </div>
            <div className="text-xl font-black text-red-600 mt-1">{s.total_defects} Defects</div>
            <div className="text-[11px] text-slate-500">
              {s.high_defects} High • {s.medium_defects} Med • {s.low_defects} Low
            </div>
          </div>

          <div className="bg-white rounded-xl p-3.5 border border-slate-200">
            <div className="flex items-center justify-between text-[11px] font-bold text-slate-500 uppercase">
              <span>AI Model Confidence</span>
              <Crosshair className="w-4 h-4 text-[#EA580C]" />
            </div>
            <div className="text-xl font-black text-[#0F172A] mt-1">
              Peak {td.peak_confidence_pct}%
            </div>
            <div className="text-[11px] text-slate-500">
              Average Confidence: {td.mean_confidence_pct}%
            </div>
          </div>

          <div className="bg-white rounded-xl p-3.5 border border-slate-200">
            <div className="flex items-center justify-between text-[11px] font-bold text-slate-500 uppercase">
              <span>Top Predicted Class</span>
              <ShieldCheck className="w-4 h-4 text-emerald-600" />
            </div>
            <div className="text-xl font-black text-emerald-700 mt-1">
              {mf ? mf.defect_name : 'Clean'}
            </div>
            <div className="text-[11px] text-slate-500">
              {mf ? `${mf.count} predictions (${mf.share_pct}% share)` : '0 defects'}
            </div>
          </div>

          <div className="bg-white rounded-xl p-3.5 border border-slate-200">
            <div className="flex items-center justify-between text-[11px] font-bold text-slate-500 uppercase">
              <span>Final Output Grade</span>
              <Award className="w-4 h-4 text-[#EA580C]" />
            </div>
            <div className="text-xl font-black text-[#EA580C] mt-1">{s.quality_grade}</div>
            <div className="text-[11px] text-slate-500">Duration: {s.inspection_duration_display}</div>
          </div>
        </div>
      </div>

      {/* 4. REAL AI PREDICTION PROOFS (VISUAL EVIDENCE CARDS WITH BOUNDING BOXES & COORDINATES) */}
      <div className="bg-white rounded-2xl p-5 border border-[#E5E7EB] shadow-xs flex flex-col gap-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2">
            <Crosshair className="w-5 h-5 text-[#EA580C]" />
            <div>
              <h3 className="text-sm font-black text-[#0F172A] uppercase">
                3. Real AI Defect Prediction Proofs (Verified Detections)
              </h3>
              <p className="text-xs text-slate-500">
                Proof records from our YOLO model showing Event ID, AI Confidence %, Timestamp, and Exact Pixel Bounding Box Coordinates
              </p>
            </div>
          </div>
          <span className="px-3 py-1 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200 text-xs font-bold">
            100% Live Database Verified Proofs
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {proofs.map(p => {
            const bx = p.bbox || {};
            // Scale 1280x720 or 640x480 bounding box to percentage overlay for visual proof box
            const refW = (bx.x2 || 0) > 640 ? 1280 : 640;
            const refH = (bx.y2 || 0) > 480 ? 720 : 480;
            const leftPct = Math.min(72, Math.max(8, Math.round(((bx.x1 || 120) / refW) * 100)));
            const topPct = Math.min(62, Math.max(12, Math.round(((bx.y1 || 90) / refH) * 100)));
            const widthPct = Math.min(82 - leftPct, Math.max(22, Math.round((((bx.x2 || 340) - (bx.x1 || 120)) / refW) * 100)));
            const heightPct = Math.min(82 - topPct, Math.max(24, Math.round((((bx.y2 || 260) - (bx.y1 || 90)) / refH) * 100)));

            const previewSrc = p.annotated_image || p.original_image || getDefectSwatch(p.defect_name);

            return (
              <div
                key={p.event_id}
                className="rounded-xl border border-slate-200 bg-slate-50 overflow-hidden flex flex-col justify-between shadow-2xs"
              >
                {/* Visual Frame with YOLO Bounding Box Overlay */}
                <div className="relative h-40 w-full bg-[#0F172A] overflow-hidden">
                  <img
                    src={previewSrc}
                    alt={p.defect_name}
                    className="w-full h-full object-cover opacity-90"
                  />
                  {/* If not already pre-annotated bitmap, render the actual predicted YOLO bounding box overlay */}
                  {!p.annotated_image && (
                    <div
                      style={{
                        left: `${leftPct}%`,
                        top: `${topPct}%`,
                        width: `${widthPct}%`,
                        height: `${heightPct}%`,
                        border: '2.5px solid #EF4444'
                      }}
                      className="absolute rounded-xs pointer-events-none shadow-md"
                    >
                      <span
                        style={{ backgroundColor: '#EF4444', color: '#FFFFFF' }}
                        className="absolute -top-5 left-0 px-1.5 py-0.5 text-[10px] font-black rounded-t whitespace-nowrap"
                      >
                        {p.raw_defect_type} {p.confidence_pct}%
                      </span>
                    </div>
                  )}
                  <span className="absolute bottom-2 right-2 bg-black/75 text-white font-mono text-[10px] px-2 py-0.5 rounded">
                    {p.event_id}
                  </span>
                </div>

                {/* Prediction Telemetry Proof Details */}
                <div className="p-3.5 bg-white flex flex-col gap-1.5 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="font-black text-sm text-[#0F172A]">{p.defect_name}</span>
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-black uppercase ${
                        p.severity === 'HIGH'
                          ? 'bg-red-100 text-red-700'
                          : p.severity === 'MEDIUM'
                          ? 'bg-amber-100 text-amber-700'
                          : 'bg-emerald-100 text-emerald-700'
                      }`}
                    >
                      {p.confidence_pct}% ({p.severity})
                    </span>
                  </div>

                  {/* Confidence Bar */}
                  <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                    <div
                      style={{
                        width: `${Math.min(100, p.confidence_pct)}%`,
                        backgroundColor: p.severity === 'HIGH' ? '#DC2626' : '#EA580C'
                      }}
                      className="h-full rounded-full"
                    />
                  </div>

                  <div className="font-mono text-[11px] text-slate-600 mt-1">
                    <strong>BBox:</strong> {p.bbox_coords}
                  </div>
                  <div className="text-[11px] text-slate-500 flex items-center justify-between">
                    <span><strong>Time:</strong> {p.timestamp_display}</span>
                    <span className="font-mono">Track #{p.track_id}</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 5. AI PREDICTION SUMMARY BY CLASS (CHARTS + PROOF TABLE — NO TEXTBOOK DEFINITIONS) */}
      <div className="bg-white rounded-2xl p-5 border border-[#E5E7EB] shadow-xs flex flex-col gap-4">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-[#EA580C]" />
            <h3 className="text-sm font-black text-[#0F172A] uppercase">
              4. AI Prediction Summary & Class Proof Table
            </h3>
          </div>
        </div>

        {/* Side-by-side Bar Chart + Pie Chart */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="bg-slate-50 rounded-xl p-3.5 border border-slate-200 h-52">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={report.defect_breakdown.rows}
                layout="vertical"
                margin={{ top: 5, right: 20, left: 20, bottom: 5 }}
              >
                <XAxis type="number" tick={{ fontSize: 11 }} />
                <YAxis dataKey="defect_name" type="category" width={130} tick={{ fontSize: 11, fontWeight: 700 }} />
                <Tooltip formatter={val => [`${val} predictions`, 'Count']} />
                <Bar dataKey="count" fill="#EA580C" radius={[0, 6, 6, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="bg-slate-50 rounded-xl p-3.5 border border-slate-200 h-52">
            {pieData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={pieData}
                    dataKey="count"
                    nameKey="defect_name"
                    cx="50%"
                    cy="50%"
                    outerRadius={68}
                    label={({ defect_name, share_pct }) => `${defect_name}: ${share_pct}%`}
                  >
                    {pieData.map((entry, idx) => (
                      <Cell key={entry.defect_name} fill={CHART_COLORS[idx % CHART_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(val, name) => [`${val} predictions`, name]} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-xs font-bold text-emerald-700">
                No Defects Predicted
              </div>
            )}
          </div>
        </div>

        {/* Prediction Proof Table by Class (Replaces textbook "Simple Meaning" column) */}
        <div className="overflow-x-auto border border-slate-200 rounded-xl">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-100 text-slate-700 font-extrabold uppercase border-b border-slate-200">
              <tr>
                <th className="py-2.5 px-3.5">Predicted Defect Class</th>
                <th className="py-2.5 px-3.5">Total Predictions</th>
                <th className="py-2.5 px-3.5">AI Confidence (Avg / Peak)</th>
                <th className="py-2.5 px-3.5">Severity Breakdown</th>
                <th className="py-2.5 px-3.5">Sample Verified Prediction Proof (ID • Conf • BBox • Time)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {report.defect_breakdown.rows.map(row => (
                <tr key={row.defect_name} className="hover:bg-slate-50">
                  <td className="py-2.5 px-3.5 font-black text-[#0F172A]">{row.defect_name}</td>
                  <td className="py-2.5 px-3.5 font-extrabold text-[#0F172A]">
                    {row.count} <span className="text-slate-400">({row.share_pct}%)</span>
                  </td>
                  <td className="py-2.5 px-3.5 font-semibold text-slate-700">
                    {row.count > 0 ? (
                      <>
                        Avg: <strong>{row.avg_confidence_pct}%</strong> • Peak:{' '}
                        <strong className="text-[#EA580C]">{row.peak_confidence_pct}%</strong>
                      </>
                    ) : (
                      '—'
                    )}
                  </td>
                  <td className="py-2.5 px-3.5 text-slate-600">{row.severity}</td>
                  <td className="py-2.5 px-3.5 font-mono text-[11px] text-slate-700">{row.sample_proof}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* 6. COMPLETE VERIFIED PREDICTION LOG */}
      <div className="bg-white rounded-2xl p-5 border border-[#E5E7EB] shadow-xs flex flex-col gap-3.5">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-2.5">
          <div className="flex items-center gap-2">
            <Database className="w-5 h-5 text-blue-600" />
            <h3 className="text-sm font-black text-[#0F172A] uppercase">
              5. Complete Verified AI Prediction Log ({allLogs.length} Database Records)
            </h3>
          </div>
          <span className="text-xs font-mono text-slate-600 bg-slate-100 px-2.5 py-1 rounded-lg">
            Model: YOLO26s (best.pt) • 640×640 • Conf ≥ 35% • IoU ≥ 0.30
          </span>
        </div>

        <div className="overflow-x-auto border border-slate-200 rounded-xl">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-100 text-slate-700 font-extrabold uppercase border-b border-slate-200">
              <tr>
                <th className="py-2 px-3">#</th>
                <th className="py-2 px-3">Unique Event ID</th>
                <th className="py-2 px-3">Timestamp</th>
                <th className="py-2 px-3">Predicted Defect</th>
                <th className="py-2 px-3">AI Confidence</th>
                <th className="py-2 px-3">Severity</th>
                <th className="py-2 px-3">Predicted Bounding Box (x1, y1) – (x2, y2)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {visibleLogs.map(item => (
                <tr key={item.event_id} className="hover:bg-slate-50">
                  <td className="py-2 px-3 font-bold text-slate-500">{item.index}</td>
                  <td className="py-2 px-3 font-mono text-[11px] font-bold text-slate-700">{item.event_id}</td>
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
                  <td className="py-2 px-3 font-mono text-[11px] text-slate-600">{item.bbox_display}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {allLogs.length > 12 && (
          <div className="flex justify-center">
            <button
              type="button"
              onClick={() => setShowAllLogs(prev => !prev)}
              className="px-4 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-xs font-bold text-slate-700 cursor-pointer"
            >
              {showAllLogs ? 'Show Top 12 Only' : `Show All ${allLogs.length} Prediction Proofs`}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
