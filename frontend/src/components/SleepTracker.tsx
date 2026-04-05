import { useEffect, useState } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Cell,
} from 'recharts';
import { Moon, Sun, Clock, Zap, BedDouble } from 'lucide-react';
import { api } from '../api';
import type { SleepStats } from '../types';

function formatMin(m: number) {
  const h = Math.floor(m / 60);
  const min = Math.round(m % 60);
  return h > 0 ? `${h}h ${min}m` : `${min}m`;
}

function formatDate(d: string) {
  return new Date(d + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}

function shortDay(d: string) {
  return new Date(d + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'short' });
}

function pct(stage: number, total: number) {
  if (total <= 0) return '0%';
  return `${Math.round((stage / total) * 100)}%`;
}

function calcSleepScore(total: number, deep: number, rem: number, awake: number): number {
  if (total <= 0) return 0;

  // Duration score (35 points): ideal 420-480 min (7-8 hrs)
  let duration = 0;
  if (total >= 420 && total <= 480) duration = 35;
  else if (total > 480 && total <= 540) duration = 35 - ((total - 480) / 60) * 5;
  else if (total >= 360 && total < 420) duration = 20 + ((total - 360) / 60) * 15;
  else if (total >= 300 && total < 360) duration = 10 + ((total - 300) / 60) * 10;
  else if (total < 300) duration = Math.max(0, (total / 300) * 10);
  else duration = Math.max(15, 30 - ((total - 540) / 60) * 10);

  // Deep sleep score (25 points): ideal 15-20%
  const deepPct = (deep / total) * 100;
  let deepScore = 0;
  if (deepPct >= 15 && deepPct <= 20) deepScore = 25;
  else if (deepPct > 20 && deepPct <= 25) deepScore = 22;
  else if (deepPct >= 10 && deepPct < 15) deepScore = 10 + ((deepPct - 10) / 5) * 15;
  else if (deepPct < 10) deepScore = (deepPct / 10) * 10;
  else deepScore = Math.max(10, 22 - ((deepPct - 25) / 10) * 12);

  // REM score (25 points): ideal 20-25%
  const remPct = (rem / total) * 100;
  let remScore = 0;
  if (remPct >= 20 && remPct <= 25) remScore = 25;
  else if (remPct >= 15 && remPct < 20) remScore = 12 + ((remPct - 15) / 5) * 13;
  else if (remPct < 15) remScore = (remPct / 15) * 12;
  else remScore = Math.max(10, 25 - ((remPct - 25) / 10) * 15);

  // Awake penalty (15 points): ideal < 5% of time in bed
  const totalInBed = total + awake;
  const awakePct = (awake / totalInBed) * 100;
  let awakeScore = 15;
  if (awakePct > 3) awakeScore = Math.max(0, 15 - ((awakePct - 3) / 12) * 15);

  return Math.round(Math.min(100, duration + deepScore + remScore + awakeScore));
}

function scoreLabel(score: number): { label: string; color: string; ring: string } {
  if (score >= 85) return { label: 'Excellent', color: 'text-emerald-400', ring: 'stroke-emerald-400' };
  if (score >= 70) return { label: 'Good', color: 'text-blue-400', ring: 'stroke-blue-400' };
  if (score >= 50) return { label: 'Fair', color: 'text-yellow-400', ring: 'stroke-yellow-400' };
  return { label: 'Poor', color: 'text-red-400', ring: 'stroke-red-400' };
}

const chartTooltipStyle = {
  background: 'rgba(15, 23, 42, 0.95)',
  border: '1px solid rgba(255,255,255,0.08)',
  borderRadius: 12,
  boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
};

export default function SleepTracker() {
  const [stats, setStats] = useState<SleepStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [range, setRange] = useState<'week' | 'month'>('week');

  useEffect(() => {
    api.getSleepStats()
      .then(setStats)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="w-10 h-10 border-2 border-purple-500 border-t-transparent rounded-full animate-spin" />
    </div>
  );

  if (!stats || stats.recent.length === 0) return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-white tracking-tight">Sleep</h1>
        <p className="text-slate-500 text-sm mt-1">Track your sleep patterns</p>
      </div>
      <div className="card text-center py-16">
        <div className="w-16 h-16 bg-gradient-to-br from-purple-500/20 to-indigo-500/20 rounded-2xl flex items-center justify-center border border-purple-500/20 mx-auto mb-4">
          <Moon size={28} className="text-purple-400" />
        </div>
        <p className="text-white font-semibold text-lg mb-2">No sleep data yet</p>
        <p className="text-slate-500 text-sm">Import your Apple Health data to see sleep metrics</p>
      </div>
    </div>
  );

  const { lastNight, recent } = stats;
  const avg = stats[range];
  const lastScore = lastNight ? calcSleepScore(lastNight.total_minutes, lastNight.deep_minutes, lastNight.rem_minutes, lastNight.awake_minutes) : 0;
  const lastScoreInfo = scoreLabel(lastScore);

  // Build stacked bar chart data
  const chartData = recent.map(r => ({
    date: r.date,
    label: shortDay(r.date),
    deep: Math.round(r.deep_minutes),
    rem: Math.round(r.rem_minutes),
    core: Math.round(r.core_minutes),
    awake: Math.round(r.awake_minutes),
    total: Math.round(r.total_minutes),
  }));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-white tracking-tight">Sleep</h1>
        <p className="text-slate-500 text-sm mt-1">
          {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
        </p>
      </div>

      {/* Last Night Summary */}
      {lastNight && (
        <div className="card">
          <div className="flex items-center gap-2 mb-4">
            <Moon size={18} className="text-purple-400" />
            <h2 className="font-semibold text-white">Last Night</h2>
            <span className="text-slate-500 text-sm ml-auto">{formatDate(lastNight.date)}</span>
          </div>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white/[0.03] rounded-xl p-4 text-center border border-white/[0.04]">
              <div className="w-9 h-9 mx-auto mb-2 rounded-lg bg-gradient-to-br from-purple-500 to-violet-600 flex items-center justify-center text-white shadow-lg">
                <Clock size={18} />
              </div>
              <p className="text-2xl font-bold text-white stat-value">{formatMin(lastNight.total_minutes)}</p>
              <p className="text-slate-600 text-xs mt-0.5">Total Sleep</p>
            </div>
            <div className="bg-white/[0.03] rounded-xl p-4 text-center border border-white/[0.04]">
              <div className="w-9 h-9 mx-auto mb-2 rounded-lg bg-gradient-to-br from-indigo-500 to-blue-600 flex items-center justify-center text-white shadow-lg">
                <BedDouble size={18} />
              </div>
              <p className="text-2xl font-bold text-indigo-400 stat-value">{pct(lastNight.deep_minutes, lastNight.total_minutes)}</p>
              <p className="text-slate-600 text-xs mt-0.5">Deep Sleep</p>
            </div>
            <div className="bg-white/[0.03] rounded-xl p-4 text-center border border-white/[0.04]">
              <div className="w-9 h-9 mx-auto mb-2 rounded-lg bg-gradient-to-br from-cyan-500 to-teal-600 flex items-center justify-center text-white shadow-lg">
                <Zap size={18} />
              </div>
              <p className="text-2xl font-bold text-cyan-400 stat-value">{pct(lastNight.rem_minutes, lastNight.total_minutes)}</p>
              <p className="text-slate-600 text-xs mt-0.5">REM Sleep</p>
            </div>
            <div className="bg-white/[0.03] rounded-xl p-4 text-center border border-white/[0.04]">
              <div className="relative w-16 h-16 mx-auto mb-1">
                <svg className="w-full h-full -rotate-90" viewBox="0 0 36 36">
                  <circle cx="18" cy="18" r="15.5" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="3" />
                  <circle cx="18" cy="18" r="15.5" fill="none" className={lastScoreInfo.ring} strokeWidth="3"
                    strokeDasharray={`${lastScore * 0.975} 100`} strokeLinecap="round" />
                </svg>
                <span className={`absolute inset-0 flex items-center justify-center text-lg font-bold ${lastScoreInfo.color}`}>{lastScore}</span>
              </div>
              <p className={`text-xs font-medium ${lastScoreInfo.color}`}>{lastScoreInfo.label}</p>
              <p className="text-slate-600 text-xs mt-0.5">Sleep Score</p>
            </div>
          </div>

          {/* Sleep stages bar */}
          <div className="mt-4">
            <div className="flex rounded-full h-4 overflow-hidden">
              {lastNight.deep_minutes > 0 && (
                <div className="bg-indigo-500 h-full" style={{ width: `${(lastNight.deep_minutes / lastNight.total_minutes) * 100}%` }} title={`Deep: ${formatMin(lastNight.deep_minutes)}`} />
              )}
              {lastNight.core_minutes > 0 && (
                <div className="bg-blue-500 h-full" style={{ width: `${(lastNight.core_minutes / lastNight.total_minutes) * 100}%` }} title={`Core: ${formatMin(lastNight.core_minutes)}`} />
              )}
              {lastNight.rem_minutes > 0 && (
                <div className="bg-cyan-500 h-full" style={{ width: `${(lastNight.rem_minutes / lastNight.total_minutes) * 100}%` }} title={`REM: ${formatMin(lastNight.rem_minutes)}`} />
              )}
              {lastNight.awake_minutes > 0 && (
                <div className="bg-orange-500/50 h-full" style={{ width: `${(lastNight.awake_minutes / lastNight.total_minutes) * 100}%` }} title={`Awake: ${formatMin(lastNight.awake_minutes)}`} />
              )}
            </div>
            <div className="flex gap-4 mt-2 text-xs text-slate-500 justify-center">
              <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-indigo-500" />Deep {pct(lastNight.deep_minutes, lastNight.total_minutes)}</span>
              <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-blue-500" />Core {pct(lastNight.core_minutes, lastNight.total_minutes)}</span>
              <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-cyan-500" />REM {pct(lastNight.rem_minutes, lastNight.total_minutes)}</span>
              <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-orange-500/50" />Awake {pct(lastNight.awake_minutes, lastNight.total_minutes)}</span>
            </div>
          </div>

          {lastNight.bedtime && lastNight.wake_time && (
            <div className="flex justify-center gap-8 mt-4 text-sm">
              <div className="flex items-center gap-2 text-slate-400">
                <Moon size={14} className="text-purple-400" />
                Bedtime: <span className="text-white font-medium">{lastNight.bedtime}</span>
              </div>
              <div className="flex items-center gap-2 text-slate-400">
                <Sun size={14} className="text-yellow-400" />
                Wake: <span className="text-white font-medium">{lastNight.wake_time}</span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Averages */}
      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold text-white">Averages</h2>
          <div className="flex gap-1 bg-white/[0.04] rounded-lg p-0.5">
            {(['week', 'month'] as const).map(r => (
              <button
                key={r}
                onClick={() => setRange(r)}
                className={`px-3 py-1 rounded-md text-xs font-medium transition-all duration-200 ${
                  range === r ? 'bg-white/[0.1] text-white shadow-sm' : 'text-slate-500 hover:text-white'
                }`}
              >
                {r === 'week' ? '7d' : '30d'}
              </button>
            ))}
          </div>
        </div>
        <div className="grid grid-cols-5 gap-3">
          {[
            { label: 'Total', value: formatMin(avg.avg_total), color: 'text-purple-400' },
            { label: 'Deep', value: pct(avg.avg_deep, avg.avg_total), color: 'text-indigo-400' },
            { label: 'Core', value: pct(avg.avg_core, avg.avg_total), color: 'text-blue-400' },
            { label: 'REM', value: pct(avg.avg_rem, avg.avg_total), color: 'text-cyan-400' },
            { label: 'Awake', value: pct(avg.avg_awake, avg.avg_total), color: 'text-orange-400' },
          ].map(item => (
            <div key={item.label} className="text-center">
              <p className={`text-xl font-bold ${item.color}`}>{item.value}</p>
              <p className="text-slate-600 text-xs mt-0.5">{item.label}</p>
            </div>
          ))}
        </div>
        <p className="text-slate-600 text-xs text-center mt-3">{avg.nights} nights tracked</p>
      </div>

      {/* Sleep Duration Chart */}
      <div className="card">
        <h2 className="font-semibold text-white mb-4">Sleep Duration (Past 2 Weeks)</h2>
        <ResponsiveContainer width="100%" height={240}>
          <BarChart data={chartData} barCategoryGap="20%">
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
            <XAxis dataKey="label" tick={{ fill: '#64748b', fontSize: 11 }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fill: '#64748b', fontSize: 11 }} axisLine={false} tickLine={false} width={35}
              tickFormatter={(v) => `${Math.round(v / 60)}h`} />
            <Tooltip
              contentStyle={chartTooltipStyle}
              formatter={(v: number, name: string, props: { payload?: { total: number } }) => {
                const total = props.payload?.total || 1;
                return [`${Math.round((v / total) * 100)}%`, name.charAt(0).toUpperCase() + name.slice(1)];
              }}
              labelFormatter={(_, payload) => payload?.[0] ? `${formatDate(payload[0].payload.date)} — ${formatMin(payload[0].payload.total)}` : ''}
            />
            <Bar dataKey="deep" stackId="sleep" fill="#6366f1" radius={[0, 0, 0, 0]} />
            <Bar dataKey="core" stackId="sleep" fill="#3b82f6" radius={[0, 0, 0, 0]} />
            <Bar dataKey="rem" stackId="sleep" fill="#06b6d4" radius={[0, 0, 0, 0]} />
            <Bar dataKey="awake" stackId="sleep" fill="rgba(249, 115, 22, 0.4)" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
        <div className="flex gap-4 mt-3 text-xs text-slate-500 justify-center">
          <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-indigo-500" />Deep</span>
          <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-blue-500" />Core</span>
          <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-cyan-500" />REM</span>
          <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-orange-500/40" />Awake</span>
        </div>
      </div>

      {/* Recent Nights Table */}
      <div className="card">
        <h2 className="font-semibold text-white mb-4">Recent Nights</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-slate-400 border-b border-white/[0.06]">
                <th className="text-left py-2 pr-3">Date</th>
                <th className="text-right py-2 pr-3">Score</th>
                <th className="text-right py-2 pr-3">Total</th>
                <th className="text-right py-2 pr-3">Deep</th>
                <th className="text-right py-2 pr-3">Core</th>
                <th className="text-right py-2 pr-3">REM</th>
                <th className="text-right py-2">Awake</th>
              </tr>
            </thead>
            <tbody>
              {[...recent].reverse().map(r => {
                const s = calcSleepScore(r.total_minutes, r.deep_minutes, r.rem_minutes, r.awake_minutes);
                const si = scoreLabel(s);
                return (
                  <tr key={r.date} className="border-b border-white/[0.04] hover:bg-white/[0.02] transition-colors">
                    <td className="py-2.5 pr-3 text-white">{formatDate(r.date)}</td>
                    <td className={`py-2.5 pr-3 text-right font-bold ${si.color}`}>{s}</td>
                    <td className="py-2.5 pr-3 text-right font-semibold text-white">{formatMin(r.total_minutes)}</td>
                    <td className="py-2.5 pr-3 text-right text-indigo-400">{pct(r.deep_minutes, r.total_minutes)}</td>
                    <td className="py-2.5 pr-3 text-right text-blue-400">{pct(r.core_minutes, r.total_minutes)}</td>
                    <td className="py-2.5 pr-3 text-right text-cyan-400">{pct(r.rem_minutes, r.total_minutes)}</td>
                    <td className="py-2.5 text-right text-orange-400">{pct(r.awake_minutes, r.total_minutes)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
