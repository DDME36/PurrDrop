// File Compression & ZIP utilities

export interface FileWithContext {
  file: File;
  path: string;
}

// Max 100MB for ZIP to prevent RAM issues
const MAX_ZIP_SIZE = 100 * 1024 * 1024;

// CRC32 lookup table
const crc32Table: number[] = (() => {
  const table: number[] = [];
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let j = 0; j < 8; j++) {
      c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
    }
    table[i] = c >>> 0;
  }
  return table;
})();

function calcCrc32(data: Uint8Array): number {
  let crc = 0xFFFFFFFF;
  for (let i = 0; i < data.length; i++) {
    crc = (crc >>> 8) ^ crc32Table[(crc ^ data[i]) & 0xFF];
  }
  return (crc ^ 0xFFFFFFFF) >>> 0;
}

/**
 * Create a ZIP file from multiple files with folder structure
 * Uses 'store' method (no compression) to save CPU and RAM.
 * Returns null if total size exceeds MAX_ZIP_SIZE
 */
export async function createZipFile(filesWithContext: FileWithContext[]): Promise<File | null> {
  const totalSize = filesWithContext.reduce((acc, item) => acc + item.file.size, 0);

  // Return null if too large (caller should send files individually)
  if (totalSize > MAX_ZIP_SIZE) {
    console.warn(`⚠️ Total size ${(totalSize / 1024 / 1024).toFixed(1)}MB exceeds ZIP limit`);
    return null;
  }

  console.log(`📦 Creating ZIP: ${filesWithContext.length} files, ${(totalSize / 1024 / 1024).toFixed(1)}MB`);

  let zipSize = 22; // End of central directory record
  const fileInfos: { name: Uint8Array; data: Uint8Array; crc: number }[] = [];
  const encoder = new TextEncoder();

  // Process each file
  for (const { file, path } of filesWithContext) {
    const data = new Uint8Array(await file.arrayBuffer());
    const name = encoder.encode(path);
    const crc = calcCrc32(data);

    console.log(`📦 Bundling: ${path} (${file.type || 'unknown'})`);

    fileInfos.push({ name, data, crc });
    zipSize += 30 + name.length + data.length; // Local file header + data
    zipSize += 46 + name.length; // Central directory entry
  }

  // Create ZIP buffer
  const buffer = new ArrayBuffer(zipSize);
  const view = new DataView(buffer);
  const bytes = new Uint8Array(buffer);
  let pos = 0;

  // Write local file headers + data
  for (const { name, data, crc } of fileInfos) {
    view.setUint32(pos, 0x04034b50, true); pos += 4; // Local file header signature
    view.setUint16(pos, 20, true); pos += 2; // Version needed
    view.setUint16(pos, 0, true); pos += 2; // Flags
    view.setUint16(pos, 0, true); pos += 2; // Compression method (0 = store)
    view.setUint16(pos, 0, true); pos += 2; // Mod time
    view.setUint16(pos, 0, true); pos += 2; // Mod date
    view.setUint32(pos, crc, true); pos += 4; // CRC-32
    view.setUint32(pos, data.length, true); pos += 4; // Compressed size
    view.setUint32(pos, data.length, true); pos += 4; // Uncompressed size
    view.setUint16(pos, name.length, true); pos += 2; // Filename length
    view.setUint16(pos, 0, true); pos += 2; // Extra field length
    bytes.set(name, pos); pos += name.length; // Filename
    bytes.set(data, pos); pos += data.length; // File data
  }

  const cdStart = pos;

  // Write central directory
  let localOffset = 0;
  for (const { name, data, crc } of fileInfos) {
    view.setUint32(pos, 0x02014b50, true); pos += 4; // Central directory signature
    view.setUint16(pos, 20, true); pos += 2; // Version made by
    view.setUint16(pos, 20, true); pos += 2; // Version needed
    view.setUint16(pos, 0, true); pos += 2; // Flags
    view.setUint16(pos, 0, true); pos += 2; // Compression method
    view.setUint16(pos, 0, true); pos += 2; // Mod time
    view.setUint16(pos, 0, true); pos += 2; // Mod date
    view.setUint32(pos, crc, true); pos += 4; // CRC-32
    view.setUint32(pos, data.length, true); pos += 4; // Compressed size
    view.setUint32(pos, data.length, true); pos += 4; // Uncompressed size
    view.setUint16(pos, name.length, true); pos += 2; // Filename length
    view.setUint16(pos, 0, true); pos += 2; // Extra field length
    view.setUint16(pos, 0, true); pos += 2; // Comment length
    view.setUint16(pos, 0, true); pos += 2; // Disk number
    view.setUint16(pos, 0, true); pos += 2; // Internal attributes
    view.setUint32(pos, 0, true); pos += 4; // External attributes
    view.setUint32(pos, localOffset, true); pos += 4; // Local header offset
    bytes.set(name, pos); pos += name.length; // Filename
    localOffset += 30 + name.length + data.length;
  }

  const cdSize = pos - cdStart;

  // Write end of central directory
  view.setUint32(pos, 0x06054b50, true); pos += 4; // EOCD signature
  view.setUint16(pos, 0, true); pos += 2; // Disk number
  view.setUint16(pos, 0, true); pos += 2; // Disk with central directory
  view.setUint16(pos, fileInfos.length, true); pos += 2; // Entries on this disk
  view.setUint16(pos, fileInfos.length, true); pos += 2; // Total entries
  view.setUint32(pos, cdSize, true); pos += 4; // Central directory size
  view.setUint32(pos, cdStart, true); pos += 4; // Central directory offset
  view.setUint16(pos, 0, true); // Comment length

  const timestamp = new Date().toISOString().slice(0, 10);
  return new File([buffer], `PurrDrop_${timestamp}.zip`, { type: 'application/zip' });
}

// Legacy compression functions (kept for compatibility)
export async function compressData(data: ArrayBuffer): Promise<ArrayBuffer> {
  if (typeof CompressionStream === 'undefined') {
    return data;
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

export function shouldCompress(mimeType: string): boolean {
  const compressedTypes = [
    'image/jpeg', 'image/png', 'image/gif', 'image/webp',
    'video/', 'audio/',
    'application/zip', 'application/gzip', 'application/x-rar',
    'application/pdf',
  ];
  
  return !compressedTypes.some(t => mimeType.startsWith(t));
}
