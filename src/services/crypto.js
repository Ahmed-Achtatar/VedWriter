// Cryptographic service using native Web Crypto API
// Key insight: PBKDF2 key derivation is expensive (~100-500ms).
// We derive the key ONCE after unlock and cache it for all subsequent
// encrypt/decrypt operations. This makes page loading ~10x faster.

const PBKDF2_ITERATIONS = 100000;

let cachedKey = null;

// Convert ArrayBuffer to Base64 string
function arrayBufferToBase64(buffer) {
  let binary = '';
  const bytes = new Uint8Array(buffer);
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

// Convert Base64 string to ArrayBuffer
function base64ToArrayBuffer(base64) {
  const binary_string = atob(base64);
  const len = binary_string.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binary_string.charCodeAt(i);
  }
  return bytes.buffer;
}

// Generate a cryptographically secure random string of specified length
export function generateRandomString(length = 32) {
  const array = new Uint8Array(length);
  crypto.getRandomValues(array);
  return arrayBufferToBase64(array).substring(0, length);
}

// Derive a Cryptographic Key from password and salt using PBKDF2
export async function deriveKey(password, salt, iterations = PBKDF2_ITERATIONS) {
  const encoder = new TextEncoder();
  const passwordBuffer = encoder.encode(password);
  const saltBuffer = encoder.encode(salt);

  const keyMaterial = await crypto.subtle.importKey(
    'raw', passwordBuffer, { name: 'PBKDF2' }, false, ['deriveKey']
  );

  return await crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: saltBuffer,
      iterations: iterations,
      hash: 'SHA-256',
    },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

// Initialize the cached key (call once after unlock/setup)
export async function initKey(password, salt, iterations = PBKDF2_ITERATIONS) {
  cachedKey = await deriveKey(password, salt, iterations);
  return cachedKey;
}

// Check if a valid key is cached
export function hasKey() {
  return cachedKey !== null;
}

// Clear the cached key (on lock)
export function clearKey() {
  cachedKey = null;
}

// Fast encrypt using cached key (no re-derivation)
export async function encryptWithKey(text) {
  if (!cachedKey) throw new Error('No key cached. Call initKey first.');
  try {
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const encodedText = new TextEncoder().encode(text);
    const ciphertextBuffer = await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv },
      cachedKey,
      encodedText
    );
    return JSON.stringify({
      ct: arrayBufferToBase64(ciphertextBuffer),
      iv: arrayBufferToBase64(iv),
    });
  } catch (error) {
    console.error('Encryption failed:', error);
    throw new Error('Encryption failed');
  }
}

// Fast decrypt using cached key (no re-derivation)
export async function decryptWithKey(encryptedJSON) {
  if (!cachedKey) throw new Error('No key cached. Call initKey first.');
  try {
    const { ct, iv } = JSON.parse(encryptedJSON);
    const ciphertext = base64ToArrayBuffer(ct);
    const ivBuffer = base64ToArrayBuffer(iv);
    const decryptedBuffer = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: new Uint8Array(ivBuffer) },
      cachedKey,
      ciphertext
    );
    return new TextDecoder().decode(decryptedBuffer);
  } catch (error) {
    console.error('Decryption failed:', error);
    throw new Error('Decryption failed');
  }
}

// Legacy functions (used during unlock/setup where key isn't cached yet)
export async function encryptText(text, password, salt, iterations = PBKDF2_ITERATIONS) {
  try {
    const key = await deriveKey(password, salt, iterations);
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const encodedText = new TextEncoder().encode(text);
    const ciphertextBuffer = await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv },
      key,
      encodedText
    );
    return JSON.stringify({
      ct: arrayBufferToBase64(ciphertextBuffer),
      iv: arrayBufferToBase64(iv),
    });
  } catch (error) {
    console.error('Encryption failed:', error);
    throw new Error('Encryption failed');
  }
}

export async function decryptText(encryptedJSON, password, salt, iterations = PBKDF2_ITERATIONS) {
  try {
    const { ct, iv } = JSON.parse(encryptedJSON);
    const key = await deriveKey(password, salt, iterations);
    const ciphertext = base64ToArrayBuffer(ct);
    const ivBuffer = base64ToArrayBuffer(iv);
    const decryptedBuffer = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: new Uint8Array(ivBuffer) },
      key,
      ciphertext
    );
    return new TextDecoder().decode(decryptedBuffer);
  } catch (error) {
    console.error('Decryption failed:', error);
    throw new Error('Decryption failed. Please check your password.');
  }
}
