import { requirePanel } from "@/lib/authz/pagina";
import { QrScannerDisplay } from "@/components/checkins/QrScannerDisplay";

export default async function ScannerPage() {
  // Misma política que checkInPorQrAction (qr_access + hacer_checkin_manual).
  const g = await requirePanel("checkins.qr", { sinPermiso: "/checkins" });
  if (!g.ok) return null; // qr_access es Starter: no ocurre
  const tenant = g.ctx;

  return <QrScannerDisplay slug={tenant.slug} />;
}
