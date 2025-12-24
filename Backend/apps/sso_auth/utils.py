from Crypto.Cipher import AES
from Crypto.Util.Padding import unpad
import base64
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
            # Handle URL encoding (replace URL-safe chars)
            encrypted_base64 = encrypted_base64.replace('-', '+').replace('_', '/')
            
            # Add padding if needed
            padding_needed = len(encrypted_base64) % 4
            if padding_needed:
                encrypted_base64 += '=' * (4 - padding_needed)
            
            # Decode base64
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
