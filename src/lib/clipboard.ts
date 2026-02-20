// Clipboard sharing - ส่งข้อความหรือ clipboard
export interface ClipboardData {
  type: 'text' | 'url' | 'code';
  content: string;
  timestamp: number;
}

export async function readClipboard(): Promise<ClipboardData | null> {
  try {
    const text = await navigator.clipboard.readText();
    if (!text) return null;

    // Detect type
    let type: ClipboardData['type'] = 'text';
    if (isUrl(text)) {
      type = 'url';
    } else if (isCode(text)) {
      type = 'code';
    }

    return { type, content: text, timestamp: Date.now() };
  } catch {
    return null;
  }
}

export async function writeClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    // Fallback for older browsers
    try {
      const textarea = document.createElement('textarea');
      textarea.value = text;
      textarea.style.position = 'fixed';
      textarea.style.opacity = '0';
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      return true;
    } catch {
      return false;
    }
  }
}

function isUrl(text: string): boolean {
  try {
    new URL(text);
    return true;
  } catch {
    return /^https?:\/\//.test(text);
  }
}

function isCode(text: string): boolean {
  const codePatterns = [
    /^(const|let|var|function|class|import|export)\s/m,
    /[{}\[\]];?\s*$/m,
    /^\s*(if|for|while|switch)\s*\(/m,
    /<\/?[a-z][\s\S]*>/i,
  ];
  return codePatterns.some(p => p.test(text));
}

export function truncateText(text: string, maxLength: number = 100): string {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength) + '...';
}
