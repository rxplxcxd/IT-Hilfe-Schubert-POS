'use client';

import { useState, useEffect, useCallback } from 'react';
import { Search, Plus, Phone, Mail, MapPin, ChevronRight, ArrowLeft, Save, Trash2, UserPlus, StickyNote, Eye } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { getZoneLabel } from '@/lib/utils';

interface Customer {
  id: number;
  firstName: string;
  lastName: string;
  street: string;
  houseNr: string;
  zip: string;
  city: string;
  phone: string;
  email: string;
  zone: number;
  notes: string;
  subscriptions?: any[];
}

export function CustomersView({ editCustomerId, onEditCustomer, onViewCustomerDetail }: {
  editCustomerId: number | null;
  onEditCustomer: (id: number | null) => void;
  onViewCustomerDetail?: (id: number) => void;
}) {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [search, setSearch] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState<Partial<Customer>>({
    firstName: '', lastName: '', street: '', houseNr: '', zip: '', city: '',
    phone: '', email: '', zone: 1, notes: '',
  });
  const [loading, setLoading] = useState(true);

  const fetchCustomers = useCallback(async () => {
    try {
      const res = await fetch('/api/customers');
      const json = await res.json();
      setCustomers(json ?? []);
    } catch (e: any) { console.error(e); } finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchCustomers(); }, [fetchCustomers]);

  useEffect(() => {
    if (editCustomerId) {
      const c = customers.find((c: Customer) => c?.id === editCustomerId);
      if (c) {
        setFormData(c);
        setShowForm(true);
      }
    }
  }, [editCustomerId, customers]);

  const filtered = (customers ?? []).filter((c: Customer) => {
    const q = search?.toLowerCase() ?? '';
    return (
      (c?.firstName?.toLowerCase() ?? '').includes(q) ||
      (c?.lastName?.toLowerCase() ?? '').includes(q) ||
      (c?.phone ?? '').includes(q) ||
      (c?.city?.toLowerCase() ?? '').includes(q)
    );
  });

  const handleSave = async () => {
    if (!(formData?.firstName ?? '').trim() || !(formData?.lastName ?? '').trim() || !(formData?.phone ?? '').trim()) {
      toast.error('Vorname, Nachname und Telefon sind Pflichtfelder');
      return;
    }
    try {
      const isEdit = !!(formData?.id);
      const res = await fetch(isEdit ? `/api/customers/${formData.id}` : '/api/customers', {
        method: isEdit ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });
      if (!res.ok) throw new Error('Fehler beim Speichern');
      toast.success(isEdit ? 'Kunde aktualisiert' : 'Kunde angelegt');
      setShowForm(false);
      setFormData({ firstName: '', lastName: '', street: '', houseNr: '', zip: '', city: '', phone: '', email: '', zone: 1, notes: '' });
      onEditCustomer(null);
      fetchCustomers();
    } catch (e: any) {
      toast.error(e?.message ?? 'Fehler');
    }
  };

  const handleDelete = async () => {
    if (!formData?.id) return;
    if (!confirm('Kunde wirklich löschen?')) return;
    try {
      await fetch(`/api/customers/${formData.id}`, { method: 'DELETE' });
      toast.success('Kunde gelöscht');
      setShowForm(false);
      setFormData({ firstName: '', lastName: '', street: '', houseNr: '', zip: '', city: '', phone: '', email: '', zone: 1, notes: '' });
      onEditCustomer(null);
      fetchCustomers();
    } catch (e: any) {
      toast.error('Fehler beim Löschen');
    }
  };

  if (showForm) {
    return (
      <div className="p-4 space-y-4">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" onClick={() => { setShowForm(false); onEditCustomer(null); }}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <h2 className="font-display font-semibold text-lg">
            {formData?.id ? 'Kunde bearbeiten' : 'Neuer Kunde'}
          </h2>
        </div>

        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Vorname *</Label><Input value={formData?.firstName ?? ''} onChange={(e: any) => setFormData({...(formData ?? {}), firstName: e?.target?.value ?? ''})} placeholder="Vorname" /></div>
            <div><Label>Nachname *</Label><Input value={formData?.lastName ?? ''} onChange={(e: any) => setFormData({...(formData ?? {}), lastName: e?.target?.value ?? ''})} placeholder="Nachname" /></div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-2"><Label>Straße</Label><Input value={formData?.street ?? ''} onChange={(e: any) => setFormData({...(formData ?? {}), street: e?.target?.value ?? ''})} placeholder="Straße" /></div>
            <div><Label>Nr.</Label><Input value={formData?.houseNr ?? ''} onChange={(e: any) => setFormData({...(formData ?? {}), houseNr: e?.target?.value ?? ''})} placeholder="Nr." /></div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div><Label>PLZ</Label><Input value={formData?.zip ?? ''} onChange={(e: any) => setFormData({...(formData ?? {}), zip: e?.target?.value ?? ''})} placeholder="PLZ" /></div>
            <div className="col-span-2"><Label>Ort</Label><Input value={formData?.city ?? ''} onChange={(e: any) => setFormData({...(formData ?? {}), city: e?.target?.value ?? ''})} placeholder="Ort" /></div>
          </div>
          <div><Label>Telefon *</Label><Input value={formData?.phone ?? ''} onChange={(e: any) => setFormData({...(formData ?? {}), phone: e?.target?.value ?? ''})} placeholder="Telefon" type="tel" /></div>
          <div><Label>E-Mail</Label><Input value={formData?.email ?? ''} onChange={(e: any) => setFormData({...(formData ?? {}), email: e?.target?.value ?? ''})} placeholder="E-Mail (optional)" type="email" /></div>
          <div>
            <Label>Anfahrts-Zone</Label>
            <div className="grid grid-cols-4 gap-2 mt-1">
              {[1,2,3,4].map((z: number) => (
                <Button
                  key={z}
                  variant={(formData?.zone ?? 1) === z ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setFormData({...(formData ?? {}), zone: z})}
                  className="text-xs"
                >
                  Zone {z}
                </Button>
              ))}
            </div>
            <p className="text-xs text-muted-foreground mt-1">{getZoneLabel(formData?.zone ?? 1)}</p>
          </div>
          <div>
            <Label className="flex items-center gap-1"><StickyNote className="w-3 h-3" /> Notizen / Historie</Label>
            <textarea
              value={formData?.notes ?? ''}
              onChange={(e: any) => setFormData({...(formData ?? {}), notes: e?.target?.value ?? ''})}
              className="w-full mt-1 p-2 text-sm border border-input rounded-md bg-background min-h-[80px] resize-y"
              placeholder="Notizen zum Kunden..."
            />
          </div>
        </div>

        <div className="flex gap-2">
          <Button onClick={handleSave} className="flex-1 gap-2"><Save className="w-4 h-4" /> Speichern</Button>
          {formData?.id && onViewCustomerDetail && (
            <Button variant="outline" size="icon" onClick={() => onViewCustomerDetail(formData.id!)} title="Kundenübersicht">
              <Eye className="w-4 h-4" />
            </Button>
          )}
          {formData?.id && (
            <Button variant="destructive" size="icon" onClick={handleDelete}><Trash2 className="w-4 h-4" /></Button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 space-y-3">
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e: any) => setSearch(e?.target?.value ?? '')}
            placeholder="Kunden suchen..."
            className="pl-9"
          />
        </div>
        <Button size="icon" onClick={() => { setFormData({ firstName: '', lastName: '', street: '', houseNr: '', zip: '', city: '', phone: '', email: '', zone: 1, notes: '' }); setShowForm(true); }}>
          <Plus className="w-5 h-5" />
        </Button>
      </div>

      {loading ? (
        <div className="flex justify-center py-8"><div className="animate-spin w-6 h-6 border-2 border-primary border-t-transparent rounded-full" /></div>
      ) : filtered.length === 0 ? (
        <Card className="shadow-sm">
          <CardContent className="p-6 text-center">
            <UserPlus className="w-10 h-10 mx-auto text-muted-foreground mb-2" />
            <p className="text-muted-foreground text-sm">Keine Kunden gefunden</p>
            <Button className="mt-3" size="sm" onClick={() => { setFormData({ firstName: '', lastName: '', street: '', houseNr: '', zip: '', city: '', phone: '', email: '', zone: 1, notes: '' }); setShowForm(true); }}>
              Ersten Kunden anlegen
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {filtered.map((c: Customer) => {
            const hasActiveSub = (c?.subscriptions ?? []).some((s: any) => s?.active);
            return (
              <Card
                key={c?.id}
                className="shadow-sm cursor-pointer hover:shadow-md transition-shadow"
                onClick={() => { setFormData(c); setShowForm(true); onEditCustomer(c?.id); }}
              >
                <CardContent className="p-3 flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-sm shrink-0">
                    {(c?.firstName?.[0] ?? '')}{(c?.lastName?.[0] ?? '')}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <p className="font-medium text-sm truncate">{c?.firstName ?? ''} {c?.lastName ?? ''}</p>
                      {hasActiveSub && (
                        <span className="text-[10px] bg-green-100 text-green-700 px-1.5 py-0.5 rounded-full font-medium shrink-0">
                          Schutzbrief
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <span className="flex items-center gap-0.5"><Phone className="w-3 h-3" /> {c?.phone ?? '-'}</span>
                      {(c?.city ?? '').trim() && (
                        <span className="flex items-center gap-0.5"><MapPin className="w-3 h-3" /> {c?.city}</span>
                      )}
                    </div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
