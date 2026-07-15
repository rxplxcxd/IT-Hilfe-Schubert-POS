'use client';

import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';

export interface NotificationSummary {
  pendingUsers: number;
  openAppointments: number;
  dueReminders: number;
  total: number;
}

interface NotificationContextValue extends NotificationSummary {
  refresh: () => void;
}

const DEFAULT: NotificationContextValue = {
  pendingUsers: 0,
  openAppointments: 0,
  dueReminders: 0,
  total: 0,
  refresh: () => {},
};

const NotificationContext = createContext<NotificationContextValue>(DEFAULT);

export function useNotifications() {
  return useContext(NotificationContext);
}

export function NotificationProvider({ children }: { children: ReactNode }) {
  const [summary, setSummary] = useState<NotificationSummary>({
    pendingUsers: 0,
    openAppointments: 0,
    dueReminders: 0,
    total: 0,
  });

  const refresh = useCallback(async () => {
    try {
      const res = await fetch('/api/notifications/summary', { cache: 'no-store' });
      if (!res.ok) return;
      const data = await res.json();
      setSummary({
        pendingUsers: Number(data?.pendingUsers) || 0,
        openAppointments: Number(data?.openAppointments) || 0,
        dueReminders: Number(data?.dueReminders) || 0,
        total: Number(data?.total) || 0,
      });
    } catch {
      /* still */
    }
  }, []);

  useEffect(() => {
    refresh();
    const t = setInterval(refresh, 45000);
    const onFocus = () => refresh();
    window.addEventListener('focus', onFocus);
    return () => {
      clearInterval(t);
      window.removeEventListener('focus', onFocus);
    };
  }, [refresh]);

  return (
    <NotificationContext.Provider value={{ ...summary, refresh }}>
      {children}
    </NotificationContext.Provider>
  );
}
