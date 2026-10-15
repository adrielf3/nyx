import { PermissionsAndroid, Platform } from 'react-native';

export async function requestMicrophonePermission(): Promise<boolean> {
  if (Platform.OS !== 'android') {
    throw new Error(
      'O reconhecimento deste protótipo está disponível apenas no Android.',
    );
  }

  const result = await PermissionsAndroid.request(
    PermissionsAndroid.PERMISSIONS.RECORD_AUDIO,
    {
      title: 'Microfone para falar com o Nyx',
      message:
        'O Nyx usa o microfone somente quando você toca em “Falar com Nyx”.',
      buttonPositive: 'Permitir',
      buttonNegative: 'Agora não',
    },
  );

  return result === PermissionsAndroid.RESULTS.GRANTED;
}
