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
  Wrench,
  BarChart3,
  Cpu,
  ClipboardCheck
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
      a.download = `${reportId}_Weave_Kiran_Quality_Report.pdf`;
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
      [report.title],
      ['Report ID', s.report_id],
      ['Loom ID', s.loom_id],
      ['Inspection Date', s.inspection_end_display],
      ['Final Grade', s.quality_grade],
      ['Final Result', s.final_status],
      ['Total Defects', s.total_defects],
      ['Summary', `"${s.plain_english_summary}"`],
      [],
      ['DEFECT SUMMARY'],
      ['Defect Name', 'Count', 'Share (%)', 'What It Means', 'Recommended Action'],
      ...report.defect_breakdown.rows.map(r => [
        r.defect_name,
        r.count,
        `${r.share_pct}%`,
        `"${r.what_it_means}"`,
        `"${r.factory_action}"`
      ]),
      [],
      ['RECENT DEFECT LOG'],
      ['#', 'Event ID', 'Time', 'Defect Type', 'Confidence', 'Severity'],
      ...report.defect_log.map(d => [
        d.index,
        d.event_id,
        `"${d.timestamp_display}"`,
        d.defect_name,
        `${d.confidence_pct}%`,
        d.severity
      ])
    ];

    const csvContent = '\uFEFF' + lines.map(row => row.join(',')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${s.report_id}_Weave_Kiran_Report.csv`;
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
          <span className="text-sm font-bold text-slate-700">Loading Quality Report...</span>
        </div>
      </div>
    );
  }

  if (!report) return null;

  const s = report.summary;
  const mf = report.defect_breakdown.most_frequent_defect;
  const td = report.technical_details;
  const allLogs = report.defect_log || [];
  const visibleLogs = showAllLogs ? allLogs : allLogs.slice(0, 10);
  const pieData = report.defect_breakdown.rows.filter(r => r.count > 0);
  const nonMajorPct =
    s.total_defects > 0
      ? Math.round(((s.total_defects - s.high_defects) / s.total_defects) * 100)
      : 100;

  return (
    <div className="h-full overflow-y-auto p-4 md:p-6 flex flex-col gap-5 bg-[#F5F6F8]">
      {/* 1. SIMPLE TOP HEADER */}
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
              {report.subtitle} • Report ID: <strong className="font-mono">{s.report_id}</strong>
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <select
            value={scope}
            onChange={e => setScope(e.target.value)}
            className="px-3 py-2 text-xs font-bold rounded-xl border border-slate-300 bg-slate-50 text-[#0F172A]"
          >
            <option value="latest_session">Latest Session</option>
            <option value="all">All Records ({report.total_db_records})</option>
          </select>

          <button
            type="button"
            onClick={handleDownloadPDF}
            disabled={downloadingPdf}
            style={{ backgroundColor: '#EA580C', color: '#FFFFFF', padding: '8px 16px' }}
            className="flex items-center gap-2 rounded-xl text-xs font-extrabold shadow-sm cursor-pointer whitespace-nowrap"
          >
            <Download className="w-4 h-4" />
            <span>{downloadingPdf ? 'Preparing PDF…' : 'Download PDF Report'}</span>
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

      {/* 2. FINAL RESULT BANNER + 4 KPI CARDS */}
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
                FINAL INSPECTION RESULT • {s.loom_id}
              </div>
              <h2 className="text-xl font-black text-[#0F172A] mt-0.5">
                {s.quality_grade} — {s.final_status}
              </h2>
              <p className="text-xs md:text-sm text-slate-700 font-medium mt-1">
                {s.plain_english_summary}
              </p>
            </div>
          </div>
        </div>

        {/* 4 Simple KPI Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="bg-white rounded-xl p-3.5 border border-slate-200">
            <div className="flex items-center justify-between text-[11px] font-bold text-slate-500 uppercase">
              <span>Fabric Inspected</span>
              <Ruler className="w-4 h-4 text-[#EA580C]" />
            </div>
            <div className="text-lg font-black text-[#0F172A] mt-1">
              {s.effective_length_m ? `${s.effective_length_m} m` : '0.00 m (Sensor Idle)'}
            </div>
            <div className="text-[11px] text-slate-400">Duration: {s.inspection_duration_display}</div>
          </div>

          <div className="bg-white rounded-xl p-3.5 border border-slate-200">
            <div className="flex items-center justify-between text-[11px] font-bold text-slate-500 uppercase">
              <span>Total Defects</span>
              <AlertTriangle className="w-4 h-4 text-red-600" />
            </div>
            <div className="text-lg font-black text-red-600 mt-1">{s.total_defects}</div>
            <div className="text-[11px] text-slate-500">
              {s.high_defects} Major • {s.medium_defects + s.low_defects} Minor/Med
            </div>
          </div>

          <div className="bg-white rounded-xl p-3.5 border border-slate-200">
            <div className="flex items-center justify-between text-[11px] font-bold text-slate-500 uppercase">
              <span>Non-Major / Passable %</span>
              <ShieldCheck className="w-4 h-4 text-emerald-600" />
            </div>
            <div className="text-lg font-black text-emerald-700 mt-1">
              {s.defect_free_pct != null ? `${s.defect_free_pct}%` : `${nonMajorPct}%`}
            </div>
            <div className="text-[11px] text-slate-400">Low/Medium repairable share</div>
          </div>

          <div className="bg-white rounded-xl p-3.5 border border-slate-200">
            <div className="flex items-center justify-between text-[11px] font-bold text-slate-500 uppercase">
              <span>Final Quality Grade</span>
              <Award className="w-4 h-4 text-[#EA580C]" />
            </div>
            <div className="text-lg font-black text-[#EA580C] mt-1">{s.quality_grade}</div>
            <div className="text-[11px] text-slate-500">{s.inspection_end_display}</div>
          </div>
        </div>
      </div>

      {/* 3. UNDERSTAND THE DEFECTS (CHARTS + SIMPLE TABLE) */}
      <div className="bg-white rounded-2xl p-5 border border-[#E5E7EB] shadow-xs flex flex-col gap-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-[#EA580C]" />
            <h3 className="text-sm font-black text-[#0F172A] uppercase">
              What Defects Were Found & What To Do
            </h3>
          </div>
          {mf && (
            <span className="px-3 py-1 rounded-full bg-red-50 text-red-700 border border-red-200 text-xs font-bold">
              Most Frequent: {mf.defect_name} ({mf.count} found — {mf.share_pct}%)
            </span>
          )}
        </div>

        {/* Simple Charts */}
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
                <Tooltip formatter={val => [`${val} defects`, 'Count']} />
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
                No Defects Detected
              </div>
            )}
          </div>
        </div>

        {/* Clean 4-Column Table */}
        <div className="overflow-x-auto border border-slate-200 rounded-xl">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-100 text-slate-700 font-extrabold uppercase border-b border-slate-200">
              <tr>
                <th className="py-2.5 px-3.5">Defect Name</th>
                <th className="py-2.5 px-3.5">Count</th>
                <th className="py-2.5 px-3.5">Simple Meaning</th>
                <th className="py-2.5 px-3.5">What Should the Factory Do?</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {report.defect_breakdown.rows.map(row => (
                <tr key={row.defect_name} className="hover:bg-slate-50">
                  <td className="py-2.5 px-3.5 font-black text-[#0F172A]">{row.defect_name}</td>
                  <td className="py-2.5 px-3.5 font-extrabold text-[#0F172A]">
                    {row.count} <span className="text-slate-400">({row.share_pct}%)</span>
                  </td>
                  <td className="py-2.5 px-3.5 text-slate-600">{row.what_it_means}</td>
                  <td className="py-2.5 px-3.5 font-semibold text-[#EA580C]">{row.factory_action}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* 4. FABRIC DECISION & RECOMMENDED ACTIONS (SIDE BY SIDE) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Commercial Quality Decision */}
        <div className="bg-white rounded-2xl p-5 border border-[#E5E7EB] shadow-xs flex flex-col gap-3">
          <div className="flex items-center gap-2 border-b border-slate-100 pb-2.5">
            <ClipboardCheck className="w-5 h-5 text-[#EA580C]" />
            <h3 className="text-sm font-black text-[#0F172A] uppercase">
              Fabric Quality Decision
            </h3>
          </div>
          <p className="text-xs text-slate-500">
            Every defect does not reject the whole roll — stains and thread errors can be cleaned or mended locally.
          </p>
          <div className="divide-y divide-slate-100 border border-slate-200 rounded-xl overflow-hidden text-xs">
            {report.quality_decision.rows.map(q => (
              <div key={q.category} className="p-3 bg-slate-50/50 flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                <div>
                  <div className="font-black text-[#0F172A]">{q.category}</div>
                  <div className="text-[11px] text-slate-500">{q.meaning}</div>
                </div>
                <span className="font-extrabold text-[#EA580C] sm:text-right">{q.quantity}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Recommended Actions & QA Sign-Off */}
        <div className="bg-white rounded-2xl p-5 border border-[#E5E7EB] shadow-xs flex flex-col justify-between gap-4">
          <div className="flex flex-col gap-3">
            <div className="flex items-center gap-2 border-b border-slate-100 pb-2.5">
              <Wrench className="w-5 h-5 text-[#EA580C]" />
              <h3 className="text-sm font-black text-[#0F172A] uppercase">
                Recommended Factory Actions
              </h3>
            </div>
            <div className="flex flex-col gap-2">
              {report.recommendations.slice(0, 4).map((rec, i) => (
                <div key={i} className="p-3 rounded-xl bg-slate-50 border border-slate-200 flex items-start gap-2.5 text-xs">
                  <span
                    style={{ backgroundColor: '#EA580C', color: '#FFFFFF' }}
                    className="w-5 h-5 rounded-full font-black text-[11px] flex items-center justify-center flex-shrink-0 mt-0.5"
                  >
                    {i + 1}
                  </span>
                  <div>
                    <div className="font-bold text-[#0F172A]">{rec.title}</div>
                    <div className="text-slate-600 text-[11px] mt-0.5">{rec.detail}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Simple QA Sign-Off Strip */}
          <div className="p-3.5 rounded-xl bg-emerald-50/70 border border-emerald-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
            <div>
              <div className="font-black text-emerald-900">QA Verification: {s.final_status}</div>
              <div className="text-[11px] text-emerald-700">
                Verified from {s.total_defects} database records • {s.report_generated_display}
              </div>
            </div>
            <span className="font-black text-sm text-[#EA580C] bg-white px-3 py-1 rounded-lg border border-emerald-200">
              {s.quality_grade}
            </span>
          </div>
        </div>
      </div>

      {/* 5. COMPACT TECHNICAL DETAILS & DEFECT LOG (AT THE END) */}
      <div className="bg-white rounded-2xl p-5 border border-[#E5E7EB] shadow-xs flex flex-col gap-3.5">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-2.5">
          <div className="flex items-center gap-2">
            <Cpu className="w-5 h-5 text-blue-600" />
            <h3 className="text-sm font-black text-[#0F172A] uppercase">
              Technical Summary & Defect Log ({allLogs.length} Records)
            </h3>
          </div>
          <span className="text-xs font-mono text-slate-600 bg-slate-100 px-2.5 py-1 rounded-lg">
            Model: YOLO26s (best.pt) • 640×640 • Avg Confidence: {td.mean_confidence_pct}%
          </span>
        </div>

        <div className="overflow-x-auto border border-slate-200 rounded-xl">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-100 text-slate-700 font-extrabold uppercase border-b border-slate-200">
              <tr>
                <th className="py-2 px-3">#</th>
                <th className="py-2 px-3">Event ID</th>
                <th className="py-2 px-3">Time</th>
                <th className="py-2 px-3">Defect Type</th>
                <th className="py-2 px-3">Confidence</th>
                <th className="py-2 px-3">Severity</th>
                <th className="py-2 px-3">Meter Position</th>
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
                  <td className="py-2 px-3 font-mono text-slate-600">{item.meter_position}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {allLogs.length > 10 && (
          <div className="flex justify-center">
            <button
              type="button"
              onClick={() => setShowAllLogs(prev => !prev)}
              className="px-4 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-xs font-bold text-slate-700 cursor-pointer"
            >
              {showAllLogs ? 'Show Top 10 Only' : `Show All ${allLogs.length} Records`}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
