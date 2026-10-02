// Resizes and compresses photos in the browser before upload, so big phone
// photos stay well under the 10 MB bucket limit and upload fast on mobile data.

const MAX_SIDE = 2000;
const QUALITY = 0.8;

export class ImageReadError extends Error {}

function canvasToBlob(canvas: HTMLCanvasElement, type: string): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, type, QUALITY));
}

export async function prepareImage(file: File): Promise<File> {
  if (!file.type.startsWith("image/")) {
    throw new ImageReadError("That file isn't an image. Choose a photo (JPEG, PNG, WebP or HEIC).");
  }
  if (file.type === "image/gif") return file; // keep animation

  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  } catch {
    throw new ImageReadError("This photo couldn't be opened. Try a different photo or save it as JPEG first.");
  }

  const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();

  // WebP where the browser can encode it, JPEG otherwise
  let blob = await canvasToBlob(canvas, "image/webp");
  let ext = "webp";
  if (!blob || blob.type !== "image/webp") {
    blob = await canvasToBlob(canvas, "image/jpeg");
    ext = "jpg";
  }
  if (!blob) throw new ImageReadError("This photo couldn't be prepared for upload. Try a different photo.");

  const base = file.name.replace(/\.[^.]+$/, "").replace(/[^a-z0-9-]+/gi, "-").toLowerCase() || "photo";
  return new File([blob], `${base}.${ext}`, { type: blob.type });
}
