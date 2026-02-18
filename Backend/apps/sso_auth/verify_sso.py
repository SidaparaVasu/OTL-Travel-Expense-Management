
import base64
from Crypto.Cipher import AES
from Crypto.Util.Padding import unpad
import sys

"""
COMMAND: python Backend/apps/sso_auth/verify_sso.py
"""

# Mock settings for standalone functionality
SSO_AES_KEY = b'12345678901234567890123456789012' 
SSO_AES_IV  = b'1234567890123456' 

def test_sso_token_fix(test_name, token_input):
    print(f"\n{'='*20} SSO TOKEN TEST {'='*20}")
    print(f"TEST: {test_name}")
    print(f"INPUT: '{token_input}'")
    
    # --- LOGIC FROM UTILS.PY (THE FIX) ---
    
    try:
        # 1. Handle URL encoding FIRST (replace URL-safe chars)
        # This restores the space back to '+' BEFORE stripping
        processed_token = token_input.replace(' ', '+').replace('-', '+').replace('_', '/')
        
        # 2. Strip any whitespace/newlines that might affect length
        processed_token = processed_token.strip()
        
        # 3. Remove a trailing slash if it was accidentally appended
        if len(processed_token) % 4 != 0 and processed_token.endswith('/'):
            processed_token = processed_token[:-1]

        # 4. Add padding if needed
        padding_needed = len(processed_token) % 4
        if padding_needed:
            processed_token += '=' * (4 - padding_needed)
            
        print(f"PROCESSED: '{processed_token}'")
        
        # 5. Decode base64
        encrypted_bytes = base64.b64decode(processed_token)
        byte_len = len(encrypted_bytes)
        print(f"DECODED BYTES: {byte_len}")
        
        # 6. VERIFY AES COMPATIBILITY
        if byte_len % 16 == 0:
            print(f"STATUS: ✅ PASS (Valid AES Block Size)")
            
            # Try decrypting 
            try:
                cipher = AES.new(SSO_AES_KEY, AES.MODE_CBC, SSO_AES_IV)
                decrypted_padded = cipher.decrypt(encrypted_bytes)
                decrypted_text = unpad(decrypted_padded, AES.block_size).decode('utf-8')
                print(f"DECRYPTED VALUE: {decrypted_text}")
                print("CRYPTO CHECK: ✅ Decryption Successful")
            except Exception as e:
                print(f"CRYPTO CHECK: ❌ Decryption Failed: {e}")
                
        else:
            print(f"STATUS: ❌ FAIL (Invalid AES Block Size: {byte_len})")
            
    except Exception as e:
        print(f"STATUS: ❌ EXCEPTION: {e}")
    print("="*60)

if __name__ == "__main__":
    # Test Case 1: The Reported Issue (Trailing Space)
    # The original token had a + at the end, which became a space in the URL
    token_url_decoded = "XJ98azoYiJOJCDS7XljOH5PP0VXDTvpRZehCraMAuGBRX3SdTDAFBOYFvPQUQRl "
    test_sso_token_fix("URL Decoded (+ became space)", token_url_decoded)

    # Test Case 2: Clean Token (Already Correct)
    token_clean = "XJ98azoYiJOJCDS7XljOH5PP0VXDTvpRZehCraMAuGBRX3SdTDAFBOYFvPQUQRl+"
    test_sso_token_fix("Clean Token", token_clean)
    
    # Test Case 3: Truncated (The original error case, if fix wasn't applied)
    # This simulates if we stripped BEFORE replacing, effectively testing the "failure" input
    # But our function applies the fix, so it should PASS even this if passed correctly?
    # No, if the input IS truncated (missing last char), it will fail.
    token_truncated = "XJ98azoYiJOJCDS7XljOH5PP0VXDTvpRZehCraMAuGBRX3SdTDAFBOYFvPQUQRl" 
    # Note: If the input itself IS truncated (not just a space), it will fail.
    # The fix we implemented handles the SPACE case.
    test_sso_token_fix("Truncated Input (Missing char)", token_truncated)

    # Test Case 4: Wrong last character
    # Padding is incorrect, but AES block size may valid
    token_wrong_last_char = "XJ98azoYiJOJCDS7XljOH5PP0VXDTvpRZehCraMAuGBRX3SdTDAFBOYFvPQUQRlp"
    test_sso_token_fix("Wrong last character", token_wrong_last_char)