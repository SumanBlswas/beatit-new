import { NativeModules } from 'react-native';

const { ContentUriCopy } = NativeModules as any;

export interface AudioMetadata {
  title: string | null;
  artist: string | null;
  album: string | null;
  albumArtPath: string | null;
}

export async function copyContentUriToCache(contentUri: string): Promise<string> {
  if (!ContentUriCopy || !ContentUriCopy.copyContentUriToCache) {
    throw new Error('ContentUriCopy native module is not available');
  }

  return await ContentUriCopy.copyContentUriToCache(contentUri);
}

export async function getVideoOrientation(contentUri: string): Promise<any> {
  if (!ContentUriCopy || !ContentUriCopy.getVideoOrientation) {
    throw new Error('ContentUriCopy.getVideoOrientation native method is not available');
  }

  return await ContentUriCopy.getVideoOrientation(contentUri);
}

export async function extractAudioMetadata(uri: string): Promise<AudioMetadata> {
  if (!ContentUriCopy || !ContentUriCopy.extractAudioMetadata) {
    throw new Error('ContentUriCopy.extractAudioMetadata native method is not available');
  }

  return await ContentUriCopy.extractAudioMetadata(uri);
}
