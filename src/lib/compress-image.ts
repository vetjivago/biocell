// Fotos de celular costumam passar de 4 MB: reduz para JPEG até 2000px antes de enviar
export async function compressImage(file: File, maxSide = 2000, minBytes = 1.5 * 1024 * 1024): Promise<File> {
  if (!file.type.startsWith("image/") || file.type === "image/gif" || file.size < minBytes) return file;
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.85));
    if (!blob || blob.size >= file.size) return file;
    return new File([blob], file.name.replace(/\.[^.]+$/, "") + ".jpg", { type: "image/jpeg" });
  } catch {
    return file; // formato não suportado pelo navegador (ex.: HEIC): envia como está
  }
}
