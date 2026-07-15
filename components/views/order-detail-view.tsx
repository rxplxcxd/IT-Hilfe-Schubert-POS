'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  ArrowLeft, Play, CheckCircle2, Camera, FileText, AlertTriangle,
  MapPin, Navigation, Clock, Save, Plus, X, Trash2, Upload, ChevronDown, ChevronUp, Car, XCircle, Download, Zap, Mail
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { formatDateTime, getZoneFromKm, getZoneLabel } from '@/lib/utils';
import { SignaturePad } from '@/components/signature-pad';

interface OrderPhoto {
  id: number; fileUrl: string; caption: string; photoType: string; createdAt: string;
}
interface Order {
  id: number; orderNumber: string; customerId: number; customer: any;
  status: string; title: string; description: string;
  liabilitySignature: string; liabilitySigned: boolean; liabilitySignedAt: string | null;
  customDocuments: string; startedAt: string | null;
  workNotes: string; photos: OrderPhoto[];
  completedAt: string | null; completionNotes: string;
  handoverSignature: string; handoverSigned: boolean; handoverSignedAt: string | null;
  routeStartAddress: string; routeDistanceKm: number; routeDurationMin: number;
  convertedInvoiceId: number | null;
  createdAt: string; updatedAt: string;
}
interface CustomDoc { name: string; signed: boolean; signedAt: string | null; }

export function OrderDetailView({ orderId, onBack }: { orderId: number; onBack: () => void }) {
  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [workNotes, setWorkNotes] = useState('');
  const [completionNotes, setCompletionNotes] = useState('');
  const [newDocName, setNewDocName] = useState('');
  const [routeStart, setRouteStart] = useState('');
  const [showCancelDialog, setShowCancelDialog] = useState(false);
  const [cancelReason, setCancelReason] = useState('');
  const [generatingPdf, setGeneratingPdf] = useState(false);
  const [sendingEmail, setSendingEmail] = useState(false);
  const [routeKm, setRouteKm] = useState('');
  const [routeMin, setRouteMin] = useState('');
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [elapsed, setElapsed] = useState('');
  const [showRoute, setShowRoute] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchOrder = useCallback(async () => {
    try {
      const res = await fetch(`/api/orders/${orderId}`);
      const data = await res.json();
      setOrder(data);
      setWorkNotes(data.workNotes || '');
      setCompletionNotes(data.completionNotes || '');
      setRouteStart(data.routeStartAddress || '');
      setRouteKm(String(data.routeDistanceKm || ''));
      setRouteMin(String(data.routeDurationMin || ''));
    } catch (e: any) { console.error(e); toast.error('Fehler beim Laden'); }
    finally { setLoading(false); }
  }, [orderId]);

  useEffect(() => { fetchOrder(); }, [fetchOrder]);

  // Live timer
  useEffect(() => {
    if (order?.status === 'IN_BEARBEITUNG' && order.startedAt) {
      const update = () => {
        const diff = Date.now() - new Date(order.startedAt!).getTime();
        const h = Math.floor(diff / 3600000);
        const m = Math.floor((diff % 3600000) / 60000);
        const s = Math.floor((diff % 60000) / 1000);
        setElapsed(`${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`);
      };
      update();
      timerRef.current = setInterval(update, 1000);
      return () => { if (timerRef.current) clearInterval(timerRef.current); };
    }
  }, [order?.status, order?.startedAt]);

  const updateOrder = async (data: any) => {
    setSaving(true);
    try {
      const res = await fetch(`/api/orders/${orderId}`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error('Fehler');
      const updated = await res.json();
      setOrder(updated);
      setWorkNotes(updated.workNotes || '');
      setCompletionNotes(updated.completionNotes || '');
      return updated;
    } catch (e: any) { toast.error(e.message); return null; }
    finally { setSaving(false); }
  };

  const getCustomDocs = (): CustomDoc[] => {
    try { return JSON.parse(order?.customDocuments || '[]'); } catch { return []; }
  };

  const handleLiabilitySign = async (dataUrl: string) => {
    if (!dataUrl) return;
    await updateOrder({ liabilitySignature: dataUrl, liabilitySigned: true, liabilitySignedAt: new Date().toISOString() });
    toast.success('Haftungsausschluss unterschrieben');
  };

  const handleHandoverSign = async (dataUrl: string) => {
    if (!dataUrl) return;
    await updateOrder({ handoverSignature: dataUrl, handoverSigned: true, handoverSignedAt: new Date().toISOString() });
    toast.success('Übergabeprotokoll unterschrieben');
  };

  const addCustomDoc = async () => {
    if (!newDocName.trim()) return;
    const docs = getCustomDocs();
    docs.push({ name: newDocName.trim(), signed: false, signedAt: null });
    await updateOrder({ customDocuments: JSON.stringify(docs) });
    setNewDocName('');
    toast.success('Dokument hinzugefügt');
  };

  const removeCustomDoc = async (idx: number) => {
    const docs = getCustomDocs();
    docs.splice(idx, 1);
    await updateOrder({ customDocuments: JSON.stringify(docs) });
  };

  const toggleCustomDoc = async (idx: number) => {
    const docs = getCustomDocs();
    docs[idx].signed = !docs[idx].signed;
    docs[idx].signedAt = docs[idx].signed ? new Date().toISOString() : null;
    await updateOrder({ customDocuments: JSON.stringify(docs) });
  };

  const handleStartOrder = async () => {
    if (!order?.liabilitySigned) {
      toast.error('Haftungsausschluss muss zuerst unterschrieben werden!');
      return;
    }
    await updateOrder({ status: 'IN_BEARBEITUNG', startedAt: new Date().toISOString() });
    toast.success('Auftrag gestartet!');
  };

  const handleCompleteOrder = async () => {
    if (!order?.handoverSigned) {
      toast.error('Übergabe-Quittung muss zuerst unterschrieben werden!');
      return;
    }
    await updateOrder({
      status: 'ABGESCHLOSSEN',
      completedAt: new Date().toISOString(),
      completionNotes,
      routeDistanceKm: parseFloat(routeKm) || 0,
      routeDurationMin: parseInt(routeMin) || 0,
      routeStartAddress: routeStart,
    });
    toast.success('Auftrag abgeschlossen!');
  };

  const saveWorkNotes = async () => {
    await updateOrder({ workNotes });
    toast.success('Notizen gespeichert');
  };

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !order) return;
    setUploadingPhoto(true);
    try {
      const presignRes = await fetch('/api/upload/presigned', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fileName: `order-${order.id}-${Date.now()}-${file.name}`, contentType: file.type, isPublic: true }),
      });
      const { uploadUrl, cloud_storage_path } = await presignRes.json();
      await fetch(uploadUrl, {
        method: 'PUT', body: file,
        headers: { 'Content-Type': file.type, 'Content-Disposition': 'attachment' },
      });
      const completeRes = await fetch('/api/upload/complete', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cloud_storage_path, isPublic: true }),
      });
      const { fileUrl } = await completeRes.json();
      await fetch(`/api/orders/${order.id}/photos`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: fileUrl, filePath: cloud_storage_path, caption: '', photoType: 'ARBEIT' }),
      });
      await fetchOrder();
      toast.success('Foto hochgeladen');
    } catch (e: any) { toast.error('Upload fehlgeschlagen'); console.error(e); }
    finally { setUploadingPhoto(false); if (fileInputRef.current) fileInputRef.current.value = ''; }
  };

  const deletePhoto = async (photoId: number) => {
    if (!confirm('Foto löschen?')) return;
    await fetch(`/api/orders/${orderId}/photos?photoId=${photoId}`, { method: 'DELETE' });
    await fetchOrder();
    toast.success('Foto gelöscht');
  };

  const openGoogleMaps = () => {
    if (!order?.customer) return;
    const c = order.customer;
    const dest = encodeURIComponent(`${c.street} ${c.houseNr}, ${c.zip} ${c.city}`);
    const origin = routeStart ? encodeURIComponent(routeStart) : '';
    const url = origin
      ? `https://www.google.com/maps/dir/?api=1&origin=${origin}&destination=${dest}&travelmode=driving`
      : `https://www.google.com/maps/dir/?api=1&destination=${dest}&travelmode=driving`;
    window.open(url, '_blank');
  };

  const requestCurrentLocation = () => {
    if (!navigator.geolocation) { toast.error('GPS nicht verfügbar'); return; }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setRouteStart(`${pos.coords.latitude},${pos.coords.longitude}`);
        toast.success('Standort ermittelt');
      },
      () => toast.error('Standort konnte nicht ermittelt werden'),
      { enableHighAccuracy: true }
    );
  };

  if (loading) return <div className="flex justify-center py-12"><div className="animate-spin w-6 h-6 border-2 border-primary border-t-transparent rounded-full" /></div>;
  if (!order) return <div className="p-4 text-center text-muted-foreground">Auftrag nicht gefunden</div>;

  const customDocs = getCustomDocs();
  const isOpen = order.status === 'OFFEN';
  const isActive = order.status === 'IN_BEARBEITUNG';
  const isDone = order.status === 'ABGESCHLOSSEN';
  const isCancelled = order.status === 'STORNIERT';

  const statusColor = isCancelled ? 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400'
    : isOpen ? 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400'
    : isActive ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400'
    : 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400';
  const statusLabel = isCancelled ? 'Storniert' : isOpen ? 'Offen' : isActive ? 'In Bearbeitung' : 'Abgeschlossen';

  return (
    <div className="p-4 space-y-4 pb-8">
      {/* Header */}
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon" onClick={onBack}><ArrowLeft className="w-5 h-5" /></Button>
        <div className="flex-1">
          <h2 className="font-display font-semibold text-lg">{order.orderNumber}</h2>
          <p className="text-xs text-muted-foreground">{order.customer.firstName} {order.customer.lastName}</p>
        </div>
        <span className={`text-xs px-2 py-1 rounded-full font-medium ${statusColor}`}>{statusLabel}</span>
      </div>

      {/* Title */}
      {order.title && <p className="text-sm font-medium">{order.title}</p>}
      {order.description && <p className="text-xs text-muted-foreground">{order.description}</p>}

      {/* Live Timer */}
      {isActive && (
        <Card className="border-blue-200 dark:border-blue-800 bg-blue-50/50 dark:bg-blue-950/20 shadow-sm">
          <CardContent className="p-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Clock className="w-5 h-5 text-blue-600 dark:text-blue-400" />
              <span className="text-sm text-muted-foreground">Laufzeit</span>
            </div>
            <span className="font-mono text-2xl font-bold text-blue-700 dark:text-blue-300">{elapsed}</span>
          </CardContent>
        </Card>
      )}

      {isDone && order.startedAt && order.completedAt && (
        <Card className="border-green-200 dark:border-green-800 bg-green-50/50 dark:bg-green-950/20 shadow-sm">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <CheckCircle2 className="w-5 h-5 text-green-600 dark:text-green-400" />
              <span className="text-sm font-medium">Abgeschlossen</span>
            </div>
            <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
              <div>Gestartet: {formatDateTime(order.startedAt)}</div>
              <div>Beendet: {formatDateTime(order.completedAt)}</div>
              <div className="col-span-2">Dauer: {(() => {
                const diff = new Date(order.completedAt).getTime() - new Date(order.startedAt).getTime();
                const h = Math.floor(diff / 3600000);
                const m = Math.floor((diff % 3600000) / 60000);
                return `${h}h ${m}min`;
              })()}</div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ===== PHASE 1: Vorbereitung ===== */}
      {/* Storno Banner */}
      {isCancelled && (
        <Card className="border-red-200 dark:border-red-800 bg-red-50/50 dark:bg-red-950/20 shadow-sm">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <XCircle className="w-5 h-5 text-red-600 dark:text-red-400" />
              <span className="font-semibold text-sm text-red-700 dark:text-red-400">Dieser Auftrag wurde storniert</span>
            </div>
            {(order as any).cancellationReason && (
              <p className="text-xs text-red-600 dark:text-red-400 ml-7">Grund: {(order as any).cancellationReason}</p>
            )}
            {(order as any).cancelledAt && (
              <p className="text-xs text-muted-foreground ml-7">Storniert am {formatDateTime((order as any).cancelledAt)}</p>
            )}
          </CardContent>
        </Card>
      )}

      {(isOpen || isActive || isDone) && (
        <Card className="shadow-sm">
          <CardContent className="p-4 space-y-4">
            <h3 className="font-display font-semibold text-sm flex items-center gap-2">
              <FileText className="w-4 h-4" /> Phase 1: Vorab-Absicherung
            </h3>

            {/* Pflicht: Haftungsausschluss */}
            <div className={`p-3 rounded-lg border-2 ${
              order.liabilitySigned
                ? 'border-green-300 bg-green-50/50 dark:border-green-700 dark:bg-green-950/20'
                : 'border-red-300 bg-red-50/50 dark:border-red-700 dark:bg-red-950/20'
            }`}>
              <div className="flex items-start gap-2 mb-2">
                {order.liabilitySigned
                  ? <CheckCircle2 className="w-4 h-4 text-green-600 dark:text-green-400 mt-0.5" />
                  : <AlertTriangle className="w-4 h-4 text-red-600 dark:text-red-400 mt-0.5" />
                }
                <div>
                  <p className="text-sm font-medium">Haftungsausschluss & Datensicherungs-Bestätigung</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {(order as any).disclaimerText || 'Der Kunde bestätigt, dass ein aktuelles Backup aller relevanten Daten existiert. Für etwaige Datenverluste während der Reparatur/Wartung wird keine Haftung übernommen. Der Kunde trägt das volle Risiko für nicht gesicherte Daten.'}
                  </p>
                </div>
              </div>
              {order.liabilitySigned ? (
                <div className="mt-2">
                  <p className="text-xs text-green-700 dark:text-green-400 mb-1">Unterschrieben am {order.liabilitySignedAt ? formatDateTime(order.liabilitySignedAt) : '-'}</p>
                  {order.liabilitySignature && (
                    <div className="bg-white dark:bg-gray-900 rounded border p-1 inline-block">
                      <img src={order.liabilitySignature} alt="Unterschrift" className="h-16" />
                    </div>
                  )}
                </div>
              ) : (
                <SignaturePad
                  onSave={handleLiabilitySign}
                  disabled={!isOpen}
                  label="Kundenunterschrift"
                />
              )}
            </div>

            {/* Optionale Dokumente */}
            <div className="space-y-2">
              <p className="text-xs font-medium text-muted-foreground">Optionale Dokumente</p>
              {customDocs.map((doc, idx) => (
                <div key={idx} className="flex items-center gap-2 p-2 bg-muted/50 rounded-lg">
                  <button onClick={() => !isDone && toggleCustomDoc(idx)} className="shrink-0">
                    <div className={`w-5 h-5 rounded border-2 flex items-center justify-center ${
                      doc.signed ? 'bg-green-500 border-green-500 text-white' : 'border-muted-foreground/30'
                    }`}>
                      {doc.signed && <CheckCircle2 className="w-3 h-3" />}
                    </div>
                  </button>
                  <span className="text-sm flex-1">{doc.name}</span>
                  {doc.signed && <span className="text-[10px] text-muted-foreground">{doc.signedAt ? formatDateTime(doc.signedAt) : ''}</span>}
                  {!isDone && (
                    <button onClick={() => removeCustomDoc(idx)} className="text-destructive">
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              ))}
              {!isDone && (
                <div className="flex gap-2">
                  <Input
                    value={newDocName}
                    onChange={(e) => setNewDocName(e.target.value)}
                    placeholder="Neues Dokument hinzufügen..."
                    className="text-sm"
                    onKeyDown={(e) => e.key === 'Enter' && addCustomDoc()}
                  />
                  <Button size="icon" variant="outline" onClick={addCustomDoc} disabled={!newDocName.trim()}>
                    <Plus className="w-4 h-4" />
                  </Button>
                </div>
              )}
            </div>

            {/* Start Button */}
            {isOpen && (
              <div className="space-y-2">
                {!order.liabilitySigned && (
                  <div className="flex items-center gap-2 p-2 bg-red-50 dark:bg-red-950/30 rounded-lg border border-red-200 dark:border-red-800">
                    <AlertTriangle className="w-4 h-4 text-red-500" />
                    <p className="text-xs text-red-700 dark:text-red-400">Haftungsausschluss muss vor Arbeitsbeginn unterschrieben werden!</p>
                  </div>
                )}
                <Button
                  onClick={handleStartOrder}
                  className="w-full gap-2 h-12 text-base"
                  disabled={saving}
                >
                  <Play className="w-5 h-5" /> Auftrag starten
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* ===== PHASE 2: Live-Dokumentation ===== */}
      {(isActive || isDone) && (
        <Card className="shadow-sm">
          <CardContent className="p-4 space-y-4">
            <h3 className="font-display font-semibold text-sm flex items-center gap-2">
              <Camera className="w-4 h-4" /> Phase 2: Arbeitsdokumentation
            </h3>

            {/* Arbeitsnotizen */}
            <div>
              <Label className="text-xs">Arbeitsbericht / Notizen</Label>
              <textarea
                value={workNotes}
                onChange={(e) => setWorkNotes(e.target.value)}
                className="w-full mt-1 p-2 text-sm border border-input rounded-md bg-background min-h-[100px] resize-y"
                placeholder="Arbeitsschritte dokumentieren..."
                disabled={isDone}
              />
              {isActive && (
                <Button size="sm" variant="outline" className="mt-1 gap-1" onClick={saveWorkNotes} disabled={saving}>
                  <Save className="w-3 h-3" /> Speichern
                </Button>
              )}
            </div>

            {/* Fotos */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <Label className="text-xs">Fotos</Label>
                {isActive && (
                  <Button size="sm" variant="outline" className="gap-1 h-7" onClick={() => fileInputRef.current?.click()} disabled={uploadingPhoto}>
                    <Camera className="w-3 h-3" /> {uploadingPhoto ? 'Lädt...' : 'Foto aufnehmen'}
                  </Button>
                )}
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                capture="environment"
                onChange={handlePhotoUpload}
                className="hidden"
              />
              {(order.photos?.length ?? 0) > 0 ? (
                <div className="grid grid-cols-3 gap-2">
                  {order.photos.map((p) => (
                    <div key={p.id} className="relative group">
                      <div className="aspect-square rounded-lg overflow-hidden bg-muted">
                        <img src={p.fileUrl} alt={p.caption || 'Foto'} className="w-full h-full object-cover" />
                      </div>
                      {isActive && (
                        <button onClick={() => deletePhoto(p.id)}
                          className="absolute top-1 right-1 bg-red-500 text-white rounded-full w-5 h-5 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                          <X className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-muted-foreground text-center py-4">Noch keine Fotos</p>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* ===== ROUTE / FAHRTENBUCH ===== */}
      {(isActive || isDone) && (
        <Card className="shadow-sm">
          <CardContent className="p-4 space-y-3">
            <button className="w-full flex items-center justify-between" onClick={() => setShowRoute(!showRoute)}>
              <h3 className="font-display font-semibold text-sm flex items-center gap-2">
                <Car className="w-4 h-4" /> Route & Fahrtenbuch
              </h3>
              {showRoute ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>

            {showRoute && (
              <div className="space-y-3">
                <div>
                  <Label className="text-xs">Startadresse</Label>
                  <div className="flex gap-2 mt-1">
                    <Input
                      value={routeStart}
                      onChange={(e) => setRouteStart(e.target.value)}
                      placeholder="GPS oder Adresse..."
                      className="text-sm flex-1"
                      disabled={isDone}
                    />
                    {!isDone && (
                      <Button size="icon" variant="outline" onClick={requestCurrentLocation} title="GPS-Standort">
                        <Navigation className="w-4 h-4" />
                      </Button>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <MapPin className="w-3.5 h-3.5" />
                  <span>Ziel: {order.customer.street} {order.customer.houseNr}, {order.customer.zip} {order.customer.city}</span>
                </div>
                <Button variant="outline" className="w-full gap-2" onClick={openGoogleMaps}>
                  <Navigation className="w-4 h-4" /> Route in Google Maps öffnen
                </Button>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs">Kilometer</Label>
                    <Input
                      type="number"
                      step="0.1"
                      value={routeKm}
                      onChange={(e) => setRouteKm(e.target.value)}
                      placeholder="km"
                      className="text-sm mt-1"
                      disabled={isDone}
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Fahrzeit (Min.)</Label>
                    <Input
                      type="number"
                      value={routeMin}
                      onChange={(e) => setRouteMin(e.target.value)}
                      placeholder="min"
                      className="text-sm mt-1"
                      disabled={isDone}
                    />
                  </div>
                </div>
                {!isDone && (
                  <Button size="sm" variant="outline" className="gap-1" onClick={async () => {
                    await updateOrder({ routeStartAddress: routeStart, routeDistanceKm: parseFloat(routeKm) || 0, routeDurationMin: parseInt(routeMin) || 0 });
                    toast.success('Route gespeichert');
                  }} disabled={saving}>
                    <Save className="w-3 h-3" /> Route speichern
                  </Button>
                )}
                {isDone && order.routeDistanceKm > 0 && (
                  <div className="p-2 bg-muted/50 rounded-lg text-xs">
                    <p>📍 Gefahren: <strong>{order.routeDistanceKm} km</strong> in {order.routeDurationMin} Min.</p>
                  </div>
                )}
                {/* Auto-Zone Suggestion */}
                {!isDone && parseFloat(routeKm) > 0 && (
                  <div className="p-2 bg-blue-50 dark:bg-blue-950/30 rounded-lg border border-blue-200 dark:border-blue-800">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Zap className="w-3.5 h-3.5 text-blue-600" />
                        <span className="text-xs">Empfohlene Zone: <strong>{getZoneLabel(getZoneFromKm(parseFloat(routeKm)))}</strong></span>
                      </div>
                      <Button size="sm" variant="outline" className="h-6 text-[10px] gap-1" onClick={async () => {
                        const zone = getZoneFromKm(parseFloat(routeKm));
                        try {
                          await fetch(`/api/customers/${order.customerId}`, {
                            method: 'PUT', headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ zone })
                          });
                          toast.success(`Kundenzone auf ${getZoneLabel(zone)} aktualisiert`);
                        } catch { toast.error('Fehler beim Aktualisieren'); }
                      }}>
                        Übernehmen
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* ===== PHASE 3: Abschluss ===== */}
      {isActive && (
        <Card className="shadow-sm border-green-200 dark:border-green-800">
          <CardContent className="p-4 space-y-4">
            <h3 className="font-display font-semibold text-sm flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4" /> Phase 3: Auftragsabschluss
            </h3>

            <div>
              <Label className="text-xs">Abschluss-Notizen</Label>
              <textarea
                value={completionNotes}
                onChange={(e) => setCompletionNotes(e.target.value)}
                className="w-full mt-1 p-2 text-sm border border-input rounded-md bg-background min-h-[60px] resize-y"
                placeholder="Zusammenfassung der Arbeiten..."
              />
            </div>

            {/* Übergabeprotokoll */}
            <div className={`p-3 rounded-lg border-2 ${
              order.handoverSigned
                ? 'border-green-300 bg-green-50/50 dark:border-green-700 dark:bg-green-950/20'
                : 'border-amber-300 bg-amber-50/50 dark:border-amber-700 dark:bg-amber-950/20'
            }`}>
              <p className="text-sm font-medium mb-1">Geräteübergabe – Ausgang</p>
              <p className="text-xs text-muted-foreground mb-3">
                Der Kunde bestätigt, das Gerät funktionierend und vollständig zurückerhalten zu haben
                und mit der erbrachten Leistung zufrieden zu sein.
              </p>
              {order.handoverSigned ? (
                <div>
                  <p className="text-xs text-green-700 dark:text-green-400 mb-1">Unterschrieben am {order.handoverSignedAt ? formatDateTime(order.handoverSignedAt) : '-'}</p>
                  {order.handoverSignature && (
                    <div className="bg-white dark:bg-gray-900 rounded border p-1 inline-block">
                      <img src={order.handoverSignature} alt="Unterschrift" className="h-16" />
                    </div>
                  )}
                </div>
              ) : (
                <SignaturePad onSave={handleHandoverSign} label="Kundenunterschrift" />
              )}
            </div>

            <Button
              onClick={handleCompleteOrder}
              className="w-full gap-2 h-12 text-base bg-green-600 hover:bg-green-700"
              disabled={saving}
            >
              <CheckCircle2 className="w-5 h-5" /> Auftrag abschließen
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Storno Button */}
      {(isOpen || isActive) && !showCancelDialog && (
        <Button
          variant="outline"
          className="w-full gap-2 border-red-300 text-red-600 hover:bg-red-50 dark:border-red-800 dark:text-red-400 dark:hover:bg-red-950/30"
          onClick={() => setShowCancelDialog(true)}
        >
          <XCircle className="w-4 h-4" /> Auftrag stornieren
        </Button>
      )}

      {/* Cancel Dialog */}
      {showCancelDialog && (
        <Card className="border-red-200 dark:border-red-800 shadow-sm">
          <CardContent className="p-4 space-y-3">
            <h3 className="font-display font-semibold text-sm text-red-700 dark:text-red-400">Auftrag stornieren</h3>
            <div>
              <Label className="text-xs">Stornogrund (optional)</Label>
              <textarea
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                className="w-full mt-1 p-2 text-sm border border-input rounded-md bg-background min-h-[60px] resize-y"
                placeholder="Grund für die Stornierung..."
              />
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => { setShowCancelDialog(false); setCancelReason(''); }}
              >
                Abbrechen
              </Button>
              <Button
                className="flex-1 bg-red-600 hover:bg-red-700 text-white"
                disabled={saving}
                onClick={async () => {
                  setSaving(true);
                  try {
                    const res = await fetch(`/api/orders/${order.id}`, {
                      method: 'PUT',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({
                        status: 'STORNIERT',
                        cancelledAt: new Date().toISOString(),
                        cancellationReason: cancelReason || undefined
                      })
                    });
                    if (!res.ok) throw new Error('Fehler beim Stornieren');
                    toast.success('Auftrag wurde storniert');
                    setShowCancelDialog(false);
                    fetchOrder();
                  } catch (e) {
                    toast.error('Stornierung fehlgeschlagen');
                  } finally { setSaving(false); }
                }}
              >
                Endgültig stornieren
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* PDF Export */}
      {isDone && (
        <Button
          variant="outline"
          className="w-full gap-2"
          disabled={generatingPdf}
          onClick={async () => {
            setGeneratingPdf(true);
            try {
              const res = await fetch(`/api/orders/${order.id}/pdf`, { method: 'POST' });
              if (!res.ok) throw new Error('PDF-Fehler');
              const blob = await res.blob();
              const url = URL.createObjectURL(blob);
              const a = document.createElement('a');
              a.href = url;
              a.download = `${order.orderNumber}.pdf`;
              a.click();
              URL.revokeObjectURL(url);
              toast.success('PDF heruntergeladen');
            } catch { toast.error('PDF-Erstellung fehlgeschlagen'); }
            finally { setGeneratingPdf(false); }
          }}
        >
          <Download className="w-4 h-4" /> {generatingPdf ? 'PDF wird erstellt...' : 'Auftragsprotokoll als PDF'}
        </Button>
      )}

      {/* Beleg per E-Mail senden */}
      {isDone && (
        <Button
          variant="outline"
          className="w-full gap-2"
          disabled={sendingEmail}
          onClick={async () => {
            setSendingEmail(true);
            try {
              const res = await fetch(`/api/orders/${order.id}/email`, { method: 'POST' });
              const data = await res.json().catch(() => ({}));
              if (!res.ok) throw new Error(data?.error || 'E-Mail-Fehler');
              toast.success('Beleg per E-Mail gesendet (PDF im Anhang)');
            } catch (e: any) { toast.error(e?.message || 'E-Mail-Versand fehlgeschlagen'); }
            finally { setSendingEmail(false); }
          }}
        >
          <Mail className="w-4 h-4" /> {sendingEmail ? 'E-Mail wird gesendet...' : 'Beleg per E-Mail senden (PDF)'}
        </Button>
      )}

      {/* Completed handover display */}
      {isDone && order.handoverSigned && (
        <Card className="shadow-sm border-green-200 dark:border-green-800">
          <CardContent className="p-4 space-y-2">
            <h3 className="font-display font-semibold text-sm flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-green-600" /> Übergabeprotokoll
            </h3>
            <p className="text-xs text-muted-foreground">Der Kunde bestätigt, das Gerät funktionierend und vollständig zurückerhalten zu haben.</p>
            <p className="text-xs text-green-700 dark:text-green-400">Unterschrieben am {order.handoverSignedAt ? formatDateTime(order.handoverSignedAt) : '-'}</p>
            {order.handoverSignature && (
              <div className="bg-white dark:bg-gray-900 rounded border p-1 inline-block">
                <img src={order.handoverSignature} alt="Unterschrift" className="h-16" />
              </div>
            )}
            {order.completionNotes && <p className="text-sm mt-2">{order.completionNotes}</p>}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
