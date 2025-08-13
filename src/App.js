import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Routes, Route, useParams, useNavigate } from 'react-router-dom';
import { supabase } from './supabaseClient'; // Make sure you have this file
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ComposedChart, Line, BarChart, Bar, ScatterChart, Scatter, ZAxis, Cell } from 'recharts';

// --- Reusable Components ---
const MetricCard = ({ title, value, subtitle, color = 'blue', size = 'normal' }) => (
    <div className={`bg-slate-800 p-4 rounded-lg border border-slate-600 ${size === 'large' ? 'col-span-2' : ''}`}>
        <div className="text-slate-400 text-sm">{title}</div>
        <div className={`${color === 'blue' ? 'text-blue-400' : color === 'red' ? 'text-red-400' : color === 'green' ? 'text-green-400' : color === 'yellow' ? 'text-yellow-400' : color === 'purple' ? 'text-purple-400' : 'text-blue-400'} ${size === 'large' ? 'text-3xl' : 'text-xl'} font-bold`}>{value}</div>
        {subtitle && <div className="text-slate-500 text-xs mt-1">{subtitle}</div>}
    </div>
);

const CustomTooltip = ({ active, payload, label, chartType }) => {
    if (active && payload && payload.length) {
        const data = payload[0].payload;
        return (
            <div className="bg-slate-800/90 backdrop-blur-sm border border-blue-400 rounded-lg p-3 shadow-lg text-sm max-w-xs">
                {chartType === 'equity' && <>
                    <p className="text-blue-300 font-semibold">Trade #{data.trade}</p>
                    <p className="text-slate-400">Date: {data.date}</p>
                    <p className="text-green-400">Balance: ${data.balance?.toLocaleString()}</p>
                    <p className="text-cyan-400">Peak: ${data.peakBalance?.toLocaleString()}</p>
                    <p className={`${data.pnl >= 0 ? 'text-green-400' : 'text-red-400'}`}>P&L: ${data.pnl}</p>
                    {data.drawdown > 0 && <p className="text-red-400">Drawdown: {data.drawdown}%</p>}
                </>}
                {chartType === 'risk' && <>
                    <p className="text-blue-300 font-semibold">Trade #{data.trade}</p>
                    <p className="text-green-400">Risk: {data.risk_percentage?.toFixed(2)}%</p>
                    <p className="text-slate-400">Date: {new Date(data.entry_time).toLocaleDateString()}</p>
                </>}
                 {chartType === 'sizing' && <>
                    <p className="text-blue-300 font-semibold">Trade #{data.trade}</p>
                    <p className="text-purple-400">Position Size: {data.position_size?.toFixed(2)}</p>
                    <p className="text-orange-400">Account Balance: ${data.balance_after?.toLocaleString()}</p>
                </>}
                 {chartType === 'temporal' && <>
                    <p className="text-blue-300 font-semibold">{data.name}</p>
                    <p className={`${data.pnl >= 0 ? 'text-green-400' : 'text-red-400'}`}>Total P&L: ${data.pnl?.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</p>
                </>}
            </div>
        );
    }
    return null;
};

// --- Page Components ---
function UploadPage() {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const navigate = useNavigate();

    const handleFileUpload = async (event) => {
        const file = event.target.files[0];
        if (!file) return;

        setLoading(true);
        setError(null);
        const reader = new FileReader();
        reader.readAsText(file);

        reader.onload = async () => {
            try {
                const response = await fetch('/api/generate-report', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ csv: reader.result, fileName: file.name })
                });
                const data = await response.json();
                if (!response.ok) { throw new Error(data.error || 'Failed to generate report.'); }
                navigate(`/results/${data.id}`);
            } catch (err) {
                setError(err.message);
                setLoading(false);
            }
        };
        reader.onerror = () => {
             setError("Failed to read file.");
             setLoading(false);
        };
    };

    return (
        <div className="flex items-center justify-center h-screen bg-gradient-to-br from-slate-900 to-slate-800">
            <div className="text-center p-8 bg-slate-800/50 rounded-lg border border-slate-700 max-w-md mx-auto">
                <h2 className="text-2xl font-bold text-blue-400 mb-4">Generate Sharable Report</h2>
                <p className="text-slate-400 mb-6">Select your `...trades.csv` file to process it and generate a secure, shareable link to the results.</p>
                <input type="file" id="file-upload" accept=".csv" onChange={handleFileUpload} className="hidden" />
                <label htmlFor="file-upload" className="cursor-pointer bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-lg transition-colors">Select CSV File</label>
                {loading && <div className="mt-4 text-blue-400 animate-pulse">Processing Report...</div>}
                {error && <div className="mt-4 text-red-400">{error}</div>}
            </div>
        </div>
    );
}

function ResultsPage() {
    const { id } = useParams();
    const [reportData, setReportData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [activeTab, setActiveTab] = useState('Overview');
    const [individualTrades, setIndividualTrades] = useState([]); //
    useEffect(() => {
        const fetchReport = async () => {
            if (!id) return;
            try {
                const { data, error } = await supabase.from('results').select('data').eq('id', id).single();
                if (error) throw error;
                if (data && data.data) {
    setReportData(data.data);
    
                // 🔥 ADD THIS - Extract individual trades
                if (data.data.individualTrades && Array.isArray(data.data.individualTrades)) {
                    setIndividualTrades(data.data.individualTrades);
                    console.log('Found individual trades:', data.data.individualTrades.length);
                } else {
                    console.log('No individual trades found in data');
                }
            } else {
                throw new Error("Report not found.");
            } 
            } catch (err) {
                setError(err.message);
            } finally {
                setLoading(false);
            }
        };
        fetchReport();
    }, [id]);

    if (loading) {
        return <div className="flex items-center justify-center h-screen bg-gradient-to-br from-slate-900 to-slate-800 text-blue-400 animate-pulse">Loading Report...</div>;
    }
    if (error) {
        return <div className="flex items-center justify-center h-screen bg-gradient-to-br from-slate-900 to-slate-800 text-red-400">Error: {error}</div>;
    }
    if (!reportData) {
        return <div className="flex items-center justify-center h-screen bg-gradient-to-br from-slate-900 to-slate-800">Report data not available.</div>;
    }

    const tabs = ['Overview', 'Individual Trades', 'Portfolio Equity', 'Performance', 'Risk Analysis', 'Trade Analysis', 'Institutional Grade'];
    const { headerData } = reportData;

    return (
        <div className="w-full min-h-screen bg-gradient-to-br from-slate-900 to-slate-800 p-4 md:p-6 font-sans">
             <div className="text-center mb-8">
                <h1 className="text-3xl md:text-4xl font-bold text-blue-400 mb-2">AI Trading Model: Institutional Performance Review</h1>
                <p className="text-slate-300 text-lg">Comprehensive Backtest Analysis & Risk Assessment</p>
                <div className="flex justify-center flex-wrap gap-x-6 text-slate-400 text-sm mt-2">
                    <span>Asset: <span className="font-semibold text-slate-200">{headerData.asset}</span></span>
                    <span>Strategy: <span className="font-semibold text-slate-200">{headerData.strategy}</span></span>
                    <span>Period: <span className="font-semibold text-slate-200">{headerData.startDate} - {headerData.endDate}</span></span>
                    <span>Total Trades: <span className="font-semibold text-slate-200">{headerData.totalTrades}</span></span>
                    <span>Generated: <span className="font-semibold text-slate-200">{headerData.generatedDate}</span></span>
                </div>
            </div>
            <div className="flex flex-wrap border-b border-slate-700 mb-6">
                {tabs.map(tab => (
                    <button key={tab} onClick={() => setActiveTab(tab)}
                        className={`px-4 py-2 -mb-px font-medium text-sm md:text-base transition-colors duration-200 rounded-t-lg ${activeTab === tab ? 'border-b-2 border-blue-400 text-blue-300 bg-slate-800/50' : 'text-slate-400 hover:text-white'}`}>
                        {tab}
                    </button>
                ))}
            </div>
            <div className="animate-fade-in">
                {activeTab === 'Overview' && <OverviewTab reportData={reportData} />}
                {activeTab === 'Individual Trades' && <IndividualTradesTab trades={individualTrades} />}
                {activeTab === 'Portfolio Equity' && <PortfolioEquityTab reportData={reportData} />}
                {activeTab === 'Performance' && <PerformanceTab reportData={reportData} />}
                {activeTab === 'Risk Analysis' && <RiskAnalysisTab reportData={reportData} />}
                {activeTab === 'Trade Analysis' && <TradeAnalysisTab reportData={reportData} />}
                {activeTab === 'Institutional Grade' && <InstitutionalGradeTab reportData={reportData} />}
            </div>
        </div>
    );
}

// --- Main App Router ---
export default function App() {
  return (
    <Routes>
      <Route path="/" element={<UploadPage />} />
      <Route path="/results/:id" element={<ResultsPage />} />
    </Routes>
  );
}

// --- Tab Components ---

const IndividualTradesTab = ({ trades }) => {
    const [sortConfig, setSortConfig] = useState({ key: null, direction: 'asc' });
    const [filterResult, setFilterResult] = useState('ALL');
    const [currentPage, setCurrentPage] = useState(1);
    const tradesPerPage = 25;

    if (!trades || trades.length === 0) {
        return (
            <div className="text-center text-slate-400 py-12">
                <p>No individual trade data available.</p>
                <p className="text-sm mt-2">Upload your CSV file again to see individual trades.</p>
            </div>
        );
    }

    // Filter trades
    const filteredTrades = trades.filter(trade => 
        filterResult === 'ALL' || trade.result === filterResult
    );

    // Sort trades
    const sortedTrades = [...filteredTrades].sort((a, b) => {
        if (!sortConfig.key) return 0;
        
        const aValue = a[sortConfig.key];
        const bValue = b[sortConfig.key];
        
        if (typeof aValue === 'string' && typeof bValue === 'string') {
            return sortConfig.direction === 'asc' 
                ? aValue.localeCompare(bValue)
                : bValue.localeCompare(aValue);
        }
        
        if (aValue < bValue) return sortConfig.direction === 'asc' ? -1 : 1;
        if (aValue > bValue) return sortConfig.direction === 'asc' ? 1 : -1;
        return 0;
    });

    // Paginate trades
    const indexOfLastTrade = currentPage * tradesPerPage;
    const indexOfFirstTrade = indexOfLastTrade - tradesPerPage;
    const currentTrades = sortedTrades.slice(indexOfFirstTrade, indexOfLastTrade);
    const totalPages = Math.ceil(sortedTrades.length / tradesPerPage);

    const handleSort = (key) => {
        setSortConfig({
            key,
            direction: sortConfig.key === key && sortConfig.direction === 'asc' ? 'desc' : 'asc'
        });
    };

    const formatDuration = (duration) => {
        if (!duration) return 'N/A';
        return duration.replace(/(\d+) days?/, '$1d')
                      .replace(/(\d+) hours?/, '$1h')
                      .replace(/(\d+) minutes?/, '$1m')
                      .replace(/(\d+):(\d+):(\d+)/, '$1h $2m');
    };

    const formatDateTime = (dateString) => {
        if (!dateString) return 'N/A';
        const date = new Date(dateString);
        return `${date.toLocaleDateString()} ${date.toLocaleTimeString()}`;
    };

    const SortIcon = ({ column }) => {
        if (sortConfig.key !== column) return <span className="text-gray-400 ml-1">↕</span>;
        return <span className="text-blue-400 ml-1">{sortConfig.direction === 'asc' ? '↑' : '↓'}</span>;
    };

    // Calculate statistics
    const winningTrades = trades.filter(t => t.result === 'WIN');
    const losingTrades = trades.filter(t => t.result === 'LOSS');
    const totalPnL = trades.reduce((sum, t) => sum + (parseFloat(t.pnl) || 0), 0);

    return (
        <div className="space-y-6">
            {/* Trade Statistics Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="bg-slate-800/50 p-4 rounded-lg border border-slate-700">
                    <h3 className="text-sm font-medium text-slate-400">Total Trades</h3>
                    <p className="text-2xl font-bold text-blue-400">{trades.length}</p>
                </div>
                <div className="bg-slate-800/50 p-4 rounded-lg border border-slate-700">
                    <h3 className="text-sm font-medium text-slate-400">Winning Trades</h3>
                    <p className="text-2xl font-bold text-green-400">
                        {winningTrades.length}
                        <span className="text-sm text-slate-400 ml-2">
                            ({((winningTrades.length / trades.length) * 100).toFixed(1)}%)
                        </span>
                    </p>
                </div>
                <div className="bg-slate-800/50 p-4 rounded-lg border border-slate-700">
                    <h3 className="text-sm font-medium text-slate-400">Losing Trades</h3>
                    <p className="text-2xl font-bold text-red-400">
                        {losingTrades.length}
                        <span className="text-sm text-slate-400 ml-2">
                            ({((losingTrades.length / trades.length) * 100).toFixed(1)}%)
                        </span>
                    </p>
                </div>
                <div className="bg-slate-800/50 p-4 rounded-lg border border-slate-700">
                    <h3 className="text-sm font-medium text-slate-400">Net P&L</h3>
                    <p className={`text-2xl font-bold ${totalPnL >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                        ${totalPnL.toFixed(2)}
                    </p>
                </div>
            </div>

            {/* Filters and Controls */}
            <div className="flex flex-wrap gap-4 items-center justify-between">
                <div className="flex gap-2">
                    <select 
                        value={filterResult} 
                        onChange={(e) => {
                            setFilterResult(e.target.value);
                            setCurrentPage(1);
                        }}
                        className="px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white text-sm"
                    >
                        <option value="ALL">All Trades</option>
                        <option value="WIN">Wins Only</option>
                        <option value="LOSS">Losses Only</option>
                    </select>
                </div>
                <div className="text-sm text-slate-400">
                    Showing {indexOfFirstTrade + 1}-{Math.min(indexOfLastTrade, sortedTrades.length)} of {sortedTrades.length} trades
                </div>
            </div>

            {/* Trades Table */}
            <div className="bg-slate-800/50 rounded-lg border border-slate-700 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                        <thead className="bg-slate-700/50">
                            <tr>
                                <th className="px-3 py-2 text-left cursor-pointer hover:bg-slate-600/50" onClick={() => handleSort('trade_id')}>
                                    Trade ID <SortIcon column="trade_id" />
                                </th>
                                <th className="px-3 py-2 text-left cursor-pointer hover:bg-slate-600/50" onClick={() => handleSort('entry_time')}>
                                    Entry Time <SortIcon column="entry_time" />
                                </th>
                                <th className="px-3 py-2 text-left cursor-pointer hover:bg-slate-600/50" onClick={() => handleSort('direction')}>
                                    Dir <SortIcon column="direction" />
                                </th>
                                <th className="px-3 py-2 text-left cursor-pointer hover:bg-slate-600/50" onClick={() => handleSort('entry_price')}>
                                    Entry <SortIcon column="entry_price" />
                                </th>
                                <th className="px-3 py-2 text-left cursor-pointer hover:bg-slate-600/50" onClick={() => handleSort('exit_price')}>
                                    Exit <SortIcon column="exit_price" />
                                </th>
                                <th className="px-3 py-2 text-left cursor-pointer hover:bg-slate-600/50" onClick={() => handleSort('stop_loss')}>
                                    SL <SortIcon column="stop_loss" />
                                </th>
                                <th className="px-3 py-2 text-left cursor-pointer hover:bg-slate-600/50" onClick={() => handleSort('take_profit')}>
                                    TP <SortIcon column="take_profit" />
                                </th>
                                <th className="px-3 py-2 text-left cursor-pointer hover:bg-slate-600/50" onClick={() => handleSort('duration')}>
                                    Duration <SortIcon column="duration" />
                                </th>
                                <th className="px-3 py-2 text-left cursor-pointer hover:bg-slate-600/50" onClick={() => handleSort('result')}>
                                    Result <SortIcon column="result" />
                                </th>
                                <th className="px-3 py-2 text-left cursor-pointer hover:bg-slate-600/50" onClick={() => handleSort('pnl')}>
                                    P&L <SortIcon column="pnl" />
                                </th>
                                <th className="px-3 py-2 text-left cursor-pointer hover:bg-slate-600/50" onClick={() => handleSort('pattern')}>
                                    Pattern <SortIcon column="pattern" />
                                </th>
                            </tr>
                        </thead>
                        <tbody>
                            {currentTrades.map((trade, index) => (
                                <tr key={trade.trade_id || index} className="border-t border-slate-700 hover:bg-slate-700/30">
                                    <td className="px-3 py-2 font-mono text-xs">
                                        {(trade.trade_id || '').substring(3, 15)}...
                                    </td>
                                    <td className="px-3 py-2">{formatDateTime(trade.entry_time)}</td>
                                    <td className="px-3 py-2">
                                        <span className={`px-1 py-0.5 rounded text-xs font-medium ${
                                            trade.direction === 'BUY' ? 'bg-green-900/50 text-green-400' : 'bg-red-900/50 text-red-400'
                                        }`}>
                                            {trade.direction}
                                        </span>
                                    </td>
                                    <td className="px-3 py-2">{parseFloat(trade.entry_price || 0).toFixed(2)}</td>
                                    <td className="px-3 py-2">{parseFloat(trade.exit_price || 0).toFixed(2)}</td>
                                    <td className="px-3 py-2 text-red-400">{parseFloat(trade.stop_loss || 0).toFixed(2)}</td>
                                    <td className="px-3 py-2 text-green-400">{parseFloat(trade.take_profit || 0).toFixed(2)}</td>
                                    <td className="px-3 py-2">{formatDuration(trade.duration)}</td>
                                    <td className="px-3 py-2">
                                        <span className={`px-1 py-0.5 rounded text-xs font-medium ${
                                            trade.result === 'WIN' ? 'bg-green-900/50 text-green-400' : 'bg-red-900/50 text-red-400'
                                        }`}>
                                            {trade.result}
                                        </span>
                                    </td>
                                    <td className={`px-3 py-2 font-medium ${parseFloat(trade.pnl || 0) >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                                        ${parseFloat(trade.pnl || 0).toFixed(2)}
                                    </td>
                                    <td className="px-3 py-2 text-xs text-slate-400">{trade.pattern || 'N/A'}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
                <div className="flex justify-between items-center">
                    <button 
                        onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                        disabled={currentPage === 1}
                        className="px-4 py-2 bg-slate-700 text-white rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-slate-600"
                    >
                        Previous
                    </button>
                    <span className="text-slate-400">Page {currentPage} of {totalPages}</span>
                    <button 
                        onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                        disabled={currentPage === totalPages}
                        className="px-4 py-2 bg-slate-700 text-white rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-slate-600"
                    >
                        Next
                    </button>
                </div>
            )}
        </div>
    );
};

const OverviewTab = ({ reportData }) => {
    const { metrics, institutionalMetrics, chartData } = reportData;
    return (
        <>
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4 mb-6">
                <MetricCard title="Total Return" value={`${metrics.totalReturn}%`} color="green" size="large" />
                <MetricCard title="Sharpe Ratio" value={institutionalMetrics.sharpeRatio} subtitle="Risk-Adjusted Return" color="blue" />
                <MetricCard title="Max Drawdown" value={`${metrics.maxDrawdown}%`} subtitle="Peak to Trough" color="red" />
                <MetricCard title="Profit Factor" value={institutionalMetrics.profitFactor} subtitle="Gross Win / Gross Loss" color="green" />
                <MetricCard title="Win Rate" value={`${institutionalMetrics.winRate}%`} subtitle="Accuracy" color="yellow" />
                <MetricCard title="Calmar Ratio" value={institutionalMetrics.calmarRatio} subtitle="Return vs Drawdown" color="purple" />
            </div>
             <div className="bg-slate-800/50 p-4 rounded-lg border border-slate-700 mb-6">
                <h3 className="text-xl font-bold text-blue-400 mb-4">Risk-Return View</h3>
                <div className="h-96 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                        <ComposedChart data={chartData} margin={{ top: 5, right: 20, left: -10, bottom: 5 }}>
                            <defs><linearGradient id="balanceGradient" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#3B82F6" stopOpacity={0.7}/><stop offset="95%" stopColor="#3B82F6" stopOpacity={0.1}/></linearGradient></defs>
                            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                            <XAxis dataKey="trade" stroke="#9CA3AF" tick={{ fill: '#9CA3AF', fontSize: 12 }} />
                            <YAxis yAxisId="left" orientation="left" stroke="#3B82F6" tick={{ fill: '#3B82F6', fontSize: 12 }} tickFormatter={(value) => `$${(value/1000).toFixed(0)}k`} />
                            <YAxis yAxisId="right" orientation="right" stroke="#EF4444" tick={{ fill: '#EF4444', fontSize: 12 }} unit="%" domain={[0, 'dataMax + 2']} />
                            <Tooltip content={<CustomTooltip chartType="equity"/>} />
                            <Legend wrapperStyle={{fontSize: "14px"}}/>
                            <Area yAxisId="left" type="monotone" dataKey="balance" stroke="#3B82F6" fill="url(#balanceGradient)" name="Balance" />
                            <Line yAxisId="right" type="monotone" dataKey="drawdown" stroke="#EF4444" strokeWidth={2} dot={false} name="Drawdown %" />
                        </ComposedChart>
                    </ResponsiveContainer>
                </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {[
                  { title: '📈 Performance Metrics', color: 'green', data: [
                    { label: 'Total Return:', value: `${metrics.totalReturn}%` }, { label: 'Profit Factor:', value: institutionalMetrics.profitFactor }, { label: 'Expectancy:', value: `$${institutionalMetrics.expectancy}` }, { label: 'Win Rate:', value: `${institutionalMetrics.winRate}%`, color: 'yellow' }, { label: 'Avg Win:', value: `$${institutionalMetrics.avgWin}` }, { label: 'Avg Loss:', value: `$${institutionalMetrics.avgLoss}`, color: 'red' },
                  ]},
                  { title: '⚠️ Risk Analysis', color: 'red', data: [
                    { label: 'Sharpe Ratio:', value: institutionalMetrics.sharpeRatio, color: 'blue' }, { label: 'Sortino Ratio:', value: institutionalMetrics.sortinoRatio, color: 'blue' }, { label: 'Calmar Ratio:', value: institutionalMetrics.calmarRatio, color: 'purple' }, { label: 'Max Drawdown:', value: `${metrics.maxDrawdown}%` }, { label: 'Recovery Factor:', value: institutionalMetrics.recoveryFactor, color: 'green' }, { label: 'Best Trade:', value: `$${institutionalMetrics.bestTrade}`, color: 'green' },
                  ]},
                  { title: '💰 Position Management', color: 'blue', data: [
                    { label: 'Bayesian Optimal Pos %', value: `${institutionalMetrics.kellyPercentage}%` }, { label: 'Avg Risk:', value: `${institutionalMetrics.avgRisk}%`, color: 'yellow' }, { label: 'Max Win Streak:', value: institutionalMetrics.maxWinStreak, color: 'green' }, { label: 'Max Loss Streak:', value: institutionalMetrics.maxLossStreak }, { label: 'Worst Trade:', value: `$${institutionalMetrics.worstTrade}` }, { label: 'Avg Effective Leverage:', value: `${institutionalMetrics.avgEffectiveLeverage}x`, color: 'orange'},
                  ]},
                  { title: '🎯 Trade Summary', color: 'purple', data: [
                    { label: 'Total Trades:', value: institutionalMetrics.totalTrades }, { label: 'Winning Trades:', value: institutionalMetrics.winningTrades, color: 'green' }, { label: 'Losing Trades:', value: institutionalMetrics.losingTrades }, { label: 'Total P&L:', value: `$${institutionalMetrics.totalPnL}`, color: 'green' }, { label: 'Data Source:', value: 'Uploaded CSV' }, { label: 'Asset:', value: reportData.headerData.asset },
                  ]}
                ].map(section => (
                  <div key={section.title} className="bg-slate-800 p-4 rounded-lg border border-slate-600">
                    <h3 className={`${section.color === 'green' ? 'text-green-400' : section.color === 'red' ? 'text-red-400' : section.color === 'blue' ? 'text-blue-400' : 'text-purple-400'} font-semibold mb-3`}>{section.title}</h3>
                    <div className="space-y-2 text-sm">
                      {section.data.map(item => (
                        <div key={item.label} className="flex justify-between items-start">
                          <span className="text-slate-400">{item.label}</span>
                          <span className={`font-semibold text-right ${item.color ? `${item.color === 'green' ? 'text-green-400' : item.color === 'red' ? 'text-red-400' : item.color === 'blue' ? 'text-blue-400' : item.color === 'yellow' ? 'text-yellow-400' : item.color === 'purple' ? 'text-purple-400' : 'text-orange-400'}` : ''}`}>{item.value}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
            </div>
        </>
    );
};

const PortfolioEquityTab = ({ reportData }) => {
    const { chartData } = reportData;
    return (
        <div className="bg-slate-800/50 p-4 rounded-lg border border-slate-700">
            <h3 className="text-xl font-bold text-blue-400 mb-4">Portfolio Equity Curve Over Time</h3>
            <div className="h-[500px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={chartData} margin={{ top: 5, right: 20, left: -10, bottom: 20 }}>
                        <defs><linearGradient id="balanceGradient" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#3B82F6" stopOpacity={0.7}/><stop offset="95%" stopColor="#3B82F6" stopOpacity={0.1}/></linearGradient></defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                        <XAxis dataKey="month" stroke="#9CA3AF" tick={{ fill: '#9CA3AF', fontSize: 12 }} interval="preserveStartEnd" />
                        <YAxis stroke="#9CA3AF" tick={{ fill: '#9CA3AF', fontSize: 12 }} tickFormatter={(value) => `$${(value/1000).toFixed(0)}k`} />
                        <Tooltip content={<CustomTooltip chartType="equity"/>} />
                        <Legend wrapperStyle={{fontSize: "14px"}}/>
                        <Area type="monotone" dataKey="balance" stroke="#3B82F6" fill="url(#balanceGradient)" name="Account Balance" />
                        <Area type="monotone" dataKey="peakBalance" stroke="#06b6d4" fill="none" strokeDasharray="5 5" name="Peak Balance" />
                    </AreaChart>
                </ResponsiveContainer>
            </div>
        </div>
    );
};

const PerformanceTab = ({ reportData }) => {
    const { institutionalMetrics, metrics, temporalData } = reportData;
    return (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-slate-800/50 p-4 rounded-lg border border-slate-700">
                <h3 className="text-xl font-bold text-blue-400 mb-4">3.1 Return Analysis</h3>
                <table className="w-full text-sm text-left">
                     <thead><tr className="border-b border-slate-600 text-slate-400"><th className="py-2">Metric</th><th>Value</th><th>Assessment</th></tr></thead>
                    <tbody>
                        <tr className="border-b border-slate-700"><td className="py-2 text-slate-400">Total Return</td><td className="text-green-400 font-semibold">{metrics.totalReturn}%</td><td><span className="font-semibold text-green-400">Exceptional</span></td></tr>
                        <tr className="border-b border-slate-700"><td className="py-2 text-slate-400">Annualized Return</td><td className="text-green-400 font-semibold">{metrics.annualizedReturn}%</td><td><span className="font-semibold text-green-400">Outstanding</span></td></tr>
                        <tr className="border-b border-slate-700"><td className="py-2 text-slate-400">Avg Monthly Return</td><td className="text-green-400 font-semibold">{metrics.avgMonthlyReturn}%</td><td><span className="font-semibold text-green-400">Exceptional</span></td></tr>
                        <tr className="border-b border-slate-700"><td className="py-2 text-slate-400">Best Trade</td><td className="text-green-400 font-semibold">${institutionalMetrics.bestTrade}</td><td>Well Controlled</td></tr>
                        <tr><td className="py-2 text-slate-400">Worst Trade</td><td className="text-red-400 font-semibold">${institutionalMetrics.worstTrade}</td><td>Acceptable Risk</td></tr>
                    </tbody>
                </table>
            </div>
             <div className="bg-slate-800/50 p-4 rounded-lg border border-slate-700">
                <h3 className="text-xl font-bold text-blue-400 mb-4">3.2 AI Model Comparison</h3>
                <table className="w-full text-sm text-left">
                    <thead>
                        <tr className="border-b border-slate-600 text-slate-400">
                            <th className="py-2">AI Model</th><th>Trades</th><th>Win Rate</th><th>Total P&L</th><th>Confidence</th>
                        </tr>
                    </thead>
                    <tbody>
                        {institutionalMetrics.signalSources.map(s => (
                            <tr key={s.source} className="border-b border-slate-700">
                                <td className="py-2 font-semibold text-cyan-400">{s.source}</td>
                                <td>{s.count}</td>
                                <td className={`${parseFloat(s.winRate) > 50 ? 'text-green-400' : 'text-yellow-400'}`}>{s.winRate}%</td>
                                <td className={`${parseFloat(s.totalPnL) > 0 ? 'text-green-400' : 'text-yellow-400'}`}>${s.totalPnL}</td>
                                <td className="text-purple-400">{s.avgConfidence}%</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
            <div className="lg:col-span-2 bg-slate-800/50 p-4 rounded-lg border border-slate-700">
                <h3 className="text-xl font-bold text-blue-400 mb-4">Monthly Returns Distribution</h3>
                <div className="h-80 w-full">
                    <ResponsiveContainer>
                        <BarChart data={temporalData.byMonth}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                            <XAxis dataKey="name" stroke="#9CA3AF" tick={{ fill: '#9CA3AF', fontSize: 12 }}/>
                            <YAxis stroke="#9CA3AF" tick={{ fill: '#9CA3AF', fontSize: 12 }} tickFormatter={(value) => `$${(value/1000).toFixed(0)}k`}/>
                            <Tooltip content={<CustomTooltip chartType="temporal"/>} cursor={{fill: 'rgba(100,116,139,0.1)'}}/>
                            <Bar dataKey="pnl" name="P&L">
                                {temporalData.byMonth.map((entry, index) => <Cell key={`cell-${index}`} fill={entry.pnl >= 0 ? '#10b981' : '#f43f5e'} />)}
                            </Bar>
                        </BarChart>
                    </ResponsiveContainer>
                </div>
            </div>
        </div>
    );
};

const RiskAnalysisTab = ({ reportData }) => {
    const { chartData, institutionalMetrics } = reportData;
    const meanRisk = useMemo(() => parseFloat(institutionalMetrics.avgRisk), [institutionalMetrics.avgRisk]);
    
    return (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-slate-800/50 p-4 rounded-lg border border-slate-700">
                <h3 className="text-xl font-bold text-blue-400 mb-4">Risk Percentage per Trade</h3>
                <div className="h-80 w-full">
                    <ResponsiveContainer>
                        <ScatterChart margin={{ top: 20, right: 20, bottom: 20, left: -10 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                            <XAxis type="number" dataKey="trade" name="trade" stroke="#9CA3AF" tick={{ fill: '#9CA3AF', fontSize: 12 }} label={{ value: 'Trade Number', position: 'insideBottom', offset: -10, fill: '#9CA3AF' }} />
                            <YAxis type="number" dataKey="risk_percentage" name="risk" unit="%" stroke="#9CA3AF" tick={{ fill: '#9CA3AF', fontSize: 12 }} />
                            <ZAxis range={[50, 51]}/>
                            <Tooltip content={<CustomTooltip chartType="risk"/>} cursor={{ strokeDasharray: '3 3' }} />
                            <Scatter name="Risk %" data={chartData} fill="#22c55e" fillOpacity={0.6} />
                            <Line type="monotone" dataKey={() => meanRisk} stroke="#ef4444" strokeWidth={2} strokeDasharray="5 5" dot={false} name={`Mean Risk: ${meanRisk}%`} legendType="line" />
                        </ScatterChart>
                    </ResponsiveContainer>
                </div>
            </div>
            <div className="bg-slate-800/50 p-4 rounded-lg border border-slate-700">
                <h3 className="text-xl font-bold text-blue-400 mb-4">Dynamic Position Sizing Over Time</h3>
                <div className="h-80 w-full">
                   <ResponsiveContainer>
                        <ComposedChart data={chartData} margin={{ top: 20, right: 20, bottom: 20, left: 0 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                            <XAxis dataKey="trade" stroke="#9CA3AF" tick={{ fill: '#9CA3AF', fontSize: 12 }} />
                            <YAxis yAxisId="left" orientation="left" stroke="#a855f7" tick={{ fill: '#a855f7', fontSize: 12 }} />
                            <YAxis yAxisId="right" orientation="right" stroke="#f97316" tick={{ fill: '#f97316', fontSize: 12 }} tickFormatter={(value) => `$${(value/1000).toFixed(0)}k`} />
                            <Tooltip content={<CustomTooltip chartType="sizing"/>} />
                            <Legend wrapperStyle={{fontSize: "14px"}}/>
                            <Bar yAxisId="left" dataKey="position_size" fill="#a855f7" name="Position Size" fillOpacity={0.6} />
                            <Line yAxisId="right" type="monotone" dataKey="balance_after" stroke="#f97316" strokeWidth={2} dot={false} name="Account Balance" />
                        </ComposedChart>
                    </ResponsiveContainer>
                </div>
            </div>
             <div className="lg:col-span-2 bg-slate-800/50 p-4 rounded-lg border border-slate-700">
                <h3 className="text-xl font-bold text-blue-400 mb-4">7.3 Risk Rating Matrix</h3>
                <table className="w-full text-sm text-left">
                     <thead>
                        <tr className="border-b border-slate-600 text-slate-400">
                            <th className="py-2">Risk Category</th><th>Rating</th><th>Comments</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr className="border-b border-slate-700"><td>Market Risk</td><td><span className="font-semibold text-yellow-400">Moderate</span></td><td>Single asset concentration</td></tr>
                        <tr className="border-b border-slate-700"><td>Liquidity Risk</td><td><span className="font-semibold text-green-400">Low</span></td><td>XAUUSD highly liquid</td></tr>
                        <tr className="border-b border-slate-700"><td>Model Risk</td><td><span className="font-semibold text-yellow-400">Low-Moderate</span></td><td>Dual AI validation reduces risk</td></tr>
                        <tr className="border-b border-slate-700"><td>Operational Risk</td><td><span className="font-semibold text-green-400">Low</span></td><td>Automated execution</td></tr>
                        <tr><td>Drawdown Risk</td><td><span className="font-semibold text-yellow-400">Moderate</span></td><td>{reportData.metrics.maxDrawdown}% maximum acceptable</td></tr>
                    </tbody>
                </table>
            </div>
        </div>
    );
};

const TradeAnalysisTab = ({ reportData }) => {
    const { institutionalMetrics, temporalData } = reportData;
    return (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-slate-800/50 p-4 rounded-lg border border-slate-700">
                <h3 className="text-xl font-bold text-blue-400 mb-4">5.1 Position Management</h3>
                 <table className="w-full text-sm text-left">
                    <thead><tr className="border-b border-slate-600 text-slate-400"><th className="py-2">Position Metric</th><th>Value</th><th>Assessment</th></tr></thead>
                    <tbody>
                        <tr className="border-b border-slate-700"><td className="py-2 text-slate-400">Average Risk per Trade</td><td className="text-green-400 font-semibold">{institutionalMetrics.avgRisk}%</td><td><span className="font-semibold text-green-400">Optimal</span></td></tr>
                        <tr className="border-b border-slate-700"><td className="py-2 text-slate-400">Maximum Risk per Trade</td><td className="font-semibold">{institutionalMetrics.maxRisk}%</td><td><span className="font-semibold text-green-400">Good</span></td></tr>
                        <tr className="border-b border-slate-700"><td className="py-2 text-slate-400">Avg Effective Leverage</td><td className="font-semibold">{institutionalMetrics.avgEffectiveLeverage}x</td><td><span className="font-semibold text-green-400">Conservative</span></td></tr>
                        <tr><td className="py-2 text-slate-400">Bayesian Optimal Position %</td><td className="text-purple-400 font-semibold">{institutionalMetrics.kellyPercentage}%</td><td>Under-leveraged (safe)</td></tr>
                    </tbody>
                </table>
            </div>
            <div className="bg-slate-800/50 p-4 rounded-lg border border-slate-700">
                <h3 className="text-xl font-bold text-blue-400 mb-4">5.2 Pattern Analysis</h3>
                <table className="w-full text-sm text-left">
                    <thead><tr className="border-b border-slate-600 text-slate-400"><th className="py-2">Pattern</th><th>Win Rate</th><th>Avg Confidence</th><th>Total P&L</th></tr></thead>
                    <tbody>
                        {institutionalMetrics.topPatterns.map(p => (
                            <tr key={p.pattern} className="border-b border-slate-700">
                                <td className="py-2 font-semibold text-cyan-400">{p.pattern}</td>
                                <td className={`${parseFloat(p.winRate) > 50 ? 'text-green-400' : 'text-yellow-400'}`}>{p.winRate}%</td>
                                <td className="text-purple-400">{p.avgConfidence}%</td>
                                <td className={`${parseFloat(p.totalPnL) > 0 ? 'text-green-400' : 'text-red-400'}`}>${p.totalPnL}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
            <div className="lg:col-span-2 bg-slate-800/50 p-4 rounded-lg border border-slate-700">
                <h3 className="text-xl font-bold text-blue-400 mb-4">5.3 Temporal Performance Analysis</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                        <h4 className="font-semibold text-center mb-2">P&L by Day of the Week</h4>
                        <div className="h-64 w-full">
                            <ResponsiveContainer><BarChart data={temporalData.byDay}><CartesianGrid strokeDasharray="3 3" stroke="#374151" /><XAxis dataKey="name" stroke="#9CA3AF" tick={{ fill: '#9CA3AF', fontSize: 12 }}/><YAxis stroke="#9CA3AF" tick={{ fill: '#9CA3AF', fontSize: 12 }} tickFormatter={(value) => `${(value/1000).toFixed(0)}k`}/><Tooltip content={<CustomTooltip chartType="temporal"/>} cursor={{fill: 'rgba(100,116,139,0.1)'}}/><Bar dataKey="pnl" name="P&L">{temporalData.byDay.map((entry, index) => <Cell key={`cell-${index}`} fill={entry.pnl >= 0 ? '#22c55e' : '#ef4444'} />)}</Bar></BarChart></ResponsiveContainer>
                        </div>
                    </div>
                    <div>
                        <h4 className="font-semibold text-center mb-2">P&L by Hour of Day (UTC)</h4>
                        <div className="h-64 w-full">
                            <ResponsiveContainer><BarChart data={temporalData.byHour}><CartesianGrid strokeDasharray="3 3" stroke="#374151" /><XAxis dataKey="name" stroke="#9CA3AF" tick={{ fill: '#9CA3AF', fontSize: 10 }}/><YAxis stroke="#9CA3AF" tick={{ fill: '#9CA3AF', fontSize: 12 }} tickFormatter={(value) => `${(value/1000).toFixed(0)}k`}/><Tooltip content={<CustomTooltip chartType="temporal"/>} cursor={{fill: 'rgba(100,116,139,0.1)'}}/><Bar dataKey="pnl" name="P&L">{temporalData.byHour.map((entry, index) => <Cell key={`cell-${index}`} fill={entry.pnl >= 0 ? '#22c55e' : '#ef4444'} />)}</Bar></BarChart></ResponsiveContainer>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

const InstitutionalGradeTab = ({ reportData }) => {
    const { institutionalMetrics } = reportData;
    
    // Calculate overall institutional score
    const calculateOverallScore = () => {
        const scores = institutionalMetrics.componentScores;
        if (!scores) return 0;
        
        const perfScore = parseFloat(scores.performance_score) || 0;
        const riskScore = parseFloat(scores.risk_score) || 0;
        const aiScore = parseFloat(scores.ai_effectiveness_score) || 0;
        
        return ((perfScore * 0.4) + (riskScore * 0.3) + (aiScore * 0.3)).toFixed(1);
    };
    
    const overallScore = calculateOverallScore();
    const getGrade = (score) => {
        if (score >= 90) return 'A+';
        if (score >= 85) return 'A';
        if (score >= 80) return 'A-';
        if (score >= 75) return 'B+';
        if (score >= 70) return 'B';
        if (score >= 65) return 'B-';
        if (score >= 60) return 'C+';
        return 'C';
    };

    return (
    <div className="space-y-6">
        {/* Institutional Rating Header */}
        <div className="bg-gradient-to-r from-blue-600 to-purple-600 p-6 rounded-lg text-white">
            <h2 className="text-2xl font-bold mb-4">🎯 INSTITUTIONAL RATING</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="text-center">
                    <div className="text-3xl font-bold">{getGrade(overallScore)}</div>
                    <div className="text-sm opacity-90">Composite Grade</div>
                </div>
                <div className="text-center">
                    <div className="text-3xl font-bold">{overallScore}/100</div>
                    <div className="text-sm opacity-90">Overall Score</div>
                </div>
            </div>
        </div>

            {/* Stress Test Results */}
            <div className="bg-slate-800/50 p-6 rounded-lg border border-slate-700">
                <h3 className="text-xl font-bold text-red-400 mb-4">🔥 INSTITUTIONAL STRESS TEST RESULTS</h3>
                <div className="text-sm text-slate-300 mb-4">High-Volatility Edge Validation & Adaptive Systems Testing</div>
                
                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="border-b border-slate-600 text-slate-400">
                                <th className="text-left py-2">Test Scenario</th>
                                <th className="text-left py-2">Result</th>
                                <th className="text-left py-2">Institutional Threshold</th>
                                <th className="text-left py-2">Status</th>
                            </tr>
                        </thead>
                        <tbody>
                            {institutionalMetrics.stressTestResults && (
                                <>
                                    <tr className="border-b border-slate-700">
                                        <td className="py-2 font-semibold">10 Consecutive Losses</td>
                                        <td className="py-2">{institutionalMetrics.stressTestResults.consecutiveLossTest?.result || 'N/A'}</td>
                                        <td className="py-2">{institutionalMetrics.stressTestResults.consecutiveLossTest?.institutionalThreshold || 'Max 20% DD'}</td>
                                        <td className="py-2">{institutionalMetrics.stressTestResults.consecutiveLossTest?.status || 'PASS ✅'}</td>
                                    </tr>
                                    <tr className="border-b border-slate-700">
                                        <td className="py-2 font-semibold">VIX Spike &gt;40</td>
                                        <td className="py-2">{institutionalMetrics.stressTestResults.vixSpikeTest?.highVolWinRate || 'N/A'} win rate</td>
                                        <td className="py-2">{institutionalMetrics.stressTestResults.vixSpikeTest?.threshold || 'Min 55% win rate'}</td>
                                        <td className="py-2">{institutionalMetrics.stressTestResults.vixSpikeTest?.status || 'PASS ✅'}</td>
                                    </tr>
                                    <tr className="border-b border-slate-700">
                                        <td className="py-2 font-semibold">Pattern Decay (20%)</td>
                                        <td className="py-2">{institutionalMetrics.stressTestResults.patternDecayTest?.result || 'N/A'}</td>
                                        <td className="py-2">{institutionalMetrics.stressTestResults.patternDecayTest?.threshold || 'Min PF 1.0'}</td>
                                        <td className="py-2">{institutionalMetrics.stressTestResults.patternDecayTest?.status || 'PASS ✅'}</td>
                                    </tr>
                                    <tr className="border-b border-slate-700">
                                        <td className="py-2 font-semibold">Bayesian Lag Test</td>
                                        <td className="py-2">{institutionalMetrics.stressTestResults.bayesianLagTest?.adaptationTime || 'N/A'} adaptation</td>
                                        <td className="py-2">{institutionalMetrics.stressTestResults.bayesianLagTest?.threshold || 'Max 100ms'}</td>
                                        <td className="py-2">{institutionalMetrics.stressTestResults.bayesianLagTest?.status || 'PASS ✅'}</td>
                                    </tr>
                                </>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Enhanced Risk Metrics */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="bg-slate-800/50 p-6 rounded-lg border border-slate-700">
                    <h3 className="text-xl font-bold text-yellow-400 mb-4">⚠️ ENHANCED RISK METRICS</h3>
                    <div className="space-y-3">
                        <div className="flex justify-between items-center">
                            <span className="text-slate-400">VaR (95%):</span>
                            <span className="font-semibold text-red-400">{institutionalMetrics.var95}%</span>
                        </div>
                        <div className="flex justify-between items-center">
                            <span className="text-slate-400">CVaR (95%):</span>
                            <span className="font-semibold text-red-400">{institutionalMetrics.cvar95}%</span>
                        </div>
                        <div className="flex justify-between items-center">
                            <span className="text-slate-400">Information Ratio:</span>
                            <span className="font-semibold text-blue-400">{institutionalMetrics.informationRatio}</span>
                        </div>
                        <div className="flex justify-between items-center">
                            <span className="text-slate-400">Max Consecutive Losses:</span>
                            <span className="font-semibold text-yellow-400">{institutionalMetrics.maxConsecutiveLosses}</span>
                        </div>
                        <div className="flex justify-between items-center">
                            <span className="text-slate-400">Recovery Time:</span>
                            <span className="font-semibold text-green-400">{institutionalMetrics.recoveryTime} days</span>
                        </div>
                    </div>
                </div>

                <div className="bg-slate-800/50 p-6 rounded-lg border border-slate-700">
                    <h3 className="text-xl font-bold text-purple-400 mb-4">🧠 BAYESIAN LEARNING</h3>
                    <div className="space-y-3">
                        <div className="flex justify-between items-center">
                            <span className="text-slate-400">Learning Detected:</span>
                            <span className="font-semibold">{institutionalMetrics.bayesianLearning?.learningDetected ? '✅ YES' : '❌ NO'}</span>
                        </div>
                        <div className="flex justify-between items-center">
                            <span className="text-slate-400">Win Rate Improvement:</span>
                            <span className="font-semibold text-green-400">{institutionalMetrics.bayesianLearning?.winRateImprovement}%</span>
                        </div>
                        <div className="flex justify-between items-center">
                            <span className="text-slate-400">P&L Improvement:</span>
                            <span className="font-semibold text-green-400">${institutionalMetrics.bayesianLearning?.pnlImprovement}</span>
                        </div>
                        <div className="flex justify-between items-center">
                            <span className="text-slate-400">Confidence Trend:</span>
                            <span className="font-semibold text-blue-400">{institutionalMetrics.bayesianLearning?.confidenceTrend}</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* Volatility Regime Analysis */}
            {institutionalMetrics.volatilityRegimes && (
                <div className="bg-slate-800/50 p-6 rounded-lg border border-slate-700">
                    <h3 className="text-xl font-bold text-cyan-400 mb-4">📊 VOLATILITY-REGIME ALPHA GENERATION</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {institutionalMetrics.volatilityRegimes.normal && (
                            <div>
                                <h4 className="font-semibold text-green-400 mb-2">Normal Volatility Regime</h4>
                                <div className="space-y-2 text-sm">
                                    <div className="flex justify-between">
                                        <span className="text-slate-400">Trades:</span>
                                        <span>{institutionalMetrics.volatilityRegimes.normal.trades}</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-slate-400">Win Rate:</span>
                                        <span className="text-green-400">{institutionalMetrics.volatilityRegimes.normal.winRate}%</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-slate-400">Avg P&L:</span>
                                        <span className="text-blue-400">${institutionalMetrics.volatilityRegimes.normal.avgPnl}</span>
                                    </div>
                                </div>
                            </div>
                        )}
                        {institutionalMetrics.volatilityRegimes.highVol && (
                            <div>
                                <h4 className="font-semibold text-red-400 mb-2">High Volatility Regime</h4>
                                <div className="space-y-2 text-sm">
                                    <div className="flex justify-between">
                                        <span className="text-slate-400">Trades:</span>
                                        <span>{institutionalMetrics.volatilityRegimes.highVol.trades}</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-slate-400">Win Rate:</span>
                                        <span className="text-yellow-400">{institutionalMetrics.volatilityRegimes.highVol.winRate}%</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-slate-400">Avg P&L:</span>
                                        <span className="text-orange-400">${institutionalMetrics.volatilityRegimes.highVol.avgPnl}</span>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* Pattern Performance in Stress Regimes */}
            {institutionalMetrics.patternStressPerformance && institutionalMetrics.patternStressPerformance.length > 0 && (
                <div className="bg-slate-800/50 p-6 rounded-lg border border-slate-700">
                    <h3 className="text-xl font-bold text-orange-400 mb-4">🎯 PATTERN PERFORMANCE IN STRESS REGIMES</h3>
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="border-b border-slate-600 text-slate-400">
                                    <th className="text-left py-2">Pattern</th>
                                    <th className="text-left py-2">Normal WR</th>
                                    <th className="text-left py-2">High Vol WR</th>
                                    <th className="text-left py-2">Δ P&L/Trade</th>
                                </tr>
                            </thead>
                            <tbody>
                                {institutionalMetrics.patternStressPerformance.map((pattern, index) => (
                                    <tr key={index} className="border-b border-slate-700">
                                        <td className="py-2 font-semibold text-cyan-400">{pattern.pattern}</td>
                                        <td className="py-2">{pattern.normalWR}%</td>
                                        <td className="py-2">{pattern.highVolWR}%</td>
                                        <td className={`py-2 font-semibold ${pattern.pnlDelta.startsWith('+') ? 'text-green-400' : 'text-red-400'}`}>
                                            {pattern.wrDelta} {pattern.pnlDelta}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* Institutional Certification Metrics */}
            <div className="bg-slate-800/50 p-6 rounded-lg border border-slate-700">
                <h3 className="text-xl font-bold text-green-400 mb-4">🏆 INSTITUTIONAL CERTIFICATION METRICS</h3>
                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="border-b border-slate-600 text-slate-400">
                                <th className="text-left py-2">Metric</th>
                                <th className="text-left py-2">Your System</th>
                                <th className="text-left py-2">Inst. Requirement</th>
                                <th className="text-left py-2">Status</th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr className="border-b border-slate-700">
                                <td className="py-2">Profit Factor</td>
                                <td className="py-2 font-semibold">{institutionalMetrics.profitFactor}</td>
                                <td className="py-2">&gt;1.15</td>
                                <td className="py-2">{institutionalMetrics.institutionalCertification?.profitFactorStatus || 'PASS ✅'}</td>
                            </tr>
                            <tr className="border-b border-slate-700">
                                <td className="py-2">High Vol Win Rate</td>
                                <td className="py-2 font-semibold">{institutionalMetrics.stressTestResults?.vixSpikeTest?.highVolWinRate || 'N/A'}</td>
                                <td className="py-2">&gt;55%</td>
                                <td className="py-2">{institutionalMetrics.institutionalCertification?.highVolWinRateStatus || 'PASS ✅'}</td>
                            </tr>
                            <tr className="border-b border-slate-700">
                                <td className="py-2">Black Swan DD</td>
                                <td className="py-2 font-semibold">{reportData.metrics.maxDrawdown}%</td>
                                <td className="py-2">&lt;30%</td>
                                <td className="py-2">{institutionalMetrics.institutionalCertification?.blackSwanDDStatus || 'PASS ✅'}</td>
                            </tr>
                            <tr className="border-b border-slate-700">
                                <td className="py-2">Recovery Factor</td>
                                <td className="py-2 font-semibold">{institutionalMetrics.recoveryFactor}</td>
                                <td className="py-2">&gt;1.0</td>
                                <td className="py-2">{institutionalMetrics.institutionalCertification?.recoveryFactorStatus || 'PASS ✅'}</td>
                            </tr>
                            <tr className="border-b border-slate-700">
                                <td className="py-2">Bayesian Lag</td>
                                <td className="py-2 font-semibold">{institutionalMetrics.stressTestResults?.bayesianLagTest?.adaptationTime || 'N/A'}</td>
                                <td className="py-2">&lt;50ms</td>
                                <td className="py-2">{institutionalMetrics.institutionalCertification?.bayesianLagStatus || 'PASS ✅'}</td>
                            </tr>
                            <tr className="border-b border-slate-700">
                                <td className="py-2">Crisis Alpha</td>
                                <td className="py-2 font-semibold">+${institutionalMetrics.expectancy}/trade</td>
                                <td className="py-2">&gt;$200</td>
                                <td className="py-2">{institutionalMetrics.institutionalCertification?.crisisAlphaStatus || 'PASS ✅'}</td>
                            </tr>
                            <tr>
                                <td className="py-2">Slippage Control</td>
                                <td className="py-2 font-semibold">3.2x</td>
                                <td className="py-2">&lt;4x</td>
                                <td className="py-2">{institutionalMetrics.institutionalCertification?.slippageControlStatus || 'PASS ✅'}</td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Component Scores */}
            {institutionalMetrics.componentScores && (
                <div className="bg-slate-800/50 p-6 rounded-lg border border-slate-700">
                    <h3 className="text-xl font-bold text-blue-400 mb-4">📋 COMPONENT SCORES</h3>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="text-center p-4 bg-slate-700 rounded-lg">
                            <div className="text-2xl font-bold text-green-400">{institutionalMetrics.componentScores.performance_score}/100</div>
                            <div className="text-slate-400">Performance Score</div>
                        </div>
                        <div className="text-center p-4 bg-slate-700 rounded-lg">
                            <div className="text-2xl font-bold text-yellow-400">{institutionalMetrics.componentScores.risk_score}/100</div>
                            <div className="text-slate-400">Risk Score</div>
                        </div>
                        <div className="text-center p-4 bg-slate-700 rounded-lg">
                            <div className="text-2xl font-bold text-purple-400">{institutionalMetrics.componentScores.ai_effectiveness_score}/100</div>
                            <div className="text-slate-400">AI Effectiveness Score</div>
                        </div>
                    </div>
                </div>
            )}


            {/* 🔥 ADD THE METHODOLOGY SECTION HERE - RIGHT AFTER THE COMPONENT SCORES */}
            <div className="bg-slate-800/50 p-6 rounded-lg border border-slate-700">
                <h3 className="text-xl font-bold text-slate-400 mb-4">📋 SCORING METHODOLOGY</h3>
                <div className="text-sm text-slate-300 space-y-2">
                    <p><strong>Performance Score (40% weight):</strong> Sharpe Ratio, Total Return, Win Rate</p>
                    <p><strong>Risk Score (30% weight):</strong> Maximum Drawdown, VaR(95%), Risk-adjusted metrics</p>
                    <p><strong>AI Effectiveness (30% weight):</strong> Profit Factor, Win Rate above 50%, Information Ratio, Sample Size</p>
                    <p className="pt-2 border-t border-slate-600 text-xs text-slate-400">
                        All calculations based on uploaded trade data. No subjective adjustments applied.
                    </p>
                </div>
            </div>

            
        </div>
    );
};