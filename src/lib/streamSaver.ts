// StreamSaver - รับไฟล์ทุกขนาดแบบ Streaming (ลด RAM)
// ลำดับ: File System Access API → StreamSaver → Memory Buffer (chunked Blob)

export interface StreamWriter {
  write(chunk: ArrayBuffer): Promise<void>;
  close(): Promise<void>;
  abort(): void;
}

// ─── 1. File System Access API (Chrome/Edge — เขียนตรงลง disk) ───
async function createFileSystemAccessWriter(
  filename: string
): Promise<StreamWriter | null> {
  try {
    if (typeof window === 'undefined') return null;

    // showSaveFilePicker is only available in secure Chromium browsers
    if (!('showSaveFilePicker' in window)) return null;

    const handle = await (window as unknown as { showSaveFilePicker: (opts: unknown) => Promise<FileSystemFileHandle> })
      .showSaveFilePicker({
        suggestedName: filename,
        types: [
          {
            description: 'All Files',
            accept: { 'application/octet-stream': [] },
          },
        ],
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
        writable.abort().catch(() => {});
      },
    };
  } catch (err) {
    // User cancelled picker or API not supported
    console.log('File System Access not available:', err);
    return null;
  }
}

// ─── 2. StreamSaver (cross-browser streaming via SW proxy) ───
async function createStreamSaverWriter(
  filename: string
): Promise<StreamWriter | null> {
  try {
    if (typeof window !== 'undefined' && !window.isSecureContext) {
      console.warn('⚠️ StreamSaver requires HTTPS or localhost.');
      return null;
    }

    const streamSaver = (await import('streamsaver')).default;
    console.log('🚀 Initiating StreamSaver for:', filename);

    const fileStream = streamSaver.createWriteStream(filename, {
      size: undefined,
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
      },
    };
  } catch (err) {
    console.log('StreamSaver initialization failed:', err);
    return null;
  }
}

// ─── 3. Memory Buffer — ใช้ chunked Blob merging เพื่อลด RAM ───
// ArrayBuffer chunks จะถูก merge เป็น Blob ทุก MERGE_THRESHOLD
// Blob ถูกเก็บใน browser blob storage (disk-backed) ไม่กิน JS heap
const MERGE_THRESHOLD = 50 * 1024 * 1024; // 50MB

export function createMemoryWriter(
  filename: string,
  mimeType: string,
  _expectedSize: number,
  onProgress?: (received: number) => void
): StreamWriter {
  // accumulatedBlobs เก็บ Blob ที่ merge แล้ว (อยู่ใน disk storage)
  const accumulatedBlobs: Blob[] = [];
  // currentChunks เก็บ ArrayBuffer ที่ยังไม่ merge (อยู่ใน JS heap)
  let currentChunks: ArrayBuffer[] = [];
  let currentChunkBytes = 0;
  let totalReceived = 0;
  let aborted = false;

  if (_expectedSize > 200 * 1024 * 1024) {
    console.warn(`⚠️ Large file (${(_expectedSize / 1024 / 1024).toFixed(0)}MB) - using chunked blob merging to save RAM`);
  }

  return {
    async write(chunk: ArrayBuffer) {
      if (aborted) return;

      currentChunks.push(chunk);
      currentChunkBytes += chunk.byteLength;
      totalReceived += chunk.byteLength;
      onProgress?.(totalReceived);

      // Periodically merge ArrayBuffers into a Blob to free JS heap
      // Blob data is moved to browser's blob storage (disk-backed)
      if (currentChunkBytes >= MERGE_THRESHOLD) {
        accumulatedBlobs.push(new Blob(currentChunks));
        currentChunks = []; // Release ArrayBuffer references → GC can free heap
        currentChunkBytes = 0;
        console.log(`💾 Merged chunks into blob (${accumulatedBlobs.length * 50}MB buffered, RAM freed)`);
      }
    },
    async close() {
      if (aborted) return;

      // Merge any remaining chunks
      if (currentChunks.length > 0) {
        accumulatedBlobs.push(new Blob(currentChunks));
        currentChunks = [];
        currentChunkBytes = 0;
      }

      // Create final blob from accumulated blobs (memory efficient —
      // browser just links the existing disk-backed blobs together)
      const finalBlob = new Blob(accumulatedBlobs, { type: mimeType || 'application/octet-stream' });
      accumulatedBlobs.length = 0; // Release blob references

      const url = URL.createObjectURL(finalBlob);

      // Check if iOS Safari
      const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);

      if (isIOS) {
        // iOS: open in new tab so user can save
        const newWindow = window.open(url, '_blank');
        if (!newWindow) {
          const a = document.createElement('a');
          a.href = url;
          a.download = filename;
          a.target = '_blank';
          a.rel = 'noopener noreferrer';
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
        }
      } else {
        // Other browsers: direct download
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
      }

      // Keep URL alive for a while for the download to start
      setTimeout(() => URL.revokeObjectURL(url), 30000);
    },
    abort() {
      aborted = true;
      currentChunks = [];
      accumulatedBlobs.length = 0;
    },
  };
}

// ─── Smart Writer — ลองทุกวิธีจนกว่าจะได้ ───
export async function createStreamWriter(
  filename: string,
  mimeType: string,
  expectedSize: number,
  onProgress?: (received: number) => void
): Promise<StreamWriter> {
  // For large files (> 50MB), try disk-based approaches first
  if (expectedSize > 50 * 1024 * 1024) {
    // 1. Try File System Access API (best: writes directly to disk)
    const fsWriter = await createFileSystemAccessWriter(filename);
    if (fsWriter) {
      console.log('📁 Using File System Access API (direct disk write)');
      return fsWriter;
    }

    // 2. Try StreamSaver (streams via SW proxy)
    const ssWriter = await createStreamSaverWriter(filename);
    if (ssWriter) {
      console.log('📁 Using StreamSaver for large file');
      return ssWriter;
    }
  }

  // 3. Fallback: Chunked memory buffer — merges to Blob every 50MB to save RAM
  console.log('💾 Using chunked memory buffer for file download');
  return createMemoryWriter(filename, mimeType, expectedSize, onProgress);
}

// Check if we should use streaming (for large files)
export function shouldUseStreaming(fileSize: number): boolean {
  return fileSize > 50 * 1024 * 1024;
}

// Get max receivable file size for current browser
export function getMaxReceivableSize(): number {
  return Infinity;
}
