// StreamSaver - รับไฟล์ใหญ่แบบ Streaming (ไม่กิน RAM)
// ใช้ File System Access API (Chrome/Edge) หรือ Memory fallback

export interface StreamWriter {
  write(chunk: ArrayBuffer): Promise<void>;
  close(): Promise<void>;
  abort(): void;
}

// Memory limit for fallback writer (500MB)
const MEMORY_WRITER_LIMIT = 500 * 1024 * 1024;

// Check if File System Access API is supported
export function supportsFileSystemAccess(): boolean {
  return 'showSaveFilePicker' in window;
}

// Create a stream writer using File System Access API (best option)
export async function createFileSystemWriter(
  filename: string,
  mimeType: string
): Promise<StreamWriter | null> {
  if (!supportsFileSystemAccess()) return null;

  try {
    const handle = await (window as unknown as {
      showSaveFilePicker: (options: {
        suggestedName: string;
        types: { description: string; accept: Record<string, string[]> }[];
      }) => Promise<FileSystemFileHandle>;
    }).showSaveFilePicker({
      suggestedName: filename,
      types: [{
        description: 'File',
        accept: { [mimeType || 'application/octet-stream']: [`.${filename.split('.').pop() || 'bin'}`] }
      }]
    });

    const writable = await handle.createWritable();
    
    return {
      async write(chunk: ArrayBuffer) {
        await writable.write(chunk);
      },
      async close() {
        await writable.close();
      },
      abort() {
        writable.abort();
      }
    };
  } catch (err) {
    // User cancelled or not supported
    console.log('File System Access cancelled or not supported:', err);
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
  // For large files, try File System Access first (required for files > 500MB)
  if (expectedSize > 100 * 1024 * 1024) {
    if (supportsFileSystemAccess()) {
      const fsWriter = await createFileSystemWriter(filename, mimeType);
      if (fsWriter) {
        console.log('📁 Using File System Access API for large file');
        return fsWriter;
      }
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
  if (supportsFileSystemAccess()) {
    return Infinity; // No limit with File System Access
  }
  return MEMORY_WRITER_LIMIT;
}
