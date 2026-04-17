import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import {
  View, Text, StyleSheet, ScrollView, Image, TouchableOpacity, Dimensions, ActivityIndicator, Alert,
  Platform, StatusBar, Animated
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

import { getAuth, } from '@react-native-firebase/auth';
import {
  getFirestore, collection, doc, getDoc, getDocs, onSnapshot, query, orderBy, limit,
  addDoc, serverTimestamp, deleteDoc,
} from '@react-native-firebase/firestore';
import { calculateSynchroPercentage } from '../utils/Math';

const { width } = Dimensions.get('window');
const DEFAULT_MALE_IMAGE = require('../assets/man.png');
const DEFAULT_FEMALE_IMAGE = require('../assets/woman.png');

interface UserProfile {
  id: string; displayName?: string; photoURL?: string; gender?: string | number; birthDate?: any; location?: string;
  compatibility?: number; bio?: string; occupation?: string; bloodType?: string; height?: number; question?: string;
  interests?: string[]; isOnline?: boolean; matchRate?: number; mainPhotoStatus?: string;
}

interface FootprintItem { id: string; userId: string; createdAt: any; tab: string; user: UserProfile; }

interface FootprintCardProps {
  item: FootprintItem; isLiked: boolean; onLike: (userId: string) => void; navigation: any; tab?: string;
}

const formatTime = (timestamp: any) => {
  if (!timestamp) return 'たった今';
  const date = timestamp.toDate ? timestamp.toDate() : (timestamp ? new Date(timestamp) : new Date());
  const now = new Date();
  const isSameDay = date.getFullYear() === now.getFullYear() && date.getMonth() === now.getMonth() && date.getDate() === now.getDate();
  const diffMs = Math.max(now.getTime() - date.getTime());
  const diffMinutes = Math.floor(diffMs / (1000 * 60));

  if (diffMinutes < 1) {
    return 'たった今';
  }

  if (diffMinutes >= 1 && diffMinutes <= 9) {
    return `${diffMinutes}分前`;
  }

  if (isSameDay) {
    const hours = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');
    return `${hours}:${minutes}`;
  }

  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const tergetDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const diffDays = Math.floor(today.getTime() - tergetDate.getTime()) / (1000 * 60 * 60 * 24);

  return `${Math.min(diffDays || 7)}日前`;
};

const isNewFootprint = (timestamp: any) => {
  if (!timestamp) return true;
  const date = timestamp.toDate ? timestamp.toDate() : (timestamp ? new Date(timestamp) : new Date());
  const now = new Date();
  return (
    date.getDate() === now.getDate() &&
    date.getMonth() === now.getMonth() &&
    date.getFullYear() === now.getFullYear()
  );
};

const isOlderThan7Days = (timestamp: any) => {
  if (!timestamp) return false;
  const date = timestamp.toDate ? timestamp.toDate() : (timestamp ? new Date(timestamp) : new Date());
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const targetDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const diffMs = today.getTime() - targetDate.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  return diffDays > 7;
};

const calculateAge = (birthDate: any) => {
  if (!birthDate) return '??';
  const birth = birthDate.toDate ? birthDate.toDate() : new Date(birthDate);
  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  if (today.getMonth() < birth.getMonth() || (today.getMonth() === birth.getMonth() && today.getDate() < birth.getDate())) age--;
  return age;
};

const FootprintCard: React.FC<FootprintCardProps> = ({ item, isLiked, onLike, navigation }) => {
  const getImageSource = (item: any) => {
    if (!item.user.photoURL) return DEFAULT_MALE_IMAGE;

    const userImage = item.user.photoURL;
    const photoStatus = item.user.mainPhotoStatus;

    if (userImage && photoStatus === 'approved') {
      if (typeof userImage === 'string' && userImage.startsWith('http')) return { uri: userImage };
      if (typeof userImage === 'number') return userImage;
    }

    if (item.user.gender === 'female' || item.user.gender === '女性') {
      return DEFAULT_FEMALE_IMAGE;
    }
    return DEFAULT_MALE_IMAGE;
  };

  const timeDisplay = formatTime(item.createdAt);
  const isNew = isNewFootprint(item.createdAt);

  return (
    <TouchableOpacity
      style={styles.card}
      activeOpacity={0.9}
      onPress={() => {
        navigation.navigate('UserProfile', {
          userId: item.userId,
        });
      }}
    >
      {isNew && item.tab !== 'sent' && (
        <View style={styles.newBadge}>
          <Text style={styles.newBadgeText}>NEW</Text>
        </View>
      )}

      <View style={styles.avatarContainer}>
        <Image source={getImageSource(item)} style={styles.avatar} />
        {item.user.isOnline && <View style={styles.onlineBadge} />}
      </View>

      <View style={styles.infoContainer}>
        <View style={styles.infoHeader}>
          <View style={styles.nameRow}>
            <Text style={styles.name} numberOfLines={1}>{item.user.displayName || '未設定'}</Text>
            <Text style={styles.age}>{calculateAge(item.user.birthDate)}歳</Text>
          </View>
          <View style={styles.timeBadge}>
            <Ionicons name="time-outline" size={10} color="#999" style={{ marginRight: 2 }} />
            <Text style={styles.timeText}>{timeDisplay}</Text>
          </View>
        </View>

        <Text style={styles.subInfo}>
          {item.user.location || '未設定'}・{item.user.occupation || '未設定'}
        </Text>

        <View style={styles.matchHint}>
          <MaterialCommunityIcons name="percent-circle-outline" size={12} color="#4A90E2" style={{ marginRight: 4 }} />
          <Text style={styles.matchHintText}>SENSE MATCH率 <Text style={styles.matchRateBold}>{item.user.matchRate}%</Text></Text>
        </View>
      </View>
    </TouchableOpacity>
  );
};

const BlurredCard = ({ item }: { item?: FootprintItem }) => (
  <View style={styles.blurredCardContainer}>
    <View style={styles.blurredCard}>
      <View style={styles.blurAvatar} />
      <View style={styles.blurInfo}>
        <View style={styles.blurLineLong} />
        <View style={styles.blurLineShort} />
      </View>
      <View style={styles.blurButton} />
    </View>
    <View style={styles.blurTimeOverlay}>
      <Text style={styles.blurTimeText}>{item ? formatTime(item.createdAt) : ''}</Text>
    </View>
  </View>
);

export default function FootprintsScreen({ navigation }: { navigation: any }) {
  const [activeTab, setActiveTab] = useState<'received' | 'sent'>('received');
  const [receivedFootprints, setReceivedFootprints] = useState<FootprintItem[]>([]);
  const [sentFootprints, setSentFootprints] = useState<FootprintItem[]>([]);
  const [loadingReceived, setLoadingReceived] = useState(true);
  const [loadingSent, setLoadingSent] = useState(true);

  const [todayCount, setTodayCount] = useState(0);
  const [sentLikes, setSentLikes] = useState<Set<string>>(new Set());

  const [tick, setTick] = useState(0);

  const scrollViewRef = useRef<ScrollView>(null);
  const scrollX = useRef(new Animated.Value(0)).current;

  useFocusEffect(
    useCallback(() => {
      setTick(prev => prev + 1);
      const interval = setInterval(() => {
        setTick(prev => prev + 1);
      }, 60000);

      return () => clearInterval(interval);
    }, [])
  );

  useEffect(() => {
    const auth = getAuth();
    const db = getFirestore();
    const user = auth.currentUser;

    if (!user) {
      setLoadingReceived(false);
      setLoadingSent(false);
      return;
    }

    setLoadingReceived(true);
    setLoadingSent(true);

    const fetchLikes = async () => {
      try {
        const sentLikesRef = collection(db, 'users', user.uid, 'sentLikes');
        const likesSnapshot = await getDocs(sentLikesRef);
        const likedIds = new Set<string>(likesSnapshot.docs.map((doc: any) => doc.data().targetUserId || doc.id));
        setSentLikes(likedIds);
      } catch (e) {
        console.error("Error fetching likes:", e);
      }
    };
    fetchLikes();

    const receivedRef = collection(db, 'users', user.uid, 'footprints_received');
    const receivedQuery = query(receivedRef, orderBy('createdAt', 'desc'), limit(50));

    const unsubscribeReceived = onSnapshot(receivedQuery, async (snapshot) => {
      if (!snapshot) {
        setLoadingReceived(false);
        return;
      }
      try {
        const mySenseDataRef = doc(db, 'users', user.uid, 'senseData', 'profile');
        const mySenseDataSnap = await getDoc(mySenseDataRef);
        const myVector = mySenseDataSnap.exists() ? mySenseDataSnap.data()?.senseVector : null;

        const items = await Promise.all(snapshot.docs.map(async (docSnap: any) => {
          const data = docSnap.data();
          const timestamp = data.createdAt;

          if (isOlderThan7Days(timestamp)) {
            try {
              await deleteDoc(doc(db, 'users', user.uid, 'footprints_received', docSnap.id));
            } catch (err) {
              console.error("古い足跡あとの削除に失敗しました(received):", err);
            }
            return null;
          }

          const targetUserId = data.visitorId || docSnap.id;
          if (targetUserId === user.uid) return null;

          const userDocRef = doc(db, 'users', targetUserId);
          const userDoc = await getDoc(userDocRef);
          if (!userDoc.exists()) return null;

          const userData = userDoc.data();

          const otherSenseDataRef = doc(db, 'users', targetUserId, 'senseData', 'profile');
          const otherSenseDataSnap = await getDoc(otherSenseDataRef);
          const otherVector = otherSenseDataSnap.exists() ? otherSenseDataSnap.data()?.senseVector : null;

          let calculatedMatchRate = 0;
          if (myVector && otherVector) {
            calculatedMatchRate = calculateSynchroPercentage(myVector, otherVector);
          }

          return {
            id: docSnap.id,
            userId: targetUserId,
            createdAt: timestamp,
            tab: 'received',
            user: {
              ...userData,
              matchRate: calculatedMatchRate > 0 ? calculatedMatchRate : 0,
              id: targetUserId
            } as UserProfile,
          } as FootprintItem;
        }));

        const validItems = items.filter((i: any) => i !== null) as FootprintItem[];
        setReceivedFootprints(validItems);
        const count = validItems.filter(i => isNewFootprint(i.createdAt)).length;
        setTodayCount(count);
      } catch (error) {
        console.error("Error processing received footprints:", error);
      } finally {
        setLoadingReceived(false);
      }
    }, (error) => {
      console.error("Received footprints error:", error);
      setLoadingReceived(false);
    });

    // 【変更点】: 自分からの足あと監視 (モジュラーAPI & 個別監視)
    const sentRef = collection(db, 'users', user.uid, 'footprints_sent');
    const sentQuery = query(sentRef, orderBy('createdAt', 'desc'), limit(50));

    const unsubscribeSent = onSnapshot(sentQuery, async (snapshot) => {
      if (!snapshot) {
        setLoadingSent(false);
        return;
      }
      try {
        const mySenseDataRef = doc(db, 'users', user.uid, 'senseData', 'profile');
        const mySenseDataSnap = await getDoc(mySenseDataRef);
        const myVector = mySenseDataSnap.exists() ? mySenseDataSnap.data()?.senseVector : null;

        const items = await Promise.all(snapshot.docs.map(async (docSnap: any) => {
          const data = docSnap.data();
          const timestamp = data.createdAt;

          if (isOlderThan7Days(timestamp)) {
            try {
              await deleteDoc(doc(db, 'users', user.uid, 'footprints_sent', docSnap.id));
            } catch (err) {
              console.error("古い足あとの削除に失敗しました(sent):", err);
            }
            return null;
          }

          const targetUserId = data.visitedId || docSnap.id;
          if (targetUserId === user.uid) return null;

          const userDocRef = doc(db, 'users', targetUserId);
          const userDoc = await getDoc(userDocRef);
          if (!userDoc.exists()) return null;

          const userData = userDoc.data();

          const otherSenseDataRef = doc(db, 'users', targetUserId, 'senseData', 'profile');
          const otherSenseDataSnap = await getDoc(otherSenseDataRef);
          const otherVector = otherSenseDataSnap.exists() ? otherSenseDataSnap.data()?.senseVector : null;

          let calculatedMatchRate = 0;
          if (myVector && otherVector) {
            calculatedMatchRate = calculateSynchroPercentage(myVector, otherVector);
          }

          return {
            id: docSnap.id,
            userId: targetUserId,
            createdAt: timestamp,
            tab: 'sent',
            user: {
              ...userData,
              matchRate: calculatedMatchRate > 0 ? calculatedMatchRate : 0,
              id: targetUserId
            } as UserProfile,
          } as FootprintItem;
        }));

        const validItems = items.filter((i: any) => i !== null) as FootprintItem[];
        setSentFootprints(validItems);
      } catch (error) {
        console.error("Error processing sent footprints:", error);
      } finally {
        setLoadingSent(false);
      }
    }, (error) => {
      console.error("Sent footprints error:", error);
      setLoadingSent(false);
    });

    return () => {
      unsubscribeReceived();
      unsubscribeSent();
    };
  }, []);

  const handleLike = async (targetUserId: string) => {
    try {
      const auth = getAuth();
      const db = getFirestore();
      const currentUser = auth.currentUser;
      if (!currentUser) return;

      const queueRef = collection(db, 'likes_queue');
      await addDoc(queueRef, {
        fromUserId: currentUser.uid,
        toUserId: targetUserId,
        answer: null,
        createdAt: serverTimestamp(),
        status: 'pending'
      });

      const newSet = new Set(sentLikes);
      newSet.add(targetUserId);
      setSentLikes(newSet);

      Alert.alert("送信完了", "いいねを送りました！");
    } catch (error) {
      Alert.alert("エラー", "送信に失敗しました");
    }
  };

  const handleTabPress = (tabName: 'received' | 'sent', index: number) => {
    setActiveTab(tabName);
    scrollViewRef.current?.scrollTo({ x: index * width, animated: true });
  };

  const handleScrollEnd = (event: any) => {
    const offsetX = event.nativeEvent.contentOffset.x;
    const pageIndex = Math.round(offsetX / width);
    if (pageIndex === 0 && activeTab !== 'received') setActiveTab('received');
    if (pageIndex === 1 && activeTab !== 'sent') setActiveTab('sent');
  };

  const indicatorTranslateX = scrollX.interpolate({
    inputRange: [0, width],
    outputRange: [0, width / 2],
  });

  return (
    <View style={styles.container}>
      <SafeAreaView style={styles.safeArea}>

        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
            <Ionicons name="chevron-back" size={28} color="#333" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>足あと</Text>
          <View />
        </View>

        <View style={styles.summaryContainer}>
          <View style={styles.summaryLeft}>
            <View style={styles.summaryIcon}>
              <Ionicons name="footsteps" size={20} color="#4A90E2" />
            </View>
            <View>
              <Text style={styles.summaryLabel}>本日のお相手からの足あと</Text>
              <View style={{ flexDirection: 'row', alignItems: 'baseline' }}>
                <Text style={styles.summaryValue}>{todayCount}</Text>
                <Text style={styles.summaryUnit}>人</Text>
              </View>
            </View>
          </View>
          {todayCount >= 5 && (
            <View style={styles.summaryBadge}>
              <Ionicons name="trending-up" size={12} color="#EF4444" style={{ marginRight: 4 }} />
              <Text style={styles.summaryBadgeText}>注目度UP中！</Text>
            </View>
          )}
        </View>

        <View style={styles.tabContainer}>
          <TouchableOpacity
            style={styles.tabButton}
            onPress={() => handleTabPress('received', 0)}
          >
            <Text style={[styles.tabText, activeTab === 'received' && styles.activeTabText]}>相手から</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.tabButton}
            onPress={() => handleTabPress('sent', 1)}
          >
            <Text style={[styles.tabText, activeTab === 'sent' && styles.activeTabText]}>自分から</Text>
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

        {loadingReceived || loadingSent ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#4A90E2" />
          </View>
        ) : (
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
            style={styles.scrollViewWrapper}
          >
            <View style={{ width, flex: 1 }}>
              <ScrollView contentContainerStyle={styles.content}>
                {receivedFootprints.length === 0 ? (
                  <View style={styles.emptyContainer}>
                    <Ionicons name="paw-outline" size={48} color="#DDD" />
                    <Text style={styles.emptyText}>まだ足あとはありません</Text>
                  </View>
                ) : (
                  <>
                    {receivedFootprints.map((item, index) => {
                      if (index < 3) {
                        return (
                          <FootprintCard
                            key={item.id}
                            item={item}
                            isLiked={sentLikes.has(item.user.id)}
                            onLike={handleLike}
                            navigation={navigation}
                          />
                        );
                      }
                      if (index === 3) {
                        return (
                          <View key={`premium-trigger-${item.id}`}>
                            <View style={styles.premiumOverlayContainer}>
                              <View style={styles.premiumCard}>
                                <View style={styles.lockIconContainer}>
                                  <Ionicons name="lock-closed" size={24} color="#FFF" />
                                </View>
                                <Text style={styles.premiumTitle}>全ての足あとを見る</Text>
                                <Text style={styles.premiumDesc}>
                                  直近3件より前の足あとは{'\n'}プレミアムプラン限定で公開されています。
                                </Text>
                                <TouchableOpacity style={styles.premiumButton} activeOpacity={0.9}>
                                  <LinearGradient
                                    colors={['#4A90E2', '#63b3ed']}
                                    style={styles.premiumButtonGradient}
                                    start={{ x: 0, y: 0 }}
                                    end={{ x: 1, y: 0 }}
                                  >
                                    <MaterialCommunityIcons name="crown" size={18} color="#FFD700" style={{ marginRight: 6 }} />
                                    <Text style={styles.premiumButtonText}>プレミアムプラン詳細</Text>
                                  </LinearGradient>
                                </TouchableOpacity>
                              </View>
                            </View>
                            <BlurredCard item={item} />
                          </View>
                        );
                      }
                      return <BlurredCard key={item.id} item={item} />;
                    })}
                    <Text style={styles.footerNote}>足あとは過去1週間まで保存されます。</Text>
                  </>
                )}
              </ScrollView>
            </View>

            <View style={{ width, flex: 1 }}>
              <ScrollView contentContainerStyle={styles.content}>
                {sentFootprints.length === 0 ? (
                  <View style={styles.emptyContainer}>
                    <Ionicons name="paw-outline" size={48} color="#DDD" />
                    <Text style={styles.emptyText}>まだ足あとをつけていません</Text>
                  </View>
                ) : (
                  <>
                    {sentFootprints.map((item) => (
                      <FootprintCard
                        key={item.id}
                        item={item}
                        isLiked={sentLikes.has(item.user.id)}
                        onLike={handleLike}
                        navigation={navigation}
                      />
                    ))}
                    <Text style={styles.footerNote}>足あとは過去1週間まで保存されます。</Text>
                  </>
                )}
              </ScrollView>
            </View>
          </ScrollView>
        )}
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5F7FA', },
  safeArea: { flex: 1, backgroundColor: '#FFF', },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingTop: 50, },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16,
    paddingVertical: 12, backgroundColor: '#FFF', borderBottomWidth: 1, borderBottomColor: '#F0F0F0', zIndex: 100,
  },
  headerTitle: { fontSize: 17, fontWeight: '700', color: '#333', marginRight: 20, },
  backButton: { padding: 4, },
  menuButton: { padding: 4, },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.2)', justifyContent: 'flex-start', alignItems: 'flex-end', },
  menuContainer: {
    marginTop: Platform.OS === 'android' ? StatusBar.currentHeight! + 50 : 100, marginRight: 16, width: 140,
    backgroundColor: '#FFF', borderRadius: 12, shadowColor: "#000", shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15, shadowRadius: 12, elevation: 8, paddingVertical: 4,
  },
  menuItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, paddingHorizontal: 16, },
  menuText: { fontSize: 14, fontWeight: '600', color: '#333', },
  summaryContainer: {
    backgroundColor: '#F8FAFC', paddingHorizontal: 20, paddingVertical: 16,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
  },
  summaryLeft: { flexDirection: 'row', alignItems: 'center', },
  summaryIcon: {
    backgroundColor: '#FFF', padding: 8, borderRadius: 20, marginRight: 12, shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 2, elevation: 1,
  },
  summaryLabel: { fontSize: 11, color: '#666', fontWeight: '700', marginBottom: 2, },
  summaryValue: { fontSize: 20, fontWeight: '800', color: '#333', lineHeight: 24, },
  summaryUnit: { fontSize: 11, color: '#999', marginLeft: 3, },
  summaryBadge: {
    backgroundColor: '#FEF2F2', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 20,
    flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: '#FECACA',
  },
  summaryBadgeText: {
    color: '#EF4444', fontSize: 11, fontWeight: '700',
  },
  tabContainer: {
    flexDirection: 'row', backgroundColor: '#FFF', borderBottomWidth: 1, borderBottomColor: '#EEEEEE', position: 'relative',
  },
  tabButton: { flex: 1, paddingVertical: 14, alignItems: 'center', justifyContent: 'center', },
  tabText: { fontSize: 14, fontWeight: '600', color: '#999', },
  activeTabText: { color: '#4A90E2', fontWeight: '700', },
  indicator: {
    position: 'absolute', bottom: 0, left: 0, height: 3, width: '50%', backgroundColor: '#4A90E2',
    borderTopLeftRadius: 3, borderTopRightRadius: 3,
  },
  scrollViewWrapper: { flex: 1, backgroundColor: '#F5F7FA', },
  content: { padding: 16, paddingBottom: 40, },
  emptyContainer: { alignItems: 'center', justifyContent: 'center', paddingVertical: 60, },
  emptyText: { marginTop: 16, color: '#999', fontSize: 14, },
  card: {
    backgroundColor: '#FFF', borderRadius: 16, padding: 12, marginBottom: 12, flexDirection: 'row', alignItems: 'center',
    shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 8, elevation: 2,
    position: 'relative', overflow: 'hidden',
  },
  newBadge: {
    position: 'absolute', top: 0, left: 0, backgroundColor: '#EF4444', paddingHorizontal: 8, paddingVertical: 3,
    borderBottomRightRadius: 10, zIndex: 1,
  },
  newBadgeText: { color: '#FFF', fontSize: 10, fontWeight: '700', },
  avatarContainer: { marginRight: 14, position: 'relative', },
  avatar: { width: 56, height: 56, borderRadius: 28, backgroundColor: '#F0F0F0', },
  onlineBadge: {
    position: 'absolute', bottom: 0, right: 0, width: 14, height: 14, borderRadius: 7, backgroundColor: '#10B981',
    borderWidth: 2, borderColor: '#FFF',
  },
  infoContainer: { flex: 1, justifyContent: 'center', },
  infoHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4, },
  nameRow: { flexDirection: 'row', alignItems: 'center', flex: 1, },
  name: { fontSize: 15, fontWeight: '700', color: '#333', marginRight: 8, maxWidth: '70%', },
  age: { fontSize: 13, color: '#666', },
  timeBadge: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: '#F3F4F6', paddingHorizontal: 8,
    paddingVertical: 4, borderRadius: 12,
  },
  timeText: { fontSize: 10, color: '#888', fontWeight: '600', },
  subInfo: { fontSize: 12, color: '#888', marginBottom: 6, },
  matchHint: { flexDirection: 'row', alignItems: 'center', },
  matchHintText: { fontSize: 11, color: '#4A90E2', fontWeight: '600', },
  matchRateBold: { fontWeight: '800', fontSize: 12, },
  premiumOverlayContainer: { marginBottom: 20, paddingHorizontal: 4, },
  blurredCardContainer: { position: 'relative', },
  blurredCard: {
    backgroundColor: '#FFF', borderRadius: 16, padding: 12, marginBottom: 12, flexDirection: 'row',
    alignItems: 'center', opacity: 0.3,
  },
  blurAvatar: {
    width: 56, height: 56, borderRadius: 28, backgroundColor: '#999', marginRight: 14,
  },
  blurInfo: { flex: 1, },
  blurLineLong: { width: '70%', height: 14, backgroundColor: '#999', borderRadius: 4, marginBottom: 8, },
  blurLineShort: { width: '40%', height: 12, backgroundColor: '#CCC', borderRadius: 4, },
  blurButton: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#DDD', },
  blurTimeOverlay: { position: 'absolute', top: 16, right: 16, opacity: 0.5, },
  blurTimeText: { fontSize: 10, color: '#333', },
  premiumCard: {
    backgroundColor: '#FFF', borderRadius: 20, padding: 24, width: '100%', alignItems: 'center',
    shadowColor: "#4A90E2", shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.15, shadowRadius: 20,
    elevation: 8, borderWidth: 1, borderColor: '#EFF6FF',
  },
  lockIconContainer: {
    width: 50, height: 50, borderRadius: 25, backgroundColor: '#F59E0B', justifyContent: 'center', alignItems: 'center',
    marginBottom: 14, shadowColor: "#F59E0B", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3,
    shadowRadius: 8, elevation: 4,
  },
  premiumTitle: { fontSize: 16, fontWeight: '800', color: '#333', marginBottom: 6, },
  premiumDesc: {
    fontSize: 12, color: '#666', textAlign: 'center', lineHeight: 20, marginBottom: 20,
  },
  premiumButton: {
    width: '100%', borderRadius: 30, overflow: 'hidden', shadowColor: "#4A90E2", shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2, shadowRadius: 8, elevation: 4,
  },
  premiumButtonGradient: { paddingVertical: 14, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', },
  premiumButtonText: { color: '#FFF', fontSize: 14, fontWeight: '700', letterSpacing: 0.5, },
  footerNote: {
    textAlign: 'center', fontSize: 11, color: '#AAA', marginTop: 20, marginBottom: 40,
  }
});