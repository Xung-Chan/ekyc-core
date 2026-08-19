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
  Alert,
} from 'react-native';
import Svg, { Path, Circle, Rect } from 'react-native-svg';
import type { ScreenProps } from '../../../../navagation/AppNavigator';
import type { OcrCCCDEntity } from '../../datascource/dtos/OcrCCCDto';

export default function CCCDOcr({ navigation, route }: ScreenProps) {
  const frontImagePath = route.params?.frontImagePath || null;
  const backImagePath = route.params?.backImagePath || null;

  const handleBack = () => {
    navigation.goBack();
  };

  const handleRecapture = () => {
    // Navigate back to the capture screen to restart the flow
    navigation.navigate('CCCDCapture');
  };

  const handleUseInfo = () => {
    Alert.alert('Thành công', 'Thông tin của bạn đã được xác thực thành công!');
  };

  // Mock DTO data representing the entity extracted
  const ocrEntity: OcrCCCDEntity = {
    docType: 'cccd',
    frontImageUrl: frontImagePath || undefined,
    backImageUrl: backImagePath || undefined,
    extractData: {
      documentNumber: '012345678901',
      fullName: 'NGUYỄN VĂN A',
      dateOfBirth: '01/01/1990',
      gender: 'Nam',
      nationality: 'Việt Nam',
      placeOfOrigin: 'Hà Nội',
      placeOfResidence: '123 Đường Láng, Láng Thượng, Đống Đa, Hà Nội',
      placeOfIssue:
        'Cục trưởng Cục Cảnh sát quản lý hành chính về trật tự xã hội',
      dateOfIssue: '01/01/2020',
      expiryDate: '01/01/2035',
    },
  };

  const { extractData } = ocrEntity;

  return (
    <View style={styles.container}>
      <StatusBar
        barStyle="dark-content"
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
                <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
                  <Path
                    d="M15 18l-6-6 6-6"
                    stroke="#111C2D"
                    strokeWidth={2.5}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </Svg>
              </View>
            </Pressable>

            <Text style={styles.headerTitle}>Xác thực giấy tờ</Text>
            <View style={styles.headerRightPlaceholder} />
          </View>
        </SafeAreaView>
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Section Heading */}
        <View style={styles.headingContainer}>
          <Text style={styles.headingText}>Thông tin đã cung cấp</Text>
        </View>

        {/* ID Cards Grid */}
        <View style={styles.cardsGrid}>
          <View style={styles.cardBorder}>
            <View style={styles.cardWrapper}>
              {frontImagePath ? (
                <Image
                  source={{ uri: frontImagePath }}
                  style={styles.cardImage}
                  resizeMode="cover"
                />
              ) : (
                <Text style={styles.cardPlaceholderText}>Mặt trước</Text>
              )}
            </View>
          </View>

          <View style={styles.cardBorder}>
            <View style={styles.cardWrapper}>
              {backImagePath ? (
                <Image
                  source={{ uri: backImagePath }}
                  style={styles.cardImage}
                  resizeMode="cover"
                />
              ) : (
                <Text style={styles.cardPlaceholderText}>Mặt sau</Text>
              )}
            </View>
          </View>
        </View>

        {/* User Profile Summary */}
        <View style={styles.profileSummary}>
          <View style={styles.avatarBorder}>
            <View style={styles.avatarInner}>
              <Svg width={24} height={24} viewBox="0 0 24 24" fill="none">
                <Path
                  d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"
                  stroke="#15803D"
                  strokeWidth={2}
                  strokeLinecap="round"
                />
                <Circle cx={12} cy={7} r={4} stroke="#15803D" strokeWidth={2} />
              </Svg>
            </View>
          </View>

          <Text style={styles.profileName}>{extractData?.fullName}</Text>

          <View style={styles.profileMetaRow}>
            <View style={styles.metaItem}>
              <Svg
                width={16}
                height={16}
                viewBox="0 0 24 24"
                fill="none"
                style={styles.metaIcon}
              >
                <Rect
                  x={3}
                  y={4}
                  width={18}
                  height={18}
                  rx={2}
                  stroke="#505F76"
                  strokeWidth={2}
                />
                <Path
                  d="M16 2v4M8 2v4M3 10h18"
                  stroke="#505F76"
                  strokeWidth={2}
                />
              </Svg>
              <Text style={styles.metaText}>{extractData?.dateOfBirth}</Text>
            </View>

            <View style={styles.metaItem}>
              <Svg
                width={16}
                height={16}
                viewBox="0 0 24 24"
                fill="none"
                style={styles.metaIcon}
              >
                <Circle
                  cx={12}
                  cy={10}
                  r={8}
                  stroke="#505F76"
                  strokeWidth={2}
                />
                <Path d="M12 2v16M8 14h8" stroke="#505F76" strokeWidth={2} />
              </Svg>
              <Text style={styles.metaText}>{extractData?.gender}</Text>
            </View>
          </View>
        </View>

        {/* Data List (OCR Fields) */}
        <View style={styles.dataList}>
          <View style={styles.dataRow}>
            <Text style={styles.fieldLabel}>Số giấy tờ:</Text>
            <Text style={styles.fieldValue}>{extractData?.documentNumber}</Text>
          </View>

          <View style={styles.dataRow}>
            <Text style={styles.fieldLabel}>Ngày cấp:</Text>
            <Text style={styles.fieldValue}>{extractData?.dateOfIssue}</Text>
          </View>

          <View style={styles.dataRow}>
            <Text style={styles.fieldLabel}>Ngày hết hạn:</Text>
            <Text style={styles.fieldValue}>{extractData?.expiryDate}</Text>
          </View>

          <View style={styles.dataRowAlignTop}>
            <Text style={[styles.fieldLabel, styles.pt4]}>Nơi cấp:</Text>
            <Text style={styles.fieldValueRightAlign}>
              {extractData?.placeOfIssue}
            </Text>
          </View>

          <View style={styles.dataRowAlignTopLast}>
            <Text style={[styles.fieldLabel, styles.pt4]}>Địa chỉ:</Text>
            <Text style={styles.fieldValueRightAlign}>
              {extractData?.placeOfResidence}
            </Text>
          </View>
        </View>
      </ScrollView>

      {/* Bottom Action Buttons */}
      <SafeAreaView style={styles.bottomBarContainer}>
        <View style={styles.bottomBar}>
          <Pressable
            accessibilityRole="button"
            onPress={handleUseInfo}
            style={styles.primaryButton}
          >
            <Text style={styles.primaryButtonText}>
              Sử dụng thông tin đã cung cấp
            </Text>
          </Pressable>

          <Pressable
            accessibilityRole="button"
            onPress={handleRecapture}
            style={styles.secondaryButton}
          >
            <Text style={styles.secondaryButtonText}>Chụp lại ảnh giấy tờ</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  header: {
    height:
      Platform.OS === 'android' ? 72 + (StatusBar.currentHeight || 24) : 88,
    backgroundColor: '#F9F9FF',
    borderBottomWidth: 1,
    borderBottomColor: '#E7EEFF',
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
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 2,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#111C2D',
    fontFamily: 'Inter',
  },
  headerRightPlaceholder: {
    width: 40,
  },
  scrollContent: {
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: 170, // Padding to avoid overlap with floating buttons
  },
  headingContainer: {
    alignItems: 'center',
    marginBottom: 16,
  },
  headingText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111C2D',
    fontFamily: 'Inter',
  },
  cardsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
    marginBottom: 32,
  },
  cardBorder: {
    flex: 1,
    marginHorizontal: 4,
    backgroundColor: '#FFFFFF',
    borderWidth: 2,
    borderColor: '#15803D',
    borderStyle: 'dashed',
    borderRadius: 12,
    padding: 2,
  },
  cardWrapper: {
    height: 103,
    borderRadius: 10,
    backgroundColor: '#F8F9FA',
    overflow: 'hidden',
    justifyContent: 'center',
    alignItems: 'center',
  },
  cardImage: {
    width: '100%',
    height: '100%',
  },
  cardPlaceholderText: {
    fontSize: 13,
    color: '#505F76',
    fontFamily: 'Inter',
  },
  profileSummary: {
    alignItems: 'center',
    marginBottom: 32,
  },
  avatarBorder: {
    width: 56,
    height: 56,
    borderRadius: 28,
    borderWidth: 1,
    borderColor: '#BECABC',
    backgroundColor: '#E7EEFF',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  avatarInner: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  profileName: {
    fontSize: 18,
    fontWeight: '600',
    color: '#15803D',
    fontFamily: 'Inter',
    textTransform: 'uppercase',
    marginBottom: 12,
  },
  profileMetaRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 32,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  metaIcon: {
    opacity: 0.8,
  },
  metaText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111C2D',
    fontFamily: 'Inter',
  },
  dataList: {
    width: '100%',
  },
  dataRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E7EEFF',
  },
  dataRowAlignTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E7EEFF',
  },
  dataRowAlignTopLast: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingVertical: 16,
  },
  pt4: {
    paddingTop: 4,
  },
  fieldLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#505F76',
    fontFamily: 'Inter',
  },
  fieldValue: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111C2D',
    fontFamily: 'Inter',
  },
  fieldValueRightAlign: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111C2D',
    fontFamily: 'Inter',
    textAlign: 'right',
    flex: 1,
    paddingLeft: 32,
  },
  bottomBarContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#FFFFFF',
  },
  bottomBar: {
    paddingHorizontal: 24,
    paddingVertical: 16,
    gap: 12,
  },
  primaryButton: {
    backgroundColor: '#15803D',
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 2,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
    fontFamily: 'Inter',
  },
  secondaryButton: {
    backgroundColor: '#F0F3FF',
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E7EEFF',
  },
  secondaryButtonText: {
    color: '#15803D',
    fontSize: 16,
    fontWeight: '600',
    fontFamily: 'Inter',
  },
});
