'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useRouter } from 'next/navigation';
import { LayoutDashboard, Users, ShoppingCart, FileText, Settings, Mail, Package, Wallet, ClipboardList, CalendarDays, LogOut, Bell, X, LifeBuoy } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { NotificationProvider, useNotifications } from './notification-provider';
import { VersionWatcher } from './version-watcher';
import { notifyInfo, notifySuccess } from '@/lib/toast';
import { APP_VERSION } from '@/lib/version';
import { toast } from 'sonner';
import { DashboardView } from './views/dashboard-view';
import { CustomersView } from './views/customers-view';
import { BookingView } from './views/booking-view';
import { SettingsView } from './views/settings-view';
import { EmailView } from './views/email-view';
import { ProductsView } from './views/products-view';
import { FinancesView } from './views/finances-view';
import { CustomerDetailView } from './views/customer-detail-view';
import { BelegeHubView } from './views/belege-hub-view';
import { AppointmentsView } from './views/appointments-view';
import { TicketsView } from './views/tickets-view';
import { NAV_TABS } from '@/lib/nav-config';
import { EmployeeGate } from './employee-gate';

// Einzige Quelle der Wahrheit fuer die Tabs -> siehe lib/nav-config.tsx
const tabs = NAV_TABS;

type TabId = string;

/** Rote iPhone-artige Badge (Punkt oder Zahl). */
function CountBadge({ count, ring = 'ring-card', className = '' }: { count: number; ring?: string; className?: string }) {
  if (!count) return null;
  return (
    <span className={`min-w-[17px] h-[17px] px-1 rounded-full bg-red-500 text-white text-[10px] font-bold leading-none flex items-center justify-center ring-2 ${ring} ${className}`}>
      {count > 9 ? '9+' : count}
    </span>
  );
}

export function AppShell({ isAdmin = false, employeeNo = null }: { isAdmin?: boolean; employeeNo?: number | null }) {
  return (
    <NotificationProvider>
      <VersionWatcher />
      <EmployeeGate isAdmin={isAdmin}>
        <AppShellInner isAdmin={isAdmin} employeeNo={employeeNo} />
      </EmployeeGate>
    </NotificationProvider>
  );
}

/** Snapshot of view state for back-navigation. */
interface ViewState {
  tab: TabId;
  settingsSection?: string;
  editCustomerId?: number | null;
  viewInvoiceId?: number | null;
  viewCustomerDetailId?: number | null;
  composeEmailTo?: string | null;
}

function AppShellInner({ isAdmin, employeeNo }: { isAdmin: boolean; employeeNo: number | null }) {
  const router = useRouter();
  const { pendingUsers, openAppointments, dueReminders, openTickets, total, refresh } = useNotifications();
  const [activeTab, setActiveTab] = useState<TabId>('dashboard');
  const [settingsSection, setSettingsSection] = useState<string | undefined>(undefined);
  const [showMore, setShowMore] = useState(false);
  const [showNotif, setShowNotif] = useState(false);

  const [editCustomerId, setEditCustomerId] = useState<number | null>(null);
  const [viewInvoiceId, setViewInvoiceId] = useState<number | null>(null);
  const [viewCustomerDetailId, setViewCustomerDetailId] = useState<number | null>(null);
  const [composeEmailTo, setComposeEmailTo] = useState<string | null>(null);

  // ---- View history stack ----
  const viewHistory = useRef<ViewState[]>([]);

  const currentSnapshot = useCallback((): ViewState => ({
    tab: activeTab,
    settingsSection,
    editCustomerId,
    viewInvoiceId,
    viewCustomerDetailId,
    composeEmailTo,
  }), [activeTab, settingsSection, editCustomerId, viewInvoiceId, viewCustomerDetailId, composeEmailTo]);

  const pushHistory = useCallback(() => {
    const snap = currentSnapshot();
    viewHistory.current.push(snap);
    // Limit stack depth to 20
    if (viewHistory.current.length > 20) viewHistory.current.shift();
  }, [currentSnapshot]);

  const goBack = useCallback(() => {
    const prev = viewHistory.current.pop();
    if (!prev) return;
    setActiveTab(prev.tab);
    setSettingsSection(prev.settingsSection);
    setEditCustomerId(prev.editCustomerId ?? null);
    setViewInvoiceId(prev.viewInvoiceId ?? null);
    setViewCustomerDetailId(prev.viewCustomerDetailId ?? null);
    setComposeEmailTo(prev.composeEmailTo ?? null);
    setShowMore(false);
    setShowNotif(false);
  }, []);

  const handleLogout = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.replace('/login');
    router.refresh();
  };

  const navigateTo = useCallback((tab: TabId, section?: string) => {
    pushHistory();
    setActiveTab(tab);
    setSettingsSection(tab === 'settings' ? section : undefined);
    setEditCustomerId(null);
    setViewInvoiceId(null);
    setViewCustomerDetailId(null);
    setComposeEmailTo(null);
    setShowMore(false);
    setShowNotif(false);
  }, [pushHistory]);

  // ---- Ticket live-toast polling ----
  const lastTicketCheck = useRef<string>('');
  useEffect(() => {
    let mounted = true;
    const checkNewMessages = async () => {
      try {
        const res = await fetch('/api/tickets?_t=' + Date.now(), { cache: 'no-store' });
        if (!res.ok) return;
        const tickets: any[] = await res.json();
        // Find tickets with unread messages
        const unreadTickets = tickets.filter((t: any) => isAdmin ? t.adminUnread : t.employeeUnread);
        if (unreadTickets.length > 0 && mounted) {
          const newest = unreadTickets[0];
          const key = `${newest.id}-${newest.updatedAt}`;
          if (lastTicketCheck.current && lastTicketCheck.current !== key && lastTicketCheck.current !== '') {
            // Show toast for new ticket message
            toast.warning(`Ticket ${newest.ticketNumber}`, {
              description: newest.subject,
              action: { label: 'Ansehen', onClick: () => navigateTo('tickets') },
              duration: 8000,
            });
            refresh();
          }
          lastTicketCheck.current = key;
        }
      } catch { /* ignore */ }
    };
    // Initial baseline (no toast on first load)
    checkNewMessages().then(() => { if (!lastTicketCheck.current) lastTicketCheck.current = 'init'; });
    const interval = setInterval(checkNewMessages, 30000);
    return () => { mounted = false; clearInterval(interval); };
  }, [isAdmin, navigateTo, refresh]);

  // Einmalige Willkommens-Zusammenfassung beim ersten Laden
  const welcomed = useRef(false);
  useEffect(() => {
    if (welcomed.current) return;
    welcomed.current = true;
    (async () => {
      try {
        const res = await fetch('/api/notifications/summary', { cache: 'no-store' });
        if (!res.ok) return;
        const d = await res.json();
        const parts: string[] = [];
        if (d.openAppointments) parts.push(`${d.openAppointments} offene Terminanfrage${d.openAppointments === 1 ? '' : 'n'}`);
        if (isAdmin && d.pendingUsers) parts.push(`${d.pendingUsers} Registrierungsanfrage${d.pendingUsers === 1 ? '' : 'n'}`);
        if (d.dueReminders) parts.push(`${d.dueReminders} fällige Erinnerung${d.dueReminders === 1 ? '' : 'en'}`);
        if (d.openTickets) parts.push(`${d.openTickets} ${isAdmin ? 'neue' : 'aktualisierte'} Ticket${d.openTickets === 1 ? '' : 's'}`);
        if (parts.length) notifyInfo('Willkommen zurück!', parts.join('  ·  '));
        else notifySuccess('Willkommen zurück!', 'Alles erledigt – keine offenen Aufgaben.');
      } catch {
        /* still */
      }
    })();
  }, [isAdmin]);

  const mainTabs = tabs.slice(0, 4);
  const moreTabs = tabs.slice(4);
  const isMoreActive = moreTabs.some((t) => t.id === activeTab);

  const badgeForTab = (id: TabId): number => {
    if (id === 'appointments') return openAppointments;
    if (id === 'tickets') return openTickets;
    if (id === 'settings') return isAdmin ? pendingUsers : 0;
    return 0;
  };

  // Customer detail subview
  if (viewCustomerDetailId && activeTab === 'customers') {
    return (
      <div className="flex flex-col h-[100dvh] bg-background">
        <header className="bg-primary text-primary-foreground px-4 py-3 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-white/20 rounded-lg flex items-center justify-center text-sm font-bold">IS</div>
            <div><h1 className="font-display text-base font-bold leading-tight">IT-Hilfe Schubert</h1><p className="text-xs opacity-80">Kundenakte</p></div>
          </div>
        </header>
        <main className="flex-1 overflow-y-auto">
          <CustomerDetailView
            customerId={viewCustomerDetailId}
            onBack={() => goBack()}
            onWriteEmail={(email) => { pushHistory(); setComposeEmailTo(email); setActiveTab('email' as TabId); setViewCustomerDetailId(null); }}
            onViewInvoice={(id) => { pushHistory(); setViewInvoiceId(id); setActiveTab('belege' as TabId); setViewCustomerDetailId(null); }}
            onEdit={(id) => { pushHistory(); setViewCustomerDetailId(null); setEditCustomerId(id); }}
            onDeleted={() => { goBack(); refresh(); }}
          />
        </main>
      </div>
    );
  }

  const activeLabel = tabs.find((t) => t.id === activeTab)?.label ?? '';
  return (
    <div className="flex h-[100dvh] bg-background">
      {/* Desktop-Seitenleiste (Paket C) */}
      <aside className="hidden lg:flex lg:flex-col lg:w-64 bg-card border-r border-border shrink-0">
        <div className="flex items-center gap-2.5 px-4 h-[60px] border-b border-border shrink-0">
          <div className="w-9 h-9 bg-primary text-primary-foreground rounded-lg flex items-center justify-center text-sm font-bold">IS</div>
          <div className="min-w-0">
            <h1 className="font-display text-sm font-bold leading-tight truncate">IT-Hilfe Schubert</h1>
            <p className="text-xs text-muted-foreground">Kassensystem</p>
          </div>
        </div>
        <nav className="flex-1 overflow-y-auto p-3 space-y-1">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            const badge = badgeForTab(tab.id);
            return (
              <button key={tab.id} data-tour={`tab-${tab.id}`} onClick={() => navigateTo(tab.id)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors ${isActive ? 'bg-primary/10 text-primary font-semibold' : 'text-muted-foreground hover:bg-muted hover:text-foreground'}`}>
                <Icon className="w-[18px] h-[18px] shrink-0" />
                <span className="flex-1 text-left">{tab.label}</span>
                {badge > 0 && <CountBadge count={badge} ring="ring-card" />}
              </button>
            );
          })}
        </nav>
        <div className="p-3 border-t border-border">
          <p className="px-3 pb-2 text-[11px] text-muted-foreground">Version {APP_VERSION}</p>
          <button onClick={handleLogout} className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-muted-foreground hover:bg-muted hover:text-foreground transition-colors">
            <LogOut className="w-[18px] h-[18px]" /><span>Abmelden</span>
          </button>
        </div>
      </aside>

      {/* Hauptspalte */}
      <div className="flex flex-col flex-1 min-w-0 h-[100dvh]">
      <header className="bg-primary text-primary-foreground px-4 py-3 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-2 lg:hidden">
            <div className="w-8 h-8 bg-white/20 rounded-lg flex items-center justify-center text-sm font-bold">IS</div>
            <div><h1 className="font-display text-base font-bold leading-tight">IT-Hilfe Schubert</h1><p className="text-xs opacity-80">Kassensystem</p></div>
          </div>
          <h1 className="hidden lg:block font-display text-lg font-bold">{activeLabel}</h1>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setShowNotif((v) => !v)} title="Benachrichtigungen" className="relative flex items-center justify-center rounded-lg bg-white/15 hover:bg-white/25 w-9 h-9 transition-colors">
            <Bell className="w-[18px] h-[18px]" />
            {total > 0 && <span className="absolute -top-1 -right-1"><CountBadge count={total} ring="ring-primary" /></span>}
          </button>
          <button onClick={handleLogout} title="Abmelden" className="flex items-center gap-1.5 rounded-lg bg-white/15 hover:bg-white/25 px-3 py-1.5 text-sm font-medium transition-colors">
            <LogOut className="w-4 h-4" /><span className="hidden sm:inline">Abmelden</span>
          </button>
        </div>
      </header>

      {/* Notification Dropdown */}
      {showNotif && (
        <div className="fixed inset-0 z-40" onClick={() => setShowNotif(false)}>
          <div className="absolute top-14 right-2 bg-card text-foreground rounded-xl shadow-xl border border-border w-[min(320px,calc(100vw-1rem))] overflow-hidden" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-4 py-3 border-b border-border">
              <span className="font-semibold text-sm">Benachrichtigungen</span>
              <button onClick={() => setShowNotif(false)} className="text-muted-foreground hover:text-foreground"><X className="w-4 h-4" /></button>
            </div>
            <div className="max-h-[60vh] overflow-y-auto">
              {total === 0 ? (
                <div className="px-4 py-8 text-center text-sm text-muted-foreground">Keine neuen Benachrichtigungen.</div>
              ) : (
                <div className="py-1">
                  {openAppointments > 0 && (
                    <button onClick={() => navigateTo('appointments')} className="w-full flex items-center gap-3 px-4 py-3 hover:bg-muted transition-colors text-left">
                      <div className="w-9 h-9 rounded-lg bg-blue-100 dark:bg-blue-500/15 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0"><CalendarDays className="w-4 h-4" /></div>
                      <div className="min-w-0 flex-1"><p className="text-sm font-medium">Offene Terminanfragen</p><p className="text-xs text-muted-foreground">{openAppointments} warten auf Bearbeitung</p></div>
                      <CountBadge count={openAppointments} />
                    </button>
                  )}
                  {isAdmin && pendingUsers > 0 && (
                    <button onClick={() => navigateTo('settings', 'team')} className="w-full flex items-center gap-3 px-4 py-3 hover:bg-muted transition-colors text-left">
                      <div className="w-9 h-9 rounded-lg bg-amber-100 dark:bg-amber-500/15 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0"><Users className="w-4 h-4" /></div>
                      <div className="min-w-0 flex-1"><p className="text-sm font-medium">Registrierungsanfragen</p><p className="text-xs text-muted-foreground">{pendingUsers} neue{pendingUsers === 1 ? 'r' : ''} Mitarbeiter wartet auf Freigabe</p></div>
                      <CountBadge count={pendingUsers} />
                    </button>
                  )}
                  {dueReminders > 0 && (
                    <button onClick={() => navigateTo('dashboard')} className="w-full flex items-center gap-3 px-4 py-3 hover:bg-muted transition-colors text-left">
                      <div className="w-9 h-9 rounded-lg bg-purple-100 dark:bg-purple-500/15 text-purple-600 dark:text-purple-400 flex items-center justify-center shrink-0"><Bell className="w-4 h-4" /></div>
                      <div className="min-w-0 flex-1"><p className="text-sm font-medium">Fällige Erinnerungen</p><p className="text-xs text-muted-foreground">{dueReminders} anstehend</p></div>
                      <CountBadge count={dueReminders} />
                    </button>
                  )}
                  {openTickets > 0 && (
                    <button onClick={() => navigateTo('tickets')} className="w-full flex items-center gap-3 px-4 py-3 hover:bg-muted transition-colors text-left">
                      <div className="w-9 h-9 rounded-lg bg-blue-100 dark:bg-blue-500/15 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0"><LifeBuoy className="w-4 h-4" /></div>
                      <div className="min-w-0 flex-1"><p className="text-sm font-medium">{isAdmin ? 'Neue Tickets' : 'Ticket-Updates'}</p><p className="text-xs text-muted-foreground">{openTickets} ungelesen</p></div>
                      <CountBadge count={openTickets} />
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      <main className="flex-1 overflow-y-auto">
        <div className="w-full lg:max-w-6xl lg:mx-auto lg:px-2">
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] as any }}
          >
            {activeTab === 'dashboard' && (
              <DashboardView
                onNavigate={navigateTo}
                onViewInvoice={(id: number) => { pushHistory(); setViewInvoiceId(id); setActiveTab('belege' as TabId); }}
              />
            )}
            {activeTab === 'customers' && (
              <CustomersView
                isAdmin={isAdmin}
                editCustomerId={editCustomerId}
                onEditCustomer={(id: number | null) => { if (id !== null) pushHistory(); setEditCustomerId(id); }}
                onViewCustomerDetail={(id: number) => { pushHistory(); setViewCustomerDetailId(id); }}
              />
            )}
            {activeTab === 'booking' && (
              <BookingView onInvoiceCreated={(id: number) => { setViewInvoiceId(id); setActiveTab('belege' as TabId); }} />
            )}
            {activeTab === 'belege' && (
              <BelegeHubView viewInvoiceId={viewInvoiceId} onViewInvoice={setViewInvoiceId} />
            )}
            {activeTab === 'tickets' && <TicketsView isAdmin={isAdmin} />}
            {activeTab === 'email' && <EmailView />}
            {activeTab === 'finances' && <FinancesView />}
            {activeTab === 'products' && <ProductsView />}
            {activeTab === 'appointments' && <AppointmentsView employeeNo={employeeNo} />}
            {activeTab === 'settings' && <SettingsView isAdmin={isAdmin} initialSection={settingsSection} />}
          </motion.div>
        </AnimatePresence>
        </div>
      </main>

      {showMore && (
        <div className="fixed inset-0 z-40" onClick={() => setShowMore(false)}>
          <div className="absolute bottom-16 right-2 bg-card rounded-xl shadow-xl border border-border p-1 min-w-[170px]" onClick={(e) => e.stopPropagation()}>
            {moreTabs.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              const badge = badgeForTab(tab.id);
              return (
                <button key={tab.id} data-tour={`tab-${tab.id}`} onClick={() => { navigateTo(tab.id); }}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors ${isActive ? 'bg-primary/10 text-primary font-medium' : 'text-foreground hover:bg-muted'}`}>
                  <Icon className="w-4 h-4" /><span className="flex-1 text-left">{tab.label}</span>
                  {badge > 0 && <CountBadge count={badge} ring="ring-card" />}
                </button>
              );
            })}
          </div>
        </div>
      )}

      <nav className="lg:hidden bg-card border-t border-border shrink-0 pb-safe">
        <div className="flex">
          {mainTabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button key={tab.id} data-tour={`tab-${tab.id}`} onClick={() => { navigateTo(tab.id); }}
                className={`relative flex-1 flex flex-col items-center py-2 gap-0.5 press-scale transition-colors ${isActive ? 'text-primary' : 'text-muted-foreground hover:text-foreground'}`}>
                {isActive && <motion.span layoutId="navIndicator" className="absolute top-0 h-0.5 w-8 rounded-full bg-primary" transition={{ type: 'spring', stiffness: 500, damping: 32 }} />}
                <Icon className="w-5 h-5" /><span className="text-[10px] font-medium">{tab.label}</span>
              </button>
            );
          })}
          <button data-tour="more" onClick={() => setShowMore(!showMore)}
            className={`relative flex-1 flex flex-col items-center py-2 gap-0.5 transition-colors ${isMoreActive ? 'text-primary' : 'text-muted-foreground hover:text-foreground'}`}>
            {total > 0 && <span className="absolute top-1.5 right-[calc(50%-18px)]"><CountBadge count={total} ring="ring-card" /></span>}
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="1" /><circle cx="19" cy="12" r="1" /><circle cx="5" cy="12" r="1" />
            </svg>
            <span className="text-[10px] font-medium">Mehr</span>
          </button>
        </div>
      </nav>
      </div>
    </div>
  );
}
