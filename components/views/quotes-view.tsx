'use client';

import { useState, useEffect, useCallback } from 'react';
import { Plus, Send, FileCheck, Trash2, Search, ArrowLeft, X, ChevronDown, ChevronUp, Package, Clock, Shield, XCircle } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { formatCurrency, formatDate, getZoneCost } from '@/lib/utils';

interface Quote {
  id: number; quoteNumber: string; customerId: number; customer: any; items: any[]; subtotal: number; discount: number; travelCost: number; total: number; status: string; validUntil: string; notes: string; emailSentAt: string | null; acceptedAt: string | null; convertedInvoiceId: number | null; createdAt: string;
}

export function QuotesView({ onViewInvoice }: { onViewInvoice?: (id: number) => void }) {
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [customers, setCustomers] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [viewing, setViewing] = useState<Quote | null>(null);
  const [filter, setFilter] = useState('ALL');
  // Create form
  const [selectedCustomer, setSelectedCustomer] = useState<any>(null);
  const [customerSearch, setCustomerSearch] = useState('');
  const [showCustomerList, setShowCustomerList] = useState(false);
  const [cart, setCart] = useState<any[]>([]);
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      const [qRes, cRes, pRes] = await Promise.all([
        fetch(`/api/quotes${filter !== 'ALL' ? `?status=${filter}` : ''}`),
        fetch('/api/customers'),
        fetch('/api/products'),
      ]);
      setQuotes(await qRes.json() ?? []);
      setCustomers(await cRes.json() ?? []);
      setProducts(await pRes.json() ?? []);
    } catch { } finally { setLoading(false); }
  }, [filter]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const addToCart = (product: any) => {
    const existing = cart.find((c) => c.product.id === product.id);
    if (existing) {
      setCart(cart.map((c) => c.product.id === product.id ? { ...c, quantity: c.quantity + 1 } : c));
    } else {
      setCart([...cart, { product, quantity: 1 }]);
    }
  };

  const handleCreate = async () => {
    if (!selectedCustomer || cart.length === 0) { toast.error('Kunde und Positionen erforderlich'); return; }
    setSubmitting(true);
    try {
      const travelCost = getZoneCost(selectedCustomer.zone);
      const items = cart.map((c) => ({ productId: c.product.id, name: c.product.name, quantity: c.quantity, unitPrice: c.product.price }));
      const res = await fetch('/api/quotes', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ customerId: selectedCustomer.id, items, travelCost, discount: 0, notes }),
      });
      if (!res.ok) throw new Error();
      toast.success('Angebot erstellt');
      setCreating(false); setCart([]); setSelectedCustomer(null); setNotes('');
      fetchData();
    } catch { toast.error('Fehler'); } finally { setSubmitting(false); }
  };

  const handleSend = async (id: number) => {
    try {
      const res = await fetch(`/api/quotes/${id}/send`, { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Fehler');
      toast.success('Angebot per E-Mail gesendet!');
      fetchData();
    } catch (e: any) { toast.error(e.message || 'Fehler'); }
  };

  const handleAccept = async (id: number) => {
    try {
      const res = await fetch(`/api/quotes/${id}/accept`, { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Fehler');
      toast.success(`Angebot angenommen! Rechnung ${data.invoiceNumber} erstellt.`);
      fetchData();
    } catch (e: any) { toast.error(e.message || 'Fehler'); }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Angebot löschen?')) return;
    try { await fetch(`/api/quotes/${id}`, { method: 'DELETE' }); toast.success('Gelöscht'); fetchData(); } catch { toast.error('Fehler'); }
  };

  const handleCancel = async (id: number) => {
    const reason = prompt('Storno-Grund (optional):');
    if (reason === null) return; // cancelled prompt
    try {
      const res = await fetch(`/api/quotes/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'STORNIERT', cancelledAt: new Date().toISOString(), cancellationReason: reason || '' }),
      });
      if (!res.ok) throw new Error();
      toast.success('Angebot storniert');
      setViewing(null);
      fetchData();
    } catch { toast.error('Fehler beim Stornieren'); }
  };

  const statusColors: Record<string, string> = { ENTWURF: 'bg-gray-100 text-gray-700', GESENDET: 'bg-blue-100 text-blue-700', ANGENOMMEN: 'bg-green-100 text-green-700', ABGELEHNT: 'bg-red-100 text-red-700', STORNIERT: 'bg-red-100 text-red-700 line-through' };

  // Create form
  if (creating) {
    const filteredCustomers = customers.filter((c) => `${c.firstName} ${c.lastName} ${c.city}`.toLowerCase().includes(customerSearch.toLowerCase()));
    const catIcons: Record<string, any> = { FIXED: Package, HOURLY: Clock, SUBSCRIPTION: Shield };
    const subtotal = cart.reduce((s, c) => s + c.product.price * c.quantity, 0);
    const travelCost = selectedCustomer ? getZoneCost(selectedCustomer.zone) : 0;

    return (
      <div className="p-4 space-y-4 pb-8">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" onClick={() => setCreating(false)}><ArrowLeft className="w-5 h-5" /></Button>
          <h2 className="font-display font-semibold text-lg">Neues Angebot</h2>
        </div>

        {/* Customer selection */}
        <Card className="shadow-sm"><CardContent className="p-4 space-y-2">
          <Label>Kunde *</Label>
          {selectedCustomer ? (
            <div className="flex items-center justify-between bg-primary/5 p-2 rounded-lg">
              <span className="text-sm font-medium">{selectedCustomer.firstName} {selectedCustomer.lastName}</span>
              <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setSelectedCustomer(null)}><X className="w-3 h-3" /></Button>
            </div>
          ) : (
            <div className="relative">
              <Input value={customerSearch} onChange={(e: any) => { setCustomerSearch(e.target.value); setShowCustomerList(true); }} placeholder="Kunde suchen..." />
              {showCustomerList && customerSearch && (
                <div className="absolute z-10 w-full bg-card border rounded-lg shadow-lg mt-1 max-h-40 overflow-y-auto">
                  {filteredCustomers.map((c) => (
                    <button key={c.id} onClick={() => { setSelectedCustomer(c); setShowCustomerList(false); setCustomerSearch(''); }} className="w-full text-left px-3 py-2 text-sm hover:bg-muted">{c.firstName} {c.lastName} - {c.city}</button>
                  ))}
                </div>
              )}
            </div>
          )}
        </CardContent></Card>

        {/* Products */}
        <Card className="shadow-sm"><CardContent className="p-4 space-y-2">
          <Label>Positionen</Label>
          {products.map((p) => {
            const Icon = catIcons[p.category] || Package;
            const inCart = cart.find((c) => c.product.id === p.id);
            return (
              <button key={p.id} onClick={() => addToCart(p)} className="w-full flex items-center gap-2 p-2 rounded-lg hover:bg-muted/50 text-left">
                <Icon className="w-4 h-4 text-primary shrink-0" />
                <div className="flex-1 min-w-0"><p className="text-sm truncate">{p.name}</p></div>
                <span className="text-sm font-medium">{formatCurrency(p.price)}</span>
                {inCart && <span className="text-xs bg-primary text-white px-1.5 rounded-full">{inCart.quantity}</span>}
              </button>
            );
          })}
        </CardContent></Card>

        {/* Cart */}
        {cart.length > 0 && (
          <Card className="shadow-sm"><CardContent className="p-4 space-y-2">
            <Label>Warenkorb</Label>
            {cart.map((c, i) => (
              <div key={i} className="flex items-center justify-between text-sm">
                <span className="flex-1 truncate">{c.quantity}x {c.product.name}</span>
                <span className="font-medium">{formatCurrency(c.product.price * c.quantity)}</span>
                <button onClick={() => setCart(cart.filter((_, j) => j !== i))} className="ml-2 text-destructive"><Trash2 className="w-3.5 h-3.5" /></button>
              </div>
            ))}
            <div className="border-t pt-2 space-y-1 text-sm">
              <div className="flex justify-between"><span>Zwischensumme</span><span>{formatCurrency(subtotal)}</span></div>
              {travelCost > 0 && <div className="flex justify-between"><span>Anfahrt</span><span>{formatCurrency(travelCost)}</span></div>}
              <div className="flex justify-between font-bold text-primary"><span>Gesamt</span><span>{formatCurrency(subtotal + travelCost)}</span></div>
            </div>
          </CardContent></Card>
        )}

        <div><Label>Notizen</Label><textarea value={notes} onChange={(e: any) => setNotes(e.target.value)} className="w-full mt-1 p-2 text-sm border border-input rounded-md bg-background min-h-[60px] resize-y" /></div>
        <Button onClick={handleCreate} disabled={submitting} className="w-full">{submitting ? 'Wird erstellt...' : 'Angebot erstellen'}</Button>
      </div>
    );
  }

  // Detail view
  if (viewing) {
    return (
      <div className="p-4 space-y-4 pb-8">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" onClick={() => setViewing(null)}><ArrowLeft className="w-5 h-5" /></Button>
          <h2 className="font-display font-semibold text-lg">{viewing.quoteNumber}</h2>
          <span className={`text-xs px-2 py-0.5 rounded-full ml-auto ${statusColors[viewing.status] || ''}`}>{viewing.status}</span>
        </div>
        <Card className="shadow-sm"><CardContent className="p-4 space-y-3">
          <div className="text-sm"><span className="text-muted-foreground">Kunde:</span> <strong>{viewing.customer?.firstName} {viewing.customer?.lastName}</strong></div>
          <div className="text-sm"><span className="text-muted-foreground">Datum:</span> {formatDate(viewing.createdAt)}</div>
          {viewing.validUntil && <div className="text-sm"><span className="text-muted-foreground">Gültig bis:</span> {formatDate(viewing.validUntil)}</div>}
          <div className="border-t pt-2 space-y-1">
            {viewing.items.map((item: any, i: number) => (
              <div key={i} className="flex justify-between text-sm"><span>{item.quantity}x {item.name}</span><span>{formatCurrency(item.total)}</span></div>
            ))}
          </div>
          <div className="border-t pt-2 space-y-1 text-sm">
            {viewing.travelCost > 0 && <div className="flex justify-between"><span>Anfahrt</span><span>{formatCurrency(viewing.travelCost)}</span></div>}
            {viewing.discount > 0 && <div className="flex justify-between text-green-600"><span>Rabatt</span><span>-{formatCurrency(viewing.discount)}</span></div>}
            <div className="flex justify-between font-bold text-lg"><span>Gesamt</span><span className="text-primary">{formatCurrency(viewing.total)}</span></div>
          </div>
          {viewing.notes && <p className="text-xs text-muted-foreground bg-muted/50 p-2 rounded">{viewing.notes}</p>}
        </CardContent></Card>

        <div className="flex gap-2">
          {viewing.status === 'ENTWURF' && (
            <Button className="flex-1 gap-1" onClick={() => handleSend(viewing.id)}><Send className="w-4 h-4" /> Per E-Mail senden</Button>
          )}
          {(viewing.status === 'ENTWURF' || viewing.status === 'GESENDET') && (
            <Button variant="outline" className="flex-1 gap-1" onClick={() => handleAccept(viewing.id)}><FileCheck className="w-4 h-4" /> Annehmen</Button>
          )}
          {viewing.convertedInvoiceId && onViewInvoice && (
            <Button variant="outline" className="flex-1 gap-1" onClick={() => { onViewInvoice(viewing.convertedInvoiceId!); }}><FileCheck className="w-4 h-4" /> Rechnung ansehen</Button>
          )}
        </div>
        {viewing.status !== 'STORNIERT' && viewing.status !== 'ANGENOMMEN' && (
          <Button
            variant="outline"
            onClick={() => handleCancel(viewing.id)}
            className="w-full gap-2 text-red-600 border-red-200 hover:bg-red-50 dark:border-red-800 dark:hover:bg-red-950 mt-2"
          >
            <XCircle className="w-4 h-4" /> Angebot stornieren
          </Button>
        )}
        {viewing.status === 'STORNIERT' && (
          <div className="bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 rounded-lg p-3 mt-2">
            <p className="text-xs font-medium text-red-700 dark:text-red-300 flex items-center gap-1"><XCircle className="w-3 h-3" /> Storniert</p>
            {(viewing as any).cancellationReason && <p className="text-xs text-muted-foreground mt-1">Grund: {(viewing as any).cancellationReason}</p>}
          </div>
        )}
      </div>
    );
  }

  // List
  return (
    <div className="p-4 space-y-4 pb-8">
      <div className="flex items-center justify-between">
        <h2 className="font-display font-semibold text-lg">Angebote</h2>
        <Button size="sm" onClick={() => setCreating(true)} className="gap-1"><Plus className="w-4 h-4" /> Neu</Button>
      </div>

      <div className="flex gap-1 overflow-x-auto">
        {['ALL', 'ENTWURF', 'GESENDET', 'ANGENOMMEN', 'ABGELEHNT', 'STORNIERT'].map((s) => (
          <button key={s} onClick={() => setFilter(s)} className={`py-1.5 px-3 text-xs font-medium rounded-lg whitespace-nowrap ${filter === s ? 'bg-primary text-white' : 'bg-muted text-muted-foreground'}`}>
            {s === 'ALL' ? 'Alle' : s.charAt(0) + s.slice(1).toLowerCase()}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center py-8"><div className="animate-spin w-6 h-6 border-2 border-primary border-t-transparent rounded-full" /></div>
      ) : quotes.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-4">Keine Angebote</p>
      ) : (
        <div className="space-y-2">
          {quotes.map((q) => (
            <button key={q.id} onClick={() => setViewing(q)} className="w-full text-left">
              <Card className="shadow-sm hover:bg-muted/30 transition-colors">
                <CardContent className="p-3 flex items-center justify-between">
                  <div className="min-w-0">
                    <p className="text-sm font-medium">{q.quoteNumber}</p>
                    <p className="text-xs text-muted-foreground">{q.customer?.firstName} {q.customer?.lastName} · {formatDate(q.createdAt)}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-sm font-semibold">{formatCurrency(q.total)}</p>
                    <span className={`text-[10px] px-2 py-0.5 rounded-full ${statusColors[q.status] || ''}`}>{q.status}</span>
                  </div>
                </CardContent>
              </Card>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
