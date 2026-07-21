'use client';

import { useState, useEffect, useCallback } from 'react';
import { Plus, Search, Filter, FileSignature, ClipboardList, FileText, ChevronRight, ArrowLeft, User, Clock, CheckCircle2, Send, AlertCircle, XCircle } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { formatCurrency, formatDate } from '@/lib/utils';
import { QuotesView } from './quotes-view';
import { InvoicesView } from './invoices-view';
import { OrderDetailView } from './order-detail-view';

interface Order {
  id: number; orderNumber: string; customerId: number; customer: any;
  status: string; title: string; description: string;
  startedAt: string | null; completedAt: string | null;
  liabilitySigned: boolean; handoverSigned: boolean;
  routeDistanceKm: number; createdAt: string;
}

type SubTab = 'angebote' | 'auftraege' | 'rechnungen';

export function BelegeHubView({ viewInvoiceId, onViewInvoice }: {
  viewInvoiceId: number | null;
  onViewInvoice: (id: number | null) => void;
}) {
  const [subTab, setSubTab] = useState<SubTab>('auftraege');
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [orderFilter, setOrderFilter] = useState('ALL');
  const [orderSearch, setOrderSearch] = useState('');
  const [viewingOrderId, setViewingOrderId] = useState<number | null>(null);
  const [creating, setCreating] = useState(false);
  const [customers, setCustomers] = useState<any[]>([]);
  const [customerSearch, setCustomerSearch] = useState('');
  const [selectedCustomer, setSelectedCustomer] = useState<any>(null);
  const [showCustomerList, setShowCustomerList] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const fetchOrders = useCallback(async () => {
    try {
      const url = orderFilter !== 'ALL' ? `/api/orders?status=${orderFilter}` : '/api/orders';
      const res = await fetch(url);
      setOrders(await res.json() ?? []);
    } catch (e) { console.error(e); } finally { setLoading(false); }
  }, [orderFilter]);

  const fetchCustomers = useCallback(async () => {
    try {
      const res = await fetch('/api/customers');
      setCustomers(await res.json() ?? []);
    } catch (e) { console.error(e); }
  }, []);

  useEffect(() => {
    if (subTab === 'auftraege') { fetchOrders(); fetchCustomers(); }
  }, [subTab, fetchOrders, fetchCustomers]);

  const createOrder = async () => {
    if (!selectedCustomer) { toast.error('Bitte Kunden wählen'); return; }
    setSubmitting(true);
    try {
      const res = await fetch('/api/orders', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ customerId: selectedCustomer.id, title: newTitle, description: newDesc }),
      });
      if (!res.ok) throw new Error('Fehler');
      const order = await res.json();
      toast.success(`Auftrag ${order.orderNumber} erstellt`);
      setCreating(false);
      setSelectedCustomer(null);
      setNewTitle('');
      setNewDesc('');
      setViewingOrderId(order.id);
      fetchOrders();
    } catch (e: any) { toast.error(e.message); }
    finally { setSubmitting(false); }
  };

  // Viewing a specific order
  if (viewingOrderId) {
    return <OrderDetailView orderId={viewingOrderId} onBack={() => { setViewingOrderId(null); fetchOrders(); }} />;
  }

  const filteredCustomers = customers.filter(c => {
    const q = customerSearch.toLowerCase();
    return c.firstName?.toLowerCase().includes(q) || c.lastName?.toLowerCase().includes(q) || c.phone?.includes(q);
  });

  const tabs: { id: SubTab; label: string; icon: any }[] = [
    { id: 'angebote', label: 'Angebote', icon: FileSignature },
    { id: 'auftraege', label: 'Aufträge', icon: ClipboardList },
    { id: 'rechnungen', label: 'Rechnungen', icon: FileText },
  ];

  const orderStatusFilters = [
    { value: 'ALL', label: 'Alle' },
    { value: 'OFFEN', label: 'Offen' },
    { value: 'IN_BEARBEITUNG', label: 'In Bearbeitung' },
    { value: 'ABGESCHLOSSEN', label: 'Abgeschlossen' },
    { value: 'STORNIERT', label: 'Storniert' },
  ];

  return (
    <div className="flex flex-col h-full">
      {/* Sub-Tab Navigation */}
      <div className="flex border-b border-border bg-card/50 shrink-0">
        {tabs.map((t) => {
          const Icon = t.icon;
          const active = subTab === t.id;
          return (
            <button
              key={t.id}
              onClick={() => setSubTab(t.id)}
              className={`flex-1 flex items-center justify-center gap-1.5 py-3 text-sm font-medium transition-colors border-b-2 ${
                active ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'
              }`}
            >
              <Icon className="w-4 h-4" />
              {t.label}
            </button>
          );
        })}
      </div>

      {/* Tab Content */}
      <div className="flex-1 overflow-y-auto">
        {subTab === 'angebote' && (
          <QuotesView onViewInvoice={(id) => { onViewInvoice(id); setSubTab('rechnungen'); }} />
        )}

        {subTab === 'rechnungen' && (
          <InvoicesView viewInvoiceId={viewInvoiceId} onViewInvoice={onViewInvoice} />
        )}

        {subTab === 'auftraege' && (
          <div className="p-4 space-y-3">
            {/* Create new order form */}
            {creating ? (
              <Card className="shadow-sm">
                <CardContent className="p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="font-display font-semibold text-sm">Neuer Auftrag</h3>
                    <Button size="icon" variant="ghost" onClick={() => setCreating(false)}><ArrowLeft className="w-4 h-4" /></Button>
                  </div>

                  {/* Customer selection */}
                  <div>
                    <Label className="text-xs">Kunde *</Label>
                    {selectedCustomer ? (
                      <div className="flex items-center gap-2 p-2 bg-primary/5 rounded-lg mt-1">
                        <User className="w-4 h-4 text-primary" />
                        <span className="text-sm font-medium flex-1">{selectedCustomer.firstName} {selectedCustomer.lastName}</span>
                        <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => setSelectedCustomer(null)}>
                          <AlertCircle className="w-3 h-3" />
                        </Button>
                      </div>
                    ) : (
                      <div className="relative mt-1">
                        <Input
                          value={customerSearch}
                          onChange={(e) => { setCustomerSearch(e.target.value); setShowCustomerList(true); }}
                          onFocus={() => setShowCustomerList(true)}
                          placeholder="Kunden suchen..."
                          className="text-sm"
                        />
                        {showCustomerList && filteredCustomers.length > 0 && (
                          <div className="absolute top-full left-0 right-0 z-10 mt-1 bg-card border border-border rounded-lg shadow-lg max-h-40 overflow-y-auto">
                            {filteredCustomers.slice(0, 8).map(c => (
                              <button key={c.id} onClick={() => { setSelectedCustomer(c); setShowCustomerList(false); setCustomerSearch(''); }}
                                className="w-full text-left px-3 py-2 text-sm hover:bg-muted/50 flex items-center gap-2">
                                <span className="font-medium">{c.firstName} {c.lastName}</span>
                                <span className="text-xs text-muted-foreground">{c.city}</span>
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  <div>
                    <Label className="text-xs">Auftragsbezeichnung</Label>
                    <Input value={newTitle} onChange={(e) => setNewTitle(e.target.value)} placeholder="z.B. PC-Reparatur, WLAN-Einrichtung" className="text-sm mt-1" />
                  </div>
                  <div>
                    <Label className="text-xs">Beschreibung</Label>
                    <textarea
                      value={newDesc}
                      onChange={(e) => setNewDesc(e.target.value)}
                      className="w-full mt-1 p-2 text-sm border border-input rounded-md bg-background min-h-[60px] resize-y"
                      placeholder="Problembeschreibung..."
                    />
                  </div>
                  <Button onClick={createOrder} disabled={!selectedCustomer || submitting} className="w-full gap-2">
                    <ClipboardList className="w-4 h-4" /> Auftrag erstellen
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <>
              <div className="relative mb-2">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input className="pl-9" placeholder="Auftrag suchen..." value={orderSearch} onChange={(e: any) => setOrderSearch(e.target.value)} />
              </div>
              <div className="flex items-center gap-2">
                {/* Filter */}
                <div className="flex gap-1 flex-1 overflow-x-auto">
                  {orderStatusFilters.map(f => (
                    <button
                      key={f.value}
                      onClick={() => setOrderFilter(f.value)}
                      className={`text-xs px-2.5 py-1.5 rounded-full whitespace-nowrap transition-colors ${
                        orderFilter === f.value
                          ? 'bg-primary text-primary-foreground'
                          : 'bg-muted text-muted-foreground hover:bg-muted/80'
                      }`}
                    >
                      {f.label}
                    </button>
                  ))}
                </div>
                <Button size="icon" onClick={() => setCreating(true)}>
                  <Plus className="w-5 h-5" />
                </Button>
              </div>
              </>
            )}

            {/* Orders list */}
            {!creating && (
              loading ? (
                <div className="flex justify-center py-8"><div className="animate-spin w-6 h-6 border-2 border-primary border-t-transparent rounded-full" /></div>
              ) : orders.length === 0 ? (
                <Card className="shadow-sm">
                  <CardContent className="p-6 text-center">
                    <ClipboardList className="w-10 h-10 mx-auto text-muted-foreground mb-2" />
                    <p className="text-muted-foreground text-sm">Keine Aufträge gefunden</p>
                  </CardContent>
                </Card>
              ) : (
                <div className="space-y-2">
                  {orders.filter((o) => {
                    if (!orderSearch.trim()) return true;
                    const q = orderSearch.toLowerCase();
                    return `${o.orderNumber} ${o.title} ${o.customer?.firstName ?? ''} ${o.customer?.lastName ?? ''}`.toLowerCase().includes(q);
                  }).map((o) => {
                    const isOpen = o.status === 'OFFEN';
                    const isActive = o.status === 'IN_BEARBEITUNG';
                    const isDone = o.status === 'ABGESCHLOSSEN';
                    const isCancelled = o.status === 'STORNIERT';
                    const statusColor = isCancelled ? 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400'
                      : isOpen ? 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400'
                      : isActive ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400'
                      : 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400';
                    const statusIcon = isCancelled ? XCircle : isOpen ? Clock : isActive ? ClipboardList : CheckCircle2;
                    const StatusIcon = statusIcon;
                    return (
                      <Card key={o.id} className="shadow-sm cursor-pointer hover:shadow-md transition-shadow" onClick={() => setViewingOrderId(o.id)}>
                        <CardContent className="p-3 flex items-center gap-3">
                          <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${statusColor}`}>
                            <StatusIcon className="w-5 h-5" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <p className="font-medium text-sm truncate">{o.orderNumber}</p>
                              <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${statusColor}`}>
                                {isCancelled ? 'Storniert' : isOpen ? 'Offen' : isActive ? 'In Bearbeitung' : 'Abgeschlossen'}
                              </span>
                            </div>
                            <p className="text-xs text-muted-foreground truncate">
                              {o.customer?.firstName} {o.customer?.lastName}
                              {o.title ? ` \u2013 ${o.title}` : ''}
                            </p>
                            <p className="text-[10px] text-muted-foreground">{formatDate(o.createdAt)}</p>
                          </div>
                          <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              )
            )}
          </div>
        )}
      </div>
    </div>
  );
}
