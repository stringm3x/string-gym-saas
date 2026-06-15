import { getTenant } from "@/lib/tenant";
import {
  listCheckinsDeHoy,
  countCheckinsDeHoy,
} from "@/lib/queries/checkins.queries";
import { CheckinKiosk } from "@/components/checkins/CheckinKiosk";
import { CheckinsFeed } from "@/components/checkins/CheckinsFeed";

interface PageProps {
  params: Promise<{ slug: string }>;
}

export default async function CheckinsPage({ params }: PageProps) {
  const { slug } = await params;
  const tenant = await getTenant();

  const [checkins, total] = await Promise.all([
    listCheckinsDeHoy(tenant.id, 30),
    countCheckinsDeHoy(tenant.id),
  ]);

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <div>
        <h2 className="font-display text-3xl uppercase tracking-wide text-text-primary">
          Check-in
        </h2>
        <p className="mt-1 text-sm text-text-secondary">
          Busca al miembro y registra su entrada con un click.
        </p>
      </div>

      <CheckinKiosk />

      <div className="space-y-3">
        <div className="flex items-baseline justify-between">
          <h3 className="text-sm font-semibold text-text-primary">
            Check-ins de hoy
          </h3>
          <span className="font-mono text-xs text-text-secondary tabular-nums">
            {total} {total === 1 ? "entrada" : "entradas"}
          </span>
        </div>

        <CheckinsFeed checkins={checkins} slug={slug} />
      </div>
    </div>
  );
}
