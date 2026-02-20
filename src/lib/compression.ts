// File Compression - บีบอัดไฟล์ก่อนส่ง
// ใช้ CompressionStream API (supported in modern browsers)

export async function compressData(data: ArrayBuffer): Promise<ArrayBuffer> {
  // Check if CompressionStream is supported
  if (typeof CompressionStream === 'undefined') {
    return data; // Return original if not supported
  }

  try {
    const stream = new ReadableStream({
      start(controller) {
        controller.enqueue(new Uint8Array(data));
        controller.close();
      }
    });

    const compressedStream = stream.pipeThrough(new CompressionStream('gzip'));
    const reader = compressedStream.getReader();
    const chunks: Uint8Array[] = [];

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value);
    }

    const totalLength = chunks.reduce((acc, chunk) => acc + chunk.length, 0);
    const result = new Uint8Array(totalLength);
    let offset = 0;
    for (const chunk of chunks) {
      result.set(chunk, offset);
      offset += chunk.length;
    }

    // Only use compressed if it's actually smaller
    if (result.buffer.byteLength < data.byteLength * 0.9) {
      return result.buffer;
    }
    return data;
  } catch {
    return data;
  }
}

export async function decompressData(data: ArrayBuffer): Promise<ArrayBuffer> {
  if (typeof DecompressionStream === 'undefined') {
    return data;
  }

  try {
    const stream = new ReadableStream({
      start(controller) {
        controller.enqueue(new Uint8Array(data));
        controller.close();
      }
    });

    const decompressedStream = stream.pipeThrough(new DecompressionStream('gzip'));
    const reader = decompressedStream.getReader();
    const chunks: Uint8Array[] = [];

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value);
    }

    const totalLength = chunks.reduce((acc, chunk) => acc + chunk.length, 0);
    const result = new Uint8Array(totalLength);
    let offset = 0;
    for (const chunk of chunks) {
      result.set(chunk, offset);
      offset += chunk.length;
    }

    return result.buffer;
  } catch {
    return data;
  }
}

// Check if compression is worth it for this file type
export function shouldCompress(mimeType: string): boolean {
  // Already compressed formats
  const compressedTypes = [
    'image/jpeg', 'image/png', 'image/gif', 'image/webp',
    'video/', 'audio/',
    'application/zip', 'application/gzip', 'application/x-rar',
    'application/pdf',
  ];
  
  return !compressedTypes.some(t => mimeType.startsWith(t));
}
