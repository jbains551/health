import { useEffect, useState } from 'react';
import { Plus, Trash2, Beef, Coffee, Sun, Moon, Apple } from 'lucide-react';
import { api } from '../api';
import type { NutritionEntry } from '../types';

type MealType = NutritionEntry['meal_type'];

const MEAL_TYPES: { id: MealType; label: string; icon: React.ReactNode }[] = [
  { id: 'breakfast', label: 'Breakfast', icon: <Coffee size={14} /> },
  { id: 'lunch',     label: 'Lunch',     icon: <Sun size={14} /> },
  { id: 'dinner',    label: 'Dinner',    icon: <Moon size={14} /> },
  { id: 'snack',     label: 'Snack',     icon: <Apple size={14} /> },
];

const MEAL_COLORS: Record<MealType, string> = {
  breakfast: 'text-yellow-400 bg-yellow-400/10',
  lunch:     'text-orange-400 bg-orange-400/10',
  dinner:    'text-blue-400  bg-blue-400/10',
  snack:     'text-purple-400 bg-purple-400/10',
};

function today() {
  return new Date().toISOString().split('T')[0];
}

function formatDate(d: string) {
  return new Date(d + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', weekday: 'short' });
}

const BLANK = {
  food_name: '', meal_type: 'lunch' as MealType,
  calories: '', protein: '', carbs: '', fat: '', notes: '',
};

export default function NutritionLog() {
  const [selectedDate, setSelectedDate] = useState(today());
  const [entries, setEntries]           = useState<NutritionEntry[]>([]);
  const [form, setForm]                 = useState({ ...BLANK });
  const [saving, setSaving]             = useState(false);
  const [proteinGoal, setProteinGoal]   = useState(178);

  useEffect(() => {
    api.getGoals().then(g => setProteinGoal(g.current_weight * g.protein_per_lb));
  }, []);

  useEffect(() => {
    api.getNutrition(selectedDate).then(setEntries);
  }, [selectedDate]);

  const totals = entries.reduce(
    (acc, e) => ({
      calories: acc.calories + e.calories,
      protein:  acc.protein  + e.protein,
      carbs:    acc.carbs    + e.carbs,
      fat:      acc.fat      + e.fat,
    }),
    { calories: 0, protein: 0, carbs: 0, fat: 0 }
  );

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!form.food_name) return;
    setSaving(true);
    try {
      const entry = await api.addNutrition({
        date: selectedDate,
        meal_type: form.meal_type,
        food_name: form.food_name,
        calories:  parseFloat(form.calories)  || 0,
        protein:   parseFloat(form.protein)   || 0,
        carbs:     parseFloat(form.carbs)     || 0,
        fat:       parseFloat(form.fat)       || 0,
        notes:     form.notes || undefined,
      });
      setEntries(prev => [...prev, entry]);
      setForm({ ...BLANK, meal_type: form.meal_type });
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: number) {
    await api.deleteNutrition(id);
    setEntries(prev => prev.filter(e => e.id !== id));
  }

  const grouped = MEAL_TYPES.map(mt => ({
    ...mt,
    items: entries.filter(e => e.meal_type === mt.id),
  }));

  const proteinPct = Math.min(100, (totals.protein / proteinGoal) * 100);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-white">Nutrition Log</h1>
        <p className="text-slate-400 text-sm mt-0.5">Track your protein and macros daily</p>
      </div>

      {/* Date selector */}
      <div className="flex items-center gap-3">
        <input
          type="date" value={selectedDate} onChange={e => setSelectedDate(e.target.value)}
          className="input max-w-xs"
        />
        <span className="text-slate-400 text-sm">{formatDate(selectedDate)}</span>
        {selectedDate !== today() && (
          <button onClick={() => setSelectedDate(today())} className="text-emerald-400 text-sm hover:underline">
            Today
          </button>
        )}
      </div>

      {/* Daily totals */}
      <div className="card">
        <div className="grid grid-cols-4 gap-4 mb-4">
          {[
            { label: 'Calories', value: Math.round(totals.calories), unit: 'kcal', color: 'orange' },
            { label: 'Protein',  value: Math.round(totals.protein),  unit: 'g',    color: 'emerald' },
            { label: 'Carbs',    value: Math.round(totals.carbs),    unit: 'g',    color: 'blue' },
            { label: 'Fat',      value: Math.round(totals.fat),      unit: 'g',    color: 'yellow' },
          ].map(m => (
            <div key={m.label} className="text-center">
              <p className={`text-2xl font-bold text-${m.color}-400`}>{m.value}</p>
              <p className="text-slate-500 text-xs">{m.label} ({m.unit})</p>
            </div>
          ))}
        </div>

        {/* Protein progress bar */}
        <div>
          <div className="flex justify-between text-xs text-slate-400 mb-1.5">
            <span>Protein Goal: {Math.round(totals.protein)}g / {Math.round(proteinGoal)}g</span>
            <span className={proteinPct >= 100 ? 'text-emerald-400' : ''}>{Math.round(proteinPct)}%</span>
          </div>
          <div className="w-full bg-white/[0.06] rounded-full h-2.5 overflow-hidden">
            <div
              className="h-2.5 rounded-full bg-gradient-to-r from-emerald-600 to-emerald-400 transition-all progress-shimmer relative"
              style={{ width: `${proteinPct}%` }}
            />
          </div>
        </div>
      </div>

      {/* Add food form */}
      <div className="card">
        <h2 className="font-semibold text-white mb-4 flex items-center gap-2">
          <Plus size={16} className="text-emerald-400" /> Log Food
        </h2>
        <form onSubmit={handleAdd} className="space-y-3">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="col-span-2">
              <label className="label">Food Name *</label>
              <input
                required value={form.food_name}
                onChange={e => setForm(f => ({ ...f, food_name: e.target.value }))}
                className="input" placeholder="e.g. Grilled Chicken Breast"
              />
            </div>
            <div>
              <label className="label">Meal</label>
              <select
                value={form.meal_type}
                onChange={e => setForm(f => ({ ...f, meal_type: e.target.value as MealType }))}
                className="input"
              >
                {MEAL_TYPES.map(m => <option key={m.id} value={m.id}>{m.label}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Calories</label>
              <input
                type="number" min="0" value={form.calories}
                onChange={e => setForm(f => ({ ...f, calories: e.target.value }))}
                className="input" placeholder="0"
              />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="label">Protein (g) *</label>
              <input
                type="number" min="0" step="0.1" value={form.protein}
                onChange={e => setForm(f => ({ ...f, protein: e.target.value }))}
                className="input" placeholder="0"
              />
            </div>
            <div>
              <label className="label">Carbs (g)</label>
              <input
                type="number" min="0" step="0.1" value={form.carbs}
                onChange={e => setForm(f => ({ ...f, carbs: e.target.value }))}
                className="input" placeholder="0"
              />
            </div>
            <div>
              <label className="label">Fat (g)</label>
              <input
                type="number" min="0" step="0.1" value={form.fat}
                onChange={e => setForm(f => ({ ...f, fat: e.target.value }))}
                className="input" placeholder="0"
              />
            </div>
          </div>
          <button type="submit" disabled={saving || !form.food_name} className="btn-primary">
            {saving ? 'Adding…' : 'Add Food'}
          </button>
        </form>
      </div>

      {/* Grouped meals */}
      <div className="space-y-3">
        {grouped.map(group => (
          group.items.length > 0 && (
            <div key={group.id} className="card">
              <h3 className={`font-semibold flex items-center gap-2 mb-3 ${MEAL_COLORS[group.id].split(' ')[0]}`}>
                <span className={`p-1.5 rounded-lg ${MEAL_COLORS[group.id]}`}>{group.icon}</span>
                {group.label}
                <span className="ml-auto text-slate-500 font-normal text-sm">
                  {Math.round(group.items.reduce((s, e) => s + e.protein, 0))}g protein
                  · {Math.round(group.items.reduce((s, e) => s + e.calories, 0))} kcal
                </span>
              </h3>
              <div className="space-y-2">
                {group.items.map(entry => (
                  <div key={entry.id} className="flex items-center justify-between bg-slate-700/50 rounded-xl px-3 py-2.5">
                    <div>
                      <p className="text-white text-sm font-medium">{entry.food_name}</p>
                      <p className="text-slate-500 text-xs mt-0.5">
                        <span className="text-emerald-400">{entry.protein}g protein</span>
                        {' · '}{entry.calories} kcal
                        {entry.carbs > 0 && ` · ${entry.carbs}g carbs`}
                        {entry.fat > 0 && ` · ${entry.fat}g fat`}
                      </p>
                    </div>
                    <button onClick={() => handleDelete(entry.id)} className="btn-danger ml-3">
                      <Trash2 size={13} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )
        ))}
        {entries.length === 0 && (
          <div className="card text-center py-10 text-slate-500">
            <Beef size={32} className="mx-auto mb-3 opacity-30" />
            No food logged for this day. Add your meals above!
          </div>
        )}
      </div>
    </div>
  );
}
