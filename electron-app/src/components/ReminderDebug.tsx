/**
 * Reminder Debug Component
 * For debugging medication reminder issues
 */

import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { 
  Bug, 
  Play, 
  Search, 
  Plus,
  Clock,
  Pill,
  AlertTriangle,
  CheckCircle,
  Database,
  RefreshCw
} from 'lucide-react';
import { useReminderNotifications } from '../hooks/useReminderNotifications';
import { useNotification } from './NotificationProvider';

interface ReminderDebugProps {
  className?: string;
}

const ReminderDebug: React.FC<ReminderDebugProps> = ({ className = '' }) => {
  const { addNotification } = useNotification();
  const [debugInfo, setDebugInfo] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);

  const {
    debugReminderState,
    createTestMedicationReminder,
    testNotification,
    forceCheckReminders
  } = useReminderNotifications({
    userId: '00000000-0000-0000-0000-000000000001',
    showInAppNotifications: true
  });

  const handleDebugState = async () => {
    setIsLoading(true);
    try {
      const info = await debugReminderState();
      setDebugInfo(info);
      
      addNotification({
        type: 'info',
        title: 'Debug Info Retrieved',
        message: `Found ${info.reminders.length} reminders and ${info.medications.length} medications`,
        duration: 3000
      });
    } catch (error: any) {
      console.error('Debug state error:', error);
      addNotification({
        type: 'error',
        title: 'Debug Failed',
        message: error?.message || 'Failed to get debug information',
        duration: 5000
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateTestReminder = async () => {
    setIsLoading(true);
    try {
      const result = await createTestMedicationReminder();
      
      addNotification({
        type: 'success',
        title: 'Test Reminder Created',
        message: `Created medication "${result.medication.name}" with reminder at ${result.reminder.reminder_time}`,
        duration: 5000
      });
      
      // Refresh debug info
      setTimeout(() => {
        handleDebugState();
      }, 1000);
    } catch (error: any) {
      console.error('Create test reminder error:', error);
      addNotification({
        type: 'error',
        title: 'Test Creation Failed',
        message: error?.message || 'Failed to create test reminder',
        duration: 5000
      });
    } finally {
      setIsLoading(false);
    }
  };

  const getDueReminderCount = () => {
    if (!debugInfo?.reminders) return 0;
    return debugInfo.reminders.filter((r: any) => r.isDue).length;
  };

  const getActiveReminderCount = () => {
    if (!debugInfo?.reminders) return 0;
    return debugInfo.reminders.filter((r: any) => r.isActive).length;
  };

  const getMedicationReminderCount = () => {
    if (!debugInfo?.reminders) return 0;
    return debugInfo.reminders.filter((r: any) => r.type === 'medication').length;
  };

  return (
    <div className={`bg-white rounded-lg shadow-lg p-6 ${className}`}>
      <div className="flex items-center gap-3 mb-6">
        <Bug className="w-6 h-6 text-orange-500" />
        <h3 className="text-xl font-semibold text-gray-800">
          Reminder Debug Tools
        </h3>
      </div>

      {/* Action Buttons */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={handleDebugState}
          disabled={isLoading}
          className="flex flex-col items-center gap-2 p-4 bg-blue-50 hover:bg-blue-100 rounded-lg border border-blue-200 transition-colors disabled:opacity-50"
        >
          <Search className="w-5 h-5 text-blue-600" />
          <span className="text-sm font-medium text-blue-800">
            Check State
          </span>
        </motion.button>

        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={handleCreateTestReminder}
          disabled={isLoading}
          className="flex flex-col items-center gap-2 p-4 bg-green-50 hover:bg-green-100 rounded-lg border border-green-200 transition-colors disabled:opacity-50"
        >
          <Plus className="w-5 h-5 text-green-600" />
          <span className="text-sm font-medium text-green-800">
            Create Test
          </span>
        </motion.button>

        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={testNotification}
          disabled={isLoading}
          className="flex flex-col items-center gap-2 p-4 bg-purple-50 hover:bg-purple-100 rounded-lg border border-purple-200 transition-colors disabled:opacity-50"
        >
          <Play className="w-5 h-5 text-purple-600" />
          <span className="text-sm font-medium text-purple-800">
            Test Notify
          </span>
        </motion.button>

        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={async () => {
            try {
              await forceCheckReminders();
              addNotification({
                type: 'info',
                title: 'Force Check Complete',
                message: 'Manually checked all reminders for due notifications',
                duration: 3000
              });
            } catch (error: any) {
              addNotification({
                type: 'error',
                title: 'Force Check Failed',
                message: error?.message || 'Failed to check reminders',
                duration: 5000
              });
            }
          }}
          disabled={isLoading}
          className="flex flex-col items-center gap-2 p-4 bg-orange-50 hover:bg-orange-100 rounded-lg border border-orange-200 transition-colors disabled:opacity-50"
        >
          <RefreshCw className="w-5 h-5 text-orange-600" />
          <span className="text-sm font-medium text-orange-800">
            Force Check
          </span>
        </motion.button>
      </div>

      {/* Status Cards */}
      {debugInfo && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
            <div className="flex items-center gap-2 mb-2">
              <Database className="w-4 h-4 text-blue-600" />
              <span className="text-sm font-medium text-blue-800">Total</span>
            </div>
            <div className="text-2xl font-bold text-blue-900">
              {debugInfo.reminders.length}
            </div>
            <div className="text-xs text-blue-600">Reminders</div>
          </div>

          <div className="bg-green-50 rounded-lg p-4 border border-green-200">
            <div className="flex items-center gap-2 mb-2">
              <CheckCircle className="w-4 h-4 text-green-600" />
              <span className="text-sm font-medium text-green-800">Active</span>
            </div>
            <div className="text-2xl font-bold text-green-900">
              {getActiveReminderCount()}
            </div>
            <div className="text-xs text-green-600">Active</div>
          </div>

          <div className="bg-orange-50 rounded-lg p-4 border border-orange-200">
            <div className="flex items-center gap-2 mb-2">
              <Pill className="w-4 h-4 text-orange-600" />
              <span className="text-sm font-medium text-orange-800">Medication</span>
            </div>
            <div className="text-2xl font-bold text-orange-900">
              {getMedicationReminderCount()}
            </div>
            <div className="text-xs text-orange-600">Med Reminders</div>
          </div>

          <div className="bg-red-50 rounded-lg p-4 border border-red-200">
            <div className="flex items-center gap-2 mb-2">
              <Clock className="w-4 h-4 text-red-600" />
              <span className="text-sm font-medium text-red-800">Due Now</span>
            </div>
            <div className="text-2xl font-bold text-red-900">
              {getDueReminderCount()}
            </div>
            <div className="text-xs text-red-600">Due</div>
          </div>
        </div>
      )}

      {/* Current State Info */}
      {debugInfo && (
        <div className="bg-gray-50 rounded-lg p-4 mb-6">
          <h4 className="font-semibold text-gray-800 mb-3">Current State</h4>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-gray-600">Time:</span>
              <span className="ml-2 font-mono">{debugInfo.currentTime}</span>
            </div>
            <div>
              <span className="text-gray-600">Day:</span>
              <span className="ml-2">{debugInfo.currentDay}</span>
            </div>
            <div>
              <span className="text-gray-600">Status:</span>
              <span className="ml-2 text-green-600">Always Active</span>
            </div>
            <div>
              <span className="text-gray-600">Interval:</span>
              <span className="ml-2">{debugInfo.checkInterval / 1000}s</span>
            </div>
          </div>
        </div>
      )}

      {/* Reminders List */}
      {debugInfo?.reminders && debugInfo.reminders.length > 0 && (
        <div className="bg-gray-50 rounded-lg p-4">
          <h4 className="font-semibold text-gray-800 mb-3">Reminders Detail</h4>
          <div className="space-y-3 max-h-64 overflow-y-auto">
            {debugInfo.reminders.map((reminder: any) => (
              <div 
                key={reminder.id} 
                className={`p-3 rounded-lg border ${
                  reminder.isDue 
                    ? 'bg-red-50 border-red-200' 
                    : reminder.isActive 
                      ? 'bg-white border-gray-200' 
                      : 'bg-gray-100 border-gray-300'
                }`}
              >
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center gap-2">
                    {reminder.type === 'medication' && <Pill className="w-4 h-4 text-blue-600" />}
                    <span className="font-medium text-gray-800">{reminder.title}</span>
                    {reminder.isDue && (
                      <AlertTriangle className="w-4 h-4 text-red-500" />
                    )}
                  </div>
                  <span className="text-xs font-mono text-gray-500">
                    {reminder.time}
                  </span>
                </div>
                
                <div className="text-xs text-gray-600 space-y-1">
                  <div>Type: {reminder.type} | Active: {reminder.isActive ? 'Yes' : 'No'}</div>
                  <div>Days: {reminder.daysOfWeek?.join(', ') || 'None'}</div>
                  {reminder.medicationId && (
                    <div>Medication ID: {reminder.medicationId}</div>
                  )}
                  {reminder.lastTriggered && (
                    <div>Last: {new Date(reminder.lastTriggered).toLocaleString()}</div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {isLoading && (
        <div className="text-center py-4">
          <RefreshCw className="w-6 h-6 animate-spin mx-auto text-blue-500" />
          <p className="text-sm text-gray-600 mt-2">Loading...</p>
        </div>
      )}
    </div>
  );
};

export default ReminderDebug;
