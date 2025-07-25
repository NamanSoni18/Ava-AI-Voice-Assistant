import { createClient } from '@supabase/supabase-js'

// Supabase configuration from environment variables
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://nmqzuwzpqekdxefzmvzf.supabase.co'
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5tcXp1d3pwcWVrZHhlZnptdnpmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTM0NDM2MDQsImV4cCI6MjA2OTAxOTYwNH0.EHvO6nidzLjJIk0O07bZqxTNR_gh2Sxg1HiUsrMuAUY'

// Default user ID from environment
const DEFAULT_USER_ID = import.meta.env.VITE_DEFAULT_USER_ID || '00000000-0000-0000-0000-000000000001'

// Create Supabase client
export const supabase = createClient(supabaseUrl, supabaseAnonKey)

// Database service for direct Supabase operations
export class SupabaseService {
  static async checkConnection() {
    try {
      const { data, error } = await supabase
        .from('users')
        .select('id')
        .limit(1)
      
      if (error) throw error
      return { status: 'connected', data }
    } catch (error: any) {
      console.error('Supabase connection error:', error)
      return { status: 'error', error: error?.message || 'Unknown error' }
    }
  }

  // Helper function to format time consistently - ensures HH:MM format
  private static formatTimeToHHMM(timeString: string): string {
    if (!timeString) return timeString;
    
    // Handle common time formats
    try {
      // If it's already in HH:MM format, return as is
      if (timeString.match(/^\d{1,2}:\d{2}$/)) {
        const [hours, minutes] = timeString.split(':');
        const h = parseInt(hours, 10).toString().padStart(2, '0');
        const m = parseInt(minutes, 10).toString().padStart(2, '0');
        return `${h}:${m}`;
      }
      
      // If it includes seconds (HH:MM:SS), truncate to HH:MM
      if (timeString.match(/^\d{1,2}:\d{2}:\d{2}$/)) {
        const [hours, minutes] = timeString.split(':');
        const h = parseInt(hours, 10).toString().padStart(2, '0');
        const m = parseInt(minutes, 10).toString().padStart(2, '0');
        return `${h}:${m}`;
      }
      
      // If it's a Date object or timestamp, extract time
      if (timeString.includes('T') || timeString.includes(' ')) {
        const date = new Date(timeString);
        if (!isNaN(date.getTime())) {
          const h = date.getHours().toString().padStart(2, '0');
          const m = date.getMinutes().toString().padStart(2, '0');
          return `${h}:${m}`;
        }
      }
      
      return timeString; // Return original if no pattern matches
    } catch (error) {
      console.warn('Time formatting error for:', timeString, error);
      return timeString; // Return original if parsing fails
    }
  }

  // Medications
  static async getMedications(userId: string = DEFAULT_USER_ID) {
    try {
      const { data, error } = await supabase
        .from('medications')
        .select('*')
        .eq('user_id', userId)
        .neq('is_active', false) // Exclude inactive medications
        .order('created_at', { ascending: false })
      
      if (error) throw error
      
      // Map database fields to frontend format with consistent time formatting
      const mappedData = (data || []).map(medication => ({
        ...medication,
        time: this.formatTimeToHHMM(medication.medication_time) // Map and format 'medication_time' to 'time'
      }));
      
      return mappedData;
    } catch (error) {
      console.error('Error fetching medications:', error)
      throw error
    }
  }

  static async addMedication(medication: any, userId: string = DEFAULT_USER_ID) {
    try {
      // Map frontend fields to database fields
      const medicationData = {
        ...medication,
        user_id: userId,
        medication_time: medication.time, // Map 'time' to 'medication_time'
      };
      
      // Remove the frontend 'time' field to avoid conflicts
      delete medicationData.time;
      
      const { data, error } = await supabase
        .from('medications')
        .insert([medicationData])
        .select()
        .single()
      
      if (error) throw error
      
      // Create automatic reminder for this medication
      await this.createMedicationReminder(data, userId);
      
      // Map back to frontend format with consistent time formatting
      return {
        ...data,
        time: this.formatTimeToHHMM(data.medication_time)
      };
    } catch (error) {
      console.error('Error adding medication:', error)
      throw error
    }
  }

  static async updateMedication(id: string, medication: any) {
    try {
      // Map frontend fields to database fields
      const medicationData = {
        ...medication,
        medication_time: medication.time, // Map 'time' to 'medication_time'
        updated_at: new Date().toISOString()
      };
      
      // Remove the frontend 'time' field to avoid conflicts
      delete medicationData.time;
      
      const { data, error } = await supabase
        .from('medications')
        .update(medicationData)
        .eq('id', id)
        .select()
        .single()
      
      if (error) throw error
      
      // CRITICAL: Update or create medication reminder with new timing
      await this.updateMedicationReminder(data);
      
      // Map back to frontend format with consistent time formatting
      return {
        ...data,
        time: this.formatTimeToHHMM(data.medication_time)
      };
    } catch (error) {
      console.error('Error updating medication:', error)
      throw error
    }
  }

  // Helper method to create automatic medication reminder
  private static async createMedicationReminder(medication: any, userId: string) {
    try {
      const reminderData = {
        user_id: userId,
        medication_id: medication.id,
        title: `${medication.name} Reminder`,
        description: `Time to take your ${medication.dosage} of ${medication.name}`,
        reminder_time: medication.medication_time,
        is_recurring: true,
        days_of_week: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'],
        reminder_type: 'medication',
        is_active: medication.is_active !== false
      };

      const { data, error } = await supabase
        .from('reminders')
        .insert([reminderData])
        .select()
        .single();

      if (error) {
        console.warn('Failed to create automatic medication reminder:', error);
      } else {
        console.log('Created automatic medication reminder:', data);
      }
    } catch (error) {
      console.warn('Error creating medication reminder:', error);
    }
  }

  // Helper method to update medication reminder
  private static async updateMedicationReminder(medication: any) {
    try {
      // Find existing medication reminder
      const { data: existingReminders, error: findError } = await supabase
        .from('reminders')
        .select('*')
        .eq('medication_id', medication.id)
        .eq('reminder_type', 'medication');

      if (findError) {
        console.warn('Error finding existing reminder:', findError);
        return;
      }

      if (existingReminders && existingReminders.length > 0) {
        // Update ALL existing reminders for this medication
        for (const existingReminder of existingReminders) {
          const reminderData = {
            title: `${medication.name} Reminder`,
            description: `Time to take your ${medication.dosage} of ${medication.name}`,
            reminder_time: medication.medication_time,
            is_active: medication.is_active !== false,
            last_triggered: null, // Reset trigger history when medication is edited
            snooze_until: null,   // Clear any snooze state when medication is edited
            updated_at: new Date().toISOString()
          };

          const { error: updateError } = await supabase
            .from('reminders')
            .update(reminderData)
            .eq('id', existingReminder.id);

          if (updateError) {
            console.warn('Failed to update medication reminder:', updateError);
          } else {
            console.log('Updated medication reminder for:', medication.name, 'with time:', medication.medication_time);
          }
        }
      } else {
        // Create new reminder if none exists
        await this.createMedicationReminder(medication, medication.user_id);
      }
    } catch (error) {
      console.warn('Error updating medication reminder:', error);
    }
  }

  static async deleteMedication(id: string) {
    try {
      // First, delete all associated reminders for this medication
      const { error: reminderError } = await supabase
        .from('reminders')
        .delete()
        .eq('medication_id', id);

      if (reminderError) {
        console.warn('Error deleting medication reminders:', reminderError);
        // Continue with medication deletion even if reminder deletion fails
      }

      // Then delete the medication itself
      const { error } = await supabase
        .from('medications')
        .delete()
        .eq('id', id)
      
      if (error) throw error
      
      console.log('Successfully deleted medication and associated reminders for ID:', id);
    } catch (error) {
      console.error('Error deleting medication:', error)
      throw error
    }
  }

  // Reminders
  static async getReminders(userId: string = DEFAULT_USER_ID) {
    try {
      const { data, error } = await supabase
        .from('reminders')
        .select(`
          *,
          medications!inner (
            name,
            dosage,
            is_active
          )
        `)
        .eq('user_id', userId)
        .eq('medications.is_active', true) // Only get reminders for active medications
        .order('reminder_time', { ascending: true })
      
      if (error) throw error
      
      // Map database fields to frontend format with consistent time formatting
      const mappedData = (data || []).map(reminder => ({
        ...reminder,
        schedule: this.formatTimeToHHMM(reminder.reminder_time), // Map and format 'reminder_time' to 'schedule'
        medicationId: reminder.medication_id // Map 'medication_id' to 'medicationId'
      }));
      
      return mappedData;
    } catch (error) {
      console.error('Error fetching reminders:', error)
      throw error
    }
  }

  static async addReminder(reminder: any, userId: string = DEFAULT_USER_ID) {
    try {
      const { data, error } = await supabase
        .from('reminders')
        .insert([{ ...reminder, user_id: userId }])
        .select()
        .single()
      
      if (error) throw error
      return data
    } catch (error) {
      console.error('Error adding reminder:', error)
      throw error
    }
  }

  static async updateReminder(id: string, reminder: any) {
    try {
      const { data, error } = await supabase
        .from('reminders')
        .update(reminder)
        .eq('id', id)
        .select()
        .single()
      
      if (error) throw error
      return data
    } catch (error) {
      console.error('Error updating reminder:', error)
      throw error
    }
  }

  static async deleteReminder(id: string) {
    try {
      const { error } = await supabase
        .from('reminders')
        .delete()
        .eq('id', id)
      
      if (error) throw error
    } catch (error) {
      console.error('Error deleting reminder:', error)
      throw error
    }
  }

  // Medication Logs
  static async getMedicationLogs(userId: string = DEFAULT_USER_ID) {
    try {
      const { data, error } = await supabase
        .from('medication_logs')
        .select(`
          *,
          medications (
            name,
            dosage
          )
        `)
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
      
      if (error) throw error
      return data || []
    } catch (error) {
      console.error('Error fetching medication logs:', error)
      throw error
    }
  }

  static async addMedicationLog(log: any, userId: string = DEFAULT_USER_ID) {
    try {
      const { data, error } = await supabase
        .from('medication_logs')
        .insert([{ ...log, user_id: userId }])
        .select()
        .single()
      
      if (error) throw error
      return data
    } catch (error) {
      console.error('Error adding medication log:', error)
      throw error
    }
  }

  // Emergency Contacts
  static async getEmergencyContacts(userId: string = DEFAULT_USER_ID) {
    try {
      const { data, error } = await supabase
        .from('emergency_contacts')
        .select('*')
        .eq('user_id', userId)
        .order('is_primary', { ascending: false })
      
      if (error) throw error
      return data || []
    } catch (error) {
      console.error('Error fetching emergency contacts:', error)
      throw error
    }
  }

  static async addEmergencyContact(contact: any, userId: string = DEFAULT_USER_ID) {
    try {
      const { data, error } = await supabase
        .from('emergency_contacts')
        .insert([{ ...contact, user_id: userId }])
        .select()
        .single()
      
      if (error) throw error
      return data
    } catch (error) {
      console.error('Error adding emergency contact:', error)
      throw error
    }
  }

  static async updateEmergencyContact(id: string, contact: any) {
    try {
      const { data, error } = await supabase
        .from('emergency_contacts')
        .update(contact)
        .eq('id', id)
        .select()
        .single()
      
      if (error) throw error
      return data
    } catch (error) {
      console.error('Error updating emergency contact:', error)
      throw error
    }
  }

  static async deleteEmergencyContact(id: string) {
    try {
      const { error } = await supabase
        .from('emergency_contacts')
        .delete()
        .eq('id', id)
      
      if (error) throw error
    } catch (error) {
      console.error('Error deleting emergency contact:', error)
      throw error
    }
  }

  // Health Tips
  static async getHealthTips(limit: number = 3) {
    try {
      const { data, error } = await supabase
        .from('health_tips')
        .select('*')
        .eq('is_active', true)
        .order('priority', { ascending: false })
        .limit(limit)
      
      if (error) throw error
      return data || []
    } catch (error) {
      console.error('Error fetching health tips:', error)
      throw error
    }
  }

  static async getUserHealthTips(userId: string = DEFAULT_USER_ID) {
    try {
      const { data, error } = await supabase
        .from('user_health_tips')
        .select(`
          *,
          health_tips (
            tip_content,
            category,
            priority,
            source
          )
        `)
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
      
      if (error) throw error
      return data || []
    } catch (error) {
      console.error('Error fetching user health tips:', error)
      throw error
    }
  }

  static async addUserHealthTip(tipId: string, userId: string = DEFAULT_USER_ID) {
    try {
      const { data, error } = await supabase
        .from('user_health_tips')
        .insert([{ user_id: userId, health_tip_id: tipId }])
        .select()
        .single()
      
      if (error) throw error
      return data
    } catch (error) {
      console.error('Error adding user health tip:', error)
      throw error
    }
  }

  // Health Records
  static async getHealthRecords(userId: string = DEFAULT_USER_ID) {
    try {
      const { data, error } = await supabase
        .from('health_records')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
      
      if (error) throw error
      return data || []
    } catch (error) {
      console.error('Error fetching health records:', error)
      throw error
    }
  }

  static async addHealthRecord(record: any, userId: string = DEFAULT_USER_ID) {
    try {
      const { data, error } = await supabase
        .from('health_records')
        .insert([{ ...record, user_id: userId }])
        .select()
        .single()
      
      if (error) throw error
      return data
    } catch (error) {
      console.error('Error adding health record:', error)
      throw error
    }
  }

  // Symptom Check - This will still go through the backend API
  static async checkSymptoms(_symptoms: any) {
    // This should go through the backend API as it involves AI processing
    throw new Error('Use API service for symptom checking')
  }
}

export default SupabaseService
