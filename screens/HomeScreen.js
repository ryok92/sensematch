import React from 'react';
import {View,Text,TouchableOpacity,StyleSheet,StatusBar,ScrollView,Dimensions,} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

const { width } = Dimensions.get('window');

const COLORS = {
  primary: '#3B82F6',
  primaryLight: '#EFF6FF',
  background: '#F5F8FF',
  surface: '#FFFFFF',
  textMain: '#1E293B',
  textSub: '#64748B',
  accent: '#F59E0B',
  danger: '#EF4444',
  border: '#E2E8F0',
};

const MainActionCard = ({ onPress }) => (
  <TouchableOpacity
    style={styles.mainCard}
    onPress={onPress}
    activeOpacity={0.95}
  >
    <View style={styles.decorativeCircle1} />
    <View style={styles.decorativeCircle2} />

    <View style={styles.mainCardContent}>
      <View>
        <View style={styles.recommendBadge}>
          <Ionicons name="sparkles" size={10} color="#FFD700" style={{ marginRight: 4 }} />
          <Text style={styles.recommendText}>RECOMMEND</Text>
        </View>
        <Text style={styles.mainCardTitle}>パートナーを探す</Text>
        <Text style={styles.mainCardSubtitle}>感性の合う相手を見つけに行こう</Text>
      </View>
      
      <View style={styles.mainCardIconBox}>
        <Ionicons name="search" size={28} color={COLORS.primary} />
      </View>
    </View>
  </TouchableOpacity>
);

const NotificationItem = ({ date, title, isNew }) => (
  <TouchableOpacity style={styles.notificationItem}>
    <View style={styles.notificationDateContainer}>
      <Text style={styles.notificationDate}>{date}</Text>
      {isNew && <View style={styles.newBadge}><Text style={styles.newBadgeText}>NEW</Text></View>}
    </View>
    <Text style={styles.notificationTitle} numberOfLines={1}>{title}</Text>
    <Ionicons name="chevron-forward" size={16} color={COLORS.border} />
  </TouchableOpacity>
);

export default function HomeScreen({ navigation }) {
  const handleSearch = () => {
    navigation.navigate('SearchList');
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor={COLORS.background} />
      <SafeAreaView style={styles.safeArea}>
        
        <View style={styles.header}>
          <View>
            <Text style={styles.appName}>Sense Match</Text>
          </View>

          <TouchableOpacity style={styles.notificationButton}>
            <Ionicons name="notifications-outline" size={24} color={COLORS.textSub} />
            <View style={styles.badge} />
          </TouchableOpacity>
        </View>

        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.heroSection}>
            <Text style={styles.heroText}>
              感性でつながる、{'\n'}
              <Text style={{ color: COLORS.textMain, fontWeight: '800' }}>特別な出会いを。</Text>
            </Text>
          </View>

          <MainActionCard onPress={handleSearch} />

          <View style={styles.sectionContainer}>
            <View style={styles.sectionHeader}>
              <Ionicons name="information-circle" size={18} color={COLORS.primary} />
              <Text style={styles.sectionTitle}>お知らせ</Text>
            </View>

            <View style={styles.cardBase}>
              <NotificationItem date="10.25" title="【新機能】共体験機能がリリース！" isNew={true} />
              <NotificationItem date="10.24" title="メンテナンスのお知らせ" />
              <NotificationItem date="10.20" title="写真変更でマッチング率UP！" />
              
              <TouchableOpacity style={styles.viewAllButton}>
                <Text style={styles.viewAllText}>すべてのお知らせを見る</Text>
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.tipsContainer}>
            <View style={styles.tipsIconBox}>
              <Ionicons name="bulb" size={22} color={COLORS.accent} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.tipsTitle}>Today's Tips</Text>
              <Text style={styles.tipsText}>
                プロフィール写真を自然光で撮影したものに変更するとマッチング率が大幅にUPします！
              </Text>
            </View>
            <View style={styles.tipsDecorative} />
          </View>

        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  safeArea: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingTop: 10,
    paddingBottom: 10,
    backgroundColor: 'transparent',
  },
  greeting: {
    fontSize: 12,
    color: COLORS.textSub,
    fontWeight: '600',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  appName: {
    fontSize: 26,
    fontWeight: '900',
    color: COLORS.primary,
    letterSpacing: -0.5,
  },
  notificationButton: {
    width: 44,
    height: 44,
    backgroundColor: COLORS.surface,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
    borderWidth: 1,
    borderColor: '#fff',
  },
  badge: {
    position: 'absolute',
    top: 10,
    right: 12,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: COLORS.danger,
    borderWidth: 1.5,
    borderColor: COLORS.surface,
  },
  
  scrollContent: {
    paddingHorizontal: 24,
    paddingBottom: 100,
  },

  heroSection: {
    marginTop: 20,
    marginBottom: 24,
  },
  heroText: {
    fontSize: 28,
    fontWeight: '300',
    color: COLORS.textMain,
    lineHeight: 40,
  },
  mainCard: {
    backgroundColor: COLORS.primary,
    borderRadius: 28,
    padding: 24,
    height: 160,
    marginBottom: 32,
    justifyContent: 'center',
    overflow: 'hidden',
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 10,
  },
  decorativeCircle1: {
    position: 'absolute',
    top: -40,
    right: -40,
    width: 150,
    height: 150,
    borderRadius: 75,
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  decorativeCircle2: {
    position: 'absolute',
    bottom: -20,
    left: -20,
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  mainCardContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
  },
  recommendBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    alignSelf: 'flex-start',
    marginBottom: 12,
  },
  recommendText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  mainCardTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 4,
  },
  mainCardSubtitle: {
    fontSize: 13,
    color: '#DBEAFE',
  },
  mainCardIconBox: {
    width: 56,
    height: 56,
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
  },
  sectionContainer: {
    marginBottom: 32,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    paddingHorizontal: 4,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: COLORS.textSub,
    marginLeft: 8,
    letterSpacing: 0.5,
  },
  cardBase: {
    backgroundColor: COLORS.surface,
    borderRadius: 20,
    paddingHorizontal: 20,
    paddingVertical: 12,
    shadowColor: "#64748B",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 10,
    elevation: 2,
  },
  notificationItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  notificationDateContainer: {
    alignItems: 'center',
    marginRight: 16,
    width: 40,
  },
  notificationDate: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.textSub,
  },
  newBadge: {
    backgroundColor: '#FEE2E2',
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: 4,
    marginTop: 4,
  },
  newBadgeText: {
    fontSize: 9,
    color: COLORS.danger,
    fontWeight: 'bold',
  },
  notificationTitle: {
    flex: 1,
    fontSize: 13,
    color: COLORS.textMain,
    fontWeight: '500',
  },
  viewAllButton: {
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 4,
  },
  viewAllText: {
    fontSize: 12,
    color: COLORS.primary,
    fontWeight: '700',
  },
  tipsContainer: {
    flexDirection: 'row',
    backgroundColor: '#EFF6FF',
    borderRadius: 20,
    padding: 20,
    alignItems: 'flex-start',
    overflow: 'hidden',
    position: 'relative',
    borderWidth: 1,
    borderColor: '#DBEAFE',
  },
  tipsIconBox: {
    backgroundColor: '#FFFFFF',
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  tipsTitle: {
    fontSize: 11,
    fontWeight: '800',
    color: COLORS.primary,
    textTransform: 'uppercase',
    marginBottom: 4,
    letterSpacing: 1,
  },
  tipsText: {
    fontSize: 13,
    color: COLORS.textMain,
    lineHeight: 20,
  },
  tipsDecorative: {
    position: 'absolute',
    top: -20,
    right: -20,
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: COLORS.primary,
    opacity: 0.1,
  },
});