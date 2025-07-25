/**
 * React Hook for Reminder Notifications
 * Provides easy integration with the reminder notification service
 */

import { useEffect, useCallback, useRef } from 'react';
import { ReminderNotificationService, NotificationData } from '../services/reminderNotificationService';
import { useNotification } from '../components/NotificationProvider';

export interface UseReminderNotificationsOptions {
  userId?: string;
  checkInterval?: number;
  showInAppNotifications?: boolean;
}

export interface UseReminderNotificationsReturn {
  startMonitoring: () => void;
  stopMonitoring: () => void;
  isMonitoring: boolean;
  testNotification: () => Promise<void>;
  snoozeReminder: (reminderId: string, minutes?: number) => Promise<void>;
  markReminderCompleted: (reminderId: string, medicationId?: string) => Promise<void>;
  debugReminderState: () => Promise<any>;
  createTestMedicationReminder: () => Promise<any>;
  forceCheckReminders: () => Promise<void>;
}

export const useReminderNotifications = (
  options: UseReminderNotificationsOptions = {}
): UseReminderNotificationsReturn => {
  const {
    userId = '00000000-0000-0000-0000-000000000001',
    checkInterval = 60000, // 1 minute
    showInAppNotifications = true
  } = options;

  const { addNotification } = useNotification();
  const serviceRef = useRef<ReminderNotificationService | null>(null);
  const isMonitoringRef = useRef<boolean>(false);

  // Initialize service
  useEffect(() => {
    serviceRef.current = ReminderNotificationService.getInstance();
    serviceRef.current.setUserId(userId);
    serviceRef.current.setCheckInterval(checkInterval);

    return () => {
      if (serviceRef.current) {
        serviceRef.current.stopMonitoring();
      }
    };
  }, [userId, checkInterval]);

  // Handle notification clicks
  useEffect(() => {
    const handleNotificationClick = (event: CustomEvent<NotificationData>) => {
      const data = event.detail;
      
      if (showInAppNotifications) {
        addNotification({
          type: 'info',
          title: 'Reminder Action Required',
          message: `${data.title} - Please mark as done or snooze.`,
          duration: 10000
        });
      }

      console.log('Reminder notification clicked:', data);
    };

    window.addEventListener('reminderNotificationClick', handleNotificationClick as EventListener);
    
    return () => {
      window.removeEventListener('reminderNotificationClick', handleNotificationClick as EventListener);
    };
  }, [addNotification, showInAppNotifications]);

  // Handle Electron notification events
  useEffect(() => {
    const electronAPI = (window as any).electronAPI;
    if (!electronAPI) return;

    let removeClickListener: (() => void) | null = null;
    let removeActionListener: (() => void) | null = null;

    try {
      // Handle notification clicks
      if (electronAPI.onNotificationClicked) {
        removeClickListener = electronAPI.onNotificationClicked((data: any) => {
          console.log('Electron notification clicked:', data);
          if (showInAppNotifications) {
            addNotification({
              type: 'info',
              title: 'Reminder Clicked',
              message: data.title || 'A reminder notification was clicked',
              duration: 5000
            });
          }
        });
      }

      // Handle notification actions
      if (electronAPI.onNotificationAction) {
        removeActionListener = electronAPI.onNotificationAction(async (data: any) => {
          console.log('Electron notification action:', data);
          
          if (data.action) {
            switch (data.action.action) {
              case 'taken':
                if (data.options && data.options.reminderId) {
                  await markReminderCompleted(data.options.reminderId, data.options.medicationId);
                  if (showInAppNotifications) {
                    addNotification({
                      type: 'success',
                      title: 'Reminder Completed',
                      message: 'Reminder marked as done successfully',
                      duration: 3000
                    });
                  }
                }
                break;
              case 'snooze':
                if (data.options && data.options.reminderId) {
                  await snoozeReminder(data.options.reminderId, 5);
                  if (showInAppNotifications) {
                    addNotification({
                      type: 'info',
                      title: 'Reminder Snoozed',
                      message: 'Reminder snoozed for 5 minutes',
                      duration: 3000
                    });
                  }
                }
                break;
            }
          }
        });
      }
    } catch (error) {
      console.warn('Error setting up Electron notification listeners:', error);
    }

    return () => {
      if (removeClickListener) removeClickListener();
      if (removeActionListener) removeActionListener();
    };
  }, [addNotification, showInAppNotifications]);

  // Auto-start monitoring (always enabled)
  useEffect(() => {
    if (serviceRef.current) {
      serviceRef.current.startMonitoring();
      isMonitoringRef.current = true;
    }
  }, []);

  const startMonitoring = useCallback(() => {
    // Monitoring is always active, this is kept for compatibility
    console.log('Monitoring is always active');
  }, []);

  const stopMonitoring = useCallback(() => {
    // Monitoring cannot be stopped, this is kept for compatibility
    console.log('Monitoring cannot be disabled');
  }, []);

  const testNotification = useCallback(async () => {
    if (serviceRef.current) {
      try {
        await serviceRef.current.testNotification();
        
        if (showInAppNotifications) {
          addNotification({
            type: 'success',
            title: 'Test Notification Sent',
            message: 'If you can see this, notifications are working correctly!',
            duration: 5000
          });
        }
      } catch (error) {
        console.error('Failed to send test notification:', error);
        
        if (showInAppNotifications) {
          addNotification({
            type: 'error',
            title: 'Test Notification Failed',
            message: 'Could not send test notification. Check your notification permissions.',
            duration: 5000
          });
        }
      }
    }
  }, [addNotification, showInAppNotifications]);

  const snoozeReminder = useCallback(async (reminderId: string, minutes: number = 5) => {
    if (serviceRef.current) {
      try {
        await serviceRef.current.snoozeReminder(reminderId, minutes);
        console.log(`Reminder ${reminderId} snoozed for ${minutes} minutes`);
      } catch (error) {
        console.error('Failed to snooze reminder:', error);
        throw error;
      }
    }
  }, []);

  const markReminderCompleted = useCallback(async (reminderId: string, medicationId?: string) => {
    if (serviceRef.current) {
      try {
        await serviceRef.current.markReminderCompleted(reminderId, medicationId);
        console.log(`Reminder ${reminderId} marked as completed`);
      } catch (error) {
        console.error('Failed to mark reminder as completed:', error);
        throw error;
      }
    }
  }, []);

  const debugReminderState = useCallback(async () => {
    if (serviceRef.current) {
      try {
        return await serviceRef.current.debugReminderState();
      } catch (error) {
        console.error('Failed to get debug reminder state:', error);
        throw error;
      }
    }
    return null;
  }, []);

  const createTestMedicationReminder = useCallback(async () => {
    if (serviceRef.current) {
      try {
        return await serviceRef.current.createTestMedicationReminder();
      } catch (error) {
        console.error('Failed to create test medication reminder:', error);
        throw error;
      }
    }
    return null;
  }, []);

  const forceCheckReminders = useCallback(async () => {
    if (serviceRef.current) {
      try {
        return await serviceRef.current.forceCheckReminders();
      } catch (error) {
        console.error('Failed to force check reminders:', error);
        throw error;
      }
    }
  }, []);

  return {
    startMonitoring,
    stopMonitoring,
    isMonitoring: true, // Always monitoring
    testNotification,
    snoozeReminder,
    markReminderCompleted,
    debugReminderState,
    createTestMedicationReminder,
    forceCheckReminders
  };
};

export default useReminderNotifications;
