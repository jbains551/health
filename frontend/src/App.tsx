import { useState } from 'react';
import { Activity, Weight, UtensilsCrossed, CalendarDays, Apple, Stethoscope, Settings, Heart, MessageCircle } from 'lucide-react';
import Dashboard from './components/Dashboard';
import WeightTracker from './components/WeightTracker';
import NutritionLog from './components/NutritionLog';
import MealPlanner from './components/MealPlanner';
import AppleHealthImport from './components/AppleHealthImport';
import HealthRecords from './components/HealthRecords';
import GoalsSettings from './components/GoalsSettings';
import HealthChat from './components/HealthChat';

type Tab = 'dashboard' | 'weight' | 'nutrition' | 'meals' | 'records' | 'ask' | 'import' | 'goals';

const tabs: { id: Tab; label: string; icon: React.ReactNode }[] = [
  { id: 'dashboard',  label: 'Dashboard',  icon: <Activity size={17} /> },
  { id: 'weight',     label: 'Weight',     icon: <Weight size={17} /> },
  { id: 'nutrition',  label: 'Nutrition',  icon: <UtensilsCrossed size={17} /> },
  { id: 'meals',      label: 'Meal Plans', icon: <CalendarDays size={17} /> },
  { id: 'records',    label: 'Records',    icon: <Stethoscope size={17} /> },
  { id: 'ask',        label: 'Ask AI',     icon: <MessageCircle size={17} /> },
  { id: 'import',     label: 'Import',     icon: <Apple size={17} /> },
  { id: 'goals',      label: 'Goals',      icon: <Settings size={17} /> },
];

export default function App() {
  const [active, setActive] = useState<Tab>('dashboard');

  return (
    <div className="min-h-screen">
      {/* Header */}
      <header className="sticky top-0 z-10 bg-[#0c0f1a]/80 backdrop-blur-2xl border-b border-white/[0.06]">
        <div className="max-w-6xl mx-auto px-5">
          <div className="h-16 flex items-center justify-between">
            {/* Logo */}
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 bg-gradient-to-br from-emerald-400 to-teal-500 rounded-xl flex items-center justify-center shadow-lg shadow-emerald-500/25">
                <Heart size={18} className="text-white" fill="white" />
              </div>
              <div>
                <span className="font-bold text-white text-[15px] tracking-tight">HealthTracker</span>
                <span className="hidden sm:inline text-[10px] text-emerald-400/70 font-medium ml-1.5 uppercase tracking-widest">Pro</span>
              </div>
            </div>

            {/* Nav */}
            <nav className="flex gap-0.5">
              {tabs.map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setActive(tab.id)}
                  className={`relative flex items-center gap-1.5 px-3 py-2 rounded-xl text-[13px] font-medium transition-all duration-200 ${
                    active === tab.id
                      ? 'text-emerald-400'
                      : 'text-slate-500 hover:text-white hover:bg-white/[0.04]'
                  }`}
                >
                  {active === tab.id && (
                    <div className="absolute inset-0 bg-emerald-500/10 rounded-xl border border-emerald-500/20" />
                  )}
                  <span className="relative">{tab.icon}</span>
                  <span className="relative hidden md:inline">{tab.label}</span>
                </button>
              ))}
            </nav>
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="max-w-6xl mx-auto px-5 py-8">
        {active === 'dashboard'  && <Dashboard onNavigate={(t) => setActive(t as Tab)} />}
        {active === 'weight'     && <WeightTracker />}
        {active === 'nutrition'  && <NutritionLog />}
        {active === 'meals'      && <MealPlanner />}
        {active === 'records'    && <HealthRecords />}
        {active === 'ask'        && <HealthChat />}
        {active === 'import'     && <AppleHealthImport onImportComplete={() => {}} />}
        {active === 'goals'      && <GoalsSettings />}
      </main>
    </div>
  );
}
