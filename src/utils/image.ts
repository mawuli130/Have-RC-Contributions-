/**
 * Shrinks a chosen photo to a small avatar (max 320px, JPEG) and returns a
 * data URL. Small is important: the data URL is stored with the profile,
 * and multi-megabyte originals overflow browser storage quotas — which
 * used to make profile photos silently vanish on refresh. Falls back to
 * the original file data if canvas decoding is unavailable.
 */
export function downscaleAvatarImage(file: File, maxSize = 320): Promise<string> {
  return new Promise((resolve) => {
    const fallback = () => {
      try {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result ?? ''));
        reader.onerror = () => resolve('');
        reader.readAsDataURL(file);
      } catch {
        resolve('');
      }
    };

    let objectUrl: string | null = null;
    try {
      objectUrl = URL.createObjectURL(file);
      const img = new Image();
      img.onload = () => {
        try {
          const scale = Math.min(1, maxSize / Math.max(img.width || 1, img.height || 1));
          const width = Math.max(1, Math.round((img.width || 1) * scale));
          const height = Math.max(1, Math.round((img.height || 1) * scale));
          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          if (!ctx) {
            if (objectUrl) URL.revokeObjectURL(objectUrl);
            fallback();
            return;
          }
          ctx.fillStyle = '#FFFFFF';
          ctx.fillRect(0, 0, width, height);
          ctx.drawImage(img, 0, 0, width, height);
          if (objectUrl) URL.revokeObjectURL(objectUrl);
          resolve(canvas.toDataURL('image/jpeg', 0.82));
        } catch {
          if (objectUrl) URL.revokeObjectURL(objectUrl);
          fallback();
        }
      };
      img.onerror = () => {
        if (objectUrl) URL.revokeObjectURL(objectUrl);
        fallback();
      };
      img.src = objectUrl;
    } catch {
      fallback();
    }
  });
}
