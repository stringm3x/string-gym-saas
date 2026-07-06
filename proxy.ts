import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import type { StaffRol } from "@/lib/types/staff";

function isLocalHost(hostname: string): boolean {
  return hostname.startsWith("localhost") || hostname.startsWith("127.0.0.1");
}

/**
 * Refresca la sesión Supabase y deja pasar la request tal cual.
 * Usado por las rutas /admin/* (no necesitan la lógica multitenant).
 */
function refreshSessionPassthrough(request: NextRequest): NextResponse {
  const response = NextResponse.next({ request: { headers: request.headers } });
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return request.cookies.get(name)?.value;
        },
        set(name: string, value: string, options: CookieOptions) {
          response.cookies.set({ name, value, ...options });
        },
        remove(name: string, options: CookieOptions) {
          response.cookies.set({ name, value: "", ...options });
        },
      },
    }
  );
  // Disparamos el refresh (no esperamos su valor: el gate real es el
  // layout del panel vía getCurrentAdmin()).
  void supabase.auth.getSession();
  return response;
}

/**
 * Rama SEPARADA para el panel de STRING Admin.
 *
 * Decisión de arquitectura: NO comparte nada con la lógica multitenant
 * (que asume `segments[0]` = slug de gym). Mantenerla aislada evita que
 * un bug cross-context exponga datos de tenants en el admin o viceversa.
 *
 * El panel vive en el segmento literal `/admin/*`. En el DOMINIO admin
 * (producción) la raíz y cualquier ruta ajena redirigen a `/admin` para
 * dar URLs limpias; en LOCAL se accede directo vía `/admin/*`. El gate de
 * auth real (sesión + super admin) es el layout del panel, no el proxy.
 */
function handleAdminRequest(
  request: NextRequest,
  isAdminDomain: boolean
): NextResponse {
  const { pathname } = request.nextUrl;

  if (isAdminDomain) {
    // La raíz del dominio admin lleva al panel.
    if (pathname === "/") {
      return NextResponse.redirect(new URL("/admin", request.url));
    }
    // En el dominio admin solo tienen sentido las rutas /admin/*.
    if (pathname !== "/admin" && !pathname.startsWith("/admin/")) {
      return NextResponse.redirect(new URL("/admin", request.url));
    }
  }

  return refreshSessionPassthrough(request);
}

export async function proxy(request: NextRequest) {
  const hostname = request.headers.get("host") || "";
  const { pathname } = request.nextUrl;

  // ───────────────── STRING Admin ─────────────────
  // Se detecta como request de admin si:
  //  - el host es el dominio admin (producción), o
  //  - es local (localhost / 127.0.0.1) y la ruta empieza con /admin.
  const isAdminDomain =
    hostname === process.env.ADMIN_DOMAIN ||
    hostname === "admin.gym.stringwebs.com";
  const isLocalAdmin =
    isLocalHost(hostname) &&
    (pathname === "/admin" || pathname.startsWith("/admin/"));

  if (isAdminDomain || isLocalAdmin) {
    return handleAdminRequest(request, isAdminDomain);
  }

  // Fuera del dominio admin y fuera de local: el panel /admin/* no se
  // sirve (p. ej. en el dominio del app). Se bloquea hacia el login.
  if (pathname === "/admin" || pathname.startsWith("/admin/")) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  // ───────────────── App multitenant (lógica existente) ─────────────────
  const response = NextResponse.next({
    request: { headers: request.headers },
  });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return request.cookies.get(name)?.value;
        },
        set(name: string, value: string, options: CookieOptions) {
          response.cookies.set({ name, value, ...options });
        },
        remove(name: string, options: CookieOptions) {
          response.cookies.set({ name, value: "", ...options });
        },
      },
    }
  );

  // Refresca la sesión (necesario para que los Server Components
  // siempre tengan la sesión vigente).
  const {
    data: { session },
  } = await supabase.auth.getSession();

  // Rutas públicas: login, registro, aceptar invitación, recibos, API pública.
  const segments = pathname.split("/").filter(Boolean);
  const publicRoutes = [
    "login",
    "registro",
    "auth",
    "recibos",
    "api",
    "api-docs",
    "sdk",
    "sdk-docs",
    "qr",
    "kiosco",
    "portal",
  ];
  const isPublicRoute =
    segments.length === 0 || publicRoutes.includes(segments[0]);

  if (isPublicRoute) {
    return response;
  }

  // A partir de aquí, segments[0] se asume como slug del tenant.
  const slug = segments[0];

  if (!session) {
    const redirectUrl = new URL("/login", request.url);
    return NextResponse.redirect(redirectUrl);
  }

  // Validar que el gym existe y pertenece al usuario.
  const { data: gym, error } = await supabase
    .from("gyms")
    .select("id, slug, estado, plan, owner_id, prueba_hasta")
    .eq("slug", slug)
    .single();

  if (error || !gym) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  // ── Prueba vencida / suspensión (Fase 7.3) ──
  // La propia página /[slug]/suspendida se deja pasar (si no, loop infinito).
  const isSuspendidaRoute = segments[1] === "suspendida";

  // 'cancelado' no tiene página amigable: el tenant ya no opera → login.
  if (gym.estado === "cancelado") {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  const pruebaVencida =
    gym.estado === "prueba" &&
    !!gym.prueba_hasta &&
    new Date(gym.prueba_hasta) < new Date(new Date().toDateString());
  const bloqueado = gym.estado === "suspendido" || pruebaVencida;

  if (bloqueado && !isSuspendidaRoute) {
    return NextResponse.redirect(
      new URL(`/${slug}/suspendida`, request.url)
    );
  }
  // Un gym operativo no debe quedarse en /suspendida.
  if (!bloqueado && isSuspendidaRoute) {
    return NextResponse.redirect(new URL(`/${slug}/hoy`, request.url));
  }

  // Estado usable: 'activo', 'prueba' vigente, o cualquier estado cuando se
  // visita la propia página de suspensión (para poder mostrarla).

  // Resolver el rol del usuario en este gym. El owner se valida por
  // owner_id (robusto, sin tocar `staff`). Un staff (recepcionista) se
  // resuelve con el MISMO client de sesión: la policy de auto-lectura
  // (migración 012, user_id = auth.uid()) le permite leer su propia fila.
  let role: StaffRol | null = null;
  if (gym.owner_id === session.user.id) {
    role = "owner";
  } else {
    const { data: staffRow } = await supabase
      .from("staff")
      .select("rol")
      .eq("gym_id", gym.id)
      .eq("user_id", session.user.id)
      .eq("estado", "activo")
      .maybeSingle();
    if (staffRow) role = staffRow.rol as StaffRol;
  }

  // Sin rol activo en este gym → sin acceso.
  if (!role) {
    return NextResponse.redirect(new URL("/login?error=no-access", request.url));
  }

  // Pasar info del tenant a Server Components vía headers.
  response.headers.set("x-tenant-id", gym.id);
  response.headers.set("x-tenant-slug", gym.slug);
  response.headers.set("x-tenant-plan", gym.plan);
  response.headers.set("x-staff-role", role);
  // El layout del tenant lee esto para renderizar /suspendida sin sidebar.
  response.headers.set("x-pathname", pathname);

  return response;
}

export const config = {
  matcher: [
    /*
     * Coincide con todas las rutas excepto:
     * - _next/static, _next/image (assets de Next)
     * - favicon.ico
     * - archivos estáticos (svg, png, jpg, etc.)
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
