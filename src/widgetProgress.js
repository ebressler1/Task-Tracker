function dateKey(date) {
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

export function getWidgetProgress(tasks, logs, now = new Date()) {
  const today = dateKey(now);
  const monday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 12);
  monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7));
  const weekStart = dateKey(monday);
  const weeklyTasks = tasks.filter(task => task.active && (task.type ?? "weekly") === "weekly");
  const weeklyGoals = weeklyTasks.filter(task => task.weeklyGoal > 0);
  const weekDays = [];
  for (const day = new Date(monday); dateKey(day) <= today; day.setDate(day.getDate() + 1)) {
    weekDays.push(dateKey(day));
  }

  return {
    today,
    weekStart,
    tasksCompleted: weeklyTasks.filter(task => logs[today]?.[task.id]?.completed).length,
    taskCount: weeklyTasks.length,
    goalsMet: weeklyGoals.filter(task =>
      weekDays.filter(day => logs[day]?.[task.id]?.completed).length >= task.weeklyGoal
    ).length,
    goalCount: weeklyGoals.length,
  };
}
