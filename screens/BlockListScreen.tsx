import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, Image, TouchableOpacity, Alert, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Ionicons from 'react-native-vector-icons/Ionicons';
import auth from '@react-native-firebase/auth';
import firestore from '@react-native-firebase/firestore';

const DEFAULT_MALE_IMAGE = require('../assets/man.png');
const DEFAULT_FEMALE_IMAGE = require('../assets/woman.png');

interface BlockedUser {
  id: string; name: string; image: any; blockedAt: Date;
}

interface BlockListScreenProps {
  navigation: any;
}

export default function BlockListScreen({ navigation }: BlockListScreenProps) {
  const [blockedUsers, setBlockedusers] = useState<BlockedUser[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    const user = auth().currentUser;
    if (!user) {
      setLoading(false);
      return
    }

    const unsubscribe = firestore().collection('users').doc(user.uid).collection('blockedUsers').orderBy('blockedAt', 'desc').onSnapshot(async (snapshot) => {
      if (!snapshot || snapshot.empty) {
        setBlockedusers([]);
        setLoading(false);
        return;
      }

      try {
        const blockedDataMap = new Map<string, any>();
        const blockedUserIds: string[] = [];

        snapshot.docs.forEach(doc => {
          blockedUserIds.push(doc.id);
          blockedDataMap.set(doc.id, doc.data());
        });

        const chunkArray = (array: string[], size: number) => {
          const result = [];
          for (let i = 0; i < array.length; i += size) {
            result.push(array.slice(i, i + size));
          }
          return result;
        };

        const chunks = chunkArray(blockedUserIds, 10)
        let latestBlockedUsers: BlockedUser[] = [];

        for (const chunk of chunks) {
          const usersSnap = await firestore().collection('users').where(firestore.FieldPath.documentId(), 'in', chunk).get();

          const usersDataMap = new Map<string, any>();
          usersSnap.docs.forEach(userDoc => {
            usersDataMap.set(userDoc.id, userDoc.data());
          });

          chunk.forEach(targetUserId => {
            const userData = usersDataMap.get(targetUserId);
            const blockedData = blockedDataMap.get(targetUserId);

            let userImage = DEFAULT_MALE_IMAGE;
            let name = blockedData?.name || '退会済みユーザー';

            if (userData) {
              name = userData.displayName || name;
              if (userData.photoURL && typeof userData.photoURL === 'string' && userData.photoURL.startsWith('http')) {
                userImage = { uri: userData.photoURL };
              } else if (userData.gender === '女性' || userData.gender === 'female' || userData.gender === 2) {
                userImage = DEFAULT_FEMALE_IMAGE;
              }
            }

            latestBlockedUsers.push({
              id: targetUserId,
              name: name,
              image: userImage,
              blockedAt: blockedData?.blockedAt?.toDate() || new Date(),
            });
          });
        }

        latestBlockedUsers.sort((a, b) => b.blockedAt.getTime() - a.blockedAt.getTime());
        setBlockedusers(latestBlockedUsers);
      } catch (error) {
        console.error("Error fetching blocked users:", error);
      } finally {
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, []);

  const handleUnblock = (userId: string, userName: string) => {
    Alert.alert(
      "ブロック解除",
      `${userName}さんのブロックを解除しますか？`,
      [
        { text: "キャンセル", style: "cancel" },
        {
          text: "解除する",
          style: "destructive",
          onPress: async () => {
            try {
              const currentUser = auth().currentUser;
              if (!currentUser) return;

              await firestore()
                .collection('users')
                .doc(currentUser.uid)
                .collection('blockedUsers')
                .doc(userId)
                .delete();
            } catch (error) {
              console.error("Unblock error:", error);
              Alert.alert("エラー", "ブロックの解除に失敗しました。");
            }
          }
        }
      ]
    );
  };

  const renderItem = ({ item }: { item: BlockedUser }) => {
    const dateStr = item.blockedAt.toLocaleDateString('ja-JP', {
      year: 'numeric', month: 'short', day: 'numeric'
    });

    return (
      <View style={styles.userCard}>
        <Image source={item.image} style={styles.avatar} />

        <View style={styles.userInfo}>
          <Text style={styles.userName} numberOfLines={1}>{item.name}</Text>
          <Text style={styles.blockDate}>ブロック日: {dateStr}</Text>
        </View>

        <TouchableOpacity
          style={styles.unblockButton}
          onPress={() => handleUnblock(item.id, item.name)}
        >
          <Text style={styles.unblockButtonText}>解除</Text>
        </TouchableOpacity>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <SafeAreaView style={styles.safeArea}>

        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
            <Ionicons name="chevron-back" size={28} color="#333" />
          </TouchableOpacity>

          <Text style={styles.headerTitle}>ブロックリスト</Text>

          <View style={{ width: 40 }} />
        </View>

        {loading ? (
          <View style={styles.centerContainer}>
            <ActivityIndicator size="large" color="#EF4444" />
          </View>
        ) : blockedUsers.length === 0 ? (
          <View style={styles.centerContainer}>
            <View style={styles.emptyIconCircle}>
              <Ionicons name="shield-checkmark-outline" size={48} color="#D1D5DB" />
            </View>

            <Text style={styles.emptyTitle}>ブロックしたユーザーはいません</Text>
            <Text style={styles.emptyText}>安心してサービスをご利用ください</Text>
          </View>
        ) : (
          <FlatList
            data={blockedUsers}
            keyExtractor={item => item.id}
            renderItem={renderItem}
            contentContainerStyle={styles.listContent}
          />
        )}
      </SafeAreaView>
    </View>
  );
}


const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F3F4F6', },
  safeArea: { flex: 1, backgroundColor: '#FFF', },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12,
    backgroundColor: '#FFF', borderBottomWidth: 1, borderBottomColor: '#E5E7EB',
  },
  backButton: { padding: 4, },
  headerTitle: { fontSize: 17, fontWeight: '700', color: '#1F2937', },
  centerContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F3F4F6', paddingHorizontal: 20, },
  emptyIconCircle: {
    width: 100, height: 100, borderRadius: 50, backgroundColor: '#FFF', justifyContent: 'center', alignItems: 'center',
    marginBottom: 20, shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 10, elevation: 2,
  },
  emptyTitle: { fontSize: 16, fontWeight: '700', color: '#4B5563', marginBottom: 8, },
  emptyText: { fontSize: 13, color: '#9CA3AF', },
  listContent: { padding: 16, paddingBottom: 40, },
  userCard: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFF', padding: 16, borderRadius: 16, marginBottom: 12, shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 6, elevation: 2,
  },
  avatar: { width: 50, height: 50, borderRadius: 25, backgroundColor: '#E5E7EB', marginRight: 12, },
  userInfo: { flex: 1, marginRight: 12, },
  userName: { fontSize: 15, fontWeight: '700', color: '#1F2937', marginBottom: 4, },
  blockDate: { fontSize: 11, color: '#6B7280', },
  unblockButton: { backgroundColor: '#FEE2E2', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, },
  unblockButtonText: { color: '#EF4444', fontSize: 12, fontWeight: '700', },
});