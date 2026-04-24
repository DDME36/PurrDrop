/**
 * End-to-End Encryption using Web Crypto API (AES-GCM + ECDH)
 * This ensures files are encrypted before leaving the device.
 */

// --- ECDH Key Exchange ---

// Generate ECDH Key Pair
export async function generateKeyPair(): Promise<CryptoKeyPair> {
  return await crypto.subtle.generateKey(
    { name: 'ECDH', namedCurve: 'P-256' },
    true,
    ['deriveKey']
  );
}

// Export Public Key to string
export async function exportPublicKey(key: CryptoKey): Promise<string> {
  const exported = await crypto.subtle.exportKey('spki', key);
  return btoa(String.fromCharCode(...new Uint8Array(exported)));
}

// Import Public Key from string
export async function importPublicKey(keyStr: string): Promise<CryptoKey> {
  const binary = atob(keyStr);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return await crypto.subtle.importKey(
    'spki',
    bytes,
    { name: 'ECDH', namedCurve: 'P-256' },
    true,
    []
  );
}

// Derive Shared Secret (AES-GCM Key)
export async function deriveSharedSecret(privateKey: CryptoKey, publicKey: CryptoKey): Promise<CryptoKey> {
  return await crypto.subtle.deriveKey(
    { name: 'ECDH', public: publicKey },
    privateKey,
    { name: 'AES-GCM', length: 256 },
    true,
    ['encrypt', 'decrypt']
  );
}

// --- AES-GCM Data Encryption ---

// Encrypt a chunk
export async function encryptChunk(chunk: ArrayBuffer, key: CryptoKey): Promise<{ data: ArrayBuffer; iv: Uint8Array }> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encrypted = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: iv as any },
    key,
    chunk
  );
  return { data: encrypted, iv };
}

// Decrypt a chunk
export async function decryptChunk(encryptedData: ArrayBuffer, iv: Uint8Array, key: CryptoKey): Promise<ArrayBuffer> {
  return await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: iv as any },
    key,
    encryptedData
  );
}

// Encrypt Text
export async function encryptText(text: string, key: CryptoKey): Promise<{ data: string; iv: string }> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encoded = new TextEncoder().encode(text);
  const encrypted = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: iv as any },
    key,
    encoded
  );
  
  return {
    data: btoa(String.fromCharCode(...new Uint8Array(encrypted))),
    iv: btoa(String.fromCharCode(...iv))
  };
}

// Decrypt Text
export async function decryptText(encryptedBase64: string, ivBase64: string, key: CryptoKey): Promise<string> {
  const encrypted = new Uint8Array(atob(encryptedBase64).split('').map(c => c.charCodeAt(0)));
  const iv = new Uint8Array(atob(ivBase64).split('').map(c => c.charCodeAt(0)));
  
  const decrypted = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: iv as any },
    key,
    encrypted
  );
  
  return new TextDecoder().decode(decrypted);
}
