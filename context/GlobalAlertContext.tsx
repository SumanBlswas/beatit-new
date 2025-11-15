// context/GlobalAlertContext.tsx

/**
 * Global Alert Context
 * Provides app-wide beautiful alert functionality
 */

import { BeautifulAlert } from '@/components/BeautifulAlert';
import React, { createContext, useCallback, useContext, useState } from 'react';

interface AlertButton {
  text: string;
  onPress?: () => void;
  style?: 'default' | 'cancel' | 'destructive';
}

interface AlertConfig {
  visible: boolean;
  title: string;
  message: string;
  type: 'success' | 'error' | 'warning' | 'info';
  buttons: AlertButton[];
}

interface GlobalAlertContextType {
  showAlert: (config: Omit<AlertConfig, 'visible'>) => void;
  hideAlert: () => void;
}

const GlobalAlertContext = createContext<GlobalAlertContextType | undefined>(undefined);

export const GlobalAlertProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [alertConfig, setAlertConfig] = useState<AlertConfig>({
    visible: false,
    title: '',
    message: '',
    type: 'info',
    buttons: [{ text: 'OK' }],
  });

  const showAlert = useCallback((config: Omit<AlertConfig, 'visible'>) => {
    setAlertConfig({ ...config, visible: true });
  }, []);

  const hideAlert = useCallback(() => {
    setAlertConfig(prev => ({ ...prev, visible: false }));
  }, []);

  return (
    <GlobalAlertContext.Provider value={{ showAlert, hideAlert }}>
      {children}
      <BeautifulAlert
        visible={alertConfig.visible}
        title={alertConfig.title}
        message={alertConfig.message}
        type={alertConfig.type}
        buttons={alertConfig.buttons.map(btn => ({
          ...btn,
          onPress: () => {
            btn.onPress?.();
            hideAlert();
          },
        }))}
        onClose={hideAlert}
      />
    </GlobalAlertContext.Provider>
  );
};

export const useGlobalAlert = (): GlobalAlertContextType => {
  const context = useContext(GlobalAlertContext);
  if (!context) {
    throw new Error('useGlobalAlert must be used within GlobalAlertProvider');
  }
  return context;
};
