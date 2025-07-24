import { createClient } from '@supabase/supabase-js';

// Initialize the Supabase client with the SECRET service_role key
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

// --- Helper Functions for Advanced Analysis ---
function getTopPatterns(trades) {
  const patterns = {};
  trades.forEach(trade => {
    const pattern = trade.pattern || 'Unknown';
    if (!patterns[pattern]) {
      patterns[pattern] = { count: 0, totalPnL: 0, wins: 0, totalConfidence: 0 };
    }
    patterns[pattern].count++;
    patterns[pattern].totalPnL += trade.pnl;
    patterns[pattern].totalConfidence += trade.confidence;
    if (trade.result === 'WIN') patterns[pattern].wins++;
  });
  return Object.entries(patterns)
    .map(([pattern, stats]) => ({
      pattern,
      count: stats.count,
      totalPnL: stats.totalPnL.toFixed(2),
      winRate: ((stats.wins / stats.count) * 100).toFixed(2),
      avgConfidence: ((stats.totalConfidence / stats.count) * 100).toFixed(2)
    }))
    .sort((a, b) => parseFloat(b.totalPnL) - parseFloat(a.totalPnL))
    .slice(0, 5);
}

function getSignalSourceAnalysis(trades) {
  const sources = {};
  trades.forEach(trade => {
    const source = trade.signal_source || 'Unknown';
    if (!sources[source]) {
      sources[source] = { count: 0, totalPnL: 0, wins: 0, totalConfidence: 0 };
    }
    sources[source].count++;
    sources[source].totalPnL += trade.pnl;
    sources[source].totalConfidence += trade.confidence;
    if (trade.result === 'WIN') sources[source].wins++;
  });
  return Object.entries(sources)
    .map(([source, stats]) => ({
      source,
      count: stats.count,
      totalPnL: stats.totalPnL.toFixed(2),
      winRate: ((stats.wins / stats.count) * 100).toFixed(2),
      avgPnl: (stats.totalPnL / stats.count).toFixed(2),
      avgConfidence: ((stats.totalConfidence / stats.count) * 100).toFixed(2)
    }))
    .sort((a, b) => parseFloat(b.totalPnL) - parseFloat(a.totalPnL));
}


export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    const csvContent = req.body.csv;
    if (!csvContent) {
      return res.status(400).json({ error: 'CSV content is missing' });
    }
    
    const lines = csvContent.trim().split('\n');
    if (lines.length < 2) throw new Error("CSV file is empty or invalid.");
    const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, ''));
    const trades = lines.slice(1).map((line) => {
      const values = line.split(',');
      const trade = {};
      headers.forEach((header, index) => {
        let value = values[index] ? values[index].trim().replace(/"/g, '') : '';
        if (['entry_price', 'exit_price', 'pnl', 'pips', 'confidence', 'position_size', 'balance_before', 'balance_after', 'risk_percentage'].includes(header)) {
          value = parseFloat(value) || 0;
        }
        trade[header] = value;
      });
      return trade;
    }).filter(trade => trade.trade_id);

    const startingBalance = trades.length > 0 && trades[0].balance_before ? trades[0].balance_before : 10000;
    
    const chartData = [];
    let peakBalance = startingBalance;
    const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    trades.forEach((trade, index) => {
      const balance = trade.balance_after;
      if (balance > peakBalance) peakBalance = balance;
      const drawdownPercent = peakBalance > 0 ? ((peakBalance - balance) / peakBalance) * 100 : 0;
      const entryDate = new Date(trade.entry_time);
      chartData.push({
        trade: index + 1,
        date: entryDate.toLocaleDateString(),
        month: `${monthNames[entryDate.getMonth()]} '${entryDate.getFullYear().toString().slice(-2)}`,
        balance: Math.round(balance * 100) / 100,
        peakBalance: Math.round(peakBalance * 100) / 100,
        drawdown: Math.round(drawdownPercent * 100) / 100,
        pnl: Math.round(trade.pnl * 100) / 100,
        returnPercent: Math.round(((balance / startingBalance - 1) * 100) * 100) / 100,
      });
    });

    const finalBalance = chartData.length > 0 ? chartData[chartData.length - 1].balance : startingBalance;
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
    const totalReturn = (finalBalance / startingBalance - 1) * 100;
    const maxDD = Math.max(...chartData.map(d => d.drawdown));
    const calmarRatio = maxDD > 0 ? (totalReturn / maxDD) : Infinity;
    const expectancy = (avgWin * (winRate / 100)) + (avgLoss * (1 - winRate / 100));
    const kelly = winRate > 0 && avgWin > 0 && avgLoss < 0 ? ((winRate / 100) / Math.abs(avgLoss)) - ((1 - winRate / 100) / avgWin) : 0;
    const totalPnL = trades.reduce((sum, t) => sum + t.pnl, 0);
    const maxDrawdownValue = chartData.reduce((max, p) => Math.max(max, p.peakBalance - p.balance), 0);
    const recoveryFactor = maxDrawdownValue > 0 ? totalPnL / maxDrawdownValue : Infinity;
    let maxWinStreak = 0, maxLossStreak = 0, currentWinStreak = 0, currentLossStreak = 0;
    trades.forEach(trade => {
        if (trade.result === 'WIN') { currentWinStreak++; currentLossStreak = 0; } 
        else { currentLossStreak++; currentWinStreak = 0; }
        maxWinStreak = Math.max(maxWinStreak, currentWinStreak);
        maxLossStreak = Math.max(maxLossStreak, currentLossStreak);
    });
    
    const pnlByDay = { Monday: 0, Tuesday: 0, Wednesday: 0, Thursday: 0, Friday: 0, Saturday: 0, Sunday: 0 };
    const pnlByHour = Array(24).fill(0).map(() => 0);
    const days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
    const pnlByMonth = {};
    trades.forEach(t => {
        try {
            const date = new Date(t.entry_time);
            if(!isNaN(date.getTime())) {
                pnlByDay[days[date.getDay()]] += t.pnl;
                pnlByHour[date.getHours()] += t.pnl;
                const monthKey = `${monthNames[date.getMonth()]} '${date.getFullYear().toString().slice(-2)}`;
                pnlByMonth[monthKey] = (pnlByMonth[monthKey] || 0) + t.pnl;
            }
        } catch(e) { console.warn("Could not parse date", t.entry_time); }
    });
    const temporalData = {
        byDay: Object.entries(pnlByDay).map(([day, pnl]) => ({ name: day, pnl })),
        byHour: pnlByHour.map((pnl, hour) => ({ name: `${hour}:00`, pnl })),
        byMonth: Object.entries(pnlByMonth).map(([month, pnl]) => ({ name: month, pnl }))
    };

    const formatMetric = (value) => isFinite(value) ? value.toFixed(2) : '∞';
    
    const firstTradeDate = new Date(trades[0].entry_time);
    const lastTradeDate = new Date(trades[trades.length - 1].exit_time);
    const durationInDays = (lastTradeDate - firstTradeDate) / (1000 * 60 * 60 * 24);
    const annualizedReturn = durationInDays > 30 ? Math.pow(1 + totalReturn / 100, 365 / durationInDays) - 1 : totalReturn;
    
    const effectiveLeverages = trades.map(t => (t.position_size * t.entry_price) / t.balance_before).filter(v => isFinite(v));
    const avgEffectiveLeverage = effectiveLeverages.length > 0 ? effectiveLeverages.reduce((sum, v) => sum + v, 0) / effectiveLeverages.length : 0;

    const resultsJson = {
      chartData, temporalData,
      headerData: {
          asset: trades[0]?.symbol || 'N/A',
          strategy: 'Multi-AI Ensemble',
          startDate: firstTradeDate.toLocaleDateString(),
          endDate: lastTradeDate.toLocaleDateString(),
          totalTrades: trades.length,
          generatedDate: new Date().toLocaleDateString()
      },
      metrics: { 
          totalReturn: formatMetric(totalReturn), 
          annualizedReturn: formatMetric(annualizedReturn * 100),
          avgMonthlyReturn: formatMetric(totalReturn / (durationInDays / 30.44)),
          maxDrawdown: formatMetric(maxDD), 
          totalTrades: trades.length, 
          totalPnL: totalPnL.toFixed(2) 
      },
      institutionalMetrics: {
        winRate: winRate.toFixed(2), profitFactor: formatMetric(profitFactor), avgWin: avgWin.toFixed(2), avgLoss: avgLoss.toFixed(2), expectancy: expectancy.toFixed(2), sharpeRatio: formatMetric(sharpeRatio), sortinoRatio: formatMetric(sortinoRatio), calmarRatio: formatMetric(calmarRatio), recoveryFactor: formatMetric(recoveryFactor), maxWinStreak, maxLossStreak, 
        avgConfidence: (trades.reduce((sum, t) => sum + t.confidence, 0) / trades.length).toFixed(2),
        avgPositionSize: (trades.reduce((sum, t) => sum + t.position_size, 0) / trades.length).toFixed(2),
        avgEffectiveLeverage: avgEffectiveLeverage.toFixed(2),
        kellyPercentage: (kelly * 100).toFixed(2),
        avgRisk: (trades.reduce((sum, t) => sum + t.risk_percentage, 0) / trades.length).toFixed(2), 
        maxRisk: Math.max(...trades.map(t => t.risk_percentage)).toFixed(2),
        bestTrade: Math.max(...trades.map(t => t.pnl)).toFixed(2), 
        worstTrade: Math.min(...trades.map(t => t.pnl)).toFixed(2), 
        totalTrades: trades.length, winningTrades: winningTrades.length, losingTrades: losingTrades.length, 
        totalPnL: totalPnL.toFixed(2),
        topPatterns: getTopPatterns(trades),
        signalSources: getSignalSourceAnalysis(trades)
      },
      fileName: req.body.fileName || 'uploaded_data.csv'
    };

    const { data, error } = await supabase
      .from('results')
      .insert([{ data: resultsJson }])
      .select('id')
      .single();

    if (error) { throw error; }

    return res.status(200).json({ id: data.id });

  } catch (error) {
    console.error('API Error:', error);
    return res.status(500).json({ error: error.message });
  }
}
