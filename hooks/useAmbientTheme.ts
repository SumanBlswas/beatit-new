import { LightSensor } from 'expo-sensors';
import { useEffect, useRef, useState } from 'react';

// Threshold (in lux) below which we consider the environment as 'dark'.
const DARK_LUX_THRESHOLD = 20;

export type AmbientEnvironment = 'dark' | 'light' | 'unknown';

export function useAmbientTheme(enabled: boolean) {
  const [environment, setEnvironment] = useState<AmbientEnvironment>('unknown');
  const subscriptionRef = useRef<any>(null);

  useEffect(() => {
    if (!enabled) {
      setEnvironment('unknown');
      if (subscriptionRef.current) {
        subscriptionRef.current.remove();
        subscriptionRef.current = null;
      }
      return;
    }

    subscriptionRef.current = LightSensor.addListener((data) => {
      // data.illuminance is in lux
      if (typeof data.illuminance === 'number') {
        setEnvironment(data.illuminance < DARK_LUX_THRESHOLD ? 'dark' : 'light');
      } else {
        setEnvironment('unknown');
      }
    });

    // Set update interval (ms)
    LightSensor.setUpdateInterval(1000);

    return () => {
      if (subscriptionRef.current) {
        subscriptionRef.current.remove();
        subscriptionRef.current = null;
      }
    };
  }, [enabled]);

  return environment;
} 