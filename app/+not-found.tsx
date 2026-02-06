import { Stack } from 'expo-router';
import React from 'react';

// Import the Player Screen component directly
// Note: The path './(tabs)/player' depends on where +not-found.tsx is located relative to (tabs)
// If this import fails, try: import PlayerScreen from "@/app/(tabs)/player";
import PlayerScreen from './(tabs)/player';

export default function NotFoundScreen() {
  return (
    <>
      {/* We hide the navigation header so it looks exactly 
        like the standard Player screen 
      */}
      <Stack.Screen options={{ headerShown: false }} />

      {/* Render the Player UI directly */}
      <PlayerScreen />
    </>
  );
}