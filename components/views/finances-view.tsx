'use client';

import { useState, useEffect, useCallback } from 'react';
import { TrendingUp, TrendingDown, Plus, Trash2, Pencil, X, Save, Download, ArrowUpCircle, ArrowDownCircle } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { formatCurrency, formatDate } from '@/lib/utils';

interface Expense {
  id: number; type: string; category: string; description: string; amount: number; date: string; reference: string;
}

const CATEGORIES_AUSGABE = ['Benzin/Fahrtkosten', 'Hardware', 'Software/Lizenzen', 'Büromaterial', 'Telefon/Internet', 'Versicherung', 'Werbung', 'Sonstiges'];
const CATEGORIES_EINNAHME = ['Nebeneinkünfte', 'Erstattung', 'Sonstiges'];

export function FinancesView() {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [form, setForm] = useState({ type: 'AUSGABE', category: '', description: '', amount: '', date: new Date().toISOString().split('T')[0], reference: '' });
  const [saving, setSaving] = useState(false);
  const [selectedMonth, setSelectedMonth] = useState(() => { const n = new Date(); return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, '0')}`; });
  const [filter, setFilter] = useState('ALL');

  const fetchExpenses = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (selectedMonth) params.set('month', selectedMonth);
      if (filter !== 'ALL') params.set('type', filter);
      const res = await fetch(`/api/expenses?${params}`);
      setExpenses(await res.json() ?? []);
    } catch { toast.error('Fehler beim Laden'); } finally { setLoading(false); }
  }, [selectedMonth, filter]);

  useEffect(() => { fetchExpenses(); }, [fetchExpenses]);

  const handleSave = async () => {
    if (!form.amount || !form.description) { toast.error('Betrag und Beschreibung sind Pflicht'); return; }
    setSaving(true);
    try {
      const url = editId ? `/api/expenses/${editId}` : '/api/expenses';
      const method = editId ? 'PUT' : 'POST';
      const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) });
      if (!res.ok) throw new Error();
      toast.success(editId ? 'Aktualisiert' : 'Gespeichert');
      setEditing(false); setEditId(null);
      fetchExpenses();
    } catch { toast.error('Fehler'); } finally { setSaving(false); }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Eintrag löschen?')) return;
    try { await fetch(`/api/expenses/${id}`, { method: 'DELETE' }); toast.success('Gelöscht'); fetchExpenses(); } catch { toast.error('Fehler'); }
  };

  const startEdit = (exp: Expense) => {
    setEditId(exp.id);
    setForm({ type: exp.type, category: exp.category, description: exp.description, amount: exp.amount.toString(), date: exp.date.split('T')[0], reference: exp.reference });
    setEditing(true);
  };

  const totalEinnahmen = expenses.filter((e) => e.type === 'EINNAHME').reduce((s, e) => s + e.amount, 0);
  const totalAusgaben = expenses.filter((e) => e.type === 'AUSGABE').reduce((s, e) => s + e.amount, 0);

  if (editing) {
    const cats = form.type === 'AUSGABE' ? CATEGORIES_AUSGABE : CATEGORIES_EINNAHME;
    return (
      <div className="p-4 space-y-4 pb-8">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" onClick={() => { setEditing(false); setEditId(null); }}><X className="w-5 h-5" /></Button>
          <h2 className="font-display font-semibold text-lg">{editId ? 'Bearbeiten' : 'Neuer Eintrag'}</h2>
        </div>
        <Card className="shadow-sm"><CardContent className="p-4 space-y-3">
          <div className="grid grid-cols-2 gap-2">
            {['AUSGABE', 'EINNAHME'].map((t) => (
              <button key={t} onClick={() => setForm({ ...form, type: t, category: '' })}
                className={`p-3 rounded-lg border-2 text-sm font-medium flex items-center justify-center gap-2 ${form.type === t ? 'border-primary bg-primary/5' : 'border-border'}`}>
                {t === 'AUSGABE' ? <ArrowDownCircle className="w-4 h-4 text-red-500" /> : <ArrowUpCircle className="w-4 h-4 text-green-500" />}
                {t === 'AUSGABE' ? 'Ausgabe' : 'Einnahme'}
              </button>
            ))}
          </div>
          <div><Label>Kategorie</Label>
            <select value={form.category} onChange={(e: any) => setForm({ ...form, category: e.target.value })} className="w-full mt-1 h-10 px-3 text-sm border border-input rounded-md bg-background">
              <option value="">Wählen...</option>
              {cats.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div><Label>Beschreibung *</Label><Input value={form.description} onChange={(e: any) => setForm({ ...form, description: e.target.value })} placeholder="z.B. Tankfüllung Dresden" /></div>
          <div className="grid grid-cols-2 gap-2">
            <div><Label>Betrag (€) *</Label><Input type="number" step="0.01" value={form.amount} onChange={(e: any) => setForm({ ...form, amount: e.target.value })} /></div>
            <div><Label>Datum</Label><Input type="date" value={form.date} onChange={(e: any) => setForm({ ...form, date: e.target.value })} /></div>
          </div>
          <div><Label>Referenz</Label><Input value={form.reference} onChange={(e: any) => setForm({ ...form, reference: e.target.value })} placeholder="z.B. Rechnungsnr." /></div>
          <Button onClick={handleSave} disabled={saving} className="w-full gap-2"><Save className="w-4 h-4" />{saving ? 'Speichern...' : 'Speichern'}</Button>
        </CardContent></Card>
      </div>
    );
  }

  return (
    <div className="p-4 space-y-4 pb-8">
      <div className="flex items-center justify-between">
        <h2 className="font-display font-semibold text-lg">Finanzen</h2>
        <Button size="sm" onClick={() => { setEditId(null); setForm({ type: 'AUSGABE', category: '', description: '', amount: '', date: new Date().toISOString().split('T')[0], reference: '' }); setEditing(true); }} className="gap-1"><Plus className="w-4 h-4" /> Neu</Button>
      </div>

      {/* Month picker */}
      <Input type="month" value={selectedMonth} onChange={(e: any) => setSelectedMonth(e.target.value)} className="w-full" />

      {/* Summary */}
      <div className="grid grid-cols-3 gap-2">
        <Card className="shadow-sm"><CardContent className="p-3 text-center">
          <ArrowUpCircle className="w-5 h-5 text-green-500 mx-auto" />
          <p className="text-sm font-bold text-green-600 mt-1">{formatCurrency(totalEinnahmen)}</p>
          <p className="text-[10px] text-muted-foreground">Einnahmen</p>
        </CardContent></Card>
        <Card className="shadow-sm"><CardContent className="p-3 text-center">
          <ArrowDownCircle className="w-5 h-5 text-red-500 mx-auto" />
          <p className="text-sm font-bold text-red-600 mt-1">{formatCurrency(totalAusgaben)}</p>
          <p className="text-[10px] text-muted-foreground">Ausgaben</p>
        </CardContent></Card>
        <Card className="shadow-sm"><CardContent className="p-3 text-center">
          <TrendingUp className="w-5 h-5 text-primary mx-auto" />
          <p className={`text-sm font-bold mt-1 ${totalEinnahmen - totalAusgaben >= 0 ? 'text-green-600' : 'text-red-600'}`}>{formatCurrency(totalEinnahmen - totalAusgaben)}</p>
          <p className="text-[10px] text-muted-foreground">Saldo</p>
        </CardContent></Card>
      </div>

      {/* Filter */}
      <div className="flex gap-1">
        {[{ v: 'ALL', l: 'Alle' }, { v: 'AUSGABE', l: 'Ausgaben' }, { v: 'EINNAHME', l: 'Einnahmen' }].map((f) => (
          <button key={f.v} onClick={() => setFilter(f.v)} className={`flex-1 py-2 text-xs font-medium rounded-lg ${filter === f.v ? 'bg-primary text-white' : 'bg-muted text-muted-foreground'}`}>{f.l}</button>
        ))}
      </div>

      {/* List */}
      {loading ? (
        <div className="flex justify-center py-8"><div className="animate-spin w-6 h-6 border-2 border-primary border-t-transparent rounded-full" /></div>
      ) : expenses.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-4">Keine Einträge</p>
      ) : (
        <div className="space-y-2">
          {expenses.map((exp) => (
            <Card key={exp.id} className="shadow-sm">
              <CardContent className="p-3 flex items-center gap-3">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${exp.type === 'AUSGABE' ? 'bg-red-50 text-red-500' : 'bg-green-50 text-green-500'}`}>
                  {exp.type === 'AUSGABE' ? <ArrowDownCircle className="w-4 h-4" /> : <ArrowUpCircle className="w-4 h-4" />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{exp.description}</p>
                  <p className="text-xs text-muted-foreground">{exp.category && `${exp.category} · `}{formatDate(exp.date)}</p>
                </div>
                <div className="text-right shrink-0">
                  <p className={`text-sm font-semibold ${exp.type === 'AUSGABE' ? 'text-red-600' : 'text-green-600'}`}>
                    {exp.type === 'AUSGABE' ? '-' : '+'}{formatCurrency(exp.amount)}
                  </p>
                </div>
                <div className="flex flex-col gap-0.5">
                  <button onClick={() => startEdit(exp)} className="text-muted-foreground"><Pencil className="w-3.5 h-3.5" /></button>
                  <button onClick={() => handleDelete(exp.id)} className="text-destructive"><Trash2 className="w-3.5 h-3.5" /></button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
