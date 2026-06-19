import React, { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '../supabaseClient';
import { AreaChart, Area, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import * as XLSX from 'xlsx';

const ACCOUNT_COLORS = ['#3b82f6', '#f59e0b', '#10b981', '#a855f7', '#ef4444', '#06b6d4'];

function StatCard({ label, value, color }) {
  return (
    <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-3 text-center">
      <div className="text-[10px] text-slate-500 uppercase tracking-wider">{label}</div>
      <div className={`text-sm font-bold ${color || 'text-slate-200'}`}>{value}</div>
    </div>
  );
}

export default function LiveTrading({ user }) {
  const [statements, setStatements] = useState([]);
  const [backtestCurves, setBacktestCurves] = useState([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [uploadMsg, setUploadMsg] = useState(null);
  const [dragOver, setDragOver] = useState(false);
  const [compareMode, setCompareMode] = useState(false);
  const [selectedBacktests, setSelectedBacktests] = useState([]);
  const fileInputRef = useRef(null);

  const fetchStatements = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('live_statements')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      setStatements(data || []);
    } catch (e) {
      console.error('Fetch statements error:', e);
    }
    setLoading(false);
  }, []);

  const fetchBacktestCurves = useCallback(async () => {
    try {
      const { data, error } = await supabase.rpc('get_library_reports');
      if (error) throw error;
      setBacktestCurves(data || []);
    } catch (e) {
      console.error('Fetch backtests error:', e);
    }
  }, []);

  useEffect(() => { fetchStatements(); fetchBacktestCurves(); }, [fetchStatements, fetchBacktestCurves]);

  const processXlsx = async (file) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = async (e) => {
        try {
          const wb = XLSX.read(e.target.result, { type: 'array' });
          const ws = wb.Sheets[wb.SheetNames[0]];
          const rows = XLSX.utils.sheet_to_json(ws, { header: 1 });

          // Extract account ID from filename: cT_5840132_2026-06-18_23-48.xlsx
          const match = file.name.match(/cT_(\d+)/);
          const accountId = match ? match[1] : file.name.replace('.xlsx', '');

          const response = await fetch('/api/upload-statement', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ rows, accountId, accountLabel: null }),
          });
          const data = await response.json();
          if (!response.ok) throw new Error(data.error);
          resolve(data);
        } catch (err) {
          reject(err);
        }
      };
      reader.onerror = () => reject(new Error('Failed to read file'));
      reader.readAsArrayBuffer(file);
    });
  };

  const handleFiles = async (files) => {
    setUploading(true);
    setUploadMsg('Processing statements...');
    let success = 0, failed = 0;
    for (const file of Array.from(files)) {
      if (!file.name.endsWith('.xlsx') && !file.name.endsWith('.xls')) {
        failed++;
        continue;
      }
      try {
        await processXlsx(file);
        success++;
      } catch (e) {
        console.error('Upload error:', e);
        failed++;
      }
    }
    setUploadMsg(`Done: ${success} uploaded${failed ? `, ${failed} failed` : ''}`);
    setTimeout(() => setUploadMsg(null), 4000);
    setUploading(false);
    fetchStatements();
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    handleFiles(e.dataTransfer.files);
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this statement?')) return;
    await supabase.from('live_statements').delete().eq('id', id);
    setStatements(prev => prev.filter(s => s.id !== id));
  };

  // Build unified equity chart data
  const buildEquityData = () => {
    if (!statements.length) return [];

    // For each statement, build a normalized equity series (% return)
    const series = statements.map((st, idx) => {
      const deals = st.deals || [];
      const startBal = deals.length > 0 ? deals[0].balance - deals[0].netPnl : 3000;
      let bal = startBal;
      return deals.map((d, i) => {
        bal = d.balance;
        return {
          trade: i + 1,
          [`acct_${st.account_id}`]: ((bal - startBal) / startBal * 100),
          [`bal_${st.account_id}`]: bal,
        };
      });
    });

    // Merge into unified array by trade index
    const maxLen = Math.max(...series.map(s => s.length));
    const merged = [];
    for (let i = 0; i < maxLen; i++) {
      const point = { trade: i + 1 };
      series.forEach((s) => {
        if (s[i]) Object.assign(point, s[i]);
      });
      merged.push(point);
    }
    return merged;
  };

  // Build comparison data: live vs backtest equity curves (normalized %)
  const buildComparisonData = () => {
    const data = [];

    // Add live accounts
    statements.forEach((st) => {
      const deals = st.deals || [];
      const startBal = deals.length > 0 ? deals[0].balance - deals[0].netPnl : 3000;
      let bal = startBal;
      deals.forEach((d, i) => {
        bal = d.balance;
        if (!data[i]) data[i] = { trade: i + 1 };
        data[i][`Live ${st.account_label || st.account_id}`] = ((bal - startBal) / startBal * 100);
      });
    });

    // Add selected backtest curves (we need full data for these)
    // We'll fetch on demand when compare mode is activated
    return data;
  };

  const toggleBacktest = (id) => {
    setSelectedBacktests(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  const equityData = buildEquityData();

  if (loading) {
    return <div className="text-center py-20 text-blue-400 animate-pulse tracking-widest text-sm">LOADING STATEMENTS...</div>;
  }

  return (
    <div className="space-y-6">
      {/* Upload area */}
      <div
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        className={`border-2 border-dashed rounded-xl p-6 text-center transition-all cursor-pointer
          ${dragOver ? 'border-blue-500 bg-blue-500/10' : 'border-slate-700 hover:border-slate-500'}`}
        onClick={() => fileInputRef.current?.click()}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept=".xlsx,.xls"
          multiple
          className="hidden"
          onChange={(e) => { handleFiles(e.target.files); e.target.value = ''; }}
        />
        <div className="text-slate-500 text-sm">
          {uploading ? (
            <span className="text-blue-400 animate-pulse">{uploadMsg}</span>
          ) : (
            <>Drop cTrader <span className="text-blue-400 font-bold">.xlsx</span> statements here or click to browse</>
          )}
        </div>
        {uploadMsg && !uploading && (
          <div className="text-green-400 text-xs mt-2">{uploadMsg}</div>
        )}
      </div>

      {/* Account cards */}
      {statements.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {statements.map((st, idx) => {
            const s = st.summary || {};
            const pnlNum = parseFloat(s.totalPnl || 0);
            const wrNum = parseFloat(s.winRate || 0);
            const color = ACCOUNT_COLORS[idx % ACCOUNT_COLORS.length];
            return (
              <div key={st.id} className="bg-slate-800/40 border border-slate-700 rounded-xl p-4 relative group">
                <button
                  onClick={() => handleDelete(st.id)}
                  className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 text-slate-600 hover:text-red-400
                             transition-opacity text-sm px-1.5 py-0.5 rounded hover:bg-red-400/10"
                >
                  ✕
                </button>

                <div className="flex items-center gap-2 mb-3">
                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: color }}></div>
                  <span className="text-sm font-bold text-slate-300 tracking-wider">
                    {st.account_label || `Account ${st.account_id}`}
                  </span>
                  {idx === 0 && (
                    <span className="px-1.5 py-0.5 bg-green-500/20 text-green-400 text-[9px] font-bold tracking-wider uppercase rounded">
                      LATEST
                    </span>
                  )}
                </div>

                <div className="grid grid-cols-4 gap-2 mb-3">
                  <StatCard label="Trades" value={s.trades} />
                  <StatCard label="Win%" value={`${s.winRate}%`} color={wrNum >= 50 ? 'text-green-400' : 'text-yellow-400'} />
                  <StatCard label="PnL" value={`$${s.totalPnl}`} color={pnlNum >= 0 ? 'text-green-400' : 'text-red-400'} />
                  <StatCard label="Return" value={`${s.returnPct}%`} color={pnlNum >= 0 ? 'text-green-400' : 'text-red-400'} />
                </div>

                <div className="grid grid-cols-3 gap-2">
                  <StatCard label="Max DD" value={`${s.maxDrawdown}%`} color={parseFloat(s.maxDrawdown) <= 5 ? 'text-green-400' : 'text-yellow-400'} />
                  <StatCard label="PF" value={s.profitFactor} color={parseFloat(s.profitFactor) >= 1.5 ? 'text-green-400' : 'text-slate-300'} />
                  <StatCard label="Avg W/L" value={`$${s.avgWin}/$${s.avgLoss}`} color="text-slate-300" />
                </div>

                <div className="mt-3 text-[10px] text-slate-600 flex justify-between">
                  <span>{s.firstTrade?.split(' ')[0]} → {s.lastTrade?.split(' ')[0]}</span>
                  <span>${s.startBalance} → ${s.endBalance}</span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Equity curves */}
      {equityData.length > 0 && (
        <div className="bg-slate-800/40 border border-slate-700 rounded-xl p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-bold text-blue-400 tracking-wider uppercase">
              Live Equity Curves (% Return)
            </h3>
            <button
              onClick={() => setCompareMode(!compareMode)}
              className={`px-3 py-1 text-[10px] font-bold tracking-wider uppercase rounded-lg border transition-all
                ${compareMode
                  ? 'bg-purple-500/20 border-purple-500/40 text-purple-400'
                  : 'bg-slate-700/50 border-slate-600 text-slate-500 hover:text-slate-300'
                }`}
            >
              {compareMode ? 'Hide Backtests' : 'Compare vs Backtests'}
            </button>
          </div>

          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={equityData} margin={{ top: 5, right: 20, left: -10, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                <XAxis dataKey="trade" stroke="#64748b" tick={{ fill: '#64748b', fontSize: 11 }} label={{ value: 'Trade #', position: 'insideBottom', offset: -3, fill: '#64748b', fontSize: 11 }} />
                <YAxis stroke="#64748b" tick={{ fill: '#64748b', fontSize: 11 }} tickFormatter={v => `${v.toFixed(1)}%`} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: '8px', fontSize: '12px' }}
                  formatter={(value, name) => {
                    const acctId = name.replace('acct_', '');
                    const st = statements.find(s => s.account_id === acctId);
                    return [`${value.toFixed(2)}%`, st?.account_label || `Account ${acctId}`];
                  }}
                />
                <Legend
                  formatter={(value) => {
                    const acctId = value.replace('acct_', '');
                    const st = statements.find(s => s.account_id === acctId);
                    return st?.account_label || `Account ${acctId}`;
                  }}
                  wrapperStyle={{ fontSize: '11px' }}
                />
                {statements.map((st, idx) => (
                  <Line
                    key={st.account_id}
                    type="monotone"
                    dataKey={`acct_${st.account_id}`}
                    stroke={ACCOUNT_COLORS[idx % ACCOUNT_COLORS.length]}
                    strokeWidth={2}
                    dot={false}
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Compare mode: select backtests */}
      {compareMode && (
        <div className="bg-slate-800/40 border border-purple-500/20 rounded-xl p-5">
          <h3 className="text-sm font-bold text-purple-400 tracking-wider uppercase mb-3">
            Select Backtests to Overlay
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-4">
            {backtestCurves.map(bt => {
              const selected = selectedBacktests.includes(bt.id);
              const stratColor = bt.strategy === 'chartvision' ? 'purple' : bt.strategy === 'smc' ? 'yellow' : 'blue';
              return (
                <button
                  key={bt.id}
                  onClick={() => toggleBacktest(bt.id)}
                  className={`text-left p-2 rounded-lg border text-[11px] transition-all
                    ${selected
                      ? `border-${stratColor}-500/50 bg-${stratColor}-500/10 text-${stratColor}-400`
                      : 'border-slate-700 text-slate-500 hover:border-slate-500'
                    }`}
                >
                  <div className="font-bold truncate">{bt.file_name}</div>
                  <div className="flex gap-2 mt-0.5">
                    <span>{bt.trade_count} trades</span>
                    <span className={parseFloat(bt.total_pnl) >= 0 ? 'text-green-400' : 'text-red-400'}>
                      ${parseFloat(bt.total_pnl).toFixed(0)}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>

          {selectedBacktests.length > 0 && (
            <ComparisonChart
              statements={statements}
              selectedBacktests={selectedBacktests}
            />
          )}
        </div>
      )}
    </div>
  );
}

function ComparisonChart({ statements, selectedBacktests }) {
  const [backtestData, setBacktestData] = useState({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchSelected = async () => {
      setLoading(true);
      const results = {};
      for (const id of selectedBacktests) {
        try {
          const { data, error } = await supabase
            .from('results')
            .select('data')
            .eq('id', id)
            .single();
          if (!error && data?.data) {
            results[id] = data.data;
          }
        } catch (e) {
          console.error('Fetch backtest error:', e);
        }
      }
      setBacktestData(results);
      setLoading(false);
    };
    fetchSelected();
  }, [selectedBacktests]);

  if (loading) return <div className="text-center py-8 text-purple-400 animate-pulse text-xs">Loading backtest data...</div>;

  // Build normalized comparison data (all as % return from starting balance)
  const allSeries = [];

  // Live accounts
  statements.forEach((st, idx) => {
    const deals = st.deals || [];
    const startBal = deals.length > 0 ? deals[0].balance - deals[0].netPnl : 3000;
    const points = deals.map((d, i) => ({
      trade: i + 1,
      value: ((d.balance - startBal) / startBal) * 100,
    }));
    allSeries.push({
      key: `live_${st.account_id}`,
      label: `Live ${st.account_label || st.account_id}`,
      color: ACCOUNT_COLORS[idx % ACCOUNT_COLORS.length],
      points,
      dashed: false,
    });
  });

  // Backtest accounts
  const btColors = ['#f472b6', '#fb923c', '#34d399', '#818cf8'];
  Object.entries(backtestData).forEach(([id, data], idx) => {
    const trades = data.individualTrades || [];
    if (!trades.length) return;
    const startBal = parseFloat(trades[0].balance_before || trades[0].balance_after - trades[0].pnl || 10000);
    let bal = startBal;
    const points = trades.map((t, i) => {
      bal += parseFloat(t.pnl || 0);
      return { trade: i + 1, value: ((bal - startBal) / startBal) * 100 };
    });
    const strategy = data.strategy || data.headerData?.strategy || 'unknown';
    allSeries.push({
      key: `bt_${id}`,
      label: `BT ${strategy.toUpperCase()} (${trades.length}t)`,
      color: btColors[idx % btColors.length],
      points,
      dashed: true,
    });
  });

  // Merge into unified data by normalized trade % (0-100% of each series)
  const maxLen = Math.max(...allSeries.map(s => s.points.length));
  const merged = [];
  for (let i = 0; i < maxLen; i++) {
    const point = { trade: i + 1 };
    allSeries.forEach(s => {
      // Normalize: map trade index proportionally
      const idx = Math.min(Math.floor((i / maxLen) * s.points.length), s.points.length - 1);
      point[s.key] = s.points[idx]?.value ?? null;
    });
    merged.push(point);
  }

  return (
    <div className="h-80">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={merged} margin={{ top: 5, right: 20, left: -10, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
          <XAxis dataKey="trade" stroke="#64748b" tick={{ fill: '#64748b', fontSize: 11 }} />
          <YAxis stroke="#64748b" tick={{ fill: '#64748b', fontSize: 11 }} tickFormatter={v => `${v.toFixed(1)}%`} />
          <Tooltip
            contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: '8px', fontSize: '11px' }}
            formatter={(value, name) => {
              const s = allSeries.find(x => x.key === name);
              return [value !== null ? `${value.toFixed(2)}%` : '—', s?.label || name];
            }}
          />
          <Legend
            formatter={(value) => {
              const s = allSeries.find(x => x.key === value);
              return s?.label || value;
            }}
            wrapperStyle={{ fontSize: '10px' }}
          />
          {allSeries.map(s => (
            <Line
              key={s.key}
              type="monotone"
              dataKey={s.key}
              stroke={s.color}
              strokeWidth={s.dashed ? 1.5 : 2}
              strokeDasharray={s.dashed ? '6 3' : undefined}
              dot={false}
              connectNulls
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
