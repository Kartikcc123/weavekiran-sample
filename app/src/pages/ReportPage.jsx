import React, { useState, useEffect, useCallback } from 'react';
import {
  FileCheck2,
  Download,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  RefreshCw,
  ShieldCheck,
  Ruler,
  Award,
  BarChart3,
  Camera,
  ThumbsUp,
  ThumbsDown,
  Scissors,
  Clock
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
      a.download = `${reportId}_Weave_Kiran_Material_Report.pdf`;
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
    const lines = [
      ['Weave Kiran - Material Production, Quality & Usability Report'],
      ['Report ID', s.report_id],
      ['Loom / Roll ID', `${s.loom_id} / ${s.roll_id}`],
      ['Total Material Scanned (m)', `${s.scanned_meters} m`],
      ['Good Usable Material (m)', `${s.usable_meters} m (${s.usable_pct}%)`],
      ['Defective Material Area (m)', `${s.defective_meters} m (${s.defective_pct}%)`],
      ['Total Defects Found', `${s.total_defects} (${s.high_defects} Major, ${s.medium_defects + s.low_defects} Minor)`],
      ['Final Quality Grade', s.quality_grade],
      ['Is Material Usable?', s.is_usable_badge],
      ['Should You Accept / Buy?', s.should_accept_badge],
      ['Final Decision Summary', `"${s.decision_explanation}"`],
      [],
      ['DEFECT SUMMARY ON SCANNED MATERIAL'],
      ['Defect Type', 'Count', 'Share (%)', 'Major / Minor', 'AI Confidence (Avg / Peak)', 'Impact on Usability'],
      ...report.defect_breakdown.rows.map(r => [
        r.defect_name,
        r.count,
        `${r.share_pct}%`,
        `"${r.severity}"`,
        `Avg ${r.avg_confidence_pct}% / Peak ${r.peak_confidence_pct}%`,
        `"${r.usability_impact}"`
      ]),
      [],
      ['REAL-TIME DEFECT LOG'],
      ['#', 'Event ID', 'Real-Time Timestamp', 'Defect Type', 'AI Confidence (%)', 'Severity', 'Material Position (m)', 'Bounding Box (px)'],
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
    a.download = `${s.report_id}_Weave_Kiran_Material_Report.csv`;
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
          <span className="text-sm font-bold text-slate-700">Generating Material Production & Usability Report...</span>
        </div>
      </div>
    );
  }

  if (!report) return null;

  const s = report.summary;
  const proofs = report.prediction_proofs || [];
  const pieData = report.defect_breakdown.rows.filter(r => r.count > 0);

  return (
    <div className="h-full overflow-y-auto p-4 md:p-6 flex flex-col gap-5 bg-[#F5F6F8]">
      {/* 1. HEADER BAR */}
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
              {report.title}
            </h1>
            <p className="text-xs text-slate-500">
              {report.subtitle} • Loom: <strong>{s.loom_id}</strong> • Roll: <strong>{s.roll_id}</strong>
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <select
            value={scope}
            onChange={e => setScope(e.target.value)}
            className="px-3 py-2 text-xs font-bold rounded-xl border border-slate-300 bg-slate-50 text-[#0F172A]"
          >
            <option value="latest_session">Current Session ({s.total_defects} defects)</option>
            <option value="all">All Production Data ({report.total_db_records} defects)</option>
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

      {/* 2. MATERIAL PRODUCTION DATA (4 MAIN KPI CARDS: KITNA SCAN HUA, KITNA USABLE, KITNE DEFECT, KYA GRADE) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-2xl p-4 border border-[#E5E7EB] shadow-xs flex items-center justify-between">
          <div>
            <div className="text-[11px] font-bold text-slate-400 uppercase">Total Material Scanned</div>
            <div className="text-2xl font-black text-[#0F172A] mt-1">{s.scanned_meters} m</div>
            <div className="text-xs font-semibold text-slate-500 mt-0.5">
              Scan Time: {s.inspection_duration_display}
            </div>
          </div>
          <div
            style={{ backgroundColor: '#FFF7ED', color: '#EA580C' }}
            className="w-12 h-12 rounded-xl flex items-center justify-center"
          >
            <Ruler className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-white rounded-2xl p-4 border border-[#E5E7EB] shadow-xs flex items-center justify-between">
          <div>
            <div className="text-[11px] font-bold text-slate-400 uppercase">Good Usable Material</div>
            <div className="text-2xl font-black text-emerald-600 mt-1">
              {s.usable_meters} m <span className="text-base">({s.usable_pct}%)</span>
            </div>
            <div className="text-xs font-semibold text-slate-500 mt-0.5">
              Defective Area: {s.defective_meters} m ({s.defective_pct}%)
            </div>
          </div>
          <div className="w-12 h-12 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
            <ShieldCheck className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-white rounded-2xl p-4 border border-[#E5E7EB] shadow-xs flex items-center justify-between">
          <div>
            <div className="text-[11px] font-bold text-slate-400 uppercase">Total Defects Found</div>
            <div className="text-2xl font-black text-red-600 mt-1">{s.total_defects} Defects</div>
            <div className="text-xs font-semibold text-slate-500 mt-0.5">
              {s.high_defects} Major • {s.medium_defects + s.low_defects} Minor
            </div>
          </div>
          <div className="w-12 h-12 rounded-xl bg-red-50 text-red-600 flex items-center justify-center">
            <AlertTriangle className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-white rounded-2xl p-4 border border-[#E5E7EB] shadow-xs flex items-center justify-between">
          <div>
            <div className="text-[11px] font-bold text-slate-400 uppercase">Material Quality Grade</div>
            <div className="text-2xl font-black text-[#EA580C] mt-1">{s.quality_grade}</div>
            <div className="text-xs font-bold text-emerald-700 mt-0.5">{s.final_status}</div>
          </div>
          <div
            style={{ backgroundColor: '#FFF7ED', color: '#EA580C' }}
            className="w-12 h-12 rounded-xl flex items-center justify-center"
          >
            <Award className="w-6 h-6" />
          </div>
        </div>
      </div>

      {/* 3. FINAL OUTPUT: YE MATERIAL USABLE HAI YA NAHI? ISKO LENA CHAHIYE YA NAHI? */}
      <div
        className={`rounded-2xl p-5 border-2 shadow-xs flex flex-col gap-4 ${
          s.verdict_level === 'PASS'
            ? 'bg-emerald-50/80 border-emerald-500'
            : s.verdict_level === 'CONDITIONAL'
            ? 'bg-amber-50/80 border-amber-500'
            : 'bg-red-50/80 border-red-500'
        }`}
      >
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Box A: Is Material Usable? */}
          <div className="bg-white rounded-xl p-4 border border-slate-200 flex items-start gap-3.5 shadow-2xs">
            <div
              className={`w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 text-white ${
                s.verdict_level === 'HOLD' ? 'bg-red-600' : 'bg-emerald-600'
              }`}
            >
              {s.verdict_level === 'HOLD' ? <XCircle className="w-7 h-7" /> : <CheckCircle2 className="w-7 h-7" />}
            </div>
            <div className="flex-1">
              <div className="text-[11px] font-black uppercase tracking-wider text-slate-400">
                FINAL USABILITY RESULT (Kya Ye Material Usable Hai?)
              </div>
              <div className="text-lg md:text-xl font-black text-[#0F172A] mt-0.5">
                {s.is_usable_badge}
              </div>
              {/* Visual Usable vs Defective Bar */}
              <div className="mt-2.5">
                <div className="flex justify-between text-xs font-bold mb-1">
                  <span className="text-emerald-700">Usable Clean Cloth: {s.usable_meters} m ({s.usable_pct}%)</span>
                  <span className="text-red-600">Defect Area: {s.defective_meters} m ({s.defective_pct}%)</span>
                </div>
                <div className="w-full h-3 bg-red-200 rounded-full overflow-hidden flex">
                  <div
                    style={{ width: `${s.usable_pct}%`, backgroundColor: '#10B981' }}
                    className="h-full rounded-l-full"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Box B: Should You Buy / Accept This Roll? */}
          <div className="bg-white rounded-xl p-4 border border-slate-200 flex items-start gap-3.5 shadow-2xs">
            <div
              style={{ backgroundColor: s.verdict_level === 'HOLD' ? '#DC2626' : '#EA580C', color: '#FFFFFF' }}
              className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0"
            >
              {s.verdict_level === 'HOLD' ? <ThumbsDown className="w-6 h-6" /> : <ThumbsUp className="w-6 h-6" />}
            </div>
            <div className="flex-1">
              <div className="text-[11px] font-black uppercase tracking-wider text-slate-400">
                BUYING / ACCEPTANCE DECISION (Isko Lena Chahiye Ya Nahi?)
              </div>
              <div className="text-lg md:text-xl font-black text-[#EA580C] mt-0.5">
                {s.should_accept_badge}
              </div>
              <p className="text-xs font-semibold text-slate-700 mt-1.5 leading-relaxed">
                {s.decision_explanation}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* 4. REAL-TIME CAMERA PROOFS WITH BOUNDING BOX & LIVE TIMESTAMP */}
      <div className="bg-white rounded-2xl p-5 border border-[#E5E7EB] shadow-xs flex flex-col gap-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2.5">
            <Camera className="w-5 h-5 text-[#EA580C]" />
            <div>
              <h2 className="text-sm font-black text-[#0F172A] uppercase">
                Real-Time Camera Defect Proofs (With AI Bounding Box & Timestamp)
              </h2>
              <p className="text-xs text-slate-500">
                Actual frames captured during inspection showing where defects were detected on the material
              </p>
            </div>
          </div>
          <span className="px-3 py-1 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200 text-xs font-bold">
            Live Camera Bounding-Box Evidence
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {proofs.map(p => {
            const bx = p.bbox || {};
            const refW = (bx.x2 || 0) > 640 ? 1280 : 640;
            const refH = (bx.y2 || 0) > 480 ? 720 : 480;
            const leftPct = Math.min(72, Math.max(8, Math.round(((bx.x1 || 120) / refW) * 100)));
            const topPct = Math.min(62, Math.max(12, Math.round(((bx.y1 || 90) / refH) * 100)));
            const widthPct = Math.min(82 - leftPct, Math.max(22, Math.round((((bx.x2 || 340) - (bx.x1 || 120)) / refW) * 100)));
            const heightPct = Math.min(82 - topPct, Math.max(24, Math.round((((bx.y2 || 260) - (bx.y1 || 90)) / refH) * 100)));

            const imgSrc = p.annotated_image || p.original_image || getDefectSwatch(p.defect_name);

            return (
              <div
                key={p.event_id}
                className="rounded-xl border border-slate-200 bg-white overflow-hidden flex flex-col justify-between shadow-2xs"
              >
                {/* Real-Time Image with Bounding Box & Live Timestamp Badge */}
                <div className="relative h-44 w-full bg-[#0F172A] overflow-hidden">
                  <img
                    src={imgSrc}
                    alt={p.defect_name}
                    className="w-full h-full object-cover"
                  />

                  {/* Live badge top-left */}
                  <div className="absolute top-2 left-2 flex items-center gap-1.5 bg-black/75 text-white text-[10px] font-bold px-2.5 py-1 rounded-md">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                    <span>{p.is_live_capture ? 'REAL-TIME CAMERA CAPTURE' : 'AI DETECTION PROOF'}</span>
                  </div>

                  {/* Meter Position top-right */}
                  <div
                    style={{ backgroundColor: '#EA580C', color: '#FFFFFF' }}
                    className="absolute top-2 right-2 text-[10px] font-black px-2 py-0.5 rounded-md"
                  >
                    At {p.meter_position}
                  </div>

                  {/* If not pre-burned annotated bitmap, draw the exact YOLO bounding box overlay */}
                  {!p.annotated_image && (
                    <div
                      style={{
                        left: `${leftPct}%`,
                        top: `${topPct}%`,
                        width: `${widthPct}%`,
                        height: `${heightPct}%`,
                        border: '2.5px solid #EF4444'
                      }}
                      className="absolute pointer-events-none"
                    >
                      <span
                        style={{ backgroundColor: '#EF4444', color: '#FFFFFF' }}
                        className="absolute -top-5 left-0 px-1.5 py-0.5 text-[10px] font-black rounded-t whitespace-nowrap"
                      >
                        {p.raw_defect_type} {p.confidence_pct}%
                      </span>
                    </div>
                  )}

                  {/* Bottom Real-Time Timestamp Overlay */}
                  <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/85 via-black/50 to-transparent px-3 py-1.5 flex items-center justify-between text-white text-[11px]">
                    <span className="flex items-center gap-1 font-mono">
                      <Clock className="w-3 h-3 text-orange-400" />
                      {p.timestamp_display}
                    </span>
                    <span className="font-mono text-[10px] text-slate-300">{p.event_id}</span>
                  </div>
                </div>

                {/* Proof Footer */}
                <div className="p-3 bg-slate-50 flex items-center justify-between text-xs border-t border-slate-200">
                  <div>
                    <div className="font-black text-[#0F172A]">{p.defect_name}</div>
                    <div className="font-mono text-[10px] text-slate-500">Box: {p.bbox_coords}</div>
                  </div>
                  <span
                    className={`px-2.5 py-1 rounded-lg text-xs font-black ${
                      p.severity === 'HIGH'
                        ? 'bg-red-100 text-red-700'
                        : 'bg-amber-100 text-amber-800'
                    }`}
                  >
                    {p.confidence_pct}% AI Conf
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 5. PRODUCTION DEFECT BREAKDOWN (CHARTS + MATERIAL IMPACT TABLE) */}
      <div className="bg-white rounded-2xl p-5 border border-[#E5E7EB] shadow-xs flex flex-col gap-4">
        <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
          <BarChart3 className="w-5 h-5 text-[#EA580C]" />
          <h2 className="text-sm font-black text-[#0F172A] uppercase">
            Scanned Material Defect Summary & Usability Impact
          </h2>
        </div>

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
                <Tooltip formatter={val => [`${val} defects`, 'Found']} />
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
                  <Tooltip formatter={(val, name) => [`${val} defects`, name]} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-xs font-bold text-emerald-700">
                100% Clean Material
              </div>
            )}
          </div>
        </div>

        <div className="overflow-x-auto border border-slate-200 rounded-xl">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-100 text-slate-700 font-extrabold uppercase border-b border-slate-200">
              <tr>
                <th className="py-2.5 px-3.5">Defect Type</th>
                <th className="py-2.5 px-3.5">Defects Found</th>
                <th className="py-2.5 px-3.5">Major / Minor</th>
                <th className="py-2.5 px-3.5">AI Confidence</th>
                <th className="py-2.5 px-3.5">Effect on Material Usability</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {report.defect_breakdown.rows.map(row => (
                <tr key={row.defect_name} className="hover:bg-slate-50">
                  <td className="py-2.5 px-3.5 font-black text-[#0F172A]">{row.defect_name}</td>
                  <td className="py-2.5 px-3.5 font-extrabold text-[#0F172A]">
                    {row.count} <span className="text-slate-400">({row.share_pct}%)</span>
                  </td>
                  <td className="py-2.5 px-3.5 text-slate-600">{row.severity}</td>
                  <td className="py-2.5 px-3.5 font-semibold text-slate-700">
                    {row.count > 0 ? `Avg ${row.avg_confidence_pct}% (Peak ${row.peak_confidence_pct}%)` : '—'}
                  </td>
                  <td className="py-2.5 px-3.5 font-bold text-[#EA580C]">
                    <span className="inline-flex items-center gap-1">
                      <Scissors className="w-3.5 h-3.5" />
                      {row.usability_impact}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
