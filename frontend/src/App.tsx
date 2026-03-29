import { useState } from 'react';
import { Activity, Weight, UtensilsCrossed, CalendarDays } from 'lucide-react';
import Dashboard from './components/Dashboard';
import WeightTracker from './components/WeightTracker';
import NutritionLog from './components/NutritionLog';
import MealPlanner from './components/MealPlanner';

type Tab = 'dashboard' | 'weight' | 'nutrition' | 'meals';

const tabs: { id: Tab; label: string; icon: React.ReactNode }[] = [
  { id: 'dashboard',  label: 'Dashboard',  icon: <Activity size={18} /> },
  { id: 'weight',     label: 'Weight',     icon: <Weight size={18} /> },
  { id: 'nutrition',  label: 'Nutrition',  icon: <UtensilsCrossed size={18} /> },
  { id: 'meals',      label: 'Meal Plans', icon: <CalendarDays size={18} /> },
];

export default function App() {
  const [active, setActive] = useState<Tab>('dashboard');

  return (
    <div className="min-h-screen bg-slate-900">
      {/* Header */}
      <header className="bg-slate-800/80 backdrop-blur border-b border-slate-700 sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 bg-emerald-500 rounded-lg flex items-center justify-center">
              <Activity size={15} className="text-white" />
            </div>
            <span className="font-bold text-white">HealthTracker</span>
          </div>

          <nav className="flex gap-1">
            {tabs.map(tab => (
              <button
                key={tab.id}
                onClick={() => setActive(tab.id)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                  active === tab.id
                    ? 'bg-emerald-500/20 text-emerald-400'
                    : 'text-slate-400 hover:text-white hover:bg-slate-700'
                }`}
              >
                {tab.icon}
                <span className="hidden sm:inline">{tab.label}</span>
              </button>
            ))}
          </nav>
        </div>
      </header>

      {/* Content */}
      <main className="max-w-5xl mx-auto px-4 py-6">
        {active === 'dashboard'  && <Dashboard onNavigate={setActive} />}
        {active === 'weight'     && <WeightTracker />}
        {active === 'nutrition'  && <NutritionLog />}
        {active === 'meals'      && <MealPlanner />}
      </main>
    </div>
  );
}
