// Fixture de tipos: constructor de otra carpeta usado para saltarse el rol.
import { kioscoAction } from "../index";

export const cobrarAction = kioscoAction(
  "kiosco.checkin",
  { onDenied: () => ({ ok: false }) },
  async () => ({ ok: true })
);
