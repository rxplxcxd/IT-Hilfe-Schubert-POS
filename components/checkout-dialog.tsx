'use client';

import { useState, useEffect, useMemo } from 'react';
import { QRCodeCanvas } from 'qrcode.react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Banknote, QrCode, Smartphone, Printer, CheckCircle2, Loader2, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';
import { formatCurrency } from '@/lib/utils';
import { createClient } from '@/lib/supabase/client';

interface CheckoutDialogProps {
  invoice: any;
  open: boolean;
  onClose: () => void;
  onPaid: () => void;
}

type Stage = 'bar' | 'sepa' | 'revolut';

interface CompanySettings {
  companyName: string;
  ownerName: string;
  iban: string;
  bic: string;
  bankName: string;
}

export function CheckoutDialog({ invoice, open, onClose, onPaid }: CheckoutDialogProps) {
  const [stage, setStage] = useState<Stage>('bar');
  const [settings, setSettings] = useState<CompanySettings | null>(null);
  const [paying, setPaying] = useState(false);

  // Bar
  const [received, setReceived] = useState('');

  // Revolut
  const [revolutUrl, setRevolutUrl] = useState<string | null>(null);
  const [revolutLoading, setRevolutLoading] = useState(false);
  const [revolutError, setRevolutError] = useState<string | null>(null);

  const total = Number(invoice?.total ?? 0);
  const invoiceNumber = invoice?.invoiceNumber ?? '';

  useEffect(() => {
    if (!open) return;
    setStage('bar');
    setReceived('');
    setRevolutUrl(null);
    setRevolutError(null);
    (async () => {
      try {
        const res = await fetch('/api/settings');
        const json = await res.json();
        if (json) {
          setSettings({
            companyName: json.companyName ?? 'IT-Hilfe Schubert',
            ownerName: json.ownerName ?? '',
            iban: json.iban ?? '',
            bic: json.bic ?? '',
            bankName: json.bankName ?? '',
          });
        }
      } catch (e) {
        console.error('Settings laden fehlgeschlagen', e);
      }
    })();
  }, [open]);

  // Revolut Realtime: auf Statuswechsel BEZAHLT lauschen
  useEffect(() => {
    if (!open || stage !== 'revolut' || !revolutUrl || !invoice?.id) return;
    let active = true;
    let channel: any = null;
    try {
      const supabase = createClient();
      channel = supabase
        .channel(`invoice-pay-${invoice.id}`)
        .on(
          'postgres_changes',
          { event: 'UPDATE', schema: 'public', table: 'Invoice', filter: `id=eq.${invoice.id}` },
          (payload: any) => {
            if (!active) return;
            const newStatus = payload?.new?.status;
            if (newStatus === 'BEZAHLT') {
              toast.success('Revolut-Zahlung eingegangen!');
              onPaid();
              onClose();
            }
          },
        )
        .subscribe();
    } catch (e) {
      console.error('Realtime-Subscription fehlgeschlagen', e);
    }
    return () => {
      active = false;
      try { if (channel) createClient().removeChannel(channel); } catch {}
    };
  }, [open, stage, revolutUrl, invoice?.id, onPaid, onClose]);

  const changeDue = useMemo(() => {
    const r = parseFloat((received || '').replace(',', '.'));
    if (isNaN(r)) return 0;
    return Math.max(0, r - total);
  }, [received, total]);

  const roundUp = (base: number) => {
    setReceived(String(Math.ceil(total / base) * base));
  };

  // EPC / Girocode (SEPA) String – Zeilen mit \n getrennt
  const epcString = useMemo(() => {
    const iban = (settings?.iban ?? '').replace(/\s+/g, '');
    const bic = settings?.bic ?? '';
    const name = (settings?.companyName ?? 'IT-Hilfe Schubert').slice(0, 70);
    const amount = 'EUR' + total.toFixed(2);
    const ref = ('Auftrag ' + invoiceNumber).slice(0, 140);
    return ['BCD', '002', '1', 'SCT', bic, name, iban, amount, '', '', ref].join('\n');
  }, [settings, total, invoiceNumber]);

  const markPaid = async () => {
    setPaying(true);
    try {
      const res = await fetch(`/api/invoices/${invoice.id}/pay`, { method: 'POST' });
      if (!res.ok) throw new Error();
      toast.success('Zahlung abgeschlossen');
      onPaid();
      onClose();
    } catch {
      toast.error('Fehler beim Abschließen der Zahlung');
    } finally {
      setPaying(false);
    }
  };

  const startRevolut = async () => {
    setRevolutLoading(true);
    setRevolutError(null);
    try {
      const res = await fetch('/api/create-revolut-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ invoiceId: invoice.id, amount: total, invoiceNumber }),
      });
      const json = await res.json();
      if (!res.ok || !json?.checkout_url) {
        setRevolutError(json?.error || 'Revolut ist noch nicht konfiguriert – siehe Setup-Checkliste.');
        return;
      }
      setRevolutUrl(json.checkout_url);
    } catch (e) {
      setRevolutError('Revolut-Anfrage fehlgeschlagen.');
    } finally {
      setRevolutLoading(false);
    }
  };

  const printReceipt = () => {
    window.print();
  };

  const stageBtn = (s: Stage, label: string, Icon: any) => (
    <button
      type="button"
      onClick={() => setStage(s)}
      className={`flex-1 flex flex-col items-center gap-1 py-3 rounded-xl border text-xs font-medium transition ${
        stage === s
          ? 'bg-blue-800 text-white border-blue-800 shadow'
          : 'bg-card text-foreground border-border hover:bg-muted'
      }`}
    >
      <Icon className="w-5 h-5" />
      {label}
    </button>
  );

  const nowStr = new Date().toLocaleString('de-DE', { timeZone: 'Europe/Berlin' });

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-md p-0 overflow-hidden gap-0 print:hidden">
        <DialogHeader className="px-5 pt-5 pb-3 bg-blue-800 text-white">
          <DialogTitle className="text-white flex items-center justify-between">
            <span>Kassieren</span>
            <span className="text-lg font-bold">{formatCurrency(total)}</span>
          </DialogTitle>
          <p className="text-xs text-blue-100">Rechnung {invoiceNumber}</p>
        </DialogHeader>

        <div className="p-4 space-y-4">
          <div className="flex gap-2">
            {stageBtn('bar', 'Bar', Banknote)}
            {stageBtn('sepa', 'SEPA-QR', QrCode)}
            {stageBtn('revolut', 'Revolut', Smartphone)}
          </div>

          {/* ---------- BAR ---------- */}
          {stage === 'bar' && (
            <div className="space-y-3">
              <div>
                <label className="text-sm font-medium text-foreground">Vom Kunden erhalten</label>
                <Input
                  value={received}
                  onChange={(e) => setReceived(e.target.value)}
                  inputMode="decimal"
                  autoCapitalize="off"
                  autoCorrect="off"
                  spellCheck={false}
                  placeholder={total.toFixed(2)}
                  className="mt-1 text-lg"
                />
              </div>
              <div className="flex flex-wrap gap-2">
                <Button type="button" variant="outline" size="sm" onClick={() => setReceived(total.toFixed(2))}>Passend</Button>
                <Button type="button" variant="outline" size="sm" onClick={() => roundUp(50)}>Nächste 50</Button>
                <Button type="button" variant="outline" size="sm" onClick={() => roundUp(100)}>Nächste 100</Button>
              </div>
              <div className="rounded-xl bg-muted p-4 flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Rückgeld</span>
                <span className="text-2xl font-bold text-blue-800 dark:text-blue-300">{formatCurrency(changeDue)}</span>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <Button type="button" variant="outline" onClick={printReceipt} className="gap-2">
                  <Printer className="w-4 h-4" /> Bon drucken
                </Button>
                <Button type="button" onClick={markPaid} disabled={paying} className="gap-2 bg-green-600 hover:bg-green-700">
                  {paying ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                  Abschließen
                </Button>
              </div>
            </div>
          )}

          {/* ---------- SEPA ---------- */}
          {stage === 'sepa' && (
            <div className="space-y-3">
              {(settings?.iban ?? '').trim() ? (
                <>
                  <div className="flex justify-center bg-white p-4 rounded-xl">
                    <QRCodeCanvas value={epcString} size={200} includeMargin />
                  </div>
                  <p className="text-xs text-center text-muted-foreground">
                    Mit der Banking-App scannen (Girocode / EPC-QR).
                  </p>
                  <div className="rounded-xl bg-muted p-3 text-sm space-y-1">
                    <div className="flex justify-between"><span className="text-muted-foreground">Empfänger</span><span className="font-medium">{settings?.companyName}</span></div>
                    <div className="flex justify-between"><span className="text-muted-foreground">IBAN</span><span className="font-mono text-xs">{settings?.iban}</span></div>
                    {(settings?.bic ?? '').trim() && <div className="flex justify-between"><span className="text-muted-foreground">BIC</span><span className="font-mono text-xs">{settings?.bic}</span></div>}
                    <div className="flex justify-between"><span className="text-muted-foreground">Betrag</span><span className="font-semibold">{formatCurrency(total)}</span></div>
                    <div className="flex justify-between"><span className="text-muted-foreground">Verwendung</span><span>Auftrag {invoiceNumber}</span></div>
                  </div>
                  <Button type="button" onClick={markPaid} disabled={paying} className="w-full gap-2 bg-green-600 hover:bg-green-700">
                    {paying ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                    Als bezahlt markieren
                  </Button>
                </>
              ) : (
                <div className="rounded-xl bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-800 p-4 text-sm text-amber-800 dark:text-amber-200 flex gap-2">
                  <AlertCircle className="w-5 h-5 shrink-0" />
                  <span>Bitte zuerst IBAN unter Einstellungen → Firmendaten hinterlegen, damit der SEPA-QR-Code erzeugt werden kann.</span>
                </div>
              )}
            </div>
          )}

          {/* ---------- REVOLUT ---------- */}
          {stage === 'revolut' && (
            <div className="space-y-3">
              {!revolutUrl && (
                <Button type="button" onClick={startRevolut} disabled={revolutLoading} className="w-full gap-2 bg-blue-800 hover:bg-blue-900">
                  {revolutLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Smartphone className="w-4 h-4" />}
                  Revolut-Zahlung starten
                </Button>
              )}
              {revolutError && (
                <div className="rounded-xl bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-800 p-4 text-sm text-amber-800 dark:text-amber-200 flex gap-2">
                  <AlertCircle className="w-5 h-5 shrink-0" />
                  <span>{revolutError}</span>
                </div>
              )}
              {revolutUrl && (
                <>
                  <div className="flex justify-center bg-white p-4 rounded-xl">
                    <QRCodeCanvas value={revolutUrl} size={200} includeMargin />
                  </div>
                  <p className="text-xs text-center text-muted-foreground">
                    Kunde scannt den Code oder öffnet den Zahlungslink. Der Status aktualisiert sich automatisch.
                  </p>
                  <a href={revolutUrl} target="_blank" rel="noopener noreferrer" className="block text-center text-sm text-blue-700 dark:text-blue-300 underline break-all">
                    Zahlungslink öffnen
                  </a>
                  <Button type="button" onClick={markPaid} disabled={paying} variant="outline" className="w-full gap-2">
                    {paying ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                    Manuell als bezahlt markieren
                  </Button>
                </>
              )}
            </div>
          )}
        </div>
      </DialogContent>

      {/* ---------- Druck-Bon (80mm) ---------- */}
      {open && (
        <div className="receipt-print hidden print:block">
          <div style={{ fontFamily: 'monospace', width: '72mm', padding: '4mm', color: '#000' }}>
            <div style={{ textAlign: 'center', fontWeight: 'bold', fontSize: '14px' }}>{settings?.companyName ?? 'IT-Hilfe Schubert'}</div>
            {settings?.ownerName && <div style={{ textAlign: 'center', fontSize: '11px' }}>{settings.ownerName}</div>}
            <div style={{ borderTop: '1px dashed #000', margin: '6px 0' }} />
            <div style={{ fontSize: '11px' }}>Rechnung: {invoiceNumber}</div>
            <div style={{ fontSize: '11px' }}>Datum: {nowStr}</div>
            <div style={{ borderTop: '1px dashed #000', margin: '6px 0' }} />
            {(invoice?.items ?? []).map((it: any, i: number) => (
              <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px' }}>
                <span>{it?.quantity ?? 1}× {it?.description ?? ''}</span>
                <span>{formatCurrency(Number(it?.total ?? (Number(it?.unitPrice ?? 0) * Number(it?.quantity ?? 1))))}</span>
              </div>
            ))}
            <div style={{ borderTop: '1px dashed #000', margin: '6px 0' }} />
            <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 'bold', fontSize: '13px' }}>
              <span>Summe</span><span>{formatCurrency(total)}</span>
            </div>
            {(received || '').trim() && (
              <>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px' }}>
                  <span>Gegeben</span><span>{formatCurrency(parseFloat((received || '0').replace(',', '.')) || 0)}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px' }}>
                  <span>Rückgeld</span><span>{formatCurrency(changeDue)}</span>
                </div>
              </>
            )}
            <div style={{ borderTop: '1px dashed #000', margin: '6px 0' }} />
            <div style={{ textAlign: 'center', fontSize: '10px' }}>Gemäß §19 UStG wird keine Umsatzsteuer berechnet.</div>
            <div style={{ textAlign: 'center', fontSize: '11px', marginTop: '4px' }}>Vielen Dank!</div>
          </div>
        </div>
      )}

      <style jsx global>{`
        @media print {
          body * { visibility: hidden !important; }
          .receipt-print, .receipt-print * { visibility: visible !important; }
          .receipt-print { position: absolute; left: 0; top: 0; width: 80mm; }
        }
      `}</style>
    </Dialog>
  );
}
