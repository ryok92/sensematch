import React, { useState, useEffect } from 'react';
import { View, Text, FlatList, Image, TouchableOpacity, TextInput, StyleSheet, ActivityIndicator, } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Ionicons from 'react-native-vector-icons/Ionicons';
import MaterialCommunityIcons from 'react-native-vector-icons/Ionicons';
import { getAuth } from '@react-native-firebase/auth';
import { getFirestore, collection, query, where, orderBy, onSnapshot, doc, getDoc, } from '@react-native-firebase/firestore';
import { calculateSynchroPercentage } from '../utils/Math';

const DEFAULT_MALE_IMAGE = require('../assets/man.png');
const DEFAULT_FEMALE_IMAGE = require('../assets/woman.png');
const ONLINE_THRESHOLD_MINUTES = 10;

interface MatchData {
  id: string; name: string; img: any; createdAt: any; age: number | string; isOnline: boolean; otherUserId: string;
  isHidden: boolean; isDeleted: boolean; isNew: boolean; location?: string; occupation?: string; matchRate?: number;
}

interface AllMatchesScreenProps { navigation: any; }

export default function AllMatchesScreen({ navigation }: AllMatchesScreenProps) {
  const [matches, setMatches] = useState<MatchData[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [searchKeyword, setSearchKeyword] = useState<string>('');

  const calculateAge = (birthDate: any) => {
    if (!birthDate) return '??';
    const birth = birthDate.toDate ? birthDate.toDate() : new Date(birthDate);
    const today = new Date();
    let age = today.getFullYear() - birth.getFullYear();
    if (today.getMonth() < birth.getMonth() || (today.getMonth() === birth.getMonth() && today.getDate() < birth.getDate())) age--;
    return age;
  };

  const formatTime = (timestamp: any) => {
    if (!timestamp) return '';
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    const now = new Date();

    const isSameDay =
      now.getFullYear() === date.getFullYear() &&
      now.getMonth() === date.getMonth() &&
      now.getDate() === date.getDate();

    if (isSameDay) {
      const hours = date.getHours().toString().padStart(2, '0');
      const minutes = date.getMinutes().toString().padStart(2, '0');
      return `${hours}:${minutes}`;
    } else {
      const month = date.getMonth() + 1;
      const day = date.getDate();
      return `${month}月${day}日`;
    }
  };

  const checkIsonline = (lastSeenTimestamp: any) => {
    if (!lastSeenTimestamp) return false;

    const lastSeenDate = lastSeenTimestamp.toDate ? lastSeenTimestamp.toDate() : new Date(lastSeenTimestamp);
    const now = new Date();
    const diffMs = now.getTime() - lastSeenDate.getTime();
    const diffMinutes = diffMs / (1000 * 60);
    return diffMinutes <= ONLINE_THRESHOLD_MINUTES;
  };

  useEffect(() => {
    const auth = getAuth();
    const user = auth.currentUser;
    if (!user) {
      setLoading(false);
      return;
    }

    const db = getFirestore();
    const matchesRef = collection(db, 'matches');
    const matchesQuery = query(
      matchesRef,
      where('users', 'array-contains', user.uid),
      orderBy('lastMessageAt', 'desc')
    );

    const unsubscribe = onSnapshot(matchesQuery, async (snapshot) => {
      if (!snapshot || !snapshot.docs) {
        setLoading(false);
        return;
      }

      try {
        const mySenseDataRef = doc(db, 'users', user.uid, 'senseDate', 'profile');
        const mySenseDataSnap = await getDoc(mySenseDataRef);
        const myVector = mySenseDataSnap.exists() ? mySenseDataSnap.data()?.senseVector : null;

        const promises = snapshot.docs.map(async (matchDoc: any) => {
          const data = matchDoc.data();
          const otherUserId = data.users?.find((uid: string) => uid !== user.uid);
          if (!otherUserId) return null;

          const userDocRef = doc(db, 'users', otherUserId);
          const userDocSnap = await getDoc(userDocRef);
          const userData = userDocSnap.exists() ? userDocSnap.data() : null;

          let userImage = DEFAULT_MALE_IMAGE;
          const photoStatus = userData?.mainPhotoStatus;
          if (userData) {
            if (userData.photoURL && userData.photoURL.startsWith('http') && photoStatus === 'approved') {
              userImage = { uri: userData.photoURL };
            } else if (userData.gender === '女性' || userData.gender === 'female' || userData.gender === 2) {
              userImage = DEFAULT_FEMALE_IMAGE;
            }
          }

          const hiddenAtVal = data.hiddenAt && data.hiddenAt[user.uid];
          const hiddenAtMs = hiddenAtVal ? (hiddenAtVal.toDate ?
            hiddenAtVal.toDate().getTime() : new Date(hiddenAtVal).getTime()) : 0;
          const lastMessageAtMs = data.lastMessageAt ? (data.lastMessageAt.toDate ? data.lastMessageAt.toDate().getTime() :
            new Date(data.lastMessageAt).getTime()) : 0;
          const isHidden = hiddenAtMs > 0 && hiddenAtMs >= lastMessageAtMs;

          const deletedAtVal = data.deletedAt && data.deletedAt[user.uid];
          const deletedAtMs = deletedAtVal ? (deletedAtVal.toDate ? deletedAtVal.toDate().getTime() : new Date(deletedAtVal).getTime()) : 0;
          const isDeleted = deletedAtMs > 0 && deletedAtMs >= lastMessageAtMs;

          const isNew = data.lastMessage === 'マッチングが成立しました！';

          const otherSenseDataRef = doc(db, 'users', otherUserId, 'senseDate', 'profile');
          const otherSenseDataSnap = await getDoc(otherSenseDataRef);
          const otherVector = otherSenseDataSnap.exists() ? otherSenseDataSnap.data()?.senseVector : null;

          let calculatedMatchRate = 0;
          if (myVector && otherVector) {
            calculatedMatchRate = calculateSynchroPercentage(myVector, otherVector);
          }
          return {
            id: matchDoc.id,
            name: userData ? (userData.displayName || '名無しさん') : '退会済みユーザー',
            img: userImage,
            createdAt: data.createdAt,
            age: userData ? calculateAge(userData.birthDate) : '',
            isOnline: userData ? checkIsonline(userData.lastSeen) : false,
            otherUserId: otherUserId,
            isHidden: isHidden,
            isDeleted: isDeleted,
            isNew: isNew,
            location: userData?.location,
            occupation: userData?.occupation,
            matchRate: calculatedMatchRate > 0 ? calculatedMatchRate : 0,
          } as MatchData;
        });

        const results = await Promise.all(promises);
        const validResults: MatchData[] = results.filter((item: any): item is MatchData => item !== null);

        validResults.sort((a, b) => {
          const dateA = a.createdAt ? (a.createdAt.toDate ?
            a.createdAt.toDate() : new Date(a.createdAt)) : new Date(0);
          const dateB = b.createdAt ? (b.createdAt.toDate ?
            b.createdAt.toDate() : new Date(b.createdAt)) : new Date(0);

          return dateB.getTime() - dateA.getTime();
        });

        setMatches(validResults);
      } catch (error) {
        console.error("Error fetching all matches:", error);
      } finally {
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, []);

  const filteredMatches = matches.filter(item => {
    if (!searchKeyword) return true;
    const cleanName = item.name.replace(/\s+/g, '');
    const cleanKeyword = searchKeyword.replace(/\s+/g, '');
    return cleanName.includes(cleanKeyword);
  });

  const renderItem = ({ item }: { item: MatchData }) => (
    <View style={styles.cardContainer}>
      {item.isNew && (
        <View style={styles.newBadge}>
          <Text style={styles.newBadgeText}>NEW</Text>
        </View>
      )}

      <TouchableOpacity style={styles.profileSection} activeOpacity={0.7}
        onPress={() => navigation.navigate('UserProfile', { userId: item.otherUserId })}>
        <View style={styles.avatarContainer}>
          <Image source={item.img} style={styles.avatar} resizeMode="cover" />
          {item.isOnline && <View style={styles.onlineBadge} />}
        </View>

        <View style={styles.profileInfo}>
          <View style={styles.nameRow}>
            <Text style={styles.userName} numberOfLines={1}>{item.name}</Text>
            <Text style={styles.ageText}>{item.age}歳</Text>
          </View>

          <Text style={styles.subInfoText} numberOfLines={1}>
            {item.location || '未設定'}・{item.occupation || '未設定'}
          </Text>

          <View style={styles.bottomInfoRow}>
            <View style={styles.dateRow}>
              <Ionicons name="time-outline" size={12} color="#94A3B8" />
              <Text style={styles.dateText}>{formatTime(item.createdAt)}</Text>
            </View>
            <View style={styles.matchHint}>
              <MaterialCommunityIcons name="percent-circle-outline" size={12} color="#4A90E2" style={{ marginRight: 2 }} />
              <Text style={styles.matchHintText}>SENSE MATCH率<Text style={styles.matchRateBold}>{item.matchRate}%</Text></Text>
            </View>
          </View>
        </View>
        <Ionicons name="chevron-forward" size={18} color="CBD5E1" style={styles.chevronIcon} />
      </TouchableOpacity>

      <View style={styles.divider} />

      <TouchableOpacity style={styles.actionButtonSection} activeOpacity={0.7}
        onPress={() => navigation.navigate('Chat', {
          matchId: item.id,
          recipientId: item.otherUserId,
          recipientName: item.name,
          recipientImage: item.img
        })}
      >
        <View style={styles.actionIconBg}>
          <Ionicons name="chatbubble-ellipses" size={20} color="#4A90E2" />
        </View>
      </TouchableOpacity>
    </View>
  );

  return (
    <View style={styles.container}>
      <SafeAreaView style={{ flex: 1 }} edges={['top', 'left', 'right']}>

        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
            <Ionicons name="chevron-back" size={28} color="#333" />
          </TouchableOpacity>

          <Text style={styles.headerTitle}>すべてのマッチング</Text>

          <View style={{ width: 36 }} />
        </View>

        <View style={styles.searchContainer}>
          <View style={styles.searchBar}>
            <Ionicons name="search" size={18} color="#999" />

            <TextInput
              style={styles.searchInput}
              placeholder="お相手の名前で検索..."
              placeholderTextColor="#999"
              value={searchKeyword}
              onChangeText={setSearchKeyword}
            />
          </View>
        </View>

        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#4A90E2" />
          </View>
        ) : (
          <FlatList
            data={filteredMatches}
            keyExtractor={(item) => item.id}
            renderItem={renderItem}
            contentContainerStyle={styles.listContainer}
            showsVerticalScrollIndicator={false}
            ListEmptyComponent={
              <View style={styles.emptyContainer}>
                <View style={styles.emptyIconCircle}>
                  <Ionicons name="search" size={32} color="#CCC" />
                </View>

                <Text style={styles.emptyText}>お相手が見つかりません</Text>
              </View>
            }
          />
        )}
      </SafeAreaView>
    </View>
  );
}



const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F7FA',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 12,
    backgroundColor: '#FFF',
    borderBottomWidth: 1,
    borderBottomColor: '#F5F7FA',
    zIndex: 10,
  },
  backButton: {
    padding: 4,
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#333',
  },
  searchContainer: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: '#FFF',
    borderBottomWidth: 1,
    borderBottomColor: '#F5F7FA',
  },
  searchBar: {
    backgroundColor: '#F5F7FA',
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    height: 44,
  },
  searchInput: {
    flex: 1,
    marginLeft: 8,
    color: '#333',
    fontSize: 15,
  },
  listContainer: {
    padding: 16,
    paddingBottom: 40,
  },
  cardContainer: {
    flexDirection: 'row', backgroundColor: '#FFFFFF', borderRadius: 20, marginBottom: 12, borderWidth: 1, borderColor: '#F1F5F9',
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowRadius: 8, elevation: 2, position: 'relative', overflow: 'hidden',
  },
  newBadge: {
    position: 'absolute', top: 0, left: 0, backgroundColor: '#EF4444', paddingHorizontal: 8, paddingVertical: 3,
    borderBottomRightRadius: 10, zIndex: 1,
  },
  newBadgeText: { color: '#FFF', fontSize: 10, fontWeight: '700', },
  profileSection: { flex: 1, flexDirection: 'row', alignItems: 'center', padding: 14, },
  avatarContainer: { marginRight: 12, position: 'relative', },
  avatar: { width: 52, height: 52, borderRadius: 26, backgroundColor: '#F1F5F9', borderWidth: 1, borderColor: '#E2E8F0', },
  onlineBadge: {
    position: 'absolute', bottom: 0, right: 0, width: 14, height: 14, borderRadius: 7, backgroundColor: '#10B981',
    borderWidth: 2, borderColor: '#FFF',
  },
  profileInfo: { flex: 1, },
  nameRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 4, },
  userName: { fontSize: 15, fontWeight: '700', color: '#1E293B', marginRight: 6, flexShrink: 1, },
  ageText: { fontSize: 12, color: '#64748B', },
  subInfoText: { fontSize: 12, color: '#64748B', marginBottom: 6, },
  bottomInfoRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 8, },
  dateRow: { flexDirection: 'row', alignItems: 'center', },
  dateText: { fontSize: 11, color: '#64748B', marginLeft: 4, fontWeight: '500', },
  matchHint: { flexDirection: 'row', alignItems: 'center', },
  matchHintText: { fontSize: 11, color: '#4A90E2', fontWeight: '600', },
  matchRateBold: { fontWeight: '800', fontSize: 11, },
  chevronIcon: { marginLeft: 4, },
  divider: { width: 1, backgroundColor: '#F1F5F9', marginVertical: 12, },
  actionButtonSection: { width: 76, justifyContent: 'center', alignItems: 'center', },
  actionIconBg: {
    width: 44, height: 44, borderRadius: 22, backgroundColor: '#EFF6FF', borderWidth: 1, borderColor: '#DBEAFE',
    justifyContent: 'center', alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05, shadowRadius: 4, elevation: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 80,
  },
  emptyIconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#F8FAFC',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  emptyText: {
    fontSize: 15,
    color: '#94A3B8',
    fontWeight: '500',
  },
});