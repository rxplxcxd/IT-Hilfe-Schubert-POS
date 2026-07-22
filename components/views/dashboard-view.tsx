'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import {
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid,
  PieChart, Pie, Cell, Legend,
} from 'recharts';
import { TrendingUp, FileText, Users, ShoppingCart, AlertCircle, CheckCircle2, Euro, Bell, BarChart3, Download, Shield, Calendar, XCircle, Activity, Clock, LifeBuoy, UserPlus, FileCheck } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { formatCurrency, formatDate } from '@/lib/utils';
import { CountUp } from '@/components/count-up';
import { LiveTicker } from '@/components/live-ticker';
import { DbUsageCard } from '@/components/db-usage-card';
import { toast } from 'sonner';

interface DashboardData {
  openInvoices: any[];
  monthlyRevenue: number;
  totalCustomers: number;
  invoiceCount: number;
}

interface StatsData {
  monthlyData: { month: string; revenue: number; count: number }[];
  topServices: { name: string; count: number; revenue: number }[];
  topCustomers: { name: string; count: number; revenue: number }[];
  summary: {
    totalRevenue: number; totalInvoices: number; avgInvoice: number;
    openInvoices: number; openAmount: number; totalCustomers: number;
    activeSubscriptions: number; totalExpenses: number;
    profit: number; pendingReminders: number;
    cancelledAmount: number; cancelledCount: number;
    periodRevenue: number; periodInvoiceCount: number; period: string;
  };
}

const PERIODS = [
  { id: 'daily', label: 'Heute' },
  { id: 'weekly', label: 'Woche' },
  { id: 'monthly', label: 'Monat' },
  { id: 'yearly', label: 'Jahr' },
] as const;

const DONUT_COLORS = ['#2563eb', '#7c3aed', '#0891b2', '#16a34a', '#ea580c', '#db2777'];

// Module-level cache: persists across view remounts within the SPA session so the
// dashboard shows instantly (stale-while-revalidate) instead of blanking + refetching.
type DashboardCache = {
  data: DashboardData | null;
  stats: StatsData | null;
  reminders: any[];
  appointments: any[];
  activities: any[];
  period: string;
};
let dashboardCache: DashboardCache | null = null;

const container = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.07, delayChildren: 0.05 } },
};
const item = {
  hidden: { opacity: 0, y: 16 },
  show: { opacity: 1, y: 0, transition: { duration: 0.45, ease: [0.22, 1, 0.36, 1] as any } },
};

export function DashboardView({ onNavigate, onViewInvoice }: {
  onNavigate: (tab: any, section?: string) => void;
  onViewInvoice: (id: number) => void;
}) {
  const [data, setData] = useState<DashboardData | null>(dashboardCache?.data ?? null);
  const [stats, setStats] = useState<StatsData | null>(dashboardCache?.stats ?? null);
  const [reminders, setReminders] = useState<any[]>(dashboardCache?.reminders ?? []);
  const [appointments, setAppointments] = useState<any[]>(dashboardCache?.appointments ?? []);
  const [activities, setActivities] = useState<any[]>(dashboardCache?.activities ?? []);
  // Only show the loading skeleton on the very first load (empty cache).
  const [loading, setLoading] = useState(!dashboardCache);
  const [showStats, setShowStats] = useState(false);
  const [downloadingReport, setDownloadingReport] = useState(false);
  const [period, setPeriod] = useState<string>(dashboardCache?.period ?? 'monthly');

  const fetchData = useCallback(async () => {
    try {
      const [dRes, sRes, rRes, aRes, actRes] = await Promise.all([
        fetch('/api/dashboard'),
        fetch(`/api/stats?months=6&period=${period}`),
        fetch('/api/reminders?pending=true'),
        fetch('/api/appointments'),
        fetch('/api/activities'),
      ]);
      const nextData = await dRes.json();
      const nextStats = await sRes.json();
      const nextReminders = (await rRes.json() || []).slice(0, 5);
      const appts = await aRes.json();
      const nextAppointments = Array.isArray(appts) ? appts : [];
      const acts = await actRes.json();
      const nextActivities = Array.isArray(acts) ? acts : [];
      setData(nextData);
      setStats(nextStats);
      setReminders(nextReminders);
      setAppointments(nextAppointments);
      setActivities(nextActivities);
      // Update the shared cache so the next remount renders instantly.
      dashboardCache = {
        data: nextData,
        stats: nextStats,
        reminders: nextReminders,
        appointments: nextAppointments,
        activities: nextActivities,
        period,
      };
    } catch (e: any) {
      console.error('Dashboard fetch error:', e);
    } finally {
      setLoading(false);
    }
  }, [period]);

  // Always revalidate in the background on mount; skeleton only shows when cache is empty.
  useEffect(() => { fetchData(); }, [fetchData]);

  const handleDownloadReport = async () => {
    setDownloadingReport(true);
    try {
      const now = new Date();
      const month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
      const res = await fetch(`/api/reports/monthly?month=${month}`);
      const report = await res.json();
      const formatC = (n: number) => n.toFixed(2).replace('.', ',') + ' €';
      const html = `<html><head><meta charset="utf-8"><title>Monatsbericht ${report.month}</title><style>body{font-family:sans-serif;padding:20px;max-width:800px;margin:0 auto}table{width:100%;border-collapse:collapse;margin:15px 0}th,td{padding:8px;text-align:left;border-bottom:1px solid #eee}th{background:#f1f5f9}.total{font-weight:bold;border-top:2px solid #1e40af}.green{color:#16a34a}.red{color:#dc2626}h1{color:#1e40af}</style></head><body>
        <h1>Monatsbericht: ${report.month}</h1>
        <p>${report.settings?.companyName}</p>
        <h2>Zusammenfassung</h2>
        <table><tr><td>Umsatz (bezahlt)</td><td class="green">${formatC(report.summary?.totalRevenue || 0)}</td></tr>
        <tr><td>Offene Beträge</td><td>${formatC(report.summary?.totalOpen || 0)}</td></tr>
        <tr><td>Ausgaben</td><td class="red">${formatC(report.summary?.totalExpenses || 0)}</td></tr>
        <tr class="total"><td>Gewinn</td><td class="${(report.summary?.profit || 0) >= 0 ? 'green' : 'red'}">${formatC(report.summary?.profit || 0)}</td></tr>
        <tr><td>Rechnungen</td><td>${report.summary?.invoiceCount || 0} (${report.summary?.paidCount || 0} bezahlt, ${report.summary?.openCount || 0} offen)</td></tr>
        <tr><td>Neue Kunden</td><td>${report.summary?.newCustomers || 0}</td></tr></table>
        <h2>Rechnungen</h2>
        <table><thead><tr><th>Nr.</th><th>Kunde</th><th>Betrag</th><th>Status</th><th>Datum</th></tr></thead><tbody>
        ${(report.invoices || []).map((i: any) => `<tr><td>${i.number}</td><td>${i.customer}</td><td>${formatC(i.total)}</td><td>${i.status}</td><td>${new Date(i.date).toLocaleDateString('de-DE')}</td></tr>`).join('')}
        </tbody></table>
        ${(report.expenses || []).length > 0 ? `<h2>Ausgaben & Einnahmen</h2><table><thead><tr><th>Beschreibung</th><th>Kategorie</th><th>Betrag</th><th>Typ</th><th>Datum</th></tr></thead><tbody>
        ${(report.expenses || []).map((e: any) => `<tr><td>${e.description}</td><td>${e.category}</td><td>${formatC(e.amount)}</td><td>${e.type}</td><td>${new Date(e.date).toLocaleDateString('de-DE')}</td></tr>`).join('')}
        </tbody></table>` : ''}
        <p style="color:#999;margin-top:30px">${report.settings?.taxInfo}</p>
      </body></html>`;

      const blob = new Blob([html], { type: 'text/html' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Monatsbericht_${month}.html`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success('Bericht heruntergeladen');
    } catch { toast.error('Fehler beim Erstellen'); } finally { setDownloadingReport(false); }
  };

  if (loading) {
    return (
      <div className="p-4 space-y-4">
        <div className="grid grid-cols-2 gap-3">
          {[0, 1, 2, 3].map((i) => <div key={i} className="h-24 rounded-xl shimmer" />)}
        </div>
        <div className="h-40 rounded-xl shimmer" />
        <div className="h-40 rounded-xl shimmer" />
      </div>
    );
  }

  const statCards = [
    { label: 'Umsatz (Monat)', raw: data?.monthlyRevenue ?? 0, currency: true, icon: Euro, color: 'text-green-600 bg-green-50 dark:bg-green-950 dark:text-green-400', ring: 'from-green-500/10' },
    { label: 'Offene Beträge', raw: stats?.summary?.openAmount ?? 0, currency: true, icon: AlertCircle, color: 'text-orange-600 bg-orange-50 dark:bg-orange-950 dark:text-orange-400', ring: 'from-orange-500/10' },
    { label: 'Kunden', raw: data?.totalCustomers ?? 0, currency: false, icon: Users, color: 'text-blue-600 bg-blue-50 dark:bg-blue-950 dark:text-blue-400', ring: 'from-blue-500/10' },
    { label: 'Schutzbrief aktiv', raw: stats?.summary?.activeSubscriptions ?? 0, currency: false, icon: Shield, color: 'text-purple-600 bg-purple-50 dark:bg-purple-950 dark:text-purple-400', ring: 'from-purple-500/10' },
  ];

  const chartData = (stats?.monthlyData || []).map((m) => ({ month: m.month, Umsatz: Math.round(m.revenue), Rechnungen: m.count }));
  const donutData = (stats?.topServices || []).slice(0, 6).map((s) => ({ name: s.name, value: Math.round(s.revenue) }));

  // Aktivitäts-Feed: kommende/neue Termine + offene Rechnungen, chronologisch
  const now = Date.now();
  const upcoming = [...appointments]
    .filter((a) => a?.date)
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
    .filter((a) => new Date(a.date).getTime() >= now - 86400000)
    .slice(0, 4);

  const statusStyle: Record<string, string> = {
    OFFEN: 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300',
    BESTAETIGT: 'bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300',
    ERLEDIGT: 'bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-300',
    ABGESAGT: 'bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300',
  };

  return (
    <motion.div variants={container} initial="hidden" animate="show" className="p-4 space-y-4 pb-8">
      {/* Lebendiger Begruessungs-Streifen */}
      <motion.div variants={item}>
        <LiveTicker items={[
          data ? `${data.totalCustomers ?? 0} Kunden im System.` : 'Willkommen zurück.',
          (stats?.summary?.openInvoices ?? 0) > 0 ? `${stats?.summary?.openInvoices} offene Rechnung(en) warten.` : 'Keine offenen Rechnungen. Stark.',
          upcoming.length > 0 ? `${upcoming.length} Termin(e) stehen an.` : 'Aktuell keine anstehenden Termine.',
          (stats?.summary?.pendingReminders ?? 0) > 0 ? `${stats?.summary?.pendingReminders} Erinnerung(en) fällig.` : 'Alle Erinnerungen erledigt.',
          'Fristen im Blick behalten, dann bleibt alles entspannt.',
        ]} />
      </motion.div>

      {/* Datenbank-Speicher (nur Admins) */}
      <DbUsageCard />

      {/* Stats Grid */}
      <div className="grid grid-cols-2 gap-3">
        {statCards.map((stat) => {
          const Icon = stat.icon;
          return (
            <motion.div key={stat.label} variants={item}>
              <Card className={`shadow-sm card-interactive overflow-hidden relative bg-gradient-to-br ${stat.ring} to-transparent`}>
                <CardContent className="p-3">
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center mb-2 ${stat.color}`}><Icon className="w-4 h-4" /></div>
                  <p className="text-lg font-bold font-mono">
                    {stat.currency
                      ? <CountUp value={stat.raw} format={(n) => formatCurrency(n)} />
                      : <CountUp value={stat.raw} />}
                  </p>
                  <p className="text-xs text-muted-foreground">{stat.label}</p>
                </CardContent>
              </Card>
            </motion.div>
          );
        })}
      </div>

      {/* Pending reminders */}
      {reminders.length > 0 && (
        <motion.div variants={item}>
          <Card className="shadow-sm border-amber-200 bg-amber-50/50 dark:bg-amber-950/30 dark:border-amber-800">
            <CardContent className="p-3">
              <div className="flex items-center gap-2 mb-2">
                <Bell className="w-4 h-4 text-amber-600" />
                <span className="text-sm font-medium text-amber-800 dark:text-amber-300">Fällige Erinnerungen ({reminders.length})</span>
              </div>
              {reminders.slice(0, 3).map((r: any) => (
                <div key={r.id} className="flex items-center justify-between py-1">
                  <div className="min-w-0">
                    <p className="text-xs font-medium truncate">{r.title}</p>
                    <p className="text-[10px] text-muted-foreground">{r.customer?.firstName} {r.customer?.lastName} · {formatDate(r.dueDate)}</p>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* Quick Actions */}
      <motion.div variants={item} className="grid grid-cols-2 gap-3">
        <Button onClick={() => onNavigate('booking')} className="h-14 gap-2 press-scale">
          <ShoppingCart className="w-5 h-5" /> Neue Buchung
        </Button>
        <Button variant="outline" onClick={() => onNavigate('belege')} className="h-14 gap-2 press-scale">
          <FileText className="w-5 h-5" /> Neues Angebot
        </Button>
      </motion.div>

      {/* Revenue Chart (recharts) */}
      <motion.div variants={item}>
        <Card className="shadow-sm">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold flex items-center gap-1"><TrendingUp className="w-4 h-4 text-primary" /> Umsatz (6 Monate)</h3>
              <Button variant="ghost" size="sm" className="text-xs gap-1 press-scale" onClick={handleDownloadReport} disabled={downloadingReport}>
                <Download className="w-3 h-3" />{downloadingReport ? '...' : 'Bericht'}
              </Button>
            </div>
            <div className="h-48 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData} margin={{ top: 8, right: 4, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#2563eb" stopOpacity={0.35} />
                      <stop offset="100%" stopColor="#2563eb" stopOpacity={0.02} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                  <XAxis dataKey="month" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
                  <YAxis tick={{ fontSize: 10 }} tickLine={false} axisLine={false} width={48} tickFormatter={(v) => `${Math.round(v / 1000)}k`} />
                  <Tooltip
                    formatter={(v: any) => [formatCurrency(Number(v)), 'Umsatz']}
                    contentStyle={{ borderRadius: 12, border: '1px solid #e2e8f0', fontSize: 12, boxShadow: '0 10px 15px -3px rgba(0,0,0,0.08)' }}
                  />
                  <Area type="monotone" dataKey="Umsatz" stroke="#2563eb" strokeWidth={2.5} fill="url(#revGrad)" animationDuration={900} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Top Services Donut */}
      {donutData.length > 0 && (
        <motion.div variants={item}>
          <Card className="shadow-sm">
            <CardContent className="p-4">
              <h3 className="text-sm font-semibold flex items-center gap-1 mb-2"><BarChart3 className="w-4 h-4 text-primary" /> Beliebteste Leistungen</h3>
              <div className="h-52 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={donutData} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={45} outerRadius={75} paddingAngle={3} animationDuration={900}>
                      {donutData.map((_, i) => <Cell key={i} fill={DONUT_COLORS[i % DONUT_COLORS.length]} />)}
                    </Pie>
                    <Tooltip formatter={(v: any, n: any) => [formatCurrency(Number(v)), n]} contentStyle={{ borderRadius: 12, border: '1px solid #e2e8f0', fontSize: 12 }} />
                    <Legend wrapperStyle={{ fontSize: 11 }} iconType="circle" />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* Aktivitäts-Feed */}
      <motion.div variants={item}>
        <Card className="shadow-sm">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold flex items-center gap-1">
                <Activity className="w-4 h-4 text-primary" /> Aktivität
                <span className="ml-1 w-2 h-2 rounded-full bg-green-500 ticker-dot inline-block" />
              </h3>
            </div>
            {activities.length === 0 && upcoming.length === 0 ? (
              <div className="text-center py-6 text-muted-foreground">
                <CheckCircle2 className="w-8 h-8 mx-auto mb-2 opacity-40" />
                <p className="text-xs">Keine neuen Aktivitäten</p>
              </div>
            ) : (
              <div className="space-y-2">
                {/* Show upcoming appointments first */}
                {upcoming.map((a, i) => (
                  <button key={`appt-${a.id}`} onClick={() => onNavigate('appointments')} className={`w-full flex items-center gap-3 p-2 rounded-lg bg-muted/40 anim-slide-down text-left`} style={{ animationDelay: `${i * 60}ms` }}>
                    <div className="w-9 h-9 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
                      <Clock className="w-4 h-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-medium truncate">{a.customerName}</p>
                      <p className="text-[10px] text-muted-foreground">{formatDate(a.date)} · {a.startTime}-{a.endTime} Uhr</p>
                    </div>
                    <span className={`text-[9px] px-2 py-0.5 rounded-full font-medium ${statusStyle[a.status] || 'bg-muted text-muted-foreground'}`}>{a.status}</span>
                  </button>
                ))}
                {/* Activities feed */}
                {activities.slice(0, 10).map((act, i) => {
                  const iconMap: Record<string, any> = { appointment: Calendar, registration: UserPlus, ticket: LifeBuoy, invoice: FileText };
                  const colorMap: Record<string, string> = {
                    appointment: 'bg-blue-100 text-blue-600 dark:bg-blue-500/15 dark:text-blue-400',
                    registration: 'bg-amber-100 text-amber-600 dark:bg-amber-500/15 dark:text-amber-400',
                    ticket: 'bg-purple-100 text-purple-600 dark:bg-purple-500/15 dark:text-purple-400',
                    invoice: 'bg-green-100 text-green-600 dark:bg-green-500/15 dark:text-green-400',
                  };
                  const Icon = iconMap[act.type] || Activity;
                  const color = colorMap[act.type] || 'bg-muted text-muted-foreground';
                  const dest: Record<string, string> = { appointment: 'appointments', registration: 'settings', ticket: 'tickets', invoice: 'belege' };
                  const targetTab = dest[act.type] || 'dashboard';
                  const timeAgo = (() => {
                    const diff = Date.now() - new Date(act.time).getTime();
                    const mins = Math.floor(diff / 60000);
                    if (mins < 1) return 'gerade eben';
                    if (mins < 60) return `vor ${mins} Min.`;
                    const hrs = Math.floor(mins / 60);
                    if (hrs < 24) return `vor ${hrs} Std.`;
                    return `vor ${Math.floor(hrs / 24)} Tag${Math.floor(hrs / 24) === 1 ? '' : 'en'}`;
                  })();
                  return (
                    <button key={act.id} onClick={() => onNavigate(targetTab as any, act.type === 'registration' ? 'team' : undefined)} className="w-full flex items-center gap-3 p-2 rounded-lg hover:bg-muted/60 transition-colors text-left anim-slide-down" style={{ animationDelay: `${(upcoming.length + i) * 50}ms` }}>
                      <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${color}`}>
                        <Icon className="w-4 h-4" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className={`text-xs font-medium truncate ${act.unread ? 'font-bold' : ''}`}>{act.title}</p>
                        <p className="text-[10px] text-muted-foreground truncate">{act.subtitle}</p>
                      </div>
                      <span className="text-[10px] text-muted-foreground whitespace-nowrap">{timeAgo}</span>
                    </button>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </motion.div>

      {/* Toggle detailed stats */}
      <motion.div variants={item}>
        <Button variant="ghost" size="sm" className="w-full text-xs press-scale" onClick={() => setShowStats(!showStats)}>
          <BarChart3 className="w-3 h-3 mr-1" /> {showStats ? 'Statistiken ausblenden' : 'Detaillierte Statistiken anzeigen'}
        </Button>
      </motion.div>

      {showStats && (
        <div className="space-y-3 anim-fade-up">
          {/* Period Toggle */}
          <div className="flex gap-1 bg-muted rounded-lg p-1">
            {PERIODS.map((p) => (
              <button
                key={p.id}
                onClick={() => setPeriod(p.id)}
                className={`flex-1 py-1.5 rounded-md text-xs font-medium transition-all ${
                  period === p.id ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>

          {/* Period Revenue */}
          <Card className="shadow-sm">
            <CardContent className="p-3">
              <h3 className="text-xs font-semibold text-muted-foreground mb-2">
                UMSATZ ({PERIODS.find(p => p.id === period)?.label?.toUpperCase()})
              </h3>
              <p className="text-xl font-bold text-green-600"><CountUp value={stats?.summary?.periodRevenue ?? 0} format={(n) => formatCurrency(n)} /></p>
              <p className="text-[10px] text-muted-foreground">{stats?.summary?.periodInvoiceCount ?? 0} Rechnungen bezahlt</p>
            </CardContent>
          </Card>

          {/* Profit summary */}
          <Card className="shadow-sm"><CardContent className="p-3">
            <h3 className="text-xs font-semibold text-muted-foreground mb-2">GEWINN (6 Monate)</h3>
            <div className="grid grid-cols-3 gap-2 text-center">
              <div><p className="text-sm font-bold text-green-600">{formatCurrency(stats?.summary?.totalRevenue ?? 0)}</p><p className="text-[10px] text-muted-foreground">Einnahmen</p></div>
              <div><p className="text-sm font-bold text-red-600">{formatCurrency(stats?.summary?.totalExpenses ?? 0)}</p><p className="text-[10px] text-muted-foreground">Ausgaben</p></div>
              <div><p className={`text-sm font-bold ${(stats?.summary?.profit ?? 0) >= 0 ? 'text-green-600' : 'text-red-600'}`}>{formatCurrency(stats?.summary?.profit ?? 0)}</p><p className="text-[10px] text-muted-foreground">Gewinn</p></div>
            </div>
          </CardContent></Card>

          {/* Storno info */}
          {(stats?.summary?.cancelledCount ?? 0) > 0 && (
            <Card className="shadow-sm border-red-200 dark:border-red-800"><CardContent className="p-3">
              <div className="flex items-center gap-2">
                <XCircle className="w-4 h-4 text-red-500" />
                <div>
                  <p className="text-xs font-medium">Stornierte Rechnungen: {stats?.summary?.cancelledCount}</p>
                  <p className="text-[10px] text-muted-foreground">Stornierter Betrag: {formatCurrency(stats?.summary?.cancelledAmount ?? 0)}</p>
                </div>
              </div>
            </CardContent></Card>
          )}

          {/* Top Services */}
          {(stats?.topServices || []).length > 0 && (
            <Card className="shadow-sm"><CardContent className="p-3">
              <h3 className="text-xs font-semibold text-muted-foreground mb-2">TOP SERVICES</h3>
              {stats!.topServices.map((s, i) => (
                <div key={i} className="flex items-center justify-between py-1">
                  <span className="text-xs truncate flex-1">{s.name}</span>
                  <span className="text-xs text-muted-foreground ml-2">{s.count}x</span>
                  <span className="text-xs font-medium ml-2">{formatCurrency(s.revenue)}</span>
                </div>
              ))}
            </CardContent></Card>
          )}

          {/* Top Customers */}
          {(stats?.topCustomers || []).length > 0 && (
            <Card className="shadow-sm"><CardContent className="p-3">
              <h3 className="text-xs font-semibold text-muted-foreground mb-2">TOP KUNDEN</h3>
              {stats!.topCustomers.map((c, i) => (
                <div key={i} className="flex items-center justify-between py-1">
                  <span className="text-xs truncate flex-1">{c.name}</span>
                  <span className="text-xs text-muted-foreground ml-2">{c.count} Aufträge</span>
                  <span className="text-xs font-medium ml-2">{formatCurrency(c.revenue)}</span>
                </div>
              ))}
            </CardContent></Card>
          )}

          {/* KPIs */}
          <Card className="shadow-sm"><CardContent className="p-3">
            <h3 className="text-xs font-semibold text-muted-foreground mb-2">KENNZAHLEN</h3>
            <div className="space-y-1">
              <div className="flex justify-between text-xs"><span>Ø Rechnungsbetrag</span><span className="font-medium">{formatCurrency(stats?.summary?.avgInvoice ?? 0)}</span></div>
              <div className="flex justify-between text-xs"><span>Rechnungen gesamt</span><span className="font-medium">{stats?.summary?.totalInvoices ?? 0}</span></div>
              <div className="flex justify-between text-xs"><span>Offene Rechnungen</span><span className="font-medium">{stats?.summary?.openInvoices ?? 0}</span></div>
            </div>
          </CardContent></Card>
        </div>
      )}

      {/* Open Invoices */}
      <motion.div variants={item}>
        <h2 className="font-display font-semibold text-base mb-2 flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-orange-500" /> Offene Rechnungen
        </h2>
        {(data?.openInvoices?.length ?? 0) === 0 ? (
          <Card className="shadow-sm"><CardContent className="p-4 text-center text-muted-foreground">
            <CheckCircle2 className="w-8 h-8 mx-auto mb-2 text-green-500" />
            <p className="text-sm">Keine offenen Rechnungen</p>
          </CardContent></Card>
        ) : (
          <div className="space-y-2">
            {(data?.openInvoices ?? []).map((inv: any) => (
              <Card key={inv?.id} className="shadow-sm cursor-pointer card-interactive" onClick={() => onViewInvoice(inv?.id)}>
                <CardContent className="p-3 flex items-center justify-between">
                  <div><p className="font-mono text-sm font-medium">{inv?.invoiceNumber ?? '-'}</p><p className="text-xs text-muted-foreground">{inv?.customer?.firstName ?? ''} {inv?.customer?.lastName ?? ''} · {formatDate(inv?.createdAt)}</p></div>
                  <p className="font-mono font-bold text-base">{formatCurrency(inv?.total ?? 0)}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </motion.div>
    </motion.div>
  );
}
