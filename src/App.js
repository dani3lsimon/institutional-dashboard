// src/App.js

import React, { useState, useEffect } from 'react';
import { Routes, Route, useParams, useNavigate } from 'react-router-dom';
import { supabase } from './supabaseClient'; // We'll use this to fetch results
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, AreaChart, Area, ComposedChart, Bar, BarChart } from 'recharts';

// --- The Dashboard and its helper components have NOT changed. ---
// --- They just display whatever data they are given. ---
const MetricCard = ({ title, value, subtitle, color = 'blue', size = 'normal' }) => (
    <div className={`bg-slate-800 p-4 rounded-lg border border-slate-600 ${size === 'large' ? 'col-span-2' : ''}`}>
        <div className="text-slate-400 text-sm">{title}</div>
        <div className={`text-${color}-400 ${size === 'large' ? 'text-3xl' : 'text-xl'} font-bold`}>{value}</div>
        {subtitle && <div className="text-slate-500 text-xs mt-1">{subtitle}</div>}
    </div>
);

const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
        const point = payload[0].payload;
        return (
            <div className="bg-slate-800/90 backdrop-blur-sm border border-blue-400 rounded-lg p-3 shadow-lg text-sm max-w-xs">
                <p className="text-blue-300 font-semibold">Trade #{label}</p>
                <p className="text-green-400">Balance: ${point.balance?.toLocaleString()}</p>
                <p className="text-cyan-400">Peak: ${point.peakBalance?.toLocaleString()}</p>
                <p className="text-blue-400">Return: {point.returnPercent}%</p>
                <p className={`${point.pnl >= 0 ? 'text-green-400' : 'text-red-400'}`}>P&L: ${point.pnl}</p>
                {point.drawdown > 0 && <p className="text-red-400">Drawdown: {point.drawdown}%</p>}
            </div>
        );
    }
    return null;
};

const Dashboard = ({ reportData }) => {
    const [activeChart, setActiveChart] = useState('growth');
    const { metrics, institutionalMetrics, fileName, chartData } = reportData;

    return (
        <div className="w-full bg-gradient-to-br from-slate-900 to-slate-800 p-4 md:p-6 rounded-lg text-white font-sans">
            <div className="mb-6">
                <h1 className="text-3xl md:text-4xl font-bold text-blue-400 mb-2">🏛️ Institutional Trading Performance Dashboard</h1>
                <p className="text-slate-300 mb-4">Comprehensive analysis of {metrics.totalTrades} trades from <span className="font-semibold text-blue-300">{fileName}</span></p>
                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4 mb-6">
                    <MetricCard title="Total Return" value={`${metrics.totalReturn}%`} color="green" size="large" />
                    <MetricCard title="Sharpe Ratio" value={institutionalMetrics.sharpeRatio} subtitle="Risk-Adjusted Return" color="blue" />
                    <MetricCard title="Max Drawdown" value={`${metrics.maxDrawdown}%`} subtitle="Peak to Trough" color="red" />
                    <MetricCard title="Profit Factor" value={institutionalMetrics.profitFactor} subtitle="Gross Win / Gross Loss" color="green" />
                    <MetricCard title="Win Rate" value={`${institutionalMetrics.winRate}%`} subtitle="Accuracy" color="yellow" />
                    <MetricCard title="Calmar Ratio" value={institutionalMetrics.calmarRatio} subtitle="Return vs Drawdown" color="purple" />
                </div>
            </div>
            <div className="bg-slate-800/50 p-4 rounded-lg border border-slate-700">
                <div className="flex flex-wrap gap-2 mb-4">
                    {['growth', 'drawdown', 'combined', 'metrics'].map(chartType => (
                        <button key={chartType} onClick={() => setActiveChart(chartType)} className={`px-4 py-2 rounded-lg font-medium transition-all duration-200 text-sm md:text-base ${activeChart === chartType ? `bg-${{'growth':'blue','drawdown':'red','combined':'purple','metrics':'green'}[chartType]}-600 text-white shadow-lg` : 'bg-slate-700 text-slate-300 hover:bg-slate-600'}`}>{chartType === 'growth' && '📈 Capital Growth'}{chartType === 'drawdown' && '📉 Drawdown Analysis'}{chartType === 'combined' && '📊 Risk-Return View'}{chartType === 'metrics' && '🎯 Key Metrics View'}</button>
                    ))}
                </div>
                <div className="h-96 w-full">
                    <ResponsiveContainer width="100%" height="100%">{activeChart === 'growth' ? <AreaChart data={chartData} margin={{ top: 5, right: 20, left: -10, bottom: 5 }}><defs><linearGradient id="balanceGradient" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#3B82F6" stopOpacity={0.7}/><stop offset="95%" stopColor="#3B82F6" stopOpacity={0.1}/></linearGradient></defs><CartesianGrid strokeDasharray="3 3" stroke="#374151" /><XAxis dataKey="trade" stroke="#9CA3AF" tick={{ fill: '#9CA3AF', fontSize: 12 }} /><YAxis stroke="#9CA3AF" tick={{ fill: '#9CA3AF', fontSize: 12 }} tickFormatter={(value) => `$${(value/1000).toFixed(0)}k`} /><Tooltip content={<CustomTooltip />} /><Legend wrapperStyle={{fontSize: "14px"}}/><Area type="monotone" dataKey="balance" stroke="#3B82F6" strokeWidth={2} fill="url(#balanceGradient)" name="Account Balance" /></AreaChart> : activeChart === 'drawdown' ? <AreaChart data={chartData} margin={{ top: 5, right: 20, left: -10, bottom: 5 }}><defs><linearGradient id="drawdownGradient" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#EF4444" stopOpacity={0.7}/><stop offset="95%" stopColor="#EF4444" stopOpacity={0.1}/></linearGradient></defs><CartesianGrid strokeDasharray="3 3" stroke="#374151" /><XAxis dataKey="trade" stroke="#9CA3AF" tick={{ fill: '#9CA3AF', fontSize: 12 }} /><YAxis stroke="#9CA3AF" tick={{ fill: '#9CA3AF', fontSize: 12 }} tickFormatter={(value) => `${value.toFixed(1)}%`} /><Tooltip content={<CustomTooltip />} /><Legend wrapperStyle={{fontSize: "14px"}}/><Area type="monotone" dataKey="drawdown" stroke="#EF4444" strokeWidth={2} fill="url(#drawdownGradient)" name="Drawdown %" /></AreaChart> : activeChart === 'combined' ? <ComposedChart data={chartData} margin={{ top: 5, right: 20, left: -10, bottom: 5 }}><CartesianGrid strokeDasharray="3 3" stroke="#374151" /><XAxis dataKey="trade" stroke="#9CA3AF" tick={{ fill: '#9CA3AF', fontSize: 12 }} /><YAxis yAxisId="left" orientation="left" stroke="#3B82F6" tick={{ fill: '#3B82F6', fontSize: 12 }} tickFormatter={(value) => `$${(value/1000).toFixed(0)}k`} /><YAxis yAxisId="right" orientation="right" stroke="#EF4444" tick={{ fill: '#EF4444', fontSize: 12 }} tickFormatter={(value) => `${value.toFixed(1)}%`} /><Tooltip content={<CustomTooltip />} /><Legend wrapperStyle={{fontSize: "14px"}}/><Area yAxisId="left" type="monotone" dataKey="balance" stroke="#3B82F6" fill="rgba(59, 130, 246, 0.2)" name="Balance" /><Line yAxisId="right" type="monotone" dataKey="drawdown" stroke="#EF4444" strokeWidth={2} dot={false} name="Drawdown %" /></ComposedChart> : <div className="h-full flex items-center justify-center p-4"><div className="grid grid-cols-2 md:grid-cols-4 gap-6 w-full max-w-4xl">{[{ value: institutionalMetrics.sharpeRatio, label: 'Sharpe Ratio', sub: 'Risk-Adjusted Return', color: 'green' }, { value: institutionalMetrics.calmarRatio, label: 'Calmar Ratio', sub: 'Return / Max DD', color: 'blue' }, { value: `${institutionalMetrics.kellyPercentage}%`, label: 'Kelly %', sub: 'Optimal Position Size', color: 'purple' }, { value: `$${institutionalMetrics.expectancy}`, label: 'Expectancy', sub: '$ Per Trade', color: 'yellow' }].map(metric => (<div key={metric.label} className="text-center p-4 bg-slate-900/50 rounded-lg border border-slate-700"><div className={`text-4xl md:text-5xl font-bold text-${metric.color}-400 mb-2`}>{metric.value}</div><div className="text-slate-300 text-sm md:text-base">{metric.label}</div><div className="text-xs text-slate-500">{metric.sub}</div></div>))}</div></div>}</ResponsiveContainer>
                </div>
            </div>
            <div className="mt-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">{[{ title: '📈 Performance Metrics', color: 'green', data: [{ label: 'Total Return:', value: `${metrics.totalReturn}%` }, { label: 'Profit Factor:', value: institutionalMetrics.profitFactor }, { label: 'Expectancy:', value: `$${institutionalMetrics.expectancy}` }, { label: 'Win Rate:', value: `${institutionalMetrics.winRate}%`, color: 'yellow' }, { label: 'Avg Win:', value: `$${institutionalMetrics.avgWin}` }, { label: 'Avg Loss:', value: `$${institutionalMetrics.avgLoss}`, color: 'red' },] }, { title: '⚠️ Risk Analysis', color: 'red', data: [{ label: 'Sharpe Ratio:', value: institutionalMetrics.sharpeRatio, color: 'blue' }, { label: 'Sortino Ratio:', value: institutionalMetrics.sortinoRatio, color: 'blue' }, { label: 'Calmar Ratio:', value: institutionalMetrics.calmarRatio, color: 'purple' }, { label: 'Max Drawdown:', value: `${metrics.maxDrawdown}%` }, { label: 'Recovery Factor:', value: institutionalMetrics.recoveryFactor, color: 'green' }, { label: 'Best Trade:', value: `$${institutionalMetrics.bestTrade}`, color: 'green' },] }, { title: '💰 Position Management', color: 'blue', data: [{ label: 'Kelly %:', value: `${institutionalMetrics.kellyPercentage}%`, color: 'purple' }, { label: 'Avg Risk:', value: `${institutionalMetrics.avgRisk}%`, color: 'yellow' }, { label: 'Max Win Streak:', value: institutionalMetrics.maxWinStreak, color: 'green' }, { label: 'Max Loss Streak:', value: institutionalMetrics.maxLossStreak }, { label: 'Worst Trade:', value: `$${institutionalMetrics.worstTrade}` }, { label: 'Avg Leverage:', value: '20.0x', color: 'orange'},] }, { title: '🎯 Trade Summary', color: 'purple', data: [{ label: 'Total Trades:', value: institutionalMetrics.totalTrades }, { label: 'Winning Trades:', value: institutionalMetrics.winningTrades, color: 'green' }, { label: 'Losing Trades:', value: institutionalMetrics.losingTrades }, { label: 'Total P&L:', value: `$${institutionalMetrics.totalPnL}`, color: 'green' }, { label: 'Data Source:', value: 'Verified Link' }, { label: 'Asset:', value: 'XAUUSD' },] }].map(section => (<div key={section.title} className="bg-slate-800 p-4 rounded-lg border border-slate-600"><h3 className={`text-${section.color}-400 font-semibold mb-3`}>{section.title}</h3><div className="space-y-2 text-sm">{section.data.map(item => (<div key={item.label} className="flex justify-between"><span className="text-slate-400">{item.label}</span><span className={`font-semibold ${item.color ? `text-${item.color}-400` : 'text-white'}`}>{item.value}</span></div>))}</div></div>))}</div>
        </div>
    );
};


// --- NEW: A component for the upload page ---
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
                // Send the CSV content to our secure backend function
                const response = await fetch('/api/generate-report', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ csv: reader.result, fileName: file.name })
                });

                const data = await response.json();

                if (!response.ok) {
                    throw new Error(data.error || 'Failed to generate report.');
                }

                // Redirect to the new, shareable results page!
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


// --- NEW: A component for the results page ---
function ResultsPage() {
    const { id } = useParams(); // Gets the report ID from the URL, e.g., /results/some-id
    const [reportData, setReportData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        const fetchReport = async () => {
            if (!id) return;
            try {
                // Fetch the specific report data from Supabase using the public key
                const { data, error } = await supabase
                    .from('results')
                    .select('data') // Select the 'data' column which contains our JSON
                    .eq('id', id)   // Where the 'id' matches the one from the URL
                    .single();      // We expect only one result

                if (error) throw error;
                
                if (data) {
                    setReportData(data.data); // The JSON object is nested inside the 'data' property
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
    }, [id]); // This effect runs whenever the ID in the URL changes

    if (loading) {
        return <div className="flex items-center justify-center h-screen bg-gradient-to-br from-slate-900 to-slate-800 text-white text-blue-400 animate-pulse">Loading Report...</div>;
    }

    if (error) {
        return <div className="flex items-center justify-center h-screen bg-gradient-to-br from-slate-900 to-slate-800 text-white text-red-400">Error: {error}</div>;
    }

    // Once data is loaded, render the dashboard with it
    return <Dashboard reportData={reportData} />;
}


// --- The main App component is now just a router ---
function App() {
  return (
    <Routes>
      <Route path="/" element={<UploadPage />} />
      <Route path="/results/:id" element={<ResultsPage />} />
    </Routes>
  );
}

export default App;