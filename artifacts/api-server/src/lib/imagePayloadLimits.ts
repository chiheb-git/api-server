/** Taille max décodée par image (bytes). Au-delà : risque pour PG / timeouts / mémoire. */
export const MAX_IMAGE_DECODED_BYTES = 6 * 1024 * 1024;

/**
 * Estime la taille décodée d'une chaîne base64 (avec ou sans préfixe data URL).
 */
export function estimateBase64DecodedBytes(dataUrlOrBase64: string): number {
  const raw = dataUrlOrBase64.replace(/^data:image\/\w+;base64,/, "").replace(/\s/g, "");
  if (!raw.length) return 0;
  const pad = raw.endsWith("==") ? 2 : raw.endsWith("=") ? 1 : 0;
  return Math.max(0, Math.floor((raw.length * 3) / 4) - pad);
}

export type ImageValidationFailure = { ok: false; message: string };
export type ImageValidationOk = { ok: true };

/**
 * Valide une ou plusieurs images encodées base64.
 */
export function validateBase64ImageSizes(
  fields: Array<{ name: string; value: string }>,
  maxBytes: number = MAX_IMAGE_DECODED_BYTES,
): ImageValidationOk | ImageValidationFailure {
  for (const { name, value } of fields) {
    const bytes = estimateBase64DecodedBytes(value);
    if (bytes > maxBytes) {
      const mb = (bytes / (1024 * 1024)).toFixed(1);
      const maxMb = (maxBytes / (1024 * 1024)).toFixed(0);
      return {
        ok: false,
        message: `Image trop volumineuse (${name}) : environ ${mb} Mo après décodage. Maximum autorisé : ${maxMb} Mo par image. Réduisez la résolution ou la qualité JPEG.`,
      };
    }
  }
  return { ok: true };
}
