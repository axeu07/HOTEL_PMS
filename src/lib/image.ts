/**
 * Reads a photo and redraws it as a JPEG no larger than `edge` pixels on its longest side. A phone
 * photo of an ID is several megabytes; this keeps it readable at a fraction of that, and it also
 * means whatever is stored is always a plain JPEG, never the file the guest picked.
 */
export function downscaleToJpeg(file: File, edge: number, quality = 0.82): Promise<string> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      const scale = Math.min(1, edge / Math.max(img.naturalWidth, img.naturalHeight));
      const width = Math.max(1, Math.round(img.naturalWidth * scale));
      const height = Math.max(1, Math.round(img.naturalHeight * scale));
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) return reject(new Error('This browser cannot prepare the photo.'));
      ctx.fillStyle = '#fff'; // A transparent PNG would otherwise turn black as a JPEG.
      ctx.fillRect(0, 0, width, height);
      ctx.drawImage(img, 0, 0, width, height);
      resolve(canvas.toDataURL('image/jpeg', quality));
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('That file could not be read as a photo. Please choose a JPG, PNG or WebP image.'));
    };
    img.src = url;
  });
}
