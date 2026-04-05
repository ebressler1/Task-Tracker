import { useEffect, useMemo, useState } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import "./App.css";

const CATEGORY_STORAGE_KEY = "achievement_categories";
const todayString = () => new Date().toISOString().slice(0, 10);

const DEFAULT_CATEGORIES = [
  "Fitness",
  "Education",
  "Career/Work",
  "Personal/Life",
  "Chores",
  "Self-Improvement/Skills",
];

const TASKS_STORAGE_KEY = "achievement_tasks";
const LOGS_STORAGE_KEY = "achievement_logs";

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

function getRemainingDaysInWeek(dateString) {
  const date = new Date(dateString + "T12:00:00");
  const day = date.getDay();
  if (day === 0) return 0;
  return 7 - day;
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

  const weekEnd = dates[6];
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

function generateDemoLogs(tasks) {
  const logs = {};
  const today = new Date();
  const start = new Date();
  start.setDate(today.getDate() - 89);

  const taskMap = Object.fromEntries(tasks.map((task) => [task.name, task.id]));

  for (let d = new Date(start); d <= today; d.setDate(d.getDate() + 1)) {
    const dateKey = d.toISOString().slice(0, 10);
    const day = d.getDay(); // 0 Sun ... 6 Sat

    logs[dateKey] = {};

    const maybeComplete = (taskName, completedChance, extraChance = 0) => {
      const taskId = taskMap[taskName];
      if (!taskId) return;

      const completed = Math.random() < completedChance;
      const extra = completed && Math.random() < extraChance;

      logs[dateKey][taskId] = {
        completed,
        extra,
      };
    };

    maybeComplete("Workout", [1, 3, 5].includes(day) ? 0.85 : 0.2, 0.25);
    maybeComplete("Anki", day === 0 ? 0.55 : 0.88, 0.2);
    maybeComplete("Case prep", [1, 2, 3, 4, 5].includes(day) ? 0.8 : 0.15, 0.2);
    maybeComplete("Call Mom", [0, 3].includes(day) ? 0.55 : 0.08, 0.05);
    maybeComplete("Cat litter", [1, 2, 4, 6].includes(day) ? 0.75 : 0.25, 0.1);
    maybeComplete("Spanish", [1, 2, 3, 4, 6].includes(day) ? 0.7 : 0.2, 0.15);
    maybeComplete("Laundry", [3, 6].includes(day) ? 0.65 : 0.05, 0.1);
  }

  return logs;
}

function App() {
  const [page, setPage] = useState("activities");
  const [theme, setTheme] = useState(() => {
    return localStorage.getItem("achievement_theme") || "light";
  });
  const [selectedDate, setSelectedDate] = useState(todayString());
  const [tasks, setTasks] = useState(defaultTasks);
  const [logs, setLogs] = useState({});
  const [editingTaskId, setEditingTaskId] = useState(null);

  const [customCategories, setCustomCategories] = useState([]);
  const [showCustomCategoryInput, setShowCustomCategoryInput] = useState(false);
  const [newCategory, setNewCategory] = useState("");

  const seedDemoData = () => {
  setTasks(defaultTasks);
  setLogs(generateDemoLogs(defaultTasks));
  setSelectedDate(todayString());
};

  const emptyForm = {
    name: "",
    category: "",
    dailyGoal: "",
    dailyPoints: "",
    extraThreshold: "",
    extraBonus: "",
    weeklyGoal: "",
    weeklyBonus: "",
  };

  const [form, setForm] = useState(emptyForm);

  useEffect(() => {
  const savedTasks =
    localStorage.getItem(TASKS_STORAGE_KEY) ??
    localStorage.getItem("achievement_tasks_v5");

  const savedLogs =
    localStorage.getItem(LOGS_STORAGE_KEY) ??
    localStorage.getItem("achievement_logs_v5");

  if (savedTasks) {
    const parsedTasks = JSON.parse(savedTasks);
    const migratedTasks = parsedTasks.map((task) => ({
      id: task.id ?? Date.now() + Math.random(),
      name: task.name ?? "",
      category: task.category ?? "",
      dailyGoal: task.dailyGoal ?? "",
      dailyPoints: task.dailyPoints ?? 0,
      extraThreshold: task.extraThreshold ?? "",
      extraBonus: task.extraBonus ?? 0,
      weeklyGoal: task.weeklyGoal ?? 0,
      weeklyBonus: task.weeklyBonus ?? 0,
      active: task.active ?? true,
    }));
    setTasks(migratedTasks);
  } else {
    setTasks(defaultTasks);
  }

  if (savedLogs) {
    setLogs(JSON.parse(savedLogs));
  }
}, []);

useEffect(() => {
  const saved = localStorage.getItem(CATEGORY_STORAGE_KEY);
  if (saved) setCustomCategories(JSON.parse(saved));
}, []);

useEffect(() => {
  localStorage.setItem("achievement_theme", theme);
  document.body.classList.remove("theme-light", "theme-dark");
  document.body.classList.add(`theme-${theme}`);
}, [theme]);

useEffect(() => {
  localStorage.setItem(CATEGORY_STORAGE_KEY, JSON.stringify(customCategories));
}, [customCategories]);

useEffect(() => {
  localStorage.setItem(TASKS_STORAGE_KEY, JSON.stringify(tasks));
}, [tasks]);

useEffect(() => {
  localStorage.setItem(LOGS_STORAGE_KEY, JSON.stringify(logs));
}, [logs]);

  const activeTasks = tasks.filter((task) => task.active);
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

  const calculateDailyPointsForTask = (taskId, date) => {
    const task = tasks.find((t) => t.id === taskId);
    if (!task) return 0;
    const log = getTaskLog(taskId, date);
    if (!log.completed) return 0;
    return task.dailyPoints + (log.extra ? task.extraBonus : 0);
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

    const remainingDays = getRemainingDaysInWeek(weekAnchorDate);
    const needed = task.weeklyGoal - completions;

    if (needed > remainingDays) return "red";
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

  const allLoggedDates = useMemo(() => Object.keys(logs).sort(), [logs]);

  const firstLoggedDate = useMemo(() => {
    return allLoggedDates.length > 0 ? allLoggedDates[0] : null;
  }, [allLoggedDates]);

  const firstLoggedWeekStart = useMemo(() => {
    return firstLoggedDate ? getWeekStart(firstLoggedDate) : getWeekStart(todayString());
  }, [firstLoggedDate]);

  const weekDates = useMemo(() => getWeekDates(selectedDate), [selectedDate]);

  const dailyBaselineAvailable = useMemo(() => {
    return activeTasks.reduce((sum, task) => sum + task.dailyPoints, 0);
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
  const weeklyBaselineAvailable = useMemo(() => {
    return weekDates.reduce((sum) => {
      return sum + activeTasks.reduce((daySum, task) => daySum + task.dailyPoints, 0);
    }, 0);
  }, [activeTasks, weekDates]);

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

  const startAddTask = () => {
    setEditingTaskId(null);
    setForm(emptyForm);
  };

  const startEditTask = (task) => {
    setEditingTaskId(task.id);
    setForm({
      name: task.name,
      category: task.category,
      dailyGoal: task.dailyGoal,
      dailyPoints: String(task.dailyPoints),
      extraThreshold: task.extraThreshold,
      extraBonus: String(task.extraBonus),
      weeklyGoal: String(task.weeklyGoal),
      weeklyBonus: String(task.weeklyBonus),
    });
  };

  const saveTask = () => {
    if (!form.name.trim()) return;

    const taskPayload = {
      name: form.name.trim(),
      category: form.category.trim(),
      dailyGoal: form.dailyGoal.trim(),
      dailyPoints: Number(form.dailyPoints) || 0,
      extraThreshold: form.extraThreshold.trim(),
      extraBonus: Number(form.extraBonus) || 0,
      weeklyGoal: Number(form.weeklyGoal) || 0,
      weeklyBonus: Number(form.weeklyBonus) || 0,
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
  };

  const cancelEdit = () => {
    setEditingTaskId(null);
    setForm(emptyForm);
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

  const toggleComplete = (taskId) => {
    const current = getTaskLog(taskId, selectedDate);
    const nextCompleted = !current.completed;

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

  return (
    <div className="app">
      <div className="container">
        <div className="top-bar">
          <div className="top-bar-title">
            <h1>Achievement Tracker</h1>
            <p className="subtitle">Consistency over binge productivity.</p>
          </div>

          <div className="top-bar-actions">
            <button
              className="theme-toggle"
              onClick={() => setTheme((prev) => (prev === "light" ? "dark" : "light"))}
            >
              {theme === "light" ? "Dark mode" : "Light mode"}
            </button>

            <div className="nav-buttons">
              <button
                className={page === "activities" ? "nav-button active" : "nav-button"}
                onClick={() => setPage("activities")}
              >
                Activities
              </button>
              <button
                className={page === "weekly" ? "nav-button active" : "nav-button"}
                onClick={() => setPage("weekly")}
              >
                Weekly Streak Tracker
              </button>
              <button
                className={page === "long" ? "nav-button active" : "nav-button"}
                onClick={() => setPage("long")}
              >
                Long Streak Tracker
              </button>
            </div>
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

            <div className="stats-grid stats-grid-four">
              <div className="card stat-card">
                <div className="stat-label">Today Baseline</div>
                <div className="speedometer-wrap">
                  <div
                    className="speedometer"
                    style={{
                      background: `conic-gradient(
                        var(--pacific-cyan) 0deg ${dailyBaselinePercent * 3.6}deg,
                        rgba(118, 159, 182, 0.14) ${dailyBaselinePercent * 3.6}deg 360deg
                      )`,
                    }}
                  >
                    <div className="speedometer-inner">
                      <div className="speedometer-fraction">
                        {dailyBaselineEarned} / {dailyBaselineAvailable}
                      </div>
                      <div className="speedometer-percent">{dailyBaselinePercent}%</div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="card stat-card">
                <div className="stat-label">Today Total Points</div>
                <div className="stat-value">{todayPoints}</div>
                <div className="stat-subvalue">+{dailyExtraPoints} extra</div>
              </div>

              <div className="card stat-card">
                <div className="stat-label">Week Baseline</div>
                <div className="stat-value">
                  {weeklyBaselineEarned} / {weeklyBaselineAvailable}
                </div>
                <div className="stat-subvalue">
                  {formatPercent(weeklyBaselineEarned, weeklyBaselineAvailable)}
                </div>
              </div>

              <div className="card stat-card">
                <div className="stat-label">Week Total Points</div>
                <div className="stat-value">{weeklyTotalPoints}</div>
                <div className="stat-subvalue">
                  {weeklyExtraPoints >= 0 ? "+" : ""}
                  {weeklyExtraPoints} extra • {weeklyAdjustments >= 0 ? "+" : ""}
                  {weeklyAdjustments} weekly adj
                </div>
              </div>
            </div>

            <div className="card">
              <div className="section-header section-header-stack">
                <div>
                  <h2>Active Tasks</h2>
                  <div className="section-subtitle">
                    Grouped by category. Tap the check to complete the task for the selected day.
                  </div>
                </div>

                <div className="task-controls">
                  <button className="small-button secondary-button" onClick={seedDemoData}>
                    Seed 3 Months Demo Data
                  </button>
                  <button className="small-button" onClick={startAddTask}>
                    New Task
                  </button>
                </div>
              </div>

              {activeTasks.length === 0 && <p className="empty-text">No active tasks yet.</p>}

              {groupedActiveTasks.map(([categoryName, tasksInCategory]) => (
                <div key={categoryName} className="task-category-block">
                  <div className="task-category-header">
                    <h3>{categoryName}</h3>
                    <span className="task-category-count">{tasksInCategory.length}</span>
                  </div>

                  <div className="task-category-grid">
                    {tasksInCategory.map((task) => {
                      const log = getTaskLog(task.id, selectedDate);
                      const points = calculateDailyPointsForTask(task.id, selectedDate);
                      const weeklyCount = getWeeklyCompletionCount(task, selectedDate);
                      const weeklyStatus = getWeeklyStatus(task, selectedDate);
                      const weeklyStatusLabel =
                        weeklyStatus === "green"
                          ? "Weekly Goal Met"
                          : weeklyStatus === "yellow"
                          ? "Weekly Goal Possible"
                          : "Weekly Goal Missed";

                      return (
                        <div
                          key={task.id}
                          className={`task-compact-card ${log.completed ? "is-complete" : ""}`}
                        >
                          <div className="task-left-controls">
                            <button
                              className={`task-complete-button ${log.completed ? "checked" : ""}`}
                              onClick={() => toggleComplete(task.id)}
                              aria-label={`Complete ${task.name}`}
                              title={`Complete ${task.name}`}
                            >
                              <span className="task-button-check">{log.completed ? "✓" : "○"}</span>
                              <span className="task-button-label">Complete</span>
                            </button>

                            <button
                              className={`task-bonus-button ${log.extra ? "active" : ""}`}
                              onClick={() => toggleExtra(task.id)}
                              disabled={!log.completed}
                              aria-label={`Bonus ${task.name}`}
                              title={`Bonus ${task.name}`}
                            >
                              <span className="task-button-check">{log.extra ? "✓" : "+"}</span>
                              <span className="task-button-label">Bonus</span>
                            </button>
                          </div>

                          <div className="task-main">
                            <div className="task-title-stack">
                              <div className="task-title-row">
                                <div className="task-name">{task.name}</div>
                                <div className="task-goal-inline">Goal: {task.dailyGoal}</div>
                              </div>
                            </div>

                            <div className="task-stats-row">
                              <div className="task-points-box">
                                <div className="task-points-label">pts today</div>
                                <div className="task-points-value">{points}</div>
                              </div>

                              <div className="task-chip">
                                <span className="task-chip-label">Baseline</span>
                                <span className="task-chip-value">{task.dailyPoints}</span>
                              </div>

                              <div className="task-chip">
                                <span className="task-chip-label">Bonus</span>
                                <span className="task-chip-value">
                                  +{task.extraBonus} at {task.extraThreshold}
                                </span>
                              </div>

                              <div className="task-chip">
                                <span className="task-chip-label">Weekly</span>
                                <span className="task-chip-value">
                                  {weeklyCount}/{task.weeklyGoal}
                                </span>
                              </div>

                              <div className={`status-badge ${weeklyStatus}`}>
                                {weeklyStatusLabel}
                              </div>
                            </div>

                            <div className="task-action-row">
                              <button
                                className="task-action-button subtle-button"
                                onClick={() => startEditTask(task)}
                              >
                                Edit
                              </button>

                              <button
                                className="task-action-button subtle-button"
                                onClick={() => toggleArchived(task.id)}
                              >
                                Archive
                              </button>

                              <button
                                className="task-action-button subtle-button danger-button"
                                onClick={() => deleteTask(task.id)}
                              >
                                Delete
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>

            <div className="card">
              <h2>{editingTaskId ? "Edit Task" : "Add Task"}</h2>

              <div className="labeled-form-grid">
                <div className="field-group">
                  <label className="field-label">Task Name</label>
                  <input
                    className="input"
                    placeholder="Workout"
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                  />
                </div>

                <div className="field-group">
                  <label className="field-label">Category</label>
                  <select
                    className="input"
                    value={form.category}
                    onChange={(e) => {
                      if (e.target.value === "__custom__") {
                        setShowCustomCategoryInput(true);
                      } else {
                        setForm({ ...form, category: e.target.value });
                        setShowCustomCategoryInput(false);
                      }
                    }}
                  >
                    <option value="">Select category</option>
                    {[...DEFAULT_CATEGORIES, ...customCategories].map((cat) => (
                      <option key={cat} value={cat}>
                        {cat}
                      </option>
                    ))}
                    <option value="__custom__">+ Add Custom</option>
                  </select>
                  {showCustomCategoryInput && (
                    <div style={{ marginTop: "8px" }}>
                      <input
                        className="input"
                        placeholder="Enter new category"
                        value={newCategory}
                        onChange={(e) => setNewCategory(e.target.value)}
                      />
                      <button
                        className="small-button"
                        style={{ marginTop: "6px" }}
                        onClick={() => {
                          if (!newCategory.trim()) return;

                          const updated = [...customCategories, newCategory.trim()];
                          setCustomCategories(updated);

                          setForm({ ...form, category: newCategory.trim() });
                          setNewCategory("");
                          setShowCustomCategoryInput(false);
                        }}
                      >
                        Save Category
                      </button>
                    </div>
                  )}
                </div>

                <div className="field-group">
                  <label className="field-label">Daily Goal</label>
                  <input
                    className="input"
                    placeholder="30 minutes"
                    value={form.dailyGoal}
                    onChange={(e) => setForm({ ...form, dailyGoal: e.target.value })}
                  />
                </div>

                <div className="field-group">
                  <label className="field-label">Daily Points</label>
                  <input
                    className="input"
                    type="number"
                    placeholder="10"
                    value={form.dailyPoints}
                    onChange={(e) => setForm({ ...form, dailyPoints: e.target.value })}
                  />
                </div>

                <div className="field-group">
                  <label className="field-label">Extra Threshold</label>
                  <input
                    className="input"
                    placeholder="60 minutes"
                    value={form.extraThreshold}
                    onChange={(e) => setForm({ ...form, extraThreshold: e.target.value })}
                  />
                </div>

                <div className="field-group">
                  <label className="field-label">Extra Points</label>
                  <input
                    className="input"
                    type="number"
                    placeholder="5"
                    value={form.extraBonus}
                    onChange={(e) => setForm({ ...form, extraBonus: e.target.value })}
                  />
                </div>

                <div className="field-group">
                  <label className="field-label">Weekly Goal (times/week)</label>
                  <input
                    className="input"
                    type="number"
                    placeholder="3"
                    value={form.weeklyGoal}
                    onChange={(e) => setForm({ ...form, weeklyGoal: e.target.value })}
                  />
                </div>

                <div className="field-group">
                  <label className="field-label">Weekly Goal Bonus Points</label>
                  <input
                    className="input"
                    type="number"
                    placeholder="20"
                    value={form.weeklyBonus}
                    onChange={(e) => setForm({ ...form, weeklyBonus: e.target.value })}
                  />
                </div>
              </div>

              <div className="task-controls">
                <button className="small-button" onClick={saveTask}>
                  {editingTaskId ? "Save Changes" : "Add Task"}
                </button>
                {editingTaskId && (
                  <button className="small-button archive-button" onClick={cancelEdit}>
                    Cancel
                  </button>
                )}
              </div>
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
                        {task.category} • {task.dailyPoints} baseline pts • +{task.extraBonus} extra
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

        {page === "weekly" && (
          <>
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
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="day" />
                    <YAxis />
                    <Tooltip />
                    <Line
                      type="monotone"
                      dataKey="thisWeek"
                      strokeWidth={4}
                      name="This week"
                    />
                    <Line
                      type="monotone"
                      dataKey="lastWeek"
                      strokeWidth={2}
                      strokeDasharray="6 4"
                      name="Last week"
                    />
                    <Line
                      type="monotone"
                      dataKey="bestWeek"
                      strokeWidth={2}
                      strokeDasharray="2 6"
                      name="Best week"
                    />
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
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="day" />
                    <YAxis domain={[0, 100]} />
                    <Tooltip />
                    <Line type="monotone" dataKey="percent" strokeWidth={3} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          </>
        )}

        {page === "long" && (
          <>
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
              <h2>Weekly Goal Matrix</h2>
              <div className="matrix-scroll">
                <table className="matrix-table">
                  <thead>
                    <tr>
                      <th>Task</th>
                      {recentWeekStarts.map((weekStart) => (
                        <th key={weekStart}>{weekLabelFromDate(weekStart)}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {activeTasks.map((task) => (
                      <tr key={task.id}>
                        <td>{task.name}</td>
                        {recentWeekStarts.map((weekStart) => {
                          const weekEnd = getWeekDates(weekStart)[6];
                          const success =
                            getWeeklyCompletionCount(task, weekEnd) >= task.weeklyGoal;
                          return (
                            <td key={weekStart}>
                              <div className={success ? "matrix-cell green" : "matrix-cell red"} />
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="card">
              <h2>Average Daily Points by Week</h2>
              <div className="chart-wrap">
                <ResponsiveContainer width="100%" height={260}>
                  <LineChart data={weeklyAverageChartData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="week" />
                    <YAxis />
                    <Tooltip />
                    <Line type="monotone" dataKey="avgPoints" strokeWidth={3} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="card">
              <h2>Average Daily % Complete by Week</h2>
              <div className="chart-wrap">
                <ResponsiveContainer width="100%" height={260}>
                  <LineChart data={weeklyAverageChartData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="week" />
                    <YAxis domain={[0, 100]} />
                    <Tooltip />
                    <Line type="monotone" dataKey="avgPercent" strokeWidth={3} />
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