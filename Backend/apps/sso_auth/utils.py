from Crypto.Cipher import AES
from Crypto.Util.Padding import unpad
import base64
import urllib.parse
from django.conf import settings
import logging

logger = logging.getLogger('sso_auth')


class SSOTokenHandler:
    """Handle SSO token decryption"""
    
    @staticmethod
    def decrypt_token(encrypted_base64: str) -> str:
        """
        Decrypt AES-CBC token from HRMS
        
        Args:
            encrypted_base64: URL-safe base64 encoded ciphertext
            
        Returns:
            Decrypted string: "P1:1$P2:admin@sandip$P3:1$P4:0$P5:True"
        """
        try:
            # 0. Percent-decode any URL-encoded characters first.
            # Browsers and proxies sometimes encode reserved Base64 chars:
            #   %3D -> =   (padding character)
            #   %2B -> +   (Base64 char, also form-encoded space)
            #   %2F -> /   (Base64 char)
            # This must happen before any other step to ensure we always
            # work with the actual Base64 characters.
            encrypted_base64 = urllib.parse.unquote(encrypted_base64)

            # 1. Handle URL form-encoding FIRST (replace URL-safe chars)
            # URLSearchParams (frontend) decodes '+' as ' ' (space) per the
            # application/x-www-form-urlencoded spec. We restore it before
            # strip() so a trailing '+' is not lost.
            encrypted_base64 = encrypted_base64.replace(' ', '+').replace('-', '+').replace('_', '/')

            # 2. Strip any whitespace/newlines that might affect length
            # Now that meaningful spaces are converted to '+', strip() only removes garbage
            encrypted_base64 = encrypted_base64.strip()
            
            # 3. Remove a trailing slash if it was accidentally appended to the param by the browser
            # Base64 strings can end with '/' but not if it's an accidental URL append
            # However, if it's a valid part of the token, we should be careful.
            # In HRMS tokens, if it's 4-byte aligned and ends with /, it's usually part of the cipher.
            # If it's NOT 4-byte aligned and ends with /, it's almost certainly a URL artifact.
            if len(encrypted_base64) % 4 != 0 and encrypted_base64.endswith('/'):
                encrypted_base64 = encrypted_base64[:-1]
            
            # 4. Add padding if needed
            padding_needed = len(encrypted_base64) % 4
            if padding_needed:
                encrypted_base64 += '=' * (4 - padding_needed)
            
            # 5. Decode base64
            encrypted_bytes = base64.b64decode(encrypted_base64)
            
            # Get key and IV from settings
            key = settings.SSO_AES_KEY.encode('utf-8')
            iv = settings.SSO_AES_IV.encode('utf-8')
            
            # Create cipher
            cipher = AES.new(key, AES.MODE_CBC, iv)
            
            # Decrypt
            decrypted_padded = cipher.decrypt(encrypted_bytes)
            
            # Remove PKCS7 padding
            decrypted = unpad(decrypted_padded, AES.block_size)
            
            decrypted_text = decrypted.decode('utf-8')
            logger.info("Token decrypted successfully")
            
            return decrypted_text
            
        except Exception as e:
            logger.error(f"Token decryption failed: {str(e)}")
            raise ValueError(f"Invalid token format: {str(e)}")
