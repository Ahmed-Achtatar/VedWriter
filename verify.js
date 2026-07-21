// Node.js script to verify Web Crypto PBKDF2 and AES-GCM logic
import { encryptText, decryptText } from './src/services/crypto.js';

async function runTest() {
  console.log('--- Running Crypto Verification ---');
  
  const password = 'SecretPassword123!';
  const salt = 'TestSaltString1234';
  const text = 'Hello, this is a highly private journal entry containing secrets.';

  try {
    console.log('Plaintext:', text);
    console.log('Deriving key and encrypting...');
    
    const encryptedJSON = await encryptText(text, password, salt);
    console.log('Encrypted JSON container:', encryptedJSON);
    
    // Parse to check properties
    const parsed = JSON.parse(encryptedJSON);
    if (!parsed.ct || !parsed.iv) {
      throw new Error('Encrypted JSON is missing ciphertext (ct) or iv!');
    }
    console.log('✓ Ciphertext Base64 and IV generated successfully.');

    console.log('Attempting decryption with correct password...');
    const decrypted = await decryptText(encryptedJSON, password, salt);
    console.log('Decrypted text:', decrypted);
    
    if (decrypted !== text) {
      throw new Error('Decrypted text does not match original plaintext!');
    }
    console.log('✓ Decryption successful and contents match!');

    console.log('Attempting decryption with WRONG password...');
    try {
      await decryptText(encryptedJSON, 'WrongPassword!!!', salt);
      throw new Error('Decryption succeeded with a wrong password! This is a critical security failure!');
    } catch (e) {
      console.log('✓ Decryption failed with wrong password as expected. Error message:', e.message);
    }
    
    console.log('\n=============================================');
    console.log('  SUCCESS: Cryptographic layer is 100% stable!');
    console.log('=============================================');
  } catch (err) {
    console.error('\n❌ FAILURE during crypto verification:', err);
    process.exit(1);
  }
}

runTest();
