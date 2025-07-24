// api/generate-report.js

import { createClient } from '@supabase/supabase-js';

// Initialize the Supabase client with the SECRET service_role key
// These values will come from Vercel's Environment Variables, not from the code
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

// This is the main function that Vercel will run
export default async function handler(req, res) {
  // Only allow POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    const csvContent = req.body.csv;
    if (!csvContent) {
      return res.status(400).json({ error: 'CSV content is missing' });
    }

    // --- DATA PROCESSING LOGIC (Moved from App.js to the backend) ---
    const lines = csvContent.trim().split('\n');
    if (lines.length < 2) throw new Error("CSV file is empty or invalid.");
    const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, ''));
    const trades = lines.slice(1).map(line => {
      const values = line.split(',');
      const trade = {};
      headers.forEach((header, index) => {
        let value = values[index] ? values[index].trim().replace(/"/g, '') : '';
        if (['balance_after', 'balance_before', 'pnl', 'position_size', 'risk_percentage', 'leverage_ratio', 'confidence'].includes(header)) {
          value = parseFloat(value) || 0;
        }
        trade[header] = value;
      });
      return trade;
    });

    const chartData = [];
    let peakBalance = 10000;
    trades.forEach((trade, index) => {
      const balance = trade.balance_after;
      if (balance > peakBalance) peakBalance = balance;
      const drawdownPercent = peakBalance > 0 ? ((peakBalance - balance) / peakBalance) * 100 : 0;
      chartData.push({
        trade: index + 1,
        balance: Math.round(balance * 100) / 100,
        peakBalance: Math.round(peakBalance * 100) / 100,
        drawdown: Math.round(drawdownPercent * 100) / 100,
        pnl: Math.round(trade.pnl * 100) / 100,
        returnPercent: Math.round(((balance / 10000 - 1) * 100) * 100) / 100
      });
    });

    const finalBalance = chartData.length > 0 ? chartData[chartData.length - 1].balance : 10000;
    const winningTrades = trades.filter(t => t.result === 'WIN');
    const losingTrades = trades.filter(t => t.result === 'LOSS');
    const winRate = trades.length > 0 ? (winningTrades.length / trades.length) * 100 : 0;
    const totalWinPnl = winningTrades.reduce((sum, t) => sum + t.pnl, 0);
    const totalLossPnl = losingTrades.reduce((sum, t) => sum + t.pnl, 0);
    const avgWin = winningTrades.length > 0 ? totalWinPnl / winningTrades.length : 0;
    const avgLoss = losingTrades.length > 0 ? totalLossPnl / losingTrades.length : 0;
    const profitFactor = totalLossPnl !== 0 ? Math.abs(totalWinPnl / totalLossPnl) : Infinity;
    const returns = trades.map(t => t.balance_before > 0 ? (t.pnl / t.balance_before) : 0);
    const avgReturn = returns.length > 0 ? returns.reduce((a, b) => a + b, 0) / returns.length : 0;
    const stdDev = returns.length > 1 ? Math.sqrt(returns.map(x => Math.pow(x - avgReturn, 2)).reduce((a, b) => a + b, 0) / (returns.length -1)) : 0;
    const sharpeRatio = stdDev > 0 ? (avgReturn / stdDev) * Math.sqrt(252) : 0;
    const losingReturns = returns.filter(r => r < 0);
    const downsideDeviation = losingReturns.length > 0 ? Math.sqrt(losingReturns.map(x => Math.pow(x, 2)).reduce((a, b) => a + b) / losingReturns.length) : 0;
    const sortinoRatio = downsideDeviation > 0 ? (avgReturn / downsideDeviation) * Math.sqrt(252) : Infinity;
    const totalReturn = (finalBalance / 10000 - 1) * 100;
    const maxDD = Math.max(...chartData.map(d => d.drawdown));
    const calmarRatio = maxDD > 0 ? (totalReturn / maxDD) : Infinity;
    const expectancy = (avgWin * (winRate / 100)) + (avgLoss * (1 - winRate / 100));
    const kelly = winRate > 0 && avgWin > 0 && avgLoss < 0 ? ((winRate / 100) / Math.abs(avgLoss)) - ((1 - winRate / 100) / avgWin) : 0;
    const totalPnL = trades.reduce((sum, t) => sum + t.pnl, 0);
    const maxDrawdownValue = chartData.reduce((max, p) => Math.max(max, p.peakBalance - p.balance), 0);
    const recoveryFactor = maxDrawdownValue > 0 ? totalPnL / maxDrawdownValue : Infinity;
    let maxWinStreak = 0, maxLossStreak = 0, currentWinStreak = 0, currentLossStreak = 0;
    trades.forEach(trade => {
        if (trade.result === 'WIN') {
            currentWinStreak++;
            currentLossStreak = 0;
        } else {
            currentLossStreak++;
            currentWinStreak = 0;
        }
        maxWinStreak = Math.max(maxWinStreak, currentWinStreak);
        maxLossStreak = Math.max(maxLossStreak, currentLossStreak);
    });
    const formatMetric = (value) => isFinite(value) ? value.toFixed(2) : '∞';
    
    // We combine all results into a single JSON object to save
    const resultsJson = {
      chartData: chartData,
      metrics: {
        finalBalance: finalBalance,
        totalReturn: formatMetric(totalReturn),
        maxDrawdown: formatMetric(maxDD),
        totalTrades: trades.length
      },
      institutionalMetrics: {
        winRate: winRate.toFixed(2), profitFactor: formatMetric(profitFactor), avgWin: avgWin.toFixed(2), avgLoss: avgLoss.toFixed(2), expectancy: expectancy.toFixed(2), sharpeRatio: formatMetric(sharpeRatio), sortinoRatio: formatMetric(sortinoRatio), calmarRatio: formatMetric(calmarRatio), recoveryFactor: formatMetric(recoveryFactor), maxWinStreak, maxLossStreak, kellyPercentage: (kelly * 100).toFixed(2), avgRisk: (trades.reduce((sum, t) => sum + t.risk_percentage, 0) / trades.length).toFixed(2), bestTrade: Math.max(...trades.map(t => t.pnl)).toFixed(2), worstTrade: Math.min(...trades.map(t => t.pnl)).toFixed(2), totalTrades: trades.length, winningTrades: winningTrades.length, losingTrades: losingTrades.length, totalPnL: totalPnL.toFixed(2)
      },
      fileName: req.body.fileName || 'uploaded_data.csv'
    };
    // --- END OF DATA PROCESSING LOGIC ---


    // Insert the final JSON object into our 'results' table
    const { data, error } = await supabase
      .from('results')
      .insert([{ data: resultsJson }])
      .select('id') // Only select the 'id' of the new row
      .single();

    if (error) {
      throw error;
    }

    // Return the unique ID of the newly created report
    return res.status(200).json({ id: data.id });

  } catch (error) {
    console.error('API Error:', error);
    return res.status(500).json({ error: error.message });
  }
}