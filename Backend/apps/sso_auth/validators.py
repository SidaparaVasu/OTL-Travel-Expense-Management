import logging

logger = logging.getLogger('sso_auth')


class SSOTokenValidator:
    """Parse and validate SSO token parameters"""
    
    @staticmethod
    def parse_params(decrypted_text: str) -> dict:
        """
        Parse: "P1:1$P2:admin@sandip$P3:1$P4:0$P5:True"
        
        Returns: {
            'user_id': '1',
            'username': 'admin@sandip',
            'company_id': '1',
            'emp_id': '0',
            'flag': True
        }
        """
        params = {}
        parts = decrypted_text.split('$')
        
        for part in parts:
            if ':' not in part:
                continue
            
            key, value = part.split(':', 1)
            
            if key == 'P1':
                params['user_id'] = value.strip()
            elif key == 'P2':
                params['username'] = value.strip()
            elif key == 'P3':
                params['company_id'] = value.strip()
            elif key == 'P4':
                params['emp_id'] = value.strip()
            elif key == 'P5':
                params['flag'] = value.strip().lower() == 'true'
        
        return params
    
    @staticmethod
    def validate_params(params: dict) -> tuple[bool, str]:
        """
        Validate required parameters
        
        Returns: (is_valid, error_message)
        """
        # Check flag
        if not params.get('flag'):
            logger.warning(f"SSO token with flag=False: {params.get('username')}")
            return False, "Authentication flag not set"
        
        # Check required fields
        required = ['user_id', 'username', 'company_id', 'emp_id']
        for field in required:
            if field not in params or not params[field]:
                logger.error(f"Missing required field: {field}")
                return False, f"Missing {field}"
        
        return True, ""
