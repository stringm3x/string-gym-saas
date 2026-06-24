import QRCode from "qrcode";

/**
 * Genera el QR (data URL PNG en base64) que codifica el TOKEN del miembro.
 * El scanner del staff lee el token y registra el check-in. Codificamos el
 * token plano (no una URL) para que el lector lo capture directo.
 */
export async function generarQRDataUrl(token: string): Promise<string> {
  return QRCode.toDataURL(token, {
    width: 320,
    margin: 1,
    errorCorrectionLevel: "M",
  });
}
