import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Routes, Route, useParams, useNavigate } from 'react-router-dom';
import { supabase } from './supabaseClient'; // Make sure you have this file
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ComposedChart, Line, BarChart, Bar, ScatterChart, Scatter, ZAxis, Cell } from 'recharts';

// Color mapping for consistent class names
const colorMap = {
  green: 'text-green-400',
  blue: 'text-blue-400',
  red: 'text-red-400',
  yellow: 'text-yellow-400',
  purple: 'text-purple-400',
  orange: 'text-orange-400',
  cyan: 'text-cyan-400'
};

// --- Reusable Components ---
const MetricCard = ({ title, value, subtitle, color = 'blue', size = 'normal' }) => (
    <div className={`bg-slate-800 p-4 rounded-lg border border-slate-600 ${size === 'large' ? 'col-span-2' : ''}`}>
        <div className="text-slate-400 text-sm">{title}</div>
        <div className={`${colorMap[color]} ${size === 'large' ? 'text-3xl' : 'text-xl'} font-bold`}>{value}</div>
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
        <div className="flex items-center justify-center h-screen bg-gradient-to-br from-slate-900 to-slate-800 text-white">
            <div className="text-center p-8 bg-slate-800/50 rounded-lg border border-slate-700 max-w-md mx-auto">
                <h2 className="text-2xl font-bold text-blue-400 mb-4">Generate Sharable Report</h2>
                <p className="text-slate-400 mb-6">Select your `...trades.csv` file to process it and generate a secure, shareable link to the results.</p>
                <input type="file" id="file-upload" accept=".csv" onChange={handleFileUpload} className="hidden" />
                <label htmlFor="file-upload" className="cursor-pointer bg-blue-600 text-white font-bold py-2 px-4 rounded-lg hover:bg-blue-700 transition-colors">Select CSV File</label>
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

    useEffect(() => {
        const fetchReport = async () => {
            if (!id) return;
            try {
                const { data, error } = await supabase.from('results').select('data').eq('id', id).single();
                if (error) throw error;
                if (data) { setReportData(data.data); } 
                else { throw new Error("Report not found."); }
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
        return <div className="flex items-center justify-center h-screen bg-gradient-to-br from-slate-900 to-slate-800 text-white">Report data not available.</div>;
    }

    const tabs = ['Overview', 'Portfolio Equity', 'Performance', 'Risk Analysis', 'Trade Analysis', 'Institutional Grade'];
    const { headerData } = reportData;

    return (
        <div className="w-full min-h-screen bg-gradient-to-br from-slate-900 to-slate-800 p-4 md:p-6 text-white font-sans">
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
                    <h3 className={`${colorMap[section.color]} font-semibold mb-3`}>{section.title}</h3>
                    <div className="space-y-2 text-sm">
                      {section.data.map(item => (
                        <div key={item.label} className="flex justify-between items-start">
                          <span className="text-slate-400">{item.label}</span>
                          <span className={`font-semibold text-right ${item.color ? colorMap[item.color] : ''}`}>{item.value}</span>
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
                            <th className="py-2">AI Model</th><th>Trades</th><th>Win Rate</th><th>Avg P&L/Trade</th><th>Confidence</th>
                        </tr>
                    </thead>
                    <tbody>
                        {institutionalMetrics.signalSources.map(s => (
                            <tr key={s.source} className="border-b border-slate-700">
                                <td className="py-2 font-semibold text-cyan-400">{s.source}</td>
                                <td>{s.count}</td>
                                <td className={`${parseFloat(s.winRate) > 50 ? 'text-green-400' : 'text-yellow-400'}`}>{s.winRate}%</td>
                                <td className={`${parseFloat(s.avgPnl) > 0 ? 'text-green-400' : 'text-red-400'}`}>${s.avgPnl}</td>
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
                            <ResponsiveContainer><BarChart data={temporalData.byDay}><CartesianGrid strokeDasharray="3 3" stroke="#374151" /><XAxis dataKey="name" stroke="#9CA3AF" tick={{ fill: '#9CA3AF', fontSize: 12 }}/><YAxis stroke="#9CA3AF" tick={{ fill: '#9CA3AF', fontSize: 12 }} tickFormatter={(value) => `$${(value/1000).toFixed(0)}k`}/><Tooltip content={<CustomTooltip chartType="temporal"/>} cursor={{fill: 'rgba(100,116,139,0.1)'}}/><Bar dataKey="pnl" name="P&L">{temporalData.byDay.map((entry, index) => <Cell key={`cell-${index}`} fill={entry.pnl >= 0 ? '#22c55e' : '#ef4444'} />)}</Bar></BarChart></ResponsiveContainer>
                        </div>
                    </div>
                    <div>
                        <h4 className="font-semibold text-center mb-2">P&L by Hour of Day (UTC)</h4>
                        <div className="h-64 w-full">
                            <ResponsiveContainer><BarChart data={temporalData.byHour}><CartesianGrid strokeDasharray="3 3" stroke="#374151" /><XAxis dataKey="name" stroke="#9CA3AF" tick={{ fill: '#9CA3AF', fontSize: 10 }}/><YAxis stroke="#9CA3AF" tick={{ fill: '#9CA3AF', fontSize: 12 }} tickFormatter={(value) => `$${(value/1000).toFixed(0)}k`}/><Tooltip content={<CustomTooltip chartType="temporal"/>} cursor={{fill: 'rgba(100,116,139,0.1)'}}/><Bar dataKey="pnl" name="P&L">{temporalData.byHour.map((entry, index) => <Cell key={`cell-${index}`} fill={entry.pnl >= 0 ? '#22c55e' : '#ef4444'} />)}</Bar></BarChart></ResponsiveContainer>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

const InstitutionalGradeTab = ({ reportData }) => {
    const scorecardData = useMemo(() => {
        const scores = [
            { name: 'Risk-Adjusted Returns', score: 9.0, weight: 0.25 },
            { name: 'Drawdown Management', score: 6.0, weight: 0.20 },
            { name: 'Consistency', score: 7.0, weight: 0.15 },
            { name: 'Scalability', score: 8.0, weight: 0.15 },
            { name: 'Risk Management', score: 8.0, weight: 0.15 },
            { name: 'Diversification', score: 3.0, weight: 0.10 },
        ];
        
        const totalScore = scores.reduce((acc, item) => acc + (item.score * item.weight), 0);
        
        return { scores, totalScore };
    }, []);

    return (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-slate-800/50 p-4 rounded-lg border border-slate-700">
                <h3 className="text-xl font-bold text-blue-400 mb-4">9.1 Institutional Scorecard</h3>
                <table className="w-full text-sm text-left">
                    <thead><tr className="border-b border-slate-600 text-slate-400"><th className="py-2">Criteria</th><th>Score (1-10)</th><th>Weight</th><th>Weighted Score</th></tr></thead>
                    <tbody>
                        {scorecardData.scores.map(item => (
                             <tr key={item.name} className="border-b border-slate-700">
                                <td>{item.name}</td>
                                <td className={item.score >= 8 ? 'text-green-400' : item.score >= 6 ? 'text-yellow-400' : 'text-red-400'}>{item.score.toFixed(1)}</td>
                                <td>{(item.weight * 100).toFixed(0)}%</td>
                                <td className={item.score >= 8 ? 'text-green-400' : item.score >= 6 ? 'text-yellow-400' : 'text-red-400'}>{(item.score * item.weight).toFixed(2)}</td>
                            </tr>
                        ))}
                        <tr className="font-bold"><td className="pt-3">Overall Score</td><td></td><td></td><td className="text-xl text-green-400">{scorecardData.totalScore.toFixed(1)}/10</td></tr>
                    </tbody>
                </table>
            </div>
            <div className="bg-slate-800/50 p-4 rounded-lg border border-slate-700">
                <h3 className="text-xl font-bold text-blue-400 mb-4">10. Competitive Landscape</h3>
                 <table className="w-full text-sm text-left">
                    <thead><tr className="border-b border-slate-600 text-slate-400"><th className="py-2">Strategy Type</th><th>Typical Sharpe</th><th>Our Model</th><th>Assessment</th></tr></thead>
                    <tbody>
                        <tr className="border-b border-slate-700"><td>Systematic Trend</td><td>0.8-1.5</td><td className="text-green-400">{reportData.institutionalMetrics.sharpeRatio}</td><td className="text-green-400 font-semibold">Superior</td></tr>
                        <tr className="border-b border-slate-700"><td>High-Frequency</td><td>1.2-2.0</td><td className="text-green-400">{reportData.institutionalMetrics.sharpeRatio}</td><td className="text-green-400 font-semibold">Competitive</td></tr>
                        <tr className="border-b border-slate-700"><td>Quantitative Equity</td><td>1.0-1.8</td><td className="text-green-400">{reportData.institutionalMetrics.sharpeRatio}</td><td className="text-green-400 font-semibold">Superior</td></tr>
                        <tr><td>Multi-Strat Hedge Fund</td><td>1.2-2.2</td><td className="text-green-400">{reportData.institutionalMetrics.sharpeRatio}</td><td className="text-green-400 font-semibold">Competitive</td></tr>
                    </tbody>
                </table>
            </div>
        </div>
    );
};