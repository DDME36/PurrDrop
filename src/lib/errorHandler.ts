// Centralized Error Handling
export type ErrorType = 
  | 'network'
  | 'webrtc'
  | 'file'
  | 'permission'
  | 'timeout'
  | 'unknown';

export interface AppError {
  type: ErrorType;
  message: string;
  originalError?: any;
  userMessage: string;
  canRetry: boolean;
  suggestedAction?: string;
}

export function handleError(error: any, context: string): AppError {
  console.error(`❌ Error in ${context}:`, error);

  // Network errors
  if (error.message?.includes('network') || error.message?.includes('fetch')) {
    return {
      type: 'network',
      message: error.message,
      originalError: error,
      userMessage: 'เชื่อมต่ออินเทอร์เน็ตไม่ได้',
      canRetry: true,
      suggestedAction: 'ตรวจสอบการเชื่อมต่ออินเทอร์เน็ต',
    };
  }

  // WebRTC errors
  if (error.message?.includes('ICE') || error.message?.includes('DataChannel')) {
    return {
      type: 'webrtc',
      message: error.message,
      originalError: error,
      userMessage: 'การเชื่อมต่อ P2P ล้มเหลว',
      canRetry: true,
      suggestedAction: 'กำลังลองส่งผ่าน server...',
    };
  }

  // File errors
  if (error.message?.includes('file') || error.message?.includes('read')) {
    return {
      type: 'file',
      message: error.message,
      originalError: error,
      userMessage: 'อ่านไฟล์ไม่สำเร็จ',
      canRetry: false,
      suggestedAction: 'ลองเลือกไฟล์อื่น',
    };
  }

  // Permission errors
  if (error.message?.includes('permission') || error.message?.includes('denied')) {
    return {
      type: 'permission',
      message: error.message,
      originalError: error,
      userMessage: 'ไม่มีสิทธิ์เข้าถึง',
      canRetry: false,
      suggestedAction: 'อนุญาตสิทธิ์ในการตั้งค่า',
    };
  }

  // Timeout errors
  if (error.message?.includes('timeout') || error.message?.includes('Timeout')) {
    return {
      type: 'timeout',
      message: error.message,
      originalError: error,
      userMessage: 'หมดเวลาเชื่อมต่อ',
      canRetry: true,
      suggestedAction: 'ลองอีกครั้ง',
    };
  }

  // Unknown errors
  return {
    type: 'unknown',
    message: error.message || String(error),
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
