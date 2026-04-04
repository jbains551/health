import { useEffect, useState } from 'react';
import { Save, Target, Dumbbell, Beef, RotateCcw } from 'lucide-react';
import { api } from '../api';
import type { Goals } from '../types';

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export default function GoalsSettings() {
  const [goals, setGoals] = useState<Goals | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  // Form state
  const [currentWeight, setCurrentWeight] = useState('');
  const [goalWeight, setGoalWeight] = useState('');
  const [proteinPerLb, setProteinPerLb] = useState('');
  const [workoutDays, setWorkoutDays] = useState<string[]>([]);

  useEffect(() => {
    api.getGoals().then(g => {
      setGoals(g);
      setCurrentWeight(String(g.current_weight));
      setGoalWeight(String(g.goal_weight));
      setProteinPerLb(String(g.protein_per_lb));
      setWorkoutDays(g.workout_days.split(',').map(d => d.trim()));
      setLoading(false);
    });
  }, []);

  function toggleDay(day: string) {
    setWorkoutDays(prev =>
      prev.includes(day) ? prev.filter(d => d !== day) : [...prev, day]
    );
    setSaved(false);
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setSaved(false);
    await api.updateGoals({
      current_weight: parseFloat(currentWeight),
      goal_weight: parseFloat(goalWeight),
      protein_per_lb: parseFloat(proteinPerLb),
      workout_days: workoutDays.join(','),
    });
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  }

  function handleReset() {
    if (!goals) return;
    setCurrentWeight(String(goals.current_weight));
    setGoalWeight(String(goals.goal_weight));
    setProteinPerLb(String(goals.protein_per_lb));
    setWorkoutDays(goals.workout_days.split(',').map(d => d.trim()));
    setSaved(false);
  }

  const proteinTarget = Math.round(parseFloat(currentWeight || '0') * parseFloat(proteinPerLb || '0'));
  const weightToLose = parseFloat(currentWeight || '0') - parseFloat(goalWeight || '0');

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
    </div>
  );

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-white flex items-center gap-2">
          <Target size={24} /> Goals & Settings
        </h1>
        <p className="text-slate-400 text-sm mt-0.5">
          Configure your weight, protein, and workout goals
        </p>
      </div>

      <form onSubmit={handleSave} className="space-y-5">
        {/* Weight Goals */}
        <div className="card">
          <h2 className="font-semibold text-white mb-4 flex items-center gap-2">
            <Target size={16} className="text-blue-400" /> Weight Goals
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="label">Current Weight (lbs)</label>
              <input
                type="number" step="0.1" min="50" max="500" required
                value={currentWeight}
                onChange={e => { setCurrentWeight(e.target.value); setSaved(false); }}
                className="input"
              />
            </div>
            <div>
              <label className="label">Goal Weight (lbs)</label>
              <input
                type="number" step="0.1" min="50" max="500" required
                value={goalWeight}
                onChange={e => { setGoalWeight(e.target.value); setSaved(false); }}
                className="input"
              />
            </div>
          </div>
          {weightToLose > 0 && (
            <p className="text-slate-500 text-sm mt-3">
              {weightToLose.toFixed(1)} lbs to lose to reach your goal
            </p>
          )}
        </div>

        {/* Protein Goal */}
        <div className="card">
          <h2 className="font-semibold text-white mb-4 flex items-center gap-2">
            <Beef size={16} className="text-emerald-400" /> Protein Goal
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="label">Protein per lb of bodyweight (g)</label>
              <input
                type="number" step="0.1" min="0.1" max="3" required
                value={proteinPerLb}
                onChange={e => { setProteinPerLb(e.target.value); setSaved(false); }}
                className="input"
              />
              <p className="text-slate-500 text-xs mt-1.5">
                Common targets: 0.8g (maintenance), 1.0g (muscle gain), 1.2g (aggressive recomp)
              </p>
            </div>
            <div className="flex items-center justify-center">
              <div className="text-center bg-slate-700/50 rounded-xl py-4 px-6">
                <p className="text-3xl font-bold text-emerald-400">{proteinTarget}g</p>
                <p className="text-slate-500 text-sm">Daily protein target</p>
              </div>
            </div>
          </div>
        </div>

        {/* Workout Schedule */}
        <div className="card">
          <h2 className="font-semibold text-white mb-4 flex items-center gap-2">
            <Dumbbell size={16} className="text-purple-400" /> Workout Schedule
          </h2>
          <p className="text-slate-400 text-sm mb-3">
            Select the days you train. This affects your meal plan calorie/carb recommendations.
          </p>
          <div className="flex gap-2">
            {DAYS.map(day => (
              <button
                key={day}
                type="button"
                onClick={() => toggleDay(day)}
                className={`flex-1 rounded-xl py-3 text-center text-sm font-medium transition-all ${
                  workoutDays.includes(day)
                    ? 'bg-emerald-500/20 text-emerald-400 ring-1 ring-emerald-500/40'
                    : 'bg-slate-700/50 text-slate-500 hover:bg-slate-700 hover:text-slate-300'
                }`}
              >
                {day}
              </button>
            ))}
          </div>
          <p className="text-slate-500 text-sm mt-3">
            {workoutDays.length} workout days per week
          </p>
        </div>

        {/* Summary */}
        <div className="card bg-slate-800/50">
          <h2 className="font-semibold text-white mb-3">Summary</h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="text-center">
              <p className="text-2xl font-bold text-blue-400">{currentWeight || '—'}</p>
              <p className="text-slate-500 text-xs">Current (lbs)</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-blue-400">{goalWeight || '—'}</p>
              <p className="text-slate-500 text-xs">Goal (lbs)</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-emerald-400">{proteinTarget || '—'}g</p>
              <p className="text-slate-500 text-xs">Daily Protein</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-purple-400">{workoutDays.length}x</p>
              <p className="text-slate-500 text-xs">Workouts/Week</p>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-3">
          <button
            type="submit"
            disabled={saving}
            className="btn-primary flex items-center gap-2"
          >
            <Save size={16} />
            {saving ? 'Saving...' : 'Save Goals'}
          </button>
          <button
            type="button"
            onClick={handleReset}
            className="btn-secondary flex items-center gap-2"
          >
            <RotateCcw size={16} /> Reset
          </button>
          {saved && (
            <span className="text-emerald-400 text-sm font-medium">
              Goals saved!
            </span>
          )}
        </div>
      </form>
    </div>
  );
}
