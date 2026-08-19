import {
  StyleSheet,
  View,
  Text,
  Image,
  Pressable,
  Platform,
  StatusBar,
  SafeAreaView,
  ScrollView,
} from 'react-native';
import Svg, { Path } from 'react-native-svg';
import type { ScreenProps } from '../../../../navagation/AppNavigator';

export default function CCCDCapturePreview({ navigation, route }: ScreenProps) {
  const frontImagePath = route.params?.frontImagePath || null;
  const backImagePath = route.params?.backImagePath || null;

  const handleBack = () => {
    navigation.goBack();
  };

  const handleConfirm = () => {
    navigation.navigate('CCCDOcr', {
      frontImagePath,
      backImagePath,
    });
  };

  const handleRecaptureAll = () => {
    // Navigate back to capture screen to start over from front side
    navigation.navigate('CCCDCapture');
  };

  return (
    <View style={styles.container}>
      <StatusBar
        barStyle="light-content"
        translucent
        backgroundColor="transparent"
      />

      {/* Header Container */}
      <View style={styles.header}>
        <SafeAreaView style={styles.headerSafeArea}>
          <View style={styles.headerToolbar}>
            <Pressable
              accessibilityRole="button"
              onPress={handleBack}
              style={styles.backButton}
            >
              <View style={styles.backButtonInner}>
                <Svg width={24} height={24} viewBox="0 0 24 24" fill="none">
                  <Path
                    d="M15 18l-6-6 6-6"
                    stroke="#FFFFFF"
                    strokeWidth={2.5}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </Svg>
              </View>
            </Pressable>

            <Text style={styles.headerTitle}>Xem trước ảnh</Text>
            <View style={styles.headerRightPlaceholder} />
          </View>
        </SafeAreaView>
      </View>

      {/* Body / Scrollable Content */}
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Front Card Preview */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Mặt trước giấy tờ</Text>
        </View>

        <View style={styles.cardContainer}>
          {frontImagePath ? (
            <Image
              source={{ uri: frontImagePath }}
              style={styles.cardImage}
              resizeMode="cover"
            />
          ) : (
            <View style={styles.placeholderContainer}>
              <Text style={styles.placeholderText}>Ảnh mặt trước</Text>
            </View>
          )}
        </View>

        {/* Back Card Preview */}
        <View style={[styles.sectionHeader, styles.sectionHeaderBack]}>
          <Text style={styles.sectionTitle}>Mặt sau giấy tờ</Text>
        </View>

        <View style={styles.cardContainer}>
          {backImagePath ? (
            <Image
              source={{ uri: backImagePath }}
              style={styles.cardImage}
              resizeMode="cover"
            />
          ) : (
            <View style={styles.placeholderContainer}>
              <Text style={styles.placeholderText}>Ảnh mặt sau</Text>
            </View>
          )}
        </View>
      </ScrollView>

      {/* Bottom Action Bar */}
      <SafeAreaView style={styles.bottomBarContainer}>
        <View style={styles.bottomBar}>
          <Pressable
            accessibilityRole="button"
            onPress={handleRecaptureAll}
            style={[styles.actionButton, styles.recaptureButton]}
          >
            <Text style={styles.recaptureButtonText}>Chụp lại</Text>
          </Pressable>

          <Pressable
            accessibilityRole="button"
            onPress={handleConfirm}
            style={[styles.actionButton, styles.confirmButton]}
          >
            <Text style={styles.confirmButtonText}>Xác nhận</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8F9FA',
  },
  header: {
    height:
      Platform.OS === 'android' ? 88 + (StatusBar.currentHeight || 24) : 100,
    backgroundColor: '#01844C',
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
    overflow: 'hidden',
  },
  headerSafeArea: {
    flex: 1,
  },
  headerToolbar: {
    height: 56,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    marginTop: Platform.OS === 'android' ? StatusBar.currentHeight : 10,
  },
  backButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  backButtonInner: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
    fontFamily: 'Inter',
  },
  headerRightPlaceholder: {
    width: 40,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 24,
    paddingBottom: 130, // extra padding for bottom bar
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  sectionHeaderBack: {
    marginTop: 20,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#232440',
    fontFamily: 'Inter',
  },
  editLink: {
    fontSize: 13,
    fontWeight: '600',
    color: '#01844C',
    fontFamily: 'Inter',
  },
  cardContainer: {
    width: '100%',
    height: 220,
    backgroundColor: '#000000',
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#E2E8F0',
    borderStyle: 'dashed',
    overflow: 'hidden',
    justifyContent: 'center',
    alignItems: 'center',
  },
  cardImage: {
    width: '100%',
    height: '100%',
  },
  placeholderContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  placeholderText: {
    color: '#71717A',
    fontSize: 14,
    fontWeight: '600',
    fontFamily: 'Inter',
  },
  bottomBarContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
    elevation: 8,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
  },
  bottomBar: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 12,
    justifyContent: 'space-between',
  },
  actionButton: {
    flex: 1,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  recaptureButton: {
    backgroundColor: '#E8F5E9',
    borderWidth: 1.5,
    borderColor: '#01844C',
  },
  recaptureButtonText: {
    color: '#01844C',
    fontSize: 14,
    fontWeight: '600',
    fontFamily: 'Inter',
  },
  confirmButton: {
    backgroundColor: '#01844C',
  },
  confirmButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
    fontFamily: 'Inter',
  },
});
