import { useEffect, useState } from 'react';
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, ReferenceLine, PieChart, Pie, Cell,
  AreaChart, Area,
} from 'recharts';
import { TrendingDown, Zap, Target, Dumbbell, Flame, Timer, Trophy, Activity, Moon } from 'lucide-react';
import { api } from '../api';
import type { DashboardStats, SleepStats } from '../types';

const ALL_DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const PIE_COLORS = ['#10b981', '#06b6d4', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#14b8a6', '#f97316'];

function formatDate(d: string) {
  return new Date(d + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

const chartTooltipStyle = {
  background: 'rgba(15, 23, 42, 0.95)',
  border: '1px solid rgba(255,255,255,0.08)',
  borderRadius: 12,
  boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
  color: '#e2e8f0',
};

function StatCard({
  icon, label, value, sub, gradient,
}: {
  icon: React.ReactNode; label: string; value: string; sub?: string; gradient: string;
}) {
  return (
    <div className="card group hover:border-white/[0.1] transition-all duration-300">
      <div className="flex items-start gap-3.5">
        <div className={`p-2.5 rounded-xl bg-gradient-to-br ${gradient} shadow-lg`}>
          {icon}
        </div>
        <div>
          <p className="text-slate-500 text-xs font-medium uppercase tracking-wider">{label}</p>
          <p className="text-2xl font-bold text-white mt-0.5 stat-value">{value}</p>
          {sub && <p className="text-slate-500 text-xs mt-1">{sub}</p>}
        </div>
      </div>
    </div>
  );
}

export default function Dashboard({ onNavigate }: { onNavigate: (tab: string) => void }) {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [sleepStats, setSleepStats] = useState<SleepStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [weightRange, setWeightRange] = useState<'30' | '90' | 'all'>('30');

  useEffect(() => {
    Promise.all([
      api.getStats(),
      api.getSleepStats().catch(() => null),
    ])
      .then(([s, sl]) => { setStats(s); setSleepStats(sl); })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="w-10 h-10 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
    </div>
  );

  if (error) return (
    <div className="card text-center py-12">
      <p className="text-red-400 mb-2">Could not connect to backend</p>
      <p className="text-slate-500 text-sm">Make sure the backend server is running on port 3001</p>
    </div>
  );

  if (!stats) return null;

  const { goals, today, weeklyProtein, weightHistory, allWeightHistory, latestWeight,
    recentWorkouts, weeklyWorkouts, workoutsByType, monthlyWorkoutStats, workoutStreak, todayWorkouts } = stats;
  const weightLeft = latestWeight - goals.goal_weight;
  const startWeight = allWeightHistory.length > 0 ? allWeightHistory[0].weight : goals.current_weight;
  const totalLost = startWeight - latestWeight;

  const weightChartData = (() => {
    if (weightRange === 'all') return allWeightHistory;
    const days = weightRange === '90' ? 90 : 30;
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - days);
    const cutoffStr = cutoff.toISOString().split('T')[0];
    return allWeightHistory.filter(w => w.date >= cutoffStr);
  })();

  const today7 = new Date();
  const proteinByDay = new Map(weeklyProtein.map(d => [d.date, d.total_protein]));
  const weekData = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(today7);
    d.setDate(d.getDate() - (6 - i));
    const dateStr = d.toISOString().split('T')[0];
    return {
      date: dateStr,
      label: ALL_DAYS[d.getDay() === 0 ? 6 : d.getDay() - 1],
      protein: proteinByDay.get(dateStr) || 0,
    };
  });

  const workoutByDay = new Map<string, { count: number; minutes: number; calories: number }>();
  for (const w of weeklyWorkouts) {
    const existing = workoutByDay.get(w.date) || { count: 0, minutes: 0, calories: 0 };
    existing.count++;
    existing.minutes += w.duration_minutes;
    existing.calories += w.calories_burned;
    workoutByDay.set(w.date, existing);
  }
  const weekWorkoutData = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(today7);
    d.setDate(d.getDate() - (6 - i));
    const dateStr = d.toISOString().split('T')[0];
    const data = workoutByDay.get(dateStr);
    return {
      date: dateStr,
      label: ALL_DAYS[d.getDay() === 0 ? 6 : d.getDay() - 1],
      minutes: data ? Math.round(data.minutes) : 0,
      calories: data ? Math.round(data.calories) : 0,
      count: data?.count || 0,
    };
  });

  const totalToLose = startWeight - goals.goal_weight;
  const progressPct = totalToLose > 0 ? Math.min(100, (totalLost / totalToLose) * 100) : 0;

  const formatSleepMin = (m: number) => {
    const h = Math.floor(m / 60);
    const min = Math.round(m % 60);
    return h > 0 ? `${h}h ${min}m` : `${min}m`;
  };
  const lastSleep = sleepStats?.lastNight;
  const sleepScore = lastSleep ? (() => {
    const t = lastSleep.total_minutes, d = lastSleep.deep_minutes, r = lastSleep.rem_minutes, a = lastSleep.awake_minutes;
    if (t <= 0) return 0;
    // Duration (35pts): ideal 420-480 min
    let dur = 0;
    if (t >= 420 && t <= 480) dur = 35;
    else if (t > 480 && t <= 540) dur = 35 - ((t - 480) / 60) * 5;
    else if (t >= 360) dur = 20 + ((t - 360) / 60) * 15;
    else if (t >= 300) dur = 10 + ((t - 300) / 60) * 10;
    else dur = Math.max(0, (t / 300) * 10);
    // Deep (25pts): ideal 15-20%
    const dp = (d / t) * 100;
    const ds = dp >= 15 && dp <= 20 ? 25 : dp > 20 && dp <= 25 ? 22 : dp >= 10 ? 10 + ((dp - 10) / 5) * 15 : (dp / 10) * 10;
    // REM (25pts): ideal 20-25%
    const rp = (r / t) * 100;
    const rs = rp >= 20 && rp <= 25 ? 25 : rp >= 15 ? 12 + ((rp - 15) / 5) * 13 : (rp / 15) * 12;
    // Awake penalty (15pts)
    const ap = (a / (t + a)) * 100;
    const as2 = ap > 3 ? Math.max(0, 15 - ((ap - 3) / 12) * 15) : 15;
    return Math.round(Math.min(100, dur + ds + rs + as2));
  })() : 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-white tracking-tight">Dashboard</h1>
        <p className="text-slate-500 text-sm mt-1">
          {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
        </p>
      </div>

      {/* Top Stat Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <StatCard
          icon={<TrendingDown size={18} className="text-white" />}
          label="Weight"
          value={`${latestWeight} lbs`}
          sub={`Goal: ${goals.goal_weight} lbs (${weightLeft > 0 ? weightLeft.toFixed(1) : '0'} to go)`}
          gradient="from-blue-500 to-indigo-600 shadow-blue-500/25"
        />
        <StatCard
          icon={<Target size={18} className="text-white" />}
          label="Protein Today"
          value={`${Math.round(today.total_protein)}g`}
          sub={`Goal: ${today.protein_goal}g`}
          gradient="from-emerald-500 to-teal-600 shadow-emerald-500/25"
        />
        <StatCard
          icon={<Dumbbell size={18} className="text-white" />}
          label="Workouts (30d)"
          value={`${monthlyWorkoutStats.total_workouts}`}
          sub={`${Math.round(monthlyWorkoutStats.total_minutes)} min total`}
          gradient="from-purple-500 to-violet-600 shadow-purple-500/25"
        />
        <StatCard
          icon={<Flame size={18} className="text-white" />}
          label="Burned Today"
          value={todayWorkouts.total_calories.toLocaleString()}
          sub={todayWorkouts.total_workouts > 0 ? `${todayWorkouts.total_workouts} workout(s), ${todayWorkouts.total_minutes} min` : 'No workouts yet today'}
          gradient="from-orange-500 to-red-500 shadow-orange-500/25"
        />
        <StatCard
          icon={<Moon size={18} className="text-white" />}
          label="Last Night"
          value={lastSleep ? `${sleepScore}/100` : '—'}
          sub={lastSleep ? `${formatSleepMin(lastSleep.total_minutes)} · Deep ${Math.round((lastSleep.deep_minutes / lastSleep.total_minutes) * 100)}% · REM ${Math.round((lastSleep.rem_minutes / lastSleep.total_minutes) * 100)}%` : 'No sleep data'}
          gradient="from-indigo-500 to-purple-600 shadow-indigo-500/25"
        />
      </div>

      {/* Progress Bars */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Weight Progress */}
        <div className="card">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold text-white text-sm">Weight Goal</h2>
            <span className="text-xs text-slate-500">
              {startWeight} → {goals.goal_weight} lbs
            </span>
          </div>
          <div className="w-full bg-white/[0.06] rounded-full h-3 overflow-hidden">
            <div
              className="h-3 rounded-full bg-gradient-to-r from-blue-500 to-cyan-400 transition-all duration-700 progress-shimmer relative"
              style={{ width: `${Math.max(2, progressPct)}%` }}
            />
          </div>
          <div className="flex justify-between text-xs text-slate-600 mt-1.5">
            <span>{totalLost > 0 ? `${totalLost.toFixed(1)} lbs lost` : 'Getting started'}</span>
            <span className={progressPct >= 100 ? 'text-blue-400 font-semibold' : ''}>
              {progressPct >= 100 ? 'Goal reached!' : `${Math.round(progressPct)}%`}
            </span>
          </div>
        </div>

        {/* Protein Progress */}
        <div className="card">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold text-white text-sm">Protein Today</h2>
            <span className="text-xs text-slate-500">
              {Math.round(today.total_protein)}g / {today.protein_goal}g
            </span>
          </div>
          <div className="w-full bg-white/[0.06] rounded-full h-3 overflow-hidden">
            <div
              className="h-3 rounded-full bg-gradient-to-r from-emerald-500 to-teal-400 transition-all duration-700 progress-shimmer relative"
              style={{ width: `${Math.min(100, today.protein_pct)}%` }}
            />
          </div>
          <div className="flex justify-between text-xs text-slate-600 mt-1.5">
            <span>0g</span>
            <span className={today.protein_pct >= 100 ? 'text-emerald-400 font-semibold' : ''}>
              {today.protein_pct >= 100 ? 'Goal reached!' : `${Math.round(today.protein_pct)}%`}
            </span>
          </div>
        </div>
      </div>

      {/* Weight Trend Chart */}
      <div className="card">
        <div className="flex items-center justify-between mb-5">
          <h2 className="font-semibold text-white">Weight Trend</h2>
          <div className="flex gap-1 bg-white/[0.04] rounded-lg p-0.5">
            {(['30', '90', 'all'] as const).map(r => (
              <button
                key={r}
                onClick={() => setWeightRange(r)}
                className={`px-3 py-1 rounded-md text-xs font-medium transition-all duration-200 ${
                  weightRange === r
                    ? 'bg-white/[0.1] text-white shadow-sm'
                    : 'text-slate-500 hover:text-white'
                }`}
              >
                {r === 'all' ? 'All' : `${r}d`}
              </button>
            ))}
          </div>
        </div>
        {weightChartData.length < 2 ? (
          <div className="h-48 flex items-center justify-center text-slate-600 text-sm">
            Not enough weight data yet.{' '}
            <button onClick={() => onNavigate('import')} className="text-emerald-400 ml-1 hover:underline">
              Import from Apple Health →
            </button>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={240}>
            <AreaChart data={weightChartData}>
              <defs>
                <linearGradient id="weightGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#10b981" stopOpacity={0.25} />
                  <stop offset="100%" stopColor="#10b981" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
              <XAxis
                dataKey="date" tick={{ fill: '#64748b', fontSize: 11 }} axisLine={false} tickLine={false}
                tickFormatter={formatDate}
                interval={Math.max(0, Math.floor(weightChartData.length / 6) - 1)}
              />
              <YAxis
                tick={{ fill: '#64748b', fontSize: 11 }} axisLine={false} tickLine={false}
                unit="lb" width={42}
                domain={['dataMin - 2', 'dataMax + 2']}
              />
              <Tooltip contentStyle={chartTooltipStyle} labelFormatter={formatDate}
                formatter={(v: number) => [`${v} lbs`, 'Weight']} />
              <ReferenceLine
                y={goals.goal_weight}
                stroke="#f59e0b" strokeDasharray="5 3" strokeWidth={1.5}
                label={{ value: `Goal: ${goals.goal_weight}`, fill: '#f59e0b', fontSize: 11, position: 'insideRight' }}
              />
              <Area type="monotone" dataKey="weight" stroke="#10b981" strokeWidth={2.5} fill="url(#weightGrad)" />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Weekly Protein */}
        <div className="card">
          <h2 className="font-semibold text-white mb-4">Weekly Protein</h2>
          {weekData.every(d => d.protein === 0) ? (
            <div className="h-44 flex items-center justify-center text-slate-600 text-sm">
              No nutrition data yet.{' '}
              <button onClick={() => onNavigate('nutrition')} className="text-emerald-400 ml-1 hover:underline">
                Log meals →
              </button>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={weekData} barCategoryGap="30%">
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                <XAxis dataKey="label" tick={{ fill: '#64748b', fontSize: 12 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: '#64748b', fontSize: 11 }} axisLine={false} tickLine={false} unit="g" width={35} />
                <Tooltip contentStyle={chartTooltipStyle} formatter={(v: number) => [`${Math.round(v)}g`, 'Protein']} />
                <ReferenceLine y={today.protein_goal} stroke="#10b981" strokeDasharray="4 2" strokeWidth={1.5} />
                <Bar dataKey="protein" radius={[6, 6, 0, 0]} opacity={0.9}>
                  {weekData.map((_, i) => (
                    <Cell key={i} fill={weekData[i].protein >= today.protein_goal ? '#10b981' : '#0d9488'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Weekly Workouts */}
        <div className="card">
          <h2 className="font-semibold text-white mb-4">Weekly Workouts</h2>
          {weekWorkoutData.every(d => d.minutes === 0) ? (
            <div className="h-44 flex items-center justify-center text-slate-600 text-sm">
              No workout data this week.{' '}
              <button onClick={() => onNavigate('import')} className="text-emerald-400 ml-1 hover:underline">
                Import from Apple Health →
              </button>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={weekWorkoutData} barCategoryGap="30%">
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                <XAxis dataKey="label" tick={{ fill: '#64748b', fontSize: 12 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: '#64748b', fontSize: 11 }} axisLine={false} tickLine={false} unit="m" width={35} />
                <Tooltip contentStyle={chartTooltipStyle}
                  formatter={(v: number, name: string) => [
                    name === 'minutes' ? `${v} min` : `${v} kcal`,
                    name === 'minutes' ? 'Duration' : 'Calories'
                  ]} />
                <Bar dataKey="minutes" radius={[6, 6, 0, 0]}>
                  {weekWorkoutData.map((_, i) => (
                    <Cell key={i} fill={weekWorkoutData[i].minutes > 0 ? '#8b5cf6' : 'rgba(139,92,246,0.2)'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Workout Types */}
        <div className="card">
          <h2 className="font-semibold text-white mb-4">Workout Types (12 Months)</h2>
          {workoutsByType.length === 0 ? (
            <div className="h-48 flex items-center justify-center text-slate-600 text-sm">
              No workout data yet.
            </div>
          ) : (
            <div className="flex items-center gap-6">
              <ResponsiveContainer width="50%" height={180}>
                <PieChart>
                  <Pie
                    data={workoutsByType}
                    dataKey="count"
                    nameKey="activity_type"
                    cx="50%" cy="50%"
                    outerRadius={70}
                    innerRadius={42}
                    strokeWidth={0}
                  >
                    {workoutsByType.map((_, i) => (
                      <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={chartTooltipStyle} formatter={(v: number) => [v, 'Sessions']} />
                </PieChart>
              </ResponsiveContainer>
              <div className="flex-1 space-y-2 max-h-44 overflow-y-auto">
                {workoutsByType.slice(0, 8).map((wt, i) => (
                  <div key={wt.activity_type} className="flex items-center gap-2.5 text-sm">
                    <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: PIE_COLORS[i % PIE_COLORS.length] }} />
                    <span className="text-slate-300 truncate flex-1">{wt.activity_type}</span>
                    <span className="text-slate-600 text-xs shrink-0 font-medium">{wt.count}x</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Fitness Summary */}
        <div className="card">
          <h2 className="font-semibold text-white mb-4">Fitness Summary</h2>
          <div className="grid grid-cols-2 gap-3">
            {[
              { icon: <Trophy size={20} />, value: workoutStreak, label: 'Day Streak', color: 'from-yellow-500 to-amber-600', textColor: 'text-yellow-400' },
              { icon: <Timer size={20} />, value: monthlyWorkoutStats.avg_duration || 0, label: 'Avg Min/Workout', color: 'from-purple-500 to-violet-600', textColor: 'text-purple-400' },
              { icon: <Activity size={20} />, value: workoutsByType.length, label: 'Activity Types', color: 'from-emerald-500 to-teal-600', textColor: 'text-emerald-400' },
              { icon: <Flame size={20} />, value: monthlyWorkoutStats.total_workouts > 0
                ? Math.round(monthlyWorkoutStats.total_calories / monthlyWorkoutStats.total_workouts) : 0,
                label: 'Avg Cal/Workout', color: 'from-orange-500 to-red-500', textColor: 'text-orange-400' },
            ].map(item => (
              <div key={item.label} className="bg-white/[0.03] rounded-xl p-4 text-center border border-white/[0.04] hover:border-white/[0.08] transition-colors">
                <div className={`w-9 h-9 mx-auto mb-2 rounded-lg bg-gradient-to-br ${item.color} flex items-center justify-center text-white shadow-lg`}>
                  {item.icon}
                </div>
                <p className={`text-2xl font-bold stat-value ${item.textColor}`}>{item.value}</p>
                <p className="text-slate-600 text-xs mt-0.5">{item.label}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Recent Workouts */}
      <div className="card">
        <h2 className="font-semibold text-white mb-4">Recent Workouts</h2>
        {recentWorkouts.length === 0 ? (
          <div className="text-center py-8 text-slate-600 text-sm">
            No workouts logged yet.{' '}
            <button onClick={() => onNavigate('import')} className="text-emerald-400 hover:underline">
              Import from Apple Health →
            </button>
          </div>
        ) : (
          <div className="space-y-2 max-h-80 overflow-y-auto">
            {recentWorkouts.slice(0, 15).map(w => (
              <div key={w.id} className="flex items-center justify-between bg-white/[0.03] rounded-xl px-4 py-3 border border-white/[0.04] hover:border-white/[0.08] transition-colors">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-gradient-to-br from-purple-500/20 to-violet-500/20 rounded-xl flex items-center justify-center border border-purple-500/20">
                    <Dumbbell size={17} className="text-purple-400" />
                  </div>
                  <div>
                    <p className="text-white text-sm font-medium">{w.activity_type}</p>
                    <p className="text-slate-600 text-xs">{formatDate(w.date)}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-white text-sm font-medium">{Math.round(w.duration_minutes)} min</p>
                  <p className="text-slate-600 text-xs">
                    {w.calories_burned > 0 && `${Math.round(w.calories_burned)} kcal`}
                    {w.distance && ` · ${w.distance} ${w.distance_unit || ''}`}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Today's Macros */}
      <div className="card">
        <h2 className="font-semibold text-white mb-4">Today's Macros</h2>
        <div className="grid grid-cols-4 gap-4">
          {[
            { label: 'Calories', value: today.total_calories, unit: 'kcal', color: 'text-orange-400' },
            { label: 'Protein',  value: today.total_protein,  unit: 'g',    color: 'text-emerald-400' },
            { label: 'Carbs',    value: today.total_carbs,    unit: 'g',    color: 'text-cyan-400' },
            { label: 'Fat',      value: today.total_fat,      unit: 'g',    color: 'text-yellow-400' },
          ].map(m => (
            <div key={m.label} className="text-center">
              <div className={`text-2xl font-bold stat-value ${m.color}`}>
                {Math.round(m.value)}{m.unit}
              </div>
              <div className="text-slate-600 text-sm">{m.label}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
