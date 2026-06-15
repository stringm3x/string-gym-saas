import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  let response = NextResponse.next({
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

  // Rutas públicas: login, registro, landing raíz, assets, api.
  const segments = pathname.split("/").filter(Boolean);
  const publicRoutes = ["login", "registro"];
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

  // Validar que el gym existe, está activo y pertenece al usuario.
  const { data: gym, error } = await supabase
    .from("gyms")
    .select("id, slug, estado, plan, owner_id")
    .eq("slug", slug)
    .single();

  if (error || !gym) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  if (gym.owner_id !== session.user.id) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  if (gym.estado !== "activo") {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  // Pasar info del tenant a Server Components vía headers.
  response.headers.set("x-tenant-id", gym.id);
  response.headers.set("x-tenant-slug", gym.slug);
  response.headers.set("x-tenant-plan", gym.plan);

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
