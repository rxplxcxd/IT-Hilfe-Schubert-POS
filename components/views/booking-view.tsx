'use client';

import { useState, useEffect, useCallback } from 'react';
import { Search, Package, Clock, Shield, Plus, Minus, Trash2, ShoppingCart, CreditCard, Banknote, ChevronDown, ChevronUp, MapPin } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { formatCurrency, getZoneCost, getZoneLabel } from '@/lib/utils';

interface Customer {
  id: number;
  firstName: string;
  lastName: string;
  phone: string;
  city: string;
  zone: number;
  subscriptions?: any[];
}

interface Product {
  id: number;
  name: string;
  description: string;
  category: string;
  price: number;
  unit: string;
}

interface CartItem {
  product: Product;
  quantity: number;
}

export function BookingView({ onInvoiceCreated }: { onInvoiceCreated: (id: number) => void }) {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [customerSearch, setCustomerSearch] = useState('');
  const [showCustomerList, setShowCustomerList] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<'BAR' | 'KARTE'>('BAR');
  const [customTravelCost, setCustomTravelCost] = useState('');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [expandedCategory, setExpandedCategory] = useState<string | null>('FIXED');

  const fetchData = useCallback(async () => {
    try {
      const [cRes, pRes] = await Promise.all([
        fetch('/api/customers'),
        fetch('/api/products'),
      ]);
      setCustomers(await cRes.json() ?? []);
      setProducts(await pRes.json() ?? []);
    } catch (e: any) { console.error(e); }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const hasActiveSchutzbrief = (selectedCustomer?.subscriptions ?? []).some((s: any) => s?.active);

  const addToCart = (product: Product) => {
    setCart((prev: CartItem[]) => {
      const existing = (prev ?? []).find((i: CartItem) => i?.product?.id === product?.id);
      if (existing) {
        return (prev ?? []).map((i: CartItem) =>
          i?.product?.id === product?.id ? { ...i, quantity: (i?.quantity ?? 0) + 1 } : i
        );
      }
      return [...(prev ?? []), { product, quantity: 1 }];
    });
  };

  const updateQuantity = (productId: number, delta: number) => {
    setCart((prev: CartItem[]) => {
      return (prev ?? []).map((i: CartItem) => {
        if (i?.product?.id === productId) {
          const newQty = Math.max(0, (i?.quantity ?? 0) + delta);
          return { ...i, quantity: newQty };
        }
        return i;
      }).filter((i: CartItem) => (i?.quantity ?? 0) > 0);
    });
  };

  const removeFromCart = (productId: number) => {
    setCart((prev: CartItem[]) => (prev ?? []).filter((i: CartItem) => i?.product?.id !== productId));
  };

  // Calculate totals
  const subtotal = (cart ?? []).reduce((sum: number, i: CartItem) => sum + ((i?.product?.price ?? 0) * (i?.quantity ?? 0)), 0);
  const travelCost = selectedCustomer
    ? (selectedCustomer?.zone === 4 ? (parseFloat(customTravelCost) || 0) : getZoneCost(selectedCustomer?.zone ?? 1))
    : 0;

  // Discount: 10% on FIXED and HOURLY items if Schutzbrief active
  const discountableTotal = hasActiveSchutzbrief
    ? (cart ?? []).filter((i: CartItem) => ['FIXED', 'HOURLY'].includes(i?.product?.category ?? '')).reduce((sum: number, i: CartItem) => sum + ((i?.product?.price ?? 0) * (i?.quantity ?? 0)), 0)
    : 0;
  const discount = discountableTotal * 0.1;
  const total = subtotal - discount + travelCost;

  const filteredCustomers = (customers ?? []).filter((c: Customer) => {
    const q = (customerSearch ?? '').toLowerCase();
    return (c?.firstName?.toLowerCase() ?? '').includes(q) || (c?.lastName?.toLowerCase() ?? '').includes(q) || (c?.phone ?? '').includes(q);
  });

  const categories = [
    { key: 'FIXED', label: 'Festpreis-Pakete', icon: Package, color: 'text-blue-600 bg-blue-50' },
    { key: 'HOURLY', label: 'Individuelle Hilfe', icon: Clock, color: 'text-amber-600 bg-amber-50' },
    { key: 'SUBSCRIPTION', label: 'Abonnements', icon: Shield, color: 'text-green-600 bg-green-50' },
  ];

  const handleSubmit = async () => {
    if (!selectedCustomer) { toast.error('Bitte Kunden auswählen'); return; }
    if ((cart ?? []).length === 0) { toast.error('Warenkorb ist leer'); return; }
    setSubmitting(true);
    try {
      const res = await fetch('/api/invoices', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerId: selectedCustomer.id,
          items: (cart ?? []).map((i: CartItem) => ({
            productId: i?.product?.id,
            name: i?.product?.name ?? '',
            quantity: i?.quantity ?? 1,
            unitPrice: i?.product?.price ?? 0,
          })),
          travelCost,
          discount,
          paymentMethod,
          notes,
        }),
      });
      if (!res.ok) throw new Error('Fehler beim Erstellen');
      const invoice = await res.json();
      toast.success(`Rechnung ${invoice?.invoiceNumber ?? ''} erstellt!`);
      setCart([]);
      setSelectedCustomer(null);
      setNotes('');
      onInvoiceCreated(invoice?.id);
    } catch (e: any) {
      toast.error(e?.message ?? 'Fehler');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="p-4 space-y-4 pb-8">
      <h2 className="font-display font-semibold text-lg">Neue Buchung</h2>

      {/* Customer Selection */}
      <Card className="shadow-sm">
        <CardContent className="p-3 space-y-2">
          <Label className="text-sm font-medium">Kunde auswählen</Label>
          {selectedCustomer ? (
            <div className="flex items-center justify-between bg-primary/5 rounded-lg p-2">
              <div>
                <p className="font-medium text-sm">{selectedCustomer?.firstName ?? ''} {selectedCustomer?.lastName ?? ''}</p>
                <p className="text-xs text-muted-foreground flex items-center gap-1">
                  <MapPin className="w-3 h-3" /> {getZoneLabel(selectedCustomer?.zone ?? 1)}
                  {hasActiveSchutzbrief && <span className="text-green-600 font-medium ml-2">✓ Schutzbrief (10% Rabatt)</span>}
                </p>
              </div>
              <Button variant="ghost" size="sm" onClick={() => { setSelectedCustomer(null); setShowCustomerList(false); }}>Ändern</Button>
            </div>
          ) : (
            <>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  value={customerSearch}
                  onChange={(e: any) => { setCustomerSearch(e?.target?.value ?? ''); setShowCustomerList(true); }}
                  onFocus={() => setShowCustomerList(true)}
                  placeholder="Kunden suchen..."
                  className="pl-9"
                />
              </div>
              {showCustomerList && (
                <div className="max-h-48 overflow-y-auto border rounded-md">
                  {filteredCustomers.length === 0 ? (
                    <p className="p-3 text-sm text-muted-foreground text-center">Keine Kunden gefunden</p>
                  ) : (
                    filteredCustomers.map((c: Customer) => (
                      <button
                        key={c?.id}
                        className="w-full text-left p-2 hover:bg-accent text-sm border-b last:border-b-0 transition-colors"
                        onClick={() => { setSelectedCustomer(c); setShowCustomerList(false); setCustomerSearch(''); }}
                      >
                        <p className="font-medium">{c?.firstName ?? ''} {c?.lastName ?? ''}</p>
                        <p className="text-xs text-muted-foreground">{c?.phone ?? ''} • {c?.city ?? ''} • {getZoneLabel(c?.zone ?? 1)}</p>
                      </button>
                    ))
                  )}
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* Zone 4 custom cost */}
      {selectedCustomer?.zone === 4 && (
        <Card className="shadow-sm border-amber-200">
          <CardContent className="p-3">
            <Label>Anfahrtskosten (Zone 4 - individuell)</Label>
            <Input
              type="number"
              value={customTravelCost}
              onChange={(e: any) => setCustomTravelCost(e?.target?.value ?? '')}
              placeholder="Betrag in €"
              className="mt-1"
            />
          </CardContent>
        </Card>
      )}

      {/* Product Catalog */}
      <div className="space-y-2">
        {categories.map((cat) => {
          const Icon = cat.icon;
          const catProducts = (products ?? []).filter((p: Product) => p?.category === cat.key);
          const isExpanded = expandedCategory === cat.key;
          return (
            <Card key={cat.key} className="shadow-sm">
              <button
                className="w-full p-3 flex items-center justify-between"
                onClick={() => setExpandedCategory(isExpanded ? null : cat.key)}
              >
                <div className="flex items-center gap-2">
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${cat.color}`}>
                    <Icon className="w-4 h-4" />
                  </div>
                  <span className="font-medium text-sm">{cat.label}</span>
                </div>
                {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </button>
              {isExpanded && (
                <div className="px-3 pb-3 space-y-2">
                  {catProducts.map((p: Product) => {
                    const inCart = (cart ?? []).find((i: CartItem) => i?.product?.id === p?.id);
                    return (
                      <div key={p?.id} className="flex items-center justify-between bg-muted/50 rounded-lg p-2">
                        <div className="flex-1 min-w-0 mr-2">
                          <p className="text-sm font-medium truncate">{p?.name ?? ''}</p>
                          <p className="text-xs text-muted-foreground">{formatCurrency(p?.price ?? 0)} / {p?.unit ?? ''}</p>
                        </div>
                        {inCart ? (
                          <div className="flex items-center gap-1">
                            <Button variant="outline" size="icon" className="w-7 h-7" onClick={() => updateQuantity(p?.id, -1)}>
                              <Minus className="w-3 h-3" />
                            </Button>
                            <span className="w-6 text-center text-sm font-mono font-bold">{inCart?.quantity ?? 0}</span>
                            <Button variant="outline" size="icon" className="w-7 h-7" onClick={() => updateQuantity(p?.id, 1)}>
                              <Plus className="w-3 h-3" />
                            </Button>
                          </div>
                        ) : (
                          <Button size="sm" variant="outline" onClick={() => addToCart(p)} className="gap-1">
                            <Plus className="w-3 h-3" /> Hinzufügen
                          </Button>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </Card>
          );
        })}
      </div>

      {/* Cart Summary */}
      {(cart ?? []).length > 0 && (
        <Card className="shadow-sm border-primary/30">
          <CardContent className="p-3 space-y-3">
            <h3 className="font-medium text-sm flex items-center gap-2"><ShoppingCart className="w-4 h-4" /> Warenkorb</h3>
            <div className="space-y-1">
              {(cart ?? []).map((item: CartItem) => (
                <div key={item?.product?.id} className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    <button onClick={() => removeFromCart(item?.product?.id)} className="text-destructive">
                      <Trash2 className="w-3 h-3" />
                    </button>
                    <span className="truncate">{item?.quantity ?? 0}x {item?.product?.name ?? ''}</span>
                  </div>
                  <span className="font-mono shrink-0">{formatCurrency((item?.product?.price ?? 0) * (item?.quantity ?? 0))}</span>
                </div>
              ))}
            </div>
            <div className="border-t pt-2 space-y-1 text-sm">
              <div className="flex justify-between"><span>Zwischensumme</span><span className="font-mono">{formatCurrency(subtotal)}</span></div>
              {travelCost > 0 && (
                <div className="flex justify-between"><span>Anfahrt ({getZoneLabel(selectedCustomer?.zone ?? 1)})</span><span className="font-mono">{formatCurrency(travelCost)}</span></div>
              )}
              {discount > 0 && (
                <div className="flex justify-between text-green-600"><span>Schutzbrief-Rabatt (10%)</span><span className="font-mono">-{formatCurrency(discount)}</span></div>
              )}
              <div className="flex justify-between font-bold text-base border-t pt-1">
                <span>Gesamt</span><span className="font-mono">{formatCurrency(total)}</span>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Payment & Notes */}
      {(cart ?? []).length > 0 && (
        <>
          <Card className="shadow-sm">
            <CardContent className="p-3">
              <Label className="text-sm">Zahlungsart</Label>
              <div className="grid grid-cols-2 gap-2 mt-2">
                <Button
                  variant={paymentMethod === 'BAR' ? 'default' : 'outline'}
                  onClick={() => setPaymentMethod('BAR')}
                  className="gap-2"
                >
                  <Banknote className="w-4 h-4" /> Bar
                </Button>
                <Button
                  variant={paymentMethod === 'KARTE' ? 'default' : 'outline'}
                  onClick={() => setPaymentMethod('KARTE')}
                  className="gap-2"
                >
                  <CreditCard className="w-4 h-4" /> Karte
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-sm">
            <CardContent className="p-3">
              <Label className="text-sm">Notizen zur Rechnung</Label>
              <textarea
                value={notes}
                onChange={(e: any) => setNotes(e?.target?.value ?? '')}
                className="w-full mt-1 p-2 text-sm border border-input rounded-md bg-background min-h-[60px] resize-y"
                placeholder="Optionale Notizen..."
              />
            </CardContent>
          </Card>

          <Button
            onClick={handleSubmit}
            disabled={submitting || !selectedCustomer}
            className="w-full h-14 text-base gap-2"
          >
            <ShoppingCart className="w-5 h-5" />
            {submitting ? 'Wird erstellt...' : `Rechnung erstellen (${formatCurrency(total)})`}
          </Button>
        </>
      )}
    </div>
  );
}
