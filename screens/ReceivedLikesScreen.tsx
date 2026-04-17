import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, FlatList, Image, TouchableOpacity, Dimensions, StyleSheet, ActivityIndicator, Alert,
  ScrollView, Animated, Modal, TextInput, Keyboard, KeyboardAvoidingView, Platform, TouchableWithoutFeedback
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons, MaterialIcons, MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as NavigationBar from 'expo-navigation-bar';
import { getAuth } from '@react-native-firebase/auth';
import {
  getFirestore, collection, doc, query, orderBy, limit, onSnapshot, getDoc,
  getDocs, where, Timestamp, addDoc, serverTimestamp,
} from '@react-native-firebase/firestore';
import MatchingScreen from './MatchingScreen';
import { calculateSynchroPercentage } from '../utils/Math';

const { width } = Dimensions.get('window');
const CARD_WIDTH = (width - 32 - 12) / 2;

const DEFAULT_MALE_IMAGE = require('../assets/man.png');
const DEFAULT_FEMALE_IMAGE = require('../assets/woman.png');

const auth = getAuth();
const db = getFirestore();

type TabType = 'received' | 'sent';

interface UserLike {
  id: string; likeDocId: string; age: number | string; photoURL: string | number; gender?: string; displayName?: string;
  location?: string; receivedAt: Timestamp | Date; questionAnswer?: string; isNew: boolean; compatibility: number;
  isBlur: boolean; question?: string; answer?: string; mainPhotoStatus?: string;
}

export default function ReceivedLikesScreen({ navigation }: any) {
  const insets = useSafeAreaInsets();
  const [activeTab, setActiveTab] = useState<TabType>('received');

  const [receivedLikes, setReceivedLikes] = useState<UserLike[]>([]);
  const [sentLikes, setSentLikes] = useState<UserLike[]>([]);
  const [loadingReceived, setLoadingReceived] = useState<boolean>(true);
  const [loadingSent, setLoadingSent] = useState<boolean>(true);

  const [isMatchingModalVisible, setIsMatchingModalVisible] = useState<boolean>(false);

  const [questionModalVisible, setQuestionModalVisible] = useState<boolean>(false);
  const [answerText, setAnswerText] = useState<string>('');

  const [answerModalVisible, setAnswerModalVisible] = useState<boolean>(false);
  const [selectedUserForAnswer, setSelectedUserForAnswer] = useState<UserLike | null>(null);

  const [alertModalVisible, setAlertModalVisible] = useState<boolean>(false);
  const [userForAlert, setUserForAlert] = useState<UserLike | null>(null);
  const [myQuestion, setMyQuestion] = useState<string | null>(null);

  const [selectedUserForLike, setSelectedUserForLike] = useState<UserLike | null>(null);

  const [receivedCount, setReceivedCount] = useState<number>(0);
  const [hasExpiredLikes, setHasExpiredLikes] = useState<boolean>(false);

  const [newMatchId, setNewMatchId] = useState<string | null>(null);

  const [keyboardOffset, setKeyboardOffset] = useState<number>(0);

  const scrollViewRef = useRef<ScrollView>(null);
  const scrollX = useRef(new Animated.Value(0)).current;

  const checkIsExpired = (timestamp: any) => {
    if (!timestamp) return false;
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffHours = diffMs / (1000 * 60 * 60);
    return diffHours >= 72;
  };

  const calculateAge = (birthDate: any): number | string => {
    if (!birthDate) return '--';
    const birth = birthDate.toDate ? birthDate.toDate() : new Date(birthDate);
    const today = new Date();
    let age = today.getFullYear() - birth.getFullYear();
    if (today.getMonth() < birth.getMonth() || (today.getMonth() === birth.getMonth() && today.getDate() < birth.getDate())) age--;
    return age;
  };

  useEffect(() => {
    if (Platform.OS === 'android') {
      NavigationBar.setBackgroundColorAsync('#ffffff00');
      NavigationBar.setPositionAsync('absolute');
    }
  }, []);

  useEffect(() => {
    if (Platform.OS === 'android') {
      const keyboardDidShowListener = Keyboard.addListener(
        'keyboardDidShow',
        (e) => {
          setKeyboardOffset(e.endCoordinates.height);
        }
      );
      const keyboardDidHideListener = Keyboard.addListener(
        'keyboardDidHide',
        () => {
          setKeyboardOffset(0);
        }
      );

      return () => {
        keyboardDidShowListener.remove();
        keyboardDidHideListener.remove();
      };
    }
  }, []);

  useEffect(() => {
    const currentUser = auth.currentUser;
    if (!currentUser) {
      setLoadingReceived(false);
      setLoadingSent(false);
      return;
    }

    setLoadingReceived(true);
    setLoadingSent(true);

    const myDocRef = doc(db, 'users', currentUser.uid);
    const unsubscribeMe = onSnapshot(myDocRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        setMyQuestion(data?.question || null);
      }
    });

    const receivedRef = collection(db, 'users', currentUser.uid, 'receivedLikes');
    const qReceived = query(receivedRef, orderBy('createdAt', 'desc'), limit(20));

    const unsubscribeReceived = onSnapshot(qReceived, async (snapshot) => {
      let expiredFound = false;

      // ★新規追加: 自分のsenseVectorを取得
      let myVector: any = null;
      try {
        const mySenseDataRef = doc(db, 'users', currentUser.uid, 'senseData', 'profile');
        const mySenseDataSnap = await getDoc(mySenseDataRef);
        myVector = mySenseDataSnap.exists() ? mySenseDataSnap.data()?.senseVector : null;
      } catch (error) {
        console.error("Error fetching my sense data:", error);
      }
      // ★新規追加ここまで

      const promises = snapshot.docs.map(async (docSnap: any) => {
        const data = docSnap.data();
        const targetUserId = data.fromUserId;

        if (!targetUserId) return null;

        if (checkIsExpired(data.createdAt)) {
          expiredFound = true;
        }

        try {
          const userDocRef = doc(db, 'users', targetUserId);
          const userDoc = await getDoc(userDocRef);

          const sentLikesRef = collection(db, 'users', currentUser.uid, 'sentLikes');
          const sentLikeQuery = query(sentLikesRef, where('targetUserId', '==', targetUserId));
          const sentLikeSnapshot = await getDocs(sentLikeQuery);

          const isMatched = !sentLikeSnapshot.empty;

          if (userDoc.exists()) {
            const userData = userDoc.data();

            // ★新規追加: 相手のsenseVectorを取得してSENSE MATCH率を計算
            let calculatedMatchRate = userData?.compatibility || Math.floor(Math.random() * 20) + 80;
            try {
              const otherSenseDataRef = doc(db, 'users', targetUserId, 'senseData', 'profile');
              const otherSenseDataSnap = await getDoc(otherSenseDataRef);
              const otherVector = otherSenseDataSnap.exists() ? otherSenseDataSnap.data()?.senseVector : null;
              if (myVector && otherVector) {
                const rate = calculateSynchroPercentage(myVector, otherVector);
                if (rate > 0) calculatedMatchRate = rate;
              }
            } catch (error) {
              console.error("Error calculating match rate for received like:", error);
            }
            // ★新規追加ここまで

            return {
              id: targetUserId,
              likeDocId: docSnap.id,
              age: calculateAge(userData?.birthDate),
              ...userData,
              receivedAt: data.createdAt,
              questionAnswer: data.questionAnswer || data.answer,
              isNew: !data.isRead,
              compatibility: calculatedMatchRate, // ★修正箇所: 計算された値をセット
              isMatched: isMatched,
            } as UserLike;
          }
        } catch (error) {
          console.error(`Error fetching user ${targetUserId}:`, error);
        }
        return null;
      });

      const results = await Promise.all(promises);

      const validUsers = results.filter((item: any): item is UserLike => item !== null && !item.isMatched);

      setHasExpiredLikes(expiredFound);
      setReceivedLikes(validUsers);
      setReceivedCount(validUsers.length);

      setLoadingReceived(false);
    }, (error) => {
      console.error("Received snapshot error:", error);
      setLoadingReceived(false);
    });

    const sentRef = collection(db, 'users', currentUser.uid, 'sentLikes');
    const qSent = query(sentRef, orderBy('createdAt', 'desc'), limit(30));

    const unsubscribeSent = onSnapshot(qSent, async (snapshot) => {

      // ★新規追加: 自分のsenseVectorを取得
      let myVector: any = null;
      try {
        const mySenseDataRef = doc(db, 'users', currentUser.uid, 'senseData', 'profile');
        const mySenseDataSnap = await getDoc(mySenseDataRef);
        myVector = mySenseDataSnap.exists() ? mySenseDataSnap.data()?.senseVector : null;
      } catch (error) {
        console.error("Error fetching my sense data:", error);
      }
      // ★新規追加ここまで

      const promises = snapshot.docs.map(async (docSnap: any) => {
        const data = docSnap.data();
        const targetUserId = data.targetUserId;

        if (!targetUserId) return null;

        try {
          const userDocRef = doc(db, 'users', targetUserId,);
          const userDoc = await getDoc(userDocRef);

          const receivedLikesRef = collection(db, 'users', currentUser.uid, 'receivedLikes');
          const receivedLikeQuery = query(receivedLikesRef, where('fromUserId', '==', targetUserId));
          const receivedLikeSnapshot = await getDocs(receivedLikeQuery);

          const isMatched = !receivedLikeSnapshot.empty;

          if (userDoc.exists()) {
            const userData = userDoc.data();

            // ★新規追加: 相手のsenseVectorを取得してSENSE MATCH率を計算
            let calculatedMatchRate = 0;
            try {
              const otherSenseDataRef = doc(db, 'users', targetUserId, 'senseData', 'profile');
              const otherSenseDataSnap = await getDoc(otherSenseDataRef);
              const otherVector = otherSenseDataSnap.exists() ? otherSenseDataSnap.data()?.senseVector : null;
              if (myVector && otherVector) {
                const rate = calculateSynchroPercentage(myVector, otherVector);
                if (rate > 0) calculatedMatchRate = rate;
              }
            } catch (error) {
              console.error("Error calculating match rate for sent like:", error);
            }
            // ★新規追加ここまで

            return {
              id: targetUserId,
              likeDocId: docSnap.id,
              age: calculateAge(userData?.birthDate),
              ...userData,
              receivedAt: data.createdAt,
              questionAnswer: data.questionAnswer || data.answer,
              isNew: false,
              compatibility: calculatedMatchRate, // ★修正箇所: 計算された値をセット
              isMatched: isMatched,
            } as UserLike;
          }
        } catch (error) {
          console.error(`Error fetching user ${targetUserId}:`, error);
        }
        return null;
      });

      const results = await Promise.all(promises);
      const validUsers = results.filter((item: any): item is UserLike => item !== null && !item.isMatched);

      setSentLikes(validUsers);
      setLoadingSent(false);
    }, (error) => {
      console.error("Sent snapshot error:", error);
      setLoadingSent(false);
    });

    return () => {
      unsubscribeReceived();
      unsubscribeSent();
      unsubscribeMe();
    };
  }, []);

  const handleTabPress = (tabName: TabType, index: number) => {
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

  const handleAnswerIconPress = (item: UserLike) => {
    setSelectedUserForAnswer(item);
    setAnswerModalVisible(true);
  };

  const handleLikeFromAnswerModal = () => {
    if (selectedUserForAnswer) {
      setAnswerModalVisible(false);
      handleLikePress(selectedUserForAnswer, false);
    }
  };

  const handleUserPress = (item: UserLike, isExpired: boolean) => {
    if (item.isBlur) return;
    if (isExpired) return;

    navigation.navigate('UserProfile', { userId: item.id });
  };

  const ensureAuthenticated = async () => {
    const currentUser = auth.currentUser;
    if (!currentUser) return null;
    try {
      await currentUser.getIdToken(true);
    } catch (e) {
      console.log("Token refresh ignored in plan B");
    }
    return currentUser;
  };

  const sendLikeToCloud = async (item: UserLike, answer: string | null = null) => {
    setQuestionModalVisible(false);

    const auth = getAuth();
    let currentUser = auth.currentUser;
    if (!currentUser) {
      currentUser = await ensureAuthenticated();
    }

    if (!currentUser) {
      Alert.alert('エラー', 'ログイン状態を確認できませんでした。再ログインしてください。');
      return;
    }

    try {
      setNewMatchId(null);
      const matchesRef = collection(db, 'matches');
      const qMatch = query(matchesRef, where('users', 'array-contains', currentUser.uid));
      const unsubscribe = onSnapshot(qMatch, (snapshot) => {
        for (const docSnap of snapshot.docs) {
          const data = docSnap.data();
          if (data.users && Array.isArray(data.users) && data.users.includes(item.id)) {
            setNewMatchId(docSnap.id);
            unsubscribe();
            break;
          }
        }
      });

      const queueRef = collection(db, 'likes_queue');

      await addDoc(queueRef, {
        fromUserId: currentUser.uid,
        toUserId: item.id,
        answer: answer,
        createdAt: serverTimestamp(),
        status: 'pending',
      });

      setAnswerText('');

      setReceivedLikes(prevLikes =>
        prevLikes.map(like =>
          like.id === item.id ? { ...like, isMatched: true } : like
        )
      );
    } catch (error) {
      console.error('Firestore write error:', error);
      Alert.alert('エラー', 'いいねの送信に失敗しました。通信環境を確認してください。');
    }
  };

  const handleLikePress = async (item: UserLike, isExpired: boolean) => {
    if (isExpired) return;

    const currentUser = auth.currentUser;
    if (!currentUser) return;

    setSelectedUserForLike(item);

    if (item.question && item.question.trim().length > 0) {
      setQuestionModalVisible(true);
    } else {
      await sendLikeToCloud(item);
      setIsMatchingModalVisible(true);
    }
  };

  const handleSubmitAnswer = async () => {
    if (!answerText.trim()) {
      Alert.alert('未入力', '質問への回答を入力してください。');
      return;
    }
    if (!selectedUserForLike) return;

    await sendLikeToCloud(selectedUserForLike as UserLike, answerText);
    setIsMatchingModalVisible(true);
  };

  const getImageSource = (img: any, gender: any, status: any) => {
    if (img && status === 'approved') {
      if (typeof img === 'string' && img.startsWith('http')) return { uri: img };
    }
    if (gender === 'male' || gender === '男性') {
      return DEFAULT_MALE_IMAGE;
    }
    return DEFAULT_FEMALE_IMAGE;
  };

  const renderItem = (tabType: TabType) => ({ item }: { item: UserLike }) => {
    if (item.isBlur) {
      return <View style={styles.blurCard} />;
    }

    const imageSource = getImageSource(item.photoURL, item.gender, item.mainPhotoStatus);
    const isExpired = tabType === 'received' && checkIsExpired(item.receivedAt);

    return (
      <TouchableOpacity
        style={styles.card}
        activeOpacity={0.9}
        onPress={() => handleUserPress(item, isExpired)}
      >
        <View style={{ height: CARD_WIDTH * 1.3 }}>
          <Image
            source={imageSource}
            style={{ width: '100%', height: '100%' }}
            resizeMode="cover"
            blurRadius={isExpired ? 20 : 0}
          />

          {isExpired ? (
            <View style={[StyleSheet.absoluteFill, styles.expiredOverlay]}>
              <View style={styles.expiredBadgeContainer}>
                <View style={styles.expiredIconCircle}>
                  <MaterialIcons name="history-toggle-off" size={24} color="#CCC" />
                </View>

                <Text style={styles.expiredTitle}>期限切れ</Text>
              </View>
            </View>
          ) : (
            <>
              <LinearGradient
                colors={['transparent', 'transparent', 'rgba(0,0,0,0.7)']}
                style={styles.gradient}
              />
              {item.isNew && (
                <View style={styles.newBadge}>
                  <Text style={styles.newBadgeText}>NEW</Text>
                </View>
              )}
              <View style={styles.infoOverlay}>
                <Text style={styles.name} numberOfLines={1}>
                  {item.displayName || 'No Name'} <Text style={styles.age}>{item.age || '?'}歳</Text>
                </Text>
                <Text style={styles.location} numberOfLines={1}>{item.location || '未設定'}</Text>
              </View>
            </>
          )}
        </View>

        <View style={styles.actionContainer}>
          <View style={styles.compatibilityRow}>
            <Ionicons name="heart" size={12} color="#FF6B6B" />
            <Text style={styles.compatibilityText}>{item.compatibility}%</Text>
          </View>

          {tabType === 'received' && item.questionAnswer && !item.isMatched && (
            <TouchableOpacity
              style={styles.answerIconButton}
              onPress={() => handleAnswerIconPress(item)}
            >
              <MaterialCommunityIcons name="comment-question-outline" size={20} color="#4A90E2" />
            </TouchableOpacity>
          )}

          {tabType === 'received' ? (
            <TouchableOpacity
              style={[styles.thankButtonContainer]}
              onPress={() => {
                if (item.questionAnswer && myQuestion && myQuestion.trim().length > 0) {
                  setUserForAlert(item);
                  setAlertModalVisible(true);
                } else {
                  handleLikePress(item, isExpired);
                }
              }}
              disabled={isExpired}
            >
              <LinearGradient
                colors={['#38BDF8', '#3B82F6']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.thankButtonGradient}
              >
                <Text style={styles.thankButtonText}>いいね</Text>
              </LinearGradient>
            </TouchableOpacity>
          ) : (
            <View style={styles.sentButton}>
              <Text style={styles.sentButtonText}>送信済み</Text>
            </View>
          )}
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      <SafeAreaView style={{ flex: 1, backgroundColor: '#FFF' }} edges={['top', 'left', 'right']}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
            <Ionicons name="chevron-back" size={28} color="#333" />
          </TouchableOpacity>

          <Text style={styles.headerTitle}>いいね！</Text>

          <View style={styles.headerButton} />
        </View>

        <View style={styles.tabContainer}>
          <TouchableOpacity
            style={styles.tabButton}
            onPress={() => handleTabPress('received', 0)}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Text style={[styles.tabText, activeTab === 'received' && styles.activeTabText]}>
                もらったいいね！
              </Text>

              <View style={styles.countBadge}>
                <Text style={styles.countBadgeText}>{receivedCount}</Text>
              </View>
            </View>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.tabButton}
            onPress={() => handleTabPress('sent', 1)}
          >
            <Text style={[styles.tabText, activeTab === 'sent' && styles.activeTabText]}>
              送ったいいね！
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

        <View style={styles.matchedNoticeContainer}>
          <Ionicons name="information-circle-outline" size={16} color="#666" style={{ marginRight: 4 }} />
          <Text style={styles.matchedNoticeText}>
            マッチング済みのお相手は「マッチング」一覧をご覧ください
          </Text>
        </View>


        <View style={styles.warningContainerWrapper}>
          <View style={styles.warningContainer}>
            <MaterialIcons name="access-time" size={20} color="#D4AF37" style={{ marginRight: 8 }} />

            <Text style={styles.warningText}>
              直近の【もらったいいね】は<Text style={styles.warningHighlight}>3日間</Text>で確認できなくなります
            </Text>

            <TouchableOpacity style={styles.warningLinkBtn}>
              <Text style={styles.warningLink}>詳しく</Text>
            </TouchableOpacity>
          </View>
        </View>

        {loadingReceived || loadingSent ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#4A90E2" />
          </View>
        ) : (
          <View style={styles.content}>
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
              <View style={{ width, flex: 1 }}>
                <FlatList
                  data={receivedLikes}
                  renderItem={renderItem('received')}
                  keyExtractor={(item, index) => item.id || `blur-${index}`}
                  numColumns={2}
                  columnWrapperStyle={{ justifyContent: 'space-between' }}
                  contentContainerStyle={{ padding: 16, paddingBottom: 100 }}
                  ListEmptyComponent={
                    <View style={styles.emptyContainer}>
                      <Ionicons name="heart-dislike-outline" size={64} color="#CCC" />
                      <Text style={styles.emptyText}>まだいいねが届いていません</Text>
                    </View>
                  }
                />

                {hasExpiredLikes && (
                  <View style={styles.lockOverlay} pointerEvents="box-none">
                    <View style={styles.lockCard}>
                      <Ionicons name="lock-closed" size={24} color="#F59E0B" style={{ marginBottom: 8 }} />
                      <Text style={styles.lockTitle}>もっと相手を見たいですか？</Text>
                      <TouchableOpacity style={styles.upgradeButton}>
                        <Text style={styles.upgradeText}>有料会員になって全て見る</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                )}
              </View>

              <View style={{ width, flex: 1 }}>
                <FlatList
                  data={sentLikes}
                  renderItem={renderItem('sent')}
                  keyExtractor={(item, index) => item.id || `blur-${index}`}
                  numColumns={2}
                  columnWrapperStyle={{ justifyContent: 'space-between' }}
                  contentContainerStyle={{ padding: 16, paddingBottom: 100 }}
                  ListEmptyComponent={
                    <View style={styles.emptyContainer}>
                      <Ionicons name="heart-dislike-outline" size={64} color="#CCC" />
                      <Text style={styles.emptyText}>まだいいねを送っていません</Text>
                    </View>
                  }
                />
              </View>
            </ScrollView>
          </View>
        )}
      </SafeAreaView>

      <Modal
        visible={questionModalVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setQuestionModalVisible(false)}
      >
        {Platform.OS === 'ios' ? (
          <KeyboardAvoidingView
            behavior="padding"
            style={styles.modalOverlay}
          >
            <TouchableWithoutFeedback onPress={() => setQuestionModalVisible(false)}>
              <View style={styles.modalBackdrop} />
            </TouchableWithoutFeedback>

            <View style={[styles.modalContent, { paddingBottom: Math.max(insets.bottom, 8) }]}>
              <View style={styles.modalHandle} />

              <Text style={styles.modalTitle}>Message & Like</Text>
              <Text style={styles.modalSubtitle}>
                質問に答えてアピールしましょう！
              </Text>

              <View style={styles.modalQuestionBox}>
                <Text style={styles.modalQuestionLabel}>お相手の"QUESTION"</Text>
                <Text style={styles.modalQuestionText}>{selectedUserForLike?.question}</Text>
              </View>

              <TextInput
                style={styles.answerInput}
                placeholder="回答を入力してください..."
                placeholderTextColor="#94A3B8"
                multiline
                value={answerText}
                onChangeText={setAnswerText}
                maxLength={30}
              />
              <Text style={styles.charCount}>{answerText.length}/30</Text>

              <View style={styles.modalButtonRow}>
                <TouchableOpacity
                  style={styles.cancelButton}
                  onPress={() => setQuestionModalVisible(false)}
                >
                  <Text style={styles.cancelButtonText}>キャンセル</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.submitButton, !answerText.trim() && styles.submitButtonDisabled]}
                  onPress={handleSubmitAnswer}
                  disabled={!answerText.trim()}
                >
                  <LinearGradient
                    colors={answerText.trim() ? ['#38BDF8', '#3B82F6'] : ['#E2E8F0', '#E2E8F0']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.submitGradient}
                  >
                    <Text style={[styles.submitButtonText, !answerText.trim() && { color: '#94A3B8' }]}>
                      回答して送信
                    </Text>
                  </LinearGradient>
                </TouchableOpacity>
              </View>
            </View>
          </KeyboardAvoidingView>
        ) : (
          <View style={[styles.modalOverlay, { marginBottom: keyboardOffset }]}>
            <TouchableWithoutFeedback onPress={() => setQuestionModalVisible(false)}>
              <View style={styles.modalBackdrop} />
            </TouchableWithoutFeedback>

            <View style={[styles.modalContent, { paddingBottom: Math.max(insets.bottom, 8) }]}>
              <View style={styles.modalHandle} />

              <Text style={styles.modalTitle}>Answer & Like</Text>
              <Text style={styles.modalSubtitle}>
                質問に答えてアピールしましょう！
              </Text>

              <View style={styles.modalQuestionBox}>
                <Text style={styles.modalQuestionLabel}>お相手の"QUESTION"</Text>
                <Text style={styles.modalQuestionText}>{selectedUserForLike?.question}</Text>
              </View>

              <TextInput
                style={styles.answerInput}
                placeholder="回答を入力してください..."
                placeholderTextColor="#94A3B8"
                multiline
                value={answerText}
                onChangeText={setAnswerText}
                maxLength={30}
              />
              <Text style={styles.charCount}>{answerText.length}/30</Text>

              <View style={styles.modalButtonRow}>
                <TouchableOpacity
                  style={styles.cancelButton}
                  onPress={() => setQuestionModalVisible(false)}
                >
                  <Text style={styles.cancelButtonText}>キャンセル</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.submitButton, !answerText.trim() && styles.submitButtonDisabled]}
                  onPress={handleSubmitAnswer}
                  disabled={!answerText.trim()}
                >
                  <LinearGradient
                    colors={answerText.trim() ? ['#38BDF8', '#3B82F6'] : ['#E2E8F0', '#E2E8F0']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.submitGradient}
                  >
                    <Text style={[styles.submitButtonText, !answerText.trim() && { color: '#94A3B8' }]}>
                      回答して送信
                    </Text>
                  </LinearGradient>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        )}
      </Modal>

      <Modal
        visible={alertModalVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setAlertModalVisible(false)}
      >
        <View style={styles.alertModalOverlay}>
          <TouchableWithoutFeedback onPress={() => setAlertModalVisible(false)}>
            <View style={styles.modalBackdrop} />
          </TouchableWithoutFeedback>

          <View style={styles.alertModalContent}>
            <View style={styles.alertIconContainer}>
              <MaterialCommunityIcons name="email-alert-outline" size={36} color="#4A90E2" />
            </View>

            <Text style={styles.alertModalText}>
              <Text style={styles.alertModalName}>{userForAlert?.displayName}</Text>
              さんから質問の回答が届いています。{'\n'}確認されますか？
            </Text>

            <View style={styles.alertButtonGroup}>
              <TouchableOpacity
                style={styles.alertConfirmButton}
                onPress={() => {
                  if (userForAlert) {
                    setSelectedUserForAnswer(userForAlert);
                    setAnswerModalVisible(true);
                  }
                }}
              >
                <Text style={styles.alertConfirmButtonText}>確認する</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.alertSkipButton}
                onPress={() => {
                  setAlertModalVisible(false);
                  if (userForAlert) {
                    handleLikePress(userForAlert, false);
                  }
                }}
              >
                <Text style={styles.alertSkipButtonText}>確認済みで"いいね"する</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal
        visible={answerModalVisible}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setAnswerModalVisible(false)}
      >
        <View style={styles.answerModalOverlay}>
          <TouchableWithoutFeedback onPress={() => setAnswerModalVisible(false)}>
            <View style={styles.modalBackdrop} />
          </TouchableWithoutFeedback>

          <View style={[styles.answerModalContent, { paddingBottom: Math.max(insets.bottom, 8) }]}>
            <View style={styles.modalHandle} />

            <View style={styles.answerModalHeader}>
              <MaterialCommunityIcons name="email-open-outline" size={28} color="#FF6B6B" />
              <Text style={styles.answerModalTitle}>ANSWER</Text>
            </View>

            <ScrollView style={styles.answerModalScroll} showsVerticalScrollIndicator={false}>
              {/* あなたの質問 */}
              <View style={styles.answerModalQuestionContainer}>
                <Text style={styles.answerModalQuestionLabel}>あなたの質問</Text>
                <Text style={styles.answerModalQuestionText}>
                  {selectedUserForAnswer?.question || '休日は何をして過ごすことが多いですか？'}
                </Text>
              </View>

              <View style={styles.previewCard}>
                <View style={styles.previewHeader}>
                  <View style={styles.previewBadge}>
                    <Text style={styles.previewBadgeText}>ANSWER</Text>
                  </View>
                </View>

                <Text style={styles.previewText}>
                  {selectedUserForAnswer?.questionAnswer || selectedUserForAnswer?.answer || '回答がありません'}
                </Text>
              </View>
            </ScrollView>

            <View style={styles.answerModalFooter}>
              <TouchableOpacity
                style={styles.answerModalLikeButton}
                onPress={handleLikeFromAnswerModal}
              >
                <LinearGradient
                  colors={['#38BDF8', '#3B82F6']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.answerModalLikeGradient}
                >
                  <Ionicons name="heart" size={20} color="#FFF" style={{ marginRight: 8 }} />
                  <Text style={styles.answerModalLikeText}>いいね！を返す</Text>
                </LinearGradient>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.answerModalCloseButton}
                onPress={() => setAnswerModalVisible(false)}
              >
                <Text style={styles.answerModalCloseText}>閉じる</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
      {/* ⏫ 修正箇所ここまで */}

      {selectedUserForLike && (
        <MatchingScreen
          visible={isMatchingModalVisible}
          partnerName={selectedUserForLike.displayName}
          onClose={() => setIsMatchingModalVisible(false)}
          onGoToChat={() => {
            if (!newMatchId) {
              Alert.alert('処理中', 'マッチング処理を完了しています。数秒後にもう一度お試し下さい。')
              return;
            }
            setIsMatchingModalVisible(false);
            navigation.navigate('Chat', {
              matchId: newMatchId,
              recipientId: selectedUserForLike.id,
              recipientName: selectedUserForLike.displayName,
              recipientImage: typeof selectedUserForLike.photoURL === 'string' ? { uri: selectedUserForLike.photoURL } : selectedUserForLike.photoURL
            });
          }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFF', },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F5F7FA', },
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16,
    paddingVertical: 12, backgroundColor: '#FFF',
  },
  backButton: {},
  headerButton: { width: 40, alignItems: 'center', justifyContent: 'center', },
  headerTitle: { fontSize: 18, fontWeight: '800', color: '#333', },
  tabContainer: {
    flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: '#EEE',
    backgroundColor: '#FFF', position: 'relative',
  },
  tabButton: { flex: 1, paddingVertical: 14, alignItems: 'center', justifyContent: 'center', },
  tabText: { fontSize: 14, fontWeight: '600', color: '#999', },
  activeTabText: { color: '#4A90E2', fontWeight: '700', },
  indicator: {
    position: 'absolute', bottom: 0, left: 0, height: 3, width: '50%',
    backgroundColor: '#4A90E2', borderTopLeftRadius: 3, borderTopRightRadius: 3,
  },
  countBadge: { backgroundColor: '#FF6B6B', borderRadius: 10, paddingHorizontal: 6, paddingVertical: 2, marginLeft: 6, },
  countBadgeText: { color: '#FFF', fontSize: 10, fontWeight: '700', },
  matchedNoticeContainer: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 8,
    backgroundColor: '#F8F9FA', borderBottomWidth: 1, borderBottomColor: '#E2E8F0',
  },
  matchedNoticeText: { fontSize: 11, color: '#64748B', fontWeight: '500', },
  warningContainerWrapper: { backgroundColor: '#F5F7FA', paddingTop: 16, paddingHorizontal: 16, paddingBottom: 8, },
  warningContainer: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFF', paddingVertical: 12, paddingHorizontal: 16,
    borderRadius: 12, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05,
    shadowRadius: 2, elevation: 2,
  },
  warningText: { flex: 1, fontSize: 13, color: '#555', },
  warningHighlight: { color: '#FF6B6B', fontWeight: '700', },
  warningLinkBtn: { marginLeft: 8, },
  warningLink: { color: '#4A90E2', fontSize: 13, fontWeight: '600', },
  content: { flex: 1, backgroundColor: '#F5F7FA', },
  emptyContainer: { alignItems: 'center', marginTop: 100, },
  emptyText: { marginTop: 16, color: '#999', fontSize: 14, },
  card: {
    width: CARD_WIDTH, backgroundColor: '#FFF', borderRadius: 16, marginBottom: 16, overflow: 'hidden', shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 4, elevation: 3,
  },
  blurCard: { width: CARD_WIDTH, height: CARD_WIDTH * 1.3, backgroundColor: '#E1E4E8', borderRadius: 16, marginBottom: 16, opacity: 0.6, },
  gradient: { position: 'absolute', bottom: 0, width: '100%', height: '50%', },
  newBadge: {
    position: 'absolute', top: 10, left: 10, backgroundColor: '#FF512F', paddingHorizontal: 8, paddingVertical: 4,
    borderRadius: 8, zIndex: 10,
  },
  newBadgeText: { color: '#FFF', fontSize: 10, fontWeight: '800', },
  infoOverlay: { position: 'absolute', bottom: 10, left: 10, right: 10, },
  name: {
    fontSize: 16, fontWeight: '800', color: '#FFF', textShadowColor: 'rgba(0, 0, 0, 0.5)', textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  age: { fontSize: 13, fontWeight: '500', },
  location: {
    color: '#EEE', fontSize: 11, marginTop: 2, fontWeight: '500', textShadowColor: 'rgba(0, 0, 0, 0.5)',
    textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 2,
  },
  actionContainer: { padding: 5, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', },
  compatibilityRow: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFF0F0', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 8,
  },
  disabledCompatibility: { backgroundColor: '#F5F5F5', },
  compatibilityText: { fontSize: 10, color: '#FF6B6B', fontWeight: '700', marginLeft: 2, },
  thankButton: {
    backgroundColor: '#FF6B6B', borderRadius: 20, paddingVertical: 6, paddingHorizontal: 12, alignItems: 'center',
  },
  sentButton: {
    backgroundColor: '#F0F0F0', borderRadius: 20, paddingVertical: 6, paddingHorizontal: 12, alignItems: 'center',
  },
  disabledButton: { backgroundColor: '#888', },
  disabledButtonText: { color: '#FFF', },
  thankButtonText: { color: '#FFF', fontSize: 11, fontWeight: '700', },
  sentButtonText: { color: '#999', fontSize: 11, fontWeight: '700', },
  expiredOverlay: { justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.75)', },
  expiredBadgeContainer: { alignItems: 'center', padding: 10, },
  expiredIconCircle: {
    width: 48, height: 48, borderRadius: 24, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center',
    alignItems: 'center', marginBottom: 6,
  },
  expiredTitle: { fontSize: 15, fontWeight: '800', color: '#333', marginBottom: 4, },
  expiredSubtitleContainer: {
    backgroundColor: '#FFF', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 12, elevation: 2,
    shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 2,
  },
  expiredSubtitle: { fontSize: 10, fontWeight: '700', color: '#555', },
  lockOverlay: { position: 'absolute', bottom: 10, width: '100%', padding: 24, paddingBottom: 40, alignItems: 'center', },
  lockCard: {
    backgroundColor: 'rgba(255,255,255,0.95)', borderRadius: 20, padding: 24, alignItems: 'center', width: '100%',
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.15, shadowRadius: 10, elevation: 10,
  },
  lockTitle: { fontSize: 15, fontWeight: '800', color: '#333', marginBottom: 12, },
  upgradeButton: { width: '100%', backgroundColor: '#4A90E2', paddingVertical: 14, borderRadius: 30, alignItems: 'center', },
  upgradeText: { color: '#FFF', fontWeight: '800', fontSize: 14, },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(15, 23, 42, 0.6)', justifyContent: 'flex-end' },
  modalBackdrop: { ...StyleSheet.absoluteFillObject },
  modalContent: {
    backgroundColor: '#FFF', borderTopLeftRadius: 32, borderTopRightRadius: 32, padding: 24, paddingBottom: 40, minHeight: 480
  },
  modalHandle: { width: 40, height: 4, backgroundColor: '#E2E8F0', borderRadius: 2, alignSelf: 'center', marginBottom: 24 },
  modalTitle: { fontSize: 22, fontWeight: '800', color: '#1E293B', textAlign: 'center', marginBottom: 8 },
  modalSubtitle: { fontSize: 14, color: '#64748B', textAlign: 'center', marginBottom: 24 },
  modalQuestionBox: {
    backgroundColor: '#EFF6FF', padding: 16, borderRadius: 16, marginBottom: 24, borderLeftWidth: 4, borderLeftColor: '#2563EB'
  },
  modalQuestionLabel: { fontSize: 11, fontWeight: '800', color: '#2563EB', marginBottom: 6, letterSpacing: 1 },
  modalQuestionText: { fontSize: 16, fontWeight: '700', color: '#1E293B', lineHeight: 24 },
  answerInput: {
    backgroundColor: '#F8FAFC', borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 16,
    padding: 16, height: 120, fontSize: 16, color: '#1E293B', textAlignVertical: 'top', marginBottom: 8
  },
  charCount: { textAlign: 'right', fontSize: 12, color: '#94A3B8', marginBottom: 20 },
  modalButtonRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 12 },
  cancelButton: { flex: 1, paddingVertical: 16, borderRadius: 30, backgroundColor: '#F1F5F9', alignItems: 'center' },
  cancelButtonText: { fontSize: 15, fontWeight: '700', color: '#64748B' },
  submitButton: {
    flex: 2, borderRadius: 30, elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2, shadowRadius: 1.5,
  },
  submitButtonDisabled: { elevation: 0, shadowOpacity: 0, },
  submitGradient: { paddingVertical: 16, alignItems: 'center', justifyContent: 'center', borderRadius: 30 },
  submitButtonText: { fontSize: 16, fontWeight: '700', color: '#FFF' },
  answerModalOverlay: { flex: 1, backgroundColor: 'rgba(15, 23, 42, 0.6)', justifyContent: 'flex-end', },
  answerModalContent: {
    backgroundColor: '#FFF', borderTopLeftRadius: 32, borderTopRightRadius: 32, paddingTop: 16,
    paddingHorizontal: 24, paddingBottom: Platform.OS === 'ios' ? 40 : 24, maxHeight: '85%',
  },
  answerModalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginBottom: 24, },
  answerModalTitle: { fontSize: 20, fontWeight: '800', color: '#333', marginLeft: 8, },
  answerModalScroll: { marginBottom: 24, },
  answerModalQuestionContainer: {
    backgroundColor: '#F8FAFC', padding: 16, borderRadius: 16, marginBottom: 20, borderWidth: 1, borderColor: '#E2E8F0',
  },
  answerModalQuestionLabel: { fontSize: 12, fontWeight: '700', color: '#64748B', marginBottom: 8, },
  answerModalQuestionText: { fontSize: 15, fontWeight: '600', color: '#333', lineHeight: 22, },
  previewCard: {
    backgroundColor: '#EFF6FF', borderRadius: 20, padding: 20, borderWidth: 1, borderColor: '#DBEAFE', borderLeftWidth: 4,
    borderLeftColor: '#2563EB', shadowColor: "#2563EB", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.05,
    shadowRadius: 12, elevation: 2, marginTop: 8,
  },
  previewHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, },
  previewBadge: { backgroundColor: '#2563EB', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, },
  previewBadgeText: { color: '#FFF', fontSize: 9, fontWeight: '800', letterSpacing: 1, },
  previewText: { fontSize: 16, fontWeight: '700', color: '#1E293B', lineHeight: 24, marginBottom: 12, },
  previewFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', },
  previewFooterText: { fontSize: 10, color: '#94A3B8', marginLeft: 4, fontWeight: '600', },
  answerModalFooter: { alignItems: 'center', },
  answerModalLikeButton: {
    width: '100%', borderRadius: 30, overflow: 'hidden', elevation: 3, shadowColor: '#FF512F', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3, shadowRadius: 8, marginBottom: 16,
  },
  answerModalLikeGradient: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 16, },
  answerModalLikeText: { fontSize: 16, fontWeight: '800', color: '#FFF', },
  answerModalCloseButton: { paddingVertical: 12, },
  answerModalCloseText: { fontSize: 15, fontWeight: '600', color: '#94A3B8', },
  answerIconButton: { padding: 6, backgroundColor: '#EFF6FF', borderRadius: 16, },
  thankButtonContainer: { borderRadius: 20, overflow: 'hidden', },
  thankButtonGradient: { paddingVertical: 6, paddingHorizontal: 12, alignItems: 'center', justifyContent: 'center', },
  alertModalOverlay: { flex: 1, backgroundColor: 'rgba(15, 23, 42, 0.6)', justifyContent: 'center', alignItems: 'center', padding: 24, },
  alertModalContent: {
    backgroundColor: '#FFF', borderRadius: 24, width: '100%', padding: 24, alignItems: 'center', shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.15, shadowRadius: 20, elevation: 10,
  },
  alertIconContainer: {
    width: 64, height: 64, borderRadius: 32, backgroundColor: '#EFF6FF', justifyContent: 'center', alignItems: 'center', marginBottom: 16,
  },
  alertModalText: { fontSize: 16, color: '#333', textAlign: 'center', lineHeight: 24, marginBottom: 24, },
  alertModalName: { fontWeight: '800', },
  alertButtonGroup: { width: '100%', gap: 12, },
  alertConfirmButton: { backgroundColor: '#4A90E2', paddingVertical: 14, borderRadius: 16, alignItems: 'center', width: '100%' },
  alertConfirmButtonText: { color: '#FFF', fontSize: 15, fontWeight: '700', },
  alertSkipButton: {
    backgroundColor: '#F1F5F9', paddingVertical: 14, borderRadius: 16, alignItems: 'center', width: '100%',
    marginTop: Platform.OS === 'ios' ? 0 : 12,
  },
  alertSkipButtonText: { color: '#64748B', fontSize: 14, fontWeight: '700', },
});