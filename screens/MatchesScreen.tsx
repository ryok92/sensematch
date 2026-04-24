import React, { useState, useEffect } from 'react';
import { View, Text, FlatList, Image, TouchableOpacity, TextInput, StyleSheet, ActivityIndicator, Alert, Modal, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Ionicons from 'react-native-vector-icons/Ionicons';
import LinearGradient from 'react-native-linear-gradient';
import auth from '@react-native-firebase/auth';
import firestore from '@react-native-firebase/firestore';

const DEFAULT_MALE_IMAGE = require('../assets/man.png');
const DEFAULT_FEMALE_IMAGE = require('../assets/woman.png');
const ONLINE_THRESHOLD_MINUTES = 10;

interface MatchData {
  id: string; name: string; img: any; message: string; time: any; createdAt: any; age: number | string; isOnline: boolean;
  unread: number; otherUserId: string; isHidden: boolean; isDeleted: boolean;
}

interface MatchesScreenProps { navigation: any; }

export default function MatchesScreen({ navigation }: MatchesScreenProps) {
  const [matches, setMatches] = useState<MatchData[]>([]);
  const [newMatches, setNewMatches] = useState<MatchData[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [searchKeyword, setSearchKeyword] = useState<string>('');
  const [actionModalVisible, setActionModalVisible] = useState<boolean>(false);
  const [hideConfirmVisible, setHideConfirmVisible] = useState<boolean>(false);
  const [deleteConfirmVisible, setDeleteConfirmVisible] = useState<boolean>(false);
  const [selectedMatch, setSelectedMatch] = useState<MatchData | null>(null);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [refreshTick, setRefreshTick] = useState<number>(0);

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

  const checkIsOnline = (lastSeenTimestamp: any) => {
    if (!lastSeenTimestamp) return false;
    const lastSeenDate = lastSeenTimestamp.toDate ? lastSeenTimestamp.toDate() : new Date(lastSeenTimestamp);
    const now = new Date();
    const diffMs = now.getTime() - lastSeenDate.getTime();
    const diffMinutes = diffMs / (1000 * 60);
    return diffMinutes <= ONLINE_THRESHOLD_MINUTES;
  };

  useEffect(() => {
    const user = auth().currentUser;
    if (!user) {
      setLoading(false);
      return
    }

    const matchesQuery = firestore().collection('matches').where('users', 'array-contains', user.uid).orderBy('lastMessage', 'desc');

    const unsubscribe = matchesQuery.onSnapshot(async (snapshot) => {
      if (!snapshot || !snapshot.docs) {
        setLoading(false);
        return;
      }

      try {
        const promises = snapshot.docs.map((matchDoc: any) => {
          const data = matchDoc.data();
          const otherUserId = data.users?.find((uid: string) => uid !== user.uid);

          if (!otherUserId || !data.userSnapshots) return null;
          const otherUserSnap = data.userSnapshots[otherUserId];
          if (!otherUserSnap) return null;

          let userImage = (otherUserSnap.gender === 'female') ? DEFAULT_FEMALE_IMAGE : DEFAULT_MALE_IMAGE;
          if (otherUserSnap.photoURL && otherUserSnap.mainPhotoStatus === 'approved') {
            userImage = { uri: otherUserSnap.photoURL };
          }

          const myUnreadCount = data.unreadCounts ? (data.unreadCounts[user.uid] || 0) : 0;

          const hiddenAtVal = data.hiddenAt && data.hiddenAt[user.uid];
          const hiddenAtMs = hiddenAtVal ? (hiddenAtVal.toDate ? hiddenAtVal.toDate().getTime() : new Date(hiddenAtVal).getTime()) : 0;

          const deletedAtVal = data.deletedAt && data.deletedAt[user.uid];
          const deletedAtMs = deletedAtVal ? (deletedAtVal.toDate ? deletedAtVal.toDate().getTime() : new Date(deletedAtVal).getTime()) : 0;

          const lastMessageAtMs = data.lastMessageAt ? (data.lastMessageAt.toDate ?
            data.lastMessageAt.toDate().getTime() : new Date(data.lastMessageAt).getTime()) : 0;

          const isHidden = hiddenAtMs > 0 && hiddenAtMs >= lastMessageAtMs;
          const isDeleted = deletedAtMs > 0 && deletedAtMs >= lastMessageAtMs;

          return {
            id: matchDoc.id,
            name: otherUserSnap.displayName || 'No Name',
            img: userImage,
            message: data.lastMessage || 'マッチングが成立しました！',
            time: data.lastMessageAt,
            createdAt: data.createdAt,
            age: otherUserSnap.age || '??',
            unread: myUnreadCount,
            otherUserId: otherUserId,
            isHidden: isHidden,
            isDeleted: isDeleted
          } as MatchData;
        });

        const results = await Promise.all(promises);
        const validResults = results.filter((item: any): item is MatchData => item !== null);
        setMatches(validResults);

        const sortedNewMatches = [...validResults].filter(item => !item.isHidden && !item.isDeleted)
          .sort((a, b) => {
            const dateA = a.createdAt ? (a.createdAt.toDate ? a.createdAt.toDate() : new Date(a.createdAt)) : new Date(0);
            const dateB = b.createdAt ? (b.createdAt.toDate ? b.createdAt.toDate() : new Date(b.createdAt)) : new Date(0);

            return dateB.getTime() - dateA.getTime();
          }).slice(0, 10);
        setNewMatches(sortedNewMatches);
      } catch (error) {
        console.error("Error fetching matches:", error);
      } finally {
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, []);

  const handleHideMatch = async () => {
    if (!selectedMatch) return;
    try {
      const user = auth().currentUser;
      if (!user) return;

      await firestore().collection('matches').doc(selectedMatch.id).update({
        [`hiddenAt.${user.uid}`]: firestore.FieldValue.serverTimestamp()
      });

      setHideConfirmVisible(false);
      setSelectedMatch(null);
    } catch (error) {
      console.error("Error hiding match:", error);
      Alert.alert('エラー', '非表示処理に失敗しました。');
    }
  };

  const handleDeleteMatch = async () => {
    if (!selectedMatch) return;

    try {
      const user = auth().currentUser;
      if (!user) return;

      await firestore().collection('matches').doc(selectedMatch.id).update({
        [`deletedAt.${user.uid}`]: firestore.FieldValue.serverTimestamp()
      });

      setDeleteConfirmVisible(false);
      setSelectedMatch(null);
    } catch (error) {
      console.error("Error deleting match:", error);
      Alert.alert('エラー', '削除処理に失敗しました。');
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    setRefreshTick(prev => prev + 1);

    setTimeout(() => {
      setRefreshing(false);
    }, 1000);
  };

  const filteredMatches = matches.filter(item => {
    if (item.isHidden) return false;
    if (item.isDeleted) return false;
    if (!searchKeyword) return true;
    const cleanName = item.name.replace(/\s+/g, '');
    const cleanKeyword = searchKeyword.replace(/\s+/g, '');
    return cleanName.includes(cleanKeyword);
  });

  const renderListHeader = () => (
    <View>
      <View style={styles.header}>
        <View style={{ width: 28 }} />
        <Text style={styles.headerTitle}>メッセージ</Text>
        <View style={{ width: 30 }} />
      </View>

      <View style={styles.searchContainer}>
        <View style={styles.searchBar}>
          <Ionicons name="search" size={18} color="#999" />
          <TextInput
            style={styles.searchInput}
            placeholder="ユーザー名で検索"
            value={searchKeyword}
            onChangeText={setSearchKeyword}
          />
        </View>
      </View>

      {!loading && newMatches.length > 0 && (
        <View style={styles.newMatchesContainer}>
          <View style={styles.newMatchesHeader}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Ionicons name="sparkles" size={18} color="#F5A623" style={{ marginRight: 6 }} />
              <Text style={styles.newMatchesTitle}>マッチング済み</Text>
            </View>
          </View>

          <View style={styles.newMatchesListWrapper}>
            <FlatList
              data={newMatches}
              horizontal
              showsHorizontalScrollIndicator={false}
              keyExtractor={(item) => `new-${item.id}`}
              contentContainerStyle={styles.newMatchesList}
              ListFooterComponent={
                <TouchableOpacity
                  style={styles.viewAllButton}
                  activeOpacity={0.7}
                  onPress={() => navigation.navigate('AllMatches')}
                >
                  <View style={styles.viewAllIconCircle}>
                    <Ionicons name="apps-outline" size={24} color="#4A90E2" />
                  </View>
                  <Text style={styles.viewAllText}>すべて</Text>
                </TouchableOpacity>
              }
              renderItem={({ item }) => {
                const isNewMatch = item.message === 'マッチングが成立しました！';
                return (
                  <TouchableOpacity
                    style={styles.newMatchItem}
                    onLongPress={() => {
                      setSelectedMatch(item);
                      setActionModalVisible(true);
                    }}
                    onPress={() => navigation.navigate('Chat', {
                      matchId: item.id,
                      recipientId: item.otherUserId,
                      recipientName: item.name,
                      recipientImage: item.img
                    })}
                  >
                    <View style={styles.newMatchImageContainer}>
                      <Image source={item.img} style={styles.newMatchImage} />
                      {item.isOnline && <View style={styles.onlineBadgeLarge} />}

                      {isNewMatch && (
                        <View style={styles.newBadgeContainer}>
                          <Text style={styles.newBadgeText}>NEW</Text>
                        </View>
                      )}
                    </View>

                    <Text style={styles.newMatchName} numberOfLines={1}>{item.name}</Text>
                    <Text style={styles.newMatchAge}>{item.age}歳</Text>
                  </TouchableOpacity>
                );
              }}
            />

            <View style={styles.scrollHintOverlay} pointerEvents="none">
              <View style={styles.scrollHintIconBg}>
                <Ionicons name="chevron-forward" size={18} color="#999" />
              </View>
            </View>

          </View>
        </View>
      )}
    </View>
  );

  return (
    <View style={styles.container}>
      <SafeAreaView style={{ flex: 1 }} edges={['top', 'left', 'right']}>
        {loading || filteredMatches.length === 0 ? (
          <View style={styles.centerContainer}>
            <ActivityIndicator size="large" color="#4A90E2" />
          </View>
        ) : (
          <FlatList
            ListHeaderComponent={renderListHeader}
            data={filteredMatches}
            keyExtractor={(item) => item.id}
            extraData={refreshTick}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={onRefresh}
                tintColor="#4A90E2"
                colors={['#4A90E2']}
              />
            }
            ListEmptyComponent={
              <View style={styles.emptyContainer}>
                <View style={styles.emptyIconCircle}>
                  <Ionicons name="search" size={36} color="#4A90E2" />
                </View>

                <Text style={styles.emptyTitle}>新しい出会いを探そう！</Text>
                <Text style={styles.emptySubText}>
                  気になるお相手を見つけて、「いいね！」を送ってみましょう！
                </Text>

                <TouchableOpacity
                  activeOpacity={0.8}
                  style={styles.emptyButtonWrapper}
                  onPress={() => navigation.navigate('SearchList')}
                >
                  <LinearGradient
                    colors={['#4A90E2', '#357ABD']}
                    style={styles.emptyButtonGradient}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                  >
                    <Ionicons name="search" size={18} color="#FFF" style={styles.emptyButtonIcon} />
                    <Text style={styles.emptyButtonText}>お相手を探しに行く</Text>
                  </LinearGradient>
                </TouchableOpacity>
              </View>
            }
            renderItem={({ item }) => (
              <TouchableOpacity
                onLongPress={() => {
                  setSelectedMatch(item);
                  setActionModalVisible(true);
                }}
                onPress={() => navigation.navigate('Chat', {
                  matchId: item.id,
                  recipientId: item.otherUserId,
                  recipientName: item.name,
                  recipientImage: item.img,
                })}
                style={styles.messageRow}
              >
                <Image source={item.img} style={styles.avatar} />

                <View style={{ flex: 1 }}>
                  <View style={styles.rowTop}>
                    <Text style={styles.name}>{item.name}</Text>

                    <Text style={[styles.time, { color: item.unread > 0 ? '#4A90E2' : '#999' }]}>
                      {formatTime(item.time)}
                    </Text>
                  </View>
                  <View style={styles.rowBottom}>
                    <Text
                      numberOfLines={1}
                      style={[
                        styles.message,
                        {
                          color: item.unread > 0 ? '#333' : '#999',
                          fontWeight: item.unread > 0 ? '700' : '400'
                        }
                      ]}
                    >
                      {item.message}
                    </Text>

                    {item.unread > 0 && (
                      <View style={styles.unreadBadge}>
                        <Text style={styles.unreadText}>{item.unread}</Text>
                      </View>
                    )}
                  </View>
                </View>
              </TouchableOpacity>
            )}
          />
        )}
      </SafeAreaView>


      <Modal visible={actionModalVisible} transparent={true} animationType="fade">

        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setActionModalVisible(false)}>
          <View style={styles.actionModalContainer}>
            <Text style={styles.actionModalTitle}>{selectedMatch?.name} さん</Text>
            <View style={styles.actionModalDivider} />

            <TouchableOpacity
              style={styles.actionModalButton}
              onPress={() => { setActionModalVisible(false); setHideConfirmVisible(true); }}
            >
              <Text style={styles.actionModalButtonText}>非表示</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.actionModalButton}
              onPress={() => { setActionModalVisible(false); setDeleteConfirmVisible(true); }}
            >
              <Text style={[styles.actionModalButtonText, { color: '#FF3B30' }]}>削除</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      <Modal visible={hideConfirmVisible} transparent={true} animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.confirmModalContainer}>

            <View style={styles.modalIconCircle}>
              <Text style={styles.modalIconText}>!</Text>
            </View>

            <Text style={styles.confirmTitle}>非表示にしますか？</Text>
            <Text style={styles.confirmDesc}>
              一覧から表示されなくなりますが、メッセージ履歴は削除されません。{'\n\n'}お相手からの新しいメッセージが届いた場合は、再び一覧に表示されます。
            </Text>

            <View style={styles.confirmButtonRow}>
              <TouchableOpacity style={styles.cancelButton} onPress={() => setHideConfirmVisible(false)}>
                <Text style={styles.cancelButtonText}>キャンセル</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.executeButton} onPress={handleHideMatch}>
                <Text style={styles.executeButtonText}>非表示にする</Text>
              </TouchableOpacity>
            </View>

          </View>
        </View>
      </Modal>

      <Modal visible={deleteConfirmVisible} transparent={true} animationType="fade">
        <View style={styles.modalOverlay}>

          <View style={styles.confirmModalContainer}>
            <View style={[styles.modalIconCircle, { borderColor: '#FF3B30' }]}>
              <Text style={[styles.modalIconText, { color: '#FF3B30' }]}>!</Text>
            </View>

            <Text style={styles.confirmTitle}>本当に削除しますか？</Text>
            <Text style={styles.confirmDesc}>
              このチャットルームの全てのメッセージが削除されます。削除した内容は復元できません。
            </Text>

            <View style={styles.confirmButtonRow}>
              <TouchableOpacity style={styles.cancelButton} onPress={() => setDeleteConfirmVisible(false)}>
                <Text style={styles.cancelButtonText}>キャンセル</Text>
              </TouchableOpacity>

              <TouchableOpacity style={[styles.executeButton, { backgroundColor: '#FF3B30' }]} onPress={handleDeleteMatch}>
                <Text style={styles.executeButtonText}>削除する</Text>
              </TouchableOpacity>
            </View>
          </View>

        </View>
      </Modal>

    </View >
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFF', },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', marginTop: 50 },
  emptyContainer: { padding: 30, alignItems: 'center', justifyContent: 'center', marginTop: 60, },
  emptyIconCircle: {
    width: 80, height: 80, borderRadius: 40, backgroundColor: '#F0F8FF', alignItems: 'center', justifyContent: 'center', marginBottom: 20,
  },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: '#333', marginBottom: 10, },
  emptySubText: { fontSize: 14, color: '#666', textAlign: 'center', lineHeight: 22, marginBottom: 30, },
  emptyButtonWrapper: {
    width: '100%', maxWidth: 240, shadowColor: "#4A90E2", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3,
    shadowRadius: 8, elevation: 5,
  },
  emptyButtonGradient: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 14, borderRadius: 25, },
  emptyButtonIcon: {
    marginRight: 8,
  },
  emptyButtonText: { color: '#FFF', fontSize: 15, fontWeight: '700', },
  header: { flexDirection: 'row', justifyContent: 'space-between', padding: 16, alignItems: 'center', zIndex: 1000 },
  headerTitle: { fontSize: 17, fontWeight: '700', color: '#333' },
  searchContainer: { paddingHorizontal: 16, marginBottom: 10, },
  searchBar: {
    backgroundColor: '#F5F7FA', borderRadius: 12, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, height: 44,
  },
  searchInput: { flex: 1, marginLeft: 8, color: '#333' },
  newMatchesContainer: {
    marginBottom: 10, borderBottomWidth: 1, borderBottomColor: '#E1EFFF', paddingBottom: 5, paddingTop: 5, backgroundColor: '#F0F8FF',
  },
  newMatchesHeader: { paddingHorizontal: 16, marginBottom: 12, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', },
  newMatchesTitle: { fontSize: 14, fontWeight: '700', color: '#4A90E2', letterSpacing: 0.5, },
  newMatchesListWrapper: { position: 'relative', },
  scrollHintOverlay: {
    position: 'absolute', right: 0, top: 0, bottom: 0, width: 40, justifyContent: 'center', alignItems: 'center',
    backgroundColor: 'rgba(240, 248, 255, 0.85)', paddingBottom: 20,
  },
  scrollHintIconBg: {
    backgroundColor: '#FFF', borderRadius: 12, width: 24, height: 24, justifyContent: 'center', alignItems: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.1, shadowRadius: 2, elevation: 2,
  },
  newMatchesList: { paddingHorizontal: 12, paddingRight: 40, },
  newMatchItem: { alignItems: 'center', marginHorizontal: 8, width: 70, },
  newMatchImageContainer: {
    position: 'relative', marginBottom: 6, padding: 2, borderWidth: 2, borderColor: '#4A90E2', borderRadius: 34,
  },
  newMatchImage: { width: 60, height: 60, borderRadius: 30, },
  newBadgeContainer: {
    position: 'absolute', top: -6, left: -4, backgroundColor: '#FF3B30', paddingHorizontal: 6, paddingVertical: 2,
    borderRadius: 8, borderWidth: 2, borderColor: '#FFF', shadowColor: "#000", shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25, shadowRadius: 3, elevation: 4, zIndex: 10,
  },
  newBadgeText: { color: '#FFF', fontSize: 9, fontWeight: '900', letterSpacing: 0.5, },
  viewAllButton: { alignItems: 'center', justifyContent: 'flex-start', marginHorizontal: 8, width: 70, paddingTop: 4, },
  viewAllIconCircle: {
    width: 60, height: 60, borderRadius: 30, backgroundColor: '#F8FAFC', borderWidth: 1, borderColor: '#E2E8F0',
    justifyContent: 'center', alignItems: 'center', marginBottom: 6, shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05, shadowRadius: 2, elevation: 1,
  },
  viewAllText: { fontSize: 12, fontWeight: '700', color: '#94A3B8', marginTop: 2, },
  onlineBadgeLarge: {
    position: 'absolute', bottom: 0, right: 0, width: 16, height: 16, borderRadius: 8, backgroundColor: '#22C55E', borderWidth: 2,
    borderColor: '#FFF',
  },
  newMatchName: { fontSize: 14, fontWeight: '700', color: '#333', marginBottom: 2, },
  newMatchAge: { fontSize: 12, color: '#999', },
  messageRow: { flexDirection: 'row', padding: 16, alignItems: 'center', borderBottomWidth: 1, borderBottomColor: '#F5F7FA' },
  avatar: { width: 56, height: 56, borderRadius: 28, marginRight: 12, backgroundColor: '#EEE' },
  rowTop: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4, },
  name: { fontWeight: '700', fontSize: 15, color: '#333' },
  time: { fontSize: 11, fontWeight: '500' },
  rowBottom: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  message: { flex: 1, fontSize: 13, marginRight: 8 },
  unreadBadge: {
    backgroundColor: '#4A90E2', borderRadius: 10, minWidth: 20, height: 20, justifyContent: 'center', alignItems: 'center',
    paddingHorizontal: 6,
  },
  unreadText: { color: '#FFF', fontSize: 10, fontWeight: '700', },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', },
  actionModalContainer: { backgroundColor: '#FFF', width: '80%', borderRadius: 14, overflow: 'hidden', },
  actionModalTitle: {
    textAlign: 'center', paddingVertical: 16, fontSize: 18, fontWeight: '700', color: '#333', backgroundColor: '#F9F9F9'
  },
  actionModalDivider: { height: 1, backgroundColor: '#E5E5EA', },
  actionModalButton: { paddingVertical: 16, alignItems: 'center', backgroundColor: '#FFF' },
  actionModalButtonText: { fontSize: 16, color: '#007AFF', fontWeight: '500', },
  confirmModalContainer: { backgroundColor: '#FFF', width: '85%', borderRadius: 16, padding: 24, alignItems: 'center', },
  modalIconCircle: {
    width: 48, height: 48, borderRadius: 24, borderWidth: 2, borderColor: '#4A90E2', justifyContent: 'center',
    alignItems: 'center', marginBottom: 16,
  },
  modalIconText: { fontSize: 24, fontWeight: 'bold', color: '#4A90E2', },
  confirmTitle: { fontSize: 18, fontWeight: '700', color: '#333', marginBottom: 12, },
  confirmDesc: { fontSize: 14, color: '#666', textAlign: 'center', lineHeight: 20, marginBottom: 24, },
  confirmButtonRow: { flexDirection: 'row', width: '100%', justifyContent: 'space-between', },
  cancelButton: {
    flex: 1, paddingVertical: 12, borderRadius: 8, backgroundColor: '#F5F7FA', marginRight: 8, alignItems: 'center',
  },
  cancelButtonText: { color: '#666', fontWeight: '600', },
  executeButton: {
    flex: 1, paddingVertical: 12, borderRadius: 8, backgroundColor: '#4A90E2', marginLeft: 8, alignItems: 'center',
  },
  executeButtonText: { color: '#FFF', fontWeight: '600', },
  menuOverlay: {
    position: 'absolute', top: -100, bottom: -1000, left: -1000, right: -1000, backgroundColor: 'transparent', zIndex: 2001,
  },
  menuContainer: {
    position: 'absolute', top: 30, right: 0, width: 160, backgroundColor: '#FFF', borderRadius: 12, shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.15, shadowRadius: 12, elevation: 8, zIndex: 2002, paddingVertical: 4,
  },
  menuItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, paddingHorizontal: 16, },
  menuText: { fontSize: 14, fontWeight: '600', color: '#333', },
  menuDivider: { height: 1, backgroundColor: '#F0F0F0', marginHorizontal: 10, },
  centerContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
});