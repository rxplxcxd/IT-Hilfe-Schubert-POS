'use client';

import { useState, useEffect, useCallback } from 'react';
import { Plus, Pencil, Trash2, Package, Clock, Shield, X, Save, ChevronDown, ChevronUp, GripVertical } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { formatCurrency } from '@/lib/utils';

interface Product {
  id: number;
  name: string;
  description: string;
  category: string;
  price: number;
  unit: string;
  active: boolean;
  sortOrder: number;
}

const CATEGORIES = [
  { value: 'FIXED', label: 'Festpreis-Paket', icon: Package, color: 'text-blue-600 bg-blue-50' },
  { value: 'HOURLY', label: 'Individuelle Hilfe', icon: Clock, color: 'text-amber-600 bg-amber-50' },
  { value: 'SUBSCRIPTION', label: 'Abonnement', icon: Shield, color: 'text-green-600 bg-green-50' },
];

const UNIT_OPTIONS: Record<string, string[]> = {
  FIXED: ['Pauschal', 'Stück', 'Einmalig'],
  HOURLY: ['15 Min', '30 Min', '1 Stunde', 'pro Stunde'],
  SUBSCRIPTION: ['Monat', 'Quartal', 'Jahr'],
};

const emptyProduct = {
  name: '',
  description: '',
  category: 'FIXED',
  price: '',
  unit: 'Pauschal',
};

export function ProductsView() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [form, setForm] = useState<any>({ ...emptyProduct });
  const [saving, setSaving] = useState(false);
  const [expandedCat, setExpandedCat] = useState<string | null>('FIXED');

  const fetchProducts = useCallback(async () => {
    try {
      const res = await fetch('/api/products');
      setProducts(await res.json() ?? []);
    } catch {
      toast.error('Produkte konnten nicht geladen werden');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchProducts(); }, [fetchProducts]);

  const startEdit = (product: Product) => {
    setEditId(product.id);
    setForm({
      name: product.name,
      description: product.description,
      category: product.category,
      price: product.price.toString(),
      unit: product.unit,
    });
    setEditing(true);
  };

  const startNew = () => {
    setEditId(null);
    setForm({ ...emptyProduct });
    setEditing(true);
  };

  const handleSave = async () => {
    if (!form.name || !form.price) {
      toast.error('Name und Preis sind Pflichtfelder');
      return;
    }
    setSaving(true);
    try {
      const url = editId ? `/api/products/${editId}` : '/api/products';
      const method = editId ? 'PUT' : 'POST';
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.error || 'Serverfehler');
      }
      toast.success(editId ? 'Produkt aktualisiert' : 'Produkt erstellt');
      setEditing(false);
      setEditId(null);
      fetchProducts();
    } catch (e: any) {
      toast.error(`Fehler beim Speichern: ${e?.message || 'Unbekannt'}`);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Produkt wirklich löschen?')) return;
    try {
      const res = await fetch(`/api/products/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error();
      toast.success('Produkt gelöscht');
      fetchProducts();
    } catch {
      toast.error('Fehler beim Löschen');
    }
  };

  const getCategoryInfo = (cat: string) => CATEGORIES.find((c) => c.value === cat) || CATEGORIES[0];

  if (loading) {
    return <div className="flex justify-center py-8"><div className="animate-spin w-6 h-6 border-2 border-primary border-t-transparent rounded-full" /></div>;
  }

  // Form view
  if (editing) {
    return (
      <div className="p-4 space-y-4 pb-8">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" onClick={() => setEditing(false)}>
            <X className="w-5 h-5" />
          </Button>
          <h2 className="font-display font-semibold text-lg">{editId ? 'Produkt bearbeiten' : 'Neues Produkt'}</h2>
        </div>
        <Card className="shadow-sm">
          <CardContent className="p-4 space-y-4">
            <div>
              <Label>Produktname *</Label>
              <Input value={form.name} onChange={(e: any) => setForm({ ...form, name: e.target.value })} placeholder="z.B. Gerät startklar!" />
            </div>
            <div>
              <Label>Beschreibung</Label>
              <textarea
                value={form.description}
                onChange={(e: any) => setForm({ ...form, description: e.target.value })}
                className="w-full mt-1 p-2 text-sm border border-input rounded-md bg-background min-h-[80px] resize-y"
                placeholder="Was beinhaltet dieses Produkt/diese Dienstleistung?"
              />
            </div>
            <div>
              <Label>Kategorie</Label>
              <div className="grid grid-cols-3 gap-2 mt-1">
                {CATEGORIES.map((cat) => {
                  const Icon = cat.icon;
                  return (
                    <button
                      key={cat.value}
                      type="button"
                      onClick={() => {
                        const newUnit = UNIT_OPTIONS[cat.value]?.[0] || '';
                        setForm({ ...form, category: cat.value, unit: newUnit });
                      }}
                      className={`flex flex-col items-center gap-1 p-3 rounded-lg border-2 transition-colors text-xs ${
                        form.category === cat.value
                          ? 'border-primary bg-primary/5'
                          : 'border-border hover:border-muted-foreground/30'
                      }`}
                    >
                      <Icon className="w-5 h-5" />
                      <span className="font-medium text-center leading-tight">{cat.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Preis (€) *</Label>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  value={form.price}
                  onChange={(e: any) => setForm({ ...form, price: e.target.value })}
                  placeholder="0.00"
                />
              </div>
              <div>
                <Label>Einheit</Label>
                <select
                  value={form.unit}
                  onChange={(e: any) => setForm({ ...form, unit: e.target.value })}
                  className="w-full mt-1 h-10 px-3 text-sm border border-input rounded-md bg-background"
                >
                  {(UNIT_OPTIONS[form.category] || []).map((u: string) => (
                    <option key={u} value={u}>{u}</option>
                  ))}
                  <option value="custom">Eigene...</option>
                </select>
                {form.unit === 'custom' && (
                  <Input
                    className="mt-2"
                    value=""
                    onChange={(e: any) => setForm({ ...form, unit: e.target.value })}
                    placeholder="Eigene Einheit"
                  />
                )}
              </div>
            </div>
            <Button onClick={handleSave} disabled={saving} className="w-full gap-2">
              <Save className="w-4 h-4" />
              {saving ? 'Wird gespeichert...' : editId ? 'Aktualisieren' : 'Erstellen'}
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Product list grouped by category
  return (
    <div className="p-4 space-y-4 pb-8">
      <div className="flex items-center justify-between">
        <h2 className="font-display font-semibold text-lg">Produkte</h2>
        <Button size="sm" onClick={startNew} className="gap-1">
          <Plus className="w-4 h-4" />
          Neu
        </Button>
      </div>

      {CATEGORIES.map((cat) => {
        const Icon = cat.icon;
        const catProducts = products.filter((p) => p.category === cat.value);
        const isExpanded = expandedCat === cat.value;
        return (
          <div key={cat.value}>
            <button
              onClick={() => setExpandedCat(isExpanded ? null : cat.value)}
              className="w-full flex items-center justify-between p-3 bg-muted/50 rounded-lg"
            >
              <div className="flex items-center gap-2">
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${cat.color}`}>
                  <Icon className="w-4 h-4" />
                </div>
                <div className="text-left">
                  <p className="text-sm font-medium">{cat.label}</p>
                  <p className="text-xs text-muted-foreground">{catProducts.length} Produkt{catProducts.length !== 1 ? 'e' : ''}</p>
                </div>
              </div>
              {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>

            {isExpanded && (
              <div className="space-y-2 mt-2">
                {catProducts.length === 0 ? (
                  <p className="text-xs text-muted-foreground text-center py-4">Keine Produkte in dieser Kategorie</p>
                ) : (
                  catProducts.map((product) => (
                    <Card key={product.id} className="shadow-sm">
                      <CardContent className="p-3">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium">{product.name}</p>
                            {product.description && (
                              <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{product.description}</p>
                            )}
                            <div className="flex items-center gap-2 mt-1">
                              <span className="text-sm font-semibold text-primary">{formatCurrency(product.price)}</span>
                              {product.unit && (
                                <span className="text-xs text-muted-foreground">/ {product.unit}</span>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center gap-1 shrink-0">
                            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => startEdit(product)}>
                              <Pencil className="w-3.5 h-3.5" />
                            </Button>
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => handleDelete(product.id)}>
                              <Trash2 className="w-3.5 h-3.5" />
                            </Button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
