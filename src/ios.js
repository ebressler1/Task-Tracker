import { Capacitor, registerPlugin } from "@capacitor/core";
import { useEffect } from "react";
import { getWidgetProgress } from "./widgetProgress";

export const isIOS = Capacitor.getPlatform() === "ios";
const Tracker = registerPlugin("TaskTracker");

export const signInWithNativeGoogle = () => Tracker.signIn();
export const signOutFromNativeGoogle = () => Tracker.signOut();

export function useProgressWidget({ authLoading, userId, loadedUserId, tasks, logs }) {
  useEffect(() => {
    if (!isIOS || authLoading) return;
    if (!userId || loadedUserId !== userId) {
      Tracker.clearProgress().catch(console.warn);
      return;
    }

    const update = () => {
      if (!document.hidden) Tracker.setProgress(getWidgetProgress(tasks, logs)).catch(console.warn);
    };
    update();
    document.addEventListener("visibilitychange", update);
    const timer = window.setInterval(update, 60_000);
    return () => {
      document.removeEventListener("visibilitychange", update);
      window.clearInterval(timer);
    };
  }, [authLoading, userId, loadedUserId, tasks, logs]);
}
