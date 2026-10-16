import { Text, View } from 'react-native';
import * as AuthSession from 'expo-auth-session';

export default function DebugRedirect() {
  const uri = AuthSession.makeRedirectUri();
  console.log('REDIRECT URI:', uri);

  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <Text selectable style={{ color: 'white' }}>{uri}</Text>
    </View>
  );
}