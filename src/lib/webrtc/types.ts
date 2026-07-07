// WebRTC Types
import type { StreamWriter } from '../streamSaver';
import type { ConnectionType } from './connectionRoute';

export interface FileOffer {
  from: { id: string; name: string; device: string; critter: { emoji: string; color: string } };
  file: { name: string; size: number; type: string };
  fileId: string;
}

export interface TextMessage {
  from: { id: string; name: string; device: string; critter: { emoji: string; color: string } };
  text: string;
  timestamp: number;
}

export interface TransferProgress {
  peerId: string;
  peerName: string;
  fileName: string;
  fileSize: number;
  progress: number;
  status: 'pending' | 'connecting' | 'sending' | 'receiving' | 'complete' | 'saving' | 'error';
  connectionType?: ConnectionType;
  rtt?: number;
}

export interface TransferResult {
  success: boolean;
  fileName: string;
  fileSize: number;
  peerName: string;
  direction: 'sent' | 'received';
  type?: 'file' | 'text';
  textContent?: string;
}


export interface ReceivingFile {
  chunks: ArrayBuffer[];
  info: { name: string; size: number; type: string };
  streamWriter?: StreamWriter;
  useStreaming: boolean;
  received: number;
  senderId?: string;
  _lastChunkTime?: number;
  _timeout?: NodeJS.Timeout;
}

export interface ReceivingText {
  chunks: string[];
  totalChunks: number;
  totalLength: number;
  received: number;
}

export const MAX_RETRIES = 1;
export const RETRY_DELAY = 800;
export const CONNECTION_TIMEOUT = 18000;

