// File Transfer Logic
import { AdaptiveChunker } from '@/lib/adaptiveChunker';

export async function sendFileChunks(
  dc: RTCDataChannel,
  file: File,
  onProgress: (progress: number) => void
): Promise<void> {
  const chunker = new AdaptiveChunker();
  const fileSize = file.size;
  let sent = 0;
  let offset = 0;

  dc.bufferedAmountLowThreshold = 65536; // 64KB

  const READ_AHEAD = 2 * 1024 * 1024; // 2MB
  let readBuf: ArrayBuffer | null = null;
  let readBufOffset = 0;

  while (offset < fileSize) {
    // Read ahead from file
    if (!readBuf || readBufOffset >= readBuf.byteLength) {
      const end = Math.min(offset + READ_AHEAD, fileSize);
      try {
        readBuf = await file.slice(offset, end).arrayBuffer();
        readBufOffset = 0;
      } catch (sliceErr) {
        console.error('❌ Error reading file chunk:', sliceErr);
        throw new Error(`Failed to read file at offset ${offset}: ${sliceErr}`);
      }
    }

    // Get adaptive chunk size
    const CHUNK_SIZE = chunker.adjustChunkSize(dc.bufferedAmount, dc.bufferedAmountLowThreshold);
    const sliceEnd = Math.min(readBufOffset + CHUNK_SIZE, readBuf.byteLength);
    const chunk = readBuf.slice(readBufOffset, sliceEnd);
    const chunkLen = chunk.byteLength;

    // Wait if buffer is full
    if (dc.bufferedAmount > dc.bufferedAmountLowThreshold) {
      await waitForBufferDrain(dc);
    }

    dc.send(chunk);
    sent += chunkLen;
    offset += chunkLen;
    readBufOffset += chunkLen;

    // Update progress
    if (sent % (512 * 1024) < chunkLen || sent === fileSize) {
      const progress = Math.round((sent / fileSize) * 100);
      onProgress(progress);
      await new Promise(r => setTimeout(r, 0)); // Yield to UI
    }
  }

  readBuf = null;
}

async function waitForBufferDrain(dc: RTCDataChannel): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    let done = false;

    const cleanup = () => {
      if (done) return;
      done = true;
      dc.removeEventListener('bufferedamountlow', onLow);
      dc.removeEventListener('error', onError);
      dc.removeEventListener('close', onClose);
    };

    const onLow = () => {
      cleanup();
      resolve();
    };

    const onError = () => {
      cleanup();
      reject(new Error('DataChannel error during transfer'));
    };

    const onClose = () => {
      cleanup();
      reject(new Error('DataChannel closed during transfer'));
    };

    dc.addEventListener('bufferedamountlow', onLow);
    dc.addEventListener('error', onError);
    dc.addEventListener('close', onClose);

    if (dc.readyState !== 'open') {
      onClose();
    } else if (dc.bufferedAmount <= dc.bufferedAmountLowThreshold) {
      onLow();
    }
  });
}

export interface FileStartMessage {
  type: 'file-start';
  fileId: string;
  name: string;
  size: number;
  mimeType: string;
}

export interface FileEndMessage {
  type: 'file-end';
  fileId: string;
}

export interface TextMessage {
  type: 'text-message';
  payload: string;
}

export function createFileStartMessage(fileId: string, file: File, mimeType: string): string {
  return JSON.stringify({
    type: 'file-start',
    fileId,
    name: file.name,
    size: file.size,
    mimeType,
  } as FileStartMessage);
}

export function createFileEndMessage(fileId: string): string {
  return JSON.stringify({
    type: 'file-end',
    fileId,
  } as FileEndMessage);
}
