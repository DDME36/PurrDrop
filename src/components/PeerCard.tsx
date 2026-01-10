'use client';

import { Peer } from '@/lib/critters';
import { useRef } from 'react';

interface PeerCardProps {
  peer: Peer;
  isNew?: boolean;
  onSelect: (peer: Peer) => void;
  onDrop: (peer: Peer, files: File[]) => void;
}

// Recursively get all files from a directory entry
async function getFilesFromEntry(entry: FileSystemEntry): Promise<File[]> {
  if (entry.isFile) {
    return new Promise((resolve) => {
      (entry as FileSystemFileEntry).file((file) => {
        resolve([file]);
      }, () => resolve([]));
    });
  } else if (entry.isDirectory) {
    const dirReader = (entry as FileSystemDirectoryEntry).createReader();
    const files: File[] = [];
    
    const readEntries = (): Promise<File[]> => {
      return new Promise((resolve) => {
        dirReader.readEntries(async (entries) => {
          if (entries.length === 0) {
            resolve(files);
          } else {
            for (const e of entries) {
              const subFiles = await getFilesFromEntry(e);
              files.push(...subFiles);
            }
            // Continue reading (directories may have batched results)
            const moreFiles = await readEntries();
            resolve(moreFiles);
          }
        }, () => resolve(files));
      });
    };
    
    return readEntries();
  }
  return [];
}

// Get all files from DataTransfer (supports folders)
async function getFilesFromDataTransfer(dataTransfer: DataTransfer): Promise<File[]> {
  const files: File[] = [];
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
      const entryFiles = await getFilesFromEntry(entry);
      files.push(...entryFiles);
    }
    return files;
  }
  
  // Fallback to regular files
  return Array.from(dataTransfer.files);
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
    
    const files = await getFilesFromDataTransfer(e.dataTransfer);
    if (files.length > 0) {
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
