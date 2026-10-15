import { StatusBar } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { NyxHomeScreen } from './src/screens/NyxHomeScreen';

function App() {
  return (
    <SafeAreaProvider>
      <StatusBar barStyle="light-content" />
      <NyxHomeScreen />
    </SafeAreaProvider>
  );
}

export default App;
