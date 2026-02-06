import { EmitterSubscription, NativeEventEmitter, NativeModules } from 'react-native';

const { VideoRemoteControlsModule } = NativeModules as any;

const emitter = VideoRemoteControlsModule ? new NativeEventEmitter(VideoRemoteControlsModule) : null;

export type RemoteAction = 'play' | 'pause' | 'next' | 'previous' | 'seek';

export function setSupportedActions(next: boolean, previous: boolean): Promise<boolean> {
  if (!VideoRemoteControlsModule) return Promise.resolve(false);
  return VideoRemoteControlsModule.setSupportedActions(!!next, !!previous);
}

export function setMetadata(title?: string, artist?: string, albumArtPath?: string, durationSec?: number): Promise<boolean> {
  if (!VideoRemoteControlsModule) return Promise.resolve(false);
  return VideoRemoteControlsModule.setMetadata(title || '', artist || '', albumArtPath || '', durationSec || 0);
}

export function setPlaybackState(isPlaying: boolean, positionSec: number): Promise<boolean> {
  if (!VideoRemoteControlsModule) return Promise.resolve(false);
  return VideoRemoteControlsModule.setPlaybackState(!!isPlaying, positionSec);
}
export function startNotification(title?: string, artist?: string, albumArtPath?: string, isPlaying?: boolean, enableNext?: boolean, enablePrev?: boolean, durationSec?: number, positionSec?: number): Promise<boolean> {
  if (!VideoRemoteControlsModule) return Promise.resolve(false);
  return VideoRemoteControlsModule.startNotification(title || '', artist || '', albumArtPath || '', !!isPlaying, !!enableNext, !!enablePrev, durationSec || 0, positionSec || 0);
}

export function updateNotification(title?: string, artist?: string, albumArtPath?: string, isPlaying?: boolean, enableNext?: boolean, enablePrev?: boolean, durationSec?: number, positionSec?: number): Promise<boolean> {
  if (!VideoRemoteControlsModule) return Promise.resolve(false);
  return VideoRemoteControlsModule.updateNotification(title || '', artist || '', albumArtPath || '', !!isPlaying, !!enableNext, !!enablePrev, durationSec || 0, positionSec || 0);
}

export function stopNotification(): Promise<boolean> {
  if (!VideoRemoteControlsModule) return Promise.resolve(false);
  return VideoRemoteControlsModule.stopNotification();
}

export function release(): Promise<boolean> {
  if (!VideoRemoteControlsModule) return Promise.resolve(false);
  return VideoRemoteControlsModule.release();
}

export function addEventListener(handler: (action: RemoteAction, payload?: any) => void): { remove: () => void } {
  if (!emitter) {
    return { remove: () => {} };
  }

  const sub: EmitterSubscription = emitter.addListener('VideoRemoteControlsEvent', (event: any) => {
    if (typeof event === 'string') {
      handler(event as RemoteAction);
    } else if (event && typeof event === 'object' && event.action) {
      handler(event.action as RemoteAction, event.payload);
    }
  });

  return { remove: () => sub.remove() };
}

// Backwards compatibility shim with EventEmitter
export const on = (handler: (action: RemoteAction, payload?: any) => void) => addEventListener(handler);
export const off = (subscription: { remove: () => void }) => subscription.remove();
