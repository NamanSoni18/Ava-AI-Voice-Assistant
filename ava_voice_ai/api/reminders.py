"""
Reminder notification endpoints for Ava AI Voice Assistant
"""
import asyncio
from datetime import datetime, timedelta
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from ..database.service import DatabaseService
from ..database.models import Reminder, ReminderCreate, ReminderUpdate
import logging

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/reminders", tags=["reminders"])

# Global reminder monitoring state
reminder_monitor_running = False
reminder_monitor_task = None

@router.get("/", response_model=List[Reminder])
async def get_reminders(
    user_id: str = "00000000-0000-0000-0000-000000000001",
    active_only: bool = True,
    db: DatabaseService = Depends(DatabaseService)
):
    """Get user reminders"""
    try:
        reminders = await db.get_reminders(user_id, active_only)
        return reminders
    except Exception as e:
        logger.error(f"Error getting reminders: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/", response_model=Reminder)
async def create_reminder(
    reminder: ReminderCreate,
    db: DatabaseService = Depends(DatabaseService)
):
    """Create a new reminder"""
    try:
        new_reminder = await db.add_reminder(reminder)
        return new_reminder
    except Exception as e:
        logger.error(f"Error creating reminder: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.put("/{reminder_id}", response_model=Reminder)
async def update_reminder(
    reminder_id: str,
    reminder_update: ReminderUpdate,
    db: DatabaseService = Depends(DatabaseService)
):
    """Update a reminder"""
    try:
        updated_reminder = await db.update_reminder(reminder_id, reminder_update)
        if not updated_reminder:
            raise HTTPException(status_code=404, detail="Reminder not found")
        return updated_reminder
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error updating reminder: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.delete("/{reminder_id}")
async def delete_reminder(
    reminder_id: str,
    db: DatabaseService = Depends(DatabaseService)
):
    """Delete a reminder"""
    try:
        success = await db.delete_reminder(reminder_id)
        if not success:
            raise HTTPException(status_code=404, detail="Reminder not found")
        return {"message": "Reminder deleted successfully"}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error deleting reminder: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/due", response_model=List[Reminder])
async def get_due_reminders(
    user_id: str = "00000000-0000-0000-0000-000000000001",
    db: DatabaseService = Depends(DatabaseService)
):
    """Get reminders that are currently due"""
    try:
        now = datetime.now()
        current_time = now.strftime("%H:%M")
        current_day = now.strftime("%A")
        
        # Get all active reminders
        all_reminders = await db.get_reminders(user_id, active_only=True)
        
        due_reminders = []
        for reminder in all_reminders:
            if is_reminder_due(reminder, current_time, current_day):
                due_reminders.append(reminder)
        
        return due_reminders
    except Exception as e:
        logger.error(f"Error getting due reminders: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/{reminder_id}/snooze")
async def snooze_reminder(
    reminder_id: str,
    minutes: int = 5,
    db: DatabaseService = Depends(DatabaseService)
):
    """Snooze a reminder for specified minutes"""
    try:
        snooze_until = datetime.now() + timedelta(minutes=minutes)
        
        reminder_update = ReminderUpdate(
            snooze_until=snooze_until
        )
        
        updated_reminder = await db.update_reminder(reminder_id, reminder_update)
        if not updated_reminder:
            raise HTTPException(status_code=404, detail="Reminder not found")
        
        return {
            "message": f"Reminder snoozed for {minutes} minutes",
            "snooze_until": snooze_until.isoformat()
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error snoozing reminder: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/{reminder_id}/complete")
async def complete_reminder(
    reminder_id: str,
    medication_id: Optional[str] = None,
    db: DatabaseService = Depends(DatabaseService)
):
    """Mark a reminder as completed for today"""
    try:
        now = datetime.now()
        
        # Update reminder last_triggered
        reminder_update = ReminderUpdate(
            last_triggered=now
        )
        
        updated_reminder = await db.update_reminder(reminder_id, reminder_update)
        if not updated_reminder:
            raise HTTPException(status_code=404, detail="Reminder not found")
        
        # If it's a medication reminder, log it
        if medication_id:
            try:
                from ..database.models import MedicationLogCreate
                
                log_data = MedicationLogCreate(
                    user_id=updated_reminder.user_id,
                    medication_id=medication_id,
                    taken_at=now,
                    scheduled_time=now.strftime("%H:%M"),
                    status="taken"
                )
                
                await db.add_medication_log(log_data)
                logger.info(f"Medication log created for reminder {reminder_id}")
            except Exception as log_error:
                logger.warning(f"Failed to create medication log: {log_error}")
        
        return {
            "message": "Reminder marked as completed",
            "completed_at": now.isoformat()
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error completing reminder: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/monitor/start")
async def start_reminder_monitoring(
    background_tasks: BackgroundTasks,
    user_id: str = "00000000-0000-0000-0000-000000000001",
    check_interval: int = 60  # seconds
):
    """Start background reminder monitoring"""
    global reminder_monitor_running, reminder_monitor_task
    
    if reminder_monitor_running:
        return {"message": "Reminder monitoring is already running"}
    
    reminder_monitor_running = True
    
    async def monitor_reminders():
        """Background task to monitor reminders"""
        db = DatabaseService()
        
        while reminder_monitor_running:
            try:
                now = datetime.now()
                current_time = now.strftime("%H:%M")
                current_day = now.strftime("%A")
                
                logger.info(f"Checking reminders at {current_time} on {current_day}")
                
                # Get all active reminders
                reminders = await db.get_reminders(user_id, active_only=True)
                
                # Check for due reminders
                due_reminders = []
                for reminder in reminders:
                    if is_reminder_due(reminder, current_time, current_day):
                        due_reminders.append(reminder)
                
                if due_reminders:
                    logger.info(f"Found {len(due_reminders)} due reminders")
                    # Here you could send push notifications, emails, etc.
                    # For now, we'll just log them
                    for reminder in due_reminders:
                        logger.info(f"Due reminder: {reminder.title} at {reminder.reminder_time}")
                        
                        # Update last_triggered to prevent duplicate notifications
                        reminder_update = ReminderUpdate(last_triggered=now)
                        await db.update_reminder(reminder.id, reminder_update)
                
                # Wait for next check
                await asyncio.sleep(check_interval)
                
            except Exception as e:
                logger.error(f"Error in reminder monitoring: {e}")
                await asyncio.sleep(check_interval)
    
    # Start the monitoring task
    reminder_monitor_task = asyncio.create_task(monitor_reminders())
    background_tasks.add_task(lambda: reminder_monitor_task)
    
    return {
        "message": "Reminder monitoring started",
        "check_interval": check_interval,
        "user_id": user_id
    }

@router.post("/monitor/stop")
async def stop_reminder_monitoring():
    """Stop background reminder monitoring"""
    global reminder_monitor_running, reminder_monitor_task
    
    if not reminder_monitor_running:
        return {"message": "Reminder monitoring is not running"}
    
    reminder_monitor_running = False
    
    if reminder_monitor_task:
        reminder_monitor_task.cancel()
        reminder_monitor_task = None
    
    return {"message": "Reminder monitoring stopped"}

@router.get("/monitor/status")
async def get_monitoring_status():
    """Get reminder monitoring status"""
    return {
        "running": reminder_monitor_running,
        "task_active": reminder_monitor_task is not None and not reminder_monitor_task.done()
    }

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
    reminder_hour, reminder_minute = map(int, reminder.reminder_time.split(':'))
    current_hour, current_minute = map(int, current_time.split(':'))
    
    # Allow 1-minute tolerance
    time_diff = abs((current_hour * 60 + current_minute) - (reminder_hour * 60 + reminder_minute))
    if time_diff > 1:
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
