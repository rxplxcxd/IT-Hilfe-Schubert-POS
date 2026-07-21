'use client';

import { useState, useEffect, useCallback } from 'react';
import { CalendarDays, Clock, Plus, Trash2, User, Phone, CheckCircle2, X, AlertCircle, ExternalLink, Mail, Search } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { formatDate, formatDateTime } from '@/lib/utils';

interface TimeSlot {
  id: number;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
}

interface Appointment {
  id: number;
  date: string;
  startTime: string;
  endTime: string;
  customerName: string;
  customerPhone: string;
  customerEmail: string;
  address: string;
  description: string;
  status: string;
  notes: string;
  createdAt: string;
}

const DAYS = ['Sonntag', 'Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag'];
const WORK_DAYS = [1, 2, 3, 4, 5]; // Mo-Fr

type SubTab = 'termine' | 'zeitfenster';

export function AppointmentsView() {
  const [subTab, setSubTab] = useState<SubTab>('termine');
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [slots, setSlots] = useState<TimeSlot[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('OFFEN');
  const [appointmentSearch, setAppointmentSearch] = useState('');
  const [viewApp, setViewApp] = useState<Appointment | null>(null);
  // Zeitfenster-Formular
  const [newDay, setNewDay] = useState(1);
  const [newStart, setNewStart] = useState('09:00');
  const [newEnd, setNewEnd] = useState('10:00');

  const fetchAppointments = useCallback(async () => {
    try {
      const url = filter !== 'ALL' ? `/api/appointments?status=${filter}` : '/api/appointments';
      const res = await fetch(url);
      setAppointments(await res.json() ?? []);
    } catch (e) { console.error(e); } finally { setLoading(false); }
  }, [filter]);

  const fetchSlots = useCallback(async () => {
    try {
      const res = await fetch('/api/timeslots');
      setSlots(await res.json() ?? []);
    } catch (e) { console.error(e); }
  }, []);

  useEffect(() => {
    fetchAppointments();
    fetchSlots();
  }, [fetchAppointments, fetchSlots]);

  const updateStatus = async (id: number, status: string) => {
    try {
      await fetch(`/api/appointments/${id}`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });
      toast.success(`Status: ${status}`);
      fetchAppointments();
      if (viewApp?.id === id) setViewApp({ ...viewApp!, status });
    } catch { toast.error('Fehler'); }
  };

  const deleteAppointment = async (id: number) => {
    if (!confirm('Termin wirklich löschen?')) return;
    await fetch(`/api/appointments/${id}`, { method: 'DELETE' });
    toast.success('Termin gelöscht');
    fetchAppointments();
    if (viewApp?.id === id) setViewApp(null);
  };

  const addSlot = async () => {
    try {
      await fetch('/api/timeslots', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dayOfWeek: newDay, startTime: newStart, endTime: newEnd }),
      });
      toast.success('Zeitfenster hinzugefügt');
      fetchSlots();
    } catch { toast.error('Fehler'); }
  };

  const deleteSlot = async (id: number) => {
    await fetch(`/api/timeslots/${id}`, { method: 'DELETE' });
    toast.success('Zeitfenster entfernt');
    fetchSlots();
  };

  const statusColor = (s: string) => {
    switch (s) {
      case 'OFFEN': return 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400';
      case 'BESTAETIGT': return 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400';
      case 'ERLEDIGT': return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400';
      case 'ABGESAGT': return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400';
      default: return 'bg-muted text-muted-foreground';
    }
  };
  const statusLabel = (s: string) => {
    switch (s) {
      case 'OFFEN': return 'Offen';
      case 'BESTAETIGT': return 'Bestätigt';
      case 'ERLEDIGT': return 'Erledigt';
      case 'ABGESAGT': return 'Abgesagt';
      default: return s;
    }
  };

  // Termin-Detail
  if (viewApp) {
    return (
      <div className="p-4 space-y-4">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" onClick={() => setViewApp(null)}><X className="w-5 h-5" /></Button>
          <h2 className="font-display font-semibold text-lg flex-1">Termindetails</h2>
          <span className={`text-xs px-2 py-1 rounded-full font-medium ${statusColor(viewApp.status)}`}>{statusLabel(viewApp.status)}</span>
        </div>

        <Card className="shadow-sm">
          <CardContent className="p-4 space-y-3">
            <div className="flex items-center gap-2 text-sm">
              <CalendarDays className="w-4 h-4 text-primary" />
              <span className="font-medium">{new Date(viewApp.date).toLocaleDateString('de-DE', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <Clock className="w-4 h-4 text-primary" />
              <span>{viewApp.startTime} – {viewApp.endTime} Uhr</span>
            </div>
            <hr className="border-border" />
            <div className="flex items-center gap-2 text-sm">
              <User className="w-4 h-4 text-muted-foreground" />
              <span className="font-medium">{viewApp.customerName}</span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <Phone className="w-4 h-4 text-muted-foreground" />
              <a href={`tel:${viewApp.customerPhone}`} className="text-primary">{viewApp.customerPhone}</a>
            </div>
            {viewApp.customerEmail && (
              <div className="flex items-center gap-2 text-sm">
                <Mail className="w-4 h-4 text-muted-foreground" />
                <span>{viewApp.customerEmail}</span>
              </div>
            )}
            {viewApp.address && <p className="text-xs text-muted-foreground">📍 {viewApp.address}</p>}
            {viewApp.description && (
              <div className="bg-muted/50 rounded-lg p-3">
                <p className="text-xs font-medium text-muted-foreground mb-1">Anliegen:</p>
                <p className="text-sm">{viewApp.description}</p>
              </div>
            )}
            <p className="text-[10px] text-muted-foreground">Angefragt am {formatDateTime(viewApp.createdAt)}</p>
          </CardContent>
        </Card>

        <div className="grid grid-cols-2 gap-2">
          {viewApp.status === 'OFFEN' && (
            <Button onClick={() => updateStatus(viewApp.id, 'BESTAETIGT')} className="gap-1">
              <CheckCircle2 className="w-4 h-4" /> Bestätigen
            </Button>
          )}
          {(viewApp.status === 'OFFEN' || viewApp.status === 'BESTAETIGT') && (
            <Button variant="outline" onClick={() => updateStatus(viewApp.id, 'ERLEDIGT')} className="gap-1">
              <CheckCircle2 className="w-4 h-4" /> Erledigt
            </Button>
          )}
          {viewApp.status !== 'ABGESAGT' && viewApp.status !== 'ERLEDIGT' && (
            <Button variant="destructive" onClick={() => updateStatus(viewApp.id, 'ABGESAGT')} className="gap-1">
              <X className="w-4 h-4" /> Absagen
            </Button>
          )}
          <Button variant="ghost" size="sm" className="text-destructive gap-1" onClick={() => deleteAppointment(viewApp.id)}>
            <Trash2 className="w-3 h-3" /> Löschen
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Sub-Tabs */}
      <div className="flex border-b border-border bg-card/50 shrink-0">
        {[{ id: 'termine' as SubTab, label: 'Termine', icon: CalendarDays }, { id: 'zeitfenster' as SubTab, label: 'Zeitfenster', icon: Clock }].map(t => {
          const Icon = t.icon;
          return (
            <button key={t.id} onClick={() => setSubTab(t.id)}
              className={`flex-1 flex items-center justify-center gap-1.5 py-3 text-sm font-medium transition-colors border-b-2 ${
                subTab === t.id ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'
              }`}>
              <Icon className="w-4 h-4" /> {t.label}
            </button>
          );
        })}
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {/* TERMINE */}
        {subTab === 'termine' && (
          <>
            <div className="relative mb-2">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input className="pl-9" placeholder="Termin suchen (Name, Telefon)..." value={appointmentSearch} onChange={(e: any) => setAppointmentSearch(e.target.value)} />
            </div>
            <div className="flex gap-1 overflow-x-auto">
              {['OFFEN', 'BESTAETIGT', 'ERLEDIGT', 'ABGESAGT', 'ALL'].map(f => (
                <button key={f} onClick={() => setFilter(f)}
                  className={`text-xs px-2.5 py-1.5 rounded-full whitespace-nowrap transition-colors ${
                    filter === f ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'
                  }`}>
                  {f === 'ALL' ? 'Alle' : statusLabel(f)}
                </button>
              ))}
            </div>

            {loading ? (
              <div className="flex justify-center py-8"><div className="animate-spin w-6 h-6 border-2 border-primary border-t-transparent rounded-full" /></div>
            ) : (() => {
              const searchFiltered = appointments.filter((a) => {
                if (!appointmentSearch.trim()) return true;
                const q = appointmentSearch.toLowerCase();
                return `${a.customerName} ${a.customerPhone} ${a.customerEmail} ${a.description}`.toLowerCase().includes(q);
              });
              return searchFiltered.length === 0 ? (
              <Card className="shadow-sm"><CardContent className="p-6 text-center">
                <CalendarDays className="w-10 h-10 mx-auto text-muted-foreground mb-2" />
                <p className="text-muted-foreground text-sm">{appointments.length === 0 ? 'Keine Termine' : 'Keine Treffer'}</p>
              </CardContent></Card>
            ) : (
              searchFiltered.map(a => (
                <Card key={a.id} className="shadow-sm cursor-pointer hover:shadow-md transition-shadow" onClick={() => setViewApp(a)}>
                  <CardContent className="p-3 flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                      <CalendarDays className="w-5 h-5 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="font-medium text-sm truncate">{a.customerName}</p>
                        <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${statusColor(a.status)}`}>{statusLabel(a.status)}</span>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {new Date(a.date).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' })} • {a.startTime} Uhr
                      </p>
                      {a.description && <p className="text-[10px] text-muted-foreground truncate mt-0.5">{a.description}</p>}
                    </div>
                  </CardContent>
                </Card>
              ))
            );
            })()}

            {/* Link zur öffentlichen Buchungsseite */}
            <Card className="shadow-sm border-dashed">
              <CardContent className="p-3">
                <p className="text-xs text-muted-foreground mb-2">Buchungsseite für Kunden:</p>
                <Button variant="outline" size="sm" className="gap-1 w-full" onClick={() => {
                  const url = `${window.location.origin}/termin`;
                  navigator.clipboard?.writeText(url);
                  toast.success('Link kopiert!');
                }}>
                  <ExternalLink className="w-3 h-3" /> Link kopieren
                </Button>
              </CardContent>
            </Card>
          </>
        )}

        {/* ZEITFENSTER VERWALTEN */}
        {subTab === 'zeitfenster' && (
          <>
            <Card className="shadow-sm">
              <CardContent className="p-4 space-y-3">
                <h3 className="font-display font-semibold text-sm">Neues Zeitfenster</h3>
                <div>
                  <Label className="text-xs">Wochentag</Label>
                  <select value={newDay} onChange={(e) => setNewDay(parseInt(e.target.value))}
                    className="w-full mt-1 px-3 py-2 border border-input rounded-md bg-background text-sm">
                    {WORK_DAYS.map(d => <option key={d} value={d}>{DAYS[d]}</option>)}
                    <option value={6}>Samstag</option>
                  </select>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs">Von</Label>
                    <Input type="time" value={newStart} onChange={(e) => setNewStart(e.target.value)} className="text-sm mt-1" />
                  </div>
                  <div>
                    <Label className="text-xs">Bis</Label>
                    <Input type="time" value={newEnd} onChange={(e) => setNewEnd(e.target.value)} className="text-sm mt-1" />
                  </div>
                </div>
                <Button onClick={addSlot} className="w-full gap-1">
                  <Plus className="w-4 h-4" /> Zeitfenster hinzufügen
                </Button>
              </CardContent>
            </Card>

            {/* Vorhandene Slots nach Wochentag gruppiert */}
            {[1, 2, 3, 4, 5, 6, 0].map(day => {
              const daySlots = slots.filter(s => s.dayOfWeek === day);
              if (daySlots.length === 0) return null;
              return (
                <Card key={day} className="shadow-sm">
                  <CardContent className="p-3">
                    <p className="text-xs font-medium text-muted-foreground mb-2">{DAYS[day]}</p>
                    <div className="flex flex-wrap gap-2">
                      {daySlots.map(s => (
                        <div key={s.id} className="flex items-center gap-1 bg-primary/10 text-primary rounded-full pl-3 pr-1 py-1 text-xs font-medium">
                          {s.startTime} – {s.endTime}
                          <button onClick={() => deleteSlot(s.id)} className="p-0.5 hover:bg-primary/20 rounded-full">
                            <X className="w-3 h-3" />
                          </button>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              );
            })}

            {slots.length === 0 && (
              <Card className="shadow-sm"><CardContent className="p-6 text-center">
                <Clock className="w-10 h-10 mx-auto text-muted-foreground mb-2" />
                <p className="text-muted-foreground text-sm">Noch keine Zeitfenster definiert</p>
                <p className="text-xs text-muted-foreground mt-1">Füge oben deine verfügbaren Zeiten hinzu.</p>
              </CardContent></Card>
            )}
          </>
        )}
      </div>
    </div>
  );
}
