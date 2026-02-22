// StreamSaver - รับไฟล์ใหญ่แบบ Streaming (ไม่กิน RAM)

export interface StreamWriter {
  write(chunk: ArrayBuffer): Promise<void>;
  close(): Promise<void>;
  abort(): void;
}

// Fallback limits depending on device type
const isMobile = typeof navigator !== 'undefined' && /Android|webOS|iPhone|iPad|iPod/i.test(navigator.userAgent);
const MEMORY_WRITER_LIMIT = isMobile ? 150 * 1024 * 1024 : 500 * 1024 * 1024;

export function supportsFileSystemAccess(): boolean {
  // We now use StreamSaver which works across all modern browsers
  // by utilizing a service worker to intercept the download.
  return true;
}

// Create a stream writer using StreamSaver
export async function createFileSystemWriter(
  filename: string
): Promise<StreamWriter | null> {
  try {
    // StreamSaver uses a Service Worker, which requires a secure context (HTTPS)
    // Localhost is considered secure, but other IPs over HTTP are not.
    if (typeof window !== 'undefined' && !window.isSecureContext) {
      console.warn('⚠️ StreamSaver requires HTTPS or localhost. Falling back to Memory Buffer.');
      return null;
    }

    // กำหนด Service Worker ของ StreamSaver (เพื่อรองรับ cross-origin if needed)
    // แต่ค่าเริ่มต้นมันจะไปใช้ของ jimmywarting.github.io ซึ่งโอเคสำหรับ P2P เบื้องต้น
    // ถ้าเรามี mitm.html ของเราเองก็ปรับได้ แต่ตัว default เสถียรสุดครัช
    
    // Dynamic import to avoid SSR errors (StreamSaver uses window/document)
    const streamSaver = (await import('streamsaver')).default;

    console.log('🚀 Initiating StreamSaver for:', filename);
    const fileStream = streamSaver.createWriteStream(filename, {
      size: undefined, // undefined ให้มันโหลดเรื่อยๆจนกว่าจะ close
    });
    
    const writer = fileStream.getWriter();
    
    return {
      async write(chunk: ArrayBuffer) {
        await writer.write(new Uint8Array(chunk));
      },
      async close() {
        await writer.close();
      },
      abort() {
        writer.abort();
      }
    };
  } catch (err) {
    console.log('StreamSaver initialization failed:', err);
    return null;
  }
}

// Error class for file too large
export class FileTooLargeError extends Error {
  constructor(fileSize: number, limit: number) {
    super(`ไฟล์ใหญ่เกินไป (${(fileSize / 1024 / 1024).toFixed(0)}MB) - Browser นี้รองรับสูงสุด ${(limit / 1024 / 1024).toFixed(0)}MB`);
    this.name = 'FileTooLargeError';
  }
}

// Fallback: collect chunks in memory then download (for Safari/Firefox)
// WARNING: Has memory limit - will throw FileTooLargeError if exceeded
export function createMemoryWriter(
  filename: string,
  mimeType: string,
  expectedSize: number,
  onProgress?: (received: number) => void
): StreamWriter {
  const chunks: ArrayBuffer[] = [];
  let received = 0;
  let aborted = false;

  // Hard limit check - reject files too large for memory
  if (expectedSize > MEMORY_WRITER_LIMIT) {
    throw new FileTooLargeError(expectedSize, MEMORY_WRITER_LIMIT);
  }

  // Warn if file is getting large
  if (expectedSize > 200 * 1024 * 1024) {
    console.warn(`⚠️ Large file (${(expectedSize / 1024 / 1024).toFixed(0)}MB) - using memory buffer`);
  }

  return {
    async write(chunk: ArrayBuffer) {
      if (aborted) return;
      
      // Runtime check in case expectedSize was wrong
      if (received + chunk.byteLength > MEMORY_WRITER_LIMIT) {
        aborted = true;
        chunks.length = 0;
        throw new FileTooLargeError(received + chunk.byteLength, MEMORY_WRITER_LIMIT);
      }
      
      chunks.push(chunk);
      received += chunk.byteLength;
      onProgress?.(received);
    },
    async close() {
      if (aborted) return;
      
      const blob = new Blob(chunks, { type: mimeType || 'application/octet-stream' });
      const url = URL.createObjectURL(blob);
      
      // Download
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      
      // Cleanup immediately after click initiated
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      chunks.length = 0; // Free memory
    },
    abort() {
      aborted = true;
      chunks.length = 0;
    }
  };
}

// Smart writer - uses best available method
export async function createStreamWriter(
  filename: string,
  mimeType: string,
  expectedSize: number,
  onProgress?: (received: number) => void
): Promise<StreamWriter> {
  // For large files, try StreamSaver first
  if (expectedSize > 100 * 1024 * 1024) {
    const fsWriter = await createFileSystemWriter(filename);
    if (fsWriter) {
      console.log('📁 Using StreamSaver for large file');
      return fsWriter;
    }
    
    // If File System Access not available and file > limit, throw error
    if (expectedSize > MEMORY_WRITER_LIMIT) {
      throw new FileTooLargeError(expectedSize, MEMORY_WRITER_LIMIT);
    }
  }

  // Fallback to memory (with limit protection)
  console.log('💾 Using memory buffer for file download');
  return createMemoryWriter(filename, mimeType, expectedSize, onProgress);
}

// Check if we should use streaming (for large files)
export function shouldUseStreaming(fileSize: number): boolean {
  // Use streaming for files > 50MB
  return fileSize > 50 * 1024 * 1024;
}

// Get max receivable file size for current browser
export function getMaxReceivableSize(): number {
  return Infinity; // StreamSaver allows unlimited size
}
