import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://qviwrpyoammikkzougcz.supabase.co',
  process.env.SUPABASE_SERVICE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

function parseDeals(rows) {
  // rows = array of arrays, first row is header
  const header = rows[0];
  const colIdx = {};
  header.forEach((h, i) => { colIdx[h.trim().replace(/[^\x20-\x7E]/g, '')] = i; });

  // Map common cTrader column names
  const idCol    = colIdx['ID'] ?? 0;
  const symCol   = colIdx['Symbol'] ?? 1;
  const dirCol   = colIdx['Opening direction'] ?? 2;
  const timeCol  = colIdx['Closing time'] ?? 3;
  const entryCol = colIdx['Entry price'] ?? 4;
  const exitCol  = colIdx['Closing price'] ?? 5;
  const qtyCol   = colIdx['Closing Quantity'] ?? 6;
  const volCol   = colIdx['Closing volume'] ?? 7;
  const netCol   = Object.keys(colIdx).find(k => k.startsWith('Net')) ? colIdx[Object.keys(colIdx).find(k => k.startsWith('Net'))] : 9;
  const balCol   = Object.keys(colIdx).find(k => k.startsWith('Balance')) ? colIdx[Object.keys(colIdx).find(k => k.startsWith('Balance'))] : 10;

  const deals = [];
  for (let i = 1; i < rows.length; i++) {
    const r = rows[i];
    if (!r || !r[idCol]) continue;
    deals.push({
      dealId:     r[idCol],
      symbol:     r[symCol],
      direction:  r[dirCol],
      closeTime:  r[timeCol],
      entryPrice: parseFloat(r[entryCol]) || 0,
      exitPrice:  parseFloat(r[exitCol]) || 0,
      quantity:   parseFloat(r[qtyCol]) || 0,
      volume:     parseFloat(r[volCol]) || 0,
      netPnl:     parseFloat(r[netCol]) || 0,
      balance:    parseFloat(r[balCol]) || 0,
    });
  }

  // cTrader exports newest first — reverse for chronological order
  deals.reverse();
  return deals;
}

function computeSummary(deals, accountId) {
  if (!deals.length) return {};
  const wins     = deals.filter(d => d.netPnl > 0).length;
  const losses   = deals.filter(d => d.netPnl < 0).length;
  const totalPnl = deals.reduce((s, d) => s + d.netPnl, 0);
  const startBal = deals[0].balance - deals[0].netPnl;
  const endBal   = deals[deals.length - 1].balance;

  // Max drawdown from equity curve
  let peak = startBal, maxDD = 0;
  let bal = startBal;
  for (const d of deals) {
    bal += d.netPnl;
    if (bal > peak) peak = bal;
    const dd = ((peak - bal) / peak) * 100;
    if (dd > maxDD) maxDD = dd;
  }

  const avgWin  = wins > 0 ? deals.filter(d => d.netPnl > 0).reduce((s, d) => s + d.netPnl, 0) / wins : 0;
  const avgLoss = losses > 0 ? Math.abs(deals.filter(d => d.netPnl < 0).reduce((s, d) => s + d.netPnl, 0) / losses) : 0;

  return {
    accountId,
    trades:       deals.length,
    wins,
    losses,
    winRate:      ((wins / deals.length) * 100).toFixed(1),
    totalPnl:     totalPnl.toFixed(2),
    returnPct:    ((totalPnl / startBal) * 100).toFixed(2),
    startBalance: startBal.toFixed(2),
    endBalance:   endBal.toFixed(2),
    maxDrawdown:  maxDD.toFixed(2),
    avgWin:       avgWin.toFixed(2),
    avgLoss:      avgLoss.toFixed(2),
    profitFactor: avgLoss > 0 ? ((avgWin * wins) / (avgLoss * losses)).toFixed(2) : '∞',
    firstTrade:   deals[0].closeTime,
    lastTrade:    deals[deals.length - 1].closeTime,
  };
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });

  try {
    const { rows, accountId, accountLabel } = req.body;
    if (!rows || !rows.length) return res.status(400).json({ error: 'No data rows provided' });

    const deals   = parseDeals(rows);
    const summary = computeSummary(deals, accountId || 'unknown');

    // Upsert — delete existing for same account, then insert
    if (accountId) {
      await supabase.from('live_statements').delete().eq('account_id', accountId);
    }

    const { data, error } = await supabase.from('live_statements').insert({
      account_id:    accountId || `acct_${Date.now()}`,
      account_label: accountLabel || null,
      deals,
      summary,
    }).select('id').single();

    if (error) throw error;

    return res.status(200).json({ id: data.id, summary });
  } catch (err) {
    console.error('upload-statement error:', err);
    return res.status(500).json({ error: err.message });
  }
}
