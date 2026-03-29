import { useEffect, useState } from 'react';
import { Sparkles, RefreshCw, Dumbbell, ShoppingCart, Lightbulb, ChevronDown, ChevronUp } from 'lucide-react';
import { api } from '../api';
import type { MealPlan, DayPlan, Meal } from '../types';

function MealCard({ label, meal }: { label: string; meal: Meal }) {
  return (
    <div className="bg-slate-700/50 rounded-xl p-3">
      <div className="flex items-start justify-between gap-2 mb-1.5">
        <div>
          <span className="text-slate-400 text-xs uppercase tracking-wide">{label}</span>
          <p className="text-white font-medium text-sm">{meal.name}</p>
        </div>
        <div className="text-right shrink-0">
          <p className="text-emerald-400 font-bold text-sm">{meal.protein}g</p>
          <p className="text-slate-500 text-xs">{meal.calories} kcal</p>
        </div>
      </div>
      <ul className="space-y-0.5">
        {meal.items.map((item, i) => (
          <li key={i} className="text-slate-400 text-xs flex gap-1.5">
            <span className="text-slate-600 mt-0.5">•</span>{item}
          </li>
        ))}
      </ul>
      {meal.prep && <p className="text-slate-600 text-xs mt-1.5">⏱ {meal.prep}</p>}
    </div>
  );
}

function DayCard({ day }: { day: DayPlan }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="card">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between"
      >
        <div className="flex items-center gap-3">
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold text-sm ${
            day.isWorkoutDay ? 'bg-emerald-500/20 text-emerald-400' : 'bg-slate-700 text-slate-400'
          }`}>
            {day.day.slice(0, 3)}
          </div>
          <div className="text-left">
            <p className="text-white font-semibold">{day.day}</p>
            <p className="text-slate-500 text-xs flex items-center gap-1.5">
              {day.isWorkoutDay && <><Dumbbell size={11} className="text-emerald-400" /> Workout Day ·{' '}</>}
              <span className="text-emerald-400">{day.totals.protein}g protein</span>
              {' · '}{day.totals.calories} kcal
            </p>
          </div>
        </div>
        {open ? <ChevronUp size={16} className="text-slate-500" /> : <ChevronDown size={16} className="text-slate-500" />}
      </button>

      {open && (
        <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
          <MealCard label="Breakfast" meal={day.meals.breakfast} />
          <MealCard label="Lunch"     meal={day.meals.lunch} />
          <MealCard label="Dinner"    meal={day.meals.dinner} />
          {day.meals.snacks.map((snack, i) => (
            <MealCard key={i} label={`Snack ${i + 1}`} meal={snack} />
          ))}
        </div>
      )}
    </div>
  );
}

export default function MealPlanner() {
  const [plan, setPlan]         = useState<MealPlan | null>(null);
  const [generatedAt, setGeneratedAt] = useState('');
  const [loading, setLoading]   = useState(true);
  const [generating, setGenerating] = useState(false);
  const [error, setError]       = useState('');
  const [showShopping, setShowShopping] = useState(false);

  useEffect(() => {
    api.getLatestMealPlan()
      .then(data => {
        if (data) { setPlan(data.plan); setGeneratedAt(data.generated_at); }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  async function generate() {
    setGenerating(true);
    setError('');
    try {
      const data = await api.generateMealPlan();
      setPlan(data.plan);
      setGeneratedAt(data.generated_at);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Generation failed');
    } finally {
      setGenerating(false);
    }
  }

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
    </div>
  );

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">AI Meal Planner</h1>
          <p className="text-slate-400 text-sm mt-0.5">
            Powered by Claude · High-protein plans for muscle gain & fat loss
          </p>
        </div>
        <button
          onClick={generate}
          disabled={generating}
          className="btn-primary flex items-center gap-2 shrink-0"
        >
          {generating
            ? <><RefreshCw size={15} className="animate-spin" /> Generating…</>
            : <><Sparkles size={15} /> {plan ? 'Regenerate' : 'Generate Plan'}</>}
        </button>
      </div>

      {error && (
        <div className="card border-red-500/30 bg-red-500/10">
          <p className="text-red-400 text-sm">⚠ {error}</p>
          <p className="text-slate-500 text-xs mt-1">
            Make sure your ANTHROPIC_API_KEY is set in <code className="text-slate-400">backend/.env</code>
          </p>
        </div>
      )}

      {generating && (
        <div className="card text-center py-12">
          <div className="w-10 h-10 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-white font-semibold">Claude is crafting your meal plan…</p>
          <p className="text-slate-400 text-sm mt-1">This takes about 15–30 seconds</p>
          <p className="text-slate-500 text-xs mt-1">Optimizing for {' '}
            <span className="text-emerald-400">high protein · body recomposition · workout schedule</span>
          </p>
        </div>
      )}

      {!generating && plan && (
        <>
          {generatedAt && (
            <p className="text-slate-500 text-xs">
              Generated{' '}
              {new Date(generatedAt + 'T00:00:00').toLocaleDateString('en-US', {
                month: 'long', day: 'numeric', year: 'numeric',
              })}
            </p>
          )}

          {/* 7-day plan */}
          <div className="space-y-3">
            {plan.days?.map((day, i) => <DayCard key={i} day={day} />)}
          </div>

          {/* Shopping list */}
          {plan.shopping_list?.length > 0 && (
            <div className="card">
              <button
                onClick={() => setShowShopping(s => !s)}
                className="w-full flex items-center justify-between"
              >
                <h2 className="font-semibold text-white flex items-center gap-2">
                  <ShoppingCart size={16} className="text-blue-400" /> Shopping List
                  <span className="text-slate-500 font-normal text-sm">({plan.shopping_list.length} items)</span>
                </h2>
                {showShopping ? <ChevronUp size={16} className="text-slate-500" /> : <ChevronDown size={16} className="text-slate-500" />}
              </button>

              {showShopping && (
                <div className="mt-4 grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {plan.shopping_list.map((item, i) => (
                    <div key={i} className="flex items-start gap-2 text-sm text-slate-300 bg-slate-700/40 rounded-lg px-3 py-2">
                      <span className="text-emerald-500 mt-0.5">✓</span>{item}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Tips */}
          {plan.tips?.length > 0 && (
            <div className="card">
              <h2 className="font-semibold text-white flex items-center gap-2 mb-3">
                <Lightbulb size={16} className="text-yellow-400" /> Pro Tips
              </h2>
              <ul className="space-y-2">
                {plan.tips.map((tip, i) => (
                  <li key={i} className="text-slate-300 text-sm flex gap-2.5">
                    <span className="text-yellow-400 shrink-0 mt-0.5">→</span>{tip}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </>
      )}

      {!generating && !plan && !error && (
        <div className="card text-center py-16">
          <Sparkles size={40} className="mx-auto mb-4 text-emerald-400 opacity-60" />
          <p className="text-white font-semibold text-lg">No meal plan yet</p>
          <p className="text-slate-400 text-sm mt-1 mb-5">
            Click "Generate Plan" to get a personalized 7-day high-protein meal plan
            tailored to your weight, goals, and workout schedule.
          </p>
          <button onClick={generate} disabled={generating} className="btn-primary mx-auto flex items-center gap-2">
            <Sparkles size={15} /> Generate My Plan
          </button>
        </div>
      )}
    </div>
  );
}
