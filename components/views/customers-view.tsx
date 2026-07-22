'use client';

import { useState, useEffect, useCallback } from 'react';
import { Search, Plus, Phone, Mail, MapPin, ChevronRight, ArrowLeft, Save, UserPlus, StickyNote, Filter, ShieldCheck } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { getZoneLabel, employeeCode } from '@/lib/utils';

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
  ownerId?: number | null;
  ownerName?: string;
  ownerNo?: number | null;
  ownerRole?: string;
  ownedByMe?: boolean;
}

interface TeamMember { id: number; name: string; email: string; role: string; employeeNo: number | null; }

export function CustomersView({ isAdmin = false, editCustomerId, onEditCustomer, onViewCustomerDetail }: {
  isAdmin?: boolean;
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
  // Admin-Schnellfilter nach zustaendigem Mitarbeiter.
  const [ownerFilter, setOwnerFilter] = useState<string>('ALL'); // ALL | MINE | <userId>
  const [showFilter, setShowFilter] = useState(false);
  const [team, setTeam] = useState<TeamMember[]>([]);

  const fetchCustomers = useCallback(async () => {
    try {
      const res = await fetch('/api/customers');
      const json = await res.json();
      setCustomers(json ?? []);
    } catch (e: any) { console.error(e); } finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchCustomers(); }, [fetchCustomers]);

  // Team-Liste nur fuer Admin laden (fuer den Filter).
  useEffect(() => {
    if (!isAdmin) return;
    (async () => {
      try {
        const res = await fetch('/api/users');
        if (!res.ok) return;
        const json = await res.json();
        setTeam(Array.isArray(json) ? json.filter((u: any) => u?.status === 'APPROVED') : []);
      } catch { /* still */ }
    })();
  }, [isAdmin]);

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
    const matchesSearch = (
      (c?.firstName?.toLowerCase() ?? '').includes(q) ||
      (c?.lastName?.toLowerCase() ?? '').includes(q) ||
      (c?.phone ?? '').includes(q) ||
      (c?.city?.toLowerCase() ?? '').includes(q)
    );
    if (!matchesSearch) return false;
    // Admin-Zuordnungsfilter
    if (isAdmin && ownerFilter !== 'ALL') {
      if (ownerFilter === 'MINE') return !!c?.ownedByMe;
      return String(c?.ownerId ?? '') === ownerFilter;
    }
    return true;
  });

  const ownerFilterLabel = (() => {
    if (ownerFilter === 'ALL') return 'Alle';
    if (ownerFilter === 'MINE') return 'Nur meine';
    const m = team.find((t) => String(t.id) === ownerFilter);
    return m ? (m.role === 'ADMIN' ? 'Admin' : employeeCode(m.employeeNo)) : 'Filter';
  })();

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
        {isAdmin && (
          <div className="relative shrink-0">
            <Button variant={ownerFilter === 'ALL' ? 'outline' : 'default'} size="icon" onClick={() => setShowFilter((v) => !v)} title="Nach Mitarbeiter filtern">
              <Filter className="w-4 h-4" />
            </Button>
            {showFilter && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setShowFilter(false)} />
                <div className="absolute right-0 top-11 z-50 w-56 bg-card text-foreground rounded-xl shadow-xl border border-border p-1 max-h-[60vh] overflow-y-auto">
                  <FilterOption active={ownerFilter === 'ALL'} onClick={() => { setOwnerFilter('ALL'); setShowFilter(false); }}>Alle anzeigen</FilterOption>
                  <FilterOption active={ownerFilter === 'MINE'} onClick={() => { setOwnerFilter('MINE'); setShowFilter(false); }}>Nur meine (Admin)</FilterOption>
                  {team.length > 0 && <div className="my-1 border-t border-border" />}
                  {team.map((m) => (
                    <FilterOption key={m.id} active={ownerFilter === String(m.id)} onClick={() => { setOwnerFilter(String(m.id)); setShowFilter(false); }}>
                      <span className="flex items-center gap-2">
                        <span className="font-mono text-[11px] text-muted-foreground">{m.role === 'ADMIN' ? 'Admin' : employeeCode(m.employeeNo)}</span>
                        <span className="truncate">{m.name || m.email}</span>
                      </span>
                    </FilterOption>
                  ))}
                </div>
              </>
            )}
          </div>
        )}
        <Button size="icon" onClick={() => { setFormData({ firstName: '', lastName: '', street: '', houseNr: '', zip: '', city: '', phone: '', email: '', zone: 1, notes: '' }); setShowForm(true); }}>
          <Plus className="w-5 h-5" />
        </Button>
      </div>

      {isAdmin && ownerFilter !== 'ALL' && (
        <div className="flex items-center gap-2 text-xs">
          <span className="inline-flex items-center gap-1 bg-primary/10 text-primary px-2 py-1 rounded-full font-medium">
            <Filter className="w-3 h-3" /> {ownerFilterLabel}
            <button onClick={() => setOwnerFilter('ALL')} className="ml-0.5 hover:opacity-70">×</button>
          </span>
          <span className="text-muted-foreground">{filtered.length} Kunde(n)</span>
        </div>
      )}

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
                onClick={() => { if (onViewCustomerDetail && c?.id) onViewCustomerDetail(c.id); }}
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
                  {isAdmin && (c?.ownerRole || c?.ownerNo != null) && (
                    <span className="shrink-0 inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300" title={c?.ownerName || ''}>
                      {c?.ownerRole === 'ADMIN' ? <ShieldCheck className="w-3 h-3" /> : null}
                      {c?.ownerRole === 'ADMIN' ? 'Admin' : employeeCode(c?.ownerNo)}
                    </span>
                  )}
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

function FilterOption({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center px-3 py-2 rounded-lg text-sm text-left transition-colors ${active ? 'bg-primary/10 text-primary font-medium' : 'text-foreground hover:bg-muted'}`}
    >
      {children}
    </button>
  );
}
