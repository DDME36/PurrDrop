// StreamSaver - รับไฟล์ใหญ่แบบ Streaming (ไม่กิน RAM)
// ใช้ File System Access API (Chrome/Edge) หรือ Service Worker fallback

export interface StreamWriter {
  write(chunk: ArrayBuffer): Promise<void>;
  close(): Promise<void>;
  abort(): void;
}

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

// Fallback: collect chunks in memory then download (for Safari/Firefox)
export function createMemoryWriter(
  filename: string,
  mimeType: string,
  expectedSize: number,
  onProgress?: (received: number) => void
): StreamWriter {
  const chunks: ArrayBuffer[] = [];
  let received = 0;
  let aborted = false;

  // Warn if file is very large
  if (expectedSize > 500 * 1024 * 1024) {
    console.warn(`⚠️ Large file (${(expectedSize / 1024 / 1024).toFixed(0)}MB) - may use significant memory`);
  }

  return {
    async write(chunk: ArrayBuffer) {
      if (aborted) return;
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
      
      // Cleanup
      setTimeout(() => URL.revokeObjectURL(url), 5000);
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
  // For large files on supported browsers, use File System Access
  if (expectedSize > 100 * 1024 * 1024 && supportsFileSystemAccess()) {
    const fsWriter = await createFileSystemWriter(filename, mimeType);
    if (fsWriter) {
      console.log('📁 Using File System Access API for large file');
      return fsWriter;
    }
  }

  // Fallback to memory
  console.log('💾 Using memory buffer for file download');
  return createMemoryWriter(filename, mimeType, expectedSize, onProgress);
}

// Check if we should use streaming (for large files)
export function shouldUseStreaming(fileSize: number): boolean {
  // Use streaming for files > 50MB
  return fileSize > 50 * 1024 * 1024;
}
