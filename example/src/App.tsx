import { StyleSheet, View } from 'react-native';
import AppNavigator from './navagation/AppNavigator';
import { Provider } from 'react-redux';
import { store } from './store';

export default function App() {
  return (
    <View style={styles.container}>
      <Provider store={store}>
        <AppNavigator />
      </Provider>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
  },
});
