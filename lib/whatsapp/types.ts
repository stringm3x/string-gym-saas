/**
 * Tipos de eventos WhatsApp (Fase 7.5). En un archivo aparte para que
 * notify.ts, emit.ts y n8n-handler.ts los compartan sin ciclos de import.
 */

interface GymBase {
  gymId: string;
  gymSlug: string;
  gymNombre: string;
}

/** Gym con credenciales de su subcuenta 360dialog (eventos al miembro). */
interface GymWa extends GymBase {
  whatsappNumero: string | null;
  whatsappApiKey: string | null;
}

/** Destinatario miembro. */
interface MiembroDest {
  miembroNombre: string;
  miembroTelefono: string | null;
}

export type WhatsappEvent =
  | (GymWa &
      MiembroDest & {
        tipo: "MEMBRESIA_POR_VENCER";
        diasRestantes: number;
        fechaVencimiento: string;
      })
  | (GymWa &
      MiembroDest & {
        tipo: "MEMBRESIA_VENCIDA";
        fechaVencimiento: string;
      })
  | (GymWa &
      MiembroDest & {
        tipo: "PAGO_REGISTRADO";
        monto: number;
        planNombre: string;
        fechaVencimiento: string | null;
        reciboUrl?: string;
      })
  | (GymWa & {
      tipo: "PROSPECTO_NUEVO";
      ownerTelefono: string | null;
      prospectoNombre: string;
      prospectoTelefono: string | null;
      planInteres: string | null;
      origen: string;
    })
  | (GymWa &
      MiembroDest & {
        tipo: "MIEMBRO_SIN_ACTIVIDAD";
        ownerTelefono: string | null;
        diasSinVenir: number;
      })
  | (GymWa &
      MiembroDest & {
        tipo: "BIENVENIDA_MIEMBRO";
        planNombre: string;
        fechaVencimiento: string;
      })
  | (GymWa & {
      tipo: "RESUMEN_DIARIO";
      ownerTelefono: string | null;
      checkinshoy: number;
      ingresosHoy: number;
      vencimientosEstaSemana: number;
      prospectosPendientes: number;
    })
  | (GymWa & {
      // Campaña masiva (B6): un envío por destinatario, mensaje ya compuesto.
      tipo: "CAMPANA";
      miembroTelefono: string | null;
      mensaje: string;
    })
  | (GymWa & {
      // Promoción de lista de espera (C2): al miembro que subió a confirmado.
      tipo: "LISTA_ESPERA";
      miembroTelefono: string | null;
      miembroNombre: string;
      claseNombre: string;
      fecha: string;
      hora: string;
    })
  | (GymWa & {
      // OTP del portal por WhatsApp (C3): código de acceso al miembro.
      tipo: "OTP";
      miembroTelefono: string | null;
      codigo: string;
    })
  | (GymWa & {
      // Visitas bajas (D8): al socio cuando su saldo llega al umbral.
      tipo: "VISITAS_BAJAS";
      miembroTelefono: string | null;
      miembroNombre: string;
      visitasRestantes: number;
    });
