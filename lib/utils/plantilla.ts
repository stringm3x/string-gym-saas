export function compilarPlantilla(
  contenido: string,
  context: { nombre?: string; fecha_vencimiento?: string; gym_nombre?: string }
): string {
  return contenido.replace(/\{\{(\w+)\}\}/g, (_, key) => {
    return String(context[key as keyof typeof context] ?? `{{${key}}}`);
  });
}
