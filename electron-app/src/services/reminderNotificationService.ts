/**
 * Reminder Notification Service
 * Handles both browser notifications and Electron native notifications
 * Integrates with Supabase to fetch reminders based on frequency and time
 */

import { SupabaseService } from './supabase';
import { ReminderResponse } from '../types';

export interface NotificationData {
  id: string;
  title: string;
  body: string;
  icon?: string;
  badge?: string;
  timestamp: number;
  reminderId: string;
  medicationId?: string;
  priority: 'low' | 'normal' | 'high' | 'urgent';
  actions?: Array<{
    action: string;
    title: string;
  }>;
}

export class ReminderNotificationService {
  private static instance: ReminderNotificationService;
  private intervalId: number | null = null;
  private isElectron: boolean;
  private userId: string = '00000000-0000-0000-0000-000000000001'; // Default user ID
  private checkInterval: number = 30000; // Check every 30 seconds for better responsiveness
  private notificationPermission: NotificationPermission = 'default';

  private constructor() {
    this.isElectron = !!(window as any).electronAPI;
    this.initializeNotifications();
  }

  public static getInstance(): ReminderNotificationService {
    if (!ReminderNotificationService.instance) {
      ReminderNotificationService.instance = new ReminderNotificationService();
    }
    return ReminderNotificationService.instance;
  }

  /**
   * Initialize notification permissions and start monitoring
   */
  private async initializeNotifications(): Promise<void> {
    try {
      // Request browser notification permission
      if ('Notification' in window && Notification.permission !== 'granted') {
        const permission = await Notification.requestPermission();
        this.notificationPermission = permission;
        console.log('Browser notification permission:', permission);
      } else {
        this.notificationPermission = Notification.permission;
      }

      // Initialize Electron notifications if available
      if (this.isElectron) {
        try {
          const electronAPI = (window as any).electronAPI;
          if (electronAPI && electronAPI.requestNotificationPermission) {
            await electronAPI.requestNotificationPermission();
            console.log('Electron notification permission granted');
          }
        } catch (error) {
          console.warn('Failed to request Electron notification permission:', error);
        }
      }
    } catch (error) {
      console.error('Failed to initialize notifications:', error);
    }
  }

  /**
   * Start monitoring reminders
   */
  public startMonitoring(): void {
    if (this.intervalId) {
      this.stopMonitoring();
    }

    console.log('Starting reminder monitoring...');
    this.checkReminders(); // Initial check
    this.intervalId = window.setInterval(() => {
      this.checkReminders();
    }, this.checkInterval);
  }

  /**
   * Stop monitoring reminders
   */
  public stopMonitoring(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
      console.log('Stopped reminder monitoring');
    }
  }

  /**
   * Check for due reminders
   */
  private async checkReminders(): Promise<void> {
    try {
      const now = new Date();
      const currentTime = this.formatTime(now);
      const currentDay = this.getDayOfWeek(now);

      console.log(`[ReminderService] Checking reminders for time: ${currentTime}, day: ${currentDay}`);

      // Get active reminders from Supabase
      const reminders = await SupabaseService.getReminders(this.userId);
      
      console.log(`[ReminderService] Total reminders found: ${reminders.length}`);
      console.log(`[ReminderService] All reminders:`, reminders.map(r => ({
        id: r.id,
        title: r.title,
        time: r.reminder_time,
        active: r.is_active,
        recurring: r.is_recurring,
        days: r.days_of_week,
        type: r.reminder_type,
        medicationId: r.medication_id,
        lastTriggered: r.last_triggered,
        snoozeUntil: r.snooze_until
      })));
      
      // Filter reminders that are due now
      const dueReminders = reminders.filter(reminder => {
        const isDue = this.isReminderDue(reminder, currentTime, currentDay);
        console.log(`[ReminderService] Reminder "${reminder.title}" due check:`, {
          isDue,
          reminderTime: reminder.reminder_time,
          currentTime,
          isActive: reminder.is_active,
          isRecurring: reminder.is_recurring,
          daysOfWeek: reminder.days_of_week,
          currentDay,
          lastTriggered: reminder.last_triggered,
          snoozeUntil: reminder.snooze_until
        });
        return isDue;
      });

      console.log(`[ReminderService] Found ${dueReminders.length} due reminders`);

      // Send notifications for due reminders
      for (const reminder of dueReminders) {
        console.log(`[ReminderService] Sending notification for reminder: ${reminder.title}`);
        await this.sendReminderNotification(reminder);
        
        // Update last_triggered timestamp
        await this.updateLastTriggered(reminder.id);
      }
    } catch (error) {
      console.error('[ReminderService] Error checking reminders:', error);
    }
  }

  /**
   * Check if a reminder is due based on time and frequency
   */
  private isReminderDue(reminder: any, currentTime: string, currentDay: string): boolean {
    console.log(`[ReminderService] Checking if reminder "${reminder.title}" is due:`, {
      reminderTime: reminder.reminder_time,
      currentTime,
      timesMatch: reminder.reminder_time === currentTime,
      isActive: reminder.is_active,
      isRecurring: reminder.is_recurring,
      daysOfWeek: reminder.days_of_week,
      currentDay,
      dayInArray: reminder.days_of_week?.includes(currentDay),
      lastTriggered: reminder.last_triggered,
      snoozeUntil: reminder.snooze_until
    });

    if (!reminder.is_active) {
      console.log(`[ReminderService] Reminder "${reminder.title}" is not active`);
      return false;
    }

    // Check if reminder is snoozed
    if (reminder.snooze_until) {
      const snoozeTime = new Date(reminder.snooze_until);
      if (snoozeTime > new Date()) {
        console.log(`[ReminderService] Reminder "${reminder.title}" is snoozed until ${snoozeTime}`);
        return false;
      }
    }

    // More flexible time matching - check if current time is within 1 minute of reminder time
    const reminderMinutes = this.timeToMinutes(reminder.reminder_time);
    const currentMinutes = this.timeToMinutes(currentTime);
    const timeDiff = Math.abs(currentMinutes - reminderMinutes);
    
    console.log(`[ReminderService] Time comparison for "${reminder.title}":`, {
      reminderTime: reminder.reminder_time,
      reminderMinutes,
      currentTime,
      currentMinutes,
      timeDiff,
      isWithinRange: timeDiff <= 1
    });

    if (timeDiff > 1) { // Allow 1 minute tolerance
      console.log(`[ReminderService] Time mismatch for "${reminder.title}": difference is ${timeDiff} minutes`);
      return false;
    }

    // For recurring reminders, check days of week
    if (reminder.is_recurring && reminder.days_of_week && reminder.days_of_week.length > 0) {
      if (!reminder.days_of_week.includes(currentDay)) {
        console.log(`[ReminderService] Day mismatch for "${reminder.title}": ${currentDay} not in [${reminder.days_of_week.join(', ')}]`);
        return false;
      }
    }

    // Check if already triggered today (prevent duplicate notifications)
    if (reminder.last_triggered) {
      const lastTriggered = new Date(reminder.last_triggered);
      const today = new Date();
      if (this.isSameDay(lastTriggered, today)) {
        console.log(`[ReminderService] Reminder "${reminder.title}" already triggered today: ${lastTriggered}`);
        return false;
      }
    }

    console.log(`[ReminderService] Reminder "${reminder.title}" is DUE!`);
    return true;
  }

  /**
   * Convert time string (HH:MM) to minutes since midnight
   */
  private timeToMinutes(timeStr: string): number {
    const [hours, minutes] = timeStr.split(':').map(Number);
    return hours * 60 + minutes;
  }

  /**
   * Send notification for a reminder
   */
  private async sendReminderNotification(reminder: any): Promise<void> {
    try {
      // Get medication details if this is a medication reminder
      let medicationInfo = '';
      if (reminder.medication_id) {
        try {
          const medications = await SupabaseService.getMedications(this.userId);
          const medication = medications.find(med => med.id === reminder.medication_id);
          if (medication) {
            medicationInfo = ` - ${medication.dosage} of ${medication.name}`;
          }
        } catch (error) {
          console.warn('Failed to get medication info:', error);
        }
      }

      const notificationData: NotificationData = {
        id: `reminder_${reminder.id}_${Date.now()}`,
        title: `Reminder: ${reminder.title}`,
        body: reminder.description 
          ? `${reminder.description}${medicationInfo}`
          : `Time for your reminder${medicationInfo}`,
        icon: '/ava-logo.svg',
        badge: '/ava-logo.svg',
        timestamp: Date.now(),
        reminderId: reminder.id,
        medicationId: reminder.medication_id,
        priority: reminder.reminder_type === 'medication' ? 'high' : 'normal',
        actions: [
          { action: 'taken', title: '✓ Done' },
          { action: 'snooze', title: '⏰ Snooze 5min' }
        ]
      };

      // Send both browser and Electron notifications
      await Promise.all([
        this.sendBrowserNotification(notificationData),
        this.sendElectronNotification(notificationData)
      ]);

      console.log('Reminder notification sent:', notificationData.title);
    } catch (error) {
      console.error('Failed to send reminder notification:', error);
    }
  }

  /**
   * Send browser notification
   */
  private async sendBrowserNotification(data: NotificationData): Promise<void> {
    if (!('Notification' in window) || this.notificationPermission !== 'granted') {
      console.warn('Browser notifications not available or not permitted');
      return;
    }

    try {
      const notification = new Notification(data.title, {
        body: data.body,
        icon: data.icon,
        badge: data.badge,
        requireInteraction: data.priority === 'high' || data.priority === 'urgent',
        silent: false,
        tag: `reminder_${data.reminderId}`,
        data: {
          reminderId: data.reminderId,
          medicationId: data.medicationId,
          timestamp: data.timestamp
        }
      });

      // Handle notification clicks
      notification.onclick = () => {
        this.handleNotificationClick(data);
        notification.close();
      };

      // Auto-close after 10 seconds for normal priority
      if (data.priority === 'normal' || data.priority === 'low') {
        setTimeout(() => {
          notification.close();
        }, 10000);
      }

      console.log('Browser notification created:', data.title);
    } catch (error) {
      console.error('Failed to create browser notification:', error);
    }
  }

  /**
   * Send Electron notification
   */
  private async sendElectronNotification(data: NotificationData): Promise<void> {
    if (!this.isElectron) {
      return;
    }

    try {
      const electronAPI = (window as any).electronAPI;
      if (electronAPI && electronAPI.showNotification) {
        await electronAPI.showNotification({
          title: data.title,
          body: data.body,
          icon: data.icon,
          urgent: data.priority === 'urgent',
          actions: data.actions,
          closeButtonText: 'Close',
          timeoutType: data.priority === 'high' || data.priority === 'urgent' ? 'never' : 'default'
        });

        console.log('Electron notification sent:', data.title);
      }
    } catch (error) {
      console.error('Failed to send Electron notification:', error);
    }
  }

  /**
   * Handle notification click
   */
  private handleNotificationClick(data: NotificationData): void {
    console.log('Notification clicked:', data);
    
    // Focus the app window if it's an Electron app
    if (this.isElectron) {
      const electronAPI = (window as any).electronAPI;
      if (electronAPI && electronAPI.focusWindow) {
        electronAPI.focusWindow();
      }
    } else {
      // Focus browser window
      window.focus();
    }

    // Emit custom event for the app to handle
    window.dispatchEvent(new CustomEvent('reminderNotificationClick', {
      detail: data
    }));
  }

  /**
   * Snooze a reminder for specified minutes
   */
  public async snoozeReminder(reminderId: string, minutes: number = 5): Promise<void> {
    try {
      const snoozeUntil = new Date(Date.now() + minutes * 60 * 1000);
      await SupabaseService.updateReminder(reminderId, {
        snooze_until: snoozeUntil.toISOString()
      });
      console.log(`Reminder ${reminderId} snoozed for ${minutes} minutes`);
    } catch (error) {
      console.error('Failed to snooze reminder:', error);
    }
  }

  /**
   * Mark reminder as completed (for today)
   */
  public async markReminderCompleted(reminderId: string, medicationId?: string): Promise<void> {
    try {
      const now = new Date();
      
      // Update reminder last_triggered
      await SupabaseService.updateReminder(reminderId, {
        last_triggered: now.toISOString()
      });

      // If it's a medication reminder, log it
      if (medicationId) {
        // Create medication log entry
        const logData = {
          medication_id: medicationId,
          taken_at: now.toISOString(),
          scheduled_time: this.formatTime(now),
          status: 'taken'
        };

        await SupabaseService.addMedicationLog(logData, this.userId);
      }

      console.log(`Reminder ${reminderId} marked as completed`);
    } catch (error) {
      console.error('Failed to mark reminder as completed:', error);
    }
  }

  /**
   * Update last triggered timestamp
   */
  private async updateLastTriggered(reminderId: string): Promise<void> {
    try {
      await SupabaseService.updateReminder(reminderId, {
        last_triggered: new Date().toISOString()
      });
    } catch (error) {
      console.error('Failed to update last triggered:', error);
    }
  }

  /**
   * Format time as HH:MM
   */
  private formatTime(date: Date): string {
    return date.toTimeString().slice(0, 5);
  }

  /**
   * Get day of week name
   */
  private getDayOfWeek(date: Date): string {
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    return days[date.getDay()];
  }

  /**
   * Check if two dates are the same day
   */
  private isSameDay(date1: Date, date2: Date): boolean {
    return date1.getFullYear() === date2.getFullYear() &&
           date1.getMonth() === date2.getMonth() &&
           date1.getDate() === date2.getDate();
  }

  /**
   * Set user ID for filtering reminders
   */
  public setUserId(userId: string): void {
    this.userId = userId;
  }

  /**
   * Set check interval (in milliseconds)
   */
  public setCheckInterval(interval: number): void {
    this.checkInterval = interval;
    if (this.intervalId) {
      this.stopMonitoring();
      this.startMonitoring();
    }
  }

  /**
   * Test notification system
   */
  public async testNotification(): Promise<void> {
    const testData: NotificationData = {
      id: `test_${Date.now()}`,
      title: 'Test Reminder',
      body: 'This is a test notification from Ava AI Assistant',
      icon: '/ava-logo.svg',
      timestamp: Date.now(),
      reminderId: 'test',
      priority: 'normal'
    };

    await Promise.all([
      this.sendBrowserNotification(testData),
      this.sendElectronNotification(testData)
    ]);
  }

  /**
   * Debug method to check current reminders and state
   */
  public async debugReminderState(): Promise<any> {
    try {
      const now = new Date();
      const currentTime = this.formatTime(now);
      const currentDay = this.getDayOfWeek(now);

      console.log(`[ReminderDebug] Current time: ${currentTime}, day: ${currentDay}`);
      console.log(`[ReminderDebug] User ID: ${this.userId}`);
      console.log(`[ReminderDebug] Check interval: ${this.checkInterval}ms`);
      console.log(`[ReminderDebug] Is monitoring: ${!!this.intervalId}`);

      // Get all reminders
      const reminders = await SupabaseService.getReminders(this.userId);
      console.log(`[ReminderDebug] Total reminders: ${reminders.length}`);

      // Get all medications
      const medications = await SupabaseService.getMedications(this.userId);
      console.log(`[ReminderDebug] Total medications: ${medications.length}`);

      const debugInfo = {
        currentTime,
        currentDay,
        userId: this.userId,
        isMonitoring: !!this.intervalId,
        checkInterval: this.checkInterval,
        reminders: reminders.map(r => ({
          id: r.id,
          title: r.title,
          description: r.description,
          time: r.reminder_time,
          type: r.reminder_type,
          isActive: r.is_active,
          isRecurring: r.is_recurring,
          daysOfWeek: r.days_of_week,
          medicationId: r.medication_id,
          lastTriggered: r.last_triggered,
          snoozeUntil: r.snooze_until,
          isDue: this.isReminderDue(r, currentTime, currentDay)
        })),
        medications: medications.map(m => ({
          id: m.id,
          name: m.name,
          dosage: m.dosage,
          frequency: m.frequency,
          medicationTime: m.medication_time || m.time, // Handle both field names
          time: m.time || m.medication_time, // Ensure we have the time field
          isActive: m.is_active
        }))
      };

      console.log(`[ReminderDebug] Debug info:`, debugInfo);
      return debugInfo;
    } catch (error) {
      console.error('[ReminderDebug] Error getting debug info:', error);
      throw error;
    }
  }

  /**
   * Force check reminders immediately (for debugging)
   */
  public async forceCheckReminders(): Promise<void> {
    console.log('[ReminderService] Force checking reminders...');
    await this.checkReminders();
  }

  /**
   * Create a test medication reminder that should trigger soon
   */
  public async createTestMedicationReminder(): Promise<any> {
    try {
      // Create test medication first with a time 2 minutes from now
      const futureTime = new Date(Date.now() + 2 * 60 * 1000);
      const testTime = this.formatTime(futureTime);
      
      const testMedication = {
        name: 'Test Vitamin D',
        dosage: '1000 IU',
        frequency: 'daily',
        time: testTime, // Use 'time' field for frontend
        notes: 'Test medication for notification debugging',
        is_active: true,
        medication_type: 'vitamin'
      };

      const medication = await SupabaseService.addMedication(testMedication);
      console.log('[ReminderDebug] Created test medication:', medication);

      // The reminder should be automatically created by the addMedication function
      // Let's verify it was created
      const reminders = await SupabaseService.getReminders(this.userId);
      const medicationReminder = reminders.find(r => r.medication_id === medication.id);
      
      if (medicationReminder) {
        console.log('[ReminderDebug] Found automatic reminder:', medicationReminder);
        return { medication, reminder: medicationReminder };
      } else {
        console.log('[ReminderDebug] No automatic reminder found, creating manually...');
        
        // Create test reminder manually if auto-creation failed
        const testReminder = {
          medication_id: medication.id,
          title: `${medication.name} Reminder`,
          description: `Take your ${medication.dosage} of ${medication.name}`,
          reminder_time: testTime,
          is_recurring: true,
          days_of_week: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'],
          reminder_type: 'medication',
          is_active: true
        };

        const reminder = await SupabaseService.addReminder(testReminder);
        console.log('[ReminderDebug] Created manual reminder:', reminder);
        return { medication, reminder };
      }
    } catch (error) {
      console.error('[ReminderDebug] Error creating test medication reminder:', error);
      throw error;
    }
  }
}

export default ReminderNotificationService;
