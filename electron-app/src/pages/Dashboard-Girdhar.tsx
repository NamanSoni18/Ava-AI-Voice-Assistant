import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Volume2,
  Pause,
  Play,
  Square,
  Plus,
  Bot,
  Pencil,
  Trash2,
  Calendar,
  Pill,
  HeartPulse,
  Stethoscope,
  Bell,
  BellOff,
  Settings,
} from 'lucide-react';
import { apiService } from '../services/api';
import {
  generateId,
  formatMessage,
  playAudio,
  stopAudio,
  pauseAudio,
  resumeAudio,
  storage,
  STORAGE_KEYS,
  THEMES,
  MAX_MESSAGES,
} from '../utils';
import type {
  Message,
  AppState,
  Medication,
  MedicationResponse,
  ReminderResponse,
  EmergencyContactResponse,
  SymptomCheckRequest,
  SymptomCheckResponse,
  HealthTip,
} from '../types';

// Components
import VoiceInterface from '../components/VoiceInterface';
import StatusIndicator from '../components/StatusIndicator';
import Header from '../components/Header';
import { useNotification } from '../components/NotificationProvider';
import { useReminderNotifications } from '../hooks/useReminderNotifications';
import NotificationTest from '../components/NotificationTest';

const Dashboard: React.FC = () => {
  const { addNotification } = useNotification();

  const [appState, setAppState] = useState<AppState>({
    messages: [],
    isListening: false,
    isPaused: false,
    isMuted: false,
    isDarkMode: true,
    status: 'idle',
    currentAudio: undefined,
    currentAudioUrl: undefined,
    isSpeaking: false,
    medications: [],
    reminders: [],
    emergencyContacts: [] as EmergencyContactResponse[],
    healthTips: [],
  });

  const [activeTab, setActiveTab] = useState<'medications' | 'health' | 'chat' | 'settings'>('chat');
  const [showAllReminders, setShowAllReminders] = useState(false);
  
  // Get current time in HH:MM format
  const getCurrentTime = () => {
    const now = new Date();
    return now.getHours().toString().padStart(2, '0') + ':' + now.getMinutes().toString().padStart(2, '0');
  };

  const [newMedication, setNewMedication] = useState<Omit<Medication, 'id'>>({
    name: '',
    dosage: '',
    frequency: 'Once daily',
    time: getCurrentTime(),
  });
  const [symptomCheck, setSymptomCheck] = useState<SymptomCheckRequest>({
    symptoms: '',
    severity: 'mild',
    duration: '',
  });
  const [symptomResult, setSymptomResult] = useState<SymptomCheckResponse | null>(null);
  const [showEmergencyModal, setShowEmergencyModal] = useState(false);
  const [newEmergencyContact, setNewEmergencyContact] = useState<
    Omit<EmergencyContactResponse, 'id'>
  >({
    name: '',
    phone: '',
    relationship: 'Doctor',
    is_primary: false,
  });

  const abortControllerRef = useRef<AbortController | null>(null);
  const isProcessingRef = useRef<boolean>(false);

  // Initialize reminder notifications (always active)
  const { forceCheckReminders } = useReminderNotifications({
    userId: '00000000-0000-0000-0000-000000000001',
    showInAppNotifications: true
  });

  // Load data function
  const loadData = useCallback(async () => {
    try {
      const [medicationsRes, remindersRes, contactsRes, tipsRes] = await Promise.all([
        apiService.getMedications(),
        apiService.getReminders(),
        apiService.getEmergencyContacts(),
        apiService.getHealthTips(3),
      ]);

      setAppState(prev => ({
        ...prev,
        medications: medicationsRes,
        reminders: remindersRes as ReminderResponse[],
        emergencyContacts: contactsRes as EmergencyContactResponse[],
        healthTips: tipsRes as HealthTip[],
      }));
    } catch (error: any) {
      console.error('Failed to load data:', error);

      // Show notification for data loading issues
      if (error.message?.includes('Supabase')) {
        addNotification({
          type: 'warning',
          title: 'Using Offline Mode',
          message: 'Backend server is unavailable. Using direct database connection.',
          duration: 4000
        });
      } else {
        addNotification({
          type: 'error',
          title: 'Data Loading Failed',
          message: 'Some data may not be available. Please check your connection.',
          duration: 5000
        });
      }
    }
  }, [addNotification]);

  // Load initial data
  useEffect(() => {
    const loadInitialData = async () => {
      try {
        // Load saved settings
        const savedMessages = storage.get(STORAGE_KEYS.MESSAGES) || [];
        const savedSettings = storage.get(STORAGE_KEYS.SETTINGS) || {};
        const savedTheme = storage.get(STORAGE_KEYS.THEME) || THEMES.DARK;

        // Set the theme on document immediately
        document.documentElement.setAttribute('data-theme', savedTheme);

        // Load data from API
        await loadData();

        setAppState(prev => ({
          ...prev,
          messages: savedMessages.slice(-MAX_MESSAGES),
          isMuted: savedSettings.isMuted || false,
          isDarkMode: savedTheme === THEMES.DARK,
        }));
      } catch (error) {
        console.error('Failed to load initial data:', error);
      }
    };

    loadInitialData();
  }, [loadData]);

  // Ensure dark mode is set on component mount
  useEffect(() => {
    const savedTheme = storage.get(STORAGE_KEYS.THEME) || THEMES.DARK;
    document.documentElement.setAttribute('data-theme', savedTheme);
  }, []);

  // State update helper
  const updateState = useCallback((updates: Partial<AppState>) => {
    setAppState(prev => ({ ...prev, ...updates }));
  }, []);

  // Chat message handling
  const addMessage = useCallback((text: string, isUser: boolean) => {
    const message: Message = {
      id: generateId(),
      text: formatMessage(text),
      isUser,
      timestamp: Date.now(),
    };

    setAppState(prev => {
      const newMessages = [...prev.messages, message].slice(-MAX_MESSAGES);
      storage.set(STORAGE_KEYS.MESSAGES, newMessages);
      return { ...prev, messages: newMessages };
    });

    return message;
  }, []);

  // Voice recognition
  const startListening = useCallback(async () => {
    if (isProcessingRef.current) return;

    // If already listening, stop and process any partial text
    if (appState.isListening) {
      await stopListening();
      return;
    }

    isProcessingRef.current = true;
    try {
      updateState({ isListening: true, status: 'listening' });

      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      abortControllerRef.current = new AbortController();

      const response = await apiService.startVoiceRecognition({
        timeout: 10,
        phrase_time_limit: 15,
      });

      if (response.text?.trim()) {
        addMessage(response.text, true);
        await getAIResponse(response.text);
      } else {
        addMessage('No speech detected. Please try again.', false);
      }
    } catch (error: any) {
      console.error('Voice input error:', error);

      // Check if it was manually cancelled (user clicked mic again)
      if (error.name === 'AbortError' || error.message?.includes('cancelled') || abortControllerRef.current?.signal.aborted) {
        // Don't show error message for manual cancellation
        updateState({ status: 'idle' });
      } else {
        updateState({ status: 'error' });

        const errorMessage = error.message?.includes('Network error')
          ? 'Cannot connect to voice service. Please check if the backend is running.'
          : error.message?.includes('timeout') || error.message?.includes('TIMEOUT')
            ? 'Voice recognition timed out. Try speaking more clearly or check your microphone.'
            : `Voice recognition error: ${error.message}`;

        addMessage(errorMessage, false);

        // Add notification for voice recognition errors
        if (error.message?.includes('Supabase')) {
          addNotification({
            type: 'warning',
            title: 'Voice Recognition Offline',
            message: 'Voice recognition using offline mode. Some features may be limited.'
          });
        } else if (error.message?.includes('Network error')) {
          addNotification({
            type: 'error',
            title: 'Connection Error',
            message: 'Cannot connect to voice service. Check backend status.'
          });
        } else if (error.message?.includes('timeout')) {
          addNotification({
            type: 'warning',
            title: 'Voice Timeout',
            message: 'Voice recognition timed out. Please try again.'
          });
        } else {
          addNotification({
            type: 'error',
            title: 'Voice Recognition Failed',
            message: 'Unable to process voice input. Please try again.'
          });
        }
      }
    } finally {
      updateState({ isListening: false });
      if (appState.status !== 'speaking' && appState.status !== 'processing') {
        setTimeout(() => updateState({ status: 'idle' }), 1000);
      }
      isProcessingRef.current = false;
    }
  }, [appState.isListening, appState.status, addMessage, updateState, addNotification]);

  const stopListening = useCallback(async () => {
    if (!appState.isListening) return;

    try {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      // Note: We don't call apiService.stopVoiceRecognition() here as it might not exist
      // The abort controller should handle stopping the request
    } catch (error) {
      console.error('Stop listening error:', error);
    } finally {
      updateState({ isListening: false, status: 'idle' });
    }
  }, [appState.isListening, updateState]);

  // AI response handling
  const getAIResponse = useCallback(
    async (userText: string) => {
      try {
        updateState({ status: 'processing' });

        // Handle medication queries
        if (
          userText.toLowerCase().includes('medicine') ||
          userText.toLowerCase().includes('medication')
        ) {
          const nextMed = getNextMedication();
          if (nextMed) {
            const response = `Your next medication is ${nextMed.name}, ${nextMed.dosage} at ${nextMed.time}.`;
            const aiMessage = addMessage(response, false);
            if (!appState.isMuted) await generateSpeech(response, aiMessage.id);
            return;
          }
        }

        // Handle symptom queries
        if (
          userText.toLowerCase().includes('i have') ||
          userText.toLowerCase().includes('i feel') ||
          userText.toLowerCase().includes('symptom')
        ) {
          const response = await apiService.checkSymptoms({ symptoms: userText });
          const aiMessage = addMessage(response.analysis, false);
          if (!appState.isMuted) await generateSpeech(response.analysis, aiMessage.id);
          return;
        }

        // Default AI response
        const response = await apiService.getGeminiResponse({ text: userText });
        const aiMessage = addMessage(response.response, false);
        if (!appState.isMuted) await generateSpeech(response.response, aiMessage.id);
      } catch (error: any) {
        console.error('AI response error:', error);

        if (error.message?.includes('Supabase')) {
          addNotification({
            type: 'warning',
            title: 'AI Response Offline',
            message: 'AI response generated using offline mode. Some features may be limited.'
          });
        } else {
          addNotification({
            type: 'error',
            title: 'AI Response Failed',
            message: 'Unable to generate AI response. Please try again.'
          });
        }

        addMessage(`Sorry, I encountered an error. Please try again.`, false);
        updateState({ status: 'error' });
        setTimeout(() => updateState({ status: 'idle' }), 2000);
      }
    },
    [addMessage, appState.isMuted, updateState, addNotification]
  );

  // Text-to-speech
  const generateSpeech = useCallback(async (text: string, messageId: string) => {
    try {
      updateState({ status: 'speaking', isSpeaking: true });

      const response = await apiService.generateSpeech({
        text,
        voice_id: 'en-US-terrell'
      });

      console.log('TTS Response:', response); // Debug log

      if (response.audio_url) {
        const fullAudioUrl = response.audio_url.startsWith('http')
          ? response.audio_url
          : `http://127.0.0.1:8000${response.audio_url}`;

        console.log('Setting audio URL:', fullAudioUrl); // Debug log

        setAppState(prev => ({
          ...prev,
          messages: prev.messages.map(msg =>
            msg.id === messageId ? { ...msg, audioUrl: fullAudioUrl } : msg
          )
        }));

        console.log('Audio URL set:', fullAudioUrl); // Debug log

        if (!appState.isMuted) {
          const audio = await playAudio(fullAudioUrl);
          updateState({ currentAudio: audio, currentAudioUrl: fullAudioUrl });

          audio.onended = () => {
            updateState({
              isSpeaking: false,
              status: 'idle',
              currentAudio: undefined,
              currentAudioUrl: undefined,
              isPaused: false
            });
          };

          audio.onerror = (error) => {
            console.error('Audio playback error:', error);
            updateState({
              isSpeaking: false,
              status: 'idle',
              currentAudio: undefined,
              currentAudioUrl: undefined,
              isPaused: false
            });
          };
        } else {
          // If muted, just update the speaking state
          updateState({ isSpeaking: false, status: 'idle' });
        }
      } else {
        console.log('No audio URL in response, checking for fallback'); // Debug log
        if (response.fallback) {
          console.log('Using fallback TTS');
          updateState({ isSpeaking: false, status: 'idle' });
        } else {
          throw new Error('No audio URL received');
        }
      }
    } catch (error: any) {
      console.error('Speech generation error:', error);

      if (error.message?.includes('Supabase')) {
        addNotification({
          type: 'warning',
          title: 'Speech Generation Offline',
          message: 'Text-to-speech using fallback mode. Voice quality may vary.'
        });
      } else {
        addNotification({
          type: 'error',
          title: 'Speech Generation Failed',
          message: 'Unable to generate speech. Audio playback unavailable.'
        });
      }

      updateState({ isSpeaking: false, status: 'idle' });
    }
  }, [updateState, appState.isMuted, addNotification]);

  // State for tracking which medication is being edited
  const [editingMedicationId, setEditingMedicationId] = useState<string | null>(null);

  // Function to close modal and reset editing state
  const closeMedicationModal = useCallback(() => {
    setEditingMedicationId(null);
    setNewMedication({ name: '', dosage: '', frequency: 'Once daily', time: getCurrentTime() });
    (document.getElementById('add-medication-modal') as HTMLDialogElement)?.close();
  }, []);

  // Function to open add medication modal
  const openAddMedicationModal = useCallback(() => {
    setEditingMedicationId(null);
    setNewMedication({ name: '', dosage: '', frequency: 'Once daily', time: getCurrentTime() });
    (document.getElementById('add-medication-modal') as HTMLDialogElement)?.showModal();
  }, []);

  // Medication management
  const addMedication = useCallback(async () => {
    try {
      if (editingMedicationId) {
        // Update existing medication
        const updatedMedication = await apiService.updateMedication(
          editingMedicationId,
          newMedication
        );
        setAppState(prev => ({
          ...prev,
          medications: prev.medications.map(med =>
            med.id === editingMedicationId ? updatedMedication : med
          ),
        }));
        addMessage(`Updated medication: ${updatedMedication.name} ${updatedMedication.dosage} at ${updatedMedication.time}`, false);
        addNotification({
          type: 'success',
          title: 'Medication Updated',
          message: `${updatedMedication.name} has been updated successfully.`
        });
        
        // Force check reminders after medication update to trigger immediate notifications
        try {
          await forceCheckReminders();
          console.log('Forced reminder check after medication update');
        } catch (error) {
          console.warn('Failed to force check reminders:', error);
        }
        
        setEditingMedicationId(null);
      } else {
        // Add new medication
        const medication = await apiService.addMedication(newMedication);
        setAppState(prev => ({
          ...prev,
          medications: [...prev.medications, medication],
        }));
        addMessage(`Added medication: ${medication.name} ${medication.dosage} at ${medication.time}`, false);
        addNotification({
          type: 'success',
          title: 'Medication Added',
          message: `${medication.name} has been added to your medication list.`
        });
        
        // Force check reminders after adding new medication
        try {
          await forceCheckReminders();
          console.log('Forced reminder check after medication addition');
        } catch (error) {
          console.warn('Failed to force check reminders:', error);
        }
      }

      setNewMedication({ name: '', dosage: '', frequency: 'Once daily', time: getCurrentTime() });
      closeMedicationModal();

      // Refresh data to get updated reminders
      await loadData();
    } catch (error: any) {
      console.error('Failed to save medication:', error);

      // Show appropriate error notification
      if (error.message?.includes('Supabase')) {
        addNotification({
          type: 'warning',
          title: 'Saved in Offline Mode',
          message: 'Medication saved directly to database. Sync when backend is available.'
        });
      } else {
        addNotification({
          type: 'error',
          title: 'Save Failed',
          message: 'Failed to save medication. Please try again.'
        });
        addMessage('Failed to save medication. Please try again.', false);
      }
    }
  }, [newMedication, editingMedicationId, addMessage, loadData, closeMedicationModal, addNotification, forceCheckReminders]);

  const getNextMedication = useCallback(() => {
    const now = new Date();
    const currentHour = now.getHours();
    const currentMinute = now.getMinutes();

    return appState.medications
      .map(med => {
        const [hours, minutes] = med.time.split(':').map(Number);
        return {
          ...med,
          hours,
          minutes,
          timeValue: hours * 60 + minutes,
        };
      })
      .filter(med => med.timeValue > currentHour * 60 + currentMinute)
      .sort((a, b) => a.timeValue - b.timeValue)[0];
  }, [appState.medications]);

  // Medication management functions
  const editMedication = useCallback((medication: MedicationResponse) => {
    setNewMedication({
      name: medication.name,
      dosage: medication.dosage,
      frequency: medication.frequency,
      time: medication.time,
    });
    setEditingMedicationId(medication.id);
    (document.getElementById('add-medication-modal') as HTMLDialogElement)?.showModal();
  }, []);

  const deleteMedication = useCallback(
    async (medicationId: string) => {
      if (
        !window.confirm(
          'Are you sure you want to delete this medication? This will also delete associated reminders.'
        )
      ) {
        return;
      }

    try {
      await apiService.deleteMedication(medicationId);
      setAppState(prev => ({
        ...prev,
        medications: prev.medications.filter(med => med.id !== medicationId),
        reminders: prev.reminders.filter(reminder => reminder.medicationId !== medicationId)
      }));
      addMessage('Medication and associated reminders deleted successfully', false);
      addNotification({
        type: 'success',
        title: 'Medication Deleted',
        message: 'Medication and associated reminders have been removed.'
      });
      // Refresh data to ensure consistency
      await loadData();
    } catch (error: any) {
      console.error('Failed to delete medication:', error);

      if (error.message?.includes('Supabase')) {
        addNotification({
          type: 'warning',
          title: 'Deleted in Offline Mode',
          message: 'Medication deleted from local database. Sync when backend is available.'
        });
      } else {
        addNotification({
          type: 'error',
          title: 'Delete Failed',
          message: 'Failed to delete medication. Please try again.'
        });
        addMessage('Failed to delete medication. Please try again.', false);
      }
    }
  }, [addMessage, loadData, addNotification]);

  // Symptom checking
  const checkSymptoms = useCallback(async () => {
    if (!symptomCheck.symptoms.trim()) return;

    try {
      // Show analyzing state
      setSymptomResult({
        symptoms: symptomCheck.symptoms,
        analysis: '🔄 Analyzing your symptoms... Please wait for a comprehensive assessment.',
        timestamp: new Date().toISOString(),
      });

      const response = await apiService.checkSymptoms(symptomCheck);
      setSymptomResult(response);

      // Add a message to the chat as well
      const summaryMessage = `📋 Symptom Analysis Complete for: "${symptomCheck.symptoms}"\n\nCheck the Health Monitoring tab for detailed results.`;
      addMessage(summaryMessage, false);

    } catch (error: any) {
      console.error('Symptom check error:', error);

      if (error.message?.includes('Supabase')) {
        addNotification({
          type: 'warning',
          title: 'Analysis Completed Offline',
          message: 'Symptom analysis completed using local database. Some features may be limited.'
        });
      } else {
        addNotification({
          type: 'error',
          title: 'Analysis Failed',
          message: 'Could not analyze symptoms. Please check your connection and try again.'
        });
      }

      setSymptomResult({
        symptoms: symptomCheck.symptoms,
        analysis:
          '❌ Failed to analyze symptoms. This could be due to:\n\n• Backend service not running\n• Network connectivity issues\n• AI service temporarily unavailable\n\nPlease try again in a few moments or check if the backend server is running.',
        timestamp: new Date().toISOString(),
      });
    }
  }, [symptomCheck, addMessage, addNotification]);

  // Emergency contacts
  const addEmergencyContact = useCallback(async () => {
    try {
      const contact = await apiService.addEmergencyContact(newEmergencyContact);
      setAppState(prev => ({
        ...prev,
        emergencyContacts: [...(prev.emergencyContacts as EmergencyContactResponse[]), contact],
      }));
      setNewEmergencyContact({
        name: '',
        phone: '',
        relationship: 'Doctor',
        is_primary: false,
      });
      addNotification({
        type: 'success',
        title: 'Emergency Contact Added',
        message: `${contact.name} has been added to your emergency contacts.`
      });
      (document.getElementById('add-contact-modal') as HTMLDialogElement)?.close();
    } catch (error: any) {
      console.error('Failed to add emergency contact:', error);

      if (error.message?.includes('Supabase')) {
        addNotification({
          type: 'warning',
          title: 'Contact Saved in Offline Mode',
          message: 'Emergency contact saved directly to database. Sync when backend is available.'
        });
      } else {
        addNotification({
          type: 'error',
          title: 'Failed to Add Contact',
          message: 'Failed to add emergency contact. Please try again.'
        });
      }
    }
  }, [newEmergencyContact, addNotification]);

  const triggerEmergency = useCallback(
    (contactId: string) => {
      const contact = appState.emergencyContacts.find(c => c.id === contactId);
      if (contact) {
        addMessage(`Emergency: Calling ${contact.name} at ${contact.phone}`, false);
        // In a real app, this would actually call the number
        alert(`Calling ${contact.name} at ${contact.phone}`);
      }
    },
    [appState.emergencyContacts, addMessage]
  );

  // Audio controls
  const handlePlayAudio = useCallback(
    async (audioUrl: string) => {
      if (appState.isMuted) return;

      if (appState.currentAudio) {
        stopAudio(appState.currentAudio);
      }

      const audio = await playAudio(audioUrl);
      updateState({
        currentAudio: audio,
        isSpeaking: true,
        currentAudioUrl: audioUrl,
      });

      audio.onended = () => {
        updateState({
          currentAudio: undefined,
          isSpeaking: false,
          currentAudioUrl: undefined,
          isPaused: false,
        });
      };
    },
    [appState.currentAudio, appState.isMuted, updateState]
  );

  const handleStopAudio = useCallback(() => {
    if (appState.currentAudio) {
      stopAudio(appState.currentAudio);
      updateState({
        currentAudio: undefined,
        isSpeaking: false,
        isPaused: false,
        currentAudioUrl: undefined,
      });
    }
  }, [appState.currentAudio, updateState]);

  const handlePauseResumeAudio = useCallback(async () => {
    if (!appState.currentAudio) return;

    if (appState.isPaused) {
      await resumeAudio(appState.currentAudio);
      updateState({ isPaused: false, isSpeaking: true });
    } else {
      pauseAudio(appState.currentAudio);
      updateState({ isPaused: true, isSpeaking: false });
    }
  }, [appState.currentAudio, appState.isPaused, updateState]);

  // UI toggles
  const handleToggleMute = useCallback(() => {
    const newMuted = !appState.isMuted;
    updateState({ isMuted: newMuted });
    storage.set(STORAGE_KEYS.SETTINGS, {
      ...storage.get(STORAGE_KEYS.SETTINGS),
      isMuted: newMuted,
    });
    if (newMuted && appState.currentAudio) handleStopAudio();
  }, [appState.isMuted, appState.currentAudio, updateState, handleStopAudio]);

  const handleToggleTheme = useCallback(() => {
    const newTheme = appState.isDarkMode ? THEMES.LIGHT : THEMES.DARK;
    updateState({ isDarkMode: !appState.isDarkMode });
    document.documentElement.setAttribute('data-theme', newTheme);
    storage.set(STORAGE_KEYS.THEME, newTheme);
  }, [appState.isDarkMode, updateState]);

  // Cleanup
  useEffect(() => {
    return () => {
      if (abortControllerRef.current) abortControllerRef.current.abort();
      if (appState.currentAudio) stopAudio(appState.currentAudio);
    };
  }, [appState.currentAudio]);

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100 dark:from-slate-900 dark:via-slate-800 dark:to-indigo-950 transition-colors duration-300">
      {/* Header */}
      <Header 
        showControls={true}
        isDarkMode={appState.isDarkMode}
        isMuted={appState.isMuted}
        onToggleTheme={handleToggleTheme}
        onToggleMute={handleToggleMute}
        onEmergency={() => setShowEmergencyModal(true)}
      />

      {/* Main Content */}
      <main className="flex-1 flex flex-col md:flex-row overflow-hidden">
        {/* Sidebar Navigation */}
        <nav className="flex md:flex-col items-center justify-around md:justify-start gap-1 p-2 bg-white/70 dark:bg-slate-900/70 border-b md:border-b-0 md:border-r border-slate-200 dark:border-slate-800 z-10">
          <button
            onClick={() => setActiveTab('chat')}
            className={`p-3 rounded-lg transition-all ${activeTab === 'chat' ? 'bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300' : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-slate-800'}`}
            title="Chat with Ava"
          >
            <Stethoscope size={20} />
          </button>
          <button
            onClick={() => setActiveTab('medications')}
            className={`p-3 rounded-lg transition-all ${activeTab === 'medications' ? 'bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300' : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-slate-800'}`}
            title="Medications"
          >
            <Pill size={20} />
          </button>
          <button
            onClick={() => setActiveTab('health')}
            className={`p-3 rounded-lg transition-all ${activeTab === 'health' ? 'bg-purple-100 dark:bg-purple-900 text-purple-700 dark:text-purple-300' : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-slate-800'}`}
            title="Health Monitoring"
          >
            <HeartPulse size={20} />
          </button>
          <button
            onClick={() => setActiveTab('settings')}
            className={`p-3 rounded-lg transition-all ${activeTab === 'settings' ? 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300' : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-slate-800'}`}
            title="Notification Settings"
          >
            <Settings size={20} />
          </button>
        </nav>

        {/* Medications Panel */}
        <AnimatePresence>
          {activeTab === 'medications' && (
            <motion.section
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.2 }}
              className="flex-1 flex flex-col p-6 overflow-y-auto"
            >
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-xl font-semibold text-blue-700 dark:text-blue-300">
                  Medication Management
                </h2>
                <button
                  onClick={openAddMedicationModal}
                  className="flex items-center gap-2 px-4 py-2 bg-blue-500 text-white rounded-full shadow hover:bg-blue-600 transition-all"
                >
                  <Plus size={16} /> Add Medication
                </button>
              </div>

              {/* Today's Medications */}
              <div className="mb-8">
                <h3 className="text-lg font-medium text-blue-700 dark:text-blue-300 mb-4 flex items-center gap-2">
                  <Calendar size={18} /> Today's Schedule
                </h3>
                {appState.medications.length > 0 ? (
                  <ul className="space-y-3">
                    {appState.medications.map((med, index) => (
                      <motion.li
                        key={med.id}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: index * 0.1 }}
                        className="flex items-center justify-between bg-blue-50 dark:bg-blue-900/40 px-4 py-3 rounded-lg shadow border border-blue-100 dark:border-blue-800/50"
                      >
                        <div>
                          <span className="font-medium text-blue-800 dark:text-blue-200">
                            {med.name}
                          </span>
                          <span className="text-sm text-blue-600 dark:text-blue-300 ml-2">
                            {med.dosage}
                          </span>
                        </div>
                        <div className="flex items-center gap-4">
                          <span className="text-sm font-medium text-gray-600 dark:text-gray-300">
                            {med.time}
                          </span>
                          <span className="text-xs px-2 py-1 bg-blue-100 dark:bg-blue-800 text-blue-800 dark:text-blue-200 rounded-full">
                            {med.frequency}
                          </span>
                        </div>
                        <div className="flex gap-2">
                          <button
                            onClick={() => editMedication(med)}
                            className="p-1 rounded-md hover:bg-blue-100 dark:hover:bg-blue-800/50 text-blue-600 dark:text-blue-300"
                            aria-label="Edit medication"
                          >
                            <Pencil className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => deleteMedication(med.id)}
                            className="p-1 rounded-md hover:bg-red-100 dark:hover:bg-red-900/50 text-red-600 dark:text-red-300"
                            aria-label="Delete medication"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </motion.li>
                    ))}
                  </ul>
                ) : (
                  <div className="bg-blue-50 dark:bg-blue-900/20 px-4 py-6 rounded-lg border border-dashed border-blue-200 dark:border-blue-800/50 text-center">
                    <p className="text-blue-600 dark:text-blue-300">No medications added yet</p>
                  </div>
                )}
              </div>

              {/* Reminders */}
              <div>
                <h3 className="text-lg font-medium text-blue-700 dark:text-blue-300 mb-4 flex items-center gap-2">
                  <Bell size={18} /> Upcoming Reminders
                </h3>
                {appState.reminders.length > 0 ? (
                  <div className="space-y-3">
                    {(showAllReminders ? appState.reminders : appState.reminders.slice(0, 3)).map((reminder: ReminderResponse) => {
                      const medication = appState.medications.find(
                        med => med.id === reminder.medicationId
                      );
                      return (
                        <div
                          key={reminder.id}
                          className="bg-yellow-50 dark:bg-yellow-900/20 px-4 py-3 rounded-lg border border-yellow-200 dark:border-yellow-800/50"
                        >
                          <p className="text-yellow-700 dark:text-yellow-300 font-medium">
                            {reminder.title} at {reminder.schedule || (reminder as any).reminder_time || 'No time set'}
                          </p>
                          {medication && (
                            <p className="text-yellow-600 dark:text-yellow-400 text-sm mt-1">
                              {medication.dosage} of {medication.name}
                            </p>
                          )}
                          {reminder.description && (
                            <p className="text-yellow-600 dark:text-yellow-400 text-xs mt-1">
                              {reminder.description}
                            </p>
                          )}
                        </div>
                      );
                    })}
                    {appState.reminders.length > 3 && (
                      <button
                        onClick={() => setShowAllReminders(!showAllReminders)}
                        className="w-full text-gray-500 dark:text-gray-400 text-sm text-center py-2 hover:text-gray-700 dark:hover:text-gray-300 transition-colors duration-200 border border-dashed border-gray-300 dark:border-gray-600 rounded-lg hover:border-gray-400 dark:hover:border-gray-500"
                      >
                        {showAllReminders ? (
                          <>Show less reminders</>
                        ) : (
                          <>+{appState.reminders.length - 3} more reminders (click to view)</>
                        )}
                      </button>
                    )}
                  </div>
                ) : (
                  <div className="bg-yellow-50 dark:bg-yellow-900/20 px-4 py-3 rounded-lg border border-dashed border-yellow-200 dark:border-yellow-800/50 text-center">
                    <p className="text-yellow-600 dark:text-yellow-300">No reminders set</p>
                  </div>
                )}
              </div>
            </motion.section>
          )}
        </AnimatePresence>

        {/* Health Monitoring Panel */}
        <AnimatePresence>
          {activeTab === 'health' && (
            <motion.section
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.2 }}
              className="flex-1 flex flex-col p-6 overflow-y-auto"
            >
              <h2 className="text-xl font-semibold text-purple-700 dark:text-purple-300 mb-6">
                Health Monitoring
              </h2>

              {/* Symptom Checker */}
              <div className="mb-8">
                <h3 className="text-lg font-medium text-purple-700 dark:text-purple-300 mb-4">
                  Medical Symptom Analysis
                </h3>
                <div className="bg-purple-50 dark:bg-purple-900/20 p-4 rounded-lg border border-purple-100 dark:border-purple-800/50">
                  <textarea
                    value={symptomCheck.symptoms}
                    onChange={e => setSymptomCheck(prev => ({ ...prev, symptoms: e.target.value }))}
                    placeholder="Describe your symptoms completely (e.g., I have been experiencing depression for 3 days, headache all day, and leg pain. Please suggest medications and treatment.)"
                    className="w-full px-4 py-3 rounded-lg border border-purple-200 dark:border-purple-700/50 bg-white dark:bg-slate-800 text-gray-800 dark:text-gray-200 mb-4"
                    rows={4}
                  />
                  <div className="flex gap-4 mb-4 flex-wrap">
                    <div className="flex flex-col">
                      <label className="text-sm font-medium text-purple-700 dark:text-purple-300 mb-1">
                        Severity
                      </label>
                      <select
                        value={symptomCheck.severity}
                        onChange={e =>
                          setSymptomCheck(prev => ({ ...prev, severity: e.target.value as any }))
                        }
                        className="px-4 py-2 rounded-lg border border-purple-200 dark:border-purple-700/50 bg-white dark:bg-slate-800 text-gray-800 dark:text-gray-200"
                      >
                        <option value="mild">Mild</option>
                        <option value="moderate">Moderate</option>
                        <option value="severe">Severe</option>
                      </select>
                    </div>
                    <div className="flex flex-col flex-1">
                      <label className="text-sm font-medium text-purple-700 dark:text-purple-300 mb-1">
                        Duration
                      </label>
                      <input
                        type="text"
                        value={symptomCheck.duration}
                        onChange={e =>
                          setSymptomCheck(prev => ({ ...prev, duration: e.target.value }))
                        }
                        placeholder="e.g., 2 hours, 3 days, 1 week"
                        className="px-4 py-2 rounded-lg border border-purple-200 dark:border-purple-700/50 bg-white dark:bg-slate-800 text-gray-800 dark:text-gray-200"
                      />
                    </div>
                  </div>
                  <button
                    onClick={checkSymptoms}
                    disabled={!symptomCheck.symptoms.trim()}
                    className="px-6 py-3 bg-purple-500 text-white rounded-lg shadow hover:bg-purple-600 transition-all disabled:opacity-50 disabled:cursor-not-allowed font-medium"
                  >
                    💊 Get Medical Analysis & Prescriptions
                  </button>
                  {symptomResult && (
                    <div className="mt-6 p-6 bg-white dark:bg-slate-800 rounded-lg border border-purple-100 dark:border-purple-800/50 shadow-sm">
                      <h4 className="font-semibold text-purple-700 dark:text-purple-300 mb-4 text-lg">
                        🏥 Medical Analysis & Treatment Plan
                      </h4>
                      <div className="prose dark:prose-invert max-w-none">
                        <div className="text-gray-700 dark:text-gray-300 whitespace-pre-wrap leading-relaxed text-sm">
                          {symptomResult.analysis}
                        </div>
                      </div>
                      {symptomResult.possible_causes && (
                        <div className="mt-4 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                          <h5 className="font-medium text-blue-700 dark:text-blue-300 mb-2 flex items-center gap-2">
                            🔍 Diagnostic Considerations:
                          </h5>
                          <ul className="list-disc pl-5 text-gray-700 dark:text-gray-300 space-y-1">
                            {symptomResult.possible_causes.map((cause, i) => (
                              <li key={i} className="text-sm">
                                {cause}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                      {symptomResult.recommendations && (
                        <div className="mt-4 p-4 bg-green-50 dark:bg-green-900/20 rounded-lg">
                          <h5 className="font-medium text-green-700 dark:text-green-300 mb-2 flex items-center gap-2">
                            � Treatment Recommendations:
                          </h5>
                          <ul className="list-disc pl-5 text-gray-700 dark:text-gray-300 space-y-1">
                            {symptomResult.recommendations.map((rec, i) => (
                              <li key={i} className="text-sm">
                                {rec}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                      <div className="mt-4 p-3 bg-red-50 dark:bg-red-900/20 rounded-lg border-l-4 border-red-400">
                        <p className="text-red-800 dark:text-red-200 text-xs font-medium">
                          ⚠️ <strong>Medical Disclaimer:</strong> This analysis provides general
                          medical guidance based on reported symptoms. Always consult with a
                          licensed healthcare provider for proper diagnosis, prescription
                          verification, and personalized treatment plans. In case of emergency,
                          contact emergency services immediately.
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Health Tips */}
              <div>
                <h3 className="text-lg font-medium text-green-700 dark:text-green-300 mb-4">
                  Daily Health Tips
                </h3>
                <ul className="space-y-3">
                  {appState.healthTips.map((tip, index) => (
                    <motion.li
                      key={index}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.1 }}
                      className="bg-green-50 dark:bg-green-900/20 px-4 py-3 rounded-lg border border-green-100 dark:border-green-800/50"
                    >
                      <p className="text-green-700 dark:text-green-300">{tip.tip}</p>
                    </motion.li>
                  ))}
                </ul>
              </div>
            </motion.section>
          )}
        </AnimatePresence>

        {/* Settings Panel */}
        <AnimatePresence>
          {activeTab === 'settings' && (
            <motion.section
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.2 }}
              className="flex-1 flex flex-col p-6 overflow-y-auto"
            >
              <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-6 flex items-center gap-3">
                <Settings className="w-6 h-6 text-gray-600 dark:text-gray-400" />
                Notification Settings
              </h2>
              <div className="space-y-6">
                <div className="bg-green-50 dark:bg-green-900/20 p-4 rounded-lg border border-green-200 dark:border-green-800">
                  <h3 className="text-lg font-semibold text-green-800 dark:text-green-200 mb-2">
                    Reminder Notifications
                  </h3>
                  <p className="text-green-700 dark:text-green-300">
                    ✅ Notifications are always active and monitoring for medication reminders.
                  </p>
                </div>
                <NotificationTest />
              </div>
            </motion.section>
          )}
        </AnimatePresence>

        {/* Chat Panel */}
       <AnimatePresence>
  {activeTab === 'chat' && (
    <motion.section
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      transition={{ duration: 0.2 }}
      className="flex-1 flex flex-col p-6 overflow-hidden"
    >
      <h2 className="text-xl font-semibold text-green-700 dark:text-green-300 mb-6">Chat with Ava</h2>

      {/* Chat Messages */}
      <div 
        ref={(node) => {
          if (node) {
            // This will keep the scroll at the bottom when new messages arrive
            node.scrollTop = node.scrollHeight;
          }
        }}
        className="flex-1 overflow-y-auto mb-6 custom-scrollbar"
      >
        <div className="space-y-4">
          {appState.messages.length > 0 ? (
            appState.messages.map((message, index) => (
              <motion.div
                key={message.id}
                initial={{ opacity: 0, y: 10, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ type: "spring", stiffness: 400, damping: 25, delay: index * 0.05 }}
                className={`flex ${message.isUser ? 'justify-end' : 'justify-start'}`}
              >
                <motion.div
                  whileHover={{ scale: 1.02, y: -2 }}
                  className={`max-w-[80%] rounded-2xl px-6 py-4 shadow-lg backdrop-blur-sm border transition-all ${message.isUser ? 'bg-gradient-to-br from-blue-500 to-blue-600 text-white border-blue-400/30' : 'bg-white/95 dark:bg-slate-800/95 text-gray-800 dark:text-gray-200 border-gray-200/50 dark:border-slate-700/50'}`}
                >
                  <p className="text-sm leading-relaxed whitespace-pre-wrap break-words">{message.text}</p>
                  <div className="flex items-center justify-between mt-3 gap-3">
                    <span className={`text-xs opacity-75 font-medium ${message.isUser ? 'text-blue-100' : 'text-gray-500 dark:text-gray-400'}`}>
                      {new Date(message.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                    {!message.isUser && message.audioUrl && !appState.isMuted && (
                      <div className="flex items-center gap-2">
                        <motion.button
                          whileHover={{ scale: 1.15 }}
                          whileTap={{ scale: 0.9 }}
                          onClick={() => {
                            const isCurrentMessage = appState.currentAudioUrl === message.audioUrl;
                            if (appState.isPaused && isCurrentMessage) {
                              handlePauseResumeAudio();
                            } else if (appState.isSpeaking && isCurrentMessage) {
                              handlePauseResumeAudio();
                            } else {
                              handlePlayAudio(message.audioUrl!);
                            }
                          }}
                          className={`p-2 rounded-full text-white transition-colors shadow-lg hover:shadow-xl ${
                            appState.currentAudioUrl === message.audioUrl && appState.isPaused 
                              ? 'bg-yellow-500 hover:bg-yellow-600' 
                              : appState.currentAudioUrl === message.audioUrl && appState.isSpeaking 
                                ? 'bg-purple-500 hover:bg-purple-600' 
                                : 'bg-blue-500 hover:bg-blue-600'
                            }`}
                          title={
                            appState.currentAudioUrl === message.audioUrl && appState.isPaused 
                              ? "Resume audio" 
                              : appState.currentAudioUrl === message.audioUrl && appState.isSpeaking 
                                ? "Pause audio" 
                                : "Play audio response"
                          }
                        >
                          {appState.currentAudioUrl === message.audioUrl && appState.isPaused ? (
                            <Play className="w-4 h-4" />
                          ) : appState.currentAudioUrl === message.audioUrl && appState.isSpeaking ? (
                            <motion.div animate={{ scale: [1, 1.1, 1] }} transition={{ duration: 0.8, repeat: Infinity }}>
                              <Pause className="w-4 h-4" />
                            </motion.div>
                          ) : (
                            <Volume2 className="w-4 h-4" />
                          )}
                        </motion.button>
                        {appState.currentAudioUrl === message.audioUrl && (appState.isSpeaking || appState.isPaused) && (
                          <motion.button
                            initial={{ scale: 0, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0, opacity: 0 }}
                            whileHover={{ scale: 1.1 }}
                            whileTap={{ scale: 0.9 }}
                            onClick={handleStopAudio}
                            className="p-1.5 rounded-full bg-red-500 hover:bg-red-600 text-white transition-colors shadow-lg hover:shadow-xl"
                            title="Stop audio"
                          >
                            <Square className="w-3 h-3" />
                          </motion.button>
                        )}
                      </div>
                    )}
                    {!message.isUser && message.audioUrl && appState.isMuted && (
                      <div className="flex items-center gap-2">
                        <motion.button
                          whileHover={{ scale: 1.15 }}
                          whileTap={{ scale: 0.9 }}
                          onClick={() => {
                            alert('Audio is muted. Click the bell icon in the header to unmute and play audio.');
                          }}
                          className="p-2 rounded-full text-white bg-gray-400 hover:bg-gray-500 transition-colors shadow-lg hover:shadow-xl"
                          title="Audio is muted - click bell icon to unmute"
                        >
                          <BellOff className="w-4 h-4" />
                        </motion.button>
                      </div>
                    )}
                  </div>
                </motion.div>
              </motion.div>
            ))
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-center py-12">
              <Bot className="w-16 h-16  mb-4 opacity-80 text-blue-700 dark:text-blue-300" />
              <p className="text-gray-500 dark:text-gray-400">Hi there! I'm Ava, your health assistant. How can I help you today?</p>
            </div>
          )}
        </div>
      </div>

      {/* Voice Interface */}
      <div className="flex flex-col items-center">
        <VoiceInterface
          onStartListening={startListening}
          onStopListening={stopListening}
          onPauseAudio={handlePauseResumeAudio}
          onResumeAudio={handlePauseResumeAudio}
          isDisabled={appState.status === 'error'}
          isListening={appState.isListening}
          isSpeaking={appState.isSpeaking}
          isPaused={appState.isPaused}
          status={appState.status}
        />
        <StatusIndicator status={appState.status} />
      </div>
    </motion.section>
  )}
</AnimatePresence>

        {/* Add/Edit Medication Modal */}
        <dialog
          id="add-medication-modal"
          className="bg-white dark:bg-slate-900 rounded-lg shadow-xl p-6 w-full max-w-md"
        >
          <h3 className="text-xl font-semibold text-blue-700 dark:text-blue-300 mb-4">
            {editingMedicationId ? 'Edit Medication' : 'Add New Medication'}
          </h3>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Medication Name
              </label>
              <input
                type="text"
                value={newMedication.name}
                onChange={e => setNewMedication(prev => ({ ...prev, name: e.target.value }))}
                className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-gray-800 dark:text-gray-200"
                placeholder="e.g., Metformin"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Dosage
              </label>
              <input
                type="text"
                value={newMedication.dosage}
                onChange={e => setNewMedication(prev => ({ ...prev, dosage: e.target.value }))}
                className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-gray-800 dark:text-gray-200"
                placeholder="e.g., 500mg"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Frequency
              </label>
              <select
                value={newMedication.frequency}
                onChange={e => setNewMedication(prev => ({ ...prev, frequency: e.target.value }))}
                className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-gray-800 dark:text-gray-200"
              >
                <option value="Once daily">Once daily</option>
                <option value="Twice daily">Twice daily</option>
                <option value="Three times daily">Three times daily</option>
                <option value="As needed">As needed</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Time
              </label>
              <input
                type="time"
                value={newMedication.time}
                onChange={e => setNewMedication(prev => ({ ...prev, time: e.target.value }))}
                className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-gray-800 dark:text-gray-200"
              />
            </div>
          </div>
          <div className="flex justify-end gap-3 mt-6">
            <button
              onClick={closeMedicationModal}
              className="px-4 py-2 bg-gray-200 dark:bg-slate-700 text-gray-800 dark:text-gray-200 rounded-lg hover:bg-gray-300 dark:hover:bg-slate-600 transition-all"
            >
              Cancel
            </button>
            <button
              onClick={addMedication}
              disabled={!newMedication.name || !newMedication.dosage || !newMedication.time}
              className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {editingMedicationId ? 'Update Medication' : 'Add Medication'}
            </button>
          </div>
        </dialog>

        {/* Add Emergency Contact Modal */}
        <dialog
          id="add-contact-modal"
          className="bg-white dark:bg-slate-900 rounded-lg shadow-xl p-6 w-full max-w-md"
        >
          <h3 className="text-xl font-semibold text-blue-700 dark:text-blue-300 mb-4">
            Add Emergency Contact
          </h3>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Name
              </label>
              <input
                type="text"
                value={newEmergencyContact.name}
                onChange={e => setNewEmergencyContact(prev => ({ ...prev, name: e.target.value }))}
                className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-gray-800 dark:text-gray-200"
                placeholder="e.g., Dr. Smith"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Phone Number
              </label>
              <input
                type="tel"
                value={newEmergencyContact.phone}
                onChange={e => setNewEmergencyContact(prev => ({ ...prev, phone: e.target.value }))}
                className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-gray-800 dark:text-gray-200"
                placeholder="e.g., 555-123-4567"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Relationship
              </label>
              <select
                value={newEmergencyContact.relationship}
                onChange={e =>
                  setNewEmergencyContact(prev => ({ ...prev, relationship: e.target.value }))
                }
                className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-gray-800 dark:text-gray-200"
              >
                <option value="Doctor">Doctor</option>
                <option value="Family">Family</option>
                <option value="Friend">Friend</option>
                <option value="Caregiver">Caregiver</option>
              </select>
            </div>
            <div className="flex items-center">
              <input
                type="checkbox"
                id="is-primary"
                checked={newEmergencyContact.is_primary}
                onChange={e =>
                  setNewEmergencyContact(prev => ({ ...prev, is_primary: e.target.checked }))
                }
                className="mr-2"
              />
              <label htmlFor="is-primary" className="text-sm text-gray-700 dark:text-gray-300">
                Primary Contact
              </label>
            </div>
          </div>
          <div className="flex justify-end gap-3 mt-6">
            <button
              onClick={() =>
                (document.getElementById('add-contact-modal') as HTMLDialogElement)?.close()
              }
              className="px-4 py-2 bg-gray-200 dark:bg-slate-700 text-gray-800 dark:text-gray-200 rounded-lg hover:bg-gray-300 dark:hover:bg-slate-600 transition-all"
            >
              Cancel
            </button>
            <button
              onClick={addEmergencyContact}
              disabled={!newEmergencyContact.name || !newEmergencyContact.phone}
              className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Add Contact
            </button>
          </div>
        </dialog>

        {/* Emergency Modal */}
        {showEmergencyModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-white dark:bg-slate-900 rounded-lg shadow-xl p-6 w-full max-w-md">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-xl font-semibold text-red-600 dark:text-red-400">
                  Emergency Contacts
                </h3>
                <button
                  onClick={() =>
                    (document.getElementById('add-contact-modal') as HTMLDialogElement)?.showModal()
                  }
                  className="flex items-center gap-1 px-3 py-1 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-all"
                >
                  <Plus size={16} /> Add
                </button>
              </div>
              <p className="text-gray-700 dark:text-gray-300 mb-4">Select a contact to call:</p>
              <ul className="space-y-2 mb-6 max-h-60 overflow-y-auto">
                {appState.emergencyContacts.length > 0 ? (
                  appState.emergencyContacts.map(contact => (
                    <li
                      key={contact.id}
                      className="flex justify-between items-center bg-red-50 dark:bg-red-900/20 px-4 py-3 rounded-lg border border-red-100 dark:border-red-800/50"
                    >
                      <div>
                        <p className="font-medium text-red-700 dark:text-red-300">
                          {contact.name}{' '}
                          {contact.is_primary && (
                            <span className="text-xs bg-red-100 dark:bg-red-800 text-red-800 dark:text-red-200 px-2 py-1 rounded-full ml-2">
                              Primary
                            </span>
                          )}
                        </p>
                        <p className="text-sm text-red-600 dark:text-red-400">{contact.phone}</p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                          {contact.relationship}
                        </p>
                      </div>
                      <button
                        onClick={() => triggerEmergency(contact.id)}
                        className="px-3 py-1 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-all"
                      >
                        Call
                      </button>
                    </li>
                  ))
                ) : (
                  <div className="bg-red-50 dark:bg-red-900/20 px-4 py-3 rounded-lg border border-dashed border-red-200 dark:border-red-800/50 text-center">
                    <p className="text-red-600 dark:text-red-300">No emergency contacts added</p>
                  </div>
                )}
              </ul>
              <div className="flex justify-end">
                <button
                  onClick={() => setShowEmergencyModal(false)}
                  className="px-4 py-2 bg-gray-200 dark:bg-slate-700 text-gray-800 dark:text-gray-200 rounded-lg hover:bg-gray-300 dark:hover:bg-slate-600 transition-all"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

export default Dashboard;
