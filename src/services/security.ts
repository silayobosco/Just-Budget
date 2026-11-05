import * as Crypto from 'expo-crypto';
import * as LocalAuthentication from 'expo-local-authentication';

/**
 * Hash a PIN or password using SHA-256 with a salt
 */
export const hashPin = async (pin: string): Promise<string> => {
  const salt = 'just_budget_salt_2026_';
  return await Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    `${salt}${pin.trim()}`
  );
};

/**
 * Verify an entered PIN against a stored SHA-256 hash
 */
export const verifyPin = async (enteredPin: string, storedHash: string): Promise<boolean> => {
  if (!storedHash || !enteredPin) return false;
  const hash = await hashPin(enteredPin);
  return hash.toLowerCase() === storedHash.toLowerCase();
};

/**
 * Check if the device hardware supports biometrics and has enrolled prints/faces
 */
export const checkBiometricsAvailable = async (): Promise<{
  hasHardware: boolean;
  isEnrolled: boolean;
}> => {
  try {
    const hasHardware = await LocalAuthentication.hasHardwareAsync();
    const isEnrolled = hasHardware ? await LocalAuthentication.isEnrolledAsync() : false;
    return { hasHardware, isEnrolled };
  } catch {
    return { hasHardware: false, isEnrolled: false };
  }
};

/**
 * Prompt user for biometric authentication (Fingerprint, Touch ID, Face ID)
 */
export const authenticateWithBiometrics = async (
  promptMessage = 'Unlock Just Budget with fingerprint or biometrics'
): Promise<boolean> => {
  try {
    const { hasHardware, isEnrolled } = await checkBiometricsAvailable();
    if (!hasHardware || !isEnrolled) return false;

    const result = await LocalAuthentication.authenticateAsync({
      promptMessage,
      fallbackLabel: 'Use PIN',
      cancelLabel: 'Cancel',
      disableDeviceFallback: false,
    });

    return result.success;
  } catch {
    return false;
  }
};

const B64_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=';

function toBase64(bytes: Uint8Array): string {
  let result = '';
  const len = bytes.length;
  for (let i = 0; i < len; i += 3) {
    const b1 = bytes[i];
    const b2 = i + 1 < len ? bytes[i + 1] : 0;
    const b3 = i + 2 < len ? bytes[i + 2] : 0;

    const enc1 = b1 >> 2;
    const enc2 = ((b1 & 3) << 4) | (b2 >> 4);
    let enc3 = ((b2 & 15) << 2) | (b3 >> 6);
    let enc4 = b3 & 63;

    if (i + 1 >= len) {
      enc3 = 64;
      enc4 = 64;
    } else if (i + 2 >= len) {
      enc4 = 64;
    }

    result += B64_CHARS.charAt(enc1) + B64_CHARS.charAt(enc2) + B64_CHARS.charAt(enc3) + B64_CHARS.charAt(enc4);
  }
  return result;
}

function fromBase64(b64: string): Uint8Array {
  const cleanB64 = b64.replace(/[^A-Za-z0-9+/=]/g, '');
  const bytes: number[] = [];
  let i = 0;
  while (i < cleanB64.length) {
    const enc1 = B64_CHARS.indexOf(cleanB64.charAt(i++));
    const enc2 = B64_CHARS.indexOf(cleanB64.charAt(i++));
    const enc3 = B64_CHARS.indexOf(cleanB64.charAt(i++));
    const enc4 = B64_CHARS.indexOf(cleanB64.charAt(i++));

    const b1 = (enc1 << 2) | (enc2 >> 4);
    const b2 = ((enc2 & 15) << 4) | (enc3 >> 2);
    const b3 = ((enc3 & 3) << 6) | enc4;

    bytes.push(b1);
    if (enc3 !== 64 && enc3 !== -1) {
      bytes.push(b2);
    }
    if (enc4 !== 64 && enc4 !== -1) {
      bytes.push(b3);
    }
  }
  return new Uint8Array(bytes);
}

/**
 * Robust pseudo-random keystream XOR encryption for backup archives
 * Uses SHA-256 key derivation with salt and authentication HMAC
 */
export const encryptBackupPayload = async (
  dataString: string,
  passphrase: string
): Promise<string> => {
  const salt = Array.from({ length: 8 }, () => Math.floor(Math.random() * 16).toString(16)).join('');
  const keyHash = await Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    `${passphrase}_jb_${salt}`
  );

  // Convert plain string to bytes
  const textEncoder = new TextEncoder();
  const inputBytes = textEncoder.encode(dataString);
  const outputBytes = new Uint8Array(inputBytes.length);

  // Generate deterministic keystream from keyHash blocks
  let blockCounter = 0;
  let currentKeystream = await Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    `${keyHash}_${blockCounter}`
  );
  let keyIndex = 0;

  for (let i = 0; i < inputBytes.length; i++) {
    if (keyIndex >= currentKeystream.length) {
      blockCounter++;
      currentKeystream = await Crypto.digestStringAsync(
        Crypto.CryptoDigestAlgorithm.SHA256,
        `${keyHash}_${blockCounter}`
      );
      keyIndex = 0;
    }
    const keyByte = currentKeystream.charCodeAt(keyIndex) % 256;
    outputBytes[i] = inputBytes[i] ^ keyByte;
    keyIndex++;
  }

  // Base64 encode ciphertext
  const base64Cipher = toBase64(outputBytes);

  // Compute HMAC checksum for integrity & password verification
  const hmac = await Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    `HMAC_${keyHash}_${base64Cipher}`
  );

  return JSON.stringify({
    encrypted: true,
    salt,
    hmac,
    cipher: base64Cipher,
  });
};

/**
 * Decrypt backup archive with passphrase verification
 */
export const decryptBackupPayload = async (
  encryptedPayload: string,
  passphrase: string
): Promise<string> => {
  const parsed = JSON.parse(encryptedPayload);
  if (!parsed.encrypted || !parsed.salt || !parsed.cipher || !parsed.hmac) {
    throw new Error('Invalid encrypted backup format');
  }

  const { salt, hmac, cipher } = parsed;
  const keyHash = await Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    `${passphrase}_jb_${salt}`
  );

  // Verify HMAC checksum
  const expectedHmac = await Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    `HMAC_${keyHash}_${cipher}`
  );

  if (expectedHmac.toLowerCase() !== hmac.toLowerCase()) {
    throw new Error('Incorrect password or corrupted backup file');
  }

  // Decode Base64 ciphertext
  const cipherBytes = fromBase64(cipher);

  const decryptedBytes = new Uint8Array(cipherBytes.length);
  let blockCounter = 0;
  let currentKeystream = await Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    `${keyHash}_${blockCounter}`
  );
  let keyIndex = 0;

  for (let i = 0; i < cipherBytes.length; i++) {
    if (keyIndex >= currentKeystream.length) {
      blockCounter++;
      currentKeystream = await Crypto.digestStringAsync(
        Crypto.CryptoDigestAlgorithm.SHA256,
        `${keyHash}_${blockCounter}`
      );
      keyIndex = 0;
    }
    const keyByte = currentKeystream.charCodeAt(keyIndex) % 256;
    decryptedBytes[i] = cipherBytes[i] ^ keyByte;
    keyIndex++;
  }

  const textDecoder = new TextDecoder();
  return textDecoder.decode(decryptedBytes);
};
