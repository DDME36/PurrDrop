// Transfer History - เก็บประวัติการส่ง/รับไฟล์
export interface TransferRecord {
  id: string;
  fileName: string;
  fileSize: number;
  peerName: string;
  direction: 'sent' | 'received';
  timestamp: number;
  success: boolean;
}

const STORAGE_KEY = 'purrdrop_history';
const MAX_RECORDS = 50;

export function getHistory(): TransferRecord[] {
  if (typeof window === 'undefined') return [];
  try {
    const data = localStorage.getItem(STORAGE_KEY);
    return data ? JSON.parse(data) : [];
  } catch {
    return [];
  }
}

export function addToHistory(record: Omit<TransferRecord, 'id' | 'timestamp'>): TransferRecord {
  const newRecord: TransferRecord = {
    ...record,
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    timestamp: Date.now(),
  };

  const history = getHistory();
  history.unshift(newRecord);
  
  // Keep only last N records
  const trimmed = history.slice(0, MAX_RECORDS);
  
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(trimmed));
  } catch {
    // Storage full, clear old records
    localStorage.setItem(STORAGE_KEY, JSON.stringify(trimmed.slice(0, 10)));
  }

  return newRecord;
}

export function clearHistory() {
  localStorage.removeItem(STORAGE_KEY);
}

export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

export function formatTime(timestamp: number): string {
  const date = new Date(timestamp);
  const now = new Date();
  const diff = now.getTime() - timestamp;
  
  if (diff < 60000) return 'เมื่อกี้';
  if (diff < 3600000) return `${Math.floor(diff / 60000)} นาทีที่แล้ว`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)} ชั่วโมงที่แล้ว`;
  if (date.toDateString() === now.toDateString()) {
    return date.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' });
  }
  return date.toLocaleDateString('th-TH', { day: 'numeric', month: 'short' });
}
