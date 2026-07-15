'use client';

import { useState, useEffect, useCallback } from 'react';
import { FileText, ArrowLeft, CheckCircle2, Clock, Download, Mail, Send, Filter, AlertCircle, Banknote, CreditCard, XCircle, Ban } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { formatCurrency, formatDate, formatDateTime } from '@/lib/utils';

interface Invoice {
  id: number;
  invoiceNumber: string;
  caseNumber: string;
  customerId: number;
  customer: any;
  items: any[];
  subtotal: number;
  discount: number;
  travelCost: number;
  total: number;
  paymentMethod: string;
  status: string;
  paidAt: string | null;
  notes: string;
  emailSentAt: string | null;
  createdAt: string;
  isCancellation: boolean;
  cancelsInvoiceId: number | null;
  cancelledByInvoiceId: number | null;
  cancellationReason: string;
  cancelledAt: string | null;
}

export function InvoicesView({ viewInvoiceId, onViewInvoice }: {
  viewInvoiceId: number | null;
  onViewInvoice: (id: number | null) => void;
}) {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'ALL' | 'OFFEN' | 'BEZAHLT' | 'STORNIERT'>('ALL');
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  const [pdfLoading, setPdfLoading] = useState(false);
  const [emailLoading, setEmailLoading] = useState(false);
  const [markingPaid, setMarkingPaid] = useState(false);
  const [showCancelDialog, setShowCancelDialog] = useState(false);
  const [cancelReason, setCancelReason] = useState('');
  const [cancelling, setCancelling] = useState(false);

  const fetchInvoices = useCallback(async () => {
    try {
      const res = await fetch('/api/invoices');
      const json = await res.json();
      setInvoices(json ?? []);
    } catch (e: any) { console.error(e); } finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchInvoices(); }, [fetchInvoices]);

  useEffect(() => {
    if (viewInvoiceId && (invoices ?? []).length > 0) {
      const inv = (invoices ?? []).find((i: Invoice) => i?.id === viewInvoiceId);
      if (inv) setSelectedInvoice(inv);
    }
  }, [viewInvoiceId, invoices]);

  const filtered = (invoices ?? []).filter((inv: Invoice) => {
    if (filter === 'ALL') return true;
    return inv?.status === filter;
  });

  const handleMarkPaid = async (invoiceId: number) => {
    setMarkingPaid(true);
    try {
      const res = await fetch(`/api/invoices/${invoiceId}/pay`, { method: 'POST' });
      if (!res.ok) throw new Error();
      toast.success('Rechnung als bezahlt markiert');
      fetchInvoices();
      const updated = await res.json();
      setSelectedInvoice(updated);
    } catch {
      toast.error('Fehler beim Markieren');
    } finally { setMarkingPaid(false); }
  };

  const handleDownloadPdf = async (invoiceId: number) => {
    setPdfLoading(true);
    try {
      const res = await fetch(`/api/invoices/${invoiceId}/pdf`, { method: 'POST' });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'PDF Fehler' }));
        throw new Error(err?.error ?? 'PDF Fehler');
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${selectedInvoice?.invoiceNumber ?? 'rechnung'}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast.success('PDF heruntergeladen');
    } catch (e: any) {
      toast.error(e?.message ?? 'PDF konnte nicht erstellt werden');
    } finally { setPdfLoading(false); }
  };

  const handleCancel = async (invoiceId: number) => {
    setCancelling(true);
    try {
      const res = await fetch(`/api/invoices/${invoiceId}/cancel`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: cancelReason }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Fehler' }));
        throw new Error(err?.error || 'Fehler beim Stornieren');
      }
      const result = await res.json();
      toast.success(result.message || 'Rechnung storniert');
      setShowCancelDialog(false);
      setCancelReason('');
      setSelectedInvoice(null);
      onViewInvoice(null);
      fetchInvoices();
    } catch (e: any) {
      toast.error(e.message);
    } finally { setCancelling(false); }
  };

  const handleSendEmail = async (invoiceId: number) => {
    if (!(selectedInvoice?.customer?.email ?? '').trim()) {
      toast.error('Kunde hat keine E-Mail-Adresse hinterlegt');
      return;
    }
    setEmailLoading(true);
    try {
      const res = await fetch(`/api/invoices/${invoiceId}/email`, { method: 'POST' });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'E-Mail Fehler' }));
        throw new Error(err?.error ?? 'E-Mail Fehler');
      }
      toast.success('Rechnung per E-Mail versendet');
      fetchInvoices();
    } catch (e: any) {
      toast.error(e?.message ?? 'E-Mail konnte nicht versendet werden');
    } finally { setEmailLoading(false); }
  };

  // Detail view
  if (selectedInvoice) {
    const inv = selectedInvoice;
    return (
      <div className="p-4 space-y-4 pb-8">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" onClick={() => { setSelectedInvoice(null); onViewInvoice(null); }}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div>
            <h2 className="font-display font-semibold text-lg">{inv?.invoiceNumber ?? ''}</h2>
            <p className="text-xs text-muted-foreground">{formatDate(inv?.createdAt)}</p>
          </div>
          <div className="ml-auto">
            {inv?.status === 'STORNIERT' ? (
              <span className="text-xs bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300 px-2 py-1 rounded-full font-medium flex items-center gap-1">
                <XCircle className="w-3 h-3" /> Storniert
              </span>
            ) : inv?.status === 'BEZAHLT' ? (
              <span className="text-xs bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300 px-2 py-1 rounded-full font-medium flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3" /> Bezahlt
              </span>
            ) : (
              <span className="text-xs bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300 px-2 py-1 rounded-full font-medium flex items-center gap-1">
                <Clock className="w-3 h-3" /> Offen
              </span>
            )}
            {inv?.isCancellation && (
              <span className="text-xs bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300 px-2 py-1 rounded-full font-medium mt-1 flex items-center gap-1">
                <Ban className="w-3 h-3" /> Stornorechnung
              </span>
            )}
          </div>
        </div>

        {/* Customer Info */}
        <Card className="shadow-sm">
          <CardContent className="p-3">
            <p className="text-xs text-muted-foreground mb-1">Kunde</p>
            <p className="font-medium text-sm">{inv?.customer?.firstName ?? ''} {inv?.customer?.lastName ?? ''}</p>
            <p className="text-xs text-muted-foreground">{inv?.customer?.street ?? ''} {inv?.customer?.houseNr ?? ''}, {inv?.customer?.zip ?? ''} {inv?.customer?.city ?? ''}</p>
            <p className="text-xs text-muted-foreground">{inv?.customer?.phone ?? ''}</p>
          </CardContent>
        </Card>

        {/* Items */}
        <Card className="shadow-sm">
          <CardContent className="p-3 space-y-2">
            <p className="text-xs text-muted-foreground mb-1">Positionen</p>
            {(inv?.items ?? []).map((item: any, idx: number) => (
              <div key={idx} className="flex justify-between text-sm">
                <span>{item?.quantity ?? 0}x {item?.name ?? ''}</span>
                <span className="font-mono">{formatCurrency((item?.unitPrice ?? 0) * (item?.quantity ?? 0))}</span>
              </div>
            ))}
            <div className="border-t pt-2 space-y-1 text-sm">
              <div className="flex justify-between"><span>Zwischensumme</span><span className="font-mono">{formatCurrency(inv?.subtotal ?? 0)}</span></div>
              {(inv?.travelCost ?? 0) > 0 && (
                <div className="flex justify-between"><span>Anfahrt</span><span className="font-mono">{formatCurrency(inv?.travelCost ?? 0)}</span></div>
              )}
              {(inv?.discount ?? 0) > 0 && (
                <div className="flex justify-between text-green-600"><span>Rabatt (Schutzbrief 10%)</span><span className="font-mono">-{formatCurrency(inv?.discount ?? 0)}</span></div>
              )}
              <div className="flex justify-between font-bold text-base border-t pt-1">
                <span>Gesamt</span><span className="font-mono">{formatCurrency(inv?.total ?? 0)}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Payment Info */}
        <Card className="shadow-sm">
          <CardContent className="p-3">
            <div className="flex items-center gap-2 text-sm">
              {inv?.paymentMethod === 'BAR' ? <Banknote className="w-4 h-4" /> : <CreditCard className="w-4 h-4" />}
              <span>Zahlungsart: {inv?.paymentMethod === 'BAR' ? 'Bar' : 'Karte'}</span>
            </div>
            {inv?.paidAt && (
              <p className="text-xs text-muted-foreground mt-1">Bezahlt am: {formatDateTime(inv?.paidAt)}</p>
            )}
            {inv?.emailSentAt && (
              <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                <Mail className="w-3 h-3" /> E-Mail gesendet am: {formatDateTime(inv?.emailSentAt)}
              </p>
            )}
            {(inv?.notes ?? '').trim() && (
              <p className="text-xs text-muted-foreground mt-2 italic">"{inv?.notes}"</p>
            )}
          </CardContent>
        </Card>

        {/* Storno info */}
        {inv?.status === 'STORNIERT' && inv?.cancelledAt && (
          <Card className="shadow-sm border-red-200 dark:border-red-800 bg-red-50/50 dark:bg-red-950/30">
            <CardContent className="p-3">
              <p className="text-xs font-medium text-red-700 dark:text-red-300 flex items-center gap-1"><XCircle className="w-3 h-3" /> Storniert am {formatDateTime(inv.cancelledAt)}</p>
              {inv.cancellationReason && <p className="text-xs text-muted-foreground mt-1">Grund: {inv.cancellationReason}</p>}
              {inv.cancelledByInvoiceId && (
                <Button variant="link" size="sm" className="text-xs p-0 h-auto mt-1" onClick={() => {
                  const stornoInv = invoices.find(i => i.id === inv.cancelledByInvoiceId);
                  if (stornoInv) { setSelectedInvoice(stornoInv); onViewInvoice(stornoInv.id); }
                }}>Stornorechnung anzeigen →</Button>
              )}
            </CardContent>
          </Card>
        )}
        {inv?.isCancellation && inv?.cancelsInvoiceId && (
          <Card className="shadow-sm border-purple-200 dark:border-purple-800 bg-purple-50/50 dark:bg-purple-950/30">
            <CardContent className="p-3">
              <p className="text-xs font-medium text-purple-700 dark:text-purple-300">Stornorechnung zu Originalrechnung:</p>
              <Button variant="link" size="sm" className="text-xs p-0 h-auto" onClick={() => {
                const origInv = invoices.find(i => i.id === inv.cancelsInvoiceId);
                if (origInv) { setSelectedInvoice(origInv); onViewInvoice(origInv.id); }
              }}>Originalrechnung anzeigen →</Button>
            </CardContent>
          </Card>
        )}

        {/* Cancel Dialog */}
        {showCancelDialog && (
          <Card className="shadow-sm border-red-300 dark:border-red-700">
            <CardContent className="p-4 space-y-3">
              <p className="text-sm font-semibold text-red-700 dark:text-red-300">Rechnung stornieren?</p>
              <p className="text-xs text-muted-foreground">Es wird automatisch eine Stornorechnung erstellt. Die Originalrechnung bleibt erhalten und wird als storniert markiert. Diese Aktion kann nicht rückgängig gemacht werden.</p>
              <Input
                placeholder="Storno-Grund (optional)"
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                className="text-sm"
              />
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => { setShowCancelDialog(false); setCancelReason(''); }} className="flex-1">Abbrechen</Button>
                <Button size="sm" onClick={() => handleCancel(inv?.id)} disabled={cancelling} className="flex-1 bg-red-600 hover:bg-red-700 text-white">
                  {cancelling ? 'Wird storniert...' : 'Stornieren'}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Actions */}
        <div className="space-y-2">
          {inv?.status === 'OFFEN' && !inv?.isCancellation && (
            <Button
              onClick={() => handleMarkPaid(inv?.id)}
              disabled={markingPaid}
              className="w-full gap-2 bg-green-600 hover:bg-green-700"
            >
              <CheckCircle2 className="w-4 h-4" />
              {markingPaid ? 'Wird markiert...' : 'Als bezahlt markieren'}
            </Button>
          )}
          <div className="grid grid-cols-2 gap-2">
            <Button
              variant="outline"
              onClick={() => handleDownloadPdf(inv?.id)}
              disabled={pdfLoading}
              className="gap-2"
            >
              <Download className="w-4 h-4" />
              {pdfLoading ? 'PDF...' : 'PDF'}
            </Button>
            <Button
              variant="outline"
              onClick={() => handleSendEmail(inv?.id)}
              disabled={emailLoading || !(inv?.customer?.email ?? '').trim()}
              className="gap-2"
            >
              <Send className="w-4 h-4" />
              {emailLoading ? 'Sende...' : 'E-Mail'}
            </Button>
          </div>
          {inv?.status !== 'STORNIERT' && !inv?.isCancellation && !showCancelDialog && (
            <Button
              variant="outline"
              onClick={() => setShowCancelDialog(true)}
              className="w-full gap-2 text-red-600 border-red-200 hover:bg-red-50 dark:border-red-800 dark:hover:bg-red-950"
            >
              <XCircle className="w-4 h-4" />
              Rechnung stornieren
            </Button>
          )}
        </div>
      </div>
    );
  }

  // List view
  return (
    <div className="p-4 space-y-3">
      <div className="flex items-center gap-2">
        <h2 className="font-display font-semibold text-lg flex-1">Rechnungen</h2>
      </div>

      {/* Filter */}
      <div className="flex gap-2 flex-wrap">
        {(['ALL', 'OFFEN', 'BEZAHLT', 'STORNIERT'] as const).map((f) => (
          <Button
            key={f}
            variant={filter === f ? 'default' : 'outline'}
            size="sm"
            onClick={() => setFilter(f)}
            className="text-xs"
          >
            {f === 'ALL' ? 'Alle' : f === 'OFFEN' ? 'Offen' : f === 'BEZAHLT' ? 'Bezahlt' : 'Storniert'}
          </Button>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center py-8"><div className="animate-spin w-6 h-6 border-2 border-primary border-t-transparent rounded-full" /></div>
      ) : filtered.length === 0 ? (
        <Card className="shadow-sm">
          <CardContent className="p-6 text-center">
            <FileText className="w-10 h-10 mx-auto text-muted-foreground mb-2" />
            <p className="text-sm text-muted-foreground">Keine Rechnungen vorhanden</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {filtered.map((inv: Invoice) => (
            <Card
              key={inv?.id}
              className="shadow-sm cursor-pointer hover:shadow-md transition-shadow"
              onClick={() => { setSelectedInvoice(inv); onViewInvoice(inv?.id); }}
            >
              <CardContent className="p-3 flex items-center gap-3">
                <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                  inv?.status === 'STORNIERT' ? 'bg-red-50 text-red-600 dark:bg-red-950 dark:text-red-400'
                  : inv?.status === 'BEZAHLT' ? 'bg-green-50 text-green-600 dark:bg-green-950 dark:text-green-400'
                  : 'bg-orange-50 text-orange-600 dark:bg-orange-950 dark:text-orange-400'
                }`}>
                  {inv?.status === 'STORNIERT' ? <XCircle className="w-5 h-5" />
                  : inv?.status === 'BEZAHLT' ? <CheckCircle2 className="w-5 h-5" />
                  : <Clock className="w-5 h-5" />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="font-mono text-sm font-medium">{inv?.invoiceNumber ?? ''}</p>
                    {inv?.paymentMethod === 'BAR'
                      ? <Banknote className="w-3 h-3 text-muted-foreground" />
                      : <CreditCard className="w-3 h-3 text-muted-foreground" />}
                  </div>
                  <p className="text-xs text-muted-foreground truncate">
                    {inv?.customer?.firstName ?? ''} {inv?.customer?.lastName ?? ''} · {formatDate(inv?.createdAt)}
                    {inv?.isCancellation && ' · Stornorechnung'}
                  </p>
                </div>
                <p className="font-mono font-bold">{formatCurrency(inv?.total ?? 0)}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
