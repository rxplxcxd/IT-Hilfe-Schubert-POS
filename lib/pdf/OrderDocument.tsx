import React from 'react';
import { Document, Page, View, Text, Image, StyleSheet } from '@react-pdf/renderer';

function formatDateTime(date: Date | string | null | undefined): string {
  if (!date) return '-';
  const d = new Date(date);
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const hh = String(d.getHours()).padStart(2, '0');
  const mi = String(d.getMinutes()).padStart(2, '0');
  return `${dd}.${mm}.${d.getFullYear()} ${hh}:${mi}`;
}

function statusLabel(status: string): string {
  if (status === 'ABGESCHLOSSEN') return 'Abgeschlossen';
  if (status === 'STORNIERT') return 'Storniert';
  if (status === 'IN_BEARBEITUNG') return 'In Bearbeitung';
  return 'Offen';
}

const styles = StyleSheet.create({
  page: { padding: 40, fontSize: 11, color: '#333', fontFamily: 'Helvetica', lineHeight: 1.4 },
  header: { flexDirection: 'row', justifyContent: 'space-between', borderBottomWidth: 2, borderBottomColor: '#1e40af', paddingBottom: 15, marginBottom: 20 },
  logo: { maxHeight: 60, maxWidth: 180, marginBottom: 4, objectFit: 'contain' },
  companyName: { fontSize: 16, fontFamily: 'Helvetica-Bold', color: '#1e40af' },
  company: { textAlign: 'right', fontSize: 10, color: '#555' },
  title: { fontSize: 18, fontFamily: 'Helvetica-Bold', color: '#1e40af', marginBottom: 6 },
  badge: { alignSelf: 'flex-start', paddingVertical: 3, paddingHorizontal: 10, borderRadius: 10, fontSize: 10, fontFamily: 'Helvetica-Bold', marginBottom: 12 },
  statusDone: { backgroundColor: '#dcfce7', color: '#166534' },
  statusCancelled: { backgroundColor: '#fee2e2', color: '#991b1b' },
  statusOpen: { backgroundColor: '#fef9c3', color: '#854d0e' },
  metaWrap: { flexDirection: 'row', gap: 10, marginBottom: 15 },
  metaBox: { flex: 1, backgroundColor: '#f8fafc', borderRadius: 6, padding: 10 },
  metaLabel: { fontSize: 9, color: '#666', textTransform: 'uppercase', marginBottom: 4 },
  bold: { fontFamily: 'Helvetica-Bold' },
  section: { marginVertical: 10 },
  sectionTitle: { fontSize: 12, color: '#1e40af', borderBottomWidth: 1, borderBottomColor: '#e2e8f0', paddingBottom: 4, marginBottom: 6, fontFamily: 'Helvetica-Bold' },
  disclaimer: { backgroundColor: '#fef3c7', borderWidth: 1, borderColor: '#f59e0b', borderRadius: 6, padding: 10, marginVertical: 12, fontSize: 10 },
  notes: { backgroundColor: '#f8fafc', borderRadius: 6, padding: 10, fontSize: 10 },
  signatureImg: { height: 50, marginTop: 4, objectFit: 'contain' },
  ok: { color: '#166534' },
  bad: { color: '#991b1b' },
  photos: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 6 },
  photo: { width: 110, height: 110, margin: 4, objectFit: 'cover', borderRadius: 6, borderWidth: 1, borderColor: '#ddd' },
  footer: { marginTop: 30, borderTopWidth: 1, borderTopColor: '#e2e8f0', paddingTop: 10, fontSize: 9, color: '#888', textAlign: 'center' },
});

interface Props {
  order: any;
  settings: any;
}

export function OrderDocument({ order, settings }: Props) {
  const s = settings || {};
  const photos: any[] = order?.photos ?? [];
  const disclaimerText = order?.disclaimerText || s.disclaimerDefaultText || '';
  const statusStyle =
    order?.status === 'ABGESCHLOSSEN' ? styles.statusDone :
    order?.status === 'STORNIERT' ? styles.statusCancelled : styles.statusOpen;

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          <View>
            {(s.logoPath ?? '').trim() ? <Image style={styles.logo} src={s.logoPath} /> : null}
            <Text style={styles.companyName}>{s.companyName ?? 'IT-Hilfe Schubert'}</Text>
          </View>
          <View>
            <Text style={styles.company}>{s.ownerName ?? ''}</Text>
            <Text style={styles.company}>{s.street ?? ''}</Text>
            <Text style={styles.company}>{s.zip ?? ''} {s.city ?? ''}</Text>
            <Text style={styles.company}>{s.phone ?? ''}</Text>
            <Text style={styles.company}>{s.email ?? ''}</Text>
          </View>
        </View>

        <Text style={styles.title}>Auftragsprotokoll {order?.orderNumber ?? ''}</Text>
        <Text style={[styles.badge, statusStyle]}>{statusLabel(order?.status ?? 'OFFEN')}</Text>

        <View style={styles.metaWrap}>
          <View style={styles.metaBox}>
            <Text style={styles.metaLabel}>Kunde</Text>
            <Text style={styles.bold}>{order?.customer?.firstName ?? ''} {order?.customer?.lastName ?? ''}</Text>
            <Text>{order?.customer?.street ?? ''} {order?.customer?.houseNr ?? ''}</Text>
            <Text>{order?.customer?.zip ?? ''} {order?.customer?.city ?? ''}</Text>
            <Text>{order?.customer?.phone ?? ''}</Text>
          </View>
          <View style={styles.metaBox}>
            <Text style={styles.metaLabel}>Auftragsdaten</Text>
            <Text>Erstellt: {formatDateTime(order?.createdAt)}</Text>
            {order?.startedAt ? <Text>Gestartet: {formatDateTime(order.startedAt)}</Text> : null}
            {order?.completedAt ? <Text>Abgeschlossen: {formatDateTime(order.completedAt)}</Text> : null}
            {order?.routeDistanceKm ? <Text>Anfahrt: {order.routeDistanceKm} km ({order.routeDurationMin} Min.)</Text> : null}
          </View>
        </View>

        {order?.title ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Auftrag</Text>
            <Text style={styles.bold}>{order.title}</Text>
            {order?.description ? <Text>{order.description}</Text> : null}
          </View>
        ) : null}

        {disclaimerText ? (
          <View style={styles.disclaimer}>
            <Text style={styles.bold}>Haftungsausschluss</Text>
            <Text>{disclaimerText}</Text>
            {order?.liabilitySigned ? (
              <View>
                <Text style={styles.ok}>Unterschrieben am {order?.liabilitySignedAt ? formatDateTime(order.liabilitySignedAt) : '-'}</Text>
                {(order?.liabilitySignature ?? '').trim() ? <Image style={styles.signatureImg} src={order.liabilitySignature} /> : null}
              </View>
            ) : (
              <Text style={styles.bad}>Nicht unterschrieben</Text>
            )}
          </View>
        ) : null}

        {order?.workNotes ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Arbeitsbericht</Text>
            <View style={styles.notes}><Text>{order.workNotes}</Text></View>
          </View>
        ) : null}

        {photos.length > 0 ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Fotodokumentation</Text>
            <View style={styles.photos}>
              {photos.map((p, idx) => (
                (p?.fileUrl ?? '').trim() ? <Image key={idx} style={styles.photo} src={p.fileUrl} /> : null
              ))}
            </View>
          </View>
        ) : null}

        {order?.handoverSigned ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Uebergabeprotokoll</Text>
            <Text>Der Kunde bestaetigt, das Geraet funktionierend und vollstaendig zurueckerhalten zu haben.</Text>
            <Text style={styles.ok}>Unterschrieben am {order?.handoverSignedAt ? formatDateTime(order.handoverSignedAt) : '-'}</Text>
            {(order?.handoverSignature ?? '').trim() ? <Image style={styles.signatureImg} src={order.handoverSignature} /> : null}
          </View>
        ) : null}

        {order?.completionNotes ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Abschluss-Notizen</Text>
            <View style={styles.notes}><Text>{order.completionNotes}</Text></View>
          </View>
        ) : null}

        <View style={styles.footer}>
          <Text>{s.companyName ?? 'IT-Hilfe Schubert'} - {s.ownerName ?? ''} - {s.street ?? ''}, {s.zip ?? ''} {s.city ?? ''} - {s.phone ?? ''}</Text>
        </View>
      </Page>
    </Document>
  );
}
