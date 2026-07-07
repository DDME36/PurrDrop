// Centralized Error Handling
export type ErrorType = 
  | 'network'
  | 'webrtc'
  | 'relay'
  | 'connection'
  | 'file'
  | 'permission'
  | 'timeout'
  | 'unknown';

export interface AppError {
  type: ErrorType;
  message: string;
  originalError?: unknown;
  userMessage: string;
  canRetry: boolean;
  suggestedAction?: string;
}

export function handleError(error: unknown, context: string): AppError {
  console.error(`❌ Error in ${context}:`, error);

  const msg = error instanceof Error ? error.message : String(error);

  // Relay errors (ACK timeout, chunk timeout, peer disconnect during relay)
  if (msg.includes('Relay') || msg.includes('relay') || msg.includes('ผู้รับไม่ตอบสนอง')) {
    return {
      type: 'relay',
      message: msg,
      originalError: error,
      userMessage: 'การส่งผ่าน Relay ล้มเหลว',
      canRetry: true,
      suggestedAction: 'ลองส่งใหม่อีกครั้ง',
    };
  }

  // Connection loss during transfer
  if (msg.includes('disconnect') || msg.includes('ตัดการเชื่อมต่อ') || msg.includes('Socket disconnected')) {
    return {
      type: 'connection',
      message: msg,
      originalError: error,
      userMessage: 'การเชื่อมต่อขาดหายระหว่างส่งไฟล์',
      canRetry: true,
      suggestedAction: 'รอสักครู่แล้วลองส่งใหม่',
    };
  }

  // Network errors
  if (msg.includes('network') || msg.includes('fetch') || msg.includes('No internet')) {
    return {
      type: 'network',
      message: msg,
      originalError: error,
      userMessage: 'เชื่อมต่ออินเทอร์เน็ตไม่ได้',
      canRetry: true,
      suggestedAction: 'ตรวจสอบการเชื่อมต่ออินเทอร์เน็ต',
    };
  }

  // WebRTC errors
  if (msg.includes('ICE') || msg.includes('DataChannel') || msg.includes('Connection timeout')) {
    return {
      type: 'webrtc',
      message: msg,
      originalError: error,
      userMessage: 'การเชื่อมต่อ P2P ล้มเหลว',
      canRetry: true,
      suggestedAction: 'กำลังลองส่งผ่าน server...',
    };
  }

  // File errors
  if (msg.includes('file') || msg.includes('read') || msg.includes('Failed to read')) {
    return {
      type: 'file',
      message: msg,
      originalError: error,
      userMessage: 'อ่านไฟล์ไม่สำเร็จ',
      canRetry: false,
      suggestedAction: 'ลองเลือกไฟล์อื่น',
    };
  }

  // Permission errors
  if (msg.includes('permission') || msg.includes('denied')) {
    return {
      type: 'permission',
      message: msg,
      originalError: error,
      userMessage: 'ไม่มีสิทธิ์เข้าถึง',
      canRetry: false,
      suggestedAction: 'อนุญาตสิทธิ์ในการตั้งค่า',
    };
  }

  // Timeout errors
  if (msg.includes('timeout') || msg.includes('Timeout') || msg.includes('หมดเวลา')) {
    return {
      type: 'timeout',
      message: msg,
      originalError: error,
      userMessage: 'หมดเวลาเชื่อมต่อ',
      canRetry: true,
      suggestedAction: 'ลองอีกครั้ง',
    };
  }

  // Unknown errors
  return {
    type: 'unknown',
    message: msg,
    originalError: error,
    userMessage: 'เกิดข้อผิดพลาด',
    canRetry: true,
    suggestedAction: 'ลองอีกครั้ง',
  };
}

export function logError(error: AppError, context: string): void {
  const timestamp = new Date().toISOString();
  console.group(`🔴 Error Log [${timestamp}]`);
  console.log('Context:', context);
  console.log('Type:', error.type);
  console.log('Message:', error.message);
  console.log('User Message:', error.userMessage);
  console.log('Can Retry:', error.canRetry);
  if (error.suggestedAction) {
    console.log('Suggested Action:', error.suggestedAction);
  }
  if (error.originalError) {
    console.log('Original Error:', error.originalError);
  }
  console.groupEnd();
}
