import os
import sys
from pathlib import Path
import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI, HTTPException, UploadFile, File, Query
from fastapi.responses import FileResponse, JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
import uvicorn
import asyncio
import threading
from typing import Optional, Dict, Any, List
import json
from datetime import datetime, time
import uuid

# Set UTF-8 encoding for Windows
if sys.platform.startswith('win'):
    import locale
    os.environ['PYTHONIOENCODING'] = 'utf-8'
    if hasattr(sys.stdout, 'reconfigure'):
        sys.stdout.reconfigure(encoding='utf-8')
    if hasattr(sys.stderr, 'reconfigure'):
        sys.stderr.reconfigure(encoding='utf-8')

# Add the project root to Python path
project_root = Path(__file__).parent
sys.path.insert(0, str(project_root))

from core.voice_input import VoiceInput
from core.gemini_response import GeminiResponse
from core.murf_tts import MurfTTS
from config import Config
from database import (
    db_service, User, UserCreate, UserUpdate,
    Medication, MedicationCreate, MedicationUpdate,
    MedicationLog, MedicationLogCreate,
    Reminder, ReminderCreate, ReminderUpdate,
    EmergencyContact, EmergencyContactCreate, EmergencyContactUpdate,
    HealthRecord, HealthRecordCreate,
    SymptomCheck, SymptomCheckCreate,
    ChatSession, ChatSessionCreate,
    ChatMessage, ChatMessageCreate,
    AudioFile, AudioFileCreate,
    HealthTip, HealthTipCreate,
    UserHealthTip, UserHealthTipCreate,
    APIResponse, PaginatedResponse
)

# Initialize services
voice_input: Optional[VoiceInput] = None
gemini_response: Optional[GeminiResponse] = None
murf_tts: Optional[MurfTTS] = None

# Set up logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Initialize fallback data stores (used when database is not available)
fallback_medications_db = []
fallback_reminders_db = []
fallback_emergency_contacts_db = []
fallback_health_tips_db = [
    {"tip": "Drink at least 8 glasses of water daily"},
    {"tip": "Take short walks every hour if possible"},
    {"tip": "Get 7-8 hours of sleep each night"},
    {"tip": "Practice deep breathing exercises to reduce stress"}
]

# Current user context (for single-user mode)
current_user_id = Config.DEFAULT_USER_ID

# Ensure audio directory exists
@asynccontextmanager
async def lifespan(app: FastAPI):
    """Handle startup and shutdown events"""
    global voice_input, gemini_response, murf_tts
    
    # Startup
    try:
        print("Initializing Ava AI services...")
        
        # Initialize Voice Input
        voice_input = VoiceInput()
        if not voice_input.test_microphone():
            print("WARNING: Microphone test failed")
        else:
            print("SUCCESS: Voice input initialized")
        
        # Initialize Gemini
        gemini_response = GeminiResponse()
        if not gemini_response.test_connection():
            print("WARNING: Gemini AI connection failed")
        else:
            print("SUCCESS: Gemini AI initialized")
        
        # Initialize Murf TTS
        murf_tts = MurfTTS()
        if not murf_tts.test_connection():
            print("WARNING: Murf TTS connection failed")
        else:
            print("SUCCESS: Murf TTS initialized")
            
        print("API server ready!")
        
    except Exception as e:
        print(f"ERROR: Error initializing services: {e}")
        # Don't prevent startup, use fallback services
    
    yield
    
    # Shutdown
    print("Shutting down Ava AI services...")

# Initialize FastAPI app with lifespan
app = FastAPI(
    title="Ava AI Voice Assistant API",
    description="HTTP API for Ava AI Voice Assistant",
    version="1.0.0",
    lifespan=lifespan
)

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # In production, specify your Electron app's origin
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Serve static audio files
audio_dir = os.path.join(os.path.dirname(__file__), "assets", "audio")
os.makedirs(audio_dir, exist_ok=True)
app.mount("/audio", StaticFiles(directory=audio_dir), name="audio")

# Request/Response Models for API endpoints
class VoiceRequest(BaseModel):
    timeout: int = 10
    phrase_time_limit: int = 15

class GeminiRequest(BaseModel):
    text: str
    conversation_history: Optional[list] = None

class TTSRequest(BaseModel):
    text: str
    voice_id: Optional[str] = None
    style: Optional[str] = None
    speed: float = 1.0

# Legacy models for backward compatibility
class LegacyMedication(BaseModel):
    name: str
    dosage: str
    frequency: str
    time: str
    notes: Optional[str] = None

class LegacyReminder(BaseModel):
    title: str
    description: Optional[str] = None
    medicationId: str
    schedule: str
    is_recurring: bool = True
    days_of_week: Optional[List[str]] = None

class LegacyEmergencyContact(BaseModel):
    name: str
    phone: str
    relationship: str
    is_primary: bool = False

class SymptomCheckRequest(BaseModel):
    symptoms: str
    severity: Optional[str] = None
    duration: Optional[str] = None

# API Endpoints
            
@app.get("/")
async def root():
    """Root endpoint"""
    return {
        "message": "Ava AI Voice Assistant API", 
        "version": "1.0.0",
        "status": "running"
    }

@app.get("/status")
async def get_status():
    """Get service status"""
    voice_status = voice_input.test_microphone() if voice_input else False
    gemini_status = gemini_response.test_connection() if gemini_response else False
    murf_status = murf_tts.test_connection() if murf_tts else False
    
    # Get database status
    db_status = db_service.health_check()
    
    status = {
        "voice_input": voice_status,
        "gemini_ai": gemini_status,
        "murf_tts": murf_status,
        "database": db_status,
        "config": {
            "database_configured": Config.is_database_configured(),
            "current_user_id": current_user_id
        }
    }
    
    return APIResponse(
        success=True,
        data=status,
        message="Service status retrieved"
    )

@app.post("/voice")
async def start_voice_recognition(request: VoiceRequest):
    """Start voice recognition and return transcribed text"""
    if not voice_input:
        raise HTTPException(status_code=503, detail="Voice input service not available")
    
    try:
        # Run voice recognition in thread pool to avoid blocking
        loop = asyncio.get_event_loop()
        text = await loop.run_in_executor(
            None, 
            voice_input.listen_once, 
            request.timeout, 
            request.phrase_time_limit
        )
        
        if text:
            return APIResponse(
                success=True,
                data={"text": text, "duration": request.timeout},
                message="Voice recognition successful"
            )
        else:
            return APIResponse(
                success=False,
                message="No speech detected",
                error="TIMEOUT_OR_NO_SPEECH"
            )
            
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Voice recognition failed: {str(e)}")

@app.post("/gemini")
async def get_gemini_response(request: GeminiRequest):
    """Get AI response from Gemini"""
    if not gemini_response:
        raise HTTPException(status_code=503, detail="Gemini AI service not available")
    
    try:
        # Run Gemini request in thread pool
        loop = asyncio.get_event_loop()
        response = await loop.run_in_executor(
            None,
            gemini_response.get_response,
            request.text
        )
        
        if response:
            return APIResponse(
                success=True,
                data={
                    "response": response,
                    "input": request.text
                },
                message="AI response generated"
            )
        else:
            raise HTTPException(status_code=500, detail="Failed to get AI response")
            
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Gemini AI error: {str(e)}")

@app.post("/murf")
async def convert_to_speech(request: TTSRequest):
    """Convert text to speech using Murf TTS"""
    if not murf_tts:
        raise HTTPException(status_code=503, detail="Murf TTS service not available")
    
    try:
        # Run TTS in thread pool
        loop = asyncio.get_event_loop()
        audio_path = await loop.run_in_executor(
            None,
            murf_tts.text_to_speech,
            request.text,
            request.voice_id,
            request.style,
            request.speed
        )
        
        if audio_path and os.path.exists(audio_path):
            # Return relative path for frontend
            filename = os.path.basename(audio_path)
            audio_url = f"/audio/{filename}"
            
            return APIResponse(
                success=True,
                data={
                    "audio_url": audio_url,
                    "audio_path": audio_path,
                    "filename": filename,
                    "text": request.text
                },
                message="Text-to-speech conversion successful"
            )
        else:
            # Try fallback TTS
            if murf_tts.fallback_tts:
                return APIResponse(
                    success=True,
                    data={
                        "fallback": True,
                        "text": request.text,
                        "message": "Using system TTS (no audio file generated)"
                    },
                    message="Using fallback TTS"
                )
            else:
                raise HTTPException(status_code=500, detail="Text-to-speech conversion failed")
            
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"TTS error: {str(e)}")

@app.get("/voices")
async def get_available_voices():
    """Get available voices"""
    if not murf_tts:
        raise HTTPException(status_code=503, detail="Murf TTS service not available")
    
    try:
        voices = murf_tts.get_available_voices()
        return APIResponse(
            success=True,
            data=voices,
            message="Available voices retrieved"
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error getting voices: {str(e)}")

@app.delete("/audio/{filename}")
async def delete_audio_file(filename: str):
    """Delete a specific audio file"""
    try:
        file_path = os.path.join(audio_dir, filename)
        if os.path.exists(file_path) and filename.startswith("ava_speech_"):
            os.remove(file_path)
            return APIResponse(
                success=True,
                message=f"Audio file {filename} deleted"
            )
        else:
            raise HTTPException(status_code=404, detail="Audio file not found")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error deleting file: {str(e)}")

@app.post("/cleanup")
async def cleanup_audio_files():
    """Clean up old audio files"""
    if not murf_tts:
        raise HTTPException(status_code=503, detail="Murf TTS service not available")
    
    try:
        murf_tts.cleanup_audio_files(max_files=10)
        return APIResponse(
            success=True,
            message="Audio files cleaned up"
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error cleaning up files: {str(e)}")

@app.post("/stop-audio")
async def stop_audio_playback():
    """Stop current audio playback"""
    if not murf_tts:
        raise HTTPException(status_code=503, detail="Murf TTS service not available")
    
    try:
        murf_tts.stop_audio()
        return APIResponse(
            success=True,
            message="Audio playback stopped"
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error stopping audio: {str(e)}")

# Medication Management Endpoints
@app.get("/api/medications", response_model=APIResponse)
async def get_medications():
    """Get all medications"""
    try:
        if db_service.is_connected:
            medications = await db_service.get_medications(current_user_id)
            return APIResponse(
                success=True,
                data={"medications": [med.dict() for med in medications]},
                message="Medications retrieved successfully"
            )
        else:
            return APIResponse(
                success=True,
                data={"medications": fallback_medications_db},
                message="Medications retrieved successfully (fallback mode)"
            )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error getting medications: {str(e)}")

@app.post("/api/medications", response_model=APIResponse)
async def add_medication(medication: LegacyMedication):
    """Add a new medication"""
    try:
        if db_service.is_connected:
            medication_data = MedicationCreate(
                user_id=current_user_id,
                name=medication.name,
                dosage=medication.dosage,
                frequency=medication.frequency,
                medication_time=medication.time,
                notes=medication.notes
            )
            new_med = await db_service.create_medication(medication_data)
            if new_med:
                # Automatically create a reminder for this medication
                try:
                    reminder_data = ReminderCreate(
                        user_id=current_user_id,
                        medication_id=new_med.id,
                        title=f"Take {medication.name}",
                        description=f"Time to take your {medication.dosage} of {medication.name}",
                        reminder_time=medication.time,
                        reminder_type="medication"
                    )
                    await db_service.create_reminder(reminder_data)
                except Exception as reminder_error:
                    logger.warning(f"Failed to create automatic reminder: {reminder_error}")
                
                return APIResponse(
                    success=True,
                    data={"medication": new_med.dict()},
                    message="Medication added successfully"
                )
            else:
                raise HTTPException(status_code=500, detail="Failed to create medication")
        else:
            # Fallback mode
            medication_id = str(uuid.uuid4())
            new_med = {
                "id": medication_id,
                "name": medication.name,
                "dosage": medication.dosage,
                "frequency": medication.frequency,
                "time": medication.time,
                "notes": medication.notes,
                "last_taken": None,
                "is_active": True
            }
            fallback_medications_db.append(new_med)
            
            # Automatically create a reminder for this medication
            try:
                reminder_id = str(uuid.uuid4())
                new_reminder = {
                    "id": reminder_id,
                    "title": f"Take {medication.name}",
                    "description": f"Time to take your {medication.dosage} of {medication.name}",
                    "medicationId": medication_id,
                    "schedule": medication.time,
                    "is_recurring": True,
                    "days_of_week": ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]
                }
                fallback_reminders_db.append(new_reminder)
            except Exception as reminder_error:
                logger.warning(f"Failed to create automatic reminder: {reminder_error}")
            
            return APIResponse(
                success=True,
                data={"medication": new_med},
                message="Medication added successfully (fallback mode)"
            )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error adding medication: {str(e)}")

@app.put("/api/medications/{medication_id}", response_model=APIResponse)
async def update_medication(medication_id: str, medication: LegacyMedication):
    """Update an existing medication"""
    try:
        if db_service.is_connected:
            medication_data = MedicationUpdate(
                name=medication.name,
                dosage=medication.dosage,
                frequency=medication.frequency,
                medication_time=medication.time,
                notes=medication.notes
            )
            updated_med = await db_service.update_medication(medication_id, medication_data)
            if updated_med:
                # CRITICAL: Update associated reminders with new timing
                try:
                    # Find and update all reminders for this medication
                    existing_reminders = await db_service.get_reminders(current_user_id)
                    for reminder in existing_reminders:
                        if reminder.medication_id == medication_id:
                            reminder_update = ReminderUpdate(
                                title=f"Take {medication.name}",
                                description=f"Time to take your {medication.dosage} of {medication.name}",
                                reminder_time=medication.time,
                                last_triggered=None,  # Reset trigger history when medication is edited
                                snooze_until=None     # Clear any snooze state when medication is edited
                            )
                            await db_service.update_reminder(reminder.id, reminder_update)
                            logger.info(f"Updated reminder for medication {medication.name} with new time {medication.time}")
                except Exception as reminder_error:
                    logger.warning(f"Failed to update medication reminders: {reminder_error}")
                
                return APIResponse(
                    success=True,
                    data={"medication": updated_med.dict()},
                    message="Medication updated successfully"
                )
            else:
                raise HTTPException(status_code=404, detail="Medication not found")
        else:
            # Fallback mode
            for idx, med in enumerate(fallback_medications_db):
                if med["id"] == medication_id:
                    updated_med = {
                        "id": medication_id,
                        "name": medication.name,
                        "dosage": medication.dosage,
                        "frequency": medication.frequency,
                        "time": medication.time,
                        "notes": medication.notes,
                        "last_taken": med.get("last_taken"),
                        "is_active": med.get("is_active", True)
                    }
                    fallback_medications_db[idx] = updated_med
                    
                    # Update associated reminders
                    try:
                        for reminder_idx, reminder in enumerate(fallback_reminders_db):
                            if reminder.get("medicationId") == medication_id:
                                fallback_reminders_db[reminder_idx].update({
                                    "title": f"Take {medication.name}",
                                    "description": f"Time to take your {medication.dosage} of {medication.name}",
                                    "schedule": medication.time
                                })
                    except Exception as reminder_error:
                        logger.warning(f"Failed to update automatic reminders: {reminder_error}")
                    
                    return APIResponse(
                        success=True,
                        data={"medication": updated_med},
                        message="Medication updated successfully (fallback mode)"
                    )
            raise HTTPException(status_code=404, detail="Medication not found")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error updating medication: {str(e)}")

@app.delete("/api/medications/{medication_id}", response_model=APIResponse)
async def delete_medication(medication_id: str):
    """Delete a medication"""
    try:
        if db_service.is_connected:
            # Delete the medication (soft delete)
            success = await db_service.delete_medication(medication_id)
            if success:
                return APIResponse(
                    success=True,
                    message="Medication deleted successfully"
                )
            else:
                raise HTTPException(status_code=404, detail="Medication not found")
        else:
            # Fallback mode
            global fallback_medications_db, fallback_reminders_db
            
            # First delete associated reminders
            try:
                fallback_reminders_db = [reminder for reminder in fallback_reminders_db if reminder.get("medicationId") != medication_id]
            except Exception as reminder_error:
                logger.warning(f"Failed to delete automatic reminders: {reminder_error}")
            
            # Then delete the medication
            original_count = len(fallback_medications_db)
            fallback_medications_db = [med for med in fallback_medications_db if med["id"] != medication_id]
            
            if len(fallback_medications_db) < original_count:
                return APIResponse(
                    success=True,
                    message="Medication deleted successfully (fallback mode)"
                )
            else:
                raise HTTPException(status_code=404, detail="Medication not found")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error deleting medication: {str(e)}")

# Reminder Endpoints
@app.get("/api/reminders", response_model=APIResponse)
async def get_reminders():
    """Get all reminders"""
    try:
        if db_service.is_connected:
            reminders = await db_service.get_reminders(current_user_id)
            return APIResponse(
                success=True,
                data={"reminders": [reminder.dict() for reminder in reminders]},
                message="Reminders retrieved successfully"
            )
        else:
            return APIResponse(
                success=True,
                data={"reminders": fallback_reminders_db},
                message="Reminders retrieved successfully (fallback mode)"
            )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error getting reminders: {str(e)}")

@app.get("/api/reminders/medication/{medication_id}", response_model=APIResponse)
async def get_reminders_by_medication(medication_id: str):
    """Get reminders for a specific medication"""
    try:
        if db_service.is_connected:
            reminders = await db_service.get_reminders(current_user_id)
            medication_reminders = [r for r in reminders if r.medication_id == medication_id]
            return APIResponse(
                success=True,
                data={"reminders": [reminder.dict() for reminder in medication_reminders]},
                message="Medication reminders retrieved successfully"
            )
        else:
            medication_reminders = [reminder for reminder in fallback_reminders_db if reminder.get("medicationId") == medication_id]
            return APIResponse(
                success=True,
                data={"reminders": medication_reminders},
                message="Medication reminders retrieved successfully (fallback mode)"
            )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error getting medication reminders: {str(e)}")

@app.post("/api/reminders", response_model=APIResponse)
async def add_reminder(reminder: LegacyReminder):
    """Add a new reminder"""
    try:
        if db_service.is_connected:
            reminder_data = ReminderCreate(
                user_id=current_user_id,
                medication_id=reminder.medicationId if reminder.medicationId else None,
                title=reminder.title,
                description=reminder.description,
                reminder_time=reminder.schedule,
                is_recurring=reminder.is_recurring,
                days_of_week=reminder.days_of_week,
                reminder_type="medication" if reminder.medicationId else "general"
            )
            new_reminder = await db_service.create_reminder(reminder_data)
            if new_reminder:
                return APIResponse(
                    success=True,
                    data={"reminder": new_reminder.dict()},
                    message="Reminder added successfully"
                )
            else:
                raise HTTPException(status_code=500, detail="Failed to create reminder")
        else:
            reminder_id = str(uuid.uuid4())
            new_reminder = {
                "id": reminder_id,
                **reminder.dict()
            }
            fallback_reminders_db.append(new_reminder)
            return APIResponse(
                success=True,
                data={"reminder": new_reminder},
                message="Reminder added successfully (fallback mode)"
            )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error adding reminder: {str(e)}")

@app.put("/api/reminders/{reminder_id}", response_model=APIResponse)
async def update_reminder(reminder_id: str, reminder: LegacyReminder):
    """Update an existing reminder"""
    try:
        if db_service.is_connected:
            reminder_data = ReminderUpdate(
                title=reminder.title,
                description=reminder.description,
                reminder_time=reminder.schedule,
                is_recurring=reminder.is_recurring,
                days_of_week=reminder.days_of_week
            )
            updated_reminder = await db_service.update_reminder(reminder_id, reminder_data)
            if updated_reminder:
                return APIResponse(
                    success=True,
                    data={"reminder": updated_reminder.dict()},
                    message="Reminder updated successfully"
                )
            else:
                raise HTTPException(status_code=404, detail="Reminder not found")
        else:
            # Fallback mode
            reminder_index = None
            for i, r in enumerate(fallback_reminders_db):
                if r["id"] == reminder_id:
                    reminder_index = i
                    break
            
            if reminder_index is None:
                raise HTTPException(status_code=404, detail="Reminder not found")
            
            # Update the reminder
            updated_reminder = {
                "id": reminder_id,
                **reminder.dict()
            }
            fallback_reminders_db[reminder_index] = updated_reminder
            
            return APIResponse(
                success=True,
                data={"reminder": updated_reminder},
                message="Reminder updated successfully (fallback mode)"
            )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error updating reminder: {str(e)}")

@app.delete("/api/reminders/{reminder_id}", response_model=APIResponse)
async def delete_reminder(reminder_id: str):
    """Delete an existing reminder"""
    try:
        if db_service.is_connected:
            success = await db_service.delete_reminder(reminder_id)
            if success:
                return APIResponse(
                    success=True,
                    message="Reminder deleted successfully"
                )
            else:
                raise HTTPException(status_code=404, detail="Reminder not found")
        else:
            # Fallback mode
            reminder_index = None
            for i, r in enumerate(fallback_reminders_db):
                if r["id"] == reminder_id:
                    reminder_index = i
                    break
            
            if reminder_index is None:
                raise HTTPException(status_code=404, detail="Reminder not found")
            
            # Remove the reminder
            deleted_reminder = fallback_reminders_db.pop(reminder_index)
            
            return APIResponse(
                success=True,
                data={"reminder": deleted_reminder},
                message="Reminder deleted successfully (fallback mode)"
            )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error deleting reminder: {str(e)}")

# Reminder Notification Endpoints
@app.get("/api/reminders/due", response_model=APIResponse)
async def get_due_reminders():
    """Get reminders that are currently due"""
    try:
        if db_service.is_connected:
            now = datetime.now()
            current_time = now.strftime("%H:%M")
            current_day = now.strftime("%A")
            
            # Get all active reminders
            all_reminders = await db_service.get_reminders(current_user_id, active_only=True)
            
            # Filter for due reminders
            due_reminders = []
            for reminder in all_reminders:
                if is_reminder_due(reminder, current_time, current_day):
                    due_reminders.append(reminder)
            
            return APIResponse(
                success=True,
                data={"reminders": due_reminders},
                message=f"Found {len(due_reminders)} due reminders"
            )
        else:
            return APIResponse(
                success=False,
                error="Database not connected"
            )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error getting due reminders: {str(e)}")

@app.post("/api/reminders/{reminder_id}/snooze", response_model=APIResponse)
async def snooze_reminder(reminder_id: str, minutes: int = 5):
    """Snooze a reminder for specified minutes"""
    try:
        if db_service.is_connected:
            from datetime import timedelta
            snooze_until = datetime.now() + timedelta(minutes=minutes)
            
            reminder_update = ReminderUpdate(snooze_until=snooze_until)
            updated_reminder = await db_service.update_reminder(reminder_id, reminder_update)
            
            if updated_reminder:
                return APIResponse(
                    success=True,
                    data={"reminder": updated_reminder},
                    message=f"Reminder snoozed for {minutes} minutes"
                )
            else:
                return APIResponse(
                    success=False,
                    error="Reminder not found"
                )
        else:
            return APIResponse(
                success=False,
                error="Database not connected"
            )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error snoozing reminder: {str(e)}")

@app.post("/api/reminders/{reminder_id}/complete", response_model=APIResponse)
async def complete_reminder(reminder_id: str, medication_id: Optional[str] = None):
    """Mark a reminder as completed for today"""
    try:
        if db_service.is_connected:
            now = datetime.now()
            
            # Update reminder last_triggered
            reminder_update = ReminderUpdate(last_triggered=now)
            updated_reminder = await db_service.update_reminder(reminder_id, reminder_update)
            
            if not updated_reminder:
                return APIResponse(
                    success=False,
                    error="Reminder not found"
                )
            
            # If it's a medication reminder, log it
            if medication_id:
                try:
                    log_data = MedicationLogCreate(
                        user_id=current_user_id,
                        medication_id=medication_id,
                        taken_at=now,
                        scheduled_time=now.strftime("%H:%M"),
                        status="taken"
                    )
                    
                    await db_service.add_medication_log(log_data)
                    logger.info(f"Medication log created for reminder {reminder_id}")
                except Exception as log_error:
                    logger.warning(f"Failed to create medication log: {log_error}")
            
            return APIResponse(
                success=True,
                data={"reminder": updated_reminder},
                message="Reminder marked as completed"
            )
        else:
            return APIResponse(
                success=False,
                error="Database not connected"
            )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error completing reminder: {str(e)}")

def is_reminder_due(reminder: Reminder, current_time: str, current_day: str) -> bool:
    """Check if a reminder is due based on time and frequency"""
    
    # Check if reminder is active
    if not reminder.is_active:
        return False
    
    # Check if reminder is snoozed
    if reminder.snooze_until:
        if reminder.snooze_until > datetime.now():
            return False
    
    # Check if time matches (allowing for 1-minute tolerance)
    try:
        reminder_hour, reminder_minute = map(int, reminder.reminder_time.split(':'))
        current_hour, current_minute = map(int, current_time.split(':'))
        
        # Allow 1-minute tolerance
        time_diff = abs((current_hour * 60 + current_minute) - (reminder_hour * 60 + reminder_minute))
        if time_diff > 1:
            return False
    except (ValueError, AttributeError):
        return False
    
    # For recurring reminders, check days of week
    if reminder.is_recurring and reminder.days_of_week:
        if current_day not in reminder.days_of_week:
            return False
    
    # Check if already triggered today (prevent duplicate notifications)
    if reminder.last_triggered:
        last_triggered_date = reminder.last_triggered.date()
        today = datetime.now().date()
        if last_triggered_date == today:
            return False
    
    return True
        
@app.get("/api/emergency-contacts", response_model=APIResponse)
async def get_emergency_contacts():
    """Get all emergency contacts"""
    try:
        if db_service.is_connected:
            contacts = await db_service.get_emergency_contacts(current_user_id)
            return APIResponse(
                success=True,
                data={"contacts": [contact.dict() for contact in contacts]},
                message="Emergency contacts retrieved successfully"
            )
        else:
            return APIResponse(
                success=True,
                data={"contacts": fallback_emergency_contacts_db},
                message="Emergency contacts retrieved successfully (fallback mode)"
            )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error getting emergency contacts: {str(e)}")

@app.post("/api/emergency-contacts", response_model=APIResponse)
async def add_emergency_contact(contact: LegacyEmergencyContact):
    """Add a new emergency contact"""
    try:
        if db_service.is_connected:
            contact_data = EmergencyContactCreate(
                user_id=current_user_id,
                **contact.dict()
            )
            new_contact = await db_service.create_emergency_contact(contact_data)
            if new_contact:
                return APIResponse(
                    success=True,
                    data={"contact": new_contact.dict()},
                    message="Emergency contact added successfully"
                )
            else:
                raise HTTPException(status_code=500, detail="Failed to create emergency contact")
        else:
            contact_id = str(uuid.uuid4())
            new_contact = {
                "id": contact_id,
                **contact.dict()
            }
            fallback_emergency_contacts_db.append(new_contact)
            return APIResponse(
                success=True,
                data={"contact": new_contact},
                message="Emergency contact added successfully (fallback mode)"
            )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error adding emergency contact: {str(e)}")

# Health Data Endpoints
@app.post("/api/symptom-check", response_model=APIResponse)
async def check_symptoms(request: SymptomCheckRequest):
    """Analyze symptoms using AI"""
    if not gemini_response:
        raise HTTPException(status_code=503, detail="Gemini AI service not available")
    
    try:
        # Construct focused prompt for direct medical analysis
        prompt = f"""You are a medical AI assistant. Provide a direct medical analysis and treatment recommendations for the following symptoms:

PATIENT REPORT:
- Symptoms: {request.symptoms}"""
        if request.severity:
            prompt += f"\n- Severity: {request.severity}"
        if request.duration:
            prompt += f"\n- Duration: {request.duration}"
            
        prompt += """

Provide a DIRECT medical assessment with:

1. DIAGNOSIS ASSESSMENT:
   - Most likely medical conditions based on symptoms
   - Primary and secondary diagnoses to consider

2. RECOMMENDED MEDICATIONS:
   - Specific over-the-counter medications with dosages
   - Prescription medications that may be needed
   - Pain management options
   - Any supplements that could help

3. TREATMENT PLAN:
   - Immediate relief measures
   - Short-term treatment (1-3 days)
   - Long-term management if needed
   - Lifestyle modifications

4. URGENCY LEVEL:
   - Whether immediate medical attention is needed
   - Can wait for regular doctor appointment
   - Emergency room visit required

5. WARNING SIGNS:
   - Symptoms that require immediate medical attention
   - When to seek emergency care

DO NOT ask for more information. Provide direct recommendations based on the symptoms given. Be specific with medication names, dosages, and treatment protocols."""
        
        # Run Gemini request in thread pool
        loop = asyncio.get_event_loop()
        response = await loop.run_in_executor(
            None,
            gemini_response.get_response,
            prompt
        )
        
        if response:
            return APIResponse(
                success=True,
                data={
                    "symptoms": request.symptoms,
                    "analysis": response,
                    "timestamp": datetime.now().isoformat()
                },
                message="Medical analysis completed"
            )
        else:
            raise HTTPException(status_code=500, detail="Failed to analyze symptoms")
            
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Symptom check error: {str(e)}")

@app.get("/api/health-tips", response_model=APIResponse)
async def get_health_tips(count: int = Query(3, ge=1, le=10)):
    """Get daily health tips - tries Gemini first, falls back to hardcoded tips"""
    gemini_failed = False
    gemini_error = None
    
    # First try to get tips from Gemini if available
    if gemini_response:
        try:
            logger.info("Attempting to get health tips from Gemini...")
            loop = asyncio.get_event_loop()
            prompt = f"Provide exactly {count} concise health tips. Return ONLY a JSON array format like [{{\"tip\": \"tip text\"}}] with no other text or explanation."
            
            response = await loop.run_in_executor(
                None,
                gemini_response.get_response,
                prompt
            )
            
            logger.info(f"Gemini raw response: {response}")
            
            if response:
                try:
                    # Clean the response in case there's extra text
                    json_start = response.find('[')
                    json_end = response.rfind(']') + 1
                    json_str = response[json_start:json_end]
                    
                    tips = json.loads(json_str)
                    logger.info(f"Parsed Gemini response: {tips}")
                    
                    if isinstance(tips, list) and all(isinstance(t, dict) and "tip" in t for t in tips):
                        return APIResponse(
                            success=True,
                            data={"tips": tips[:count]},
                            message="Health tips generated by AI"
                        )
                    else:
                        raise ValueError("Response doesn't match expected format")
                        
                except json.JSONDecodeError as je:
                    gemini_error = f"JSON decode error: {str(je)}"
                    logger.error(f"Failed to parse Gemini response: {gemini_error}")
                except ValueError as ve:
                    gemini_error = f"Format validation error: {str(ve)}"
                    logger.error(f"Gemini response format invalid: {gemini_error}")
            else:
                gemini_error = "Empty response from Gemini"
                logger.error(gemini_error)
                
        except Exception as e:
            gemini_error = f"Gemini request failed: {str(e)}"
            logger.error(gemini_error, exc_info=True)
            
        gemini_failed = True
    
    # If we get here, either Gemini failed or wasn't available
    logger.info(f"Using backup tips. Gemini failed: {gemini_failed}, Error: {gemini_error}")
    
    try:
        tips = fallback_health_tips_db[:count]
        return APIResponse(
            success=True,
            data={"tips": tips},
            message="Health tips retrieved from backup" + (f" (Gemini error: {gemini_error})" if gemini_error else "")
        )
    except Exception as e:
        logger.error(f"Failed to get backup tips: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=500,
            detail=f"Error getting health tips: {str(e)}"
        )
# Error handlers
@app.exception_handler(404)
async def not_found_handler(request, exc):
    return JSONResponse(
        status_code=404,
        content={"success": False, "error": "Endpoint not found"}
    )

@app.exception_handler(500)
async def internal_error_handler(request, exc):
    return JSONResponse(
        status_code=500,
        content={"success": False, "error": "Internal server error"}
    )

import socket

def find_free_port(start_port: int = 8000) -> int:
    """Find a free port starting from the given port"""
    for port in range(start_port, start_port + 10):
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
            try:
                s.bind(('127.0.0.1', port))
                return port
            except OSError:
                continue
    raise RuntimeError(f"No free port found in range {start_port} to {start_port + 9}")

def run_api_server(host: str = "127.0.0.1", port: int = 8000):
    """Run the FastAPI server"""
    # Find a free port
    try:
        free_port = find_free_port(port)
        if free_port != port:
            print(f"Port {port} not available, using port {free_port}")
        port = free_port
    except RuntimeError as e:
        print(f"ERROR: {e}")
        return
    
    print(f"Starting Ava AI API server on http://{host}:{port}")
    print("Core Endpoints:")
    print(f"   - GET  http://{host}:{port}/")
    print(f"   - GET  http://{host}:{port}/status")
    print(f"   - POST http://{host}:{port}/voice")
    print(f"   - POST http://{host}:{port}/gemini")
    print(f"   - POST http://{host}:{port}/murf")
    print(f"   - GET  http://{host}:{port}/voices")
    print(f"   - GET  http://{host}:{port}/audio/{{filename}}")
    print(f"   - POST http://{host}:{port}/cleanup")
    print(f"   - POST http://{host}:{port}/stop-audio")
    
    print("\nMedication Management Endpoints:")
    print(f"   - GET    http://{host}:{port}/api/medications")
    print(f"   - POST   http://{host}:{port}/api/medications")
    print(f"   - PUT    http://{host}:{port}/api/medications/{{medication_id}}")
    print(f"   - DELETE http://{host}:{port}/api/medications/{{medication_id}}")
    
    print("\nReminder Endpoints:")
    print(f"   - GET    http://{host}:{port}/api/reminders")
    print(f"   - POST   http://{host}:{port}/api/reminders")
    print(f"   - PUT    http://{host}:{port}/api/reminders/{{reminder_id}}")
    print(f"   - DELETE http://{host}:{port}/api/reminders/{{reminder_id}}")
    
    print("\nEmergency Contact Endpoints:")
    print(f"   - GET  http://{host}:{port}/api/emergency-contacts")
    print(f"   - POST http://{host}:{port}/api/emergency-contacts")
    
    print("\nHealth Data Endpoints:")
    print(f"   - POST http://{host}:{port}/api/symptom-check")
    print(f"   - GET  http://{host}:{port}/api/health-tips")
    
    uvicorn.run(
        app, 
        host=host, 
        port=port, 
        log_level="info",
        access_log=True
    )

if __name__ == "__main__":
    import argparse
    
    parser = argparse.ArgumentParser(description="Ava AI Voice Assistant API Server")
    parser.add_argument("--host", default="127.0.0.1", help="Host to bind to")
    parser.add_argument("--port", type=int, default=8000, help="Port to bind to")
    
    args = parser.parse_args()
    
    try:
        run_api_server(args.host, args.port)
    except KeyboardInterrupt:
        print("\nAPI server stopped by user")
    except Exception as e:
        print(f"Fatal error: {e}")