import express from 'express';
import cors from 'cors';
import Database from 'better-sqlite3';
import Anthropic from '@anthropic-ai/sdk';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import dotenv from 'dotenv';

dotenv.config();

const __dirname = dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors({ origin: ['http://localhost:5173', 'http://localhost:4173'] }));
app.use(express.json());

// ─── Database Setup ───────────────────────────────────────────────────────────
const db = new Database(join(__dirname, 'health.db'));
db.pragma('journal_mode = WAL');

db.exec(`
  CREATE TABLE IF NOT EXISTS weights (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    date        TEXT NOT NULL UNIQUE,
    weight      REAL NOT NULL,
    notes       TEXT,
    created_at  TEXT DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS nutrition_logs (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    date        TEXT NOT NULL,
    meal_type   TEXT NOT NULL,
    food_name   TEXT NOT NULL,
    calories    REAL DEFAULT 0,
    protein     REAL DEFAULT 0,
    carbs       REAL DEFAULT 0,
    fat         REAL DEFAULT 0,
    notes       TEXT,
    created_at  TEXT DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS goals (
    id              INTEGER PRIMARY KEY DEFAULT 1,
    current_weight  REAL DEFAULT 178,
    goal_weight     REAL DEFAULT 168,
    protein_per_lb  REAL DEFAULT 1.0,
    workout_days    TEXT DEFAULT 'Mon,Wed,Fri,Sat',
    updated_at      TEXT DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS meal_plans (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    date        TEXT NOT NULL,
    plan_data   TEXT NOT NULL,
    created_at  TEXT DEFAULT CURRENT_TIMESTAMP
  );
`);

// Seed default goals on first run
const existingGoals = db.prepare('SELECT id FROM goals WHERE id = 1').get();
if (!existingGoals) {
  db.prepare(`
    INSERT INTO goals (id, current_weight, goal_weight, protein_per_lb, workout_days)
    VALUES (1, 178, 168, 1.0, 'Mon,Wed,Fri,Sat')
  `).run();
}

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// ─── Goals ───────────────────────────────────────────────────────────────────
app.get('/api/goals', (req, res) => {
  res.json(db.prepare('SELECT * FROM goals WHERE id = 1').get());
});

app.put('/api/goals', (req, res) => {
  const { current_weight, goal_weight, protein_per_lb, workout_days } = req.body;
  db.prepare(`
    UPDATE goals
    SET current_weight = ?, goal_weight = ?, protein_per_lb = ?,
        workout_days = ?, updated_at = CURRENT_TIMESTAMP
    WHERE id = 1
  `).run(current_weight, goal_weight, protein_per_lb, workout_days);
  res.json({ success: true });
});

// ─── Weight ───────────────────────────────────────────────────────────────────
app.get('/api/weight', (req, res) => {
  res.json(db.prepare('SELECT * FROM weights ORDER BY date ASC').all());
});

app.post('/api/weight', (req, res) => {
  const { date, weight, notes } = req.body;
  try {
    const result = db.prepare(
      'INSERT OR REPLACE INTO weights (date, weight, notes) VALUES (?, ?, ?)'
    ).run(date, weight, notes || null);
    res.json({ id: result.lastInsertRowid, date, weight, notes });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

app.delete('/api/weight/:id', (req, res) => {
  db.prepare('DELETE FROM weights WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

// ─── Nutrition ────────────────────────────────────────────────────────────────
app.get('/api/nutrition', (req, res) => {
  const { date } = req.query;
  if (date) {
    res.json(db.prepare(
      'SELECT * FROM nutrition_logs WHERE date = ? ORDER BY created_at'
    ).all(date));
  } else {
    res.json(db.prepare(
      'SELECT * FROM nutrition_logs ORDER BY date DESC, created_at DESC LIMIT 100'
    ).all());
  }
});

app.post('/api/nutrition', (req, res) => {
  const { date, meal_type, food_name, calories, protein, carbs, fat, notes } = req.body;
  const result = db.prepare(`
    INSERT INTO nutrition_logs (date, meal_type, food_name, calories, protein, carbs, fat, notes)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(date, meal_type, food_name, calories || 0, protein || 0, carbs || 0, fat || 0, notes || null);
  res.json({ id: result.lastInsertRowid, ...req.body });
});

app.delete('/api/nutrition/:id', (req, res) => {
  db.prepare('DELETE FROM nutrition_logs WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

// ─── Stats (Dashboard) ────────────────────────────────────────────────────────
app.get('/api/stats', (req, res) => {
  const goals = db.prepare('SELECT * FROM goals WHERE id = 1').get();
  const today = new Date().toISOString().split('T')[0];

  const latestWeight = db.prepare(
    'SELECT weight FROM weights ORDER BY date DESC LIMIT 1'
  ).get();
  const currentWeight = latestWeight?.weight || goals.current_weight;
  const proteinGoal = currentWeight * goals.protein_per_lb;

  const todayNutrition = db.prepare(`
    SELECT
      COALESCE(SUM(calories), 0) AS total_calories,
      COALESCE(SUM(protein),  0) AS total_protein,
      COALESCE(SUM(carbs),    0) AS total_carbs,
      COALESCE(SUM(fat),      0) AS total_fat
    FROM nutrition_logs WHERE date = ?
  `).get(today);

  const weeklyProtein = db.prepare(`
    SELECT date, COALESCE(SUM(protein), 0) AS total_protein
    FROM nutrition_logs
    WHERE date >= date('now', '-6 days')
    GROUP BY date
    ORDER BY date
  `).all();

  const weightHistory = db.prepare(`
    SELECT date, weight
    FROM weights
    WHERE date >= date('now', '-30 days')
    ORDER BY date
  `).all();

  res.json({
    goals: { ...goals, current_weight: currentWeight },
    today: {
      ...todayNutrition,
      protein_goal: Math.round(proteinGoal),
      protein_pct: Math.min(100, (todayNutrition.total_protein / proteinGoal) * 100),
    },
    weeklyProtein,
    weightHistory,
    latestWeight: currentWeight,
  });
});

// ─── Meal Plans ───────────────────────────────────────────────────────────────
app.get('/api/mealplan/latest', (req, res) => {
  const plan = db.prepare(
    'SELECT * FROM meal_plans ORDER BY created_at DESC LIMIT 1'
  ).get();
  res.json(plan ? { plan: JSON.parse(plan.plan_data), generated_at: plan.date } : null);
});

app.post('/api/mealplan/generate', async (req, res) => {
  const goals = db.prepare('SELECT * FROM goals WHERE id = 1').get();
  const latestWeight = db.prepare(
    'SELECT weight FROM weights ORDER BY date DESC LIMIT 1'
  ).get();
  const currentWeight = latestWeight?.weight || goals.current_weight;
  const proteinGoal  = Math.round(currentWeight * goals.protein_per_lb);

  // Conservative body-recomposition calorie target
  const tdee          = Math.round(currentWeight * 14.5); // lb × 14.5 ≈ active TDEE estimate
  const targetCals    = tdee - 300;                       // slight deficit
  const workoutDays   = goals.workout_days;

  const system = `You are a sports nutritionist specializing in body recomposition — helping people gain muscle while losing fat simultaneously. Create practical, delicious, high-protein meal plans that real people will actually cook and enjoy.`;

  const prompt = `Create a 7-day meal plan for my body recomposition goals:

• Current weight: ${currentWeight} lbs
• Goal weight: ${goals.goal_weight} lbs
• Daily protein target: ${proteinGoal}g (${goals.protein_per_lb}g per lb of bodyweight)
• Daily calorie target: ~${targetCals} kcal
• High-intensity 1-hour workouts on: ${workoutDays}
• Goal: Gain lean muscle while losing belly fat

Guidelines:
- On workout days, add 20–30g extra carbs around training
- Vary protein sources: chicken, ground beef, salmon, tuna, eggs, Greek yogurt, cottage cheese, whey protein
- Keep meals practical (under 30 min prep for most)
- Include filling, satisfying foods so it's sustainable

Return ONLY valid JSON matching this exact schema (no markdown, no extra text):
{
  "days": [
    {
      "day": "Monday",
      "isWorkoutDay": true,
      "meals": {
        "breakfast": { "name": "...", "items": ["..."], "protein": 40, "calories": 450, "prep": "5 min" },
        "lunch":     { "name": "...", "items": ["..."], "protein": 55, "calories": 600, "prep": "15 min" },
        "dinner":    { "name": "...", "items": ["..."], "protein": 55, "calories": 700, "prep": "25 min" },
        "snacks":    [{ "name": "...", "items": ["..."], "protein": 30, "calories": 250, "prep": "2 min" }]
      },
      "totals": { "protein": 180, "calories": 2000 }
    }
  ],
  "shopping_list": ["1 lb chicken breast", "1 dozen eggs"],
  "tips": ["Pre-cook chicken on Sundays to save time during the week"]
}`;

  try {
    const message = await anthropic.messages.create({
      model: 'claude-opus-4-6',
      max_tokens: 8000,
      thinking: { type: 'adaptive' },
      system,
      messages: [{ role: 'user', content: prompt }],
    });

    const textBlock = message.content.find(b => b.type === 'text');
    if (!textBlock) throw new Error('No text in response');

    // Strip any accidental markdown code fences
    const raw = textBlock.text.replace(/```json|```/g, '').trim();
    const jsonStart = raw.indexOf('{');
    const jsonEnd   = raw.lastIndexOf('}');
    if (jsonStart === -1 || jsonEnd === -1) throw new Error('No JSON found in response');
    const planData = JSON.parse(raw.slice(jsonStart, jsonEnd + 1));

    const date = new Date().toISOString().split('T')[0];
    db.prepare('INSERT INTO meal_plans (date, plan_data) VALUES (?, ?)').run(
      date, JSON.stringify(planData)
    );

    res.json({ plan: planData, generated_at: date });
  } catch (err) {
    console.error('Meal plan generation error:', err);
    res.status(500).json({ error: err.message });
  }
});

app.listen(PORT, () => console.log(`Health Tracker API → http://localhost:${PORT}`));
