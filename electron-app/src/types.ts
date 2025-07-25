// Type definitions for the Ava AI Assistant

// API Response Types
export interface APIResponse<T = any> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
}

// Message Types
export interface ChatMessage {
  id: string;
  type: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  audioUrl?: string;
}

export interface Message {
  id: string;
  text: string;
  isUser: boolean;
  timestamp: number;
  audioUrl?: string;
}

// API Request Types
export interface VoiceRequest {
  timeout?: number;
  phrase_time_limit?: number;
}

export interface GeminiRequest {
  text: string;
  conversation_history?: any[];
}

export interface TTSRequest {
  text: string;
  voice_id?: string;
  style?: string;
  speed?: number;
}

// API Response Data Types
export interface VoiceResponse {
  text: string;
  duration: number;
}

export interface GeminiResponseData {
  response: string;
  input: string;
}

export interface TTSResponse {
  audio_url?: string;
  audio_path?: string;
  filename?: string;
  text: string;
  fallback?: boolean;
  message?: string;
}

export interface ServiceStatus {
  voice_input: boolean;
  gemini_ai: boolean;
  murf_tts: boolean;
}

// Medication Management Types
export interface Medication {
  name: string;
  dosage: string;
  frequency: string;  // e.g., "Once daily", "Twice daily", "Every 4 hours"
  time: string;       // e.g., "08:00", "20:00"
  notes?: string;
}

export interface MedicationResponse extends Medication {
  id: string;
  last_taken?: Date;
  is_active?: boolean;
}

export interface MedicationListResponse {
  medications: MedicationResponse[];
}

// Reminder Types
export interface Reminder {
  title: string;
  description?: string;
  schedule: string;  
  medicationId: string;
  is_recurring?: boolean;
  days_of_week?: string[];  // ["Monday", "Wednesday", "Friday"]
}

export interface ReminderResponse extends Reminder {
  id: string;
  created_at?: Date;
}

export interface ReminderListResponse {
  reminders: ReminderResponse[];
}

// Emergency Contact Types
export interface EmergencyContact {
  name: string;
  phone: string;
  relationship: string;
  is_primary?: boolean;
}

// export interface EmergencyContactResponse extends EmergencyContact {
//   id: string;
// }
export interface EmergencyContactResponse {
  id: string;
  name: string;
  phone: string;
  relationship: string;
  is_primary: boolean;
}

export interface EmergencyContactListResponse {
  contacts: EmergencyContactResponse[];
}

// Health Data Types
export interface SymptomCheckRequest {
  symptoms: string;
  severity?: 'mild' | 'moderate' | 'severe';
  duration?: string;  // e.g., "2 hours", "3 days"
}

export interface SymptomCheckResponse {
  symptoms: string;
  analysis: string;
  timestamp: string;
  possible_causes?: string[];
  recommendations?: string[];
}

export interface HealthTip {
  tip: string;
}

export interface HealthTipsResponse {
  tips: HealthTip[];
}

// Legacy response types for compatibility
export interface VoiceRecognitionResponse {
  success: boolean;
  text?: string;
  error?: string;
}

export interface GeminiResponse {
  success: boolean;
  response?: string;
  error?: string;
}

export interface MurfTTSResponse {
  success: boolean;
  audioUrl?: string;
  audioPath?: string;
  error?: string;
}

// App State Types
export type AppStatus = 'idle' | 'listening' | 'processing' | 'speaking' | 'error';

export interface HeaderState {
  isMuted: boolean;
  isDarkMode: boolean;
}

export interface AppState {
  messages: Message[];
  isListening: boolean;
  isSpeaking: boolean;
  isPaused: boolean;
  isMuted: boolean;
  isDarkMode: boolean;
  medications: MedicationResponse[];
  reminders: ReminderResponse[];
  status: AppStatus;
  currentAudio?: HTMLAudioElement;
  currentAudioUrl?: string;
  healthTips: HealthTip[];
  emergencyContacts: EmergencyContactResponse[];
}

export interface ApiEndpoints {
  voice: string;
  gemini: string;
  murf: string;
  audio: string;
  medications: string;
  reminders: string;
  emergencyContacts: string;
  symptomCheck: string;
  healthTips: string;
}

export interface ElectronAPI {
  getAppVersion: () => Promise<string>;
  getAppName: () => Promise<string>;
  minimizeWindow: () => Promise<void>;
  maximizeWindow: () => Promise<void>;
  closeWindow: () => Promise<void>;
  focusWindow: () => Promise<void>;
  requestNotificationPermission: () => Promise<{ success: boolean; permission?: string; error?: string }>;
  showNotification: (options: ElectronNotificationOptions) => Promise<{ success: boolean; error?: string }>;
  onNotificationClicked: (callback: (data: any) => void) => () => void;
  onNotificationAction: (callback: (data: any) => void) => () => void;
  platform: string;
}

export interface ElectronNotificationOptions {
  title: string;
  body: string;
  icon?: string;
  silent?: boolean;
  urgent?: boolean;
  timeoutType?: 'default' | 'never';
  closeButtonText?: string;
  actions?: Array<{
    action: string;
    title: string;
  }>;
}

export interface Versions {
  node: string;
  chrome: string;
  electron: string;
}

declare global {
  interface Window {
    electronAPI: ElectronAPI;
    versions: Versions;
  }
}

// Utility Types
export interface TimeRange {
  start: string;  // Format: "HH:MM"
  end: string;    // Format: "HH:MM"
}

export interface DaySchedule {
  [day: string]: TimeRange[];  // e.g., "Monday": [{start: "08:00", end: "12:00"}]
}

// For medication schedule visualization
export interface MedicationSchedule {
  medication_id: string;
  medication_name: string;
  times: string[];  // Array of times in "HH:MM" format
  days: string[];   // Days of week this applies to
}