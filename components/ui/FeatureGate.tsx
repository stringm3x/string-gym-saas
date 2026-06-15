import Link from "next/link";
import {
  hasFeature,
  getRequiredPlan,
  PLAN_LABELS,
  type Feature,
  type Plan,
} from "@/lib/features";

interface FeatureGateProps {
  feature: Feature;
  plan: Plan;
  slug: string;
  children: React.ReactNode;
}

/**
 * Envuelve un módulo/sección. Si el plan actual del gym no incluye
 * la feature, muestra el contenido con blur + overlay y un CTA para
 * mejorar de plan. El contenido real nunca deja de renderizarse en
 * el DOM (mejor para SEO/layout), solo queda visualmente bloqueado
 * e inerte.
 */
export function FeatureGate({
  feature,
  plan,
  slug,
  children,
}: FeatureGateProps) {
  const unlocked = hasFeature(plan, feature);

  if (unlocked) {
    return <>{children}</>;
  }

  const requiredPlan = getRequiredPlan(feature);
  const requiredPlanLabel = PLAN_LABELS[requiredPlan];

  return (
    <div className="relative">
      <div
        aria-hidden="true"
        className="pointer-events-none select-none blur-sm opacity-40"
      >
        {children}
      </div>

      <div className="absolute inset-0 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3 rounded-xl border border-border bg-surface/90 px-6 py-5 text-center shadow-lg backdrop-blur-sm">
          <p className="text-sm text-text-secondary">
            Esta sección está disponible en el plan{" "}
            <span className="font-semibold text-brand-green">
              {requiredPlanLabel}
            </span>
          </p>
          <Link
            href={`/${slug}/configuracion/plan`}
            className="rounded-lg bg-brand-green px-4 py-2 text-sm font-semibold text-bg transition-colors duration-150 hover:bg-brand-green/90"
          >
            Mejorar a {requiredPlanLabel}
          </Link>
        </div>
      </div>
    </div>
  );
}
