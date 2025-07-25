import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Settings, X, Volume2, VolumeX, Palette, Info, Mic, Bug } from 'lucide-react';
import ReminderDebug from './ReminderDebug';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  isMuted: boolean;
  isDarkMode: boolean;
  onToggleMute: () => void;
  onToggleDarkMode: () => void;
}

const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  isMuted,
  isDarkMode,
  onToggleMute,
  onToggleDarkMode
}) => {
  const [activeTab, setActiveTab] = useState<'audio' | 'appearance' | 'about' | 'debug'>('audio');

  const tabs = [
    { id: 'audio' as const, label: 'Audio', icon: Volume2 },
    { id: 'appearance' as const, label: 'Appearance', icon: Palette },
    { id: 'debug' as const, label: 'Debug', icon: Bug },
    { id: 'about' as const, label: 'About', icon: Info }
  ];

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50"
            onClick={onClose}
          />
          
          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            transition={{ type: "spring", duration: 0.5 }}
            className="fixed top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-96 bg-white dark:bg-slate-900 rounded-2xl shadow-2xl z-50 overflow-hidden"
          >
            {/* Header */}
            <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-slate-700">
              <div className="flex items-center space-x-3">
                <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
                  <Settings className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                </div>
                <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                  Settings
                </h2>
              </div>
              
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={onClose}
                className="p-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </motion.button>
            </div>

            {/* Tabs */}
            <div className="flex border-b border-gray-200 dark:border-slate-700">
              {tabs.map((tab) => (
                <motion.button
                  key={tab.id}
                  whileHover={{ backgroundColor: 'rgba(59, 130, 246, 0.05)' }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex-1 flex items-center justify-center space-x-2 py-3 px-4 text-sm font-medium transition-colors relative ${
                    activeTab === tab.id
                      ? 'text-blue-600 dark:text-blue-400'
                      : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
                  }`}
                >
                  <tab.icon className="w-4 h-4" />
                  <span>{tab.label}</span>
                  
                  {activeTab === tab.id && (
                    <motion.div
                      layoutId="activeTab"
                      className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600 dark:bg-blue-400"
                      initial={false}
                      transition={{ type: "spring", stiffness: 500, damping: 30 }}
                    />
                  )}
                </motion.button>
              ))}
            </div>

            {/* Content */}
            <div className="p-6">
              <AnimatePresence mode="wait">
                {activeTab === 'audio' && (
                  <motion.div
                    key="audio"
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    transition={{ duration: 0.2 }}
                    className="space-y-4"
                  >
                    <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">
                      Audio Settings
                    </h3>
                    
                    {/* Mute Toggle */}
                    <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-slate-800 rounded-xl">
                      <div className="flex items-center space-x-3">
                        {isMuted ? <VolumeX className="w-5 h-5 text-red-500" /> : <Volume2 className="w-5 h-5 text-blue-500" />}
                        <div>
                          <p className="font-medium text-gray-900 dark:text-white">
                            Audio Output
                          </p>
                          <p className="text-sm text-gray-500 dark:text-gray-400">
                            {isMuted ? 'Audio is muted' : 'Audio is enabled'}
                          </p>
                        </div>
                      </div>
                      
                      <motion.button
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        onClick={onToggleMute}
                        className={`relative w-12 h-6 rounded-full transition-colors ${
                          isMuted 
                            ? 'bg-red-200 dark:bg-red-800' 
                            : 'bg-blue-500 dark:bg-blue-600'
                        }`}
                      >
                        <motion.div
                          animate={{ x: isMuted ? 2 : 22 }}
                          transition={{ type: "spring", stiffness: 500, damping: 30 }}
                          className="absolute top-1 w-4 h-4 bg-white rounded-full shadow-sm"
                        />
                      </motion.button>
                    </div>

                    {/* Voice Input Info */}
                    <div className="p-4 bg-blue-50 dark:bg-blue-900/30 rounded-xl border border-blue-200 dark:border-blue-800">
                      <div className="flex items-start space-x-3">
                        <Mic className="w-5 h-5 text-blue-600 dark:text-blue-400 mt-0.5" />
                        <div>
                          <p className="font-medium text-blue-900 dark:text-blue-100 mb-1">
                            Voice Recognition
                          </p>
                          <p className="text-sm text-blue-700 dark:text-blue-300">
                            Click the microphone button to start voice input. Ava will listen for your commands and respond accordingly.
                          </p>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                )}

                {activeTab === 'appearance' && (
                  <motion.div
                    key="appearance"
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    transition={{ duration: 0.2 }}
                    className="space-y-4"
                  >
                    <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">
                      Appearance Settings
                    </h3>
                    
                    {/* Theme Toggle */}
                    <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-slate-800 rounded-xl">
                      <div className="flex items-center space-x-3">
                        <Palette className="w-5 h-5 text-purple-500" />
                        <div>
                          <p className="font-medium text-gray-900 dark:text-white">
                            Theme Mode
                          </p>
                          <p className="text-sm text-gray-500 dark:text-gray-400">
                            {isDarkMode ? 'Dark mode enabled' : 'Light mode enabled'}
                          </p>
                        </div>
                      </div>
                      
                      <motion.button
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        onClick={onToggleDarkMode}
                        className={`relative w-12 h-6 rounded-full transition-colors ${
                          isDarkMode 
                            ? 'bg-indigo-500 dark:bg-indigo-600' 
                            : 'bg-gray-300 dark:bg-gray-600'
                        }`}
                      >
                        <motion.div
                          animate={{ x: isDarkMode ? 22 : 2 }}
                          transition={{ type: "spring", stiffness: 500, damping: 30 }}
                          className="absolute top-1 w-4 h-4 bg-white rounded-full shadow-sm"
                        />
                      </motion.button>
                    </div>

                    {/* Theme Preview */}
                    <div className="p-4 bg-gradient-to-br from-blue-50 to-purple-50 dark:from-slate-800 dark:to-slate-700 rounded-xl">
                      <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">Preview:</p>
                      <div className="flex space-x-2">
                        <div className="w-8 h-8 bg-blue-500 rounded-full"></div>
                        <div className="w-8 h-8 bg-purple-500 rounded-full"></div>
                        <div className="w-8 h-8 bg-indigo-500 rounded-full"></div>
                      </div>
                    </div>
                  </motion.div>
                )}

                {activeTab === 'debug' && (
                  <motion.div
                    key="debug"
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    transition={{ duration: 0.2 }}
                    className="space-y-4"
                  >
                    <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">
                      Reminder Debug Tools
                    </h3>
                    
                    <ReminderDebug />
                  </motion.div>
                )}

                {activeTab === 'about' && (
                  <motion.div
                    key="about"
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    transition={{ duration: 0.2 }}
                    className="space-y-4"
                  >
                    <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">
                      About Ava
                    </h3>
                    
                    <div className="text-center space-y-4">
                      <motion.div
                        animate={{ rotate: 360 }}
                        transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
                        className="w-16 h-16 mx-auto bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center"
                      >
                        <Settings className="w-8 h-8 text-white" />
                      </motion.div>
                      
                      <div>
                        <h4 className="text-xl font-bold text-gray-900 dark:text-white">
                          Ava AI Assistant
                        </h4>
                        <p className="text-gray-500 dark:text-gray-400">
                          Version 1.0.0
                        </p>
                      </div>
                      
                      <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed">
                        Your intelligent voice assistant powered by advanced AI technology. 
                        Ava can help you with various tasks through natural voice conversations.
                      </p>
                      
                      <div className="pt-4 border-t border-gray-200 dark:border-slate-700">
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                          Built with React, TypeScript, and Electron
                        </p>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};

export default SettingsModal;
