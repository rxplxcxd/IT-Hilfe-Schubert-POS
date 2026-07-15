import React from 'react';
import { Document, Page, View, Text, Image, StyleSheet } from '@react-pdf/renderer';

function euro(n: number): string {
  return (Number(n) || 0)
    .toFixed(2)
    .replace('.', ',')
    .replace(/\B(?=(\d{3})+(?!\d))/g, '.') + ' \u20ac';
}

function formatDateDE(date: Date | string | null | undefined): string {
  if (!date) return '-';
  const d = new Date(date);
  return `${String(d.getDate()).padStart(2, '0')}.${String(d.getMonth() + 1).padStart(2, '0')}.${d.getFullYear()}`;
}

const styles = StyleSheet.create({
  page: { padding: 40, fontSize: 10, color: '#1a1a1a', fontFamily: 'Helvetica', lineHeight: 1.5 },
  header: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 30 },
  logo: { maxHeight: 60, maxWidth: 200, marginBottom: 6, objectFit: 'contain' },
  companyName: { fontSize: 16, fontFamily: 'Helvetica-Bold', color: '#1e40af', marginBottom: 4 },
  company: { fontSize: 9, color: '#666' },
  right: { alignItems: 'flex-end' },
  invoiceTitle: { fontSize: 22, fontFamily: 'Helvetica-Bold', color: '#1e40af', marginBottom: 8 },
  badgeRow: { flexDirection: 'row', marginTop: 6 },
  badge: { fontSize: 8, paddingVertical: 2, paddingHorizontal: 6, borderRadius: 3, marginLeft: 4 },
  badgeBar: { backgroundColor: '#e8f5e9', color: '#2e7d32' },
  badgeKarte: { backgroundColor: '#e3f2fd', color: '#1565c0' },
  badgeOffen: { backgroundColor: '#fff3e0', color: '#ef6c00' },
  badgeBezahlt: { backgroundColor: '#e8f5e9', color: '#2e7d32' },
  headerBox: { marginBottom: 15, fontSize: 9, color: '#333' },
  meta: { marginBottom: 20 },
  metaLabel: { fontSize: 8, textTransform: 'uppercase', color: '#888', letterSpacing: 0.5, marginBottom: 2 },
  bold: { fontFamily: 'Helvetica-Bold' },
  table: { marginBottom: 20 },
  tableHead: { flexDirection: 'row', backgroundColor: '#f0f4ff', borderBottomWidth: 2, borderBottomColor: '#1e40af' },
  th: { color: '#1e40af', paddingVertical: 6, paddingHorizontal: 8, fontSize: 9, fontFamily: 'Helvetica-Bold' },
  row: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: '#eee' },
  td: { paddingVertical: 6, paddingHorizontal: 8, fontSize: 9 },
  cPos: { width: '10%' },
  cDesc: { width: '42%' },
  cQty: { width: '13%', textAlign: 'right' },
  cPrice: { width: '17%', textAlign: 'right' },
  cTotal: { width: '18%', textAlign: 'right' },
  totals: { marginLeft: 'auto', width: 250, marginTop: 6 },
  totalsRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 3 },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', borderTopWidth: 2, borderTopColor: '#1e40af', paddingTop: 8, marginTop: 4 },
  totalText: { fontFamily: 'Helvetica-Bold', fontSize: 13, color: '#1e40af' },
  discount: { color: '#16a34a' },
  taxNotice: { marginTop: 18, padding: 10, backgroundColor: '#f8f9fa', borderRadius: 4, fontSize: 9, color: '#666' },
  bankInfo: { marginTop: 15 },
  notes: { marginTop: 15 },
  footer: { marginTop: 30, paddingTop: 10, borderTopWidth: 1, borderTopColor: '#ddd', fontSize: 8, color: '#888' },
});

interface Props {
  invoice: any;
  settings: any;
}

export function InvoiceDocument({ invoice, settings }: Props) {
  const s = settings || {};
  const items: any[] = invoice?.items ?? [];
  const isBar = invoice?.paymentMethod === 'BAR';
  const isPaid = invoice?.status === 'BEZAHLT';

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          <View>
            {(s.logoPath ?? '').trim() ? <Image style={styles.logo} src={s.logoPath} /> : null}
            <Text style={styles.companyName}>{s.companyName ?? 'IT-Hilfe Schubert'}</Text>
            <Text style={styles.company}>{s.ownerName ?? ''}</Text>
            <Text style={styles.company}>
              {(s.street ?? '').trim() ? `${s.street}, ` : ''}{(s.zip ?? '').trim() ? `${s.zip} ` : ''}{s.city ?? ''}
            </Text>
            {(s.phone ?? '').trim() ? <Text style={styles.company}>Tel: {s.phone}</Text> : null}
            {(s.email ?? '').trim() ? <Text style={styles.company}>E-Mail: {s.email}</Text> : null}
          </View>
          <View style={styles.right}>
            <Text style={styles.invoiceTitle}>RECHNUNG</Text>
            <Text style={styles.bold}>{invoice?.invoiceNumber ?? ''}</Text>
            <Text>Datum: {formatDateDE(invoice?.createdAt)}</Text>
            <View style={styles.badgeRow}>
              <Text style={[styles.badge, isBar ? styles.badgeBar : styles.badgeKarte]}>
                {isBar ? 'Barzahlung' : 'Kartenzahlung'}
              </Text>
              <Text style={[styles.badge, isPaid ? styles.badgeBezahlt : styles.badgeOffen]}>
                {isPaid ? 'Bezahlt' : 'Offen'}
              </Text>
            </View>
          </View>
        </View>

        {(s.invoiceHeader ?? '').trim() ? (
          <View style={styles.headerBox}><Text>{s.invoiceHeader}</Text></View>
        ) : null}

        <View style={styles.meta}>
          <Text style={styles.metaLabel}>Rechnungsempfaenger</Text>
          <Text style={styles.bold}>{invoice?.customer?.firstName ?? ''} {invoice?.customer?.lastName ?? ''}</Text>
          <Text>{invoice?.customer?.street ?? ''} {invoice?.customer?.houseNr ?? ''}</Text>
          <Text>{invoice?.customer?.zip ?? ''} {invoice?.customer?.city ?? ''}</Text>
        </View>

        <View style={styles.table}>
          <View style={styles.tableHead}>
            <Text style={[styles.th, styles.cPos]}>Pos.</Text>
            <Text style={[styles.th, styles.cDesc]}>Beschreibung</Text>
            <Text style={[styles.th, styles.cQty]}>Menge</Text>
            <Text style={[styles.th, styles.cPrice]}>Einzelpreis</Text>
            <Text style={[styles.th, styles.cTotal]}>Gesamt</Text>
          </View>
          {items.map((item, idx) => (
            <View style={styles.row} key={idx}>
              <Text style={[styles.td, styles.cPos]}>{idx + 1}</Text>
              <Text style={[styles.td, styles.cDesc]}>{item?.name ?? ''}</Text>
              <Text style={[styles.td, styles.cQty]}>{item?.quantity ?? 0}</Text>
              <Text style={[styles.td, styles.cPrice]}>{euro(item?.unitPrice ?? 0)}</Text>
              <Text style={[styles.td, styles.cTotal]}>{euro((item?.unitPrice ?? 0) * (item?.quantity ?? 0))}</Text>
            </View>
          ))}
        </View>

        <View style={styles.totals}>
          <View style={styles.totalsRow}><Text>Zwischensumme</Text><Text>{euro(invoice?.subtotal ?? 0)}</Text></View>
          {(invoice?.travelCost ?? 0) > 0 ? (
            <View style={styles.totalsRow}><Text>Anfahrtskosten</Text><Text>{euro(invoice.travelCost)}</Text></View>
          ) : null}
          {(invoice?.discount ?? 0) > 0 ? (
            <View style={styles.totalsRow}><Text style={styles.discount}>Schutzbrief-Rabatt (10%)</Text><Text style={styles.discount}>-{euro(invoice.discount)}</Text></View>
          ) : null}
          <View style={styles.totalRow}><Text style={styles.totalText}>Gesamtbetrag</Text><Text style={styles.totalText}>{euro(invoice?.total ?? 0)}</Text></View>
        </View>

        <View style={styles.taxNotice}>
          <Text>{s.taxInfo ?? 'Gemaess \u00a7 19 UStG wird keine Umsatzsteuer berechnet.'}</Text>
        </View>

        {(s.iban ?? '').trim() ? (
          <View style={styles.bankInfo}>
            <Text style={styles.metaLabel}>Bankverbindung</Text>
            {(s.bankName ?? '').trim() ? <Text>{s.bankName}</Text> : null}
            <Text>IBAN: {s.iban}</Text>
            {(s.bic ?? '').trim() ? <Text>BIC: {s.bic}</Text> : null}
          </View>
        ) : null}

        {(invoice?.notes ?? '').trim() ? (
          <View style={styles.notes}>
            <Text style={styles.metaLabel}>Bemerkungen</Text>
            <Text>{invoice.notes}</Text>
          </View>
        ) : null}

        <View style={styles.footer}>
          <Text>
            {s.companyName ?? ''} | {s.ownerName ?? ''} | {(s.street ?? '').trim() ? `${s.street}, ` : ''}{s.zip ?? ''} {s.city ?? ''}
          </Text>
        </View>
      </Page>
    </Document>
  );
}
