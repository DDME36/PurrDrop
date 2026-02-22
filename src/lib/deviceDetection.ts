/**
 * Device Detection Utilities
 * Detect problematic environments and provide fallbacks
 */

export function isBlueStacks(): boolean {
  if (typeof window === 'undefined') return false;
  
  const ua = navigator.userAgent.toLowerCase();
  return ua.includes('bluestacks') || 
         ua.includes('bstk') ||
         (ua.includes('android') && ua.includes('chrome') && window.innerWidth === 1920);
}

export function isEmulator(): boolean {
  if (typeof window === 'undefined') return false;
  
  const ua = navigator.userAgent.toLowerCase();
  return isBlueStacks() || 
         ua.includes('genymotion') ||
         ua.includes('emulator');
}

export function isInAppBrowser(): boolean {
  if (typeof window === 'undefined') return false;
  
  const ua = navigator.userAgent.toLowerCase();
  return ua.includes('fban') || // Facebook
         ua.includes('fbav') || // Facebook
         ua.includes('instagram') ||
         ua.includes('line') ||
         ua.includes('twitter');
}

export function shouldUseReducedMotion(): boolean {
  if (typeof window === 'undefined') return false;
  
  // Check user preference
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    return true;
  }
  
  // Reduce motion for emulators (they often have rendering issues)
  return isEmulator();
}

export function getDeviceWarnings(): string[] {
  const warnings: string[] = [];
  
  if (isBlueStacks()) {
    warnings.push('BlueStacks detected - some features may be unstable');
  }
  
  if (isInAppBrowser()) {
    warnings.push('In-app browser detected - please open in regular browser');
  }
  
  return warnings;
}
