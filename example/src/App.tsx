import { StyleSheet, View } from 'react-native';
import AppNavigator from './navagation/AppNavigator';

export default function App() {
  return (
    <View style={styles.container}>
      <AppNavigator />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
  },
});
