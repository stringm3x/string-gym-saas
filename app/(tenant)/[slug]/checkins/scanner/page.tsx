import { redirect } from "next/navigation";
import { getTenant } from "@/lib/tenant";
import { hasFeature } from "@/lib/features";
import { hasPermission } from "@/lib/permissions";
import { QrScannerDisplay } from "@/components/checkins/QrScannerDisplay";

export default async function ScannerPage() {
  const tenant = await getTenant();

  // Owner y recepcionista (ver_checkins_dia); requiere feature qr_access (Pro+).
  if (
    !hasPermission(tenant.role, "ver_checkins_dia") ||
    !hasFeature(tenant.plan, "qr_access")
  ) {
    redirect(`/${tenant.slug}/checkins`);
  }

  return <QrScannerDisplay slug={tenant.slug} />;
}
