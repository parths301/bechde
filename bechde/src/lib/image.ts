/**
 * Client-side image processing for listing photos (P0-2).
 *
 * Phone cameras produce 3–8 MB originals; this downscales and compresses them
 * before upload so they land at a few hundred KB. The bucket's server-side
 * 2 MB cap (set in 0006_admin.sql) catches anything that bypasses the UI.
 */

/** Reject originals larger than this — the canvas shouldn't decode a 50 MB HEIC. */
export const MAX_ORIGINAL_BYTES = 10_000_000; // 10 MB

/** Allowed image MIME types. */
const IMAGE_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
  "image/avif",
  "image/gif",
]);

/**
 * Pre-flight check before processing. Returns an error message or null.
 * Checks file size and MIME type; doesn't touch the file contents.
 */
export function validateImage(file: File, maxBytes = MAX_ORIGINAL_BYTES): string | null {
  if (!IMAGE_TYPES.has(file.type) && !file.type.startsWith("image/")) {
    return `"${file.name}" isn't an image file.`;
  }
  if (file.size > maxBytes) {
    const mb = (file.size / 1_000_000).toFixed(1);
    return `"${file.name}" is ${mb} MB — try one under ${(maxBytes / 1_000_000).toFixed(0)} MB.`;
  }
  return null;
}

/**
 * Downscale + compress a photo for upload.
 *
 * Uses `createImageBitmap` (avoids blocking the main thread with an `<img>`)
 * and a canvas export. Attempts WebP at `quality`; falls back to JPEG if the
 * browser doesn't support WebP (Safari < 15).
 *
 * Returns the compressed blob and the extension to use for the upload path.
 */
export async function compressImage(
  file: File,
  maxEdge = 1600,
  quality = 0.8
): Promise<{ blob: Blob; ext: string }> {
  const bmp = await createImageBitmap(file);
  const { width, height } = bmp;

  // Scale so the longest edge is ≤ maxEdge. If already small, don't upscale.
  let w = width;
  let h = height;
  if (w > maxEdge || h > maxEdge) {
    const ratio = Math.min(maxEdge / w, maxEdge / h);
    w = Math.round(w * ratio);
    h = Math.round(h * ratio);
  }

  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d")!;
  ctx.drawImage(bmp, 0, 0, w, h);
  bmp.close();

  // Try WebP first, JPEG as fallback.
  const blob = await new Promise<Blob>((resolve) => {
    canvas.toBlob(
      (b) => {
        if (b && b.size > 0) {
          resolve(b);
        } else {
          // WebP not supported — fall back to JPEG.
          canvas.toBlob(
            (j) => resolve(j!),
            "image/jpeg",
            quality
          );
        }
      },
      "image/webp",
      quality
    );
  });

  const ext = blob.type === "image/webp" ? "webp" : "jpg";
  return { blob, ext };
}
