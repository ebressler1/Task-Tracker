import { useEffect, useRef, useMemo, useState, useCallback } from "react";
import confetti from "canvas-confetti";
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { onAuthStateChanged, signInWithPopup, signOut } from "firebase/auth";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { auth, googleProvider, db } from "./firebase";

const STEEL_BLUE = "#769fb6";
const PACIFIC_CYAN = "#188fa7";
const MUTED_TEAL = "#9dbbae";
import "./App.css";

const todayString = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

const DEFAULT_CATEGORIES = [
  "Fitness",
  "Education",
  "Career/Work",
  "Personal/Life",
  "Chores",
  "Self-Improvement/Skills",
];


const defaultTasks = [
  {
    id: 1,
    name: "Workout",
    category: "Fitness",
    dailyGoal: "30 minutes",
    dailyPoints: 10,
    extraThreshold: "60 minutes",
    extraBonus: 5,
    weeklyGoal: 3,
    weeklyBonus: 20,
    active: true,
  },
  {
    id: 2,
    name: "Anki",
    category: "Education",
    dailyGoal: "100 reviews",
    dailyPoints: 8,
    extraThreshold: "150 reviews",
    extraBonus: 3,
    weeklyGoal: 6,
    weeklyBonus: 15,
    active: true,
  },
  {
    id: 3,
    name: "Case prep",
    category: "Career/Work",
    dailyGoal: "30 minutes",
    dailyPoints: 7,
    extraThreshold: "60 minutes",
    extraBonus: 3,
    weeklyGoal: 5,
    weeklyBonus: 15,
    active: true,
  },
  {
    id: 4,
    name: "Call Mom",
    category: "Personal/Life",
    dailyGoal: "1 call",
    dailyPoints: 4,
    extraThreshold: "2 calls",
    extraBonus: 2,
    weeklyGoal: 2,
    weeklyBonus: 8,
    active: true,
  },
  {
    id: 5,
    name: "Cat litter",
    category: "Chores",
    dailyGoal: "1 scoop",
    dailyPoints: 3,
    extraThreshold: "2 scoops",
    extraBonus: 1,
    weeklyGoal: 4,
    weeklyBonus: 6,
    active: true,
  },
  {
    id: 6,
    name: "Spanish",
    category: "Self-Improvement/Skills",
    dailyGoal: "20 minutes",
    dailyPoints: 6,
    extraThreshold: "40 minutes",
    extraBonus: 2,
    weeklyGoal: 5,
    weeklyBonus: 12,
    active: true,
  },
  {
    id: 7,
    name: "Laundry",
    category: "Chores",
    dailyGoal: "1 load",
    dailyPoints: 4,
    extraThreshold: "2 loads",
    extraBonus: 2,
    weeklyGoal: 2,
    weeklyBonus: 8,
    active: true,
  },
];

function getWeekStart(dateString) {
  const date = new Date(dateString + "T12:00:00");
  const day = date.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  date.setDate(date.getDate() + diff);
  return date.toISOString().slice(0, 10);
}

function getWeekDates(dateString) {
  const start = getWeekStart(dateString);
  const startDate = new Date(start + "T12:00:00");
  const dates = [];

  for (let i = 0; i < 7; i++) {
    const d = new Date(startDate);
    d.setDate(startDate.getDate() + i);
    dates.push(d.toISOString().slice(0, 10));
  }

  return dates;
}

function formatPercent(numerator, denominator) {
  if (!denominator) return "0%";
  return `${((numerator / denominator) * 100).toFixed(1)}%`;
}

function shortDateLabel(dateString) {
  const d = new Date(dateString + "T12:00:00");
  return d.toLocaleDateString(undefined, { weekday: "short" });
}

function weekLabelFromDate(dateString) {
  const d = new Date(dateString + "T12:00:00");
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function shiftDate(dateString, days) {
  const d = new Date(dateString + "T12:00:00");
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

function getWeekTotalPoints(activeTasks, tasks, logs, weekStart) {
  const dates = getWeekDates(weekStart);

  let total = 0;

  dates.forEach((date) => {
    const baseline = activeTasks.reduce((sum, task) => {
      const log = logs[date]?.[task.id] || { completed: false, extra: false };
      return sum + (log.completed ? task.dailyPoints : 0);
    }, 0);

    const extra = activeTasks.reduce((sum, task) => {
      const log = logs[date]?.[task.id] || { completed: false, extra: false };
      return sum + (log.completed && log.extra ? task.extraBonus : 0);
    }, 0);

    total += baseline + extra;
  });

  const weeklyAdjustment = activeTasks.reduce((sum, task) => {
    const completions = dates.filter((date) => {
      const log = logs[date]?.[task.id] || { completed: false, extra: false };
      return log.completed;
    }).length;

    if (completions >= task.weeklyGoal) return sum + task.weeklyBonus;
    return sum - task.weeklyBonus / 2;
  }, 0);

  return total + weeklyAdjustment;
}

function buildCumulativeWeekData(activeTasks, tasks, logs, weekStart) {
  const dates = getWeekDates(weekStart);
  let runningTotal = 0;

  return dates.map((date) => {
    const baseline = activeTasks.reduce((sum, task) => {
      const log = logs[date]?.[task.id] || { completed: false, extra: false };
      return sum + (log.completed ? task.dailyPoints : 0);
    }, 0);

    const extra = activeTasks.reduce((sum, task) => {
      const log = logs[date]?.[task.id] || { completed: false, extra: false };
      return sum + (log.completed && log.extra ? task.extraBonus : 0);
    }, 0);

    runningTotal += baseline + extra;

    return {
      day: shortDateLabel(date),
      cumulative: runningTotal,
    };
  });
}


// Levels require up to 5 pillars simultaneously:
//   lifetimePts  — total points ever earned (top: 100,000; 20,000 by level 10)
//   recentPts    — points in the last 90 days (top: 10,000)
//   greatWeeks   — lifetime count of Great-or-better weeks (starts at level 1)
//   greatPct     — % of past weeks that were Great-or-better (ignored until ≥2 tracked weeks)
//   perfectPct   — % of past weeks that were Perfect (only required at levels 18–20)
//
// A "Great Week": <=1 dropped task per category.
// An "Excellent Week": Great Week criteria, plus no non-exempt task done 0x.
// Exempt task: weeklyGoal===1 AND dailyPoints>20.
// Perfect weeks automatically count as Excellent and Great.
const LEVELS = [
  { level: 1,  name: "Newcomer",     lifetimePts: 0,       recentPts: 0,      greatWeeks: 0,   greatPct: 0,  perfectPct: 0  },
  { level: 2,  name: "Beginner",     lifetimePts: 200,     recentPts: 80,     greatWeeks: 1,   greatPct: 20, perfectPct: 0  },
  { level: 3,  name: "Learning",     lifetimePts: 600,     recentPts: 220,    greatWeeks: 2,   greatPct: 28, perfectPct: 0  },
  { level: 4,  name: "Developing",   lifetimePts: 1200,    recentPts: 450,    greatWeeks: 4,   greatPct: 35, perfectPct: 0  },
  { level: 5,  name: "Committed",    lifetimePts: 2500,    recentPts: 800,    greatWeeks: 6,   greatPct: 40, perfectPct: 0  },
  { level: 6,  name: "Consistent",   lifetimePts: 4500,    recentPts: 1300,   greatWeeks: 9,   greatPct: 45, perfectPct: 0  },
  { level: 7,  name: "Dedicated",    lifetimePts: 7000,    recentPts: 2000,   greatWeeks: 13,  greatPct: 50, perfectPct: 0  },
  { level: 8,  name: "Focused",      lifetimePts: 11000,   recentPts: 2900,   greatWeeks: 18,  greatPct: 54, perfectPct: 0  },
  { level: 9,  name: "Disciplined",  lifetimePts: 15500,   recentPts: 3800,   greatWeeks: 24,  greatPct: 57, perfectPct: 0  },
  { level: 10, name: "Driven",       lifetimePts: 20000,   recentPts: 4800,   greatWeeks: 31,  greatPct: 60, perfectPct: 0  },
  { level: 11, name: "Persistent",   lifetimePts: 27000,   recentPts: 5700,   greatWeeks: 39,  greatPct: 63, perfectPct: 0  },
  { level: 12, name: "Resilient",    lifetimePts: 35000,   recentPts: 6500,   greatWeeks: 48,  greatPct: 65, perfectPct: 0  },
  { level: 13, name: "Seasoned",     lifetimePts: 44000,   recentPts: 7200,   greatWeeks: 57,  greatPct: 67, perfectPct: 0  },
  { level: 14, name: "Accomplished", lifetimePts: 54000,   recentPts: 7800,   greatWeeks: 66,  greatPct: 69, perfectPct: 0  },
  { level: 15, name: "Expert",       lifetimePts: 63000,   recentPts: 8300,   greatWeeks: 74,  greatPct: 71, perfectPct: 0  },
  { level: 16, name: "Master",       lifetimePts: 72000,   recentPts: 8700,   greatWeeks: 81,  greatPct: 73, perfectPct: 0  },
  { level: 17, name: "Elite",        lifetimePts: 80000,   recentPts: 9100,   greatWeeks: 87,  greatPct: 75, perfectPct: 0  },
  { level: 18, name: "Champion",     lifetimePts: 87000,   recentPts: 9400,   greatWeeks: 92,  greatPct: 78, perfectPct: 50 },
  { level: 19, name: "Legend",       lifetimePts: 94000,   recentPts: 9700,   greatWeeks: 96,  greatPct: 80, perfectPct: 65 },
  { level: 20, name: "Transcendent", lifetimePts: 100000,  recentPts: 10000,  greatWeeks: 100, greatPct: 82, perfectPct: 80 },
];

const BADGES = [
  { id: "first_task",   icon: "🎯", name: "First Step",        desc: "Complete your first task"                  },
  { id: "tasks_10",     icon: "✅", name: "Getting Started",    desc: "Complete 10 tasks"                        },
  { id: "tasks_50",     icon: "📋", name: "Checklist Champ",    desc: "Complete 50 tasks"                        },
  { id: "tasks_100",    icon: "🧱", name: "Habit Builder",      desc: "Complete 100 tasks"                       },
  { id: "tasks_500",    icon: "🏗️", name: "Foundation Set",    desc: "Complete 500 tasks"                       },
  { id: "tasks_1000",   icon: "🏛️", name: "Monument Maker",    desc: "Complete 1,000 tasks"                     },
  { id: "streak_7",     icon: "📈", name: "On a Roll",         desc: "7-day streak on any task"                  },
  { id: "streak_14",    icon: "🔁", name: "Two Week Lock",     desc: "14-day streak on any task"                 },
  { id: "streak_30",    icon: "💪", name: "Iron Discipline",   desc: "30-day streak on any task"                 },
  { id: "streak_60",    icon: "🏋️", name: "Sixty Strong",      desc: "60-day streak on any task"                 },
  { id: "streak_90",    icon: "🔩", name: "Iron Will",         desc: "90-day streak on any task"                 },
  { id: "streak_180",   icon: "🧭", name: "Half-Year Hold",    desc: "180-day streak on any task"                },
  { id: "streak_365",   icon: "🏆", name: "Year Unbroken",     desc: "365-day streak on any task"                },
  { id: "activity_7",   icon: "🗓️", name: "Daily Motion",      desc: "Complete any task 7 days in a row"         },
  { id: "activity_30",  icon: "📆", name: "Month in Motion",   desc: "Complete any task 30 days in a row"        },
  { id: "pts_100",      icon: "💯", name: "Century Club",      desc: "Earn 100 lifetime points"                  },
  { id: "pts_500",      icon: "⚡", name: "Point Collector",   desc: "Earn 500 lifetime points"                  },
  { id: "pts_1000",     icon: "💥", name: "Four Figures",      desc: "Earn 1,000 lifetime points"                },
  { id: "pts_2000",     icon: "🔥", name: "Point Machine",     desc: "Earn 2,000 lifetime points"                },
  { id: "pts_5000",     icon: "🚀", name: "Lift Off",          desc: "Earn 5,000 lifetime points"                },
  { id: "pts_10000",    icon: "💎", name: "Point Master",      desc: "Earn 10,000 lifetime points"               },
  { id: "pts_25000",    icon: "🏦", name: "Point Fortune",     desc: "Earn 25,000 lifetime points"               },
  { id: "pts_50000",    icon: "🌠", name: "Meteoric",          desc: "Earn 50,000 lifetime points"               },
  { id: "pts_100000",   icon: "🌌", name: "Six-Figure Score",  desc: "Earn 100,000 lifetime points"              },
  { id: "great_week",   icon: "👍", name: "Great Start",       desc: "Complete one Great Week"                   },
  { id: "great_4w",     icon: "📘", name: "Great Month",       desc: "Complete 4 Great Weeks"                    },
  { id: "great_13w",    icon: "📚", name: "Great Quarter",     desc: "Complete 13 Great Weeks"                   },
  { id: "great_26w",    icon: "🧮", name: "Great Half",        desc: "Complete 26 Great Weeks"                   },
  { id: "great_52w",    icon: "🗂️", name: "Great Year",        desc: "Complete 52 Great Weeks"                   },
  { id: "great_100w",   icon: "🪙", name: "Great Century",     desc: "Complete 100 Great Weeks"                  },
  { id: "excellent_week", icon: "🏵️", name: "Excellent Start", desc: "Complete one Excellent Week"               },
  { id: "excellent_4w", icon: "🎖️", name: "Excellent Month",   desc: "Complete 4 Excellent Weeks"                },
  { id: "excellent_13w",icon: "🏅", name: "Excellent Quarter", desc: "Complete 13 Excellent Weeks"               },
  { id: "excellent_26w",icon: "🥇", name: "Excellent Half",    desc: "Complete 26 Excellent Weeks"               },
  { id: "excellent_52w",icon: "💫", name: "Excellent Year",    desc: "Complete 52 Excellent Weeks"               },
  { id: "perfect_week", icon: "⭐", name: "Week Warrior",      desc: "Complete one perfect baseline week"        },
  { id: "perfect_4w",   icon: "🌟", name: "Monthly Momentum",  desc: "4 perfect baseline weeks"                  },
  { id: "perfect_13w",  icon: "📅", name: "Quarter Strong",    desc: "13 perfect baseline weeks"                 },
  { id: "perfect_26w",  icon: "🗓️", name: "Half Year Hero",   desc: "26 perfect baseline weeks"                 },
  { id: "perfect_52w",  icon: "👑", name: "Full Year",         desc: "52 perfect baseline weeks"                 },
  { id: "perfect_100w", icon: "🔱", name: "Perfect Century",   desc: "100 perfect baseline weeks"                },
  { id: "all_tasks_day",icon: "✨", name: "Full House",        desc: "Complete every active task in one day"     },
  { id: "all_tasks_7",  icon: "💡", name: "Full Week Energy",  desc: "Complete every active task on 7 days"      },
  { id: "all_tasks_30", icon: "🔆", name: "Thirty Full Days",  desc: "Complete every active task on 30 days"     },
  { id: "bonus_10",     icon: "🎁", name: "Bonus Hunter",      desc: "Earn bonus points 10 times"                },
  { id: "bonus_50",     icon: "💰", name: "Bonus Banker",      desc: "Earn bonus points 50 times"                },
  { id: "bonus_100",    icon: "📈", name: "Bonus Engine",      desc: "Earn bonus points 100 times"               },
  { id: "bonus_500",    icon: "💹", name: "Bonus Tycoon",      desc: "Earn bonus points 500 times"               },
  { id: "freeze_used",  icon: "🛡️", name: "Grace Day",        desc: "Use a streak freeze for the first time"    },
  { id: "daily_perfect_7", icon: "🔷", name: "Perfect Weekline", desc: "7-day daily perfect streak"              },
  { id: "daily_perfect_30", icon: "🔶", name: "Perfect Monthline", desc: "30-day daily perfect streak"           },
  { id: "level_5",      icon: "🎚️", name: "Committed Climber", desc: "Reach level 5"                             },
  { id: "level_10",     icon: "🏅", name: "Halfway There",     desc: "Reach level 10"                            },
  { id: "level_15",     icon: "🏵️", name: "Upper Tier",        desc: "Reach level 15"                            },
  { id: "level_20",     icon: "🌈", name: "Transcendent",      desc: "Reach max level 20"                        },
];

function App() {
  const [user, setUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [dataLoading, setDataLoading] = useState(false);
  const dataLoaded = useRef(false);

  const [page, setPage] = useState("activities");
  const [theme, setTheme] = useState("light");
  const [selectedDate, setSelectedDate] = useState(todayString());
  const [tasks, setTasks] = useState([]);
  const [logs, setLogs] = useState({});
  const [editingTaskId, setEditingTaskId] = useState(null);
  const [showForm, setShowForm] = useState(false);

  const [customCategories, setCustomCategories] = useState([]);
  const [showCustomCategoryInput, setShowCustomCategoryInput] = useState(false);
  const [newCategory, setNewCategory] = useState("");

  const [earnedBadges, setEarnedBadges] = useState({});
  const [streakFreezes, setStreakFreezes] = useState(0);
  const [usedFreezes, setUsedFreezes] = useState({});
  const [awardedFreezeWeeks, setAwardedFreezeWeeks] = useState([]);
  const [personalRecords, setPersonalRecords] = useState({ bestDayPoints: 0, bestWeekPoints: 0, longestStreak: 0 });
  const [completingTaskId, setCompletingTaskId] = useState(null);
  const [completingPoints, setCompletingPoints] = useState(0);
  const [weekInfoVisible, setWeekInfoVisible] = useState(null);
  const [selectedTaskId, setSelectedTaskId] = useState(null);
  const [longTermIncrements, setLongTermIncrements] = useState({});
  const [formError, setFormError] = useState("");


  const emptyForm = {
    name: "",
    category: "",
    dailyGoal: "",
    dailyPoints: "",
    extraThreshold: "",
    extraBonus: "",
    weeklyGoal: "",
    weeklyBonus: "",
    type: "",
    targetCount: "",
    currentCount: "",
    unitLabel: "",
    reward: "",
  };

  const [form, setForm] = useState(emptyForm);

  // Auth state listener
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      setUser(firebaseUser);
      setAuthLoading(false);
      if (!firebaseUser) dataLoaded.current = false;
    });
    return unsubscribe;
  }, []);

  // Load data from Firestore when user logs in
  useEffect(() => {
    if (!user) return;
    setDataLoading(true);
    const load = async () => {
      const snap = await getDoc(doc(db, "users", user.uid));
      if (snap.exists()) {
        const data = snap.data();
        if (data.tasks) {
          setTasks(data.tasks.map((task) => ({
            id: task.id ?? Date.now() + Math.random(),
            name: task.name ?? "",
            category: task.category ?? "",
            dailyGoal: task.dailyGoal ?? "",
            dailyPoints: task.dailyPoints ?? 0,
            extraThreshold: task.extraThreshold ?? "",
            extraBonus: task.extraBonus ?? 0,
            weeklyGoal: task.weeklyGoal ?? 0,
            weeklyBonus: task.weeklyBonus ?? 0,
            type: task.type ?? "weekly",
            targetCount: task.targetCount ?? 0,
            currentCount: task.currentCount ?? 0,
            unitLabel: task.unitLabel ?? "",
            reward: task.reward ?? "",
            active: task.active ?? true,
          })));
        } else {
          setTasks(defaultTasks);
        }
        if (data.logs) setLogs(data.logs);
        if (data.customCategories) setCustomCategories(data.customCategories);
        if (data.theme) setTheme(data.theme);
        if (data.earnedBadges) setEarnedBadges(data.earnedBadges);
        if (data.streakFreezes != null) setStreakFreezes(data.streakFreezes);
        if (data.usedFreezes) setUsedFreezes(data.usedFreezes);
        if (data.awardedFreezeWeeks) setAwardedFreezeWeeks(data.awardedFreezeWeeks);
        if (data.personalRecords) setPersonalRecords(data.personalRecords);
      } else {
        setTasks(defaultTasks);
      }
      dataLoaded.current = true;
      setDataLoading(false);
    };
    load();
  }, [user]);

  // Apply theme class
  useEffect(() => {
    document.body.classList.remove("theme-light", "theme-dark");
    document.body.classList.add(`theme-${theme}`);
  }, [theme]);

  // Save to Firestore on changes (only after initial load)
  useEffect(() => {
    if (!user || !dataLoaded.current) return;
    setDoc(doc(db, "users", user.uid), { tasks }, { merge: true });
  }, [tasks]);

  useEffect(() => {
    if (!user || !dataLoaded.current) return;
    setDoc(doc(db, "users", user.uid), { logs }, { merge: true });
  }, [logs]);

  useEffect(() => {
    if (!user || !dataLoaded.current) return;
    setDoc(doc(db, "users", user.uid), { customCategories }, { merge: true });
  }, [customCategories]);

  useEffect(() => {
    if (!user || !dataLoaded.current) return;
    setDoc(doc(db, "users", user.uid), { theme }, { merge: true });
  }, [theme]);

  useEffect(() => {
    if (!user || !dataLoaded.current) return;
    setDoc(doc(db, "users", user.uid), { earnedBadges }, { merge: true });
  }, [earnedBadges]);

  useEffect(() => {
    if (!user || !dataLoaded.current) return;
    setDoc(doc(db, "users", user.uid), { streakFreezes, usedFreezes, awardedFreezeWeeks }, { merge: true });
  }, [streakFreezes, usedFreezes, awardedFreezeWeeks]);

  useEffect(() => {
    if (!user || !dataLoaded.current) return;
    setDoc(doc(db, "users", user.uid), { personalRecords }, { merge: true });
  }, [personalRecords]);

  const activeTasks = tasks.filter((task) => task.active && (task.type ?? "weekly") === "weekly");
  const activeLongTermTasks = tasks.filter((task) => task.active && task.type === "longterm");
  const archivedTasks = tasks.filter((task) => !task.active);

  const getTaskLog = (taskId, date) => {
    return (
      logs[date]?.[taskId] || {
        completed: false,
        extra: false,
      }
    );
  };

  const updateTaskLog = (taskId, date, patch) => {
    setLogs((prev) => ({
      ...prev,
      [date]: {
        ...(prev[date] || {}),
        [taskId]: {
          completed: false,
          extra: false,
          ...((prev[date] || {})[taskId] || {}),
          ...patch,
        },
      },
    }));
  };

  const calculateBaselinePointsForTask = (taskId, date) => {
    const task = tasks.find((t) => t.id === taskId);
    if (!task) return 0;
    const log = getTaskLog(taskId, date);
    return log.completed ? task.dailyPoints : 0;
  };

  const getWeeklyCompletionCount = (task, weekAnchorDate) => {
    const weekDates = getWeekDates(weekAnchorDate);
    return weekDates.filter((date) => getTaskLog(task.id, date).completed).length;
  };

  const getWeeklyStatus = (task, weekAnchorDate) => {
    const completions = getWeeklyCompletionCount(task, weekAnchorDate);
    if (completions >= task.weeklyGoal) return "green";

    const weekDatesForStatus = getWeekDates(weekAnchorDate);
    const dateIndex = weekDatesForStatus.indexOf(weekAnchorDate);
    const todayAvailable = !getTaskLog(task.id, weekAnchorDate).completed;
    const remainingDays =
      weekDatesForStatus.slice(dateIndex + (todayAvailable ? 0 : 1)).length;
    const needed = task.weeklyGoal - completions;

    if (needed > remainingDays) return "red";
    if (needed === remainingDays) return "must";
    return "yellow";
  };

  const getWeeklyAdjustment = (task, weekAnchorDate) => {
    const weekDates = getWeekDates(weekAnchorDate);
    const isEndOfWeek = weekAnchorDate === weekDates[6];
    const completions = getWeeklyCompletionCount(task, weekAnchorDate);

    if (completions >= task.weeklyGoal) {
      return task.weeklyBonus;
    }

    if (isEndOfWeek) {
      return -task.weeklyBonus / 2;
    }

    return 0;
  };

  const isDailyPerfect = (date) => {
    const baselineAvailable = activeTasks.reduce((sum, task) => sum + task.dailyPoints, 0);
    const baselineEarned = activeTasks.reduce(
      (sum, task) => sum + calculateBaselinePointsForTask(task.id, date),
      0
    );
    return baselineAvailable > 0 && baselineEarned === baselineAvailable;
  };

  const isWeeklyPerfect = (weekAnchorDate) => {
    if (activeTasks.length === 0) return false;
    return activeTasks.every(
      (task) => getWeeklyCompletionCount(task, weekAnchorDate) >= task.weeklyGoal
    );
  };

  // A task is exempt from the zero-completion rule if it's a big once-a-week task
  const isExemptTask = (task) => task.weeklyGoal === 1 && task.dailyPoints > 20;

  const hasZeroedNonExemptTask = (weekAnchorDate) => {
    return activeTasks.some(
      (task) => !isExemptTask(task) && getWeeklyCompletionCount(task, weekAnchorDate) === 0
    );
  };

  // Great Week: at most 1 dropped task per category.
  // Excellent and Perfect weeks automatically qualify.
  const isGreatWeek = (weekAnchorDate) => {
    if (activeTasks.length === 0) return false;
    // At most 1 dropped task per category
    const groups = {};
    activeTasks.forEach((task) => {
      const cat = task.category || "Uncategorized";
      if (!groups[cat]) groups[cat] = [];
      groups[cat].push(task);
    });
    return Object.values(groups).every((catTasks) =>
      catTasks.filter((t) => getWeeklyCompletionCount(t, weekAnchorDate) < t.weeklyGoal).length <= 1
    );
  };

  const isExcellentWeek = (weekAnchorDate) => {
    if (activeTasks.length === 0) return false;
    return isGreatWeek(weekAnchorDate) && !hasZeroedNonExemptTask(weekAnchorDate);
  };

  const allLoggedDates = useMemo(() => Object.keys(logs).sort(), [logs]);

  const firstLoggedDate = useMemo(() => {
    return allLoggedDates.length > 0 ? allLoggedDates[0] : null;
  }, [allLoggedDates]);

  const firstLoggedWeekStart = useMemo(() => {
    return firstLoggedDate ? getWeekStart(firstLoggedDate) : getWeekStart(todayString());
  }, [firstLoggedDate]);

  const weekDates = useMemo(() => getWeekDates(selectedDate), [selectedDate]);

  // Weighted daily baseline: each task contributes (dailyPoints × weeklyGoal / 7) rounded.
  // Reflects that tasks only required N times/week shouldn't inflate the daily target.
  const dailyBaselineAvailable = useMemo(() => {
    return activeTasks.reduce((sum, task) => sum + Math.round(task.dailyPoints * task.weeklyGoal / 7), 0);
  }, [activeTasks]);

  const dailyBaselineEarned = useMemo(() => {
    return activeTasks.reduce(
      (sum, task) => sum + calculateBaselinePointsForTask(task.id, selectedDate),
      0
    );
  }, [activeTasks, tasks, logs, selectedDate]);

  const dailyExtraPoints = useMemo(() => {
    return activeTasks.reduce((sum, task) => {
      const log = getTaskLog(task.id, selectedDate);
      return sum + (log.completed && log.extra ? task.extraBonus : 0);
    }, 0);
  }, [activeTasks, tasks, logs, selectedDate]);

  const todayPoints = dailyBaselineEarned + dailyExtraPoints;
  const dailyBaselinePercent = dailyBaselineAvailable
    ? Math.round((dailyBaselineEarned / dailyBaselineAvailable) * 100)
    : 0;
  // Weekly baseline = sum of (dailyPoints × weeklyGoal) per task — exactly the points
  // achievable by hitting each task's goal the required number of times this week.
  const weeklyBaselineAvailable = useMemo(() => {
    return activeTasks.reduce((sum, task) => sum + task.dailyPoints * task.weeklyGoal, 0);
  }, [activeTasks]);

  const weeklyBaselineEarned = useMemo(() => {
    return weekDates.reduce((sum, date) => {
      return (
        sum +
        activeTasks.reduce(
          (daySum, task) => daySum + calculateBaselinePointsForTask(task.id, date),
          0
        )
      );
    }, 0);
  }, [activeTasks, tasks, logs, weekDates]);

  const weeklyExtraPoints = useMemo(() => {
    return weekDates.reduce((sum, date) => {
      return (
        sum +
        activeTasks.reduce((daySum, task) => {
          const log = getTaskLog(task.id, date);
          return daySum + (log.completed && log.extra ? task.extraBonus : 0);
        }, 0)
      );
    }, 0);
  }, [activeTasks, tasks, logs, weekDates]);

  const weeklyAdjustments = useMemo(() => {
    return activeTasks.reduce((sum, task) => sum + getWeeklyAdjustment(task, selectedDate), 0);
  }, [activeTasks, tasks, logs, selectedDate]);

  const weeklyTotalPoints = weeklyBaselineEarned + weeklyExtraPoints + weeklyAdjustments;

  const categories = useMemo(() => {
    return [...new Set(activeTasks.map((task) => task.category).filter(Boolean))];
  }, [activeTasks]);

    const groupedActiveTasks = useMemo(() => {
    const groups = {};

    activeTasks.forEach((task) => {
      const key = task.category || "Uncategorized";
      if (!groups[key]) groups[key] = [];
      groups[key].push(task);
    });

    return Object.entries(groups).sort(([a], [b]) => a.localeCompare(b));
  }, [activeTasks]);

  const activityStreak = useMemo(() => {
    let streak = 0;
    const today = new Date(todayString() + "T12:00:00");

    for (let i = 0; i < 365; i++) {
      const d = new Date(today);
      d.setDate(today.getDate() - i);
      const key = d.toISOString().slice(0, 10);

      const anyCompleted = activeTasks.some((task) => getTaskLog(task.id, key).completed);

      if (anyCompleted) streak += 1;
      else break;
    }

    return streak;
  }, [activeTasks, tasks, logs]);

  const dailyPerfectStreak = useMemo(() => {
    let streak = 0;
    const today = new Date(todayString() + "T12:00:00");

    for (let i = 0; i < 365; i++) {
      const d = new Date(today);
      d.setDate(today.getDate() - i);
      const key = d.toISOString().slice(0, 10);

      if (isDailyPerfect(key)) streak += 1;
      else break;
    }

    return streak;
  }, [activeTasks, tasks, logs]);

  const weeklyPerfectStreak = useMemo(() => {
    let streak = 0;
    const currentWeekStart = new Date(getWeekStart(todayString()) + "T12:00:00");

    for (let i = 0; i < 52; i++) {
      const d = new Date(currentWeekStart);
      d.setDate(currentWeekStart.getDate() - i * 7);
      const key = d.toISOString().slice(0, 10);

      if (isWeeklyPerfect(key)) streak += 1;
      else break;
    }

    return streak;
  }, [activeTasks, tasks, logs]);

  const categoryStreaks = useMemo(() => {
    const result = {};

    categories.forEach((category) => {
      let streak = 0;
      const today = new Date(todayString() + "T12:00:00");

      for (let i = 0; i < 365; i++) {
        const d = new Date(today);
        d.setDate(today.getDate() - i);
        const key = d.toISOString().slice(0, 10);

        const categoryTasks = activeTasks.filter((task) => task.category === category);
        const anyCategoryCompleted = categoryTasks.some((task) =>
          getTaskLog(task.id, key).completed
        );

        if (anyCategoryCompleted) streak += 1;
        else break;
      }

      result[category] = streak;
    });

    return result;
  }, [activeTasks, categories, tasks, logs]);

  const currentWeekStart = useMemo(() => getWeekStart(selectedDate), [selectedDate]);

  const recentWeekStarts = useMemo(() => {
    if (!firstLoggedDate) return [currentWeekStart];

    const starts = [];
    let current = firstLoggedWeekStart;

    while (current <= currentWeekStart) {
      starts.push(current);
      current = shiftDate(current, 7);
    }

    return starts;
  }, [firstLoggedDate, firstLoggedWeekStart, currentWeekStart]);

  const lastWeekStart = useMemo(() => shiftDate(currentWeekStart, -7), [currentWeekStart]);

  const bestWeekStart = useMemo(() => {
    if (recentWeekStarts.length === 0) return currentWeekStart;

    let bestStart = recentWeekStarts[0];
    let bestScore = -Infinity;

    recentWeekStarts.forEach((weekStart) => {
      const score = getWeekTotalPoints(activeTasks, tasks, logs, weekStart);
      if (score > bestScore) {
        bestScore = score;
        bestStart = weekStart;
      }
    });

    return bestStart;
  }, [recentWeekStarts, activeTasks, tasks, logs, currentWeekStart]);

  const currentWeekChartData = useMemo(() => {
    return weekDates.map((date) => {
      const baselineEarned = activeTasks.reduce(
        (sum, task) => sum + calculateBaselinePointsForTask(task.id, date),
        0
      );

      const extraEarned = activeTasks.reduce((sum, task) => {
        const log = getTaskLog(task.id, date);
        return sum + (log.completed && log.extra ? task.extraBonus : 0);
      }, 0);

      return {
        day: shortDateLabel(date),
        points: baselineEarned + extraEarned,
        percent: dailyBaselineAvailable
          ? Number(((baselineEarned / dailyBaselineAvailable) * 100).toFixed(1))
          : 0,
      };
    });
  }, [weekDates, activeTasks, tasks, logs, dailyBaselineAvailable]);

  const weeklyComparisonChartData = useMemo(() => {
    const thisWeek = buildCumulativeWeekData(activeTasks, tasks, logs, currentWeekStart);
    const lastWeek = buildCumulativeWeekData(activeTasks, tasks, logs, lastWeekStart);
    const bestWeek = buildCumulativeWeekData(activeTasks, tasks, logs, bestWeekStart);

    return thisWeek.map((dayData, index) => ({
      day: dayData.day,
      thisWeek: dayData.cumulative,
      lastWeek: lastWeek[index]?.cumulative ?? 0,
      bestWeek: bestWeek[index]?.cumulative ?? 0,
    }));
  }, [activeTasks, tasks, logs, currentWeekStart, lastWeekStart, bestWeekStart]);

  const weeklyAverageChartData = useMemo(() => {
    return recentWeekStarts.map((weekStart) => {
      const dates = getWeekDates(weekStart);

      let baselineEarned = 0;
      let baselineAvailable = 0;
      let totalPoints = 0;

      dates.forEach((date) => {
        const dayBaselineAvailable = activeTasks.reduce(
          (sum, task) => sum + task.dailyPoints,
          0
        );
        const dayBaselineEarned = activeTasks.reduce(
          (sum, task) => sum + calculateBaselinePointsForTask(task.id, date),
          0
        );
        const dayExtra = activeTasks.reduce((sum, task) => {
          const log = getTaskLog(task.id, date);
          return sum + (log.completed && log.extra ? task.extraBonus : 0);
        }, 0);

        baselineAvailable += dayBaselineAvailable;
        baselineEarned += dayBaselineEarned;
        totalPoints += dayBaselineEarned + dayExtra;
      });

      const weekEnd = dates[6];
      const weeklyAdjustment = activeTasks.reduce(
        (sum, task) => sum + getWeeklyAdjustment(task, weekEnd),
        0
      );

      totalPoints += weeklyAdjustment;

      return {
        week: weekLabelFromDate(weekStart),
        avgPoints: Number((totalPoints / 7).toFixed(1)),
        avgPercent: baselineAvailable
          ? Number(((baselineEarned / baselineAvailable) * 100).toFixed(1))
          : 0,
      };
    });
  }, [recentWeekStarts, activeTasks, tasks, logs]);

  // ── New computed values ──────────────────────────────────────────────────

  const lifetimePoints = useMemo(() => {
    let total = 0;
    Object.entries(logs).forEach(([, dayLog]) => {
      tasks.forEach((task) => {
        const log = dayLog?.[task.id];
        if (log?.completed) total += task.dailyPoints + (log.extra ? task.extraBonus : 0);
      });
    });
    return total;
  }, [tasks, logs]);

  // Points earned in the last 90 days — ensures recent multi-task activity
  const recentPoints = useMemo(() => {
    let total = 0;
    const cutoff = shiftDate(todayString(), -90);
    Object.entries(logs).forEach(([date, dayLog]) => {
      if (date < cutoff) return;
      tasks.forEach((task) => {
        const log = dayLog?.[task.id];
        if (log?.completed) total += task.dailyPoints + (log.extra ? task.extraBonus : 0);
      });
    });
    return total;
  }, [tasks, logs]);

  // Keep totalPerfectWeeks for badges
  const totalPerfectWeeks = useMemo(() => {
    if (activeTasks.length === 0) return 0;
    let count = 0;
    recentWeekStarts.forEach((weekStart) => {
      if (weekStart >= currentWeekStart) return;
      const weekEnd = getWeekDates(weekStart)[6];
      if (isWeeklyPerfect(weekEnd)) count++;
    });
    return count;
  }, [activeTasks, tasks, logs, recentWeekStarts, currentWeekStart]);

  // Perfect week % — used only for levels 18–20
  const perfectWeekPct = useMemo(() => {
    if (activeTasks.length === 0) return 0;
    const pastWeeks = recentWeekStarts.filter((w) => w < currentWeekStart);
    if (pastWeeks.length < 2) return 0;
    const perfectCount = pastWeeks.filter((weekStart) => {
      const weekEnd = getWeekDates(weekStart)[6];
      return isWeeklyPerfect(weekEnd);
    }).length;
    return Math.round((perfectCount / pastWeeks.length) * 100);
  }, [activeTasks, tasks, logs, recentWeekStarts, currentWeekStart]);

  // Great week count — includes Great, Excellent, and Perfect weeks
  const totalGreatWeeks = useMemo(() => {
    if (activeTasks.length === 0) return 0;
    let count = 0;
    recentWeekStarts.forEach((weekStart) => {
      if (weekStart >= currentWeekStart) return;
      const weekEnd = getWeekDates(weekStart)[6];
      if (isGreatWeek(weekEnd)) count++;
    });
    return count;
  }, [activeTasks, tasks, logs, recentWeekStarts, currentWeekStart]);

  const totalExcellentWeeks = useMemo(() => {
    if (activeTasks.length === 0) return 0;
    let count = 0;
    recentWeekStarts.forEach((weekStart) => {
      if (weekStart >= currentWeekStart) return;
      const weekEnd = getWeekDates(weekStart)[6];
      if (isExcellentWeek(weekEnd)) count++;
    });
    return count;
  }, [activeTasks, tasks, logs, recentWeekStarts, currentWeekStart]);

  // Great week % (ignored until ≥2 tracked weeks)
  const greatWeekPct = useMemo(() => {
    if (activeTasks.length === 0) return 0;
    const pastWeeks = recentWeekStarts.filter((w) => w < currentWeekStart);
    if (pastWeeks.length < 2) return 0;
    const greatCount = pastWeeks.filter((weekStart) => {
      const weekEnd = getWeekDates(weekStart)[6];
      return isGreatWeek(weekEnd);
    }).length;
    return Math.round((greatCount / pastWeeks.length) * 100);
  }, [activeTasks, tasks, logs, recentWeekStarts, currentWeekStart]);

  const currentLevelData = useMemo(() => {
    let cur = LEVELS[0];
    for (const lvl of LEVELS) {
      if (
        lifetimePoints >= lvl.lifetimePts &&
        recentPoints >= lvl.recentPts &&
        totalGreatWeeks >= lvl.greatWeeks &&
        greatWeekPct >= lvl.greatPct &&
        perfectWeekPct >= lvl.perfectPct
      ) cur = lvl;
      else break;
    }
    return cur;
  }, [lifetimePoints, recentPoints, totalGreatWeeks, greatWeekPct, perfectWeekPct]);

  const nextLevelData = useMemo(() => {
    const idx = LEVELS.findIndex((l) => l.level === currentLevelData.level);
    return idx < LEVELS.length - 1 ? LEVELS[idx + 1] : null;
  }, [currentLevelData]);

  const totalBonusEarned = useMemo(() => {
    let count = 0;
    Object.values(logs).forEach((dayLog) => {
      tasks.forEach((task) => {
        if (dayLog?.[task.id]?.extra) count++;
      });
    });
    return count;
  }, [tasks, logs]);

  const totalAllTasksDays = useMemo(() => {
    if (activeTasks.length === 0) return 0;
    return Object.keys(logs).filter((date) =>
      activeTasks.every((task) => getTaskLog(task.id, date).completed)
    ).length;
  }, [activeTasks, tasks, logs]);

  // Streak per task, accounting for used freezes
  const getTaskDailyStreak = useCallback((taskId, asOfDate) => {
    let streak = 0;
    for (let i = 0; i < 500; i++) {
      const d = shiftDate(asOfDate, -i);
      const log = getTaskLog(taskId, d);
      const frozen = (usedFreezes[taskId] || []).includes(d);
      if (log.completed || frozen) streak++;
      else break;
    }
    return streak;
  }, [logs, tasks, usedFreezes]);

  const maxTaskStreak = useMemo(() => {
    return activeTasks.reduce((max, task) => Math.max(max, getTaskDailyStreak(task.id, todayString())), 0);
  }, [activeTasks, getTaskDailyStreak]);

  const getTaskLongestStreak = useCallback((taskId) => {
    const trackedDates = new Set(Object.keys(logs));
    (usedFreezes[taskId] || []).forEach((date) => trackedDates.add(date));
    if (trackedDates.size === 0) return 0;

    const sortedDates = [...trackedDates].sort();
    let cursor = sortedDates[0];
    const end = todayString();
    let current = 0;
    let longest = 0;

    while (cursor <= end) {
      const log = getTaskLog(taskId, cursor);
      const frozen = (usedFreezes[taskId] || []).includes(cursor);
      if (log.completed || frozen) {
        current += 1;
        longest = Math.max(longest, current);
      } else {
        current = 0;
      }
      cursor = shiftDate(cursor, 1);
    }

    return longest;
  }, [logs, usedFreezes, getTaskLog]);

  const longestTaskStreak = useMemo(() => {
    return tasks.reduce(
      (best, task) => {
        const longest = getTaskLongestStreak(task.id);
        const activeStreak = getTaskDailyStreak(task.id, todayString());
        if (longest > best.days) {
          return {
            days: longest,
            taskName: task.name || "Unnamed task",
            isStillActive: longest > 0 && activeStreak === longest,
          };
        }
        return best;
      },
      { days: 0, taskName: "No task yet", isStillActive: false }
    );
  }, [tasks, getTaskLongestStreak, getTaskDailyStreak]);

  const longestActiveTaskStreak = useMemo(() => {
    return activeTasks.reduce(
      (best, task) => {
        const days = getTaskDailyStreak(task.id, todayString());
        if (days > best.days) return { days, taskName: task.name || "Unnamed task" };
        return best;
      },
      { days: 0, taskName: "No active streak" }
    );
  }, [activeTasks, getTaskDailyStreak]);

  const selectedTask = useMemo(() => {
    return tasks.find((task) => String(task.id) === String(selectedTaskId)) || activeTasks[0] || tasks[0] || null;
  }, [tasks, activeTasks, selectedTaskId]);

  const selectedTaskStats = useMemo(() => {
    if (!selectedTask) return null;

    const loggedDates = Object.keys(logs).sort();
    const completions = loggedDates.filter((date) => getTaskLog(selectedTask.id, date).completed);
    const bonusCount = loggedDates.filter((date) => {
      const log = getTaskLog(selectedTask.id, date);
      return log.completed && log.extra;
    }).length;
    const totalPoints = loggedDates.reduce((sum, date) => {
      const log = getTaskLog(selectedTask.id, date);
      if (!log.completed) return sum;
      return sum + selectedTask.dailyPoints + (log.extra ? selectedTask.extraBonus : 0);
    }, 0);
    const recentWeeks = recentWeekStarts.slice(-8).map((weekStart) => {
      const weekEnd = getWeekDates(weekStart)[6];
      return {
        week: weekLabelFromDate(weekStart),
        completions: getWeeklyCompletionCount(selectedTask, weekEnd),
        goal: selectedTask.weeklyGoal,
      };
    });
    const bestWeek = recentWeekStarts.reduce(
      (best, weekStart) => {
        const weekEnd = getWeekDates(weekStart)[6];
        const count = getWeeklyCompletionCount(selectedTask, weekEnd);
        return count > best.completions ? { week: weekLabelFromDate(weekStart), completions: count } : best;
      },
      { week: "None", completions: 0 }
    );

    return {
      completions: completions.length,
      bonusCount,
      totalPoints,
      activeStreak: getTaskDailyStreak(selectedTask.id, todayString()),
      longestStreak: getTaskLongestStreak(selectedTask.id),
      completionRate: loggedDates.length ? Math.round((completions.length / loggedDates.length) * 100) : 0,
      thisWeek: getWeeklyCompletionCount(selectedTask, selectedDate),
      bestWeek,
      recentWeeks,
    };
  }, [selectedTask, logs, recentWeekStarts, selectedDate, getTaskDailyStreak, getTaskLongestStreak]);

  const weekTierInfo = {
    great: "Great Week: each category has no more than one active task miss its weekly goal.",
    excellent: "Excellent Week: meets Great Week criteria and no non-exempt active task is completed zero times.",
    perfect: "Perfect Week: every active task meets or beats its weekly goal.",
  };

  const currentWeekTier = useMemo(() => {
    const weekEnd = getWeekDates(currentWeekStart)[6];
    if (isWeeklyPerfect(weekEnd)) return "Perfect";
    if (isExcellentWeek(weekEnd)) return "Excellent";
    if (isGreatWeek(weekEnd)) return "Great";
    return "Building";
  }, [currentWeekStart, activeTasks, tasks, logs]);

  const weeklyReviewData = useMemo(() => {
    const taskRows = activeTasks.map((task) => {
      const count = getWeeklyCompletionCount(task, selectedDate);
      const status = getWeeklyStatus(task, selectedDate);
      return {
        ...task,
        count,
        status,
        needed: Math.max(0, task.weeklyGoal - count),
      };
    });
    const strongest = [...taskRows].sort((a, b) => b.count / Math.max(1, b.weeklyGoal) - a.count / Math.max(1, a.weeklyGoal))[0];
    const focus = taskRows.filter((task) => task.status === "must" || task.status === "red");

    return {
      taskRows,
      strongest,
      focus,
      completed: taskRows.filter((task) => task.status === "green").length,
      mustComplete: taskRows.filter((task) => task.status === "must").length,
      missed: taskRows.filter((task) => task.status === "red").length,
    };
  }, [activeTasks, tasks, logs, selectedDate]);

  const calendarMonth = useMemo(() => {
    const anchor = new Date(selectedDate + "T12:00:00");
    const first = new Date(anchor.getFullYear(), anchor.getMonth(), 1, 12);
    const last = new Date(anchor.getFullYear(), anchor.getMonth() + 1, 0, 12);
    const days = [];

    for (let i = 1; i <= last.getDate(); i++) {
      const d = new Date(anchor.getFullYear(), anchor.getMonth(), i, 12);
      const date = d.toISOString().slice(0, 10);
      const completed = activeTasks.filter((task) => getTaskLog(task.id, date).completed).length;
      const points = activeTasks.reduce((sum, task) => {
        const log = getTaskLog(task.id, date);
        return sum + (log.completed ? task.dailyPoints + (log.extra ? task.extraBonus : 0) : 0);
      }, 0);
      const percent = activeTasks.length ? Math.round((completed / activeTasks.length) * 100) : 0;
      days.push({ date, day: i, completed, total: activeTasks.length, percent, points });
    }

    return {
      label: first.toLocaleDateString(undefined, { month: "long", year: "numeric" }),
      leadingBlanks: first.getDay(),
      days,
    };
  }, [selectedDate, activeTasks, tasks, logs]);

  const longTermBadges = useMemo(() => {
    return tasks
      .filter((task) => task.type === "longterm")
      .map((task) => ({
        id: `longterm_${task.id}`,
        icon: "🏆",
        name: task.reward || `${task.name} Complete`,
        desc: `${task.name}: ${(Number(task.targetCount) || 0).toLocaleString()} ${task.unitLabel || "total"}`,
      }));
  }, [tasks]);

  const allBadges = useMemo(() => [...BADGES, ...longTermBadges], [longTermBadges]);

  const milestoneTimeline = useMemo(() => {
    return Object.entries(earnedBadges)
      .map(([badgeId, date]) => {
        const badge = allBadges.find((item) => item.id === badgeId);
        return badge ? { ...badge, date } : null;
      })
      .filter(Boolean)
      .sort((a, b) => b.date.localeCompare(a.date));
  }, [earnedBadges, allBadges]);

  const showWeekInfo = (type) => {
    setWeekInfoVisible((current) => current === type ? null : type);
  };

  // Award freeze when current week becomes perfect
  useEffect(() => {
    if (!user || !dataLoaded.current || activeTasks.length === 0) return;
    const weekEnd = getWeekDates(currentWeekStart)[6];
    if (isWeeklyPerfect(weekEnd) && !awardedFreezeWeeks.includes(currentWeekStart)) {
      setStreakFreezes((prev) => Math.min(prev + 1, 3));
      setAwardedFreezeWeeks((prev) => [...prev, currentWeekStart]);
    }
  }, [logs]);

  // Check & award badges whenever key metrics change
  useEffect(() => {
    if (!user || !dataLoaded.current) return;
    const today = todayString();
    const allTasksCompletedToday = activeTasks.length > 0 && activeTasks.every((t) => getTaskLog(t.id, today).completed);
    const newBadges = {};
    const earn = (id) => { if (!earnedBadges[id]) newBadges[id] = today; };
    const totalCompletions = Object.values(logs).reduce((sum, d) => sum + Object.values(d || {}).filter((l) => l?.completed).length, 0);
    if (totalCompletions >= 1) earn("first_task");
    if (totalCompletions >= 10) earn("tasks_10");
    if (totalCompletions >= 50) earn("tasks_50");
    if (totalCompletions >= 100) earn("tasks_100");
    if (totalCompletions >= 500) earn("tasks_500");
    if (totalCompletions >= 1000) earn("tasks_1000");
    if (maxTaskStreak >= 7) earn("streak_7");
    if (maxTaskStreak >= 14) earn("streak_14");
    if (maxTaskStreak >= 30) earn("streak_30");
    if (maxTaskStreak >= 60) earn("streak_60");
    if (maxTaskStreak >= 90) earn("streak_90");
    if (maxTaskStreak >= 180) earn("streak_180");
    if (maxTaskStreak >= 365) earn("streak_365");
    if (activityStreak >= 7) earn("activity_7");
    if (activityStreak >= 30) earn("activity_30");
    if (lifetimePoints >= 100) earn("pts_100");
    if (lifetimePoints >= 500) earn("pts_500");
    if (lifetimePoints >= 1000) earn("pts_1000");
    if (lifetimePoints >= 2000) earn("pts_2000");
    if (lifetimePoints >= 5000) earn("pts_5000");
    if (lifetimePoints >= 10000) earn("pts_10000");
    if (lifetimePoints >= 25000) earn("pts_25000");
    if (lifetimePoints >= 50000) earn("pts_50000");
    if (lifetimePoints >= 100000) earn("pts_100000");
    if (totalGreatWeeks >= 1) earn("great_week");
    if (totalGreatWeeks >= 4) earn("great_4w");
    if (totalGreatWeeks >= 13) earn("great_13w");
    if (totalGreatWeeks >= 26) earn("great_26w");
    if (totalGreatWeeks >= 52) earn("great_52w");
    if (totalGreatWeeks >= 100) earn("great_100w");
    if (totalExcellentWeeks >= 1) earn("excellent_week");
    if (totalExcellentWeeks >= 4) earn("excellent_4w");
    if (totalExcellentWeeks >= 13) earn("excellent_13w");
    if (totalExcellentWeeks >= 26) earn("excellent_26w");
    if (totalExcellentWeeks >= 52) earn("excellent_52w");
    if (totalPerfectWeeks >= 1) earn("perfect_week");
    if (totalPerfectWeeks >= 4) earn("perfect_4w");
    if (totalPerfectWeeks >= 13) earn("perfect_13w");
    if (totalPerfectWeeks >= 26) earn("perfect_26w");
    if (totalPerfectWeeks >= 52) earn("perfect_52w");
    if (totalPerfectWeeks >= 100) earn("perfect_100w");
    if (allTasksCompletedToday) earn("all_tasks_day");
    if (totalAllTasksDays >= 7) earn("all_tasks_7");
    if (totalAllTasksDays >= 30) earn("all_tasks_30");
    if (totalBonusEarned >= 10) earn("bonus_10");
    if (totalBonusEarned >= 50) earn("bonus_50");
    if (totalBonusEarned >= 100) earn("bonus_100");
    if (totalBonusEarned >= 500) earn("bonus_500");
    if (dailyPerfectStreak >= 7) earn("daily_perfect_7");
    if (dailyPerfectStreak >= 30) earn("daily_perfect_30");
    if (currentLevelData.level >= 5) earn("level_5");
    if (currentLevelData.level >= 10) earn("level_10");
    if (currentLevelData.level >= 15) earn("level_15");
    if (currentLevelData.level >= 20) earn("level_20");
    activeLongTermTasks.forEach((task) => {
      if ((Number(task.targetCount) || 0) > 0 && (Number(task.currentCount) || 0) >= Number(task.targetCount)) {
        earn(`longterm_${task.id}`);
      }
    });
    if (Object.keys(newBadges).length > 0) setEarnedBadges((prev) => ({ ...prev, ...newBadges }));
  }, [logs, tasks, lifetimePoints, totalGreatWeeks, totalExcellentWeeks, totalPerfectWeeks, maxTaskStreak, activityStreak, dailyPerfectStreak, totalAllTasksDays, totalBonusEarned, currentLevelData]);

  // Update personal records
  useEffect(() => {
    if (!user || !dataLoaded.current || activeTasks.length === 0) return;
    const today = todayString();
    const todayPts = activeTasks.reduce((sum, task) => {
      const log = getTaskLog(task.id, today);
      return sum + (log.completed ? task.dailyPoints + (log.extra ? task.extraBonus : 0) : 0);
    }, 0);
    const curStreak = maxTaskStreak;
    setPersonalRecords((prev) => {
      const updated = {
        bestDayPoints: Math.max(prev.bestDayPoints || 0, todayPts),
        bestWeekPoints: Math.max(prev.bestWeekPoints || 0, getWeekTotalPoints(activeTasks, tasks, logs, currentWeekStart)),
        longestStreak: Math.max(prev.longestStreak || 0, curStreak),
      };
      if (JSON.stringify(updated) === JSON.stringify(prev)) return prev;
      return updated;
    });
  }, [logs, maxTaskStreak]);

  const applyFreeze = (taskId) => {
    const yesterday = shiftDate(todayString(), -1);
    if (streakFreezes <= 0) return;
    if ((usedFreezes[taskId] || []).includes(yesterday)) return;
    setUsedFreezes((prev) => ({ ...prev, [taskId]: [...(prev[taskId] || []), yesterday] }));
    setStreakFreezes((prev) => prev - 1);
    setEarnedBadges((prev) => prev.freeze_used ? prev : { ...prev, freeze_used: todayString() });
  };

  const startAddTask = () => {
    setEditingTaskId(null);
    setForm(emptyForm);
    setFormError("");
    setShowForm(true);
  };

  const startEditTask = (task) => {
    setEditingTaskId(task.id);
    setFormError("");
    setShowForm(true);
    setForm({
      name: task.name,
      category: task.category,
      dailyGoal: task.dailyGoal,
      dailyPoints: String(task.dailyPoints),
      extraThreshold: task.extraThreshold,
      extraBonus: String(task.extraBonus),
      weeklyGoal: String(task.weeklyGoal),
      weeklyBonus: String(task.weeklyBonus),
      type: task.type ?? "weekly",
      targetCount: String(task.targetCount ?? ""),
      currentCount: String(task.currentCount ?? ""),
      unitLabel: task.unitLabel ?? "",
      reward: task.reward ?? "",
    });
  };

  const saveTask = () => {
    const taskType = form.type;
    const targetCount = Number(form.targetCount);
    const currentCount = Number(form.currentCount || 0);

    if (!taskType) {
      setFormError("Choose Weekly or Cumulative to continue.");
      return;
    }
    if (!form.name.trim()) {
      setFormError("Enter a name for this task or tracker.");
      return;
    }
    if (taskType === "longterm" && (!Number.isFinite(targetCount) || targetCount <= 0)) {
      setFormError("Enter a target amount greater than zero.");
      return;
    }
    if (taskType === "longterm" && (!Number.isFinite(currentCount) || currentCount < 0)) {
      setFormError("Current progress cannot be negative.");
      return;
    }
    if (taskType === "longterm" && !form.reward.trim()) {
      setFormError("Add the reward that this tracker will unlock.");
      return;
    }

    const taskPayload = {
      name: form.name.trim(),
      category: form.category.trim(),
      type: taskType,
      dailyGoal: taskType === "weekly" ? form.dailyGoal.trim() : "",
      dailyPoints: taskType === "weekly" ? Number(form.dailyPoints) || 0 : 0,
      extraThreshold: taskType === "weekly" ? form.extraThreshold.trim() : "",
      extraBonus: taskType === "weekly" ? Number(form.extraBonus) || 0 : 0,
      weeklyGoal: taskType === "weekly" ? Number(form.weeklyGoal) || 0 : 0,
      weeklyBonus: taskType === "weekly" ? Number(form.weeklyBonus) || 0 : 0,
      targetCount: taskType === "longterm" ? targetCount : 0,
      currentCount: taskType === "longterm" ? currentCount : 0,
      unitLabel: taskType === "longterm" ? form.unitLabel.trim() : "",
      reward: taskType === "longterm" ? form.reward.trim() : "",
    };

    if (editingTaskId) {
      setTasks((prev) =>
        prev.map((task) =>
          task.id === editingTaskId ? { ...task, ...taskPayload } : task
        )
      );
    } else {
      setTasks((prev) => [
        ...prev,
        {
          id: Date.now(),
          active: true,
          ...taskPayload,
        },
      ]);
    }

    setEditingTaskId(null);
    setForm(emptyForm);
    setFormError("");
    setShowForm(false);
  };

  const cancelEdit = () => {
    setEditingTaskId(null);
    setForm(emptyForm);
    setFormError("");
    setShowForm(false);
  };

  const deleteTask = (taskId) => {
    setTasks((prev) => prev.filter((task) => task.id !== taskId));

    setLogs((prev) => {
      const updated = { ...prev };
      Object.keys(updated).forEach((date) => {
        if (updated[date]?.[taskId]) {
          delete updated[date][taskId];
        }
      });
      return updated;
    });

    if (editingTaskId === taskId) cancelEdit();
  };

  const toggleArchived = (taskId) => {
    setTasks((prev) =>
      prev.map((task) =>
        task.id === taskId ? { ...task, active: !task.active } : task
      )
    );
  };

  const updateLongTermProgress = (taskId, amount) => {
    const delta = Number(amount) || 0;
    if (delta <= 0) return;

    setTasks((prev) =>
      prev.map((task) => {
        if (task.id !== taskId) return task;
        const currentCount = Math.max(0, (Number(task.currentCount) || 0) + delta);
        return { ...task, currentCount };
      })
    );
    setLongTermIncrements((prev) => ({ ...prev, [taskId]: "" }));
  };

  const toggleComplete = (taskId) => {
    const current = getTaskLog(taskId, selectedDate);
    const nextCompleted = !current.completed;

    if (nextCompleted) {
      const task = tasks.find((t) => t.id === taskId);
      const pts = task ? task.dailyPoints + (current.extra ? task.extraBonus : 0) : 0;
      setCompletingTaskId(taskId);
      setCompletingPoints(pts);
      setTimeout(() => setCompletingTaskId(null), 900);

      // Confetti when weekly goal is newly hit
      if (task) {
        const countBefore = getWeeklyCompletionCount(task, selectedDate);
        if (countBefore + 1 === task.weeklyGoal) {
          confetti({ particleCount: 80, spread: 60, origin: { y: 0.6 }, colors: ["#769fb6", "#188fa7", "#9dbbae", "#e2dbbe"] });
        }
      }
    }

    updateTaskLog(taskId, selectedDate, {
      completed: nextCompleted,
      extra: nextCompleted ? current.extra : false,
    });
  };

  const toggleExtra = (taskId) => {
    const current = getTaskLog(taskId, selectedDate);
    if (!current.completed) return;
    updateTaskLog(taskId, selectedDate, { extra: !current.extra });
  };

  const chooseTaskType = (type) => {
    setForm((prev) => ({ ...prev, type }));
    setFormError("");
  };

  const saveCustomCategory = () => {
    const category = newCategory.trim();
    if (!category) return;
    setCustomCategories((prev) => prev.includes(category) ? prev : [...prev, category]);
    setForm((prev) => ({ ...prev, category }));
    setNewCategory("");
    setShowCustomCategoryInput(false);
  };

  const renderTaskForm = ({ title, submitLabel }) => (
    <div className="task-form-inline">
      <div className="task-form-heading">
        <div>
          <span className="section-kicker">{editingTaskId ? "Edit task" : "New task"}</span>
          <h3>{title}</h3>
        </div>
        <button className="icon-button" type="button" onClick={cancelEdit} aria-label="Close task form" title="Close">
          ×
        </button>
      </div>

      <div className="field-group task-type-field">
        <span className="field-label">Task type</span>
        <div className="task-type-segmented" role="group" aria-label="Task type">
          <button
            className={`task-type-option ${form.type === "weekly" ? "active" : ""}`}
            type="button"
            aria-pressed={form.type === "weekly"}
            onClick={() => chooseTaskType("weekly")}
          >
            <strong>Weekly</strong>
            <span>Daily completion and weekly points</span>
          </button>
          <button
            className={`task-type-option ${form.type === "longterm" ? "active" : ""}`}
            type="button"
            aria-pressed={form.type === "longterm"}
            onClick={() => chooseTaskType("longterm")}
          >
            <strong>Cumulative</strong>
            <span>Progress toward a reward trophy</span>
          </button>
        </div>
      </div>

      {form.type && (
        <>
          <div className="labeled-form-grid task-form-fields">
            <div className="field-group">
              <label className="field-label" htmlFor="task-name">Task name</label>
              <input
                id="task-name"
                className="input"
                placeholder={form.type === "longterm" ? "Anki Reviews" : "Workout"}
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
            </div>
            <div className="field-group">
              <label className="field-label" htmlFor="task-category">Category</label>
              <select
                id="task-category"
                className="input"
                value={form.category}
                onChange={(e) => {
                  if (e.target.value === "__custom__") setShowCustomCategoryInput(true);
                  else {
                    setForm({ ...form, category: e.target.value });
                    setShowCustomCategoryInput(false);
                  }
                }}
              >
                <option value="">Select category</option>
                {[...DEFAULT_CATEGORIES, ...customCategories].map((category) => (
                  <option key={category} value={category}>{category}</option>
                ))}
                <option value="__custom__">Add custom category</option>
              </select>
              {showCustomCategoryInput && (
                <div className="custom-category-row">
                  <input
                    className="input"
                    placeholder="Category name"
                    value={newCategory}
                    onChange={(e) => setNewCategory(e.target.value)}
                  />
                  <button className="small-button" type="button" onClick={saveCustomCategory}>Add</button>
                </div>
              )}
            </div>

            {form.type === "longterm" ? (
              <>
                <div className="field-group">
                  <label className="field-label" htmlFor="target-count">Target amount</label>
                  <input id="target-count" className="input" type="number" min="1" placeholder="1000" value={form.targetCount} onChange={(e) => setForm({ ...form, targetCount: e.target.value })} />
                </div>
                <div className="field-group">
                  <label className="field-label" htmlFor="current-count">Starting progress</label>
                  <input id="current-count" className="input" type="number" min="0" placeholder="0" value={form.currentCount} onChange={(e) => setForm({ ...form, currentCount: e.target.value })} />
                </div>
                <div className="field-group">
                  <label className="field-label" htmlFor="unit-label">Unit</label>
                  <input id="unit-label" className="input" placeholder="reviews" value={form.unitLabel} onChange={(e) => setForm({ ...form, unitLabel: e.target.value })} />
                </div>
                <div className="field-group">
                  <label className="field-label" htmlFor="reward">Reward</label>
                  <input id="reward" className="input" placeholder="Buy the fancy notebook" value={form.reward} onChange={(e) => setForm({ ...form, reward: e.target.value })} />
                </div>
              </>
            ) : (
              <>
                <div className="field-group">
                  <label className="field-label" htmlFor="daily-goal">Daily goal</label>
                  <input id="daily-goal" className="input" placeholder="30 minutes" value={form.dailyGoal} onChange={(e) => setForm({ ...form, dailyGoal: e.target.value })} />
                </div>
                <div className="field-group">
                  <label className="field-label" htmlFor="daily-points">Daily points</label>
                  <input id="daily-points" className="input" type="number" min="0" placeholder="10" value={form.dailyPoints} onChange={(e) => setForm({ ...form, dailyPoints: e.target.value })} />
                </div>
                <div className="field-group">
                  <label className="field-label" htmlFor="extra-threshold">Bonus threshold</label>
                  <input id="extra-threshold" className="input" placeholder="60 minutes" value={form.extraThreshold} onChange={(e) => setForm({ ...form, extraThreshold: e.target.value })} />
                </div>
                <div className="field-group">
                  <label className="field-label" htmlFor="extra-bonus">Bonus points</label>
                  <input id="extra-bonus" className="input" type="number" min="0" placeholder="5" value={form.extraBonus} onChange={(e) => setForm({ ...form, extraBonus: e.target.value })} />
                </div>
                <div className="field-group">
                  <label className="field-label" htmlFor="weekly-goal">Weekly goal</label>
                  <input id="weekly-goal" className="input" type="number" min="1" max="7" placeholder="3" value={form.weeklyGoal} onChange={(e) => setForm({ ...form, weeklyGoal: e.target.value })} />
                </div>
                <div className="field-group">
                  <label className="field-label" htmlFor="weekly-bonus">Weekly bonus</label>
                  <input id="weekly-bonus" className="input" type="number" min="0" placeholder="20" value={form.weeklyBonus} onChange={(e) => setForm({ ...form, weeklyBonus: e.target.value })} />
                </div>
              </>
            )}
          </div>
          {formError && <div className="form-error" role="alert">{formError}</div>}
          <div className="task-controls task-form-actions">
            <button className="small-button" type="button" onClick={saveTask}>{submitLabel}</button>
            <button className="text-button" type="button" onClick={cancelEdit}>Cancel</button>
          </div>
        </>
      )}
    </div>
  );

  const handleSignIn = () => signInWithPopup(auth, googleProvider);
  const handleSignOut = () => {
    dataLoaded.current = false;
    setTasks([]);
    setLogs({});
    setCustomCategories([]);
    signOut(auth);
  };

  if (authLoading) {
    return (
      <div className="auth-screen">
        <div className="auth-card">
          <div className="auth-spinner" />
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="auth-screen">
        <div className="auth-card">
          <h1>Task Tracker</h1>
          <button className="google-sign-in-button" onClick={handleSignIn}>
            <svg width="18" height="18" viewBox="0 0 18 18" xmlns="http://www.w3.org/2000/svg">
              <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615z" fill="#4285F4"/>
              <path d="M9 18c2.43 0 4.467-.806 5.956-2.184l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z" fill="#34A853"/>
              <path d="M3.964 10.706A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.706V4.962H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.038l3.007-2.332z" fill="#FBBC05"/>
              <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.962L3.964 7.294C4.672 5.163 6.656 3.58 9 3.58z" fill="#EA4335"/>
            </svg>
            Sign in with Google
          </button>
        </div>
      </div>
    );
  }

  if (dataLoading) {
    return (
      <div className="auth-screen">
        <div className="auth-card">
          <div className="auth-spinner" />
          <p className="subtitle" style={{marginTop: 16}}>Loading your data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="app">
      <div className="container">
        <div className="top-bar">
          <div className="top-bar-title">
            <h1>Task Tracker</h1>
          </div>

          <div className="top-bar-actions">
            <button
              className={page === "activities" ? "nav-button active" : "nav-button"}
              onClick={() => setPage("activities")}
            >
              Task Log
            </button>
            <button
              className={["weekly", "review"].includes(page) ? "nav-button active" : "nav-button"}
              onClick={() => setPage("weekly")}
            >
              Weekly Tracking
            </button>
            <button
              className={["long", "calendar", "milestones"].includes(page) ? "nav-button active" : "nav-button"}
              onClick={() => setPage("long")}
            >
              Progress
            </button>
            <button
              className="theme-toggle"
              onClick={() => setTheme((prev) => (prev === "light" ? "dark" : "light"))}
            >
              {theme === "light" ? "Dark" : "Light"}
            </button>
            <button className="theme-toggle" onClick={handleSignOut} title={user.email}>
              Sign Out
            </button>
          </div>
        </div>

        {page === "activities" && (
          <>
            <div className="card">
              <div className="date-strip">
                <button
                  className="date-arrow"
                  onClick={() => setSelectedDate((prev) => shiftDate(prev, -1))}
                >
                  ←
                </button>

                <div className="date-input-wrap">
                  <label htmlFor="date">Date</label>
                  <input
                    id="date"
                    type="date"
                    value={selectedDate}
                    onChange={(e) => setSelectedDate(e.target.value)}
                    className="input compact-input"
                  />
                </div>

                <button
                  className="date-arrow"
                  onClick={() => setSelectedDate((prev) => shiftDate(prev, 1))}
                >
                  →
                </button>
              </div>
            </div>

            <div className="card stats-strip">
              <div className="stats-strip-item">
                <span className="stats-strip-label">Today Baseline</span>
                <span className="stats-strip-value">
                  {dailyBaselineEarned}<span className="stats-strip-denom">/{dailyBaselineAvailable}</span>
                </span>
                <span className="stats-strip-sub">{dailyBaselinePercent}%</span>
              </div>
              <div className="stats-strip-divider" />
              <div className="stats-strip-item">
                <span className="stats-strip-label">Today Points</span>
                <span className="stats-strip-value">{todayPoints}</span>
                <span className="stats-strip-sub">+{dailyExtraPoints} extra</span>
              </div>
              <div className="stats-strip-divider" />
              <div className="stats-strip-item">
                <span className="stats-strip-label">Week Baseline</span>
                <span className="stats-strip-value">
                  {weeklyBaselineEarned}<span className="stats-strip-denom">/{weeklyBaselineAvailable}</span>
                </span>
                <span className="stats-strip-sub">{formatPercent(weeklyBaselineEarned, weeklyBaselineAvailable)}</span>
              </div>
              <div className="stats-strip-divider" />
              <div className="stats-strip-item">
                <span className="stats-strip-label">Week Points</span>
                <span className="stats-strip-value">{weeklyTotalPoints}</span>
                <span className="stats-strip-sub">
                  {weeklyAdjustments >= 0 ? "+" : ""}{weeklyAdjustments} adj
                </span>
              </div>
            </div>

            <div className="task-create-panel">
              <div className="section-header">
                <div>
                  <span className="section-kicker">Task setup</span>
                  <h2>Tasks</h2>
                </div>
                {!showForm && (
                  <button className="small-button" type="button" onClick={startAddTask}>New Task</button>
                )}
              </div>
              {showForm && !editingTaskId && renderTaskForm({ title: "Choose what you want to track", submitLabel: "Create task" })}
            </div>

            <div className="card task-section-card">
              <div className="section-header section-header-stack">
                <div>
                  <span className="section-kicker">Long-range goals</span>
                  <h2>Cumulative Tasks</h2>
                </div>
                <span className="section-count">{activeLongTermTasks.length}</span>
              </div>

              {activeLongTermTasks.length === 0 && <p className="empty-text">No cumulative tasks yet.</p>}

              <div className="longterm-grid">
                {activeLongTermTasks.map((task) => {
                  const currentCount = Number(task.currentCount) || 0;
                  const targetCount = Number(task.targetCount) || 0;
                  const progressPercent = targetCount ? Math.min(100, Math.round((currentCount / targetCount) * 100)) : 0;
                  const isComplete = targetCount > 0 && currentCount >= targetCount;
                  const incrementValue = longTermIncrements[task.id] ?? "";

                  return (
                    <div key={task.id}>
                      <div className={`longterm-card ${isComplete ? "is-complete" : ""}`}>
                        <div className="longterm-card-header">
                          <div>
                            <h3>{task.name}</h3>
                            <span>{task.category || "Uncategorized"}</span>
                          </div>
                          <div className="longterm-trophy" title={task.reward || "Reward trophy"}>
                            {isComplete ? "🏆" : "◇"}
                          </div>
                        </div>

                        <div className="longterm-progress-group">
                          <div className="longterm-progress-line">
                            <strong>{currentCount.toLocaleString()}</strong>
                            <span>/ {targetCount.toLocaleString()} {task.unitLabel || "total"}</span>
                          </div>
                          <div
                            className="longterm-progress-bar-wrap"
                            role="progressbar"
                            aria-label={`${task.name} progress`}
                            aria-valuemin={0}
                            aria-valuemax={targetCount}
                            aria-valuenow={Math.min(currentCount, targetCount)}
                            aria-valuetext={`${currentCount.toLocaleString()} of ${targetCount.toLocaleString()} ${task.unitLabel || "total"}`}
                          >
                            <div className="longterm-progress-bar" style={{ width: `${progressPercent}%` }} />
                          </div>
                          <div className="longterm-progress-status">
                            <span>{progressPercent}% complete</span>
                            {isComplete && <strong>Reward unlocked</strong>}
                          </div>
                        </div>

                        <div className="longterm-control-group">
                          <div className="longterm-reward">
                            <span>Reward</span>
                            <strong>{task.reward || "No reward set"}</strong>
                          </div>

                          <div className="longterm-add-row">
                            <input
                              className="input"
                              type="number"
                              min="1"
                              aria-label={`Add progress to ${task.name}`}
                              placeholder={`Add ${task.unitLabel || "progress"}`}
                              value={incrementValue}
                              onChange={(e) => setLongTermIncrements((prev) => ({ ...prev, [task.id]: e.target.value }))}
                              onKeyDown={(e) => {
                                if (e.key === "Enter") updateLongTermProgress(task.id, incrementValue);
                              }}
                            />
                            <button
                              className="small-button"
                              type="button"
                              disabled={!Number(incrementValue) || Number(incrementValue) <= 0}
                              onClick={() => updateLongTermProgress(task.id, incrementValue)}
                            >
                              Add
                            </button>
                            <button className="small-button secondary-button" type="button" onClick={() => updateLongTermProgress(task.id, 1)}>+1</button>
                          </div>

                          <div className="task-action-row">
                            <button className="task-action-mini" onClick={() => startEditTask(task)}>Edit</button>
                            <button className="task-action-mini" onClick={() => toggleArchived(task.id)}>Archive</button>
                            <button className="task-action-mini danger-mini" onClick={() => deleteTask(task.id)}>Delete</button>
                          </div>
                        </div>
                      </div>

                      {editingTaskId === task.id && renderTaskForm({ title: task.name, submitLabel: "Save changes" })}
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="card task-section-card">
              <div className="section-header section-header-stack">
                <div>
                  <span className="section-kicker">This week</span>
                  <h2>Weekly Tasks</h2>
                </div>
                <span className="section-count">{activeTasks.length}</span>
              </div>

              {activeTasks.length === 0 && <p className="empty-text">No weekly tasks yet.</p>}

              {groupedActiveTasks.map(([categoryName, tasksInCategory]) => (
                <div key={categoryName} className="task-category-block">
                  <div className="task-category-header">
                    <h3>{categoryName}</h3>
                    <span className="task-category-count">{tasksInCategory.length}</span>
                  </div>

                  <div className="task-category-grid">
                    {tasksInCategory.map((task) => {
                      const log = getTaskLog(task.id, selectedDate);
                      const weeklyCount = getWeeklyCompletionCount(task, selectedDate);
                      const weeklyStatus = getWeeklyStatus(task, selectedDate);
                      const shortStatusLabel =
                        weeklyStatus === "green" ? "Met" :
                        weeklyStatus === "must" ? "Must Complete" :
                        weeklyStatus === "yellow" ? "On track" : "Missed";

                      return (
                        <div key={task.id}>
                        <div
                          className={`task-compact-card ${log.completed ? "is-complete" : ""}`}
                        >
                          <div className="task-complete-wrap">
                            <button
                              className={`task-complete-button ${log.completed ? "checked" : ""} ${completingTaskId === task.id ? "completing" : ""}`}
                              onClick={() => toggleComplete(task.id)}
                              title={`Mark ${task.name} complete`}
                            >
                              {log.completed ? "✓" : "○"}
                            </button>
                            {completingTaskId === task.id && (
                              <span className="points-float">+{completingPoints}</span>
                            )}
                          </div>

                          <button
                            className={`task-bonus-button ${log.extra ? "active" : ""}`}
                            onClick={() => toggleExtra(task.id)}
                            disabled={!log.completed}
                            title={`Bonus: ${task.extraThreshold}`}
                          >
                            {log.extra ? "★" : "☆"}
                          </button>

                          <span className="task-name">{task.name}</span>

                          {(() => {
                            const streak = getTaskDailyStreak(task.id, selectedDate);
                            const yesterday = shiftDate(selectedDate, -1);
                            const yesterdayLog = getTaskLog(task.id, yesterday);
                            const canFreeze = streakFreezes > 0 && !log.completed && !yesterdayLog.completed && streak === 0 && getTaskDailyStreak(task.id, shiftDate(selectedDate, -2)) > 0 && !(usedFreezes[task.id] || []).includes(yesterday);
                            return (
                              <span className="task-streak-wrap">
                                {streak > 0 && <span className="task-streak">{streak}d</span>}
                                {canFreeze && <button className="freeze-btn" onClick={() => applyFreeze(task.id)} title={`Use freeze (${streakFreezes} left)`}>🛡 Freeze</button>}
                              </span>
                            );
                          })()}

                          <span className="task-goal-info">
                            {task.dailyGoal && <span>Goal: {task.dailyGoal}</span>}
                            {task.extraThreshold && <span>Bonus: {task.extraThreshold}</span>}
                          </span>

                          <span className="task-weekly-progress">
                            {weeklyCount}<span className="task-weekly-denom">/{task.weeklyGoal}</span>
                          </span>

                          <span className={`status-badge ${weeklyStatus}`}>
                            {shortStatusLabel}
                          </span>

                          <div className="task-action-row">
                            <button className="task-action-mini" onClick={() => { setSelectedTaskId(task.id); setPage("task-detail"); }}>Details</button>
                            <button className="task-action-mini" onClick={() => startEditTask(task)}>Edit</button>
                            <button className="task-action-mini" onClick={() => toggleArchived(task.id)}>Archive</button>
                            <button className="task-action-mini danger-mini" onClick={() => deleteTask(task.id)}>Delete</button>
                          </div>
                        </div>
                        {editingTaskId === task.id && renderTaskForm({ title: task.name, submitLabel: "Save changes" })}
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>

            <div className="card archived-card">
              <h2>Archived Tasks</h2>

              {archivedTasks.length === 0 && <p>No archived tasks.</p>}

              {archivedTasks.map((task) => (
                <div key={task.id} className="task-row archived-row">
                  <div className="task-header">
                    <div>
                      <div className="task-name">{task.name}</div>
                      <div className="task-details">
                        {task.type === "longterm"
                          ? `${task.category || "Uncategorized"} • ${Number(task.currentCount || 0).toLocaleString()} / ${Number(task.targetCount || 0).toLocaleString()} ${task.unitLabel || "total"}`
                          : `${task.category} • ${task.dailyPoints} baseline pts • +${task.extraBonus} extra`}
                      </div>
                    </div>

                    <div className="task-controls">
                      <button
                        className="small-button"
                        onClick={() => toggleArchived(task.id)}
                      >
                        Activate
                      </button>
                      <button
                        className="small-button"
                        onClick={() => startEditTask(task)}
                      >
                        Edit
                      </button>
                      <button
                        className="small-button delete-button"
                        onClick={() => deleteTask(task.id)}
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}

        {page === "task-detail" && (
          <>
            <div className="card">
              <div className="section-header">
                <div>
                  <h2>Task Detail</h2>
                  <div className="section-subtitle">Pick a task to inspect its history and momentum.</div>
                </div>
                <select
                  className="input compact-input"
                  value={selectedTask?.id || ""}
                  onChange={(e) => setSelectedTaskId(e.target.value)}
                >
                  {tasks.map((task) => (
                    <option key={task.id} value={task.id}>{task.name}</option>
                  ))}
                </select>
              </div>
            </div>

            {selectedTask && selectedTaskStats && (
              <>
                <div className="stats-grid stats-grid-four">
                  <div className="card stat-card">
                    <div className="stat-label">Completions</div>
                    <div className="stat-value">{selectedTaskStats.completions}</div>
                    <div className="stat-subvalue">{selectedTaskStats.completionRate}% logged-day rate</div>
                  </div>
                  <div className="card stat-card">
                    <div className="stat-label">Total Points</div>
                    <div className="stat-value">{selectedTaskStats.totalPoints}</div>
                    <div className="stat-subvalue">including bonuses</div>
                  </div>
                  <div className="card stat-card">
                    <div className="stat-label">Active Streak</div>
                    <div className="stat-value">{selectedTaskStats.activeStreak}</div>
                    <div className="stat-subvalue">days</div>
                  </div>
                  <div className="card stat-card">
                    <div className="stat-label">Best Streak</div>
                    <div className="stat-value">{selectedTaskStats.longestStreak}</div>
                    <div className="stat-subvalue">days</div>
                  </div>
                </div>

                <div className="stats-grid stats-grid-three">
                  <div className="card stat-card">
                    <div className="stat-label">This Week</div>
                    <div className="stat-value">{selectedTaskStats.thisWeek}<span className="stats-strip-denom">/{selectedTask.weeklyGoal}</span></div>
                    <div className="stat-subvalue">weekly goal progress</div>
                  </div>
                  <div className="card stat-card">
                    <div className="stat-label">Best Week</div>
                    <div className="stat-value">{selectedTaskStats.bestWeek.completions}</div>
                    <div className="stat-subvalue">{selectedTaskStats.bestWeek.week}</div>
                  </div>
                  <div className="card stat-card">
                    <div className="stat-label">Bonus Count</div>
                    <div className="stat-value">{selectedTaskStats.bonusCount}</div>
                    <div className="stat-subvalue">bonus completions</div>
                  </div>
                </div>

                <div className="card">
                  <h2>{selectedTask.name}</h2>
                  <div className="detail-meta-grid">
                    <div><span>Category</span><strong>{selectedTask.category || "Uncategorized"}</strong></div>
                    <div><span>Daily Goal</span><strong>{selectedTask.dailyGoal || "None"}</strong></div>
                    <div><span>Weekly Goal</span><strong>{selectedTask.weeklyGoal}x/week</strong></div>
                    <div><span>Points</span><strong>{selectedTask.dailyPoints} + {selectedTask.extraBonus}</strong></div>
                  </div>
                </div>

                <div className="card">
                  <h2>Recent Weekly Completions</h2>
                  <div className="chart-wrap">
                    <ResponsiveContainer width="100%" height={260}>
                      <BarChart data={selectedTaskStats.recentWeeks}>
                        <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                        <XAxis dataKey="week" />
                        <YAxis allowDecimals={false} />
                        <Tooltip />
                        <Bar dataKey="completions" fill={PACIFIC_CYAN} radius={[4, 4, 0, 0]} name="Completions" />
                        <Bar dataKey="goal" fill={MUTED_TEAL} radius={[4, 4, 0, 0]} name="Goal" />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </>
            )}
          </>
        )}

        {page === "review" && (
          <>
            <div className="subnav-card">
              <button className={page === "weekly" ? "subnav-button active" : "subnav-button"} onClick={() => setPage("weekly")}>Weekly Streaks</button>
              <button className={page === "review" ? "subnav-button active" : "subnav-button"} onClick={() => setPage("review")}>Weekly Review</button>
            </div>

            <div className="stats-grid stats-grid-four">
              <div className="card stat-card">
                <div className="stat-label">Week Status</div>
                <div className="stat-value">{currentWeekTier}</div>
                <div className="stat-subvalue">{weekLabelFromDate(currentWeekStart)}</div>
              </div>
              <div className="card stat-card">
                <div className="stat-label">Goals Met</div>
                <div className="stat-value">{weeklyReviewData.completed}<span className="stats-strip-denom">/{activeTasks.length}</span></div>
                <div className="stat-subvalue">active tasks</div>
              </div>
              <div className="card stat-card">
                <div className="stat-label">Must Complete</div>
                <div className="stat-value">{weeklyReviewData.mustComplete}</div>
                <div className="stat-subvalue">tasks on the line</div>
              </div>
              <div className="card stat-card">
                <div className="stat-label">Missed</div>
                <div className="stat-value">{weeklyReviewData.missed}</div>
                <div className="stat-subvalue">unrecoverable this week</div>
              </div>
            </div>

            <div className="card">
              <div className="section-header">
                <div>
                  <h2>Weekly Review</h2>
                  <div className="section-subtitle">
                    {weeklyReviewData.strongest ? `${weeklyReviewData.strongest.name} is carrying the week.` : "No active tasks yet."}
                  </div>
                </div>
                <div className={`status-badge ${currentWeekTier.toLowerCase()}`}>{currentWeekTier}</div>
              </div>

              <div className="review-list">
                {weeklyReviewData.taskRows.map((task) => {
                  const label = task.status === "green" ? "Met" : task.status === "must" ? "Must Complete" : task.status === "yellow" ? "On track" : "Missed";
                  return (
                    <div key={task.id} className="review-row">
                      <div>
                        <strong>{task.name}</strong>
                        <span>{task.category || "Uncategorized"}</span>
                      </div>
                      <div className="review-progress">{task.count}/{task.weeklyGoal}</div>
                      <span className={`status-badge ${task.status}`}>{label}</span>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="card">
              <h2>Focus For The Rest Of This Week</h2>
              {weeklyReviewData.focus.length === 0 ? (
                <p className="empty-text">No urgent tasks right now.</p>
              ) : (
                <div className="focus-grid">
                  {weeklyReviewData.focus.map((task) => (
                    <div key={task.id} className="focus-item">
                      <strong>{task.name}</strong>
                      <span>{task.needed} more needed</span>
                      <span className={`status-badge ${task.status}`}>{task.status === "must" ? "Must Complete" : "Missed"}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}

        {page === "calendar" && (
          <>
            <div className="subnav-card">
              <button className={page === "long" ? "subnav-button active" : "subnav-button"} onClick={() => setPage("long")}>Level Tracker</button>
              <button className={page === "calendar" ? "subnav-button active" : "subnav-button"} onClick={() => setPage("calendar")}>Calendar</button>
              <button className={page === "milestones" ? "subnav-button active" : "subnav-button"} onClick={() => setPage("milestones")}>Milestones</button>
            </div>

            <div className="card">
              <div className="section-header">
                <button className="date-arrow" onClick={() => setSelectedDate((prev) => {
                  const d = new Date(prev + "T12:00:00");
                  d.setMonth(d.getMonth() - 1, 1);
                  return d.toISOString().slice(0, 10);
                })}>←</button>
                <div>
                  <h2>{calendarMonth.label}</h2>
                  <div className="section-subtitle">Daily completion density and points.</div>
                </div>
                <button className="date-arrow" onClick={() => setSelectedDate((prev) => {
                  const d = new Date(prev + "T12:00:00");
                  d.setMonth(d.getMonth() + 1, 1);
                  return d.toISOString().slice(0, 10);
                })}>→</button>
              </div>
            </div>

            <div className="card">
              <div className="calendar-grid">
                {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => (
                  <div key={day} className="calendar-weekday">{day}</div>
                ))}
                {Array.from({ length: calendarMonth.leadingBlanks }).map((_, index) => (
                  <div key={`blank-${index}`} className="calendar-day empty" />
                ))}
                {calendarMonth.days.map((day) => (
                  <button
                    key={day.date}
                    className={`calendar-day heat-${Math.min(4, Math.ceil(day.percent / 25))} ${day.date === selectedDate ? "selected" : ""}`}
                    onClick={() => setSelectedDate(day.date)}
                    title={`${day.date}: ${day.completed}/${day.total} tasks, ${day.points} pts`}
                  >
                    <span>{day.day}</span>
                    <strong>{day.percent}%</strong>
                    <em>{day.points} pts</em>
                  </button>
                ))}
              </div>
            </div>
          </>
        )}

        {page === "milestones" && (
          <>
            <div className="subnav-card">
              <button className={page === "long" ? "subnav-button active" : "subnav-button"} onClick={() => setPage("long")}>Level Tracker</button>
              <button className={page === "calendar" ? "subnav-button active" : "subnav-button"} onClick={() => setPage("calendar")}>Calendar</button>
              <button className={page === "milestones" ? "subnav-button active" : "subnav-button"} onClick={() => setPage("milestones")}>Milestones</button>
            </div>

            <div className="card">
              <h2>Milestones Timeline</h2>
              <div className="section-subtitle">A running history of earned achievements.</div>
            </div>

            <div className="timeline-list">
              {milestoneTimeline.length === 0 ? (
                <div className="card"><p className="empty-text">No milestones earned yet.</p></div>
              ) : (
                milestoneTimeline.map((badge) => (
                  <div key={`${badge.id}-${badge.date}`} className="timeline-item">
                    <div className="timeline-icon">{badge.icon}</div>
                    <div>
                      <strong>{badge.name}</strong>
                      <span>{badge.desc}</span>
                    </div>
                    <time>{badge.date}</time>
                  </div>
                ))
              )}
            </div>
          </>
        )}

        {page === "weekly" && (
          <>
            <div className="subnav-card">
              <button className={page === "weekly" ? "subnav-button active" : "subnav-button"} onClick={() => setPage("weekly")}>Weekly Streaks</button>
              <button className={page === "review" ? "subnav-button active" : "subnav-button"} onClick={() => setPage("review")}>Weekly Review</button>
            </div>

            <div className="stats-grid stats-grid-three">
              <div className="card stat-card">
                <div className="stat-label">Activity Streak</div>
                <div className="stat-value">{activityStreak}</div>
              </div>
              <div className="card stat-card">
                <div className="stat-label">Daily Perfect Streak</div>
                <div className="stat-value">{dailyPerfectStreak}</div>
              </div>
              <div className="card stat-card">
                <div className="stat-label">Weekly Perfect Streak</div>
                <div className="stat-value">{weeklyPerfectStreak}</div>
              </div>
            </div>

            <div className="card">
              <h2>Category Streaks</h2>
              <div className="category-streak-grid">
                {categories.map((category) => (
                  <div key={category} className="category-streak-card">
                    <div className="task-name">{category}</div>
                    <div className="category-streak-value">{categoryStreaks[category] || 0}</div>
                  </div>
                ))}
              </div>
            </div>

            <div className="card">
              <h2>Cumulative Points Comparison</h2>
              <div className="chart-wrap">
                <ResponsiveContainer width="100%" height={260}>
                  <LineChart data={weeklyComparisonChartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                    <XAxis dataKey="day" />
                    <YAxis />
                    <Tooltip />
                    <Line type="monotone" dataKey="thisWeek" stroke={PACIFIC_CYAN} strokeWidth={3} name="This week" dot={false} />
                    <Line type="monotone" dataKey="lastWeek" stroke={STEEL_BLUE} strokeWidth={2} strokeDasharray="6 4" name="Last week" dot={false} />
                    <Line type="monotone" dataKey="bestWeek" stroke={MUTED_TEAL} strokeWidth={2} strokeDasharray="2 6" name="Best week" dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
              <div className="chart-legend-note">
                This week = bold line. Last week = dashed. Best week = dotted.
              </div>
            </div>

            <div className="card">
              <h2>Daily % Complete This Week</h2>
              <div className="chart-wrap">
                <ResponsiveContainer width="100%" height={260}>
                  <LineChart data={currentWeekChartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                    <XAxis dataKey="day" />
                    <YAxis domain={[0, 100]} />
                    <Tooltip />
                    <Line type="monotone" dataKey="percent" stroke={STEEL_BLUE} strokeWidth={3} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          </>
        )}

        {page === "long" && (
          <>
            <div className="subnav-card">
              <button className={page === "long" ? "subnav-button active" : "subnav-button"} onClick={() => setPage("long")}>Level Tracker</button>
              <button className={page === "calendar" ? "subnav-button active" : "subnav-button"} onClick={() => setPage("calendar")}>Calendar</button>
              <button className={page === "milestones" ? "subnav-button active" : "subnav-button"} onClick={() => setPage("milestones")}>Milestones</button>
            </div>

            {/* Level card */}
            <div className="card level-card">
              <h2>Level Tracker</h2>
              <div className="level-header">
                <div>
                  <div className="level-badge">Level {currentLevelData.level}</div>
                  <div className="level-name">{currentLevelData.name}</div>
                </div>
                {nextLevelData && (
                  <div className="level-next">Next: <strong>Lv.{nextLevelData.level} {nextLevelData.name}</strong></div>
                )}
              </div>
              {nextLevelData ? (
                <div className="level-progress-rows">
                  <div className="level-progress-row">
                    <span className="level-progress-label">Lifetime pts</span>
                    <div className="level-progress-bar-wrap">
                      <div className="level-progress-bar" style={{ width: `${Math.min(100, ((lifetimePoints - currentLevelData.lifetimePts) / Math.max(1, nextLevelData.lifetimePts - currentLevelData.lifetimePts)) * 100)}%` }} />
                    </div>
                    <span className="level-progress-value">{lifetimePoints.toLocaleString()} / {nextLevelData.lifetimePts.toLocaleString()}</span>
                  </div>
                  <div className="level-progress-row">
                    <span className="level-progress-label">Last 90 days</span>
                    <div className="level-progress-bar-wrap">
                      <div className="level-progress-bar" style={{ width: `${Math.min(100, ((recentPoints - currentLevelData.recentPts) / Math.max(1, nextLevelData.recentPts - currentLevelData.recentPts)) * 100)}%` }} />
                    </div>
                    <span className="level-progress-value">{recentPoints.toLocaleString()} / {nextLevelData.recentPts.toLocaleString()}</span>
                  </div>
                  {nextLevelData.greatWeeks > 0 && (
                    <div className="level-progress-row">
                      <span className="level-progress-label">Great weeks</span>
                      <div className="level-progress-bar-wrap">
                        <div className="level-progress-bar" style={{ width: `${Math.min(100, ((totalGreatWeeks - currentLevelData.greatWeeks) / Math.max(1, nextLevelData.greatWeeks - currentLevelData.greatWeeks)) * 100)}%` }} />
                      </div>
                      <span className="level-progress-value">{totalGreatWeeks} / {nextLevelData.greatWeeks}</span>
                    </div>
                  )}
                  {nextLevelData.greatPct > 0 && (
                    <div className="level-progress-row">
                      <span className="level-progress-label">Great wk %</span>
                      <div className="level-progress-bar-wrap">
                        <div className="level-progress-bar" style={{ width: `${Math.min(100, (greatWeekPct / nextLevelData.greatPct) * 100)}%` }} />
                      </div>
                      <span className="level-progress-value">{greatWeekPct}% / {nextLevelData.greatPct}%</span>
                    </div>
                  )}
                  {nextLevelData.perfectPct > 0 && (
                    <div className="level-progress-row">
                      <span className="level-progress-label">Perfect wk %</span>
                      <div className="level-progress-bar-wrap">
                        <div className="level-progress-bar" style={{ width: `${Math.min(100, (perfectWeekPct / nextLevelData.perfectPct) * 100)}%` }} />
                      </div>
                      <span className="level-progress-value">{perfectWeekPct}% / {nextLevelData.perfectPct}%</span>
                    </div>
                  )}
                </div>
              ) : (
                <div className="level-max-text">Max level reached. You are Transcendent.</div>
              )}
            </div>

            {/* Personal Records + Streaks + Freezes row */}
            <div className="stats-grid stats-grid-three">
              <div className="card stat-card">
                <div className="stat-label">Best Day</div>
                <div className="stat-value">{personalRecords.bestDayPoints}</div>
                <div className="stat-subvalue">points in one day</div>
              </div>
              <div className="card stat-card">
                <div className="stat-label">Best Week</div>
                <div className="stat-value">{personalRecords.bestWeekPoints}</div>
                <div className="stat-subvalue">points in one week</div>
              </div>
              <div className="card stat-card">
                <div className="stat-label">Longest Streak</div>
                <div className="stat-value">{longestTaskStreak.days}</div>
                <div className="stat-subvalue">{longestTaskStreak.taskName}</div>
                <div className="stat-subvalue">{longestTaskStreak.isStillActive ? "Still active" : "No longer active"}</div>
              </div>
            </div>

            <div className="stats-grid stats-grid-single">
              <div className="card stat-card">
                <div className="stat-label">Longest Active Streak</div>
                <div className="stat-value">{longestActiveTaskStreak.days}</div>
                <div className="stat-subvalue">{longestActiveTaskStreak.taskName}</div>
              </div>
            </div>

            <div className="stats-grid stats-grid-three week-tier-grid">
              {[
                { id: "great", label: "Great Weeks", value: totalGreatWeeks },
                { id: "excellent", label: "Excellent Weeks", value: totalExcellentWeeks },
                { id: "perfect", label: "Perfect Weeks", value: totalPerfectWeeks },
              ].map((tier) => (
                <div className="week-tier-item" key={tier.id}>
                  <button
                    className="week-tier-card"
                    type="button"
                    onClick={() => showWeekInfo(tier.id)}
                    aria-expanded={weekInfoVisible === tier.id}
                  >
                    <span className="stat-label">{tier.label}</span>
                    <strong className="stat-value">{tier.value}</strong>
                    <span className="stat-subvalue">Criteria</span>
                  </button>
                  {weekInfoVisible === tier.id && (
                    <div className="info-popover" role="note">
                      {weekTierInfo[tier.id]}
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* Streak freezes */}
            <div className="card freeze-card">
              <div className="freeze-header">
                <div>
                  <h2 style={{margin:0}}>Streak Freezes</h2>
                  <div className="section-subtitle">Earned by completing perfect weeks. Max 3 held at a time.</div>
                </div>
                <div className="freeze-count">
                  {[0,1,2].map(i => (
                    <span key={i} className={`freeze-pip ${i < streakFreezes ? "active" : ""}`}>🛡</span>
                  ))}
                  <span className="freeze-count-label">{streakFreezes}/3</span>
                </div>
              </div>
              <div className="section-subtitle" style={{marginTop:8}}>Use a freeze on a task card when you miss a day to protect your streak.</div>
            </div>

            {/* Badges */}
            <div className="card">
              <h2>Badges</h2>
              <div className="badges-grid">
                {allBadges.map((badge) => {
                  const earned = earnedBadges[badge.id];
                  return (
                    <div key={badge.id} className={`badge-card ${earned ? "earned" : "locked"}`} title={earned ? `Earned ${earned}` : "Locked"}>
                      <div className="badge-icon">{earned ? badge.icon : "🔒"}</div>
                      <div className="badge-name">{badge.name}</div>
                      <div className="badge-desc">{badge.desc}</div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Streaks */}
            <div className="stats-grid stats-grid-three">
              <div className="card stat-card">
                <div className="stat-label">Activity Streak</div>
                <div className="stat-value">{activityStreak}</div>
              </div>
              <div className="card stat-card">
                <div className="stat-label">Daily Perfect Streak</div>
                <div className="stat-value">{dailyPerfectStreak}</div>
              </div>
              <div className="card stat-card">
                <div className="stat-label">Weekly Perfect Streak</div>
                <div className="stat-value">{weeklyPerfectStreak}</div>
              </div>
            </div>

            <div className="card">
              <h2>Weekly Goal Heatmap</h2>
              <div className="heatmap-scroll">
                <div className="heatmap-grid">
                  <div className="heatmap-month-header-row">
                    <div className="heatmap-row-label" />
                    {recentWeekStarts.map((weekStart, i) => {
                      const d = new Date(weekStart + "T12:00:00");
                      const prev = i > 0 ? new Date(recentWeekStarts[i - 1] + "T12:00:00") : null;
                      const showMonth = !prev || d.getMonth() !== prev.getMonth();
                      return (
                        <div key={weekStart} className="heatmap-month-slot">
                          {showMonth ? d.toLocaleDateString(undefined, { month: "short" }) : ""}
                        </div>
                      );
                    })}
                  </div>
                  {activeTasks.map((task) => {
                    return (
                      <div key={task.id} className="heatmap-task-row">
                        <span className="heatmap-row-label" title={task.name}>{task.name}</span>
                        <div className="heatmap-cells">
                          {recentWeekStarts.map((weekStart) => {
                            const wEnd = getWeekDates(weekStart)[6];
                            const isFuture = weekStart > currentWeekStart;
                            const count = getWeeklyCompletionCount(task, wEnd);
                            const met = count >= task.weeklyGoal;
                            const statusClass = isFuture ? "heatmap-cell heatmap-empty" : met ? "heatmap-cell heatmap-met" : "heatmap-cell heatmap-missed";
                            return (
                              <div
                                key={weekStart}
                                className={statusClass}
                                title={`${weekLabelFromDate(weekStart)}: ${count}/${task.weeklyGoal}${isFuture ? " (future)" : met ? " ✓" : " ✗"}`}
                              />
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
              <div className="heatmap-legend">
                <div className="heatmap-cell heatmap-met" />
                <span className="heatmap-legend-text">Goal met</span>
                <div className="heatmap-cell heatmap-missed" style={{marginLeft: 8}} />
                <span className="heatmap-legend-text">Missed</span>
              </div>
            </div>

            <div className="card">
              <h2>Average Daily Points by Week</h2>
              <div className="chart-wrap">
                <ResponsiveContainer width="100%" height={260}>
                  <BarChart data={weeklyAverageChartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                    <XAxis dataKey="week" />
                    <YAxis />
                    <Tooltip />
                    <Bar dataKey="avgPoints" fill={STEEL_BLUE} radius={[4, 4, 0, 0]} name="Avg pts/day" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="card">
              <h2>Average Daily % Complete by Week</h2>
              <div className="chart-wrap">
                <ResponsiveContainer width="100%" height={260}>
                  <LineChart data={weeklyAverageChartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                    <XAxis dataKey="week" />
                    <YAxis domain={[0, 100]} />
                    <Tooltip />
                    <Line type="monotone" dataKey="avgPercent" stroke={STEEL_BLUE} strokeWidth={3} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export default App;
