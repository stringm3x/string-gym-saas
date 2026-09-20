// Fixture de tipos: la "acción 152" — export sin constructor.
export async function cobrarSinAutorizacion(monto: number) {
  return { ok: true, monto };
}
