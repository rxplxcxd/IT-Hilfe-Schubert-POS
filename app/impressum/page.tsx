import type { Metadata } from 'next';
import LegalPage from '@/components/legal-page';
import { impressumHtml } from '@/lib/legal-content';

export const metadata: Metadata = {
  title: 'Impressum | IT-Hilfe Schubert',
  description: 'Impressum der IT-Hilfe Schubert.',
};

export default function ImpressumPage() {
  return <LegalPage html={impressumHtml} />;
}
