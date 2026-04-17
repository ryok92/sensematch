import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Share,
  Alert,
  ActivityIndicator,
  Animated,
  TextInput,
  FlatList,
  Image,
  KeyboardAvoidingView,
  Platform,
  Modal
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as Clipboard from 'expo-clipboard';

import auth from '@react-native-firebase/auth';
import firestore, { FirebaseFirestoreTypes } from '@react-native-firebase/firestore';

const DEFAULT_MALE_IMAGE = require('../assets/man.png');
const DEFAULT_FEMALE_IMAGE = require('../assets/woman.png');

interface RoomData {
  code: string;
  expiresAt: Date;
  gameId: string;
  status: 'waiting' | 'active' | 'finished';
  hostId: string;
  players?: string[]
}

interface FriendData {
  id: string;
  otherUserId: string;
  name: string;
  img: any;
  lastMessageAt?: any;
}

export default function GameCreateScreen({ navigation, route }: { navigation: any, route: any }) {
  const [step, setStep] = useState<'initial' | 'created'>('initial');
  const [roomData, setRoomData] = useState<RoomData | null>(null);
  const [roomId, setRoomId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const [customCode, setCustomCode] = useState('');

  const [friends, setFriends] = useState<FriendData[]>([]);
  const [loadingFriends, setLoadingFriends] = useState(false);
  const [selectedFriend, setSelectedFriend] = useState<FriendData | null>(null);
  const [messageText, setMessageText] = useState('');
  const [sendingMessage, setSendingMessage] = useState(false);

  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    let animation: Animated.CompositeAnimation | null = null;

    if (step === 'created') {
      animation = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.1,
            duration: 1200,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 1200,
            useNativeDriver: true,
          }),
        ])
      );
      animation.start();
    } else {
      pulseAnim.setValue(1);
    }

    return () => {
      if (animation) {
        animation.stop();
      }
    };
  }, [step]);

  useEffect(() => {
    if (route.params?.isGuest && route.params?.roomId && route.params?.code) {
      const { roomId: paramRoomId, code: paramCode } = route.params;

      setRoomId(paramRoomId);
      setCustomCode(paramCode);
      setStep('created');

      const fetchRoomInfo = async () => {
        try {
          const doc = await firestore().collection('rooms').doc(paramRoomId).get();
          if (doc.exists()) {
            const data = doc.data();
            const expiresAt = data?.expiresAt?.toDate ? data.expiresAt.toDate() : new Date();

            setRoomData({
              code: data?.code,
              gameId: data?.gameId || 'balance-tower',
              status: data?.status || 'waiting',
              hostId: data?.hostId,
              expiresAt: expiresAt,
              players: data?.players || []
            });

            setMessageText(`ルーム【${paramCode}】に参加しました！\nホストの開始を待っています。`);
          }
        } catch (error) {
          console.error("Fetch room error:", error);
        }
      };

      fetchRoomInfo();
    }
  }, [route.params]);

  useEffect(() => {
    if (!roomId) return;

    const unsubscribe = firestore()
      .collection('rooms')
      .doc(roomId)
      .onSnapshot((docSnapshot) => {
        if (docSnapshot.exists()) {
          const data = docSnapshot.data() as RoomData;

          if (roomData && data.status !== roomData.status) {
            setRoomData(prev => prev ? ({ ...prev, status: data.status }) : null);
          }

          if (data.status === 'active') {
            Alert.alert("開始", "ゲームが開始されました！", [
              { text: "OK", onPress: () => console.log("後ほど推移コード作成") }
            ]);
          }
        }
      }, (error) => {
        console.error("Room snapshot error:", error);
      });

    return () => unsubscribe();
  }, [roomId, roomData?.status]);

  useEffect(() => {
    if (step === 'created' && auth().currentUser) {
      fetchFriends();
    }
  }, [step]);

  const fetchFriends = async () => {
    const currentUser = auth().currentUser;
    if (!currentUser) return;

    setLoadingFriends(true);

    try {
      const snapshot = await firestore()
        .collection('matches')
        .where('users', 'array-contains', currentUser.uid)
        .get();

      const promises = snapshot.docs.map(async (matchDoc) => {
        const data = matchDoc.data();
        const otherUserId = data.users.find((uid: string) => uid !== currentUser.uid);
        if (!otherUserId) return null;

        const userDoc = await firestore().collection('users').doc(otherUserId).get();
        const userData = userDoc.exists() ? userDoc.data() : null;

        let userImage = DEFAULT_MALE_IMAGE;
        if (userData) {
          if (userData.photoURL && userData.photoURL.startsWith('http')) {
            userImage = { uri: userData.photoURL };
          } else if (userData.gender === '女性' || userData.gender === 'female' || userData.gender === 2) {
            userImage = DEFAULT_FEMALE_IMAGE;
          }
        }

        return {
          id: matchDoc.id,
          otherUserId: otherUserId,
          name: userData ? (userData.displayName || '名無しさん') : 'ユーザー',
          img: userImage,
          lastMessageAt: data.lastMessageAt
        } as FriendData;
      });

      const results = await Promise.all(promises);
      const validResults = results.filter((item): item is FriendData => item !== null);

      validResults.sort((a, b) => {
        const timeA = a.lastMessageAt?.seconds || 0;
        const timeB = b.lastMessageAt?.seconds || 0;
        return timeB - timeA;
      });

      setFriends(validResults);
    } catch (error) {
      console.error("Error fetching friends:", error);
    } finally {
      setLoadingFriends(false);
    }
  };

  const handleCreateRoom = async () => {
    const currentUser = auth().currentUser;
    if (!currentUser) {
      Alert.alert("エラー", "ログインが必要です。");
      return;
    }
    if (customCode.length !== 4) {
      Alert.alert("確認", "4桁の数字を入力して下さい。");
      return;
    }

    setIsLoading(true);
    try {
      const existingDocs = await firestore()
        .collection('rooms')
        .where('code', '==', customCode)
        .where('status', '==', 'waiting')
        .get();

      if (!existingDocs.empty) {
        Alert.alert("エラー", "このコードは現在使用されています。\n別の数字を設定してください。");
        setIsLoading(false);
        return;
      }

      const expiresAt = new Date();
      expiresAt.setHours(expiresAt.getHours() + 24);

      const newRoomData = {
        code: customCode,
        gameId: 'balance-tower',
        status: 'waiting',
        createdAt: firestore.FieldValue.serverTimestamp(),
        expiresAt: expiresAt,
        hostId: currentUser.uid,
        players: [currentUser.uid]
      };

      const docRef = await firestore().collection('rooms').add(newRoomData);

      setRoomId(docRef.id);
      setRoomData({
        ...newRoomData,
        expiresAt: expiresAt,
        status: 'waiting' as const,
        code: customCode,
        gameId: 'balance-tower',
        hostId: currentUser.uid
      });
      setStep('created');
      setMessageText(`参加コードは【${customCode}】です！\n一緒に遊びましょう！`);
    } catch (error: any) {
      console.error("Room creation error:", error);
      Alert.alert('エラー', 'ルームの作成に失敗しました。');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSendMessage = async () => {
    const currentUser = auth().currentUser;
    if (!selectedFriend || !messageText.trim() || !currentUser) return;

    setSendingMessage(true);
    try {
      const matchRef = firestore().collection('matches').doc(selectedFriend.id);
      const messagesRef = matchRef.collection('messages');

      await messagesRef.add({
        text: messageText,
        senderId: currentUser.uid,
        createdAt: firestore.FieldValue.serverTimestamp(),
        type: 'invite',
        gameTitle: 'バランスタワー',
        gameRoomCode: roomData?.code,
        read: false
      });

      await matchRef.update({
        lastMessage: `[招待] ${messageText}`,
        lastMessageAt: firestore.FieldValue.serverTimestamp(),
        [`unreadCounts.${selectedFriend.otherUserId}`]: firestore.FieldValue.increment(1)
      });

      Alert.alert("送信完了", `${selectedFriend.name}さんにメッセージを送りました！`);
      setSelectedFriend(null);
      setMessageText(`参加コードは【${roomData?.code}】です！\n一緒に遊びましょう！`);
    } catch (error) {
      console.error("Send error:", error);
      Alert.alert("エラー", "メッセージの送信に失敗しました。");
    } finally {
      setSendingMessage(false);
    }
  };


  //コードコピー処理
  const handleCopyCode = async () => {
    if (!roomData) return;
    await Clipboard.setStringAsync(roomData.code);
    Alert.alert('コードをコピーしました');
  };

  //戻る処理
  const handleBack = () => {
    if (step === 'created' && roomId) {
      const currentUser = auth().currentUser;
      const isHost = roomData?.hostId === currentUser?.uid;

      Alert.alert(
        isHost ? 'ルームを解散しますか？' : 'ルームから退出しますか？',
        isHost ? '戻るとこのルームは削除されます。' : '待機画面から戻ります。',
        [
          { text: 'キャンセル', style: 'cancel' },
          {
            text: isHost ? '解散して戻る' : '退出する',
            style: 'destructive',
            onPress: async () => {
              navigation.goBack();
              try {
                if (isHost) {
                  await firestore().collection('rooms').doc(roomId).delete();
                } else if (currentUser) {
                  await firestore().collection('rooms').doc(roomId).update({
                    players: firestore.FieldValue.arrayRemove(currentUser.uid)
                  });
                }
              } catch (e) {
                console.error("Lerve room error:", e);
              }
            }
          },
        ]
      );
    } else {
      navigation.goBack();
    }
  };

  const renderFriendItem = ({ item }: { item: FriendData }) => {
    const isSelected = selectedFriend?.id === item.id;
    return (
      <TouchableOpacity
        style={[styles.friendItem, isSelected && styles.friendItemSelected]}
        onPress={() => setSelectedFriend(isSelected ? null : item)}
      >
        <View style={styles.avatarContainer}>
          <Image source={item.img} style={styles.friendAvatar} />
          {isSelected && (
            <View style={styles.checkBadge}>
              <Ionicons name="checkmark" size={12} color="#FFF" />
            </View>
          )}
        </View>
        <Text style={[styles.friendName, isSelected && styles.friendNameSelected]} numberOfLines={1}>
          {item.name}
        </Text>
      </TouchableOpacity >
    );
  };

  return (
    <View style={styles.container}>
      <SafeAreaView style={styles.safeArea}>

        <View style={styles.header}>
          <TouchableOpacity onPress={handleBack} style={styles.backButton}>
            <Ionicons name="chevron-back" size={28} color="#333" />
          </TouchableOpacity>

          <Text style={styles.headerTitle}>ルーム作成</Text>
        </View>

        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={{ flex: 1 }}
        >
          <View style={styles.content}>

            <View style={styles.gameCard}>
              <View style={styles.gameCardInner}>

                <LinearGradient colors={['#F97316', '#EF4444']} style={styles.iconBox}>
                  <MaterialCommunityIcons name="tower-fire" size={28} color="#FFF" />
                </LinearGradient>

                <View>
                  <Text style={styles.selectedLabel}>SELECTED GAME</Text>
                  <Text style={styles.gameTitle}>バランスタワー</Text>
                </View>

              </View>
            </View>

            {step === 'initial' ? (
              <View style={styles.centerContainer}>
                <View style={styles.illustrationContainer}>
                  <View style={styles.illustrationCircle}>
                    <MaterialCommunityIcons name="form-textbox-password" size={40} color="#4A90E2" />
                  </View>
                </View>

                <Text style={styles.mainTitle}>コードを決める</Text>
                <Text style={styles.subText}>
                  4桁のコードを決めて、{'\n'}
                  あなただけのルームを作りましょう！
                </Text>

                <View style={styles.inputContainer}>
                  <TextInput
                    style={styles.codeTextInput}
                    value={customCode}
                    onChangeText={(text) => setCustomCode(text.replace(/[^0-9]/g, '').slice(0, 4))}
                    placeholder="0000"
                    placeholderTextColor="#CCC"
                    keyboardType="number-pad"
                    maxLength={4}
                  />
                  <Text style={styles.inputHelper}>4桁の数字</Text>
                </View>

                <TouchableOpacity
                  onPress={handleCreateRoom}
                  style={[styles.createButton, customCode.length !== 4 && styles.createButtonDisabled]}
                  activeOpacity={0.8}
                  disabled={isLoading || customCode.length !== 4}
                >
                  {isLoading ? (
                    <ActivityIndicator color="#FFF" />
                  ) : (
                    <Text style={styles.createButtonText}>ルームを作成する</Text>
                  )}
                </TouchableOpacity>
              </View>
            ) : (
              <View style={styles.resultContainer}>

                <View style={styles.statusBadge}>
                  <Animated.View style={[styles.statusDot, { transform: [{ scale: pulseAnim }] }]} />
                  <Text style={styles.statusText}>
                    {roomData?.hostId === auth().currentUser?.uid ? 'お相手を待っています...' : 'ホストの応答待ち...'}
                  </Text>
                </View>

                <Text style={styles.codeLabel}>YOUR ROOM CODE</Text>

                <View style={styles.codeDisplayContainer}>
                  <LinearGradient
                    colors={['rgba(74, 144, 226, 0.1)', 'rgba(74, 144, 226, 0.05)']}
                    style={StyleSheet.absoluteFill}
                  />
                  <Text style={styles.codeText}>{roomData?.code}</Text>
                </View>

                <View style={styles.actionButtonsRow}>

                  <TouchableOpacity style={[styles.actionButton, styles.actionButtonOutline]} onPress={handleCopyCode}>
                    <Ionicons name="share-outline" size={20} color="#666" style={{ marginBottom: 4 }} />
                    <Text style={styles.actionButtonTextSecondary}>コピー</Text>
                  </TouchableOpacity>

                  <TouchableOpacity style={[styles.actionButton, styles.actionButtonOutline]} onPress={() => { Alert.alert("後日修正") }}>
                    <Ionicons name="share-outline" size={20} color="#666" style={{ marginBottom: 4 }} />
                    <Text style={styles.actionButtonTextSecondary}>シェア</Text>
                  </TouchableOpacity>

                </View>

                <View style={styles.friendShareSection}>

                  <View style={styles.sectionHeader}>
                    <Text style={styles.sectionTitle}>コードを共有する</Text>
                    {loadingFriends && <ActivityIndicator size="small" color="#999" />}
                  </View>

                  {friends.length > 0 ? (
                    <FlatList
                      data={friends}
                      horizontal
                      showsHorizontalScrollIndicator={false}
                      keyExtractor={(item) => item.id}
                      renderItem={renderFriendItem}
                      contentContainerStyle={styles.friendList}
                    />
                  ) : (
                    <Text style={styles.noFriendsText}>マッチング済みのお相手がいません</Text>
                  )}
                </View>

                {!selectedFriend && (
                  <View style={styles.noteContainer}>
                    <MaterialCommunityIcons name="clock-outline" size={14} color="#C2410C" />
                    <Text style={styles.noteText}>有効期限：24時間</Text>
                  </View>
                )}
              </View>
            )}
          </View>

          {step === 'created' && selectedFriend && (
            <View style={styles.messageInputContainer}>

              <View style={styles.messageTargetInfo}>
                <Image source={selectedFriend.img} style={styles.targetAvatar} />
                <Text style={styles.targetName}>{selectedFriend.name}さんに招待を送る</Text>

                <TouchableOpacity onPress={() => setSelectedFriend(null)} style={styles.closeMessageButton}>
                  <Ionicons name="close" size={20} color="#999" />
                </TouchableOpacity>
              </View>

              <View style={styles.messageInputRow}>
                <TextInput
                  style={styles.messageInput}
                  value={messageText}
                  onChangeText={setMessageText}
                  placeholder="メッセージを入力..."
                  multiline
                  maxLength={100}
                />

                <TouchableOpacity
                  style={[styles.sendButton, (!messageText.trim() || sendingMessage) && styles.sendButtonDisabled]}
                  onPress={handleSendMessage}
                  disabled={!messageText.trim() || sendingMessage}
                >
                  {sendingMessage ? (
                    <ActivityIndicator size="small" color="#FFF" />
                  ) : (
                    <Ionicons name="send" size={20} color="#FFF" />
                  )}
                </TouchableOpacity>
              </View>

            </View>
          )}
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}




const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFF' },
  safeArea: { flex: 1 },
  header: { flexDirection: 'row', padding: 16, alignItems: 'center' },
  backButton: { padding: 4 },
  headerTitle: { fontSize: 17, fontWeight: '700', marginLeft: 12, color: '#333' },
  content: { flex: 1, paddingHorizontal: 24, paddingTop: 16 },

  gameCard: {
    width: '100%', backgroundColor: '#FFF', borderRadius: 24, padding: 4,
    borderWidth: 1, borderColor: '#F5F7FA', marginBottom: 24,
    shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 3.84, elevation: 2,
  },
  gameCardInner: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F9FAFB', borderRadius: 20, padding: 12 },
  iconBox: { width: 56, height: 56, borderRadius: 18, justifyContent: 'center', alignItems: 'center', marginRight: 16 },
  selectedLabel: { fontSize: 10, fontWeight: '700', color: '#AAA', marginBottom: 2 },
  gameTitle: { fontSize: 16, fontWeight: '700', color: '#333' },

  centerContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingBottom: 80 },
  illustrationContainer: { marginBottom: 24 },
  illustrationCircle: { width: 88, height: 88, borderRadius: 44, backgroundColor: '#F0F9FF', alignItems: 'center', justifyContent: 'center' },
  mainTitle: { fontSize: 24, fontWeight: '800', color: '#333', marginBottom: 12 },
  subText: { fontSize: 14, color: '#888', textAlign: 'center', lineHeight: 22, marginBottom: 32 },

  inputContainer: { alignItems: 'center', width: '100%', marginBottom: 32 },
  codeTextInput: {
    width: '100%', height: 64, borderRadius: 16, backgroundColor: '#F5F7FA',
    textAlign: 'center', fontSize: 32, fontWeight: '800', color: '#333', letterSpacing: 8,
    borderWidth: 2, borderColor: '#E0E7FF'
  },
  inputHelper: { fontSize: 12, color: '#AAA', marginTop: 8 },

  createButton: {
    width: '100%', backgroundColor: '#4A90E2', paddingVertical: 18, borderRadius: 30, alignItems: 'center',
    shadowColor: "#4A90E2", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 8,
  },
  createButtonDisabled: { backgroundColor: '#A0C4E8', shadowOpacity: 0, elevation: 0 },
  createButtonText: { color: '#FFF', fontSize: 16, fontWeight: '700' },

  resultContainer: { flex: 1, alignItems: 'center', paddingTop: 10 },
  statusBadge: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: '#F0FDF4', paddingHorizontal: 12, paddingVertical: 6,
    borderRadius: 20, marginBottom: 24, borderWidth: 1, borderColor: '#DCFCE7',
  },
  statusDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#22C55E', marginRight: 6 },
  statusText: { fontSize: 12, color: '#15803D', fontWeight: '700' },

  codeLabel: { fontSize: 11, fontWeight: '700', color: '#AAA', letterSpacing: 1.5, marginBottom: 12 },
  codeDisplayContainer: {
    width: '100%', height: 80, alignItems: 'center', justifyContent: 'center', marginBottom: 24,
    borderRadius: 20, overflow: 'hidden', borderWidth: 1, borderColor: '#E0E7FF',
  },
  codeText: { fontSize: 40, fontWeight: '800', color: '#333', fontVariant: ['tabular-nums'], letterSpacing: 8 },

  actionButtonsRow: { flexDirection: 'row', width: '100%', gap: 12, marginBottom: 32 },
  actionButton: { flex: 1, paddingVertical: 12, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  actionButtonOutline: { backgroundColor: '#FFF', borderWidth: 1, borderColor: '#E2E8F0' },
  actionButtonTextSecondary: { fontSize: 12, fontWeight: '700', color: '#64748B' },

  friendShareSection: { width: '100%', flex: 1 },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, paddingHorizontal: 4 },
  sectionTitle: { fontSize: 14, fontWeight: '700', color: '#333' },
  friendList: { paddingBottom: 16 },
  noFriendsText: { fontSize: 12, color: '#999', textAlign: 'center', marginTop: 20 },

  friendItem: { alignItems: 'center', marginRight: 16, width: 64 },
  friendItemSelected: { opacity: 1 },
  avatarContainer: { position: 'relative', marginBottom: 6 },
  friendAvatar: { width: 56, height: 56, borderRadius: 28, backgroundColor: '#EEE' },
  checkBadge: {
    position: 'absolute', bottom: 0, right: 0, backgroundColor: '#4A90E2',
    width: 20, height: 20, borderRadius: 10, borderWidth: 2, borderColor: '#FFF',
    alignItems: 'center', justifyContent: 'center'
  },
  friendName: { fontSize: 11, color: '#666', textAlign: 'center' },
  friendNameSelected: { color: '#4A90E2', fontWeight: '700' },

  noteContainer: { flexDirection: 'row', alignItems: 'center', marginTop: 'auto', marginBottom: 16, alignSelf: 'center', opacity: 0.7 },
  noteText: { fontSize: 11, color: '#C2410C', marginLeft: 4 },

  messageInputContainer: {
    backgroundColor: '#FFF',
    borderTopWidth: 1, borderColor: '#F0F0F0',
    padding: 16, paddingBottom: Platform.OS === 'ios' ? 34 : 16,
    shadowColor: "#000", shadowOffset: { width: 0, height: -2 }, shadowOpacity: 0.1, shadowRadius: 4, elevation: 10,
  },
  messageTargetInfo: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  targetAvatar: { width: 24, height: 24, borderRadius: 12, marginRight: 8 },
  targetName: { fontSize: 12, color: '#333', flex: 1, fontWeight: '600' },
  closeMessageButton: { padding: 4 },

  messageInputRow: { flexDirection: 'row', alignItems: 'center' },
  messageInput: {
    flex: 1, backgroundColor: '#F5F7FA', borderRadius: 20,
    paddingHorizontal: 16, paddingVertical: 10, marginRight: 8,
    fontSize: 14, color: '#333', maxHeight: 80
  },
  sendButton: {
    width: 40, height: 40, borderRadius: 20, backgroundColor: '#4A90E2',
    alignItems: 'center', justifyContent: 'center'
  },
  sendButtonDisabled: { backgroundColor: '#A0C4E8' },
});
