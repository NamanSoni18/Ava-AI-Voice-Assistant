"""
Database models for Ava AI Voice Assistant
"""
from typing import Optional, List, Dict, Any
from datetime import datetime, date
from pydantic import BaseModel, Field
import uuid

# Base model with common fields
class BaseEntity(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

# User Models
class User(BaseEntity):
    email: str
    full_name: Optional[str] = None
    date_of_birth: Optional[date] = None
    phone_number: Optional[str] = None
    emergency_contact_name: Optional[str] = None
    emergency_contact_phone: Optional[str] = None
    is_active: bool = True
    timezone: str = "UTC"
    preferences: Optional[Dict[str, Any]] = None

class UserCreate(BaseModel):
    email: str
    full_name: Optional[str] = None
    date_of_birth: Optional[date] = None
    phone_number: Optional[str] = None
    emergency_contact_name: Optional[str] = None
    emergency_contact_phone: Optional[str] = None
    timezone: str = "UTC"
    preferences: Optional[Dict[str, Any]] = None

class UserUpdate(BaseModel):
    email: Optional[str] = None
    full_name: Optional[str] = None
    date_of_birth: Optional[date] = None
    phone_number: Optional[str] = None
    emergency_contact_name: Optional[str] = None
    emergency_contact_phone: Optional[str] = None
    is_active: Optional[bool] = None
    timezone: Optional[str] = None
    preferences: Optional[Dict[str, Any]] = None

# Medication Models
class Medication(BaseEntity):
    user_id: str
    name: str
    dosage: str
    frequency: str
    medication_time: str
    notes: Optional[str] = None
    is_active: bool = True
    medication_type: Optional[str] = None
    doctor_prescribed: Optional[str] = None
    start_date: Optional[date] = None
    end_date: Optional[date] = None
    refill_reminder_days: int = 7

class MedicationCreate(BaseModel):
    user_id: str
    name: str
    dosage: str
    frequency: str
    medication_time: str
    notes: Optional[str] = None
    medication_type: Optional[str] = None
    doctor_prescribed: Optional[str] = None
    start_date: Optional[date] = None
    end_date: Optional[date] = None
    refill_reminder_days: int = 7

class MedicationUpdate(BaseModel):
    name: Optional[str] = None
    dosage: Optional[str] = None
    frequency: Optional[str] = None
    medication_time: Optional[str] = None
    notes: Optional[str] = None
    is_active: Optional[bool] = None
    medication_type: Optional[str] = None
    doctor_prescribed: Optional[str] = None
    start_date: Optional[date] = None
    end_date: Optional[date] = None
    refill_reminder_days: Optional[int] = None

# Medication Log Models
class MedicationLog(BaseEntity):
    user_id: str
    medication_id: str
    taken_at: Optional[datetime] = None
    scheduled_time: str
    status: str  # "taken", "missed", "skipped", "delayed"
    notes: Optional[str] = None

class MedicationLogCreate(BaseModel):
    user_id: str
    medication_id: str
    taken_at: Optional[datetime] = None
    scheduled_time: str
    status: str
    notes: Optional[str] = None

# Reminder Models
class Reminder(BaseEntity):
    user_id: str
    medication_id: Optional[str] = None
    title: str
    description: Optional[str] = None
    reminder_time: str
    is_recurring: bool = True
    days_of_week: Optional[List[str]] = None
    reminder_type: Optional[str] = None  # "medication", "appointment", "general"
    is_active: bool = True
    last_triggered: Optional[datetime] = None
    snooze_until: Optional[datetime] = None

class ReminderCreate(BaseModel):
    user_id: str
    medication_id: Optional[str] = None
    title: str
    description: Optional[str] = None
    reminder_time: str
    is_recurring: bool = True
    days_of_week: Optional[List[str]] = None
    reminder_type: Optional[str] = None

class ReminderUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    reminder_time: Optional[str] = None
    is_recurring: Optional[bool] = None
    days_of_week: Optional[List[str]] = None
    reminder_type: Optional[str] = None
    is_active: Optional[bool] = None
    snooze_until: Optional[datetime] = None
    last_triggered: Optional[datetime] = None

# Emergency Contact Models
class EmergencyContact(BaseEntity):
    user_id: str
    name: str
    phone: str
    relationship: str
    is_primary: bool = False
    email: Optional[str] = None
    address: Optional[str] = None
    notes: Optional[str] = None
    contact_type: Optional[str] = None

class EmergencyContactCreate(BaseModel):
    user_id: str
    name: str
    phone: str
    relationship: str
    is_primary: bool = False
    email: Optional[str] = None
    address: Optional[str] = None
    notes: Optional[str] = None
    contact_type: Optional[str] = None

class EmergencyContactUpdate(BaseModel):
    name: Optional[str] = None
    phone: Optional[str] = None
    relationship: Optional[str] = None
    is_primary: Optional[bool] = None
    email: Optional[str] = None
    address: Optional[str] = None
    notes: Optional[str] = None
    contact_type: Optional[str] = None

# Health Record Models
class HealthRecord(BaseEntity):
    user_id: str
    record_type: str  # "blood_pressure", "weight", "temperature", "glucose", etc.
    data: Dict[str, Any]
    recorded_at: Optional[datetime] = None
    notes: Optional[str] = None
    severity: Optional[str] = None  # "normal", "warning", "critical"
    follow_up_required: bool = False

class HealthRecordCreate(BaseModel):
    user_id: str
    record_type: str
    data: Dict[str, Any]
    recorded_at: Optional[datetime] = None
    notes: Optional[str] = None
    severity: Optional[str] = None
    follow_up_required: bool = False

# Symptom Check Models
class SymptomCheck(BaseEntity):
    user_id: str
    symptoms: str
    severity: Optional[str] = None  # "mild", "moderate", "severe"
    duration: Optional[str] = None
    ai_analysis: Optional[str] = None
    recommendations: Optional[List[str]] = None
    checked_at: Optional[datetime] = None
    follow_up_required: bool = False
    doctor_notified: bool = False

class SymptomCheckCreate(BaseModel):
    user_id: str
    symptoms: str
    severity: Optional[str] = None
    duration: Optional[str] = None
    ai_analysis: Optional[str] = None
    recommendations: Optional[List[str]] = None
    follow_up_required: bool = False
    doctor_notified: bool = False

# Chat Session Models
class ChatSession(BaseEntity):
    user_id: str
    session_start: Optional[datetime] = None
    session_end: Optional[datetime] = None
    message_count: int = 0

class ChatSessionCreate(BaseModel):
    user_id: str
    session_start: Optional[datetime] = None

# Chat Message Models
class ChatMessage(BaseEntity):
    session_id: str
    user_id: str
    message_type: str  # "user", "assistant", "system"
    content: str
    audio_url: Optional[str] = None
    timestamp: Optional[datetime] = None
    processing_time_ms: Optional[int] = None
    gemini_response: bool = False
    voice_input: bool = False

class ChatMessageCreate(BaseModel):
    session_id: str
    user_id: str
    message_type: str
    content: str
    audio_url: Optional[str] = None
    processing_time_ms: Optional[int] = None
    gemini_response: bool = False
    voice_input: bool = False

# Audio File Models
class AudioFile(BaseEntity):
    user_id: str
    filename: str
    file_path: str
    file_size: Optional[int] = None
    duration_seconds: Optional[float] = None
    audio_type: Optional[str] = None  # "speech", "tts", "recording"
    expires_at: Optional[datetime] = None
    is_processed: bool = False

class AudioFileCreate(BaseModel):
    user_id: str
    filename: str
    file_path: str
    file_size: Optional[int] = None
    duration_seconds: Optional[float] = None
    audio_type: Optional[str] = None
    expires_at: Optional[datetime] = None
    is_processed: bool = False

# Health Tip Models
class HealthTip(BaseEntity):
    tip_content: str
    category: Optional[str] = None
    priority: int = 1
    is_active: bool = True
    source: Optional[str] = None

class HealthTipCreate(BaseModel):
    tip_content: str
    category: Optional[str] = None
    priority: int = 1
    source: Optional[str] = None

# User Health Tip Models
class UserHealthTip(BaseEntity):
    user_id: str
    health_tip_id: str
    shown_at: Optional[datetime] = None
    rating: Optional[int] = None
    feedback: Optional[str] = None
    is_helpful: Optional[bool] = None

class UserHealthTipCreate(BaseModel):
    user_id: str
    health_tip_id: str
    rating: Optional[int] = None
    feedback: Optional[str] = None
    is_helpful: Optional[bool] = None

# API Response Models
class APIResponse(BaseModel):
    success: bool
    data: Optional[Dict[str, Any]] = None
    message: Optional[str] = None
    error: Optional[str] = None
    timestamp: Optional[datetime] = Field(default_factory=datetime.now)

class PaginatedResponse(APIResponse):
    total: Optional[int] = None
    page: Optional[int] = None
    page_size: Optional[int] = None
    has_next: Optional[bool] = None
    has_prev: Optional[bool] = None
