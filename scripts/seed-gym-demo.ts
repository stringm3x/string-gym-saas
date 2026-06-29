/**
 * Seed del tenant `gym-demo` con datos realistas para demos comerciales.
 *
 * Idempotente: limpia los datos del tenant y los vuelve a insertar.
 *
 * Uso:
 *   npx tsx scripts/seed-gym-demo.ts
 *   # o, sin tsx (Node 22.6+):
 *   node --experimental-strip-types scripts/seed-gym-demo.ts
 *
 * Lee credenciales de .env.local (service-role).
 */
import { readFileSync } from "node:fs";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// ─────────────────────────── setup ───────────────────────────

const env: Record<string, string> = {};
for (const line of readFileSync(".env.local", "utf8").split("\n")) {
  const m = line.match(/^([A-Z_]+)=(.*)$/);
  if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, "");
}

const sb: SupabaseClient = createClient(
  env.NEXT_PUBLIC_SUPABASE_URL,
  env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
);

const SLUG = "gym-demo";

// ─────────────────────────── helpers ───────────────────────────

const NOMBRES = [
  "Juan", "María", "José", "Guadalupe", "Carlos", "Ana", "Luis", "Laura",
  "Miguel", "Fernanda", "Jorge", "Sofía", "Pedro", "Valeria", "Ricardo",
  "Daniela", "Roberto", "Mariana", "Eduardo", "Paola", "Francisco", "Andrea",
  "Alejandro", "Gabriela", "Diego", "Regina", "Manuel", "Ximena", "Héctor",
  "Carmen", "Raúl", "Patricia", "Sergio", "Alejandra", "Arturo", "Verónica",
  "Rodrigo", "Lucía", "Emilio", "Renata", "Iván", "Brenda", "Óscar", "Adriana",
  "Marco", "Karla", "Felipe", "Cecilia", "Mauricio", "Liliana",
];
const APELLIDOS = [
  "García", "Martínez", "Rodríguez", "López", "Hernández", "González", "Pérez",
  "Sánchez", "Ramírez", "Cruz", "Flores", "Gómez", "Morales", "Vázquez",
  "Reyes", "Jiménez", "Torres", "Díaz", "Ortiz", "Ruiz", "Mendoza", "Castillo",
  "Romero", "Álvarez", "Mejía", "Guerrero", "Aguilar", "Medina", "Vargas",
  "Castro",
];

function nombreDe(i: number): string {
  return `${NOMBRES[i % NOMBRES.length]} ${APELLIDOS[i % APELLIDOS.length]} ${APELLIDOS[(i + 7) % APELLIDOS.length]}`;
}
function telDe(i: number): string {
  return `+52 55 ${String(1000 + i).padStart(4, "0")} ${String(2000 + i * 3).padStart(4, "0")}`;
}
function emailDe(nombre: string, i: number): string {
  const base = nombre
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z]/g, "");
  return `${base.slice(0, 12)}${i}@example.com`;
}

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}
function ymd(d: Date): string {
  return `${d.getUTCFullYear()}-${pad2(d.getUTCMonth() + 1)}-${pad2(d.getUTCDate())}`;
}
function hoyUTC(): Date {
  const n = new Date();
  return new Date(Date.UTC(n.getFullYear(), n.getMonth(), n.getDate()));
}
function addDays(d: Date, n: number): Date {
  return new Date(d.getTime() + n * 86_400_000);
}
function addMin(hora: string, min: number): string {
  const [h, m] = hora.split(":").map(Number);
  const total = h * 60 + m + min;
  return `${pad2(Math.floor(total / 60))}:${pad2(total % 60)}:00`;
}
function rand(n: number): number {
  return Math.floor(Math.random() * n);
}
function pick<T>(arr: T[]): T {
  return arr[rand(arr.length)];
}

// ─────────────────────────── 1. limpieza ───────────────────────────

async function limpiar(tenantId: string) {
  // Orden: hijos primero para no violar FKs.
  const orden = [
    "clases_reservas",
    "clases_sesiones",
    "clases",
    "checkins",
    "movimientos_inventario",
    "pagos",
    "inventario",
    "productos",
    "prospectos",
    "miembros",
    "planes_membresia",
  ];
  for (const tabla of orden) {
    const { error } = await sb.from(tabla).delete().eq("tenant_id", tenantId);
    if (error) throw new Error(`limpiando ${tabla}: ${error.message}`);
  }
}

// ─────────────────────────── main ───────────────────────────

async function main() {
  const { data: gym, error: gErr } = await sb
    .from("gyms")
    .select("id")
    .eq("slug", SLUG)
    .maybeSingle();
  if (gErr || !gym) throw new Error(`gym '${SLUG}' no encontrado.`);
  const TENANT: string = gym.id;

  await limpiar(TENANT);

  // Gym: marca para la demo.
  await sb
    .from("gyms")
    .update({
      nombre: "CrossFit Norte MX",
      color_acento: "#FF6B35",
      direccion: "Polanco, CDMX",
    })
    .eq("id", TENANT);

  // Planes
  const { data: planes } = await sb
    .from("planes_membresia")
    .insert([
      { tenant_id: TENANT, nombre: "Plan Mensual", precio: 999, dias_duracion: 30, activo: true },
      { tenant_id: TENANT, nombre: "Plan Trimestral", precio: 2499, dias_duracion: 90, activo: true },
    ])
    .select("id, nombre, precio, dias_duracion");
  const planMensual = planes!.find((p) => p.nombre === "Plan Mensual")!;
  const planTrim = planes!.find((p) => p.nombre === "Plan Trimestral")!;

  // Miembros: 30 activos / 8 por vencer / 5 vencidos / 3 archivados = 46
  const hoy = hoyUTC();
  type MiembroRow = {
    tenant_id: string;
    nombre: string;
    telefono: string;
    email: string;
    fecha_inscripcion: string;
    fecha_vencimiento: string;
    estado: string;
    archivado: boolean;
    archivado_at: string | null;
    plan_id: string;
  };
  const miembrosRows: MiembroRow[] = [];
  function mkMiembro(i: number, vencDias: number, archivado: boolean) {
    const nombre = nombreDe(i);
    const plan = i % 3 === 0 ? planTrim : planMensual;
    miembrosRows.push({
      tenant_id: TENANT,
      nombre,
      telefono: telDe(i),
      email: emailDe(nombre, i),
      fecha_inscripcion: ymd(addDays(hoy, -(30 + rand(330)))),
      fecha_vencimiento: ymd(addDays(hoy, vencDias)),
      estado: "activo",
      archivado,
      archivado_at: archivado ? addDays(hoy, -rand(60)).toISOString() : null,
      plan_id: plan.id,
    });
  }
  let idx = 0;
  for (let k = 0; k < 30; k++) mkMiembro(idx++, 10 + rand(50), false); // activos
  for (let k = 0; k < 8; k++) mkMiembro(idx++, 1 + rand(7), false); // por vencer
  for (let k = 0; k < 5; k++) mkMiembro(idx++, -(5 + rand(35)), false); // vencidos
  for (let k = 0; k < 3; k++) mkMiembro(idx++, -rand(20), true); // archivados

  const { data: miembros, error: mErr } = await sb
    .from("miembros")
    .insert(miembrosRows)
    .select("id, fecha_vencimiento, archivado");
  if (mErr) throw new Error(`miembros: ${mErr.message}`);

  // Miembros "facturables" para pagos/reservas/checkins (no archivados).
  const activos = miembros!.filter((m) => !m.archivado);

  // Pagos: 25 del último mes, ~$45k (mix mensual/trimestral)
  const pagosRows: Record<string, unknown>[] = [];
  for (let i = 0; i < 25; i++) {
    const usaTrim = i < 13; // 13 trimestrales + 12 mensuales = $44,475
    const plan = usaTrim ? planTrim : planMensual;
    const m = pick(activos);
    const fecha = addDays(hoy, -rand(30));
    pagosRows.push({
      tenant_id: TENANT,
      miembro_id: m.id,
      concepto: "membresia",
      monto: plan.precio,
      metodo_pago: pick(["efectivo", "tarjeta", "transferencia"]),
      fecha_pago: fecha.toISOString(),
      plan_id: plan.id,
      periodo_inicio: ymd(fecha),
      periodo_fin: ymd(addDays(fecha, plan.dias_duracion)),
    });
  }
  await sb.from("pagos").insert(pagosRows);
  const totalPagos = pagosRows.reduce((s, p) => s + (p.monto as number), 0);

  // Clases (3) + sesiones (4 semanas)
  const clasesDef = [
    { nombre: "Box Matutino", color: "#FF6B35", tipo: "regular", instructor: "Coach Diego", dur: 60, cupo: 12, dias: [1, 3, 5], hora: "07:00" },
    { nombre: "Funcional", color: "#3b82f6", tipo: "regular", instructor: "Coach Ana", dur: 60, cupo: 15, dias: [2, 4], hora: "08:00" },
    { nombre: "Yoga", color: "#8b5cf6", tipo: "regular", instructor: "Coach Sofía", dur: 60, cupo: 10, dias: [6], hora: "09:00" },
  ];
  const { data: clases } = await sb
    .from("clases")
    .insert(
      clasesDef.map((c) => ({
        tenant_id: TENANT,
        nombre: c.nombre,
        descripcion: null,
        instructor: c.instructor,
        color: c.color,
        tipo: c.tipo,
        duracion_minutos: c.dur,
        cupo_maximo: c.cupo,
        es_recurrente: true,
        dias_semana: c.dias,
        hora_inicio: c.hora,
        fecha_inicio: ymd(hoy),
      }))
    )
    .select("id, nombre, cupo_maximo");

  const sesionesRows: Record<string, unknown>[] = [];
  clasesDef.forEach((c, ci) => {
    const clase = clases![ci];
    for (let i = 0; i <= 28; i++) {
      const d = addDays(hoy, i);
      if (!c.dias.includes(d.getUTCDay())) continue;
      sesionesRows.push({
        tenant_id: TENANT,
        clase_id: clase.id,
        fecha: ymd(d),
        hora_inicio: c.hora,
        hora_fin: addMin(c.hora, c.dur),
        cupo_maximo: c.cupo,
        cupo_disponible: c.cupo,
      });
    }
  });
  const { data: sesiones } = await sb
    .from("clases_sesiones")
    .insert(sesionesRows)
    .select("id, fecha, cupo_maximo");

  // Reservas: en las sesiones de las próximas 2 semanas, llenar parcialmente.
  const limite = ymd(addDays(hoy, 14));
  const reservasRows: Record<string, unknown>[] = [];
  for (const s of sesiones!) {
    if (s.fecha > limite) continue;
    const cuantos = 2 + rand(Math.max(1, s.cupo_maximo - 4));
    const elegidos = [...activos].sort(() => Math.random() - 0.5).slice(0, cuantos);
    for (const m of elegidos) {
      reservasRows.push({
        tenant_id: TENANT,
        sesion_id: s.id,
        miembro_id: m.id,
        estado: "confirmada",
        origen: "manual",
      });
    }
  }
  if (reservasRows.length) await sb.from("clases_reservas").insert(reservasRows);

  // Inventario: 5 productos (2 con stock bajo)
  const productosDef = [
    { nombre: "Proteína Whey", categoria: "suplementos", precio: 850, costo: 520, stock: 24, min: 6 },
    { nombre: "Creatina", categoria: "suplementos", precio: 450, costo: 280, stock: 3, min: 8 }, // bajo
    { nombre: "Agua 600ml", categoria: "bebidas", precio: 20, costo: 8, stock: 60, min: 20 },
    { nombre: "Playera CrossFit Norte", categoria: "ropa", precio: 350, costo: 180, stock: 2, min: 6 }, // bajo
    { nombre: "Toalla deportiva", categoria: "accesorios", precio: 180, costo: 95, stock: 14, min: 5 },
  ];
  const { data: productos } = await sb
    .from("productos")
    .insert(
      productosDef.map((p) => ({
        tenant_id: TENANT,
        nombre: p.nombre,
        categoria: p.categoria,
        precio: p.precio,
        costo: p.costo,
      }))
    )
    .select("id, nombre");
  const inventarioRows = productosDef.map((p, i) => ({
    tenant_id: TENANT,
    producto_id: productos![i].id,
    stock_actual: p.stock,
    stock_minimo: p.min,
    unidades_vendidas: rand(20),
  }));
  await sb.from("inventario").insert(inventarioRows);
  await sb.from("movimientos_inventario").insert(
    productosDef.map((p, i) => ({
      tenant_id: TENANT,
      producto_id: productos![i].id,
      tipo: "entrada",
      cantidad: p.stock,
      motivo: "Carga inicial de inventario",
    }))
  );

  // Prospectos (4 en Kanban)
  await sb.from("prospectos").insert([
    { tenant_id: TENANT, nombre: "María Rodríguez", telefono: "+52 55 8001 1001", email: "maria.r@example.com", origen: "manual", estado: "nuevo", notas: "Interesada en Box matutino." },
    { tenant_id: TENANT, nombre: "Jorge Hernández", telefono: "+52 55 8002 1002", email: "jorge.h@example.com", origen: "whatsapp", estado: "contactado", notas: "Quiere precio del plan trimestral." },
    { tenant_id: TENANT, nombre: "Ana García", telefono: "+52 55 8003 1003", email: "ana.g@example.com", origen: "referido", estado: "agendado", fecha_prueba_agendada: ymd(addDays(hoy, 1)), notas: "Visita de prueba mañana." },
    { tenant_id: TENANT, nombre: "Luis Martínez", telefono: "+52 55 8004 1004", email: "luis.m@example.com", origen: "landing", estado: "convertido", notas: "Se inscribió esta semana." },
  ]);

  // Check-ins últimos 7 días
  const checkinsRows: Record<string, unknown>[] = [];
  for (let dia = 0; dia < 7; dia++) {
    const cuantos = 6 + rand(8);
    for (let k = 0; k < cuantos; k++) {
      const m = pick(activos);
      const hh = 6 + rand(15);
      const fecha = new Date(addDays(hoy, -dia).getTime() + (hh * 60 + rand(60)) * 60_000);
      checkinsRows.push({ tenant_id: TENANT, miembro_id: m.id, fecha_hora: fecha.toISOString() });
    }
  }
  await sb.from("checkins").insert(checkinsRows);

  // ─────────────────────────── resumen ───────────────────────────
  console.log("\n✅ gym-demo poblado (CrossFit Norte MX)\n");
  console.log(`  Miembros:    ${miembros!.length} (30 activos / 8 por vencer / 5 vencidos / 3 archivados)`);
  console.log(`  Pagos:       ${pagosRows.length}  ·  total $${totalPagos.toLocaleString("es-MX")} MXN`);
  console.log(`  Clases:      ${clases!.length}  ·  ${sesiones!.length} sesiones (4 semanas)`);
  console.log(`  Reservas:    ${reservasRows.length}`);
  console.log(`  Productos:   ${productos!.length} (2 con stock bajo)`);
  console.log(`  Prospectos:  4 (Kanban: nuevo/contactado/agendado/convertido)`);
  console.log(`  Check-ins:   ${checkinsRows.length} (últimos 7 días)\n`);
}

main().catch((e) => {
  console.error("❌ Error:", e.message);
  process.exit(1);
});
