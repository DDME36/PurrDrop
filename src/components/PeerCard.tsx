'use client';

import { Peer } from '@/lib/critters';
import { useRef } from 'react';



interface PeerCardProps {
  peer: Peer;
  isNew?: boolean;
  onSelect: (peer: Peer) => void;
  onDrop: (peer: Peer, files: FileWithContext[]) => void;
}

// Max files allowed in single drop
// Max files allowed in single drop
const MAX_FILES = 500;
const MAX_TOTAL_SIZE = 2 * 1024 * 1024 * 1024; // 2GB

export interface FileWithContext {
  file: File;
  path: string; // e.g. "photos/beach.jpg" or just "beach.jpg"
}

// Recursively get all files from a directory entry (with limits)
async function getFilesFromEntry(
  entry: FileSystemEntry,
  path: string,
  files: FileWithContext[],
  totalSize: { value: number }
): Promise<void> {
  // Check limits
  if (files.length >= MAX_FILES || totalSize.value >= MAX_TOTAL_SIZE) {
    return;
  }

  if (entry.isFile) {
    return new Promise((resolve) => {
      (entry as FileSystemFileEntry).file((file) => {
        if (files.length < MAX_FILES && totalSize.value + file.size <= MAX_TOTAL_SIZE) {
          // Use the full recursive path + filename
          files.push({ file, path: path + file.name });
          totalSize.value += file.size;
        }
        resolve();
      }, () => resolve());
    });
  } else if (entry.isDirectory) {
    const dirReader = (entry as FileSystemDirectoryEntry).createReader();
    const currentPath = path + entry.name + '/';

    const readBatch = (): Promise<void> => {
      return new Promise((resolve) => {
        dirReader.readEntries(async (entries) => {
          if (entries.length === 0 || files.length >= MAX_FILES) {
            resolve();
            return;
          }

          for (const e of entries) {
            if (files.length >= MAX_FILES || totalSize.value >= MAX_TOTAL_SIZE) break;
            await getFilesFromEntry(e, currentPath, files, totalSize);
          }

          // Continue reading (directories may have batched results)
          if (files.length < MAX_FILES) {
            await readBatch();
          }
          resolve();
        }, () => resolve());
      });
    };

    await readBatch();
  }
}

// Get all files from DataTransfer (supports folders, with limits)
async function getFilesFromDataTransfer(dataTransfer: DataTransfer): Promise<{ files: FileWithContext[]; limited: boolean }> {
  const files: FileWithContext[] = [];
  const totalSize = { value: 0 };
  const items = dataTransfer.items;

  // Try to use webkitGetAsEntry for folder support
  const entries: FileSystemEntry[] = [];
  for (let i = 0; i < items.length; i++) {
    const entry = items[i].webkitGetAsEntry?.();
    if (entry) {
      entries.push(entry);
    }
  }

  if (entries.length > 0) {
    for (const entry of entries) {
      if (files.length >= MAX_FILES || totalSize.value >= MAX_TOTAL_SIZE) break;
      // Start with empty path for root items
      await getFilesFromEntry(entry, '', files, totalSize);
    }
    const limited = files.length >= MAX_FILES || totalSize.value >= MAX_TOTAL_SIZE;
    return { files, limited };
  }

  // Fallback to regular files (flattened, no folder structure info widely available this way)
  const regularFiles = Array.from(dataTransfer.files).slice(0, MAX_FILES).map(f => ({
    file: f,
    path: f.name // Fallback: just filename
  }));
  return { files: regularFiles, limited: dataTransfer.files.length > MAX_FILES };
}

export function PeerCard({ peer, isNew, onSelect, onDrop }: PeerCardProps) {
  const cardRef = useRef<HTMLDivElement>(null);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    cardRef.current?.classList.add('drag-over');
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!cardRef.current?.contains(e.relatedTarget as Node)) {
      cardRef.current?.classList.remove('drag-over');
    }
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    cardRef.current?.classList.remove('drag-over');

    const { files, limited } = await getFilesFromDataTransfer(e.dataTransfer);
    if (files.length > 0) {
      if (limited) {
        console.warn(`⚠️ File limit reached: only sending first ${files.length} files`);
      }
      onDrop(peer, files);
    }
  };

  return (
    <div
      ref={cardRef}
      className={`peer-card ${isNew ? 'entering' : ''}`}
      style={{ '--critter-color': peer.critter.color } as React.CSSProperties}
      onClick={() => onSelect(peer)}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      <span className="heart-float">💕</span>
      <div className="drop-overlay">
        <span className="drop-icon">📁</span>
        <span className="drop-text">วางไฟล์หรือโฟลเดอร์!</span>
      </div>
      <div className="peer-cloud">
        <div className="peer-critter">{peer.critter.emoji}</div>
      </div>
      <div className="peer-name">{peer.name}</div>
      <div className="peer-device">{peer.device}</div>
    </div>
  );
}
