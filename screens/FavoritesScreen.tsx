import React, { useState, useEffect } from 'react';
import { View, Text, FlatList, Image, TouchableOpacity, TextInput, StyleSheet, ActivityIndicator, Alert, } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { getAuth } from '@react-native-firebase/auth';
import { getFirestore, collection, onSnapshot, doc, getDoc, deleteDoc, } from '@react-native-firebase/firestore';
import { calculateSynchroPercentage } from '../utils/Math';

const DEFAULT_MALE_IMAGE = require('../assets/man.png');
const DEFAULT_FEMALE_IMAGE = require('../assets/woman.png');
const ONLINE_THRESHOLD_MINUTES = 10;

interface FavoriteData {
  id: string; name: string; img: any; addedAt: any; age: number | string; isOnline: boolean;
  location?: string; occupation?: string; matchRate?: number;
}

interface FavoritesScreenProps { navigation: any; }

export default function FavoritesScreen({ navigation }: FavoritesScreenProps) {
  const [favorites, setFavorites] = useState<FavoriteData[]>([]);
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
    const favoritesRef = collection(db, 'users', user.uid, 'favorites');

    const unsubscribe = onSnapshot(favoritesRef, async (snapshot) => {
      if (!snapshot || !snapshot.docs) {
        setLoading(false);
        return;
      }

      try {
        const mySenseDataRef = doc(db, 'users', user.uid, 'senseData', 'profile');
        const mySenseDataSnap = await getDoc(mySenseDataRef);
        const myVector = mySenseDataSnap.exists() ? mySenseDataSnap.data()?.senseVector : null;

        const promises = snapshot.docs.map(async (favoriteDoc: any) => {
          const data = favoriteDoc.data();
          const otherUserId = favoriteDoc.id;

          const userDocRef = doc(db, 'users', otherUserId);
          const userDocSnap = await getDoc(userDocRef);
          const userData = userDocSnap.exists() ? userDocSnap.data() : null;

          if (!userData) return null;

          const getImageSource = (userData: any) => {
            if (!userData) return DEFAULT_MALE_IMAGE;

            const userImage = userData.photoURL;
            const photoStatus = userData.mainPhotoStatus;

            if (userImage && photoStatus === 'approved') {
              if (typeof userImage === 'string' && userImage.startsWith('http')) return { uri: userImage };
              if (typeof userImage === 'number') return userImage;
            }

            if (userData.gender === 'female' || userData.gender === '女性') {
              return DEFAULT_FEMALE_IMAGE;
            }
            return DEFAULT_MALE_IMAGE;
          };

          const otherSenseDataRef = doc(db, 'users', otherUserId, 'senseData', 'profile');
          const otherSenseDataSnap = await getDoc(otherSenseDataRef);
          const otherVector = mySenseDataSnap.exists() ? otherSenseDataSnap.data()?.senseVector : null;

          let calculatedMatchRate = 0;
          if (myVector && otherVector) {
            calculatedMatchRate = calculateSynchroPercentage(myVector, otherVector);
          }

          return {
            id: favoriteDoc.id,
            name: userData.displayName || '名無しさん',
            img: getImageSource(userData),
            addedAt: data.createdAt || new Date(),
            age: calculateAge(userData.birthDate),
            isOnline: checkIsonline(userData.lastSeen),
            location: userData.location,
            occupation: userData.occupation,
            matchRate: calculatedMatchRate > 0 ? calculatedMatchRate : 0,
          } as FavoriteData;
        });

        const results = await Promise.all(promises);
        const validResults: FavoriteData[] = results.filter((item: any): item is FavoriteData => item !== null);

        // 新しく追加した順にソート
        validResults.sort((a, b) => {
          const dateA = a.addedAt?.toDate ? a.addedAt.toDate() : new Date(a.addedAt);
          const dateB = b.addedAt?.toDate ? b.addedAt.toDate() : new Date(b.addedAt);
          return dateB.getTime() - dateA.getTime();
        });

        setFavorites(validResults);
      } catch (error) {
        console.error("Error fetching favorites:", error);
      } finally {
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, []);

  // ★新規追加: お気に入り解除機能
  const handleRemoveFavorite = (favoriteId: string, name: string) => {
    Alert.alert(
      "お気に入り解除",
      `${name}さんをお気に入りから解除しますか？`,
      [
        { text: "キャンセル", style: "cancel" },
        {
          text: "解除する",
          style: "destructive",
          onPress: async () => {
            try {
              const auth = getAuth();
              const user = auth.currentUser;
              if (!user) return;

              const db = getFirestore();
              await deleteDoc(doc(db, 'users', user.uid, 'favorites', favoriteId));
            } catch (error) {
              Alert.alert("エラー", "解除に失敗しました");
            }
          }
        }
      ]
    );
  };

  const filteredFavorites = favorites.filter(item => {
    if (!searchKeyword) return true;
    const cleanName = item.name.replace(/\s+/g, '');
    const cleanKeyword = searchKeyword.replace(/\s+/g, '');
    return cleanName.includes(cleanKeyword);
  });

  const renderItem = ({ item }: { item: FavoriteData }) => (
    <TouchableOpacity
      activeOpacity={0.9}
      style={styles.card}
      onPress={() => navigation.navigate('UserProfile', { userId: item.id })} // ★編集箇所: チャットではなくプロフィール詳細へ遷移想定
    >
      <View style={styles.avatarContainer}>
        <Image source={item.img} style={styles.avatar} />
        {item.isOnline && <View style={styles.onlineBadge} />}
      </View>

      <View style={styles.infoContainer}>
        <View style={styles.infoHeader}>
          <View style={styles.nameRow}>
            <Text style={styles.name} numberOfLines={1}>{item.name}</Text>
            <Text style={styles.age}>{item.age}歳</Text>
          </View>

          {/* ★新規追加: お気に入り解除ボタン（スターアイコン） */}
          <TouchableOpacity
            style={styles.favoriteButton}
            onPress={() => handleRemoveFavorite(item.id, item.name)}
          >
            <Ionicons name="star" size={20} color="#F59E0B" />
          </TouchableOpacity>
        </View>

        <Text style={styles.subInfo}>
          {item.location || '未設定'} / {item.occupation || '未設定'}
        </Text>

        <View style={styles.matchHint}>
          <MaterialCommunityIcons name="percent-circle-outline" size={12} color="#4A90E2" style={{ marginRight: 4 }} />
          <Text style={styles.matchHintText}>SENSE MATCH率 <Text style={styles.matchRateBold}>{item.matchRate}%</Text></Text>
        </View>
      </View>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <SafeAreaView style={{ flex: 1 }} edges={['top', 'left', 'right']}>

        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
            <Ionicons name="chevron-back" size={28} color="#333" />
          </TouchableOpacity>
          {/* ★編集箇所: タイトル変更 */}
          <Text style={styles.headerTitle}>お気に入り</Text>
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
            data={filteredFavorites}
            keyExtractor={(item) => item.id}
            renderItem={renderItem}
            contentContainerStyle={styles.listContainer}
            showsVerticalScrollIndicator={false}
            ListEmptyComponent={
              <View style={styles.emptyContainer}>
                <View style={styles.emptyIconCircle}>
                  <Ionicons name="star-outline" size={32} color="#CCC" />
                </View>
                {/* ★編集箇所: 空の状態のテキスト変更 */}
                <Text style={styles.emptyText}>お気に入りに登録したお相手はいません</Text>
              </View>
            }
          />
        )}
      </SafeAreaView>
    </View>
  );
}

// スタイルはAllMatchesScreen.tsxのデザインを継承
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
  card: {
    backgroundColor: '#FFF',
    borderRadius: 16,
    padding: 12,
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
    position: 'relative',
    overflow: 'hidden',
  },
  avatarContainer: {
    marginRight: 14,
    position: 'relative',
  },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#F0F0F0',
  },
  onlineBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: '#10B981',
    borderWidth: 2,
    borderColor: '#FFF',
  },
  infoContainer: {
    flex: 1,
    justifyContent: 'center',
  },
  infoHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  name: {
    fontSize: 15,
    fontWeight: '700',
    color: '#333',
    marginRight: 8,
    maxWidth: '70%',
  },
  age: {
    fontSize: 13,
    color: '#666',
  },
  // ★新規追加: お気に入り解除ボタンのスタイル
  favoriteButton: {
    padding: 4,
    backgroundColor: 'rgba(245, 158, 11, 0.1)',
    borderRadius: 12,
  },
  subInfo: {
    fontSize: 12,
    color: '#888',
    marginBottom: 6,
  },
  matchHint: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  matchHintText: {
    fontSize: 11,
    color: '#4A90E2',
    fontWeight: '600',
  },
  matchRateBold: {
    fontWeight: '800',
    fontSize: 12,
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