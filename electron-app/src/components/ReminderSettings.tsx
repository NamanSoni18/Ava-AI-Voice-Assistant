  /**
 * Reminder Settings Component
 * Allows users to configure reminder notification preferences
 */

import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { 
  Bell, 
  BellOff, 
  Clock, 
  TestTube, 
  Settings, 
  Smartphone,
  Monitor,
  CheckCircle,
  AlertCircle
} from 'lucide-react';
import { useReminderNotifications } from '../hooks/useReminderNotifications';
import { useNotification } from './NotificationProvider';

interface ReminderSettingsProps {
  userId?: string;
  className?: string;
}

interface NotificationSettings {
  enabled: boolean;
  checkInterval: number;
  soundEnabled: boolean;
  browserNotifications: boolean;
  electronNotifications: boolean;
  autoStart: boolean;
  showInAppNotifications: boolean;
}

const ReminderSettings: React.FC<ReminderSettingsProps> = ({ 
  userId = '00000000-0000-0000-0000-000000000001',
  className = ''
}) => {
  const { addNotification } = useNotification();
  const [settings, setSettings] = useState<NotificationSettings>({
    enabled: true,
    checkInterval: 60000, // 1 minute
    soundEnabled: true,
    browserNotifications: true,
    electronNotifications: true,
    autoStart: true,
    showInAppNotifications: true
  });

  const [isElectron, setIsElectron] = useState(false);
  const [browserPermission, setBrowserPermission] = useState<NotificationPermission>('default');
  const [electronPermission, setElectronPermission] = useState<boolean>(false);

  const {
    testNotification
  } = useReminderNotifications({
    userId,
    checkInterval: settings.checkInterval,
    showInAppNotifications: settings.showInAppNotifications
  });

  // Check if running in Electron
  useEffect(() => {
    const electronAPI = (window as any).electronAPI;
    setIsElectron(!!electronAPI);
  }, []);

  // Check browser notification permission
  useEffect(() => {
    if ('Notification' in window) {
      setBrowserPermission(Notification.permission);
    }
  }, []);

  // Check Electron notification permission
  useEffect(() => {
    const checkElectronPermission = async () => {
      if (isElectron) {
        try {
          const electronAPI = (window as any).electronAPI;
          if (electronAPI && electronAPI.requestNotificationPermission) {
            const result = await electronAPI.requestNotificationPermission();
            setElectronPermission(result.success && result.permission === 'granted');
          }
        } catch (error) {
          console.warn('Failed to check Electron notification permission:', error);
        }
      }
    };

    checkElectronPermission();
  }, [isElectron]);

  // Load settings from localStorage
  useEffect(() => {
    try {
      const savedSettings = localStorage.getItem('ava_reminder_settings');
      if (savedSettings) {
        const parsed = JSON.parse(savedSettings);
        setSettings(prev => ({ ...prev, ...parsed }));
      }
    } catch (error) {
      console.warn('Failed to load reminder settings:', error);
    }
  }, []);

  // Save settings to localStorage
  useEffect(() => {
    try {
      localStorage.setItem('ava_reminder_settings', JSON.stringify(settings));
    } catch (error) {
      console.warn('Failed to save reminder settings:', error);
    }
  }, [settings]);

  const updateSetting = (key: keyof NotificationSettings, value: any) => {
    setSettings(prev => ({ ...prev, [key]: value }));
  };

  const requestBrowserPermission = async () => {
    if ('Notification' in window) {
      try {
        const permission = await Notification.requestPermission();
        setBrowserPermission(permission);
        
        if (permission === 'granted') {
          addNotification({
            type: 'success',
            title: 'Browser Notifications Enabled',
            message: 'You will now receive browser notifications for reminders',
            duration: 3000
          });
        } else {
          addNotification({
            type: 'warning',
            title: 'Browser Notifications Denied',
            message: 'Please enable notifications in your browser settings',
            duration: 5000
          });
        }
      } catch (error) {
        console.error('Failed to request browser notification permission:', error);
        addNotification({
          type: 'error',
          title: 'Permission Request Failed',
          message: 'Could not request browser notification permission',
          duration: 5000
        });
      }
    }
  };

  const handleTestNotification = async () => {
    try {
      await testNotification();
    } catch (error) {
      addNotification({
        type: 'error',
        title: 'Test Failed',
        message: 'Could not send test notification. Check your settings.',
        duration: 5000
      });
    }
  };

  const getCheckIntervalLabel = (interval: number) => {
    const minutes = interval / 60000;
    if (minutes < 1) return `${interval / 1000}s`;
    if (minutes === 1) return '1 minute';
    if (minutes < 60) return `${minutes} minutes`;
    return `${minutes / 60} hour${minutes / 60 > 1 ? 's' : ''}`;
  };

  return (
    <motion.div 
      className={`bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6 ${className}`}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      <div className="flex items-center gap-3 mb-6">
        <div className="p-2 bg-blue-100 dark:bg-blue-900 rounded-lg">
          <Bell className="w-5 h-5 text-blue-600 dark:text-blue-400" />
        </div>
        <div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
            Reminder Notifications
          </h3>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Configure how you want to receive reminder notifications
          </p>
        </div>
      </div>

      <div className="space-y-6">
        {/* Master Toggle */}
        <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
          <div className="flex items-center gap-3">
            {settings.enabled ? (
              <Bell className="w-5 h-5 text-green-500" />
            ) : (
              <BellOff className="w-5 h-5 text-gray-400" />
            )}
            <div>
              <div className="font-medium text-gray-900 dark:text-gray-100">
                Enable Notifications
              </div>
              <div className="text-sm text-gray-600 dark:text-gray-400">
                Notifications are always active
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="px-3 py-1 text-sm rounded-md bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300">
              Always Active
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={settings.enabled}
                onChange={(e) => updateSetting('enabled', e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-blue-600"></div>
            </label>
          </div>
        </div>

        {/* Check Interval */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Clock className="w-5 h-5 text-blue-500" />
            <div>
              <div className="font-medium text-gray-900 dark:text-gray-100">
                Check Interval
              </div>
              <div className="text-sm text-gray-600 dark:text-gray-400">
                How often to check for due reminders
              </div>
            </div>
          </div>
          <select
            value={settings.checkInterval}
            onChange={(e) => updateSetting('checkInterval', parseInt(e.target.value))}
            className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
            disabled={!settings.enabled}
          >
            <option value={30000}>30 seconds</option>
            <option value={60000}>1 minute</option>
            <option value={300000}>5 minutes</option>
            <option value={600000}>10 minutes</option>
            <option value={1800000}>30 minutes</option>
          </select>
        </div>

        {/* Browser Notifications */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Monitor className="w-5 h-5 text-blue-500" />
            <div>
              <div className="font-medium text-gray-900 dark:text-gray-100">
                Browser Notifications
              </div>
              <div className="text-sm text-gray-600 dark:text-gray-400">
                Show notifications in your browser
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {browserPermission === 'granted' ? (
              <CheckCircle className="w-4 h-4 text-green-500" />
            ) : (
              <AlertCircle className="w-4 h-4 text-yellow-500" />
            )}
            {browserPermission !== 'granted' && (
              <button
                onClick={requestBrowserPermission}
                className="px-3 py-1 text-xs bg-blue-100 text-blue-700 rounded hover:bg-blue-200 dark:bg-blue-900 dark:text-blue-300"
              >
                Grant Permission
              </button>
            )}
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={settings.browserNotifications && browserPermission === 'granted'}
                onChange={(e) => updateSetting('browserNotifications', e.target.checked)}
                className="sr-only peer"
                disabled={!settings.enabled || browserPermission !== 'granted'}
              />
              <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-blue-600 peer-disabled:opacity-50"></div>
            </label>
          </div>
        </div>

        {/* Electron Notifications */}
        {isElectron && (
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Smartphone className="w-5 h-5 text-blue-500" />
              <div>
                <div className="font-medium text-gray-900 dark:text-gray-100">
                  Desktop Notifications
                </div>
                <div className="text-sm text-gray-600 dark:text-gray-400">
                  Show native desktop notifications
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {electronPermission ? (
                <CheckCircle className="w-4 h-4 text-green-500" />
              ) : (
                <AlertCircle className="w-4 h-4 text-yellow-500" />
              )}
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={settings.electronNotifications && electronPermission}
                  onChange={(e) => updateSetting('electronNotifications', e.target.checked)}
                  className="sr-only peer"
                  disabled={!settings.enabled || !electronPermission}
                />
                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-blue-600 peer-disabled:opacity-50"></div>
              </label>
            </div>
          </div>
        )}

        {/* In-App Notifications */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Settings className="w-5 h-5 text-blue-500" />
            <div>
              <div className="font-medium text-gray-900 dark:text-gray-100">
                In-App Notifications
              </div>
              <div className="text-sm text-gray-600 dark:text-gray-400">
                Show notifications within the app interface
              </div>
            </div>
          </div>
          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              checked={settings.showInAppNotifications}
              onChange={(e) => updateSetting('showInAppNotifications', e.target.checked)}
              className="sr-only peer"
              disabled={!settings.enabled}
            />
            <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-blue-600 peer-disabled:opacity-50"></div>
          </label>
        </div>

        {/* Auto Start */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-5 h-5 text-blue-500">🚀</div>
            <div>
              <div className="font-medium text-gray-900 dark:text-gray-100">
                Auto Start
              </div>
              <div className="text-sm text-gray-600 dark:text-gray-400">
                Automatically start monitoring when the app opens
              </div>
            </div>
          </div>
          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              checked={settings.autoStart}
              onChange={(e) => updateSetting('autoStart', e.target.checked)}
              className="sr-only peer"
              disabled={!settings.enabled}
            />
            <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-blue-600 peer-disabled:opacity-50"></div>
          </label>
        </div>

        {/* Test Notification */}
        <div className="pt-4 border-t border-gray-200 dark:border-gray-600">
          <button
            onClick={handleTestNotification}
            disabled={!settings.enabled}
            className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-white rounded-lg transition-colors"
          >
            <TestTube className="w-4 h-4" />
            Test Notification
          </button>
        </div>

        {/* Status Info */}
        <div className="pt-4 border-t border-gray-200 dark:border-gray-600">
          <div className="text-xs text-gray-500 dark:text-gray-400 space-y-1">
            <div>Status: Always Active</div>
            <div>Check Interval: {getCheckIntervalLabel(settings.checkInterval)}</div>
            <div>Browser Permission: {browserPermission}</div>
            {isElectron && (
              <div>Desktop Permission: {electronPermission ? 'Granted' : 'Not Granted'}</div>
            )}
          </div>
        </div>
      </div>
    </motion.div>
  );
};

export default ReminderSettings;
