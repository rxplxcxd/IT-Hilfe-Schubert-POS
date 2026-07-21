import { AppShell } from '@/components/app-shell';
import { PendingApproval } from '@/components/pending-approval';
import { getAccessForCurrentUser } from '@/lib/access';

export const dynamic = 'force-dynamic';

export default async function HomePage() {
  try {
    const access = await getAccessForCurrentUser();
    if (!access) {
      return <PendingApproval status="UNAUTHENTICATED" />;
    }
    if (access.status !== 'APPROVED') {
      return <PendingApproval status={access.status} name={access.name} />;
    }
    return <AppShell isAdmin={access.role === 'ADMIN'} employeeNo={access.employeeNo ?? null} />;
  } catch (e) {
    return <PendingApproval status="ERROR" />;
  }
}
