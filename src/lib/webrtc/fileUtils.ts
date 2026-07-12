// File Utilities
export function resolveMimeType(filename: string, suppliedType?: string): string {
  // บางเครื่องส่ง application/octet-stream มา แม้เป็นวิดีโอ
  if (
    suppliedType &&
    suppliedType !== 'application/octet-stream' &&
    suppliedType !== 'binary/octet-stream'
  ) {
    return suppliedType;
  }

  const extension = filename.toLowerCase().split('.').pop();

  const mimeTypes: Record<string, string> = {
    mp4: 'video/mp4',
    mov: 'video/quicktime',
    m4v: 'video/x-m4v',
    webm: 'video/webm',
    mkv: 'video/x-matroska',

    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    png: 'image/png',
    gif: 'image/gif',
    webp: 'image/webp',
    heic: 'image/heic',
    heif: 'image/heif',

    mp3: 'audio/mpeg',
    m4a: 'audio/mp4',
    wav: 'audio/wav',
    aac: 'audio/aac',

    pdf: 'application/pdf',
    zip: 'application/zip',
    txt: 'text/plain',
  };

  return mimeTypes[extension ?? ''] ?? 'application/octet-stream';
}

export function detectImageMimeType(file: File): string {
  return resolveMimeType(file.name, file.type);
}

export function isMobileDevice(): boolean {
  if (typeof navigator === 'undefined') return false;

  return (
    /Android|iPhone|iPad|iPod/i.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
  );
}

export function isVideoFile(filename: string, mimeType: string): boolean {
  return (
    mimeType.startsWith('video/') ||
    /\.(mp4|mov|m4v|webm|mkv)$/i.test(filename)
  );
}


export function validateFile(file: File): { valid: boolean; error?: string } {
  if (!file) {
    return { valid: false, error: 'File is null' };
  }
  if (file.size === 0) {
    return { valid: false, error: 'File is empty (0 bytes)' };
  }
  return { valid: true };
}

export function sanitizeFilename(filename: string): string {
  if (!filename) return 'downloaded_file';
  // Remove path traversal characters (/, \, ..), and other potentially problematic ones
  let clean = filename.replace(/^.*[\\/]/, '');
  clean = clean.replace(/[^a-zA-Z0-9.\-_\u0E00-\u0E7F\s()\[\]]/g, '_');
  // Trim spaces and dots from the ends
  clean = clean.replace(/^[.\s]+|[.\s]+$/g, '');
  return clean || 'downloaded_file';
}

export async function downloadBlob(
  rawBlob: Blob,
  rawFilename: string
): Promise<void> {
  const filename = sanitizeFilename(rawFilename);
  const mimeType = resolveMimeType(filename, rawBlob.type);
  const blob = new Blob([rawBlob], { type: mimeType });
  const mobile = isMobileDevice();

  if (mobile) {
    const file = new File([blob], filename, {
      type: mimeType,
      lastModified: Date.now(),
    });

    if (
      navigator.share &&
      navigator.canShare?.({ files: [file] })
    ) {
      try {
        await navigator.share({
          files: [file],
          title: filename,
        });

        return;
      } catch (error) {
        // AbortError คือผู้ใช้ปิด Share Sheet ไม่ถือว่าไฟล์เสีย
        if (
          error instanceof DOMException &&
          error.name === 'AbortError'
        ) {
          return;
        }

        console.warn('Web Share failed:', error);
      }
    }
  }

  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');

  anchor.href = url;
  anchor.download = filename;
  anchor.rel = 'noopener';
  anchor.style.display = 'none';

  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();

  // มือถืออาจเริ่มอ่าน Blob ช้า อย่า revoke เร็วเกินไป
  window.setTimeout(() => {
    URL.revokeObjectURL(url);
  }, 60_000);
}
