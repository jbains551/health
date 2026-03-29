import { useEffect, useState } from 'react';
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, ReferenceLine,
} from 'recharts';
import { TrendingDown, Zap, Target, Dumbbell } from 'lucide-react';
import { api } from '../api';
import type { DashboardStats } from '../types';

const WORKOUT_DAYS = ['Mon', 'Wed', 'Fri', 'Sat'];
const ALL_DAYS     = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

function formatDate(d: string) {
  return new Date(d + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function StatCard({
  icon, label, value, sub, color = 'emerald',
}: {
  icon: React.ReactNode; label: string; value: string; sub?: string; color?: string;
}) {
  const colors: Record<string, string> = {
    emerald: 'bg-emerald-500/10 text-emerald-400',
    blue: 'bg-blue-500/10 text-blue-400',
    orange: 'bg-orange-500/10 text-orange-400',
    purple: 'bg-purple-500/10 text-purple-400',
  };
  return (
    <div className="card flex items-start gap-4">
      <div className={`p-2.5 rounded-xl ${colors[color]}`}>{icon}</div>
      <div>
        <p className="text-slate-400 text-sm">{label}</p>
        <p className="text-2xl font-bold text-white mt-0.5">{value}</p>
        {sub && <p className="text-slate-500 text-xs mt-0.5">{sub}</p>}
      </div>
    </div>
  );
}

export default function Dashboard({ onNavigate }: { onNavigate: (tab: string) => void }) {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    api.getStats()
      .then(setStats)
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
    </div>
  );

  if (error) return (
    <div className="card text-center py-12">
      <p className="text-red-400 mb-2">⚠ Could not connect to backend</p>
      <p className="text-slate-500 text-sm">Make sure the backend server is running on port 3001</p>
      <p className="text-slate-600 text-xs mt-2 font-mono">cd backend && npm run dev</p>
    </div>
  );

  if (!stats) return null;

  const { goals, today, weeklyProtein, weightHistory, latestWeight } = stats;
  const weightLost = goals.current_weight - latestWeight;
  const weightLeft = latestWeight - goals.goal_weight;

  // Fill in missing days in weekly protein
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

  return (
    <div className="space-y-5">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white">Dashboard</h1>
        <p className="text-slate-400 text-sm mt-0.5">
          {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
        </p>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          icon={<TrendingDown size={20} />}
          label="Current Weight"
          value={`${latestWeight} lbs`}
          sub={`Goal: ${goals.goal_weight} lbs`}
          color="blue"
        />
        <StatCard
          icon={<Target size={20} />}
          label="Today's Protein"
          value={`${Math.round(today.total_protein)}g`}
          sub={`Goal: ${today.protein_goal}g`}
          color="emerald"
        />
        <StatCard
          icon={<Zap size={20} />}
          label="Today's Calories"
          value={today.total_calories.toLocaleString()}
          sub="kcal logged"
          color="orange"
        />
        <StatCard
          icon={<Dumbbell size={20} />}
          label="To Goal"
          value={`${weightLeft > 0 ? weightLeft.toFixed(1) : '0'} lbs`}
          sub={weightLost > 0 ? `${weightLost.toFixed(1)} lbs lost` : 'Keep going!'}
          color="purple"
        />
      </div>

      {/* Protein Progress */}
      <div className="card">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-semibold text-white">Today's Protein Progress</h2>
          <span className="text-sm text-slate-400">
            {Math.round(today.total_protein)}g / {today.protein_goal}g
          </span>
        </div>
        <div className="w-full bg-slate-700 rounded-full h-4 overflow-hidden">
          <div
            className="h-4 rounded-full bg-gradient-to-r from-emerald-600 to-emerald-400 transition-all duration-700"
            style={{ width: `${Math.min(100, today.protein_pct)}%` }}
          />
        </div>
        <div className="flex justify-between text-xs text-slate-500 mt-1.5">
          <span>0g</span>
          <span className={today.protein_pct >= 100 ? 'text-emerald-400 font-semibold' : ''}>
            {today.protein_pct >= 100 ? '🎉 Goal reached!' : `${Math.round(today.protein_pct)}% complete`}
          </span>
          <span>{today.protein_goal}g</span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Weekly Protein Chart */}
        <div className="card">
          <h2 className="font-semibold text-white mb-4">Weekly Protein (last 7 days)</h2>
          {weekData.every(d => d.protein === 0) ? (
            <div className="h-40 flex items-center justify-center text-slate-500 text-sm">
              No nutrition data yet.{' '}
              <button onClick={() => onNavigate('nutrition')} className="text-emerald-400 ml-1 hover:underline">
                Log your meals →
              </button>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={weekData} barCategoryGap="30%">
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                <XAxis dataKey="label" tick={{ fill: '#94a3b8', fontSize: 12 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: '#94a3b8', fontSize: 11 }} axisLine={false} tickLine={false} unit="g" width={35} />
                <Tooltip
                  contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 8 }}
                  labelStyle={{ color: '#94a3b8' }}
                  formatter={(v: number) => [`${Math.round(v)}g`, 'Protein']}
                />
                <ReferenceLine y={today.protein_goal} stroke="#10b981" strokeDasharray="4 2" strokeWidth={1.5} />
                <Bar dataKey="protein" fill="#10b981" radius={[4, 4, 0, 0]} opacity={0.85} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Weight Trend */}
        <div className="card">
          <h2 className="font-semibold text-white mb-4">Weight Trend (30 days)</h2>
          {weightHistory.length < 2 ? (
            <div className="h-40 flex items-center justify-center text-slate-500 text-sm">
              Log at least 2 weights to see a trend.{' '}
              <button onClick={() => onNavigate('weight')} className="text-emerald-400 ml-1 hover:underline">
                Log weight →
              </button>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={180}>
              <LineChart data={weightHistory}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                <XAxis
                  dataKey="date" tick={{ fill: '#94a3b8', fontSize: 11 }} axisLine={false} tickLine={false}
                  tickFormatter={formatDate}
                  interval={Math.floor(weightHistory.length / 4)}
                />
                <YAxis
                  tick={{ fill: '#94a3b8', fontSize: 11 }} axisLine={false} tickLine={false}
                  unit="lb" width={40}
                  domain={['dataMin - 2', 'dataMax + 2']}
                />
                <Tooltip
                  contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 8 }}
                  labelStyle={{ color: '#94a3b8' }}
                  labelFormatter={formatDate}
                  formatter={(v: number) => [`${v} lbs`, 'Weight']}
                />
                <ReferenceLine y={goals.goal_weight} stroke="#3b82f6" strokeDasharray="4 2" strokeWidth={1.5} label={{ value: 'Goal', fill: '#3b82f6', fontSize: 11 }} />
                <Line
                  type="monotone" dataKey="weight" stroke="#10b981" strokeWidth={2}
                  dot={{ fill: '#10b981', r: 3 }} activeDot={{ r: 5 }}
                />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* Workout Schedule */}
      <div className="card">
        <h2 className="font-semibold text-white mb-4">Workout Schedule</h2>
        <div className="flex gap-3">
          {ALL_DAYS.map(day => {
            const isWorkout = WORKOUT_DAYS.includes(day);
            const todayAbbr = new Date().toLocaleDateString('en-US', { weekday: 'short' }).slice(0, 3);
            const isToday = todayAbbr === day;
            return (
              <div
                key={day}
                className={`flex-1 rounded-xl py-3 text-center text-sm font-medium transition-all ${
                  isWorkout
                    ? isToday
                      ? 'bg-emerald-500 text-white ring-2 ring-emerald-400 ring-offset-2 ring-offset-slate-800'
                      : 'bg-emerald-500/20 text-emerald-400'
                    : isToday
                      ? 'bg-slate-700 text-white ring-2 ring-slate-500 ring-offset-2 ring-offset-slate-800'
                      : 'bg-slate-700/50 text-slate-500'
                }`}
              >
                <div>{day}</div>
                {isWorkout && <div className="text-xs mt-0.5 opacity-75">💪</div>}
              </div>
            );
          })}
        </div>
        <p className="text-slate-500 text-xs mt-3">
          High-intensity training · 4 days/week · 1 hour per session
        </p>
      </div>

      {/* Macros Today */}
      <div className="card">
        <h2 className="font-semibold text-white mb-4">Today's Macros</h2>
        <div className="grid grid-cols-3 gap-4">
          {[
            { label: 'Protein', value: today.total_protein, unit: 'g', color: 'emerald' },
            { label: 'Carbs',   value: today.total_carbs,   unit: 'g', color: 'blue' },
            { label: 'Fat',     value: today.total_fat,     unit: 'g', color: 'orange' },
          ].map(m => (
            <div key={m.label} className="text-center">
              <div className={`text-2xl font-bold text-${m.color}-400`}>
                {Math.round(m.value)}{m.unit}
              </div>
              <div className="text-slate-500 text-sm">{m.label}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
