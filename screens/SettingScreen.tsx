import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView, Switch, Alert, Dimensions, ActivityIndicator, Animated,
  NativeSyntheticEvent, NativeScrollEvent
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import Ionicons from 'react-native-vector-icons/Ionicons';
import auth from '@react-native-firebase/auth';
import firestore, { FirebaseFirestoreTypes } from '@react-native-firebase/firestore';

const { width } = Dimensions.get('window');

interface ToggleRowProps {
  title: string;
  description: string;
  iconName: string;
  iconColor: string;
  value: boolean;
  onValueChange: (value: boolean) => void;
  isPremium?: boolean;
  disabled?: boolean;
}

const ToggleRow: React.FC<ToggleRowProps> = ({ title, description, iconName, iconColor, value, onValueChange, isPremium, disabled }) => (
  <View style={[styles.row, disabled && { opacity: 0.5 }]}>
    <View style={styles.rowLeft}>
      <View style={[styles.iconContainer, { backgroundColor: `${iconColor}15` }]}>
        <Ionicons name={iconName} size={20} color={iconColor} />
      </View>
      <View style={styles.textContainer}>
        <View style={styles.titleRow}>
          <Text style={styles.rowTitle}>{title}</Text>
          {isPremium && (
            <View style={styles.premiumBadge}>
              <Text style={styles.premiumText}>PREMIUM</Text>
            </View>
          )}
        </View>
        <Text style={styles.rowDesc}>{description}</Text>
      </View>
    </View>
    <Switch
      value={value}
      onValueChange={onValueChange}
      trackColor={{ false: '#E0E0E0', true: '#4A90E2' }}
      thumbColor={'#FFFFFF'}
      ios_backgroundColor="#E0E0E0"
      disabled={disabled}
    />
  </View>
);

interface PrivacySettings {
  ghostMode: boolean;
  showLoginStatus: boolean;
  twoFactorAuth: boolean;
  footprints: boolean;
}

interface NotificationSettings {
  likesNotif: boolean;
  matchNotif: boolean;
  msgNotif: boolean;
  emailNotif: boolean;
}

interface SettingsScreenProps {
  navigation: any;
}

export default function SettingsScreen({ navigation }: SettingsScreenProps) {
  const [activeTab, setActiveTab] = useState('privacy');
  const scrollViewRef = useRef<ScrollView>(null);
  const scrollX = useRef(new Animated.Value(0)).current;
  const [loading, setLoading] = useState<boolean>(true);
  const [blockedCount, setBlockedCount] = useState<number>(0);
  const [privacySettings, setPrivacySettings] = useState<PrivacySettings>({
    ghostMode: false,
    showLoginStatus: true,
    twoFactorAuth: false,
    footprints: true
  });
  const [notificationSettings, setNotificationSettings] = useState<NotificationSettings>({
    likesNotif: true,
    matchNotif: true,
    msgNotif: true,
    emailNotif: false
  });

  useEffect(() => {
    const user = auth().currentUser;
    if (!user) {
      setLoading(false);
      return;
    }

    const fetchSettings = async () => {
      try {
        const doc = await firestore().collection('users').doc(user.uid).get();

        if (doc.exists()) {
          const data = doc.data();
          if (data?.privacySettings) setPrivacySettings(prev => ({ ...prev, ...data.privacySettings }));
          if (data?.notificationSettings) setNotificationSettings(prev => ({ ...prev, ...data.notificationSettings }));
        }
      } catch (error) {
        console.error("Error fetching settings: ", error);
        Alert.alert("エラー", "設定の読み込みに失敗しました。");
      }
    };

    const unsubscribeBlocked = firestore()
      .collection('users')
      .doc(user.uid)
      .collection('blockedUsers')
      .onSnapshot((snapshot) => {
        if (snapshot) setBlockedCount(snapshot.size);
      });

    fetchSettings().then(() => setLoading(false));

    return () => unsubscribeBlocked();
  }, []);

  const updateSetting = async (
    category: 'privacySettings' | 'notificationSettings',
    key: string,
    value: boolean
  ) => {
    const user = auth().currentUser;
    if (!user) return;

    try {
      if (category === 'privacySettings') {
        setPrivacySettings(prev => ({ ...prev, [key]: value }));
      } else {
        setNotificationSettings(prev => ({ ...prev, [key]: value }));
      }

      await firestore().collection('users').doc(user.uid).set({
        [category]: {
          [key]: value
        }
      }, { merge: true });

    } catch (error) {
      console.error("Error updating setting: ", error);
      Alert.alert("エラー", "設定の保存に失敗しました。通信環境をご確認ください。");
    }
  };

  const handleTwoFactorToggle = (value: boolean) => {
    if (value) {
      Alert.alert(
        "二段階認証を有効にしますか？",
        "ログイン時に登録メールアドレスへ認証コードが送信されるようになります。",
        [
          { text: "キャンセル", style: "cancel" },
          { text: "有効にする", onPress: () => updateSetting('privacySettings', 'twoFactorAuth', true) }
        ]
      );
    } else {
      updateSetting('privacySettings', 'twoFactorAuth', false);
    }
  };

  const handleTabPress = (tabName: 'privacy' | 'notifications', index: number) => {
    setActiveTab(tabName);
    scrollViewRef.current?.scrollTo({ x: index * width, animated: true });
  };

  const handleScrollEnd = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const offsetX = event.nativeEvent.contentOffset.x;
    const pageIndex = Math.round(offsetX / width);
    if (pageIndex === 0 && activeTab !== 'privacy') setActiveTab('privacy');
    if (pageIndex === 1 && activeTab !== 'notifications') setActiveTab('notifications');
  };

  const indicatorTranslateX = scrollX.interpolate({
    inputRange: [0, width],
    outputRange: [0, width / 2],
  });

  if (loading) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color="#4A90E2" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <SafeAreaView style={styles.safeArea}>

        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
            <Ionicons name="chevron-back" size={28} color="#333" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>設定</Text>
          <View style={{ width: 40 }} />
        </View>

        <View style={styles.tabContainer}>
          <TouchableOpacity
            style={styles.tab}
            onPress={() => handleTabPress('privacy', 0)}
          >
            <Ionicons
              name="lock-closed-outline"
              size={16}
              color={activeTab === 'privacy' ? '#4A90E2' : '#999'}
              style={{ marginRight: 6 }}
            />
            <Text style={[styles.tabText, activeTab === 'privacy' && styles.activeTabText]}>
              プライバシー
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.tab}
            onPress={() => handleTabPress('notifications', 1)}
          >
            <Ionicons
              name="notifications-outline"
              size={16}
              color={activeTab === 'notifications' ? '#4A90E2' : '#999'}
              style={{ marginRight: 6 }}
            />
            <Text style={[styles.tabText, activeTab === 'notifications' && styles.activeTabText]}>
              通知設定
            </Text>
          </TouchableOpacity>

          <Animated.View
            style={[
              styles.indicator,
              {
                transform: [{ translateX: indicatorTranslateX }]
              }
            ]}
          />
        </View>

        <ScrollView
          ref={scrollViewRef}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          onMomentumScrollEnd={handleScrollEnd}
          onScroll={Animated.event(
            [{ nativeEvent: { contentOffset: { x: scrollX } } }],
            { useNativeDriver: false }
          )}
          scrollEventThrottle={16}
          style={{ flex: 1 }}
        >
          <ScrollView contentContainerStyle={[styles.content, { width }]} showsVerticalScrollIndicator={false}>
            <View style={[styles.ghostCard, privacySettings.ghostMode && styles.ghostCardActive]}>
              <View style={styles.ghostHeader}>
                <View style={styles.rowLeft}>
                  <MaterialCommunityIcons
                    name={privacySettings.ghostMode ? "ghost" : "eye-off-outline"}
                    size={24}
                    color={privacySettings.ghostMode ? "#FFF" : "#666"}
                  />
                  <View style={{ marginLeft: 12 }}>
                    <Text style={[styles.ghostTitle, privacySettings.ghostMode && { color: '#FFF' }]}>
                      {privacySettings.ghostMode ? 'シークレットモード ON' : '身バレ防止機能'}
                    </Text>
                    <Text style={[styles.ghostDesc, privacySettings.ghostMode && { color: 'rgba(255,255,255,0.8)' }]}>
                      プロフを検索結果に表示しません
                    </Text>
                  </View>
                </View>
                <Switch
                  value={privacySettings.ghostMode}
                  onValueChange={(val) => updateSetting('privacySettings', 'ghostMode', val)}
                  trackColor={{ false: '#DDD', true: '#818CF8' }}
                  thumbColor={'#FFF'}
                />
              </View>
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionHeader}>セキュリティ</Text>
              <ToggleRow
                title="二段階認証"
                description="ログイン時にメールで認証コードを受け取る"
                iconName="shield-checkmark"
                iconColor="#10B981"
                value={privacySettings.twoFactorAuth}
                onValueChange={handleTwoFactorToggle}
              />
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionHeader}>公開範囲の設定</Text>
              <ToggleRow
                title="ログイン状態の表示"
                description="相手にオンライン状況を公開します"
                iconName="radio-button-on"
                iconColor="#F59E0B"
                value={privacySettings.showLoginStatus}
                onValueChange={(val) => updateSetting('privacySettings', 'showLoginStatus', val)}
              />
              <ToggleRow
                title="足あとを残す"
                description="相手のプロフィールを見た履歴を残します"
                iconName="footsteps"
                iconColor="#4A90E2"
                value={privacySettings.footprints}
                onValueChange={(val) => updateSetting('privacySettings', 'footprints', val)}
              />
            </View>

            <View style={styles.section}>
              <TouchableOpacity
                style={styles.linkRow}
                onPress={() => navigation.navigate('BlockList')}
              >
                <View style={styles.rowLeft}>
                  <View style={[styles.iconContainer, { backgroundColor: '#FEE2E2' }]}>
                    <Ionicons name="person-remove" size={20} color="#EF4444" />
                  </View>
                  <View style={styles.textContainer}>
                    <Text style={styles.rowTitle}>ブロックリスト</Text>
                    <Text style={styles.rowDesc}>ブロックしたユーザーの管理</Text>
                  </View>
                </View>
                <View style={styles.badgeCount}>
                  <Text style={styles.badgeCountText}>{blockedCount}</Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color="#CCC" />
              </TouchableOpacity>
            </View>
          </ScrollView>

          <ScrollView contentContainerStyle={[styles.content, { width }]} showsVerticalScrollIndicator={false}>
            <View style={styles.infoBox}>
              <Ionicons name="phone-portrait-outline" size={20} color="#4A90E2" style={{ marginRight: 12 }} />
              <View style={{ flex: 1 }}>
                <Text style={styles.infoTitle}>プッシュ通知設定</Text>
                <Text style={styles.infoDesc}>重要な出会いを見逃さないよう、通知ONを推奨しています。</Text>
              </View>
            </View>

            <View style={styles.section}>
              <ToggleRow
                title="いいね！通知"
                description="相手からいいね！が届いた時"
                iconName="heart"
                iconColor="#EC4899"
                value={notificationSettings.likesNotif}
                onValueChange={(val) => updateSetting('notificationSettings', 'likesNotif', val)}
              />
              <ToggleRow
                title="マッチング通知"
                description="マッチングが成立した時"
                iconName="people"
                iconColor="#8B5CF6"
                value={notificationSettings.matchNotif}
                onValueChange={(val) => updateSetting('notificationSettings', 'matchNotif', val)}
              />
              <ToggleRow
                title="メッセージ通知"
                description="メッセージを受信した時"
                iconName="chatbubble-ellipses"
                iconColor="#10B981"
                value={notificationSettings.msgNotif}
                onValueChange={(val) => updateSetting('notificationSettings', 'msgNotif', val)}
              />
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionHeader}>その他の通知</Text>
              <ToggleRow
                title="メール通知"
                description="アプリ未読時にメールでお知らせ"
                iconName="mail"
                iconColor="#6B7280"
                value={notificationSettings.emailNotif}
                onValueChange={(val) => updateSetting('notificationSettings', 'emailNotif', val)}
              />
            </View>
          </ScrollView>

        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5F7FA', },
  safeArea: { flex: 1, backgroundColor: '#FFF', },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16,
    paddingVertical: 12, backgroundColor: '#FFF',
  },
  backButton: { padding: 4, },
  headerTitle: { fontSize: 17, fontWeight: '700', color: '#333', },
  tabContainer: {
    flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: '#EEE', backgroundColor: '#FFF', position: 'relative',
  },
  tab: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 14, },
  tabText: { fontSize: 14, fontWeight: '600', color: '#999', },
  activeTabText: { color: '#4A90E2', },
  indicator: {
    position: 'absolute', bottom: 0, left: 0, height: 3, width: '50%', backgroundColor: '#4A90E2',
    borderTopLeftRadius: 3, borderTopRightRadius: 3,
  },
  content: { padding: 24, paddingBottom: 40, backgroundColor: '#F5F7FA', },
  section: {
    backgroundColor: '#FFF', borderRadius: 16, paddingHorizontal: 16, paddingVertical: 8, marginBottom: 20,
    borderWidth: 1, borderColor: '#EFEFEF',
  },
  sectionHeader: {
    fontSize: 11, fontWeight: '700', color: '#999', marginTop: 12, marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5,
  },
  row: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 16,
    borderBottomWidth: 1, borderBottomColor: '#F5F7FA',
  },
  linkRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 16, },
  rowLeft: { flexDirection: 'row', alignItems: 'center', flex: 1, paddingRight: 16, },
  iconContainer: {
    width: 36, height: 36, borderRadius: 10, justifyContent: 'center', alignItems: 'center', marginRight: 12,
  },
  textContainer: { flex: 1, },
  titleRow: { flexDirection: 'row', alignItems: 'center', },
  rowTitle: { fontSize: 14, fontWeight: '600', color: '#333', marginBottom: 2, },
  rowDesc: { fontSize: 11, color: '#999', lineHeight: 16, },
  premiumBadge: {
    backgroundColor: '#FBBF24', paddingHorizontal: 4, paddingVertical: 1, borderRadius: 4, marginLeft: 6,
  },
  premiumText: { color: '#FFF', fontSize: 8, fontWeight: '700', },
  ghostCard: {
    backgroundColor: '#FFF', borderRadius: 16, padding: 16, marginBottom: 20, borderWidth: 1, borderColor: '#EFEFEF',
  },
  ghostCardActive: { backgroundColor: '#4338CA', borderWidth: 0, },
  ghostHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', },
  ghostTitle: { fontSize: 15, fontWeight: '700', color: '#333', },
  ghostDesc: { fontSize: 11, color: '#666', marginTop: 2, },
  infoBox: {
    flexDirection: 'row', backgroundColor: 'rgba(74, 144, 226, 0.1)', borderRadius: 16, padding: 16,
    marginBottom: 20, alignItems: 'flex-start',
  },
  infoTitle: { fontSize: 13, fontWeight: '700', color: '#4A90E2', marginBottom: 2, },
  infoDesc: { fontSize: 11, color: '#555', lineHeight: 16, },
  badgeCount: {
    backgroundColor: '#F3F4F6', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6, marginRight: 8,
  },
  badgeCountText: { fontSize: 12, fontWeight: '600', color: '#666', }
});