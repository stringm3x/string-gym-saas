import { test, expect } from "@playwright/test";
import { NextRequest } from "next/server";
import { notifyWhatsapp } from "@/lib/whatsapp/notify";
import { POST as whatsappIncomingPOST } from "@/app/api/whatsapp/incoming/[slug]/route";

/**
 * Estos dos no son flujos de UI — son garantías de infraestructura ("dormida"
 * sin configurar) que conviene verificar igual. Se ejercitan a nivel Node
 * (import directo), no contra el server corriendo, porque lo que hay que
 * probar es el comportamiento de la función/handler ante una env var
 * presente o ausente — cosa que no se puede forzar en un proceso `next dev`
 * ya arrancado sin reiniciarlo.
 */
test.describe("WhatsApp", () => {
  test("notifyWhatsapp es no-op cuando N8N_WEBHOOK_URL no está configurada", async () => {
    expect(process.env.N8N_WEBHOOK_URL).toBeFalsy();

    const enviado = await notifyWhatsapp({
      tipo: "PAGO_REGISTRADO",
      gymId: "test-gym-id",
      gymSlug: "gym-demo",
      gymNombre: "Gym de prueba",
      whatsappNumero: null,
      whatsappApiKey: null,
      miembroNombre: "Miembro de prueba",
      miembroTelefono: "+52 55 0000 0000",
      monto: 999,
      planNombre: "Plan Mensual",
      fechaVencimiento: null,
    });

    // Sin N8N_WEBHOOK_URL ni DIALOG360_API_KEY, no hay infra: no-op. El
    // contrato de notifyWhatsapp usa `true` para "nada que hacer, no es un
    // error" y reserva `false` para intentos reales que fallaron (ver
    // lib/whatsapp/n8n-handler.ts:187) — lo que importa es que no lanza.
    expect(enviado).toBe(true);
  });

  test("El webhook entrante devuelve 401 sin el secreto correcto", async () => {
    const original = process.env.WHATSAPP_INCOMING_SECRET;
    process.env.WHATSAPP_INCOMING_SECRET = "test-secret-e2e";
    try {
      const request = new NextRequest(
        "http://localhost/api/whatsapp/incoming/gym-demo",
        { method: "POST", body: JSON.stringify({}) }
      );
      const response = await whatsappIncomingPOST(request, {
        params: Promise.resolve({ slug: "gym-demo" }),
      });
      expect(response.status).toBe(401);
    } finally {
      process.env.WHATSAPP_INCOMING_SECRET = original;
    }
  });
});
