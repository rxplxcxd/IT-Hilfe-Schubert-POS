'use client';

import { useState, useEffect, useCallback } from 'react';
import { TrendingUp, FileText, Users, ShoppingCart, AlertCircle, CheckCircle2, Euro, Bell, BarChart3, Download, Shield, Calendar, XCircle } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { formatCurrency, formatDate } from '@/lib/utils';
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

export function DashboardView({ onNavigate, onViewInvoice }: {
  onNavigate: (tab: any) => void;
  onViewInvoice: (id: number) => void;
}) {
  const [data, setData] = useState<DashboardData | null>(null);
  const [stats, setStats] = useState<StatsData | null>(null);
  const [reminders, setReminders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showStats, setShowStats] = useState(false);
  const [downloadingReport, setDownloadingReport] = useState(false);
  const [period, setPeriod] = useState<string>('monthly');

  const fetchData = useCallback(async () => {
    try {
      const [dRes, sRes, rRes] = await Promise.all([
        fetch('/api/dashboard'),
        fetch(`/api/stats?months=6&period=${period}`),
        fetch('/api/reminders?pending=true'),
      ]);
      setData(await dRes.json());
      setStats(await sRes.json());
      setReminders((await rRes.json() || []).slice(0, 5));
    } catch (e: any) {
      console.error('Dashboard fetch error:', e);
    } finally {
      setLoading(false);
    }
  }, [period]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleDownloadReport = async () => {
    setDownloadingReport(true);
    try {
      const now = new Date();
      const month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
      const res = await fetch(`/api/reports/monthly?month=${month}`);
      const report = await res.json();
      const formatC = (n: number) => n.toFixed(2).replace('.', ',') + ' \u20ac';
      const html = `<html><head><meta charset="utf-8"><title>Monatsbericht ${report.month}</title><style>body{font-family:sans-serif;padding:20px;max-width:800px;margin:0 auto}table{width:100%;border-collapse:collapse;margin:15px 0}th,td{padding:8px;text-align:left;border-bottom:1px solid #eee}th{background:#f1f5f9}.total{font-weight:bold;border-top:2px solid #1e40af}.green{color:#16a34a}.red{color:#dc2626}h1{color:#1e40af}</style></head><body>
        <h1>Monatsbericht: ${report.month}</h1>
        <p>${report.settings?.companyName}</p>
        <h2>Zusammenfassung</h2>
        <table><tr><td>Umsatz (bezahlt)</td><td class="green">${formatC(report.summary?.totalRevenue || 0)}</td></tr>
        <tr><td>Offene Betr\u00e4ge</td><td>${formatC(report.summary?.totalOpen || 0)}</td></tr>
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
    return <div className="flex items-center justify-center h-64"><div className="animate-spin w-8 h-8 border-2 border-primary border-t-transparent rounded-full" /></div>;
  }

  const statCards = [
    { label: 'Umsatz (Monat)', value: formatCurrency(data?.monthlyRevenue ?? 0), icon: Euro, color: 'text-green-600 bg-green-50 dark:bg-green-950 dark:text-green-400' },
    { label: 'Offene Beträge', value: formatCurrency(stats?.summary?.openAmount ?? 0), icon: AlertCircle, color: 'text-orange-600 bg-orange-50 dark:bg-orange-950 dark:text-orange-400' },
    { label: 'Kunden', value: String(data?.totalCustomers ?? 0), icon: Users, color: 'text-blue-600 bg-blue-50 dark:bg-blue-950 dark:text-blue-400' },
    { label: 'Schutzbrief aktiv', value: String(stats?.summary?.activeSubscriptions ?? 0), icon: Shield, color: 'text-purple-600 bg-purple-50 dark:bg-purple-950 dark:text-purple-400' },
  ];

  const maxRevenue = Math.max(...(stats?.monthlyData || []).map((m) => m.revenue), 1);

  return (
    <div className="p-4 space-y-4 pb-8">
      {/* Stats Grid */}
      <div className="grid grid-cols-2 gap-3">
        {statCards.map((stat) => {
          const Icon = stat.icon;
          return (
            <Card key={stat.label} className="shadow-sm">
              <CardContent className="p-3">
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center mb-2 ${stat.color}`}><Icon className="w-4 h-4" /></div>
                <p className="text-lg font-bold font-mono">{stat.value}</p>
                <p className="text-xs text-muted-foreground">{stat.label}</p>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Pending reminders */}
      {reminders.length > 0 && (
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
      )}

      {/* Quick Actions */}
      <div className="grid grid-cols-2 gap-3">
        <Button onClick={() => onNavigate('booking')} className="h-14 gap-2">
          <ShoppingCart className="w-5 h-5" /> Neue Buchung
        </Button>
        <Button variant="outline" onClick={() => onNavigate('belege')} className="h-14 gap-2">
          <FileText className="w-5 h-5" /> Neues Angebot
        </Button>
      </div>

      {/* Revenue Chart */}
      <Card className="shadow-sm">
        <CardContent className="p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold flex items-center gap-1"><BarChart3 className="w-4 h-4" /> Umsatz (6 Monate)</h3>
            <Button variant="ghost" size="sm" className="text-xs gap-1" onClick={handleDownloadReport} disabled={downloadingReport}>
              <Download className="w-3 h-3" />{downloadingReport ? '...' : 'Bericht'}
            </Button>
          </div>
          <div className="flex items-end gap-1 h-28">
            {(stats?.monthlyData || []).map((m, i) => (
              <div key={i} className="flex-1 flex flex-col items-center">
                <div className="w-full bg-primary/20 rounded-t relative" style={{ height: `${Math.max((m.revenue / maxRevenue) * 100, 4)}%` }}>
                  <div className="absolute inset-0 bg-primary rounded-t" style={{ height: '100%' }} />
                </div>
                <p className="text-[9px] text-muted-foreground mt-1">{m.month}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Toggle detailed stats */}
      <Button variant="ghost" size="sm" className="w-full text-xs" onClick={() => setShowStats(!showStats)}>
        <BarChart3 className="w-3 h-3 mr-1" /> {showStats ? 'Statistiken ausblenden' : 'Detaillierte Statistiken anzeigen'}
      </Button>

      {showStats && (
        <div className="space-y-3">
          {/* Period Toggle */}
          <div className="flex gap-1 bg-muted rounded-lg p-1">
            {PERIODS.map((p) => (
              <button
                key={p.id}
                onClick={() => setPeriod(p.id)}
                className={`flex-1 py-1.5 rounded-md text-xs font-medium transition-colors ${
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
              <p className="text-xl font-bold text-green-600">{formatCurrency(stats?.summary?.periodRevenue ?? 0)}</p>
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
      <div>
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
              <Card key={inv?.id} className="shadow-sm cursor-pointer hover:shadow-md transition-shadow" onClick={() => onViewInvoice(inv?.id)}>
                <CardContent className="p-3 flex items-center justify-between">
                  <div><p className="font-mono text-sm font-medium">{inv?.invoiceNumber ?? '-'}</p><p className="text-xs text-muted-foreground">{inv?.customer?.firstName ?? ''} {inv?.customer?.lastName ?? ''} · {formatDate(inv?.createdAt)}</p></div>
                  <p className="font-mono font-bold text-base">{formatCurrency(inv?.total ?? 0)}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
