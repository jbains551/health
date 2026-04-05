import express from 'express';
import cors from 'cors';
import Database from 'better-sqlite3';
import Anthropic from '@anthropic-ai/sdk';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import dotenv from 'dotenv';
import multer from 'multer';
import sax from 'sax';
import unzipper from 'unzipper';
import { createReadStream, readFileSync } from 'fs';
import { unlink, readFile } from 'fs/promises';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const pdfParse = require('pdf-parse');

dotenv.config();

const __dirname = dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors({ origin: ['http://localhost:5173', 'http://localhost:4173', 'http://187.77.86.51'] }));
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

  CREATE TABLE IF NOT EXISTS health_records (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    filename      TEXT NOT NULL,
    file_type     TEXT NOT NULL,
    record_date   TEXT,
    category      TEXT DEFAULT 'general',
    raw_text      TEXT,
    summary       TEXT,
    key_findings  TEXT,
    recommendations TEXT,
    lab_results   TEXT,
    analyzed_at   TEXT,
    created_at    TEXT DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS sleep_entries (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    date            TEXT NOT NULL,
    bedtime         TEXT,
    wake_time       TEXT,
    total_minutes   REAL DEFAULT 0,
    deep_minutes    REAL DEFAULT 0,
    rem_minutes     REAL DEFAULT 0,
    core_minutes    REAL DEFAULT 0,
    awake_minutes   REAL DEFAULT 0,
    source          TEXT DEFAULT 'manual',
    notes           TEXT,
    created_at      TEXT DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(date, bedtime)
  );

  CREATE TABLE IF NOT EXISTS workouts (
    id                  INTEGER PRIMARY KEY AUTOINCREMENT,
    date                TEXT NOT NULL,
    activity_type       TEXT NOT NULL,
    duration_minutes    REAL DEFAULT 0,
    calories_burned     REAL DEFAULT 0,
    distance            REAL,
    distance_unit       TEXT,
    source              TEXT DEFAULT 'manual',
    notes               TEXT,
    created_at          TEXT DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(date, activity_type, duration_minutes)
  );
`);

// Add lab_results column if missing (migration for existing DBs)
try {
  db.exec(`ALTER TABLE health_records ADD COLUMN lab_results TEXT`);
} catch {
  // column already exists
}

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

    // Keep goals.current_weight in sync with the latest weight entry
    const latest = db.prepare('SELECT weight FROM weights ORDER BY date DESC LIMIT 1').get();
    if (latest) {
      db.prepare('UPDATE goals SET current_weight = ?, updated_at = CURRENT_TIMESTAMP WHERE id = 1').run(latest.weight);
    }

    res.json({ id: result.lastInsertRowid, date, weight, notes });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

app.delete('/api/weight/:id', (req, res) => {
  db.prepare('DELETE FROM weights WHERE id = ?').run(req.params.id);

  // Keep goals.current_weight in sync with the latest weight entry
  const latest = db.prepare('SELECT weight FROM weights ORDER BY date DESC LIMIT 1').get();
  if (latest) {
    db.prepare('UPDATE goals SET current_weight = ?, updated_at = CURRENT_TIMESTAMP WHERE id = 1').run(latest.weight);
  }

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

  const allWeightHistory = db.prepare(`
    SELECT date, weight FROM weights ORDER BY date
  `).all();

  // Workout stats
  const recentWorkouts = db.prepare(`
    SELECT * FROM workouts
    WHERE date >= date('now', '-30 days')
    ORDER BY date DESC
  `).all();

  const weeklyWorkouts = db.prepare(`
    SELECT date, activity_type, duration_minutes, calories_burned
    FROM workouts
    WHERE date >= date('now', '-6 days')
    ORDER BY date
  `).all();

  const workoutsByType = db.prepare(`
    SELECT activity_type, COUNT(*) as count,
      ROUND(AVG(duration_minutes), 1) as avg_duration,
      ROUND(SUM(calories_burned)) as total_calories
    FROM workouts
    WHERE date >= date('now', '-12 months')
    GROUP BY activity_type
    ORDER BY count DESC
  `).all();

  const rawMonthlyStats = db.prepare(`
    SELECT
      COUNT(*) as total_workouts,
      COALESCE(ROUND(SUM(duration_minutes)), 0) as total_minutes,
      COALESCE(ROUND(SUM(calories_burned)), 0) as total_calories,
      COALESCE(ROUND(AVG(duration_minutes), 1), 0) as avg_duration
    FROM workouts
    WHERE date >= date('now', '-30 days')
  `).get();
  const monthlyWorkoutStats = {
    total_workouts: rawMonthlyStats?.total_workouts || 0,
    total_minutes: rawMonthlyStats?.total_minutes || 0,
    total_calories: rawMonthlyStats?.total_calories || 0,
    avg_duration: rawMonthlyStats?.avg_duration || 0,
  };

  const workoutStreak = (() => {
    const dates = db.prepare(`
      SELECT DISTINCT date FROM workouts ORDER BY date DESC
    `).all().map(r => r.date);
    if (dates.length === 0) return 0;
    let streak = 0;
    const d = new Date();
    for (let i = 0; i < 365; i++) {
      const dateStr = d.toISOString().split('T')[0];
      if (dates.includes(dateStr)) {
        streak++;
      } else if (i > 0) {
        break;
      }
      d.setDate(d.getDate() - 1);
    }
    return streak;
  })();

  const todayWorkoutStats = db.prepare(`
    SELECT
      COUNT(*) as total_workouts,
      COALESCE(ROUND(SUM(duration_minutes)), 0) as total_minutes,
      COALESCE(ROUND(SUM(calories_burned)), 0) as total_calories
    FROM workouts
    WHERE date = ?
  `).get(today);

  res.json({
    goals: { ...goals, current_weight: currentWeight },
    today: {
      ...todayNutrition,
      protein_goal: Math.round(proteinGoal),
      protein_pct: Math.min(100, (todayNutrition.total_protein / proteinGoal) * 100),
    },
    todayWorkouts: {
      total_workouts: todayWorkoutStats?.total_workouts || 0,
      total_minutes: todayWorkoutStats?.total_minutes || 0,
      total_calories: todayWorkoutStats?.total_calories || 0,
    },
    weeklyProtein,
    weightHistory,
    allWeightHistory,
    latestWeight: currentWeight,
    recentWorkouts,
    weeklyWorkouts,
    workoutsByType,
    monthlyWorkoutStats: monthlyWorkoutStats || { total_workouts: 0, total_minutes: 0, total_calories: 0, avg_duration: 0 },
    workoutStreak,
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
      model: 'claude-3-haiku-20240307',
      max_tokens: 4096,
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

// ─── Workouts ────────────────────────────────────────────────────────────────
app.get('/api/workouts', (req, res) => {
  const { date } = req.query;
  if (date) {
    res.json(db.prepare('SELECT * FROM workouts WHERE date = ? ORDER BY created_at').all(date));
  } else {
    res.json(db.prepare('SELECT * FROM workouts ORDER BY date DESC LIMIT 100').all());
  }
});

app.post('/api/workouts', (req, res) => {
  const { date, activity_type, duration_minutes, calories_burned, distance, distance_unit, notes } = req.body;
  try {
    const result = db.prepare(`
      INSERT OR REPLACE INTO workouts (date, activity_type, duration_minutes, calories_burned, distance, distance_unit, source, notes)
      VALUES (?, ?, ?, ?, ?, ?, 'manual', ?)
    `).run(date, activity_type, duration_minutes || 0, calories_burned || 0, distance || null, distance_unit || null, notes || null);
    res.json({ id: result.lastInsertRowid, ...req.body });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

app.delete('/api/workouts/:id', (req, res) => {
  db.prepare('DELETE FROM workouts WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

// ─── Sleep ──────────────────────────────────────────────────────────────────
app.get('/api/sleep', (req, res) => {
  const { days } = req.query;
  const limit = parseInt(days) || 30;
  res.json(db.prepare(`
    SELECT * FROM sleep_entries
    WHERE date >= date('now', '-' || ? || ' days')
    ORDER BY date DESC
  `).all(limit));
});

app.get('/api/sleep/stats', (req, res) => {
  const week = db.prepare(`
    SELECT
      COALESCE(ROUND(AVG(total_minutes), 0), 0) AS avg_total,
      COALESCE(ROUND(AVG(deep_minutes), 0), 0) AS avg_deep,
      COALESCE(ROUND(AVG(rem_minutes), 0), 0) AS avg_rem,
      COALESCE(ROUND(AVG(core_minutes), 0), 0) AS avg_core,
      COALESCE(ROUND(AVG(awake_minutes), 0), 0) AS avg_awake,
      COUNT(*) AS nights
    FROM sleep_entries WHERE date >= date('now', '-7 days')
  `).get();

  const month = db.prepare(`
    SELECT
      COALESCE(ROUND(AVG(total_minutes), 0), 0) AS avg_total,
      COALESCE(ROUND(AVG(deep_minutes), 0), 0) AS avg_deep,
      COALESCE(ROUND(AVG(rem_minutes), 0), 0) AS avg_rem,
      COALESCE(ROUND(AVG(core_minutes), 0), 0) AS avg_core,
      COALESCE(ROUND(AVG(awake_minutes), 0), 0) AS avg_awake,
      COUNT(*) AS nights
    FROM sleep_entries WHERE date >= date('now', '-30 days')
  `).get();

  const recent = db.prepare(`
    SELECT date, total_minutes, deep_minutes, rem_minutes, core_minutes, awake_minutes, bedtime, wake_time
    FROM sleep_entries
    WHERE date >= date('now', '-14 days')
    ORDER BY date
  `).all();

  const lastNight = db.prepare(`
    SELECT * FROM sleep_entries ORDER BY date DESC LIMIT 1
  `).get();

  res.json({ week, month, recent, lastNight });
});

app.post('/api/sleep', (req, res) => {
  const { date, bedtime, wake_time, total_minutes, deep_minutes, rem_minutes, core_minutes, awake_minutes, notes } = req.body;
  try {
    const result = db.prepare(`
      INSERT OR REPLACE INTO sleep_entries (date, bedtime, wake_time, total_minutes, deep_minutes, rem_minutes, core_minutes, awake_minutes, source, notes)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'manual', ?)
    `).run(date, bedtime || null, wake_time || null, total_minutes || 0, deep_minutes || 0, rem_minutes || 0, core_minutes || 0, awake_minutes || 0, notes || null);
    res.json({ id: result.lastInsertRowid, ...req.body });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

app.delete('/api/sleep/:id', (req, res) => {
  db.prepare('DELETE FROM sleep_entries WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

// ─── Apple Health Import ─────────────────────────────────────────────────────
const upload = multer({ dest: join(__dirname, 'uploads/'), limits: { fileSize: 500 * 1024 * 1024 } });

function cleanActivityType(raw) {
  return raw
    .replace('HKWorkoutActivityType', '')
    .replace(/([a-z])([A-Z])/g, '$1 $2');
}

function parseAppleHealthDate(dateStr) {
  // "2024-05-12 11:12:57 +0100" → "2024-05-12"
  return dateStr ? dateStr.split(' ')[0] : null;
}

function convertWeight(value, unit) {
  const num = parseFloat(value);
  if (unit === 'kg') return Math.round(num * 2.20462 * 10) / 10;
  return Math.round(num * 10) / 10; // already lbs
}

app.post('/api/import/apple-health', upload.single('file'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

  const filePath = req.file.path;
  const results = { weights: 0, workouts: 0, sleep: 0, skipped: 0, errors: [] };

  const insertWeight = db.prepare(
    'INSERT OR IGNORE INTO weights (date, weight, notes) VALUES (?, ?, ?)'
  );
  const insertWorkout = db.prepare(`
    INSERT OR IGNORE INTO workouts (date, activity_type, duration_minutes, calories_burned, distance, distance_unit, source)
    VALUES (?, ?, ?, ?, ?, ?, 'apple_health')
  `);

  const processInTransaction = db.transaction((weightRows, workoutRows, sleepMap) => {
    for (const w of weightRows) {
      const r = insertWeight.run(w.date, w.weight, 'Imported from Apple Health');
      if (r.changes > 0) results.weights++;
      else results.skipped++;
    }
    for (const w of workoutRows) {
      const r = insertWorkout.run(w.date, w.activity_type, w.duration_minutes, w.calories_burned, w.distance, w.distance_unit);
      if (r.changes > 0) results.workouts++;
      else results.skipped++;
    }
    // Deduplicate sleep intervals and aggregate per night
    const insertSleep = db.prepare(`
      INSERT OR REPLACE INTO sleep_entries (date, bedtime, wake_time, total_minutes, deep_minutes, rem_minutes, core_minutes, awake_minutes, source)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'apple_health')
    `);
    for (const [date, s] of sleepMap.entries()) {
      const intervals = s.intervals;
      if (!intervals || intervals.length === 0) continue;

      // Prefer Apple Watch data (has stages) over iPhone (usually just AsleepUnspecified)
      const sources = [...new Set(intervals.map(i => i.source))];
      const hasStages = intervals.some(i => ['deep', 'rem', 'core'].includes(i.stage));

      // If we have staged data, filter out unspecified "asleep" records from other sources
      let filtered = intervals;
      if (hasStages) {
        const stagedSources = [...new Set(intervals.filter(i => ['deep', 'rem', 'core'].includes(i.stage)).map(i => i.source))];
        // Keep only records from sources that provide stages, plus awake from any source
        filtered = intervals.filter(i =>
          stagedSources.includes(i.source) || i.stage === 'awake'
        );
      }

      // Deduplicate overlapping intervals per stage by merging
      const byStage = { deep: [], rem: [], core: [], asleep: [], awake: [] };
      for (const iv of filtered) {
        byStage[iv.stage].push({ start: iv.start, end: iv.end });
      }

      function mergeIntervals(ivs) {
        if (ivs.length === 0) return 0;
        ivs.sort((a, b) => a.start - b.start);
        let total = 0;
        let curStart = ivs[0].start, curEnd = ivs[0].end;
        for (let i = 1; i < ivs.length; i++) {
          if (ivs[i].start <= curEnd) {
            curEnd = Math.max(curEnd, ivs[i].end);
          } else {
            total += (curEnd - curStart) / 60000;
            curStart = ivs[i].start;
            curEnd = ivs[i].end;
          }
        }
        total += (curEnd - curStart) / 60000;
        return total;
      }

      const deep = mergeIntervals(byStage.deep);
      const rem = mergeIntervals(byStage.rem);
      const core = mergeIntervals(byStage.core);
      const asleep = mergeIntervals(byStage.asleep);
      const awake = mergeIntervals(byStage.awake);
      const totalSleep = deep + rem + core + asleep;
      const total = totalSleep + awake;

      if (total <= 0 || total > 840) continue; // skip if 0 or > 14 hours (bad data)

      // Find bedtime and wake time
      const allStarts = filtered.map(i => i.start);
      const allEnds = filtered.map(i => i.end);
      const bedtime = new Date(Math.min(...allStarts));
      const wakeTime = new Date(Math.max(...allEnds));
      const bedStr = bedtime.toTimeString().slice(0, 5);
      const wakeStr = wakeTime.toTimeString().slice(0, 5);

      const r2 = insertSleep.run(date, bedStr, wakeStr, Math.round(totalSleep), Math.round(deep), Math.round(rem), Math.round(core), Math.round(awake));
      if (r2.changes > 0) results.sleep++;
      else results.skipped++;
    }
  });

  function parseXmlStream(stream) {
    return new Promise((resolve, reject) => {
      const parser = sax.createStream(true, { trim: true });
      const weightRows = [];
      const workoutRows = [];
      // Aggregate sleep stages per night: key = date the sleep period ends (wake date)
      const sleepMap = new Map();

      parser.on('opentag', (node) => {
        if (node.name === 'Record' && node.attributes.type === 'HKQuantityTypeIdentifierBodyMass') {
          const date = parseAppleHealthDate(node.attributes.startDate);
          const weight = convertWeight(node.attributes.value, node.attributes.unit);
          if (date && weight) weightRows.push({ date, weight });
        }

        // Sleep analysis records — collect raw intervals for deduplication
        if (node.name === 'Record' && node.attributes.type === 'HKCategoryTypeIdentifierSleepAnalysis') {
          const startDate = node.attributes.startDate;
          const endDate = node.attributes.endDate;
          const value = node.attributes.value || '';
          const sourceName = node.attributes.sourceName || '';
          if (!startDate || !endDate) return;

          const start = new Date(startDate.replace(' +', '+').replace(' -', '-'));
          const end = new Date(endDate.replace(' +', '+').replace(' -', '-'));
          const minutes = (end - start) / 60000;
          if (minutes <= 0 || minutes > 1440) return;

          // Skip InBed records — they overlap with actual sleep stage records
          if (value.includes('InBed')) return;

          // Determine stage type
          let stage = 'asleep';
          if (value.includes('AsleepDeep')) stage = 'deep';
          else if (value.includes('AsleepREM')) stage = 'rem';
          else if (value.includes('AsleepCore')) stage = 'core';
          else if (value.includes('Awake')) stage = 'awake';

          // Group by night — use the date when you went to sleep
          // For sleep starting before 6pm, use that date; after 6pm, use next day (wake-up date)
          const sleepHour = start.getHours();
          let nightDate;
          if (sleepHour >= 18) {
            // Evening sleep — belongs to next day's "night"
            const next = new Date(start);
            next.setDate(next.getDate() + 1);
            nightDate = next.toISOString().split('T')[0];
          } else {
            nightDate = start.toISOString().split('T')[0];
          }

          if (!sleepMap.has(nightDate)) {
            sleepMap.set(nightDate, { intervals: [] });
          }
          sleepMap.get(nightDate).intervals.push({
            start: start.getTime(),
            end: end.getTime(),
            stage,
            source: sourceName,
            minutes,
          });
        }

        if (node.name === 'Workout') {
          const date = parseAppleHealthDate(node.attributes.startDate);
          const activityType = cleanActivityType(node.attributes.workoutActivityType || 'Other');
          const duration = parseFloat(node.attributes.duration) || 0;
          const durationUnit = node.attributes.durationUnit || 'min';
          const durationMinutes = durationUnit === 'min' ? duration : duration / 60;
          const calories = parseFloat(node.attributes.totalEnergyBurned) || 0;
          const distance = parseFloat(node.attributes.totalDistance) || null;
          const distanceUnit = node.attributes.totalDistanceUnit || null;

          if (date) {
            workoutRows.push({
              date,
              activity_type: activityType,
              duration_minutes: Math.round(durationMinutes * 10) / 10,
              calories_burned: Math.round(calories),
              distance: distance ? Math.round(distance * 100) / 100 : null,
              distance_unit: distanceUnit,
            });
          }
        }
      });

      parser.on('end', () => {
        processInTransaction(weightRows, workoutRows, sleepMap);
        resolve();
      });

      parser.on('error', (err) => {
        results.errors.push(err.message);
        parser._parser.resume();
      });

      stream.pipe(parser);
    });
  }

  try {
    const isZip = req.file.originalname.toLowerCase().endsWith('.zip');

    if (isZip) {
      const directory = await unzipper.Open.file(filePath);
      const exportFile = directory.files.find(f => f.path.endsWith('export.xml'));
      if (!exportFile) {
        await unlink(filePath);
        return res.status(400).json({ error: 'No export.xml found in ZIP file' });
      }
      await parseXmlStream(exportFile.stream());
    } else {
      await parseXmlStream(createReadStream(filePath));
    }

    // Keep goals.current_weight in sync after import
    const latestW = db.prepare('SELECT weight FROM weights ORDER BY date DESC LIMIT 1').get();
    if (latestW) {
      db.prepare('UPDATE goals SET current_weight = ?, updated_at = CURRENT_TIMESTAMP WHERE id = 1').run(latestW.weight);
    }

    await unlink(filePath);
    res.json(results);
  } catch (err) {
    console.error('Apple Health import error:', err);
    try { await unlink(filePath); } catch {}
    res.status(500).json({ error: err.message });
  }
});

// ─── Health Records ──────────────────────────────────────────────────────────
const recordUpload = multer({
  dest: join(__dirname, 'uploads/'),
  limits: { fileSize: 50 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = [
      'application/pdf',
      'image/jpeg', 'image/png', 'image/webp', 'image/gif',
      'text/plain', 'text/html', 'text/csv',
    ];
    if (allowed.includes(file.mimetype) || file.originalname.match(/\.(pdf|txt|csv|html|jpg|jpeg|png|webp|gif)$/i)) {
      cb(null, true);
    } else {
      cb(new Error('Unsupported file type. Upload PDF, image, or text files.'));
    }
  },
});

app.get('/api/health-records', (req, res) => {
  res.json(db.prepare('SELECT * FROM health_records ORDER BY created_at DESC').all());
});

app.get('/api/health-records/:id', (req, res) => {
  const record = db.prepare('SELECT * FROM health_records WHERE id = ?').get(req.params.id);
  if (!record) return res.status(404).json({ error: 'Record not found' });
  if (record.key_findings) record.key_findings = JSON.parse(record.key_findings);
  if (record.recommendations) record.recommendations = JSON.parse(record.recommendations);
  if (record.lab_results) record.lab_results = JSON.parse(record.lab_results);
  res.json(record);
});

app.delete('/api/health-records/:id', (req, res) => {
  db.prepare('DELETE FROM health_records WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

async function extractText(filePath, mimetype, originalname) {
  if (mimetype === 'application/pdf' || originalname.match(/\.pdf$/i)) {
    const buffer = await readFile(filePath);
    const data = await pdfParse(buffer);
    return data.text;
  }

  if (mimetype.startsWith('image/')) {
    return null; // will use vision API
  }

  // text/plain, text/html, text/csv
  const text = await readFile(filePath, 'utf-8');
  return text;
}

app.post('/api/health-records/upload', recordUpload.array('files', 10), async (req, res) => {
  if (!req.files || req.files.length === 0) {
    return res.status(400).json({ error: 'No files uploaded' });
  }

  const results = [];

  for (const file of req.files) {
    try {
      const text = await extractText(file.path, file.mimetype, file.originalname);
      const isImage = file.mimetype.startsWith('image/');

      const result = db.prepare(`
        INSERT INTO health_records (filename, file_type, raw_text, category)
        VALUES (?, ?, ?, 'pending')
      `).run(file.originalname, file.mimetype, text);

      const recordId = result.lastInsertRowid;

      // Build the AI analysis request
      const goals = db.prepare('SELECT * FROM goals WHERE id = 1').get();
      const latestWeight = db.prepare('SELECT weight FROM weights ORDER BY date DESC LIMIT 1').get();
      const currentWeight = latestWeight?.weight || goals.current_weight;

      const systemPrompt = `You are an experienced health analyst who explains medical records in clear, plain language. You provide thorough analysis especially for lab results — explaining what each test measures, whether values are normal/high/low, what abnormal values mean, and specific actionable steps to improve them through diet, exercise, supplements, or lifestyle changes.

Always note that you are an AI and this is not medical advice — the user should discuss findings with their healthcare provider.

Context about this patient:
- Current weight: ${currentWeight} lbs, goal: ${goals.goal_weight} lbs
- Fitness: High-intensity workouts 4x/week (Mon, Wed, Fri, Sat), 1 hour each
- Diet goal: ${Math.round(currentWeight * goals.protein_per_lb)}g protein/day for body recomposition
- Goal: Gain muscle while losing belly fat`;

      const analysisPrompt = `Analyze this health record thoroughly. Provide:

1. SUMMARY — A clear, plain-language overview of what this document contains (3-5 sentences). If it's lab work, mention the overall picture of the patient's health based on the results.

2. KEY FINDINGS — The most important data points, test results, diagnoses, or observations. For each finding, explain WHY it matters in plain language.

3. LAB RESULTS — If this document contains lab/blood work, extract EVERY test result into a structured list. For each result include:
   - test_name: The name of the test
   - value: The patient's result value (include units)
   - reference_range: The normal/reference range
   - status: "normal", "high", "low", or "critical"
   - explanation: What this test measures in plain language (1 sentence)
   - improvement: If abnormal, specific actionable advice to improve it (diet, exercise, supplements, lifestyle). If normal, tips to maintain it. Tailor advice to this patient's fitness goals.
   If this is NOT a lab result document, set lab_results to an empty array.

4. RECOMMENDATIONS — Detailed, actionable suggestions. Prioritize the most impactful changes. Consider their high-protein diet, intense workout schedule, and body recomposition goals. Include specific foods, supplements, or habits where relevant.

5. CATEGORY — classify as one of: lab_results, visit_notes, imaging, medication, immunization, vitals, referral, general

6. RECORD_DATE — if you can identify a date, provide it in YYYY-MM-DD format, otherwise null

Return ONLY valid JSON (no markdown, no extra text):
{
  "summary": "...",
  "key_findings": ["finding 1 with explanation", "finding 2 with explanation"],
  "lab_results": [
    {
      "test_name": "Glucose",
      "value": "95 mg/dL",
      "reference_range": "70-100 mg/dL",
      "status": "normal",
      "explanation": "Measures blood sugar levels after fasting, indicating how well your body processes glucose.",
      "improvement": "Your glucose is in a healthy range. Maintain it by continuing regular exercise and limiting refined carbs."
    }
  ],
  "recommendations": ["detailed recommendation 1", "detailed recommendation 2"],
  "category": "lab_results",
  "record_date": "2024-05-12"
}`;

      let messages;
      if (isImage) {
        const imageData = readFileSync(file.path).toString('base64');
        const mediaType = file.mimetype;
        messages = [{
          role: 'user',
          content: [
            { type: 'image', source: { type: 'base64', media_type: mediaType, data: imageData } },
            { type: 'text', text: analysisPrompt },
          ],
        }];
      } else {
        messages = [{
          role: 'user',
          content: `Here is the health record document content:\n\n---\n${text}\n---\n\n${analysisPrompt}`,
        }];
      }

      const message = await anthropic.messages.create({
        model: 'claude-3-haiku-20240307',
        max_tokens: 4096,
        system: systemPrompt,
        messages,
      });

      const textBlock = message.content.find(b => b.type === 'text');
      if (!textBlock) throw new Error('No text in AI response');

      const raw = textBlock.text.replace(/```json|```/g, '').trim();
      const jsonStart = raw.indexOf('{');
      const jsonEnd = raw.lastIndexOf('}');
      const analysis = JSON.parse(raw.slice(jsonStart, jsonEnd + 1));

      db.prepare(`
        UPDATE health_records
        SET summary = ?, key_findings = ?, recommendations = ?,
            lab_results = ?, category = ?, record_date = ?, analyzed_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).run(
        analysis.summary,
        JSON.stringify(analysis.key_findings),
        JSON.stringify(analysis.recommendations),
        JSON.stringify(analysis.lab_results || []),
        analysis.category || 'general',
        analysis.record_date || null,
        recordId
      );

      results.push({
        id: recordId,
        filename: file.originalname,
        summary: analysis.summary,
        key_findings: analysis.key_findings,
        recommendations: analysis.recommendations,
        lab_results: analysis.lab_results || [],
        category: analysis.category,
        record_date: analysis.record_date,
      });
    } catch (err) {
      console.error(`Error processing ${file.originalname}:`, err);
      results.push({
        filename: file.originalname,
        error: err.message,
      });
    } finally {
      try { await unlink(file.path); } catch {}
    }
  }

  res.json({ results });
});

// ─── Health Q&A (Ask AI) ────────────────────────────────────────────────────
app.post('/api/ask', async (req, res) => {
  const { question, history } = req.body;
  if (!question) return res.status(400).json({ error: 'No question provided' });

  // Gather user context for personalized answers
  const goals = db.prepare('SELECT * FROM goals WHERE id = 1').get();
  const latestWeight = db.prepare('SELECT weight FROM weights ORDER BY date DESC LIMIT 1').get();
  const currentWeight = latestWeight?.weight || goals.current_weight;
  const proteinGoal = Math.round(currentWeight * goals.protein_per_lb);

  const todayStr = new Date().toISOString().split('T')[0];
  const todayNutrition = db.prepare(`
    SELECT COALESCE(SUM(calories),0) AS cals, COALESCE(SUM(protein),0) AS protein,
           COALESCE(SUM(carbs),0) AS carbs, COALESCE(SUM(fat),0) AS fat
    FROM nutrition_logs WHERE date = ?
  `).get(todayStr);

  const recentWorkouts = db.prepare(`
    SELECT activity_type, duration_minutes, date FROM workouts
    ORDER BY date DESC LIMIT 10
  `).all();

  const systemPrompt = `You are a knowledgeable, friendly health and fitness assistant integrated into a personal health tracking app. You provide evidence-based advice tailored to the user's specific data and goals.

IMPORTANT: Always note that you are an AI assistant and your responses are not a substitute for professional medical advice. For serious health concerns, always recommend consulting a healthcare provider.

User profile:
- Current weight: ${currentWeight} lbs, Goal weight: ${goals.goal_weight} lbs
- Daily protein target: ${proteinGoal}g (${goals.protein_per_lb}g per lb bodyweight)
- Workout schedule: ${goals.workout_days} (high-intensity, 1 hour each)
- Goal: Body recomposition — gain muscle while losing belly fat
- Today's intake so far: ${Math.round(todayNutrition.cals)} cal, ${Math.round(todayNutrition.protein)}g protein, ${Math.round(todayNutrition.carbs)}g carbs, ${Math.round(todayNutrition.fat)}g fat
- Recent workouts: ${recentWorkouts.map(w => `${w.activity_type} (${Math.round(w.duration_minutes)} min) on ${w.date}`).join(', ') || 'none logged'}

Guidelines:
- Give specific, actionable advice personalized to the user's data above
- For nutrition questions, reference their protein/calorie targets
- For exercise questions, consider their existing workout schedule
- Keep answers concise but thorough — use bullet points for clarity
- When discussing supplements or dietary changes, mention both benefits and potential risks
- For medical symptoms or conditions, always recommend seeing a doctor while providing general educational information`;

  // Build messages with conversation history
  const messages = [];
  if (history && Array.isArray(history)) {
    for (const msg of history.slice(-10)) {
      messages.push({ role: msg.role, content: msg.content });
    }
  }
  messages.push({ role: 'user', content: question });

  try {
    const message = await anthropic.messages.create({
      model: 'claude-3-haiku-20240307',
      max_tokens: 2048,
      system: systemPrompt,
      messages,
    });

    const textBlock = message.content.find(b => b.type === 'text');
    if (!textBlock) throw new Error('No text in response');

    res.json({ answer: textBlock.text });
  } catch (err) {
    console.error('Health Q&A error:', err);
    res.status(500).json({ error: err.message });
  }
});

app.listen(PORT, () => console.log(`Health Tracker API → http://localhost:${PORT}`));
