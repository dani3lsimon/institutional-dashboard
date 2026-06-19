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

function ReportCard({ report, colors, onDelete }) {
  const navigate = useNavigate();
  const d = report.data || {};
  const winRate    = d.winRate || d.metrics?.winRate || '—';
  const totalPnl   = d.totalReturn || d.metrics?.totalPnL || '—';
  const tradeCount = d.tradeCount || d.individualTrades?.length || '—';
  const fileName   = d.fileName || 'unnamed.csv';
  const date       = d.uploadedAt ? new Date(d.uploadedAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: '2-digit' }) : '—';

  const pnlNum   = parseFloat(totalPnl);
  const pnlColor = isNaN(pnlNum) ? 'text-slate-400' : pnlNum >= 0 ? 'text-green-400' : 'text-red-400';

  return (
    <div
      className={`${colors.bg} ${colors.border} ${colors.hover} border rounded-lg p-4 cursor-pointer
                  transition-all hover:shadow-lg hover:shadow-blue-500/5 group relative`}
      onClick={() => navigate(`/results/${report.id}`)}
    >
      {/* Delete button */}
      <button
        onClick={(e) => { e.stopPropagation(); onDelete(report.id); }}
        className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 text-slate-600 hover:text-red-400
                   transition-opacity text-sm px-1.5 py-0.5 rounded hover:bg-red-400/10"
        title="Delete report"
      >
        ✕
      </button>

      <div className="text-xs text-slate-500 mb-1 truncate" title={fileName}>{fileName}</div>
      <div className="grid grid-cols-3 gap-2 mt-2">
        <div>
          <div className="text-[10px] text-slate-600 uppercase tracking-wider">Trades</div>
          <div className="text-sm font-bold text-slate-300">{tradeCount}</div>
        </div>
        <div>
          <div className="text-[10px] text-slate-600 uppercase tracking-wider">Win%</div>
          <div className="text-sm font-bold text-slate-300">{typeof winRate === 'number' ? winRate.toFixed(1) : winRate}%</div>
        </div>
        <div>
          <div className="text-[10px] text-slate-600 uppercase tracking-wider">PnL</div>
          <div className={`text-sm font-bold ${pnlColor}`}>
            {typeof totalPnl === 'number' ? `$${totalPnl.toFixed(0)}` : `$${totalPnl}`}
          </div>
        </div>
      </div>
      <div className="text-[10px] text-slate-600 mt-2">{date}</div>
    </div>
  );
}

export default function CsvLibrary({ user, onLogout }) {
  const [reports, setReports]     = useState([]);
  const [loading, setLoading]     = useState(true);
  const [uploading, setUploading] = useState(false);
  const [uploadMsg, setUploadMsg] = useState(null);
  const [dragOver, setDragOver]   = useState(false);
  const [fetchingAurum, setFetchingAurum] = useState(false);
  const fileInputRef = useRef(null);
  const navigate = useNavigate();

  const fetchReports = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('results')
        .select('id, data')
        .order('id', { ascending: false });
      if (error) throw error;
      setReports(data || []);
    } catch (e) {
      console.error('Fetch reports error:', e);
    }
    setLoading(false);
  }, []);

  useEffect(() => { fetchReports(); }, [fetchReports]);

  const getStrategy = (report) => {
    return report.data?.strategy || 'unknown';
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

  const handleFetchAurum = async () => {
    setFetchingAurum(true);
    setUploadMsg('Fetching latest from AURUM-X...');
    try {
      const csvRes = await fetch('https://aurum-x-backend-production.up.railway.app/forecast/signal-history/export.csv');
      if (!csvRes.ok) throw new Error('AURUM-X backend unreachable');
      const csvText = await csvRes.text();

      const response = await fetch('/api/generate-report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          csv: csvText,
          fileName: `aurum_x_${new Date().toISOString().slice(0, 10)}.csv`,
          strategy: 'dual_ai',
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed');
      setUploadMsg('AURUM-X data imported!');
      setTimeout(() => setUploadMsg(null), 3000);
      fetchReports();
    } catch (e) {
      setUploadMsg(`Error: ${e.message}`);
      setTimeout(() => setUploadMsg(null), 5000);
    }
    setFetchingAurum(false);
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
      {/* Header */}
      <header className="border-b border-slate-700/50 px-6 py-4 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-blue-400 tracking-wider">CSV LIBRARY</h1>
          <p className="text-xs text-slate-500 tracking-wider mt-0.5">
            {reports.length} report{reports.length !== 1 ? 's' : ''} stored
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={handleFetchAurum}
            disabled={fetchingAurum}
            className="px-4 py-2 bg-orange-600/20 border border-orange-500/30 hover:border-orange-500/60
                       text-orange-400 text-xs font-bold rounded-lg transition-all tracking-wider uppercase
                       disabled:opacity-40"
          >
            {fetchingAurum ? 'Fetching...' : '◆ Fetch AURUM-X'}
          </button>
          <button
            onClick={() => navigate('/')}
            className="px-4 py-2 bg-slate-700/50 border border-slate-600 hover:border-slate-500
                       text-slate-400 text-xs rounded-lg transition-all tracking-wider"
          >
            ← Upload Single
          </button>
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

          return (
            <div key={s.key} className={`${colors.border} border rounded-xl p-4`}>
              {/* Column header */}
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <span className="text-lg">{s.icon}</span>
                  <span className={`text-sm font-bold ${colors.text} tracking-wider uppercase`}>{s.label}</span>
                </div>
                <span className={`text-xs px-2 py-0.5 rounded-full ${colors.badge} font-bold`}>
                  {items.length}
                </span>
              </div>

              {/* Report cards */}
              <div className="space-y-3 max-h-[calc(100vh-320px)] overflow-y-auto pr-1">
                {items.length === 0 ? (
                  <div className="text-center py-8 text-slate-700 text-xs tracking-wider uppercase">
                    No reports yet
                  </div>
                ) : (
                  items.map(r => (
                    <ReportCard key={r.id} report={r} colors={colors} onDelete={handleDelete} />
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
