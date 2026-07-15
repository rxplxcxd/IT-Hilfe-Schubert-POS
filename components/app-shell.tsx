'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useRouter } from 'next/navigation';
import { LayoutDashboard, Users, ShoppingCart, FileText, Settings, Mail, Package, Wallet, ClipboardList, CalendarDays, LogOut } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
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

const tabs = [
  { id: 'dashboard', label: 'Start', icon: LayoutDashboard },
  { id: 'customers', label: 'Kunden', icon: Users },
  { id: 'booking', label: 'Buchung', icon: ShoppingCart },
  { id: 'belege', label: 'Belege', icon: ClipboardList },
  { id: 'email', label: 'E-Mail', icon: Mail },
  { id: 'finances', label: 'Finanzen', icon: Wallet },
  { id: 'products', label: 'Produkte', icon: Package },
  { id: 'appointments', label: 'Termine', icon: CalendarDays },
  { id: 'settings', label: 'Einstellungen', icon: Settings },
] as const;

type TabId = typeof tabs[number]['id'];

export function AppShell() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<TabId>('dashboard');

  const handleLogout = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.replace('/login');
    router.refresh();
  };
  const [editCustomerId, setEditCustomerId] = useState<number | null>(null);
  const [viewInvoiceId, setViewInvoiceId] = useState<number | null>(null);
  const [viewCustomerDetailId, setViewCustomerDetailId] = useState<number | null>(null);
  const [composeEmailTo, setComposeEmailTo] = useState<string | null>(null);

  const navigateTo = (tab: TabId) => {
    setActiveTab(tab);
    setEditCustomerId(null);
    setViewInvoiceId(null);
    setViewCustomerDetailId(null);
    setComposeEmailTo(null);
  };

  const mainTabs = tabs.slice(0, 4);
  const moreTabs = tabs.slice(4);
  const isMoreActive = moreTabs.some((t) => t.id === activeTab);
  const [showMore, setShowMore] = useState(false);

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
            onBack={() => setViewCustomerDetailId(null)}
            onWriteEmail={(email) => { setComposeEmailTo(email); setActiveTab('email' as TabId); setViewCustomerDetailId(null); }}
            onViewInvoice={(id) => { setViewInvoiceId(id); setActiveTab('belege' as TabId); setViewCustomerDetailId(null); }}
          />
        </main>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-[100dvh] bg-background">
      <header className="bg-primary text-primary-foreground px-4 py-3 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-white/20 rounded-lg flex items-center justify-center text-sm font-bold">IS</div>
          <div><h1 className="font-display text-base font-bold leading-tight">IT-Hilfe Schubert</h1><p className="text-xs opacity-80">Kassensystem</p></div>
        </div>
        <button onClick={handleLogout} title="Abmelden" className="flex items-center gap-1.5 rounded-lg bg-white/15 hover:bg-white/25 px-3 py-1.5 text-sm font-medium transition-colors">
          <LogOut className="w-4 h-4" /><span className="hidden sm:inline">Abmelden</span>
        </button>
      </header>

      <main className="flex-1 overflow-y-auto">
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
                onViewInvoice={(id: number) => { setViewInvoiceId(id); setActiveTab('belege' as TabId); }}
              />
            )}
            {activeTab === 'customers' && (
              <CustomersView
                editCustomerId={editCustomerId}
                onEditCustomer={setEditCustomerId}
                onViewCustomerDetail={(id: number) => setViewCustomerDetailId(id)}
              />
            )}
            {activeTab === 'booking' && (
              <BookingView onInvoiceCreated={(id: number) => { setViewInvoiceId(id); setActiveTab('belege' as TabId); }} />
            )}
            {activeTab === 'belege' && (
              <BelegeHubView viewInvoiceId={viewInvoiceId} onViewInvoice={setViewInvoiceId} />
            )}
            {activeTab === 'email' && <EmailView />}
            {activeTab === 'finances' && <FinancesView />}
            {activeTab === 'products' && <ProductsView />}
            {activeTab === 'appointments' && <AppointmentsView />}
            {activeTab === 'settings' && <SettingsView />}
          </motion.div>
        </AnimatePresence>
      </main>

      {showMore && (
        <div className="fixed inset-0 z-40" onClick={() => setShowMore(false)}>
          <div className="absolute bottom-16 right-2 bg-card rounded-xl shadow-xl border border-border p-1 min-w-[170px]" onClick={(e) => e.stopPropagation()}>
            {moreTabs.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button key={tab.id} onClick={() => { navigateTo(tab.id); setShowMore(false); }}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors ${isActive ? 'bg-primary/10 text-primary font-medium' : 'text-foreground hover:bg-muted'}`}>
                  <Icon className="w-4 h-4" />{tab.label}
                </button>
              );
            })}
          </div>
        </div>
      )}

      <nav className="bg-card border-t border-border shrink-0 pb-safe">
        <div className="flex">
          {mainTabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button key={tab.id} onClick={() => { navigateTo(tab.id); setShowMore(false); }}
                className={`relative flex-1 flex flex-col items-center py-2 gap-0.5 press-scale transition-colors ${isActive ? 'text-primary' : 'text-muted-foreground hover:text-foreground'}`}>
                {isActive && <motion.span layoutId="navIndicator" className="absolute top-0 h-0.5 w-8 rounded-full bg-primary" transition={{ type: 'spring', stiffness: 500, damping: 32 }} />}
                <Icon className="w-5 h-5" /><span className="text-[10px] font-medium">{tab.label}</span>
              </button>
            );
          })}
          <button onClick={() => setShowMore(!showMore)}
            className={`flex-1 flex flex-col items-center py-2 gap-0.5 transition-colors ${isMoreActive ? 'text-primary' : 'text-muted-foreground hover:text-foreground'}`}>
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="1" /><circle cx="19" cy="12" r="1" /><circle cx="5" cy="12" r="1" />
            </svg>
            <span className="text-[10px] font-medium">Mehr</span>
          </button>
        </div>
      </nav>
    </div>
  );
}
