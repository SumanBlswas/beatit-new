// hooks/useBeautifulAlert.tsx

/**
 * Hook to use Beautiful Alert
 * Provides easy API to show beautiful custom alerts
 */

import { BeautifulAlert } from '@/components/BeautifulAlert';
import React, { useCallback, useState } from 'react';

interface AlertButton {
  text: string;
  onPress?: () => void;
  style?: 'default' | 'cancel' | 'destructive';
}

interface AlertConfig {
  title: string;
  message: string;
  type?: 'success' | 'error' | 'warning' | 'info';
  buttons?: AlertButton[];
}

export const useBeautifulAlert = () => {
  const [alertConfig, setAlertConfig] = useState<AlertConfig | null>(null);
  const [visible, setVisible] = useState(false);

  const showAlert = useCallback((config: AlertConfig) => {
    setAlertConfig(config);
    setVisible(true);
  }, []);

  const hideAlert = useCallback(() => {
    setVisible(false);
    setTimeout(() => {
      setAlertConfig(null);
    }, 300);
  }, []);

  const AlertComponent = useCallback(() => {
    if (!alertConfig) return null;

    return (
      <BeautifulAlert
        visible={visible}
        title={alertConfig.title}
        message={alertConfig.message}
        type={alertConfig.type}
        buttons={alertConfig.buttons}
        onClose={hideAlert}
      />
    );
  }, [alertConfig, visible, hideAlert]);

  return {
    showAlert,
    hideAlert,
    AlertComponent,
  };
};
