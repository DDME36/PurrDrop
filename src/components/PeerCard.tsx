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
      role="button"
      tabIndex={0}
      aria-label={`ส่งไฟล์ให้ ${peer.name} (${peer.device})`}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onSelect(peer);
        }
      }}
    >
      <span className="heart-float">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="var(--accent-pink)" opacity="0.7">
          <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
        </svg>
      </span>
      <div className="drop-overlay">
        <span className="drop-icon">
          <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
          </svg>
        </span>
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
