"""
Configuration settings for Ava AI Voice Assistant
"""
import os
from pathlib import Path
from dotenv import load_dotenv

# Load environment variables
env_path = Path(__file__).parent / '.env'
load_dotenv(env_path)

class Config:
    """Application configurationions for Ava AI Voice Assistant"""
    
    # Database Configuration
    SUPABASE_URL = os.getenv("SUPABASE_URL", "")
    SUPABASE_KEY = os.getenv("SUPABASE_KEY", "")
    SUPABASE_SERVICE_KEY = os.getenv("SUPABASE_SERVICE_KEY", "")
    
    # Database Tables
    DB_TABLES = {
        'users': 'users',
        'medications': 'medications',
        'medication_logs': 'medication_logs',
        'reminders': 'reminders',
        'emergency_contacts': 'emergency_contacts',
        'health_records': 'health_records',
        'symptom_checks': 'symptom_checks',
        'chat_sessions': 'chat_sessions',
        'chat_messages': 'chat_messages',
        'audio_files': 'audio_files',
        'health_tips': 'health_tips',
        'user_health_tips': 'user_health_tips'
    }
    
    # AI Service Configuration
    GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "")
    MURF_API_KEY = os.getenv("MURF_API_KEY", "")
    
    # Application Settings
    DEFAULT_USER_ID = os.getenv("DEFAULT_USER_ID", "00000000-0000-0000-0000-000000000001")
    MAX_AUDIO_FILES = int(os.getenv("MAX_AUDIO_FILES", "50"))
    AUDIO_RETENTION_HOURS = int(os.getenv("AUDIO_RETENTION_HOURS", "24"))
    
    # Timezone settings
    DEFAULT_TIMEZONE = os.getenv("DEFAULT_TIMEZONE", "UTC")
    
    @classmethod
    def validate_config(cls):
        """Validate required configuration"""
        missing_configs = []
        
        if not cls.SUPABASE_URL:
            missing_configs.append("SUPABASE_URL")
        if not cls.SUPABASE_KEY:
            missing_configs.append("SUPABASE_KEY")
        if not cls.GEMINI_API_KEY:
            missing_configs.append("GEMINI_API_KEY")
            
        return missing_configs
    
    @classmethod
    def is_database_configured(cls):
        """Check if database is properly configured"""
        return bool(cls.SUPABASE_URL and cls.SUPABASE_KEY)
