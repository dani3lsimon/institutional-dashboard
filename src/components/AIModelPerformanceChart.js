// Copy this entire code into: src/components/AIModelPerformanceChart.js

import React, { useState, useMemo } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

const AIModelPerformanceChart = ({ trades }) => {
    const [selectedModels, setSelectedModels] = useState({});
    
    // Process trades to calculate cumulative PnL for each AI model
    const processedData = useMemo(() => {
        if (!trades || trades.length === 0) return { chartData: [], models: [] };
        
        // Get unique AI models
        const uniqueModels = [...new Set(trades.map(trade => trade.signal_source || 'Unknown'))];
        
        // Initialize model tracking
        const modelData = {};
        uniqueModels.forEach(model => {
            modelData[model] = {
                name: model,
                trades: [],
                cumulativePnL: 0,
                tradeCount: 0,
                wins: 0,
                losses: 0,
                totalWinPnL: 0,
                totalLossPnL: 0
            };
        });
        
        // Initialize selectedModels state if empty
        if (Object.keys(selectedModels).length === 0) {
            const initialSelection = {};
            uniqueModels.forEach(model => {
                initialSelection[model] = true; // All models selected by default
            });
            setSelectedModels(initialSelection);
        }
        
        // Sort trades by entry time to ensure chronological order
        const sortedTrades = [...trades].sort((a, b) => 
            new Date(a.entry_time) - new Date(b.entry_time)
        );
        
        // Process each trade and build cumulative data
        const chartData = [];
        
        sortedTrades.forEach((trade, index) => {
            const model = trade.signal_source || 'Unknown';
            const pnl = parseFloat(trade.pnl || 0);
            
            // Update model data
            modelData[model].cumulativePnL += pnl;
            modelData[model].tradeCount++;
            
            if (trade.result === 'WIN') {
                modelData[model].wins++;
                modelData[model].totalWinPnL += pnl;
            } else if (trade.result === 'LOSS') {
                modelData[model].losses++;
                modelData[model].totalLossPnL += Math.abs(pnl);
            }
            
            // Create chart data point
            const dataPoint = {
                tradeNumber: index + 1,
                date: new Date(trade.entry_time).toLocaleDateString(),
                tradingModel: model,
                tradePnL: pnl
            };
            
            // Add cumulative PnL for each model up to this point
            uniqueModels.forEach(modelName => {
                dataPoint[`${modelName}_cumulative`] = modelData[modelName].cumulativePnL;
                dataPoint[`${modelName}_trades`] = modelData[modelName].tradeCount;
            });
            
            chartData.push(dataPoint);
        });
        
        return { 
            chartData, 
            models: uniqueModels.map(model => ({
                name: model,
                ...modelData[model],
                winRate: modelData[model].tradeCount > 0 
                    ? ((modelData[model].wins / modelData[model].tradeCount) * 100).toFixed(1)
                    : '0.0',
                profitFactor: modelData[model].totalLossPnL > 0 
                    ? (modelData[model].totalWinPnL / modelData[model].totalLossPnL).toFixed(2)
                    : 'Infinity'
            }))
        };
    }, [trades, selectedModels]);
    
    const { chartData, models } = processedData;
    
    // Color palette for different AI models
    const modelColors = [
        '#3B82F6', // Blue
        '#EF4444', // Red  
        '#10B981', // Green
        '#F59E0B', // Yellow
        '#8B5CF6', // Purple
        '#F97316', // Orange
        '#06B6D4', // Cyan
        '#EC4899', // Pink
        '#84CC16', // Lime
        '#6366F1'  // Indigo
    ];
    
    const handleModelToggle = (modelName) => {
        setSelectedModels(prev => ({
            ...prev,
            [modelName]: !prev[modelName]
        }));
    };
    
    const selectAllModels = () => {
        const allSelected = {};
        models.forEach(model => {
            allSelected[model.name] = true;
        });
        setSelectedModels(allSelected);
    };
    
    const deselectAllModels = () => {
        const noneSelected = {};
        models.forEach(model => {
            noneSelected[model.name] = false;
        });
        setSelectedModels(noneSelected);
    };

    const CustomTooltip = ({ active, payload, label }) => {
        if (active && payload && payload.length) {
            const data = payload[0].payload;
            return (
                <div className="bg-slate-800/95 backdrop-blur-sm border border-blue-400 rounded-lg p-3 shadow-lg text-sm max-w-xs">
                    <p className="text-blue-300 font-semibold">Trade #{data.tradeNumber}</p>
                    <p className="text-slate-400">Date: {data.date}</p>
                    <p className="text-slate-400">Active Model: {data.tradingModel}</p>
                    <p className={`${data.tradePnL >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                        Trade P&L: ${data.tradePnL?.toFixed(2)}
                    </p>
                    <div className="mt-2 space-y-1">
                        {payload.map((entry, index) => (
                            <p key={index} style={{ color: entry.color }}>
                                {entry.name}: ${entry.value?.toFixed(2)}
                            </p>
                        ))}
                    </div>
                </div>
            );
        }
        return null;
    };

    if (!trades || trades.length === 0) {
        return (
            <div className="bg-slate-800/50 p-6 rounded-lg border border-slate-700">
                <h3 className="text-xl font-bold text-blue-400 mb-4">AI Model Performance Comparison</h3>
                <div className="text-center text-slate-400 py-8">
                    <p>No trade data available for AI model comparison.</p>
                </div>
            </div>
        );
    }

    return (
        <div className="bg-slate-800/50 p-6 rounded-lg border border-slate-700">
            <div className="flex justify-between items-center mb-6">
                <h3 className="text-xl font-bold text-blue-400">AI Model Performance Comparison</h3>
                <div className="flex gap-2">
                    <button
                        onClick={selectAllModels}
                        className="px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded transition-colors"
                    >
                        Select All
                    </button>
                    <button
                        onClick={deselectAllModels}
                        className="px-3 py-1 bg-slate-600 hover:bg-slate-700 text-white text-sm rounded transition-colors"
                    >
                        Deselect All
                    </button>
                </div>
            </div>
            
            {/* Model Selection Checkboxes and Stats */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
                <div>
                    <h4 className="text-lg font-semibold text-slate-300 mb-3">Select AI Models to Display:</h4>
                    <div className="space-y-2">
                        {models.map((model, index) => (
                            <label key={model.name} className="flex items-center space-x-3 cursor-pointer hover:bg-slate-700/30 p-2 rounded">
                                <input
                                    type="checkbox"
                                    checked={selectedModels[model.name] || false}
                                    onChange={() => handleModelToggle(model.name)}
                                    className="w-4 h-4 text-blue-600 bg-slate-700 border-slate-600 rounded focus:ring-blue-500"
                                />
                                <div className="flex items-center space-x-2 flex-1">
                                    <div 
                                        className="w-3 h-3 rounded-full"
                                        style={{ backgroundColor: modelColors[index % modelColors.length] }}
                                    ></div>
                                    <span className="text-slate-300 font-medium">{model.name}</span>
                                </div>
                                <div className="text-xs text-slate-400">
                                    {model.tradeCount} trades
                                </div>
                            </label>
                        ))}
                    </div>
                </div>
                
                {/* Model Statistics */}
                <div>
                    <h4 className="text-lg font-semibold text-slate-300 mb-3">Model Statistics:</h4>
                    <div className="space-y-2">
                        {models.map((model, index) => (
                            <div key={model.name} className="bg-slate-700/30 p-3 rounded-lg">
                                <div className="flex items-center space-x-2 mb-2">
                                    <div 
                                        className="w-3 h-3 rounded-full"
                                        style={{ backgroundColor: modelColors[index % modelColors.length] }}
                                    ></div>
                                    <span className="font-medium text-slate-200">{model.name}</span>
                                </div>
                                <div className="grid grid-cols-3 gap-2 text-xs">
                                    <div>
                                        <span className="text-slate-400">P&L: </span>
                                        <span className={model.cumulativePnL >= 0 ? 'text-green-400' : 'text-red-400'}>
                                            ${model.cumulativePnL.toFixed(2)}
                                        </span>
                                    </div>
                                    <div>
                                        <span className="text-slate-400">Win Rate: </span>
                                        <span className="text-yellow-400">{model.winRate}%</span>
                                    </div>
                                    <div>
                                        <span className="text-slate-400">PF: </span>
                                        <span className="text-blue-400">{model.profitFactor}</span>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
            
            {/* Chart */}
            <div className="h-96 w-full">
                <ResponsiveContainer width="100%" height="100%">
                    <LineChart
                        data={chartData}
                        margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
                    >
                        <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                        <XAxis 
                            dataKey="tradeNumber" 
                            stroke="#9CA3AF" 
                            tick={{ fill: '#9CA3AF', fontSize: 12 }}
                            label={{ value: 'Trade Number', position: 'insideBottom', offset: -5, fill: '#9CA3AF' }}
                        />
                        <YAxis 
                            stroke="#9CA3AF" 
                            tick={{ fill: '#9CA3AF', fontSize: 12 }}
                            tickFormatter={(value) => `$${(value/1000).toFixed(1)}k`}
                            label={{ value: 'Cumulative P&L ($)', angle: -90, position: 'insideLeft', fill: '#9CA3AF' }}
                        />
                        <Tooltip content={<CustomTooltip />} />
                        <Legend 
                            wrapperStyle={{ fontSize: '14px' }}
                            iconType="line"
                        />
                        
                        {/* Render lines for selected models only */}
                        {models.map((model, index) => {
                            if (!selectedModels[model.name]) return null;
                            
                            return (
                                <Line
                                    key={model.name}
                                    type="monotone"
                                    dataKey={`${model.name}_cumulative`}
                                    stroke={modelColors[index % modelColors.length]}
                                    strokeWidth={2}
                                    dot={false}
                                    name={`${model.name} (${model.tradeCount} trades)`}
                                    connectNulls={false}
                                />
                            );
                        })}
                    </LineChart>
                </ResponsiveContainer>
            </div>
            
            {/* Performance Summary */}
            <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-slate-700/30 p-4 rounded-lg">
                    <h5 className="text-sm font-semibold text-blue-400 mb-2">Best Performing Model</h5>
                    {(() => {
                        const bestModel = models.reduce((best, current) => 
                            current.cumulativePnL > best.cumulativePnL ? current : best
                        , models[0] || {});
                        return (
                            <div>
                                <p className="text-slate-200 font-medium">{bestModel?.name || 'N/A'}</p>
                                <p className="text-green-400 text-lg font-bold">
                                    ${bestModel?.cumulativePnL?.toFixed(2) || '0.00'}
                                </p>
                                <p className="text-xs text-slate-400">
                                    {bestModel?.tradeCount || 0} trades • {bestModel?.winRate || '0'}% win rate
                                </p>
                            </div>
                        );
                    })()}
                </div>
                
                <div className="bg-slate-700/30 p-4 rounded-lg">
                    <h5 className="text-sm font-semibold text-yellow-400 mb-2">Most Active Model</h5>
                    {(() => {
                        const mostActive = models.reduce((best, current) => 
                            current.tradeCount > best.tradeCount ? current : best
                        , models[0] || {});
                        return (
                            <div>
                                <p className="text-slate-200 font-medium">{mostActive?.name || 'N/A'}</p>
                                <p className="text-yellow-400 text-lg font-bold">
                                    {mostActive?.tradeCount || 0} trades
                                </p>
                                <p className="text-xs text-slate-400">
                                    ${mostActive?.cumulativePnL?.toFixed(2) || '0.00'} total P&L
                                </p>
                            </div>
                        );
                    })()}
                </div>
                
                <div className="bg-slate-700/30 p-4 rounded-lg">
                    <h5 className="text-sm font-semibold text-purple-400 mb-2">Highest Win Rate</h5>
                    {(() => {
                        const highestWinRate = models.reduce((best, current) => 
                            parseFloat(current.winRate) > parseFloat(best.winRate) ? current : best
                        , models[0] || {});
                        return (
                            <div>
                                <p className="text-slate-200 font-medium">{highestWinRate?.name || 'N/A'}</p>
                                <p className="text-purple-400 text-lg font-bold">
                                    {highestWinRate?.winRate || '0'}%
                                </p>
                                <p className="text-xs text-slate-400">
                                    {highestWinRate?.wins || 0}W / {highestWinRate?.losses || 0}L
                                </p>
                            </div>
                        );
                    })()}
                </div>
            </div>
        </div>
    );
};

export default AIModelPerformanceChart;