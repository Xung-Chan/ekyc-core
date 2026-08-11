import { startEkyc } from '@xungchan/ekyc-core';
import { Button, StyleSheet, View } from 'react-native';

export default function App() {
  const handlePress = async () => {
    const result = await startEkyc();
    console.log(result);
  };
  return (
    <View style={styles.container}>
      <Button title="Start Ekyc" onPress={handlePress} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
