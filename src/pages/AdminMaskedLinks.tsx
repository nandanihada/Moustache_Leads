import { MaskedLinkTracking } from '@/components/reports/MaskedLinkTracking';

export default function AdminMaskedLinks() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Masked Links</h1>
        <p className="text-muted-foreground">Track clicks on masked preview links sent via email</p>
      </div>
      <MaskedLinkTracking />
    </div>
  );
}
