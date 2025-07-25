# Reminder Notification System

A comprehensive reminder notification system for the Ava AI Voice Assistant that works in both Electron app and browser environments.

## Features

- **Cross-Platform Notifications**: Works in both Electron desktop app and browser
- **Supabase Integration**: Stores and retrieves reminders from Supabase database
- **Smart Scheduling**: Supports recurring reminders with days of the week
- **Snooze Functionality**: Allows users to snooze reminders for specified minutes
- **Medication Logging**: Automatically logs medication intake when reminders are completed
- **Real-time Monitoring**: Continuously monitors for due reminders
- **Permission Management**: Handles notification permissions for both browser and Electron

## Components

### Core Services

1. **ReminderNotificationService** (`src/services/reminderNotificationService.ts`)
   - Singleton service that manages the reminder notification system
   - Monitors reminders and sends notifications
   - Handles both browser and Electron notifications

2. **useReminderNotifications Hook** (`src/hooks/useReminderNotifications.ts`)
   - React hook for easy integration with components
   - Provides start/stop monitoring, testing, and reminder actions

### UI Components

1. **ReminderSettings** (`src/components/ReminderSettings.tsx`)
   - User interface for configuring notification preferences
   - Toggle monitoring, set check intervals, manage permissions

2. **NotificationTest** (`src/components/NotificationTest.tsx`)
   - Testing and debugging component
   - Test permissions, create test reminders, send direct notifications

### Backend Integration

1. **Reminder API Endpoints** (`ava_voice_ai/main.py`)
   - `/api/reminders/due` - Get currently due reminders
   - `/api/reminders/{id}/snooze` - Snooze a reminder
   - `/api/reminders/{id}/complete` - Mark reminder as completed

2. **Supabase Service** (`src/services/supabase.ts`)
   - Database operations for reminders and medication logs
   - Direct database access for frontend

## Database Schema

The system uses the following database tables:

### Reminders Table
```sql
CREATE TABLE reminders (
    id UUID PRIMARY KEY,
    user_id UUID REFERENCES users(id),
    medication_id UUID REFERENCES medications(id),
    title TEXT NOT NULL,
    description TEXT,
    reminder_time TEXT NOT NULL,
    is_recurring BOOLEAN DEFAULT true,
    days_of_week TEXT[],
    reminder_type TEXT,
    is_active BOOLEAN DEFAULT true,
    last_triggered TIMESTAMPTZ,
    snooze_until TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

### Medication Logs Table
```sql
CREATE TABLE medication_logs (
    id UUID PRIMARY KEY,
    user_id UUID REFERENCES users(id),
    medication_id UUID REFERENCES medications(id),
    taken_at TIMESTAMPTZ,
    scheduled_time TEXT,
    status TEXT NOT NULL,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
```

## Usage

### 1. Initialize Reminder Notifications

```typescript
import { useReminderNotifications } from '../hooks/useReminderNotifications';

const {
  startMonitoring,
  stopMonitoring,
  isMonitoring,
  testNotification,
  snoozeReminder,
  markReminderCompleted
} = useReminderNotifications({
  userId: 'your-user-id',
  autoStart: true,
  showInAppNotifications: true
});
```

### 2. Create a Reminder

```typescript
import { SupabaseService } from '../services/supabase';

const reminderData = {
  title: 'Take Morning Vitamins',
  description: 'Take 2 vitamin D tablets with breakfast',
  reminder_time: '08:00',
  is_recurring: true,
  days_of_week: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
  reminder_type: 'medication',
  is_active: true
};

const newReminder = await SupabaseService.addReminder(reminderData);
```

### 3. Handle Notification Clicks

The system automatically listens for notification clicks and provides handlers:

```typescript
// Browser notification clicks trigger custom events
window.addEventListener('reminderNotificationClick', (event) => {
  const notificationData = event.detail;
  // Handle the notification click
});

// Electron notification clicks are handled through IPC
const electronAPI = window.electronAPI;
if (electronAPI && electronAPI.onNotificationClicked) {
  electronAPI.onNotificationClicked((data) => {
    // Handle Electron notification click
  });
}
```

## Configuration

### Notification Settings

Users can configure:
- **Enable/Disable**: Master toggle for all notifications
- **Check Interval**: How often to check for due reminders (30s to 30min)
- **Browser Notifications**: Toggle browser notifications
- **Desktop Notifications**: Toggle Electron native notifications
- **In-App Notifications**: Toggle in-app notification toasts
- **Auto Start**: Automatically start monitoring when app opens

### Permissions

The system requires:
- **Browser**: `Notification` permission for web notifications
- **Electron**: Native notification permission (usually granted by default)

## Development

### Testing

Use the `NotificationTest` component to:
1. Test notification permissions
2. Create test reminders
3. Send direct notifications
4. Monitor system status

### Debugging

Enable logging to see reminder monitoring activity:
```typescript
// Check monitoring status
console.log('Monitoring active:', isMonitoring);

// Service-level debugging
const service = ReminderNotificationService.getInstance();
service.testNotification(); // Send test notification
```

### Backend Development

The Python backend provides REST endpoints for reminder management:
```bash
# Get due reminders
GET /api/reminders/due

# Snooze reminder
POST /api/reminders/{id}/snooze?minutes=5

# Complete reminder
POST /api/reminders/{id}/complete
```

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Frontend (React)                        │
├─────────────────────────────────────────────────────────────┤
│  ReminderSettings  │  NotificationTest  │  useReminderHook │
├─────────────────────────────────────────────────────────────┤
│            ReminderNotificationService                     │
├─────────────────────────────────────────────────────────────┤
│   Browser Notifications    │    Electron Notifications     │
├─────────────────────────────────────────────────────────────┤
│              Supabase Service (Database)                   │
├─────────────────────────────────────────────────────────────┤
│                Python Backend (FastAPI)                    │
├─────────────────────────────────────────────────────────────┤
│                  Supabase Database                         │
└─────────────────────────────────────────────────────────────┘
```

## Troubleshooting

### Common Issues

1. **Notifications not appearing**
   - Check permissions in browser/OS settings
   - Verify monitoring is active
   - Test with direct notifications

2. **Reminders not triggering**
   - Check if reminder time matches current time
   - Verify days_of_week includes current day
   - Ensure reminder is active and not snoozed

3. **Database connection issues**
   - Verify Supabase credentials
   - Check network connectivity
   - Review console logs for errors

### Support

For additional support or issues:
1. Check the browser console for error messages
2. Use the NotificationTest component for debugging
3. Verify database connectivity through Supabase dashboard
4. Review network requests in browser dev tools
