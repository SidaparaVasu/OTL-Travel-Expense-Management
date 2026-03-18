
import base64
import urllib.parse
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
        # 0. Percent-decode the token first to handle %3D → =, %2B → +, %2F → /
        # This handles cases where the browser or proxy percent-encodes reserved chars
        processed_token = urllib.parse.unquote(token_input)

        # 1. Handle URL encoding FIRST (replace URL-safe chars)
        # This restores the space back to '+' BEFORE stripping
        processed_token = processed_token.replace(' ', '+').replace('-', '+').replace('_', '/')
        
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
    # Test Case 1: Token with trailing space (+ URL-decoded to space)
    token_trailing_space = "XJ98azoYiJOJCDS7XljOH5PP0VXDTvpRZehCraMAuGBRX3SdTDAFBOYFvPQUQRl "
    test_sso_token_fix("Trailing Space (+ became space)", token_trailing_space)

    # Test Case 2: Clean Token (already correct, no encoding issues)
    token_clean = "XJ98azoYiJOJCDS7XljOH5PP0VXDTvpRZehCraMAuGBRX3SdTDAFBOYFvPQUQRl+"
    test_sso_token_fix("Clean Token", token_clean)

    # Test Case 3: Percent-encoded padding (= became %3D)
    # This is the NEW issue: token ends with == but arrives as %3D%3D
    token_percent_encoded = "NAbSOBkAIeYPqXjfHcuCfYyeCTctYQu8Vc7AqBzCO1nDlWgeUJtsAnkHeuMLF0rmE6U1LqNKalRG6nQXYQ80Ug%3D%3D"
    test_sso_token_fix("Percent-encoded padding (%3D%3D instead of ==)", token_percent_encoded)

    # Test Case 4: Clean version of Test Case 3 (for comparison)
    token_clean_padded = "NAbSOBkAIeYPqXjfHcuCfYyeCTctYQu8Vc7AqBzCO1nDlWgeUJtsAnkHeuMLF0rmE6U1LqNKalRG6nQXYQ80Ug=="
    test_sso_token_fix("Clean Token with == padding", token_clean_padded)

    # Test Case 5: Truncated token (truly missing char - expected to fail)
    token_truncated = "XJ98azoYiJOJCDS7XljOH5PP0VXDTvpRZehCraMAuGBRX3SdTDAFBOYFvPQUQRl"
    test_sso_token_fix("Truncated (Missing last char) - expected FAIL", token_truncated)