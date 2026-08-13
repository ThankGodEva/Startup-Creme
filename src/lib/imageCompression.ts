export interface ImageCompressionOptions {
  maxWidth?: number;
  maxHeight?: number;
  quality?: number;
  mimeType?: string;
}

export interface CompressionResult {
  file: File;
  originalSize: number;
  compressedSize: number;
  ratio: string;
}

/**
 * Compresses and resizes an image file before upload.
 * Reduces file size significantly (often by 80-95%) while maintaining crisp visual quality.
 */
export async function compressImage(
  file: File,
  options: ImageCompressionOptions = {}
): Promise<CompressionResult> {
  const {
    maxWidth = 1920,
    maxHeight = 1920,
    quality = 0.82,
    mimeType = 'image/webp'
  } = options;

  const originalSize = file.size;

  // Don't compress SVGs or animated GIFs to avoid breaking vector graphics or animations
  if (file.type === 'image/svg+xml' || file.type === 'image/gif') {
    return {
      file,
      originalSize,
      compressedSize: originalSize,
      ratio: '0%'
    };
  }

  return new Promise((resolve) => {
    const reader = new FileReader();

    reader.onload = (e) => {
      const img = new Image();

      img.onload = () => {
        let width = img.width;
        let height = img.height;

        // Calculate aspect ratio preserving dimensions
        if (width > maxWidth || height > maxHeight) {
          if (width / height > maxWidth / maxHeight) {
            height = Math.round((height * maxWidth) / width);
            width = maxWidth;
          } else {
            width = Math.round((width * maxHeight) / height);
            height = maxHeight;
          }
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext('2d');
        if (!ctx) {
          return resolve({
            file,
            originalSize,
            compressedSize: originalSize,
            ratio: '0%'
          });
        }

        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(img, 0, 0, width, height);

        // Convert canvas to compressed WebP Blob
        canvas.toBlob(
          (blob) => {
            if (!blob) {
              return resolve({
                file,
                originalSize,
                compressedSize: originalSize,
                ratio: '0%'
              });
            }

            // If compressed file turns out larger than original, stick with original
            if (blob.size >= originalSize) {
              return resolve({
                file,
                originalSize,
                compressedSize: originalSize,
                ratio: '0%'
              });
            }

            const extension = mimeType === 'image/webp' ? '.webp' : '.jpg';
            const cleanName = file.name.replace(/\.[^/.]+$/, '');
            const newFilename = `${cleanName}${extension}`;

            const compressedFile = new File([blob], newFilename, {
              type: mimeType,
              lastModified: Date.now()
            });

            const savedBytes = originalSize - blob.size;
            const ratioPercent = Math.round((savedBytes / originalSize) * 100);

            resolve({
              file: compressedFile,
              originalSize,
              compressedSize: blob.size,
              ratio: `-${ratioPercent}%`
            });
          },
          mimeType,
          quality
        );
      };

      img.onerror = () => {
        resolve({
          file,
          originalSize,
          compressedSize: originalSize,
          ratio: '0%'
        });
      };

      img.src = e.target?.result as string;
    };

    reader.onerror = () => {
      resolve({
        file,
        originalSize,
        compressedSize: originalSize,
        ratio: '0%'
      });
    };

    reader.readAsDataURL(file);
  });
}

export function formatBytes(bytes: number, decimals = 1): string {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}
