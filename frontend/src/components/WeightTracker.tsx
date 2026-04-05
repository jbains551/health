import { useEffect, useState } from 'react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, ReferenceLine,
} from 'recharts';
import { Plus, Trash2, TrendingDown, TrendingUp } from 'lucide-react';
import { api } from '../api';
import type { WeightEntry, Goals } from '../types';

function today() {
  return new Date().toISOString().split('T')[0];
}

function formatDate(d: string) {
  return new Date(d + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export default function WeightTracker() {
  const [entries, setEntries]   = useState<WeightEntry[]>([]);
  const [goals, setGoals]       = useState<Goals | null>(null);
  const [date, setDate]         = useState(today());
  const [weight, setWeight]     = useState('');
  const [notes, setNotes]       = useState('');
  const [saving, setSaving]     = useState(false);
  const [editGoals, setEditGoals] = useState(false);
  const [goalWeight, setGoalWeight] = useState('');

  useEffect(() => {
    Promise.all([api.getWeights(), api.getGoals()]).then(([w, g]) => {
      setEntries(w);
      setGoals(g);
      setGoalWeight(String(g.goal_weight));
    });
  }, []);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!weight) return;
    setSaving(true);
    try {
      const entry = await api.addWeight({ date, weight: parseFloat(weight), notes });
      setEntries(prev => [...prev.filter(e => e.date !== date), entry].sort((a, b) => a.date.localeCompare(b.date)));
      setWeight('');
      setNotes('');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: number) {
    await api.deleteWeight(id);
    setEntries(prev => prev.filter(e => e.id !== id));
  }

  async function handleGoalSave() {
    if (!goals) return;
    const updated = { ...goals, goal_weight: parseFloat(goalWeight) };
    await api.updateGoals(updated);
    setGoals(updated);
    setEditGoals(false);
  }

  const latest = entries.at(-1);
  const oldest = entries[0];
  const totalChange = latest && oldest ? latest.weight - oldest.weight : 0;
  const chartData = entries.slice(-30);

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Weight Tracker</h1>
          <p className="text-slate-400 text-sm mt-0.5">Log your daily weigh-ins</p>
        </div>
        {goals && (
          <div className="text-right">
            {editGoals ? (
              <div className="flex items-center gap-2">
                <input
                  type="number" value={goalWeight} onChange={e => setGoalWeight(e.target.value)}
                  className="input w-24 text-sm" placeholder="Goal lbs"
                />
                <button onClick={handleGoalSave} className="btn-primary text-sm py-1.5">Save</button>
                <button onClick={() => setEditGoals(false)} className="btn-secondary text-sm py-1.5">Cancel</button>
              </div>
            ) : (
              <button onClick={() => setEditGoals(true)} className="text-slate-400 hover:text-white text-sm">
                Goal: {goals.goal_weight} lbs <span className="text-slate-600">✏</span>
              </button>
            )}
          </div>
        )}
      </div>

      {/* Summary cards */}
      {latest && (
        <div className="grid grid-cols-3 gap-4">
          <div className="card text-center">
            <p className="text-slate-400 text-xs">Current</p>
            <p className="text-3xl font-bold text-white mt-1">{latest.weight}</p>
            <p className="text-slate-500 text-xs">lbs</p>
          </div>
          <div className="card text-center">
            <p className="text-slate-400 text-xs">Goal</p>
            <p className="text-3xl font-bold text-blue-400 mt-1">{goals?.goal_weight}</p>
            <p className="text-slate-500 text-xs">lbs</p>
          </div>
          <div className="card text-center">
            <p className="text-slate-400 text-xs">Total Change</p>
            <p className={`text-3xl font-bold mt-1 flex items-center justify-center gap-1 ${totalChange < 0 ? 'text-emerald-400' : 'text-red-400'}`}>
              {totalChange < 0 ? <TrendingDown size={20} /> : <TrendingUp size={20} />}
              {Math.abs(totalChange).toFixed(1)}
            </p>
            <p className="text-slate-500 text-xs">lbs since start</p>
          </div>
        </div>
      )}

      {/* Chart */}
      {chartData.length >= 2 && (
        <div className="card">
          <h2 className="font-semibold text-white mb-4">Progress Chart</h2>
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
              <XAxis
                dataKey="date" tick={{ fill: '#94a3b8', fontSize: 11 }}
                axisLine={false} tickLine={false}
                tickFormatter={formatDate}
                interval={Math.max(0, Math.floor(chartData.length / 5) - 1)}
              />
              <YAxis
                tick={{ fill: '#94a3b8', fontSize: 11 }} axisLine={false} tickLine={false}
                unit="lb" width={42}
                domain={['dataMin - 2', 'dataMax + 2']}
              />
              <Tooltip
                contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 8, color: '#e2e8f0' }}
                labelFormatter={formatDate}
                formatter={(v: number) => [`${v} lbs`, 'Weight']}
              />
              {goals && (
                <ReferenceLine
                  y={goals.goal_weight}
                  stroke="#3b82f6" strokeDasharray="5 3" strokeWidth={1.5}
                  label={{ value: 'Goal', fill: '#3b82f6', fontSize: 11, position: 'insideRight' }}
                />
              )}
              <Line
                type="monotone" dataKey="weight" stroke="#10b981" strokeWidth={2.5}
                dot={{ fill: '#10b981', r: 3 }} activeDot={{ r: 6 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Log form */}
      <div className="card">
        <h2 className="font-semibold text-white mb-4">Log Weight</h2>
        <form onSubmit={handleAdd} className="grid grid-cols-1 sm:grid-cols-4 gap-3">
          <div>
            <label className="label">Date</label>
            <input type="date" value={date} onChange={e => setDate(e.target.value)} className="input" />
          </div>
          <div>
            <label className="label">Weight (lbs)</label>
            <input
              type="number" step="0.1" min="50" max="500" required
              value={weight} onChange={e => setWeight(e.target.value)}
              className="input" placeholder="178.5"
            />
          </div>
          <div>
            <label className="label">Notes (optional)</label>
            <input
              type="text" value={notes} onChange={e => setNotes(e.target.value)}
              className="input" placeholder="After workout, etc."
            />
          </div>
          <div className="flex items-end">
            <button type="submit" disabled={saving || !weight} className="btn-primary w-full flex items-center justify-center gap-1.5">
              <Plus size={16} /> {saving ? 'Saving…' : 'Log Weight'}
            </button>
          </div>
        </form>
      </div>

      {/* History table */}
      <div className="card">
        <h2 className="font-semibold text-white mb-4">History</h2>
        {entries.length === 0 ? (
          <p className="text-slate-500 text-sm text-center py-8">No entries yet. Log your first weigh-in above!</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-slate-400 border-b border-slate-700">
                  <th className="text-left py-2 pr-4">Date</th>
                  <th className="text-right py-2 pr-4">Weight</th>
                  <th className="text-right py-2 pr-4">Change</th>
                  <th className="text-left py-2 pr-4">Notes</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {[...entries].reverse().map((e, i, arr) => {
                  const prev = arr[i + 1];
                  const diff = prev ? e.weight - prev.weight : 0;
                  return (
                    <tr key={e.id} className="border-b border-slate-700/50 hover:bg-slate-700/30 transition-colors">
                      <td className="py-2.5 pr-4 text-white">{formatDate(e.date)}</td>
                      <td className="py-2.5 pr-4 text-right font-semibold text-white">{e.weight} lbs</td>
                      <td className={`py-2.5 pr-4 text-right text-xs ${diff < 0 ? 'text-emerald-400' : diff > 0 ? 'text-red-400' : 'text-slate-500'}`}>
                        {prev ? (diff < 0 ? `▼ ${Math.abs(diff).toFixed(1)}` : diff > 0 ? `▲ ${diff.toFixed(1)}` : '—') : '—'}
                      </td>
                      <td className="py-2.5 pr-4 text-slate-400">{e.notes || '—'}</td>
                      <td>
                        <button onClick={() => handleDelete(e.id)} className="btn-danger">
                          <Trash2 size={13} />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
