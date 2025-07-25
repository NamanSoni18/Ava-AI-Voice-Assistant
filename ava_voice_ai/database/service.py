"""
Database service for Ava AI Voice Assistant using Supabase
"""
import logging
from typing import Optional, List, Dict, Any, Union
from datetime import datetime, timedelta
import json
import uuid
import sys
import os
from pathlib import Path

# Add the parent directory to Python path to resolve imports
parent_dir = Path(__file__).parent.parent
sys.path.insert(0, str(parent_dir))

try:
    from supabase import create_client, Client
    from postgrest.exceptions import APIError
    SUPABASE_AVAILABLE = True
except ImportError:
    print("Warning: Supabase not available. Database will run in fallback mode.")
    SUPABASE_AVAILABLE = False
    Client = None

from config import Config
from database.models import *

logger = logging.getLogger(__name__)

class DatabaseService:
    """Database service for interacting with Supabase"""
    
    def __init__(self):
        self.client = None
        self.is_connected = False
        if SUPABASE_AVAILABLE:
            self._initialize_connection()
        else:
            logger.warning("Supabase not available. Running in fallback mode.")
    
    def _initialize_connection(self):
        """Initialize Supabase connection"""
        if not SUPABASE_AVAILABLE:
            return
            
        try:
            if Config.is_database_configured():
                self.client = create_client(Config.SUPABASE_URL, Config.SUPABASE_KEY)
                # Test the connection
                self._test_connection()
                self.is_connected = True
                logger.info("Database connection established successfully")
            else:
                logger.warning("Database not configured. Using fallback mode.")
                self.is_connected = False
        except Exception as e:
            logger.error(f"Failed to initialize database connection: {e}")
            self.is_connected = False
    
    def _test_connection(self):
        """Test database connection"""
        if not self.client or not SUPABASE_AVAILABLE:
            raise Exception("Database client not initialized")
        
        # Try a simple query to test connection
        try:
            result = self.client.table('users').select('id').limit(1).execute()
            logger.info("Database connection test successful")
        except Exception as e:
            logger.error(f"Database connection test failed: {e}")
            raise
    
    def health_check(self) -> Dict[str, Any]:
        """Check database health"""
        if not self.is_connected:
            return {
                "status": "disconnected",
                "error": "Database not configured or connection failed"
            }
        
        try:
            # Test basic connectivity
            self._test_connection()
            return {
                "status": "healthy",
                "timestamp": datetime.now().isoformat()
            }
        except Exception as e:
            return {
                "status": "error",
                "error": str(e),
                "timestamp": datetime.now().isoformat()
            }
    
    # User Operations
    async def create_user(self, user_data: UserCreate) -> Optional[User]:
        """Create a new user"""
        if not self.is_connected:
            return None
        
        try:
            data = user_data.dict()
            data['id'] = str(uuid.uuid4())
            data['created_at'] = datetime.now().isoformat()
            data['updated_at'] = datetime.now().isoformat()
            
            result = self.client.table('users').insert(data).execute()
            if result.data:
                return User(**result.data[0])
        except Exception as e:
            logger.error(f"Error creating user: {e}")
        return None
    
    async def get_user(self, user_id: str) -> Optional[User]:
        """Get user by ID"""
        if not self.is_connected:
            return None
        
        try:
            result = self.client.table('users').select('*').eq('id', user_id).execute()
            if result.data:
                return User(**result.data[0])
        except Exception as e:
            logger.error(f"Error getting user: {e}")
        return None
    
    async def get_user_by_email(self, email: str) -> Optional[User]:
        """Get user by email"""
        if not self.is_connected:
            return None
        
        try:
            result = self.client.table('users').select('*').eq('email', email).execute()
            if result.data:
                return User(**result.data[0])
        except Exception as e:
            logger.error(f"Error getting user by email: {e}")
        return None
    
    async def update_user(self, user_id: str, user_data: UserUpdate) -> Optional[User]:
        """Update user"""
        if not self.is_connected:
            return None
        
        try:
            data = {k: v for k, v in user_data.dict().items() if v is not None}
            data['updated_at'] = datetime.now().isoformat()
            
            result = self.client.table('users').update(data).eq('id', user_id).execute()
            if result.data:
                return User(**result.data[0])
        except Exception as e:
            logger.error(f"Error updating user: {e}")
        return None
    
    # Medication Operations
    async def create_medication(self, medication_data: MedicationCreate) -> Optional[Medication]:
        """Create a new medication"""
        if not self.is_connected:
            return None
        
        try:
            data = medication_data.dict()
            data['id'] = str(uuid.uuid4())
            data['created_at'] = datetime.now().isoformat()
            data['updated_at'] = datetime.now().isoformat()
            
            result = self.client.table('medications').insert(data).execute()
            if result.data:
                return Medication(**result.data[0])
        except Exception as e:
            logger.error(f"Error creating medication: {e}")
        return None
    
    async def get_medications(self, user_id: str, active_only: bool = True) -> List[Medication]:
        """Get user medications"""
        if not self.is_connected:
            return []
        
        try:
            query = self.client.table('medications').select('*').eq('user_id', user_id)
            if active_only:
                query = query.eq('is_active', True)
            
            result = query.execute()
            return [Medication(**med) for med in result.data]
        except Exception as e:
            logger.error(f"Error getting medications: {e}")
        return []
    
    async def get_medication(self, medication_id: str) -> Optional[Medication]:
        """Get medication by ID"""
        if not self.is_connected:
            return None
        
        try:
            result = self.client.table('medications').select('*').eq('id', medication_id).execute()
            if result.data:
                return Medication(**result.data[0])
        except Exception as e:
            logger.error(f"Error getting medication: {e}")
        return None
    
    async def update_medication(self, medication_id: str, medication_data: MedicationUpdate) -> Optional[Medication]:
        """Update medication"""
        if not self.is_connected:
            return None
        
        try:
            data = {k: v for k, v in medication_data.dict().items() if v is not None}
            data['updated_at'] = datetime.now().isoformat()
            
            result = self.client.table('medications').update(data).eq('id', medication_id).execute()
            if result.data:
                return Medication(**result.data[0])
        except Exception as e:
            logger.error(f"Error updating medication: {e}")
        return None
    
    async def delete_medication(self, medication_id: str) -> bool:
        """Hard delete medication and associated reminders"""
        if not self.is_connected:
            return False
        
        try:
            # First, delete all associated reminders for this medication
            try:
                reminder_result = self.client.table('reminders').delete().eq('medication_id', medication_id).execute()
                logger.info(f"Deleted {len(reminder_result.data) if reminder_result.data else 0} reminders for medication {medication_id}")
            except Exception as reminder_error:
                logger.warning(f"Error deleting medication reminders: {reminder_error}")
                # Continue with medication deletion even if reminder deletion fails
            
            # Then hard delete the medication itself
            result = self.client.table('medications').delete().eq('id', medication_id).execute()
            success = bool(result.data)
            
            if success:
                logger.info(f"Successfully deleted medication {medication_id} and associated reminders")
            else:
                logger.warning(f"No medication found with ID {medication_id}")
                
            return success
        except Exception as e:
            logger.error(f"Error deleting medication: {e}")
        return False
    
    # Medication Log Operations
    async def create_medication_log(self, log_data: MedicationLogCreate) -> Optional[MedicationLog]:
        """Create medication log entry"""
        if not self.is_connected:
            return None
        
        try:
            data = log_data.dict()
            data['id'] = str(uuid.uuid4())
            data['created_at'] = datetime.now().isoformat()
            
            result = self.client.table('medication_logs').insert(data).execute()
            if result.data:
                return MedicationLog(**result.data[0])
        except Exception as e:
            logger.error(f"Error creating medication log: {e}")
        return None
    
    async def get_medication_logs(self, user_id: str, medication_id: Optional[str] = None, 
                                 days: int = 30) -> List[MedicationLog]:
        """Get medication logs"""
        if not self.is_connected:
            return []
        
        try:
            since_date = (datetime.now() - timedelta(days=days)).isoformat()
            query = self.client.table('medication_logs').select('*').eq('user_id', user_id)
            query = query.gte('created_at', since_date)
            
            if medication_id:
                query = query.eq('medication_id', medication_id)
            
            result = query.order('created_at', desc=True).execute()
            return [MedicationLog(**log) for log in result.data]
        except Exception as e:
            logger.error(f"Error getting medication logs: {e}")
        return []
    
    # Reminder Operations
    async def create_reminder(self, reminder_data: ReminderCreate) -> Optional[Reminder]:
        """Create a new reminder"""
        if not self.is_connected:
            return None
        
        try:
            data = reminder_data.dict()
            data['id'] = str(uuid.uuid4())
            data['created_at'] = datetime.now().isoformat()
            data['updated_at'] = datetime.now().isoformat()
            
            result = self.client.table('reminders').insert(data).execute()
            if result.data:
                return Reminder(**result.data[0])
        except Exception as e:
            logger.error(f"Error creating reminder: {e}")
        return None
    
    async def get_reminders(self, user_id: str, active_only: bool = True) -> List[Reminder]:
        """Get user reminders"""
        if not self.is_connected:
            return []
        
        try:
            query = self.client.table('reminders').select('*').eq('user_id', user_id)
            if active_only:
                query = query.eq('is_active', True)
            
            result = query.execute()
            return [Reminder(**reminder) for reminder in result.data]
        except Exception as e:
            logger.error(f"Error getting reminders: {e}")
        return []
    
    async def update_reminder(self, reminder_id: str, reminder_data: ReminderUpdate) -> Optional[Reminder]:
        """Update reminder"""
        if not self.is_connected:
            return None
        
        try:
            data = {k: v for k, v in reminder_data.dict().items() if v is not None}
            data['updated_at'] = datetime.now().isoformat()
            
            result = self.client.table('reminders').update(data).eq('id', reminder_id).execute()
            if result.data:
                return Reminder(**result.data[0])
        except Exception as e:
            logger.error(f"Error updating reminder: {e}")
        return None
    
    async def delete_reminder(self, reminder_id: str) -> bool:
        """Soft delete reminder"""
        if not self.is_connected:
            return False
        
        try:
            data = {
                'is_active': False,
                'updated_at': datetime.now().isoformat()
            }
            result = self.client.table('reminders').update(data).eq('id', reminder_id).execute()
            return bool(result.data)
        except Exception as e:
            logger.error(f"Error deleting reminder: {e}")
        return False
    
    # Emergency Contact Operations
    async def create_emergency_contact(self, contact_data: EmergencyContactCreate) -> Optional[EmergencyContact]:
        """Create emergency contact"""
        if not self.is_connected:
            return None
        
        try:
            data = contact_data.dict()
            data['id'] = str(uuid.uuid4())
            data['created_at'] = datetime.now().isoformat()
            data['updated_at'] = datetime.now().isoformat()
            
            result = self.client.table('emergency_contacts').insert(data).execute()
            if result.data:
                return EmergencyContact(**result.data[0])
        except Exception as e:
            logger.error(f"Error creating emergency contact: {e}")
        return None
    
    async def get_emergency_contacts(self, user_id: str) -> List[EmergencyContact]:
        """Get user emergency contacts"""
        if not self.is_connected:
            return []
        
        try:
            result = self.client.table('emergency_contacts').select('*').eq('user_id', user_id).execute()
            return [EmergencyContact(**contact) for contact in result.data]
        except Exception as e:
            logger.error(f"Error getting emergency contacts: {e}")
        return []
    
    async def update_emergency_contact(self, contact_id: str, contact_data: EmergencyContactUpdate) -> Optional[EmergencyContact]:
        """Update emergency contact"""
        if not self.is_connected:
            return None
        
        try:
            data = {k: v for k, v in contact_data.dict().items() if v is not None}
            data['updated_at'] = datetime.now().isoformat()
            
            result = self.client.table('emergency_contacts').update(data).eq('id', contact_id).execute()
            if result.data:
                return EmergencyContact(**result.data[0])
        except Exception as e:
            logger.error(f"Error updating emergency contact: {e}")
        return None
    
    async def delete_emergency_contact(self, contact_id: str) -> bool:
        """Delete emergency contact"""
        if not self.is_connected:
            return False
        
        try:
            result = self.client.table('emergency_contacts').delete().eq('id', contact_id).execute()
            return bool(result.data)
        except Exception as e:
            logger.error(f"Error deleting emergency contact: {e}")
        return False
    
    # Health Record Operations
    async def create_health_record(self, record_data: HealthRecordCreate) -> Optional[HealthRecord]:
        """Create health record"""
        if not self.is_connected:
            return None
        
        try:
            data = record_data.dict()
            data['id'] = str(uuid.uuid4())
            data['created_at'] = datetime.now().isoformat()
            if not data.get('recorded_at'):
                data['recorded_at'] = datetime.now().isoformat()
            
            result = self.client.table('health_records').insert(data).execute()
            if result.data:
                return HealthRecord(**result.data[0])
        except Exception as e:
            logger.error(f"Error creating health record: {e}")
        return None
    
    async def get_health_records(self, user_id: str, record_type: Optional[str] = None, 
                                days: int = 90) -> List[HealthRecord]:
        """Get health records"""
        if not self.is_connected:
            return []
        
        try:
            since_date = (datetime.now() - timedelta(days=days)).isoformat()
            query = self.client.table('health_records').select('*').eq('user_id', user_id)
            query = query.gte('recorded_at', since_date)
            
            if record_type:
                query = query.eq('record_type', record_type)
            
            result = query.order('recorded_at', desc=True).execute()
            return [HealthRecord(**record) for record in result.data]
        except Exception as e:
            logger.error(f"Error getting health records: {e}")
        return []
    
    # Symptom Check Operations
    async def create_symptom_check(self, symptom_data: SymptomCheckCreate) -> Optional[SymptomCheck]:
        """Create symptom check"""
        if not self.is_connected:
            return None
        
        try:
            data = symptom_data.dict()
            data['id'] = str(uuid.uuid4())
            data['created_at'] = datetime.now().isoformat()
            if not data.get('checked_at'):
                data['checked_at'] = datetime.now().isoformat()
            
            result = self.client.table('symptom_checks').insert(data).execute()
            if result.data:
                return SymptomCheck(**result.data[0])
        except Exception as e:
            logger.error(f"Error creating symptom check: {e}")
        return None
    
    async def get_symptom_checks(self, user_id: str, days: int = 30) -> List[SymptomCheck]:
        """Get symptom checks"""
        if not self.is_connected:
            return []
        
        try:
            since_date = (datetime.now() - timedelta(days=days)).isoformat()
            query = self.client.table('symptom_checks').select('*').eq('user_id', user_id)
            query = query.gte('checked_at', since_date)
            
            result = query.order('checked_at', desc=True).execute()
            return [SymptomCheck(**check) for check in result.data]
        except Exception as e:
            logger.error(f"Error getting symptom checks: {e}")
        return []
    
    # Chat Session Operations
    async def create_chat_session(self, session_data: ChatSessionCreate) -> Optional[ChatSession]:
        """Create chat session"""
        if not self.is_connected:
            return None
        
        try:
            data = session_data.dict()
            data['id'] = str(uuid.uuid4())
            data['created_at'] = datetime.now().isoformat()
            if not data.get('session_start'):
                data['session_start'] = datetime.now().isoformat()
            
            result = self.client.table('chat_sessions').insert(data).execute()
            if result.data:
                return ChatSession(**result.data[0])
        except Exception as e:
            logger.error(f"Error creating chat session: {e}")
        return None
    
    async def create_chat_message(self, message_data: ChatMessageCreate) -> Optional[ChatMessage]:
        """Create chat message"""
        if not self.is_connected:
            return None
        
        try:
            data = message_data.dict()
            data['id'] = str(uuid.uuid4())
            data['created_at'] = datetime.now().isoformat()
            if not data.get('timestamp'):
                data['timestamp'] = datetime.now().isoformat()
            
            result = self.client.table('chat_messages').insert(data).execute()
            if result.data:
                # Update session message count
                try:
                    self.client.rpc('increment_message_count', {'session_id': data['session_id']}).execute()
                except:
                    pass  # Non-critical
                
                return ChatMessage(**result.data[0])
        except Exception as e:
            logger.error(f"Error creating chat message: {e}")
        return None
    
    # Audio File Operations
    async def create_audio_file(self, audio_data: AudioFileCreate) -> Optional[AudioFile]:
        """Create audio file record"""
        if not self.is_connected:
            return None
        
        try:
            data = audio_data.dict()
            data['id'] = str(uuid.uuid4())
            data['created_at'] = datetime.now().isoformat()
            
            result = self.client.table('audio_files').insert(data).execute()
            if result.data:
                return AudioFile(**result.data[0])
        except Exception as e:
            logger.error(f"Error creating audio file: {e}")
        return None
    
    async def get_audio_files(self, user_id: str, active_only: bool = True) -> List[AudioFile]:
        """Get user audio files"""
        if not self.is_connected:
            return []
        
        try:
            query = self.client.table('audio_files').select('*').eq('user_id', user_id)
            if active_only:
                query = query.is_('expires_at', 'null').or_('expires_at.gt.' + datetime.now().isoformat())
            
            result = query.order('created_at', desc=True).execute()
            return [AudioFile(**audio) for audio in result.data]
        except Exception as e:
            logger.error(f"Error getting audio files: {e}")
        return []
    
    # Health Tips Operations
    async def get_health_tips(self, category: Optional[str] = None, limit: int = 5) -> List[HealthTip]:
        """Get health tips"""
        if not self.is_connected:
            return []
        
        try:
            query = self.client.table('health_tips').select('*').eq('is_active', True)
            if category:
                query = query.eq('category', category)
            
            result = query.order('priority', desc=True).limit(limit).execute()
            return [HealthTip(**tip) for tip in result.data]
        except Exception as e:
            logger.error(f"Error getting health tips: {e}")
        return []
    
    async def create_user_health_tip_interaction(self, interaction_data: UserHealthTipCreate) -> Optional[UserHealthTip]:
        """Record user interaction with health tip"""
        if not self.is_connected:
            return None
        
        try:
            data = interaction_data.dict()
            data['id'] = str(uuid.uuid4())
            data['created_at'] = datetime.now().isoformat()
            if not data.get('shown_at'):
                data['shown_at'] = datetime.now().isoformat()
            
            result = self.client.table('user_health_tips').insert(data).execute()
            if result.data:
                return UserHealthTip(**result.data[0])
        except Exception as e:
            logger.error(f"Error creating user health tip interaction: {e}")
        return None

# Global database instance
db_service = DatabaseService()
