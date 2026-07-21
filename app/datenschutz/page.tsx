import type { Metadata } from 'next';
import LegalPage from '@/components/legal-page';
import { datenschutzHtml } from '@/lib/legal-content';

export const metadata: Metadata = {
  title: 'Datenschutzerklärung | IT-Hilfe Schubert',
  description: 'Datenschutzerklärung der IT-Hilfe Schubert.',
};

export default function DatenschutzPage() {
  return <LegalPage html={datenschutzHtml} />;
}
