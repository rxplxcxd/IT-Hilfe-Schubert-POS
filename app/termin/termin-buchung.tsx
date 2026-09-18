'use client';

import { useState, useEffect, useCallback } from 'react';
import { CalendarDays, Clock, User, Phone, Mail, MapPin, MessageSquare, ChevronLeft, ChevronRight, CheckCircle2, Monitor, Shield, Wrench, BadgeCheck, Tag, Quote, ChevronDown, Star } from 'lucide-react';

interface Props {
  companyName: string;
  ownerName: string;
  phone: string;
  email: string;
  logoUrl: string;
  employeeNo?: number;
  employeeName?: string;
}

interface Slot {
  id: number;
  startTime: string;
  endTime: string;
}

const DAYS = ['Sonntag', 'Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag'];

export function TerminBuchung({ companyName, ownerName, phone, email, logoUrl, employeeNo, employeeName }: Props) {
  const [step, setStep] = useState(0); // 0=landing, 1=datum, 2=formular, 3=bestätigung
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [selectedSlot, setSelectedSlot] = useState<Slot | null>(null);
  const [slots, setSlots] = useState<Slot[]>([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [calendarMonth, setCalendarMonth] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });
  const [form, setForm] = useState({ name: '', phone: '', email: '', address: '', description: '' });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [activeDays, setActiveDays] = useState<Set<number>>(new Set());
  const [openFaq, setOpenFaq] = useState<number | null>(0);

  // Fetch which days of week have active time slots
  useEffect(() => {
    async function fetchActiveDays() {
      try {
        const res = await fetch('/api/timeslots');
        const data = await res.json();
        const days = new Set<number>((data ?? []).map((s: any) => s.dayOfWeek));
        setActiveDays(days);
      } catch { setActiveDays(new Set()); }
    }
    fetchActiveDays();
  }, []);

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const fetchSlots = useCallback(async (date: Date) => {
    setLoadingSlots(true);
    try {
      const dateStr = date.toISOString().split('T')[0];
      const res = await fetch(`/api/appointments?public=true&date=${dateStr}`);
      const data = await res.json();
      setSlots(data ?? []);
    } catch { setSlots([]); }
    finally { setLoadingSlots(false); }
  }, []);

  useEffect(() => {
    if (selectedDate) fetchSlots(selectedDate);
  }, [selectedDate, fetchSlots]);

  const selectDate = (date: Date) => {
    setSelectedDate(date);
    setSelectedSlot(null);
  };

  const handleSubmit = async () => {
    if (!form.name.trim() || !form.phone.trim()) {
      setError('Bitte Name und Telefonnummer eingeben.');
      return;
    }
    if (!selectedDate || !selectedSlot) return;
    setSubmitting(true);
    setError('');
    try {
      const res = await fetch('/api/appointments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          date: selectedDate.toISOString(),
          startTime: selectedSlot.startTime,
          endTime: selectedSlot.endTime,
          customerName: form.name,
          customerPhone: form.phone,
          customerEmail: form.email,
          address: form.address,
          description: form.description,
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Fehler bei der Buchung');
      }
      setStep(3);
    } catch (e: any) {
      setError(e.message);
    } finally { setSubmitting(false); }
  };

  // Calendar generation
  const daysInMonth = new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() + 1, 0).getDate();
  const firstDayOfWeek = (new Date(calendarMonth.getFullYear(), calendarMonth.getMonth(), 1).getDay() + 6) % 7; // Mo=0
  const calendarDays: (Date | null)[] = [];
  for (let i = 0; i < firstDayOfWeek; i++) calendarDays.push(null);
  for (let d = 1; d <= daysInMonth; d++) calendarDays.push(new Date(calendarMonth.getFullYear(), calendarMonth.getMonth(), d));

  const monthLabel = calendarMonth.toLocaleDateString('de-DE', { month: 'long', year: 'numeric' });

  const prevMonth = () => setCalendarMonth(new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() - 1, 1));
  const nextMonth = () => setCalendarMonth(new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() + 1, 1));

  // LANDING PAGE
  if (step === 0) {
    const testimonials = [
      { text: 'Schnelle Hilfe, mein PC läuft wieder wie neu! Danke Leon!', name: 'Marina K., Dresden' },
      { text: 'Kompetenter Service und faire Preise. Absolut empfehlenswert.', name: 'Stefan P., Radebeul' },
      { text: 'Endlich jemand, der IT verständlich erklärt. Top!', name: 'Andrea M., Bautzen' },
      { text: 'Vor-Ort-Termin am selben Tag – super unkompliziert.', name: 'Thomas R., Kamenz' },
      { text: 'Mein Laptop war gerettet, die Datenrettung hat geklappt.', name: 'Petra L., Görlitz' },
    ];
    const faqs = [
      { q: 'Wie schnell sind Sie vor Ort?', a: 'In der Regel innerhalb von 24 Stunden.' },
      { q: 'Was kostet eine Diagnose?', a: 'Wir bieten eine Festpreisdiagnose für 49 €.' },
      { q: 'Reparieren Sie auch Apple-Geräte?', a: 'Ja, wir bieten auch Mac-Service an.' },
      { q: 'Kommen Sie auch zu mir nach Hause?', a: 'Ja, wir bieten Vor-Ort-Service in der gesamten Region an.' },
    ];
    const catalog = [
      { title: 'PC & Laptop Reparatur', items: ['OS-Neuinstallation', 'Hardware-Upgrades', 'Datenrettung', 'Fehlerdiagnose'] },
      { title: 'Virenschutz & Sicherheit', items: ['Malware-Entfernung', 'Sicherheits-Audits', 'Backup-Lösungen', 'Firewall-Konfiguration'] },
      { title: 'Einrichtung & Installation', items: ['WLAN-Optimierung', 'Drucker-Einrichtung', 'Software-Konfiguration', 'Heimnetzwerk-Setup'] },
    ];
    return (
      <div className="flex-1 bg-gradient-to-br from-blue-50 via-white to-blue-50">
        <style jsx>{`
          @keyframes tb-marquee { 0% { transform: translateX(0); } 100% { transform: translateX(-50%); } }
          .tb-marquee-track { display: flex; width: max-content; animation: tb-marquee 32s linear infinite; }
          .tb-marquee-wrap:hover .tb-marquee-track { animation-play-state: paused; }
        `}</style>
        {/* Hero */}
        <div className="relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-blue-600 to-blue-800" />
          <div className="absolute inset-0 opacity-20" style={{ backgroundImage: 'radial-gradient(rgba(255,255,255,0.25) 1px, transparent 1px)', backgroundSize: '22px 22px' }} />
          <div className="relative px-6 py-16 text-center text-white anim-fade-in">
            {logoUrl && <img src={logoUrl} alt="Logo" className="w-20 h-20 mx-auto mb-4 rounded-2xl bg-white/20 p-2 object-contain" />}
            <h1 className="font-display text-3xl font-bold mb-2">{companyName}</h1>
            <p className="text-blue-100 text-lg">{employeeName ? `Ihr Ansprechpartner: ${employeeName}` : 'Ihr IT-Service in der Region'}</p>
          </div>
        </div>

        <div className="px-6 -mt-6 relative z-10 max-w-lg mx-auto pb-12">
          {/* Services */}
          <div className="bg-white rounded-2xl shadow-lg p-6 mb-6 anim-fade-up">
            <h2 className="font-display font-semibold text-lg mb-4 text-gray-900">Unsere Leistungen</h2>
            <div className="grid grid-cols-1 gap-3">
              {[
                { icon: Monitor, title: 'PC & Laptop Reparatur', desc: 'Schnelle Hilfe bei Hardware- und Softwareproblemen' },
                { icon: Shield, title: 'Virenschutz & Sicherheit', desc: 'Schutz vor Viren, Malware und Datenverlust' },
                { icon: Wrench, title: 'Einrichtung & Installation', desc: 'Geräte, WLAN, Drucker und Software einrichten' },
              ].map((s, i) => (
                <div key={i} className={`flex items-start gap-3 p-3 rounded-xl bg-blue-50 anim-fade-up-d${i + 1}`}>
                  <s.icon className="w-5 h-5 text-blue-600 mt-0.5 shrink-0" />
                  <div>
                    <p className="font-medium text-sm text-gray-900">{s.title}</p>
                    <p className="text-xs text-gray-500">{s.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* CTA */}
          <button
            onClick={() => setStep(1)}
            className="w-full py-4 bg-blue-600 hover:bg-blue-700 text-white font-bold text-lg rounded-2xl shadow-lg shadow-blue-600/30 transition-all active:scale-[0.98] anim-fade-up-d3 anim-pulse-glow"
          >
            <CalendarDays className="w-5 h-5 inline-block mr-2 -mt-0.5" />
            Jetzt Termin buchen
          </button>

          {/* Warum IT-Hilfe Schubert */}
          <div className="mt-6 bg-white rounded-2xl shadow-lg p-6 anim-fade-up">
            <h2 className="font-display font-semibold text-lg mb-5 text-gray-900">Warum IT-Hilfe Schubert?</h2>
            <div className="grid grid-cols-3 gap-3 text-center">
              {[
                { icon: MapPin, title: 'Lokal & Schnell', desc: 'Ihr Ansprechpartner in der Region' },
                { icon: BadgeCheck, title: 'Zertifizierter Experte', desc: 'Über 10 Jahre Erfahrung' },
                { icon: Tag, title: 'Transparente Preise', desc: 'Keine versteckten Kosten' },
              ].map((w, i) => (
                <div key={i} className="flex flex-col items-center">
                  <div className="w-11 h-11 rounded-full bg-blue-50 flex items-center justify-center mb-2">
                    <w.icon className="w-5 h-5 text-blue-600" />
                  </div>
                  <p className="font-semibold text-xs text-gray-900 leading-tight">{w.title}</p>
                  <p className="text-[11px] text-gray-500 mt-1 leading-snug">{w.desc}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Unser Versprechen / Gründer */}
          <div className="mt-6 bg-white rounded-2xl shadow-lg p-6 anim-fade-up">
            <div className="flex flex-col sm:flex-row gap-4 items-center sm:items-start">
              <img src="/founder.jpg" alt={ownerName} className="w-28 h-28 rounded-2xl object-cover shrink-0 shadow-sm" />
              <div>
                <h2 className="font-display font-semibold text-lg mb-2 text-gray-900">Unser Versprechen an Sie</h2>
                <p className="text-sm text-gray-600 leading-relaxed">Hallo, ich bin {ownerName}. Ihr Partner für alle IT-Herausforderungen – ich sorge dafür, dass Ihre Technik funktioniert.</p>
                <p className="text-sm text-gray-600 leading-relaxed mt-2">Persönlich, ehrlich und unkompliziert. Ich freue mich auf Ihre Anfrage!</p>
              </div>
            </div>
          </div>

          {/* Dienstleistungskatalog */}
          <div className="mt-6 bg-white rounded-2xl shadow-lg p-6 anim-fade-up">
            <h2 className="font-display font-semibold text-lg mb-4 text-gray-900">Dienstleistungskatalog</h2>
            <div className="grid grid-cols-1 gap-4">
              {catalog.map((c, i) => (
                <div key={i} className="rounded-xl bg-blue-50/60 p-4">
                  <p className="font-semibold text-sm text-gray-900 mb-2">{c.title}</p>
                  <ul className="space-y-1">
                    {c.items.map((it, j) => (
                      <li key={j} className="flex items-center gap-2 text-xs text-gray-600">
                        <CheckCircle2 className="w-3.5 h-3.5 text-blue-600 shrink-0" /> {it}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>

          {/* Testimonials (auto-scroll) */}
          <div className="mt-6 anim-fade-up">
            <h2 className="font-display font-semibold text-lg mb-4 text-gray-900 px-1">Was Kunden sagen</h2>
            <div className="tb-marquee-wrap overflow-hidden -mx-6 px-6">
              <div className="tb-marquee-track gap-3">
                {[...testimonials, ...testimonials].map((t, i) => (
                  <div key={i} className="w-64 shrink-0 bg-white rounded-2xl shadow-md p-4">
                    <div className="flex gap-0.5 mb-2">
                      {[0, 1, 2, 3, 4].map((s) => <Star key={s} className="w-3.5 h-3.5 text-amber-400 fill-amber-400" />)}
                    </div>
                    <Quote className="w-4 h-4 text-blue-200 mb-1" />
                    <p className="text-sm text-gray-700 leading-snug">{t.text}</p>
                    <p className="text-xs text-gray-400 mt-2">– {t.name}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* FAQ */}
          <div className="mt-6 bg-white rounded-2xl shadow-lg p-6 anim-fade-up">
            <h2 className="font-display font-semibold text-lg mb-3 text-gray-900">Häufig gestellte Fragen</h2>
            <div className="divide-y divide-gray-100">
              {faqs.map((f, i) => (
                <div key={i} className="py-3">
                  <button onClick={() => setOpenFaq(openFaq === i ? null : i)} className="w-full flex items-center justify-between gap-3 text-left">
                    <span className="font-medium text-sm text-gray-900">{f.q}</span>
                    <ChevronDown className={`w-4 h-4 text-blue-600 shrink-0 transition-transform ${openFaq === i ? 'rotate-180' : ''}`} />
                  </button>
                  {openFaq === i && <p className="text-sm text-gray-600 mt-2 leading-relaxed">{f.a}</p>}
                </div>
              ))}
            </div>
          </div>

          {/* Zweiter CTA */}
          <div className="mt-8 text-center anim-fade-up">
            <p className="text-sm text-gray-600 mb-3">Überzeugt? Buchen Sie Ihren Termin jetzt online!</p>
            <button
              onClick={() => setStep(1)}
              className="inline-flex items-center gap-2 px-8 py-3.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-2xl shadow-lg shadow-blue-600/30 transition-all active:scale-[0.98]"
            >
              <CalendarDays className="w-5 h-5" /> Jetzt buchen
            </button>
          </div>

          {/* Kontakt */}
          <div className="mt-8 bg-white rounded-2xl shadow-lg p-6 anim-fade-up">
            <h3 className="font-display font-semibold text-sm mb-3 text-gray-900">Kontakt</h3>
            <div className="space-y-2 text-sm text-gray-600">
              <p className="flex items-center gap-2"><User className="w-4 h-4 text-blue-600" /> {ownerName}</p>
              {phone && <a href={`tel:${phone}`} className="flex items-center gap-2 text-blue-600"><Phone className="w-4 h-4" /> {phone}</a>}
              {email && <a href={`mailto:${email}`} className="flex items-center gap-2 text-blue-600"><Mail className="w-4 h-4" /> {email}</a>}
            </div>
          </div>

          <p className="text-center text-xs text-gray-400 mt-8">© {new Date().getFullYear()} {companyName}</p>
        </div>
      </div>
    );
  }

  // BESTÄTIGUNG
  if (step === 3) {
    return (
      <div className="flex-1 bg-gradient-to-br from-green-50 via-white to-blue-50 flex items-center justify-center px-6">
        <div className="bg-white rounded-2xl shadow-lg p-8 max-w-md w-full text-center anim-scale-in">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <CheckCircle2 className="w-8 h-8 text-green-600" />
          </div>
          <h2 className="font-display font-bold text-xl text-gray-900 mb-2">Termin angefragt!</h2>
          <p className="text-gray-600 text-sm mb-4">
            Vielen Dank, {form.name}! Ihre Terminanfrage für den{' '}
            <strong>{selectedDate?.toLocaleDateString('de-DE', { weekday: 'long', day: 'numeric', month: 'long' })}</strong>{' '}
            um <strong>{selectedSlot?.startTime} Uhr</strong> wurde erfolgreich übermittelt.
          </p>
          <p className="text-gray-500 text-xs mb-6">Wir melden uns in Kürze zur Bestätigung bei Ihnen.</p>
          {phone && <a href={`tel:${phone}`} className="inline-flex items-center gap-2 text-blue-600 text-sm font-medium"><Phone className="w-4 h-4" /> {phone}</a>}
          <button onClick={() => { setStep(0); setSelectedDate(null); setSelectedSlot(null); setForm({ name: '', phone: '', email: '', address: '', description: '' }); }}
            className="block w-full mt-6 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl text-sm font-medium transition-colors">
            Zurück zur Startseite
          </button>
        </div>
      </div>
    );
  }

  // DATUM + SLOT AUSWAHL + FORMULAR
  return (
    <div className="flex-1 bg-gradient-to-br from-blue-50 via-white to-blue-50">
      {/* Header */}
      <div className="bg-blue-600 text-white px-4 py-4 flex items-center gap-3">
        <button onClick={() => setStep(step === 2 ? 1 : 0)} className="p-1 hover:bg-white/10 rounded-lg">
          <ChevronLeft className="w-5 h-5" />
        </button>
        <div>
          <h1 className="font-display font-bold text-base">{step === 1 ? 'Termin wählen' : 'Ihre Daten'}</h1>
          <p className="text-blue-200 text-xs">{companyName}</p>
        </div>
      </div>

      <div className="px-4 py-5 max-w-lg mx-auto">
        {step === 1 && (
          <div className="space-y-5">
            {/* Kalender */}
            <div className="bg-white rounded-2xl shadow-sm p-4 anim-fade-up">
              <div className="flex items-center justify-between mb-4">
                <button onClick={prevMonth} className="p-1.5 hover:bg-gray-100 rounded-lg"><ChevronLeft className="w-4 h-4" /></button>
                <h3 className="font-display font-semibold text-sm capitalize">{monthLabel}</h3>
                <button onClick={nextMonth} className="p-1.5 hover:bg-gray-100 rounded-lg"><ChevronRight className="w-4 h-4" /></button>
              </div>
              <div className="grid grid-cols-7 gap-1 text-center">
                {['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'].map(d => (
                  <div key={d} className="text-[10px] font-medium text-gray-400 py-1">{d}</div>
                ))}
                {calendarDays.map((d, i) => {
                  if (!d) return <div key={`empty-${i}`} />;
                  const isPast = d < today;
                  const hasSlots = activeDays.has(d.getDay());
                  const isDisabled = isPast || !hasSlots;
                  const isSelected = selectedDate && d.toDateString() === selectedDate.toDateString();
                  const isToday = d.toDateString() === today.toDateString();
                  return (
                    <button
                      key={d.toISOString()}
                      onClick={() => !isDisabled && selectDate(d)}
                      disabled={isDisabled}
                      className={`py-2 rounded-lg text-sm font-medium transition-all ${
                        isDisabled ? 'text-gray-300 cursor-not-allowed'
                        : isSelected ? 'bg-blue-600 text-white shadow-sm'
                        : isToday ? 'bg-blue-100 text-blue-700 ring-1 ring-blue-200'
                        : 'text-gray-700 hover:bg-blue-50'
                      }`}
                    >
                      {d.getDate()}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Zeitfenster */}
            {selectedDate && (
              <div className="bg-white rounded-2xl shadow-sm p-4 anim-fade-up">
                <h3 className="font-display font-semibold text-sm mb-3 flex items-center gap-2">
                  <Clock className="w-4 h-4 text-blue-600" />
                  Verfügbare Zeiten – {DAYS[selectedDate.getDay()]}, {selectedDate.toLocaleDateString('de-DE', { day: 'numeric', month: 'long' })}
                </h3>
                {loadingSlots ? (
                  <div className="flex justify-center py-6"><div className="animate-spin w-5 h-5 border-2 border-blue-600 border-t-transparent rounded-full" /></div>
                ) : slots.length === 0 ? (
                  <p className="text-gray-500 text-sm text-center py-6">Keine freien Termine an diesem Tag.</p>
                ) : (
                  <div className="grid grid-cols-3 gap-2">
                    {slots.map((s, idx) => (
                      <button
                        key={s.id}
                        onClick={() => setSelectedSlot(s)}
                        style={{ animationDelay: `${idx * 0.05}s` }}
                        className={`py-3 rounded-xl text-sm font-medium transition-all anim-slot ${
                          selectedSlot?.id === s.id
                            ? 'bg-blue-600 text-white shadow-sm'
                            : 'bg-blue-50 text-blue-700 hover:bg-blue-100'
                        }`}
                      >
                        {s.startTime}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            {selectedSlot && (
              <button
                onClick={() => setStep(2)}
                className="w-full py-4 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-2xl shadow-lg shadow-blue-600/20 transition-all anim-fade-up anim-pulse-glow"
              >
                Weiter →
              </button>
            )}
          </div>
        )}

        {step === 2 && (
          <div className="space-y-4">
            {/* Zusammenfassung */}
            <div className="bg-blue-50 rounded-2xl p-4 flex items-center gap-3 anim-slide-down">
              <CalendarDays className="w-5 h-5 text-blue-600 shrink-0" />
              <div className="text-sm">
                <p className="font-medium text-gray-900">
                  {selectedDate?.toLocaleDateString('de-DE', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
                </p>
                <p className="text-blue-600 font-semibold">{selectedSlot?.startTime} – {selectedSlot?.endTime} Uhr</p>
              </div>
            </div>

            {/* Formular */}
            <div className="bg-white rounded-2xl shadow-sm p-4 space-y-4 anim-fade-up">
              <h3 className="font-display font-semibold text-sm">Ihre Kontaktdaten</h3>

              <div>
                <label className="text-xs font-medium text-gray-600 flex items-center gap-1 mb-1"><User className="w-3 h-3" /> Name *</label>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="Vor- und Nachname"
                  className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                />
              </div>

              <div>
                <label className="text-xs font-medium text-gray-600 flex items-center gap-1 mb-1"><Phone className="w-3 h-3" /> Telefon *</label>
                <input
                  type="tel"
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                  placeholder="Ihre Telefonnummer"
                  className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                />
              </div>

              <div>
                <label className="text-xs font-medium text-gray-600 flex items-center gap-1 mb-1"><Mail className="w-3 h-3" /> E-Mail (optional)</label>
                <input
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  placeholder="ihre@email.de"
                  className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                />
              </div>

              <div>
                <label className="text-xs font-medium text-gray-600 flex items-center gap-1 mb-1"><MapPin className="w-3 h-3" /> Adresse (optional)</label>
                <input
                  type="text"
                  value={form.address}
                  onChange={(e) => setForm({ ...form, address: e.target.value })}
                  placeholder="Straße, PLZ, Ort"
                  className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                />
              </div>

              <div>
                <label className="text-xs font-medium text-gray-600 flex items-center gap-1 mb-1"><MessageSquare className="w-3 h-3" /> Was können wir für Sie tun?</label>
                <textarea
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  placeholder="Beschreiben Sie kurz Ihr Problem oder Anliegen..."
                  rows={3}
                  className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none resize-none"
                />
              </div>
            </div>

            {error && (
              <div className="bg-red-50 text-red-700 rounded-xl px-4 py-3 text-sm">{error}</div>
            )}

            <button
              onClick={handleSubmit}
              disabled={submitting}
              className="w-full py-4 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-bold rounded-2xl shadow-lg shadow-blue-600/20 transition-all"
            >
              {submitting ? 'Wird gebucht...' : 'Termin verbindlich anfragen'}
            </button>

            <p className="text-xs text-gray-400 text-center">Wir bestätigen Ihren Termin telefonisch oder per E-Mail.</p>
          </div>
        )}
      </div>
    </div>
  );
}
