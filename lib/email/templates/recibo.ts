export interface ReciboEmailParams {
  miembroNombre: string;
  gymNombre: string;
  gymTelefono?: string | null;
  gymDireccion?: string | null;
  logoUrl?: string | null;
  colorAcento?: string;
  montoStr: string;
  fechaVencimientoStr?: string | null;
  reciboUrl: string;
}

/** HTML del email de recibo (estilos inline para compatibilidad con clientes). */
export function reciboEmailHtml(p: ReciboEmailParams): string {
  const acento = p.colorAcento || "#50ff05";
  const header = p.logoUrl
    ? `<img src="${p.logoUrl}" alt="${escapeHtml(p.gymNombre)}" style="max-height:48px;max-width:200px;object-fit:contain" />`
    : `<div style="font-size:22px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:#111827">${escapeHtml(
        p.gymNombre
      )}</div>`;

  const footerLines = [p.gymTelefono ? `Tel: ${escapeHtml(p.gymTelefono)}` : "", p.gymDireccion ? escapeHtml(p.gymDireccion) : ""]
    .filter(Boolean)
    .join(" · ");

  return `<!doctype html>
<html lang="es">
<body style="margin:0;background:#f3f4f6;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#111827">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f3f4f6;padding:24px 0">
    <tr><td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;background:#ffffff;border-radius:16px;overflow:hidden;border:1px solid #e5e7eb">
        <tr><td style="padding:28px 28px 0 28px">${header}</td></tr>
        <tr><td style="padding:20px 28px 0 28px">
          <p style="margin:0 0 4px 0;font-size:16px;font-weight:600">Hola ${escapeHtml(p.miembroNombre)},</p>
          <p style="margin:0;font-size:14px;color:#4b5563">Recibimos tu pago correctamente. Aquí está el resumen:</p>
        </td></tr>
        <tr><td style="padding:18px 28px 0 28px">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f9fafb;border-radius:12px">
            <tr><td style="padding:14px 16px">
              <table role="presentation" width="100%">
                <tr>
                  <td style="font-size:13px;color:#6b7280">Monto pagado</td>
                  <td align="right" style="font-size:20px;font-weight:700">${p.montoStr}</td>
                </tr>
                ${
                  p.fechaVencimientoStr
                    ? `<tr><td style="font-size:13px;color:#6b7280;padding-top:8px">Próximo vencimiento</td><td align="right" style="font-size:14px;font-weight:600;padding-top:8px">${escapeHtml(
                        p.fechaVencimientoStr
                      )}</td></tr>`
                    : ""
                }
              </table>
            </td></tr>
          </table>
        </td></tr>
        <tr><td align="center" style="padding:22px 28px 4px 28px">
          <a href="${p.reciboUrl}" style="display:inline-block;background:${acento};color:#0a0a0a;text-decoration:none;font-weight:700;font-size:14px;padding:12px 22px;border-radius:10px">Ver mi recibo completo</a>
        </td></tr>
        <tr><td align="center" style="padding:18px 28px 28px 28px">
          <p style="margin:0;font-size:12px;color:#9ca3af">${escapeHtml(p.gymNombre)}${
            footerLines ? "<br/>" + footerLines : ""
          }</p>
        </td></tr>
      </table>
      <p style="max-width:480px;margin:14px auto 0;font-size:11px;color:#9ca3af;text-align:center">Este correo se generó automáticamente al registrar tu pago.</p>
    </td></tr>
  </table>
</body>
</html>`;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
