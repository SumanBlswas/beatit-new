import { NativeModules } from 'react-native';

const { ContentUriCopy } = NativeModules as any;

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
