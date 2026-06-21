# Fase 6.9 — Importación CSV de miembros

> Plan de implementación para Claude Code. Última fase pre-venta antes 
> de Fase 7 (Landing pública). Sin esto, ningún cliente real puede 
> migrar sus datos al SaaS.

---

## Contexto

Fase 6.8 cerrada (multiusuario completo). Antes de Fase 7 necesitamos 
resolver la migración de datos: un cliente con 500 miembros NO va a 
crear cada uno manualmente.

Esta fase implementa la importación masiva desde CSV con validación, 
preview y manejo de errores.

---

## ALCANCE DE FASE 6.9

1. Plantilla CSV descargable con columnas y formato esperado
2. Pantalla `/miembros/importar` para subir CSV
3. Validación robusta del CSV (Zod + reglas de negocio)
4. Preview ANTES de importar (ver qué se va a crear)
5. Manejo de errores: filas inválidas se reportan, no rompen el proceso
6. Importación transaccional (todo o nada por chunks)
7. Reporte post-importación: cuántos OK, cuántos fallaron, por qué
8. Campo `miembros.origen_importacion` para rastreo
9. Detección de duplicados (por teléfono O email)
10. Owner-only (gate completo, receptionist no puede importar)

---

## MIGRACIÓN SQL

Crear `sql/015_origen_importacion.sql`:

```sql
-- Agregar campo para rastrear miembros importados
alter table miembros
  add column if not exists origen_importacion text;

-- Index para consultas de auditoría futura
create index if not exists idx_miembros_origen 
  on miembros(tenant_id, origen_importacion) 
  where origen_importacion is not null;

-- Valores posibles:
--   null              → miembro creado manualmente
--   'csv:2026-06-22'  → importado vía CSV en esa fecha
--   'migracion-evol'  → importado desde Evolution GYM (futuro)
```

---

## FORMATO CSV ESPERADO

### Columnas obligatorias

```
nombre              (texto, requerido)
telefono            (texto, opcional pero al menos uno de tel/email)
email               (texto, opcional)
```

### Columnas opcionales

```
fecha_nacimiento    (YYYY-MM-DD, opcional)
genero              (M/F/Otro, opcional)
direccion           (texto, opcional)
contacto_emergencia (texto, opcional)
telefono_emergencia (texto, opcional)
notas_iniciales     (texto, opcional)
fecha_inscripcion   (YYYY-MM-DD, opcional, default = hoy)
fecha_vencimiento   (YYYY-MM-DD, opcional, default = null)
plan_actual         (nombre del plan, debe existir en planes_membresia)
```

### Plantilla de descarga

Archivo `plantilla-miembros.csv`:

```csv
nombre,telefono,email,fecha_nacimiento,genero,direccion,contacto_emergencia,telefono_emergencia,notas_iniciales,fecha_inscripcion,fecha_vencimiento,plan_actual
Juan Pérez García,5512345678,juan@example.com,1990-05-15,M,"Calle Falsa 123",María García,5598765432,"Cliente referido",2024-01-15,2024-02-15,Mensualidad General
Ana López,5587654321,,1985-08-22,F,,,,,2024-02-01,2024-03-01,Mensualidad General
Roberto Sánchez,,roberto@example.com,1995-11-30,M,Av. Reforma 100,Carlos Sánchez,5511112222,,,,
```

**Notas del formato:**
- UTF-8 encoding
- Separador: coma
- Strings con comas dentro: entre comillas dobles
- Fechas: formato ISO `YYYY-MM-DD`
- Booleanos: no se usan en esta fase
- Líneas vacías se ignoran

---

## TYPES Y VALIDACIONES

`lib/types/import.ts`:

```typescript
export interface CSVRow {
  nombre: string;
  telefono?: string;
  email?: string;
  fecha_nacimiento?: string;
  genero?: string;
  direccion?: string;
  contacto_emergencia?: string;
  telefono_emergencia?: string;
  notas_iniciales?: string;
  fecha_inscripcion?: string;
  fecha_vencimiento?: string;
  plan_actual?: string;
}

export interface ValidationError {
  row: number;          // Número de fila en el CSV (1-indexed, excluyendo header)
  field: string;        // Campo que falló
  value: string;        // Valor que se intentó
  reason: string;       // Razón legible del error
}

export interface ImportPreview {
  totalRows: number;
  validRows: CSVRow[];
  invalidRows: ValidationError[];
  duplicatesInCSV: number;     // Duplicados dentro del mismo CSV
  duplicatesInDB: number;       // Conflictos con miembros existentes
  plansNotFound: string[];      // Planes mencionados pero no existen
}

export interface ImportResult {
  ok: boolean;
  totalProcessed: number;
  successCount: number;
  failedCount: number;
  errors: ValidationError[];
  originId: string;             // ej: 'csv:2026-06-22-uuid'
}
```

`lib/validations/import.schema.ts`:

```typescript
import { z } from 'zod';

export const csvRowSchema = z.object({
  nombre: z.string().min(1, { error: 'Nombre requerido' }).max(200),
  telefono: z.string().optional().refine(
    val => !val || /^\d{10}$/.test(val.replace(/\s/g, '')),
    { error: 'Teléfono debe tener 10 dígitos' }
  ),
  email: z.string().email().optional().or(z.literal('')),
  // ... resto de validaciones
}).refine(
  data => data.telefono || data.email,
  { error: 'Debe tener al menos teléfono o email' }
);
```

---

## COMPONENTES NUEVOS

### 1. `components/miembros/import/ImportarMiembrosWizard.tsx`

Wizard de 3 pasos:

**Paso 1 — Subir archivo:**
- Drop zone para CSV
- Botón "Descargar plantilla CSV"
- Tip: "Asegúrate de usar UTF-8 y separador coma"
- Validación de tipo (.csv) y tamaño (<5MB)

**Paso 2 — Preview y validación:**
- Resumen: "X miembros encontrados, Y errores"
- Tabla con primeras 20 filas válidas
- Sección expandible "Errores encontrados" con detalle
- Sección "Planes no encontrados" si aplica
- Botón "Importar X miembros" (solo si hay válidos)
- Botón "Volver" para subir otro archivo

**Paso 3 — Resultado:**
- Animación de progreso durante la importación
- Resumen final: "X importados correctamente, Y fallaron"
- Lista de errores con número de fila
- Botones: "Ver miembros importados" o "Importar otro CSV"

### 2. `components/miembros/import/CSVPreviewTable.tsx`

Tabla compacta para previsualizar las primeras filas:
- Resaltar filas con warnings en amarillo (ej. plan no encontrado)
- Botón expandir para ver detalle de una fila
- Paginación simple si hay más de 50

### 3. `components/miembros/import/ImportErrorsList.tsx`

Lista colapsable de errores:
- Agrupar por tipo de error (ej. "5 filas sin teléfono ni email")
- Click expande para ver filas afectadas
- Botón "Copiar errores" para que el usuario corrija en Excel

---

## PÁGINA NUEVA

### `app/(tenant)/[slug]/miembros/importar/page.tsx`

Server component:
1. `getTenant()` con currentStaff
2. Gate: `hasPermission('crear_miembros')` Y `currentStaff?.rol === 'owner'`
   - Solo owner puede importar (no recepcionista)
   - Si no es owner → redirect a /miembros
3. Cargar planes_membresia del gym (para validar referencias en el CSV)
4. Renderizar `<ImportarMiembrosWizard>` con planes disponibles

---

## SERVER ACTIONS

`app/(tenant)/[slug]/miembros/importar/actions.ts`:

### `parsearCSVAction(file: File): Promise<ImportPreview>`

1. Verificar gate owner-only
2. Leer archivo como texto (UTF-8)
3. Parsear con `papaparse` o similar (header: true)
4. Por cada fila:
   - Validar con `csvRowSchema`
   - Si OK → agregar a `validRows`
   - Si falla → agregar a `invalidRows` con número de fila y razón
5. Detectar duplicados:
   - Dentro del CSV (mismo teléfono o email aparece más de una vez)
   - Contra BD (miembros existentes con mismo teléfono o email)
6. Detectar planes mencionados que no existen
7. Retornar `ImportPreview`

### `importarMiembrosAction(rows: CSVRow[]): Promise<ImportResult>`

1. Verificar gate owner-only
2. Generar `origen_importacion` único: `csv:2026-06-22-{uuid corto}`
3. Por chunks de 50 filas:
   - INSERT batch en tabla miembros
   - Si una fila falla, registrar el error pero continuar
   - Mapear `plan_actual` (string) a `plan_id` (uuid)
4. Retornar `ImportResult` con totales y errores

### Idempotencia

Si la misma importación se reintenta (ej. internet falla a mitad), 
el `origen_importacion` único permite identificar qué se importó y 
qué no. Posible feature futura: "Ver importaciones recientes" y 
"Deshacer última importación".

---

## INTEGRACIÓN UI

### Tab "Importar" en /miembros

`components/miembros/MiembrosHeader.tsx`:

Agregar botón "Importar CSV" junto al botón "Nuevo miembro".
- Visible solo para owner (gate cliente)
- Link a `/miembros/importar`
- Icono: `LuUpload` o similar

### Filtro "Origen" en lista de miembros

`components/miembros/MiembrosFilters.tsx`:

Dropdown con opciones:
- Todos
- Creados manualmente
- Importados (CSV)
- Importados (Evolution) — futuro

Útil para auditoría: "¿Cuántos miembros vienen de la importación?"

---

## DECISIÓN: ¿Permitir importación con errores?

Dos opciones:

**Opción A — Strict mode (recomendada para Plan Pro+):**
- Si hay errores, NO permitir importar nada
- Usuario corrige el CSV y reintenta
- Más seguro, menos errores en BD

**Opción B — Tolerant mode (recomendada para Plan Básico):**
- Importa los válidos, reporta los fallidos
- Usuario maneja los fallidos manualmente después
- Más práctico para casos de migración masiva

**Mi sugerencia:** Implementar ambas con toggle en el wizard:
- Default: tolerant (importa válidos, reporta fallidos)
- Checkbox: "Cancelar importación si hay errores" (strict)

Esto da flexibilidad sin complicar el flujo.

---

## ENTREGABLES

### Archivos NUEVOS

```
sql/015_origen_importacion.sql

public/plantilla-miembros.csv

lib/types/import.ts
lib/validations/import.schema.ts
lib/utils/csv-parser.ts

components/miembros/import/ImportarMiembrosWizard.tsx
components/miembros/import/CSVPreviewTable.tsx
components/miembros/import/ImportErrorsList.tsx

app/(tenant)/[slug]/miembros/importar/page.tsx
app/(tenant)/[slug]/miembros/importar/actions.ts
```

### Archivos MODIFICADOS

```
components/miembros/MiembrosHeader.tsx       -- botón "Importar CSV"
components/miembros/MiembrosFilters.tsx      -- filtro por origen
lib/queries/miembros.queries.ts              -- filtro por origen_importacion
```

### Dependencias NUEVAS

```bash
npm install papaparse
npm install -D @types/papaparse
```

---

## CRITERIOS DE ACEPTACIÓN

1. ✅ SQL ejecutado. Campo `origen_importacion` existe.
2. ✅ Botón "Importar CSV" en /miembros (solo visible para owner)
3. ✅ Click en botón abre wizard de 3 pasos
4. ✅ Paso 1: descargar plantilla funciona, subir CSV funciona
5. ✅ Paso 1: rechaza archivos no-CSV con mensaje claro
6. ✅ Paso 2: muestra preview con filas válidas e inválidas
7. ✅ Paso 2: detecta duplicados (CSV + BD)
8. ✅ Paso 2: detecta planes no encontrados
9. ✅ Paso 2: permite descargar lista de errores
10. ✅ Paso 3: importa con feedback visual de progreso
11. ✅ Paso 3: muestra resumen con éxitos y fallos
12. ✅ Miembros importados aparecen en lista con origen correcto
13. ✅ Filtro "Origen: Importados" funciona
14. ✅ Receptionist NO puede acceder a /miembros/importar
15. ✅ Build pasa sin errores TypeScript

---

## ORDEN SUGERIDO DE IMPLEMENTACIÓN

1. **SQL** — Migración 015 + ejecutar en Supabase
2. **Tipos y validaciones** — `import.ts` + `import.schema.ts`
3. **Utilidad parser** — `csv-parser.ts` con papaparse
4. **Plantilla pública** — `public/plantilla-miembros.csv`
5. **Server actions** — parsear + importar
6. **Componentes** — Wizard + Preview + Errors
7. **Página** — `/miembros/importar/page.tsx`
8. **Integración** — Botón en header + filtro en lista
9. **Testing** — Importar CSV de prueba con varios casos

Commits intermedios:
- Commit 1: SQL + tipos + validaciones + parser utility
- Commit 2: Server actions + plantilla
- Commit 3: Componentes wizard
- Commit 4: Integración + filtros + tests

---

## DATOS DE PRUEBA

Para testing, crear un CSV con estos casos:

```csv
nombre,telefono,email,fecha_nacimiento,plan_actual
Juan Válido,5512345678,juan@test.com,1990-01-15,Mensualidad General
Ana Sin Email,5587654321,,1985-05-20,Mensualidad General
Pedro Sin Tel,,pedro@test.com,1992-08-30,Mensualidad General
ERROR Sin Tel Ni Email,,,1990-01-01,
Roberto Plan Inexistente,5511223344,roberto@test.com,1988-12-25,Plan Premium VIP
Maria Duplicada CSV,5512345678,maria@test.com,1995-03-10,Mensualidad General
Carlos Fecha Mal,5599887766,carlos@test.com,15-mayo-1990,Mensualidad General
```

Casos a validar:
- Juan: importa OK
- Ana: importa OK (solo teléfono)
- Pedro: importa OK (solo email)
- ERROR: rechazado (sin teléfono ni email)
- Roberto: warning de plan no encontrado, importa sin plan
- Maria: warning de duplicado con Juan (mismo teléfono)
- Carlos: rechazado (fecha mal formateada)

---

## NOTAS DE DECISIÓN

**¿Por qué no Excel?**
- CSV es más universal
- Excel requiere librería pesada (sheetjs)
- Cliente puede exportar Excel → CSV fácilmente
- Si insisten, agregamos soporte Excel en fase futura

**¿Por qué no detectar formato automático?**
- Complejidad excesiva para Fase 6.9
- La plantilla descargable es suficiente para guiar al cliente
- Onboarding asistido cubre el resto

**¿Por qué owner-only?**
- Importación masiva es operación crítica
- Affecta facturación, métricas, todo el sistema
- Decisión estratégica del dueño
- Recepcionista NO debe poder importar sin autorización

---

## DESPUÉS DE TERMINAR

Para confirmar Fase 6.9 cerrada:

1. Importar CSV con 10 miembros válidos → todos aparecen en lista
2. Importar CSV con mix de válidos/inválidos → válidos importan, inválidos reportan
3. Importar el mismo CSV dos veces → segunda vez detecta duplicados
4. Filtrar lista por "Origen: Importados" → muestra solo los importados
5. Receptionist intenta entrar a /miembros/importar → redirect
6. Receptionist intenta forzar action vía curl → 403

Volver a chat de STRING GYM Dev para:
- Confirmar cierre Fase 6.9
- Actualizar Notion
- Arrancar plan Fase 7 (Landing pública)
