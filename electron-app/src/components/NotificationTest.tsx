/**
 * Notification Test Component
 * For testing and debugging the reminder notification system
 */

import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { 
  TestTube, 
  Bell, 
  BellOff, 
  Clock, 
  AlertCircle, 
  CheckCircle,
  Settings,
  Play,
  Pause,
  RefreshCw,
  Plus
} from 'lucide-react';
import { useReminderNotifications } from '../hooks/useReminderNotifications';
import { useNotification } from './NotificationProvider';
import { SupabaseService } from '../services/supabase';

interface NotificationTestProps {
  className?: string;
}

const NotificationTest: React.FC<NotificationTestProps> = ({ className = '' }) => {
  const { addNotification } = useNotification();
  const [isTestingPermissions, setIsTestingPermissions] = useState(false);
  const [permissionResults, setPermissionResults] = useState<any>(null);
  const [testReminderData, setTestReminderData] = useState({
    title: 'Test Medication Reminder',
    description: 'Take your morning vitamins',
    time: '09:00',
    days: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday']
  });

  const {
    startMonitoring,
    stopMonitoring,
    isMonitoring,
    testNotification
  } = useReminderNotifications({
    userId: '00000000-0000-0000-0000-000000000001',
    autoStart: false,
    showInAppNotifications: true
  });

  const testPermissions = async () => {
    setIsTestingPermissions(true);
    const results: any = {
      browser: { available: false, permission: 'default' },
      electron: { available: false, permission: false }
    };

    try {
      // Test browser notifications
      if ('Notification' in window) {
        results.browser.available = true;
        results.browser.permission = Notification.permission;
        
        if (Notification.permission === 'default') {
          try {
            const permission = await Notification.requestPermission();
            results.browser.permission = permission;
          } catch (error: any) {
            results.browser.error = error?.message || 'Unknown error';
          }
        }
      }

      // Test Electron notifications
      const electronAPI = (window as any).electronAPI;
      if (electronAPI) {
        results.electron.available = true;
        
        try {
          if (electronAPI.requestNotificationPermission) {
            const result = await electronAPI.requestNotificationPermission();
            results.electron.permission = result.success && result.permission === 'granted';
            results.electron.details = result;
          }
        } catch (error: any) {
          results.electron.error = error?.message || 'Unknown error';
        }
      }

      setPermissionResults(results);
      
      addNotification({
        type: 'info',
        title: 'Permission Test Complete',
        message: `Browser: ${results.browser.permission}, Electron: ${results.electron.permission}`,
        duration: 5000
      });
    } catch (error: any) {
      console.error('Error testing permissions:', error);
      addNotification({
        type: 'error',
        title: 'Permission Test Failed',
        message: error?.message || 'Unknown error occurred',
        duration: 5000
      });
    } finally {
      setIsTestingPermissions(false);
    }
  };

  const createTestReminder = async () => {
    try {
      const reminderData = {
        title: testReminderData.title,
        description: testReminderData.description,
        reminder_time: testReminderData.time,
        is_recurring: true,
        days_of_week: testReminderData.days,
        reminder_type: 'medication',
        is_active: true
      };

      const newReminder = await SupabaseService.addReminder(reminderData);
      
      addNotification({
        type: 'success',
        title: 'Test Reminder Created',
        message: `Reminder "${reminderData.title}" created for ${reminderData.reminder_time}`,
        duration: 5000
      });

      console.log('Test reminder created:', newReminder);
    } catch (error: any) {
      console.error('Error creating test reminder:', error);
      addNotification({
        type: 'error',
        title: 'Failed to Create Test Reminder',
        message: error?.message || 'Unknown error occurred',
        duration: 5000
      });
    }
  };

  const testDirectNotification = async () => {
    try {
      // Test browser notification
      if ('Notification' in window && Notification.permission === 'granted') {
        const notification = new Notification('Test Direct Notification', {
          body: 'This is a direct browser notification test',
          icon: '/ava-logo.svg',
          badge: '/ava-logo.svg'
        });

        notification.onclick = () => {
          console.log('Direct notification clicked');
          notification.close();
        };

        setTimeout(() => notification.close(), 5000);
      }

      // Test Electron notification
      const electronAPI = (window as any).electronAPI;
      if (electronAPI && electronAPI.showNotification) {
        await electronAPI.showNotification({
          title: 'Test Direct Electron Notification',
          body: 'This is a direct Electron notification test',
          icon: '/ava-logo.svg'
        });
      }

      addNotification({
        type: 'success',
        title: 'Direct Notification Sent',
        message: 'Check for browser and/or desktop notifications',
        duration: 3000
      });
    } catch (error: any) {
      console.error('Error sending direct notification:', error);
      addNotification({
        type: 'error',
        title: 'Direct Notification Failed',
        message: error?.message || 'Unknown error occurred',
        duration: 5000
      });
    }
  };

  const getPermissionStatus = (permission: string | boolean) => {
    if (typeof permission === 'boolean') {
      return permission ? 'granted' : 'denied';
    }
    return permission;
  };

  const getPermissionIcon = (permission: string | boolean) => {
    const status = getPermissionStatus(permission);
    switch (status) {
      case 'granted':
        return <CheckCircle className="w-4 h-4 text-green-500" />;
      case 'denied':
        return <AlertCircle className="w-4 h-4 text-red-500" />;
      default:
        return <AlertCircle className="w-4 h-4 text-yellow-500" />;
    }
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
          <TestTube className="w-5 h-5 text-blue-600 dark:text-blue-400" />
        </div>
        <div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
            Notification Testing
          </h3>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Test and debug the reminder notification system
          </p>
        </div>
      </div>

      <div className="space-y-6">
        {/* Permission Testing */}
        <div className="border border-gray-200 dark:border-gray-600 rounded-lg p-4">
          <h4 className="font-medium text-gray-900 dark:text-gray-100 mb-3 flex items-center gap-2">
            <Settings className="w-4 h-4" />
            Permission Status
          </h4>
          
          {permissionResults && (
            <div className="space-y-2 mb-4">
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-600 dark:text-gray-400">Browser Notifications:</span>
                <div className="flex items-center gap-2">
                  {getPermissionIcon(permissionResults.browser.permission)}
                  <span className="capitalize">{getPermissionStatus(permissionResults.browser.permission)}</span>
                </div>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-600 dark:text-gray-400">Desktop Notifications:</span>
                <div className="flex items-center gap-2">
                  {getPermissionIcon(permissionResults.electron.permission)}
                  <span className="capitalize">{getPermissionStatus(permissionResults.electron.permission)}</span>
                </div>
              </div>
            </div>
          )}

          <button
            onClick={testPermissions}
            disabled={isTestingPermissions}
            className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-white rounded-lg transition-colors"
          >
            {isTestingPermissions ? (
              <RefreshCw className="w-4 h-4 animate-spin" />
            ) : (
              <CheckCircle className="w-4 h-4" />
            )}
            {isTestingPermissions ? 'Testing...' : 'Test Permissions'}
          </button>
        </div>

        {/* Monitoring Control */}
        <div className="border border-gray-200 dark:border-gray-600 rounded-lg p-4">
          <h4 className="font-medium text-gray-900 dark:text-gray-100 mb-3 flex items-center gap-2">
            <Clock className="w-4 h-4" />
            Reminder Monitoring
          </h4>
          
          <div className="flex items-center justify-between mb-4">
            <span className="text-sm text-gray-600 dark:text-gray-400">
              Status: {isMonitoring ? 'Active' : 'Stopped'}
            </span>
            <div className="flex items-center gap-2">
              {isMonitoring ? (
                <Bell className="w-4 h-4 text-green-500" />
              ) : (
                <BellOff className="w-4 h-4 text-gray-400" />
              )}
            </div>
          </div>

          <div className="flex gap-2">
            <button
              onClick={startMonitoring}
              disabled={isMonitoring}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-white rounded-lg transition-colors"
            >
              <Play className="w-4 h-4" />
              Start
            </button>
            <button
              onClick={stopMonitoring}
              disabled={!isMonitoring}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-white rounded-lg transition-colors"
            >
              <Pause className="w-4 h-4" />
              Stop
            </button>
          </div>
        </div>

        {/* Test Reminder Creation */}
        <div className="border border-gray-200 dark:border-gray-600 rounded-lg p-4">
          <h4 className="font-medium text-gray-900 dark:text-gray-100 mb-3 flex items-center gap-2">
            <Bell className="w-4 h-4" />
            Test Reminder
          </h4>
          
          <div className="space-y-3 mb-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Title
              </label>
              <input
                type="text"
                value={testReminderData.title}
                onChange={(e) => setTestReminderData(prev => ({ ...prev, title: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Description
              </label>
              <input
                type="text"
                value={testReminderData.description}
                onChange={(e) => setTestReminderData(prev => ({ ...prev, description: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Time
              </label>
              <input
                type="time"
                value={testReminderData.time}
                onChange={(e) => setTestReminderData(prev => ({ ...prev, time: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
              />
            </div>
          </div>

          <button
            onClick={createTestReminder}
            className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-colors"
          >
            <Plus className="w-4 h-4" />
            Create Test Reminder
          </button>
        </div>

        {/* Direct Notification Test */}
        <div className="border border-gray-200 dark:border-gray-600 rounded-lg p-4">
          <h4 className="font-medium text-gray-900 dark:text-gray-100 mb-3 flex items-center gap-2">
            <TestTube className="w-4 h-4" />
            Direct Notifications
          </h4>
          
          <div className="space-y-2">
            <button
              onClick={testNotification}
              className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
            >
              <Bell className="w-4 h-4" />
              Test Service Notification
            </button>
            
            <button
              onClick={testDirectNotification}
              className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-colors"
            >
              <TestTube className="w-4 h-4" />
              Test Direct Notification
            </button>
          </div>
        </div>
      </div>
    </motion.div>
  );
};

export default NotificationTest;
