import React, { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '../supabaseClient';
import { useNavigate } from 'react-router-dom';

const STRATEGIES = [
  { key: 'chartvision', label: 'ChartVision', color: 'purple', icon: '📊' },
  { key: 'smc',         label: 'SMC',         color: 'yellow', icon: '🏦' },
  { key: 'dual_ai',     label: 'DUAL AI',     color: 'blue',   icon: '🤖' },
];

const colorMap = {
  purple: { border: 'border-purple-500/30', bg: 'bg-purple-500/5',  text: 'text-purple-400', badge: 'bg-purple-500/20 text-purple-300', hover: 'hover:border-purple-500/50' },
  yellow: { border: 'border-yellow-500/30', bg: 'bg-yellow-500/5',  text: 'text-yellow-400', badge: 'bg-yellow-500/20 text-yellow-300', hover: 'hover:border-yellow-500/50' },
  blue:   { border: 'border-blue-500/30',   bg: 'bg-blue-500/5',    text: 'text-blue-400',   badge: 'bg-blue-500/20 text-blue-300',     hover: 'hover:border-blue-500/50' },
};

// Extract metrics from a report's data blob
function getMetrics(report) {
  const d = report.data || {};
  const inst = d.institutionalMetrics || {};
  const met  = d.metrics || {};
  return {
    winRate:    parseFloat(inst.winRate || 0),
    maxDD:      parseFloat(met.maxDrawdown || 0),
    rr:         parseFloat(inst.expectancy || 0),
    pf:         parseFloat(inst.profitFactor || 0),
    totalPnl:   parseFloat(met.totalPnL || d.totalReturn || 0),
    tradeCount: parseInt(inst.totalTrades || d.tradeCount || (d.individualTrades?.length) || 0),
    fileName:   d.fileName || 'unnamed.csv',
    date:       d.uploadedAt
      ? new Date(d.uploadedAt).toLocaleDateString('en-GB', { day:'2-digit', month:'short', year:'2-digit' })
      : d.fileName?.match(/(\d{8})/)
        ? `${d.fileName.match(/(\d{8})/)[1].slice(0,4)}-${d.fileName.match(/(\d{8})/)[1].slice(4,6)}-${d.fileName.match(/(\d{8})/)[1].slice(6,8)}`
        : '—',
  };
}

const SORT_OPTIONS = [
  { key: 'wr',   label: 'WR',  field: 'winRate',  desc: true },
  { key: 'dd',   label: 'DD',  field: 'maxDD',    desc: false },
  { key: 'rr',   label: 'R:R', field: 'rr',       desc: true },
  { key: 'pnl',  label: 'PnL', field: 'totalPnl', desc: true },
];

function ReportCard({ report, colors, onDelete, isLatest }) {
  const navigate = useNavigate();
  const m = getMetrics(report);

  const pnlColor = m.totalPnl >= 0 ? 'text-green-400' : 'text-red-400';
  const wrColor  = m.winRate >= 50 ? 'text-green-400' : m.winRate >= 40 ? 'text-yellow-400' : 'text-red-400';
  const ddColor  = m.maxDD <= 10 ? 'text-green-400' : m.maxDD <= 20 ? 'text-yellow-400' : 'text-red-400';
  const rrColor  = m.rr > 0 ? 'text-green-400' : 'text-red-400';

  return (
    <div
      className={`${colors.bg} ${colors.border} ${colors.hover} border rounded-lg p-3 cursor-pointer
                  transition-all hover:shadow-lg hover:shadow-blue-500/5 group relative`}
      onClick={() => navigate(`/results/${report.id}`)}
    >
      <button
        onClick={(e) => { e.stopPropagation(); onDelete(report.id); }}
        className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 text-slate-600 hover:text-red-400
                   transition-opacity text-sm px-1.5 py-0.5 rounded hover:bg-red-400/10"
        title="Delete report"
      >
        ✕
      </button>

      <div className="text-[11px] text-slate-500 mb-2 truncate pr-5" title={m.fileName}>{m.fileName}</div>

      <div className="grid grid-cols-5 gap-1">
        <div>
          <div className="text-[9px] text-slate-600 uppercase tracking-wider">Trades</div>
          <div className="text-xs font-bold text-slate-300">{m.tradeCount}</div>
        </div>
        <div>
          <div className="text-[9px] text-slate-600 uppercase tracking-wider">Win%</div>
          <div className={`text-xs font-bold ${wrColor}`}>{m.winRate.toFixed(1)}%</div>
        </div>
        <div>
          <div className="text-[9px] text-slate-600 uppercase tracking-wider">Max DD</div>
          <div className={`text-xs font-bold ${ddColor}`}>{m.maxDD.toFixed(1)}%</div>
        </div>
        <div>
          <div className="text-[9px] text-slate-600 uppercase tracking-wider">R:R</div>
          <div className={`text-xs font-bold ${rrColor}`}>{m.rr.toFixed(2)}</div>
        </div>
        <div>
          <div className="text-[9px] text-slate-600 uppercase tracking-wider">PnL</div>
          <div className={`text-xs font-bold ${pnlColor}`}>${m.totalPnl.toFixed(0)}</div>
        </div>
      </div>

      <div className="flex items-center justify-between mt-2">
        <div className="flex items-center gap-2">
          {isLatest && (
            <span className="px-1.5 py-0.5 bg-green-500/20 text-green-400 text-[9px] font-bold tracking-wider uppercase rounded">
              LATEST
            </span>
          )}
          {m.pf > 0 && <span className="text-[9px] text-slate-600">PF {m.pf.toFixed(2)}</span>}
        </div>
        <span className="text-[11px] font-semibold text-slate-300">{m.date}</span>
      </div>
    </div>
  );
}

export default function CsvLibrary({ user, onLogout }) {
  const [reports, setReports]     = useState([]);
  const [loading, setLoading]     = useState(true);
  const [uploading, setUploading] = useState(false);
  const [uploadMsg, setUploadMsg] = useState(null);
  const [dragOver, setDragOver]   = useState(false);
  // Per-strategy sort: { chartvision: 'wr', smc: 'dd', dual_ai: 'rr' }
  const [sortBy, setSortBy] = useState({});
  const fileInputRef = useRef(null);
  const navigate = useNavigate();

  const fetchReports = useCallback(async () => {
    try {
      const { data, error } = await supabase.rpc('get_library_reports');
      if (error) throw error;
      const all = (data || []).map(r => ({
        id: r.id,
        createdAt: r.created_at,
        data: {
          strategy: r.strategy,
          fileName: r.file_name,
          tradeCount: r.trade_count,
          uploadedAt: r.uploaded_at || r.created_at,
          institutionalMetrics: {
            totalTrades: String(r.trade_count),
            winRate: String(r.win_rate),
            expectancy: String(r.expectancy),
            profitFactor: String(r.profit_factor),
          },
          metrics: {
            maxDrawdown: String(r.max_dd),
            totalPnL: String(r.total_pnl),
          },
        },
      }));
      setReports(all);
    } catch (e) {
      console.error('Fetch reports error:', e);
    }
    setLoading(false);
  }, []);

  useEffect(() => { fetchReports(); }, [fetchReports]);

  const getStrategy = (report) => {
    const d = report.data || {};
    if (d.strategy) return d.strategy;
    // Fallback: derive from headerData.strategy written by detectStrategy()
    const hs = (d.headerData?.strategy || '').toUpperCase();
    if (hs.includes('CHARTVISION')) return 'chartvision';
    if (hs.includes('SMC')) return 'smc';
    if (hs.includes('DUAL') || hs.includes('MULTI')) return 'dual_ai';
    return 'unknown';
  };

  const processFile = async (file) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = async () => {
        try {
          const response = await fetch('/api/generate-report', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ csv: reader.result, fileName: file.name }),
          });
          const data = await response.json();
          if (!response.ok) throw new Error(data.error || 'Failed to process');
          resolve({ fileName: file.name, id: data.id, strategy: data.strategy });
        } catch (e) { reject(e); }
      };
      reader.onerror = () => reject(new Error('File read failed'));
      reader.readAsText(file);
    });
  };

  const handleFiles = async (files) => {
    const csvFiles = Array.from(files).filter(f => f.name.endsWith('.csv'));
    if (csvFiles.length === 0) return;

    setUploading(true);
    setUploadMsg(`Processing ${csvFiles.length} file(s)...`);

    let success = 0;
    let failed  = 0;
    for (const file of csvFiles) {
      try {
        setUploadMsg(`Processing: ${file.name} (${success + failed + 1}/${csvFiles.length})`);
        await processFile(file);
        success++;
      } catch (e) {
        console.error(`Failed: ${file.name}`, e);
        failed++;
      }
    }

    setUploadMsg(`Done: ${success} uploaded${failed ? `, ${failed} failed` : ''}`);
    setTimeout(() => setUploadMsg(null), 4000);
    setUploading(false);
    fetchReports();
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    handleFiles(e.dataTransfer.files);
  };

  const handleFileInput = (e) => {
    handleFiles(e.target.files);
    e.target.value = '';
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this report?')) return;
    try {
      await supabase.from('results').delete().eq('id', id);
      setReports(prev => prev.filter(r => r.id !== id));
    } catch (e) {
      console.error('Delete error:', e);
    }
  };

  const grouped = {};
  for (const s of STRATEGIES) grouped[s.key] = [];
  grouped['unknown'] = [];
  for (const r of reports) {
    const strat = getStrategy(r);
    if (grouped[strat]) grouped[strat].push(r);
    else grouped['unknown'].push(r);
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-800">
      <style>{`
        .slim-scroll::-webkit-scrollbar { width: 4px; }
        .slim-scroll::-webkit-scrollbar-track { background: transparent; }
        .slim-scroll::-webkit-scrollbar-thumb { background: rgba(100,116,139,0.3); border-radius: 4px; }
        .slim-scroll::-webkit-scrollbar-thumb:hover { background: rgba(100,116,139,0.5); }
        .slim-scroll { scrollbar-width: thin; scrollbar-color: rgba(100,116,139,0.3) transparent; }
      `}</style>
      {/* Header */}
      <header className="border-b border-slate-700/50 px-6 py-4 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-blue-400 tracking-wider">CSV LIBRARY</h1>
          <p className="text-xs text-slate-500 tracking-wider mt-0.5">
            {reports.length} report{reports.length !== 1 ? 's' : ''} stored
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-xs text-slate-600">{user?.email}</div>
          <button
            onClick={onLogout}
            className="text-xs text-slate-600 hover:text-red-400 transition-colors tracking-wider"
          >
            Sign Out
          </button>
        </div>
      </header>

      {/* Drop zone */}
      <div className="px-6 pt-4">
        <div
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className={`border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-all
                      ${dragOver
                        ? 'border-blue-400 bg-blue-400/5 shadow-lg shadow-blue-500/10'
                        : 'border-slate-700 hover:border-slate-500 bg-slate-800/20'}`}
        >
          <input ref={fileInputRef} type="file" accept=".csv" multiple onChange={handleFileInput} className="hidden" />
          <div className="text-slate-500 text-sm">
            {uploading
              ? <span className="text-blue-400 animate-pulse">{uploadMsg}</span>
              : uploadMsg
              ? <span className={uploadMsg.startsWith('Error') ? 'text-red-400' : 'text-green-400'}>{uploadMsg}</span>
              : <>
                  <span className="text-lg">📁</span>{' '}
                  Drop CSV files here or <span className="text-blue-400 underline">browse</span>{' '}
                  <span className="text-slate-600">— auto-classified into ChartVision / SMC / DUAL AI</span>
                </>
            }
          </div>
        </div>
      </div>

      {/* 3 strategy columns */}
      <div className="px-6 py-4 grid grid-cols-1 md:grid-cols-3 gap-6" style={{ minHeight: 'calc(100vh - 220px)' }}>
        {STRATEGIES.map(s => {
          const colors  = colorMap[s.color];
          const items   = grouped[s.key] || [];
          const activeSort = sortBy[s.key] || null;

          // Sort items if a sort tab is active
          const sortedItems = activeSort
            ? [...items].sort((a, b) => {
                const opt = SORT_OPTIONS.find(o => o.key === activeSort);
                if (!opt) return 0;
                const ma = getMetrics(a);
                const mb = getMetrics(b);
                const va = ma[opt.field] || 0;
                const vb = mb[opt.field] || 0;
                return opt.desc ? vb - va : va - vb;
              })
            : items;

          return (
            <div key={s.key} className={`${colors.border} border rounded-xl p-4`}>
              {/* Column header */}
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span className="text-lg">{s.icon}</span>
                  <span className={`text-sm font-bold ${colors.text} tracking-wider uppercase`}>{s.label}</span>
                </div>
                <span className={`text-xs px-2 py-0.5 rounded-full ${colors.badge} font-bold`}>
                  {items.length}
                </span>
              </div>

              {/* Sort tabs */}
              {items.length > 1 && (
                <div className="flex gap-1 mb-3">
                  {SORT_OPTIONS.map(opt => (
                    <button
                      key={opt.key}
                      onClick={() => setSortBy(prev => ({
                        ...prev,
                        [s.key]: prev[s.key] === opt.key ? null : opt.key,
                      }))}
                      className={`px-2 py-0.5 text-[10px] font-bold tracking-wider rounded transition-all
                        ${activeSort === opt.key
                          ? `${colors.badge} ring-1 ring-current`
                          : 'text-slate-600 hover:text-slate-400 bg-slate-800/50'
                        }`}
                    >
                      {opt.label} {activeSort === opt.key ? (opt.desc ? '↓' : '↑') : ''}
                    </button>
                  ))}
                </div>
              )}

              {/* Report cards */}
              <div className="space-y-3 max-h-[calc(100vh-360px)] overflow-y-auto slim-scroll">
                {sortedItems.length === 0 ? (
                  <div className="text-center py-8 text-slate-700 text-xs tracking-wider uppercase">
                    No reports yet
                  </div>
                ) : (
                  sortedItems.map((r, idx) => (
                    <ReportCard key={r.id} report={r} colors={colors} onDelete={handleDelete} isLatest={idx === 0 && !activeSort} />
                  ))
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Unknown bucket — only show if there are unclassified reports */}
      {grouped['unknown'].length > 0 && (
        <div className="px-6 pb-6">
          <div className="border border-slate-700/30 rounded-xl p-4">
            <div className="text-sm font-bold text-slate-500 tracking-wider mb-3">UNCLASSIFIED ({grouped['unknown'].length})</div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {grouped['unknown'].map(r => (
                <ReportCard key={r.id} report={r} colors={colorMap.blue} onDelete={handleDelete} />
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
