import React, { useState, useRef, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Image, TouchableOpacity, Dimensions, StatusBar, Animated, Easing, Alert, ActivityIndicator,
  Modal, TextInput, KeyboardAvoidingView, Platform, TouchableWithoutFeedback, Keyboard, FlatList
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import Ionicons from 'react-native-vector-icons/Ionicons';
import LinearGradient from 'react-native-linear-gradient';
import { BlurView } from '@react-native-community/blur';
import auth from '@react-native-firebase/auth';
import firestore from '@react-native-firebase/firestore';
import MatchingScreen from './MatchingScreen';

const { width, height } = Dimensions.get('window');
const IMAGE_HEIGHT = height * 0.65;

const DEFAULT_MALE_IMAGE = require('../assets/man.png');
const DEFAULT_FEMALE_IMAGE = require('../assets/woman.png');

const NOTE_IMAGE = require('../assets/note.jpg')

const THEME = {
  primary: '#2563EB', secondary: '#4F46E5', background: '#F8FAFC', cardBg: '#FFFFFF', textMain: '#1E293B',
  textSub: '#64748B', accent: '#F59E0B', likeStart: '#38BDF8', likeEnd: '#3B82F6', likeShadow: '#7DD3FC',
};

interface SubPhotoData {
  url: string;
  comment?: string;
  tags?: string[];
}

interface UserProfile {
  id: string; displayName?: string; birthDate?: any; gender?: string; photoURL?: string; photoStoragePath?: string; mainPhotoStatus?: string; isOnline?: boolean;
  location?: string; matchRate?: number; interests?: string[]; bio?: string; question?: string; birthPlace?: string; height?: string;
  bodyType?: string; bloodType?: string; sibling?: string; personality?: string; occupation?: string; workTime?: string; income?: string;
  education?: string; lifeStyle?: string; cookingFrequency?: string; holiday?: string; alcohol?: string; tobacco?: string;
  roommate?: string; contactFrequency?: string; marital?: string; marry?: string; date?: string; child?: string; encounter?: string;
  privacySettings?: { footprints?: boolean; }; isVerified: boolean;
}

interface InfoRowProps {
  iconName: any;
  iconLib?: 'MaterialCommunityIcons' | 'Ionicons';
  label: string;
  value?: string | number;
}

const InfoRow: React.FC<InfoRowProps> = ({ iconName, iconLib, label, value }) => {

  const IconComponent = iconLib === 'MaterialCommunityIcons' ? MaterialCommunityIcons : Ionicons;
  return (
    <View style={styles.infoRow}>
      <View style={styles.infoLabelContainer}>
        <IconComponent name={iconName} size={20} color="#94A3B8" style={{ marginRight: 12 }} />
        <Text style={styles.infoLabel}>{label}</Text>
      </View>
      <Text style={styles.infoValue}>{value || '未設定'}</Text>
    </View>
  );
};

const Tag = ({ text }: { text: string }) => (
  <View style={styles.tag}>
    <Text style={styles.tagText}>#{text}</Text>
  </View>
);

const calculateAge = (birthDate: any, fallbackAge?: number) => {
  if (fallbackAge !== undefined) return fallbackAge;
  if (!birthDate) return '??';

  const birth = birthDate.toDate ? birthDate.toDate() : new Date(birthDate);
  const today = new Date();
  let calculatedAge = today.getFullYear() - birth.getFullYear();
  if (today.getMonth() < birth.getMonth() || (today.getMonth() === birth.getMonth() && today.getDate() < birth.getDate())) {
    calculatedAge--;
  }
  return calculatedAge;
};

export default function UserProfileScreen({ navigation, route }: any) {
  const { userId } = route.params;
  const insets = useSafeAreaInsets();
  const [user, setUser] = useState<UserProfile | null>(null);
  const [loadingProfile, setLoadingProfile] = useState(true);
  const [subPhotos, setSubPhotos] = useState<SubPhotoData[]>([]);
  const [selectedSubPhoto, setSelectedSubPhoto] = useState<SubPhotoData | null>(null);
  const [isLiked, setIsLiked] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [checkingStatus, setCheckingStatus] = useState(true);
  const [isFavorited, setIsFavorited] = useState(false);
  const [isFavoriteProcessing, setIsFavoriteProcessing] = useState(false);
  const [isnotePage, setIsnotePage] = useState(false);
  const [isMatched, setIsMatched] = useState(false);
  const [newMatchId, setNewMatchId] = useState<string | null>(null);
  const [matchId, setMatchId] = useState<string | null>(null);
  const [questionModalVisible, setQuestionModalVisible] = useState(false);
  const [answerText, setAnswerText] = useState('');
  const [hasReceivedLike, setHasReceivedLike] = useState(false);
  const floatAnim = useRef(new Animated.Value(0)).current;
  const [isMatchingModalVisible, setIsMatchingModalVisible] = useState(false);
  const [isMenuVisible, setIsMenuVisible] = useState(false);
  const [isMemoModalVisible, setIsMemoModalVisible] = useState(false);
  const [memoText, setMemoText] = useState('');
  const [isSavingMemo, setIsSavingMemo] = useState(false);
  const [keyboardOffset, setKeyboardOffset] = useState<number>(0);
  const [partnerAnswer, setPartnerAnswer] = useState<string | null>(null);
  const [myQuestion, setMyQuestion] = useState<string | null>(null);
  const [answerModalVisible, setAnswerModalVisible] = useState(false);
  const [selectedPhotoIndex, setSelectedPhotoIndex] = useState<number | null>(null);
  const flatListRef = useRef<FlatList>(null);
  const [enableModalScroll, setEnableModalScroll] = useState(true);

  const scaleAnim = useRef(new Animated.Value(1)).current;
  const scrollY = useRef(new Animated.Value(0)).current;

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const translateYAnim = useRef(new Animated.Value(0)).current;
  const translateXAnim = useRef(new Animated.Value(0)).current;
  const popupScaleAnim = useRef(new Animated.Value(0.8)).current;

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
    let isMounted = true;
    const fetchUserProfile = async () => {
      try {
        const userDoc = await firestore().collection('users').doc(userId).get();

        if (userDoc.exists() && isMounted) {
          setUser({ id: userDoc.id, isVerified: true, ...userDoc.data() } as UserProfile);//一時的に本人確認済み状態にしている
        } else {
          Alert.alert('エラー', 'ユーザーデータが見つかりませんでした。');
          navigation.goBack();
        }

        if (isMounted) {
          try {
            const subPhotosSnap = await firestore().collection('users').doc(userId).collection('subPhotos').get();
            const photosData: any[] = [];

            subPhotosSnap.forEach((d: any) => photosData.push(d.data()));

            photosData.sort((a, b) => (a.priority || 0) - (b.priority || 0));

            const validPhotos = photosData
              .filter(p => p.status === 'approved' && p.url)
              .map(p => ({
                url: p.url,
                comment: p.comment,
                tags: p.tags
              }))
              .slice(0, 5);

            setSubPhotos(validPhotos);
          } catch (subErr) {
            console.error("SubPhotos fetch error:", subErr)
          }
        }
      } catch (error) {
        console.error("Profile fetch error:", error);
        if (isMounted) {
          Alert.alert('エラー', 'データの取得に失敗しました。');
          navigation.goBack();
        }
      } finally {
        if (isMounted) setLoadingProfile(false);
      }
    };

    fetchUserProfile();
    return () => { isMounted = false; };
  }, [userId, navigation]);

  useEffect(() => {
    let isMounted = true;
    const fetchExistingMemo = async () => {
      const currentUser = auth().currentUser;
      if (!currentUser || !userId) return;

      try {
        const memoDoc = await firestore().collection('users').doc(currentUser.uid).collection('memos').doc(userId).get();
        if (memoDoc.exists() && isMounted) {
          const data = memoDoc.data();
          if (data?.text) {
            setMemoText(data.text)
          }
        }
      } catch (error) {
        console.error("Memo fetch error:", error);
      }
    };
    fetchExistingMemo();
    return () => { isMounted = false; };
  }, [userId]);

  useEffect(() => {
    let isMounted = true;
    const fetchMyDataAndPartnerAnswer = async () => {
      const currentUser = auth().currentUser;
      if (!currentUser || !userId) return;

      try {
        const myDoc = await firestore().collection('users').doc(currentUser.uid).get();
        if (myDoc.exists() && isMounted) {
          setMyQuestion(myDoc.data()?.question || null);
        }

        const receivedSnap = await firestore().collection('users').doc(currentUser.uid).collection('receivedLikes').where('fromUserId', '==', 'userId').get();

        if (!receivedSnap.empty && isMounted) {
          const data = receivedSnap.docs[0].data();
          if (data.questionAnswer) {
            setPartnerAnswer(data.questionAnswer);
          }
        }
      } catch (error) {
        console.error("Fetch Answer error:", error);
      }
    };
    fetchMyDataAndPartnerAnswer();
    return () => { isMounted = false; };
  }, [userId]);

  useEffect(() => {
    let isMounted = true;
    const checkFavoriteStatus = async () => {
      const currentUser = auth().currentUser;
      if (!currentUser || !userId) return;

      try {
        const docSnap = await firestore().collection('users').doc(currentUser.uid).collection('favorites').doc(userId).get();

        if (isMounted && docSnap.exists()) {
          setIsFavorited(true);
        }
      } catch (error) {
        console.error("Failed to check favorite status:", error);
      }
    };
    checkFavoriteStatus();
    return () => { isMounted = false; };
  }, [userId]);

  useEffect(() => {
    const recordFootprint = async () => {
      const currentUser = auth().currentUser;
      if (!currentUser || !user?.id || currentUser.uid === user.id) return;

      try {
        const myDoc = await firestore().collection('users').doc(currentUser.uid).collection('private').doc("settings").get();

        if (myDoc.exists()) {
          const myData = myDoc.data();
          if (myData?.privacySettings?.footprints === false) {
            return;
          }
        }

        const batch = firestore().batch();
        const timestamp = firestore.FieldValue.serverTimestamp();

        const receivedRef = firestore().collection('users').doc(user.id).collection('footprints_received').doc(currentUser.uid);
        batch.set(receivedRef, {
          visitorId: currentUser.uid,
          createdAt: timestamp,
        }, { merge: true });

        const sentRef = firestore().collection('users').doc(currentUser.uid).collection('footprints_sent').doc(user.id);
        batch.set(sentRef, {
          visitedId: user.id,
          createdAt: timestamp
        }, { merge: true });

        await batch.commit();
      } catch (error) {
        console.error('Error recording footprints:', error);
      }
    };

    if (user) {
      recordFootprint();
    }
  }, [user]);

  //"NOTE"の設定状況確認
  useEffect(() => {
    let isMounted = true;
    const checknotePage = async () => {
      if (!userId) {
        return;
      }

      const docSnap = await firestore().collection('users').doc(userId).collection('private').doc('settings').get();

      if (docSnap.exists()) {
        const data = docSnap.data();
        if (data?.notePages.length > 0) {
          setIsnotePage(true);
        }
      }
    };
    checknotePage();
    return () => { isMounted = false; };
  }, [userId])

  useEffect(() => {
    let isMounted = true;
    const checkLikeStatus = async () => {
      const currentUser = auth().currentUser;
      if (!currentUser || !userId) {
        if (isMounted) setCheckingStatus(false);
        return;
      }

      try {
        const docSnap = await firestore().collection('users').doc(currentUser.uid).collection('sentLikes').doc(userId).get();

        if (isMounted && docSnap.exists()) {
          setIsLiked(true);
        }
      } catch (error) {
        console.error("Failed to check like status:", error);
      } finally {
        if (isMounted) setCheckingStatus(false);
      }
    };
    checkLikeStatus();
    return () => { isMounted = false; };
  }, [userId]);

  useEffect(() => {
    let isMounted = true;
    const checkReceivedLikeStatus = async () => {
      const currentUser = auth().currentUser;
      if (!currentUser || !userId) return;

      try {
        const receivedSnap = await firestore().collection('users').doc(currentUser.uid).collection('receivedLikes').where('formUserId', '==', userId).get();

        if (isMounted && !receivedSnap.empty) {
          setHasReceivedLike(true);
        }
      } catch (error) {
        console.error("Failed to check received like status:", error);
      }
    };
    checkReceivedLikeStatus();
    return () => { isMounted = false; };
  }, [userId]);

  useEffect(() => {
    if (hasReceivedLike && !isMatched && !isLiked) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(floatAnim, {
            toValue: -10,
            duration: 1200,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
          Animated.timing(floatAnim, {
            toValue: 0,
            duration: 1200,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          })
        ])
      ).start();
    }
  }, [hasReceivedLike, isMatched, isLiked, floatAnim]);

  useEffect(() => {
    let isMounted = true;
    const checkMatchStatus = async () => {
      const currentUser = auth().currentUser;
      if (!currentUser || !userId) return;

      try {
        const querySnapshot = await firestore().collection('matches').where('users', 'array-contains', currentUser.uid).get();

        let foundMatchId = null;
        querySnapshot.forEach((doc: any) => {
          const data = doc.data();
          if (data.users && Array.isArray(data.users) && data.users.includes(userId)) {
            foundMatchId = doc.id;
          }
        });

        if (isMounted && foundMatchId) {
          setIsMatched(true);
          setMatchId(foundMatchId);
        }
      } catch (error) {
        console.error("Match check error:", error)
      }
    };
    checkMatchStatus();
    return () => { isMounted = false; };
  }, [userId]);

  const handleBlockAction = () => {
    setIsMenuVisible(true);
  };

  const handleReport = () => {
    setIsMenuVisible(false);
    setTimeout(() => {
      Alert.alert("完了", "運営に通報しました。ご報告ありがとうございます。")
    }, 300);
  };

  const handleMemoOpen = () => {
    setIsMenuVisible(false);
    setTimeout(() => {
      setIsMemoModalVisible(true);
    }, 300);
  };

  const handleSaveMemo = async () => {
    if (!user) return;
    setIsSavingMemo(true);
    const currentUser = auth().currentUser;

    if (!currentUser) {
      setIsSavingMemo(false);
      Alert.alert('エラー', 'ログイン状態を確認できませんでした。');
      return;
    }

    try {
      await firestore().collection('users').doc(currentUser.uid).collection('memos').doc(user.id).set({
        text: memoText.trim(),
        targetUserId: user.id,
        updatedAt: firestore.FieldValue.serverTimestamp(),
      }, { merge: true });

      setIsMemoModalVisible(false);
      setTimeout(() => {
        Alert.alert('完了', 'メモを保存しました。');
      }, 300);
    } catch (error) {
      console.error('Memo save error:', error);
    } finally {
      setIsSavingMemo(false);
    }
  };

  const handleBlockPrompt = () => {
    setIsMenuVisible(false);
    setTimeout(() => {
      confirmBlock();
    }, 300);
  }

  const confirmBlock = () => {
    Alert.alert(
      "ブロックの確認",
      `本当に${user?.displayName || 'このユーザー'}さんをブロックしますか？\nブロックすると、お互いにプロフィールが表示されなくなります。`,
      [
        { text: "やめる", style: "cancel" },
        { text: "ブロックする", style: "destructive", onPress: executeBlock }
      ]
    );
  };

  const executeBlock = async () => {
    const currentUser = auth().currentUser;
    const targetUser = user;

    if (!currentUser || !targetUser) return;

    try {
      await firestore().collection('users').doc(currentUser.uid).collection('blockedUsers').doc(targetUser.id).set({
        blockedAt: firestore.FieldValue.serverTimestamp(),
        name: targetUser.displayName || '未設定'
      });
      Alert.alert("完了", "ブロックが完了しました。");
      navigation.goBack();
    } catch (error) {
      console.error("Block error:", error);
      Alert.alert("エラー", "ブロック処理に失敗しました。");
    }
  };

  const handleFavoritePress = async () => {
    if (isFavoriteProcessing || !user) return;
    setIsFavoriteProcessing(true);

    const currentUser = auth().currentUser;
    if (!currentUser) {
      setIsFavoriteProcessing(false);
      Alert.alert('エラー', 'ログイン状態を確認できませんでした。');
      return;
    }

    try {
      const favRef = firestore().collection('users').doc(currentUser.uid).collection('favorites').doc(user.id);

      if (isFavorited) {
        await favRef.delete();
        setIsFavorited(false);
      } else {
        await favRef.set({
          createdAt: firestore.FieldValue.serverTimestamp(),
        });
        setIsFavorited(true);
      }
    } catch (error) {
      console.error('Favorite error:', error);
      Alert.alert('エラー', '再度お試し下さい。');
    } finally {
      setIsFavoriteProcessing(false);
    }
  };

  const getImageSource = () => {
    if (!user) return DEFAULT_MALE_IMAGE;

    const userImage = user.photoURL;
    const photoStatus = user.mainPhotoStatus;

    if (userImage && photoStatus === 'approved') {
      if (typeof userImage === 'string' && userImage.startsWith('http')) return { uri: userImage };
      if (typeof userImage === 'number') return userImage;
    }

    if (user.gender === 'female' || user.gender === '女性') {
      return DEFAULT_FEMALE_IMAGE;
    }
    return DEFAULT_MALE_IMAGE;
  };
  const imageSource = getImageSource();

  const ensureAuthenticated = async () => {
    const currentUser = auth().currentUser;
    if (!currentUser) return null;
    try {
      await currentUser.getIdToken(true);
    } catch (e) { }
    return currentUser;
  };

  const sendLikeToCloud = async (answer: string | null = null) => {
    setIsProcessing(true);
    setQuestionModalVisible(false);

    let currentUser = auth().currentUser;
    if (!currentUser) { currentUser = await ensureAuthenticated(); }

    if (!currentUser || !user) {
      setIsProcessing(false);
      Alert.alert('エラー', 'ログイン状態を確認できませんでした。再ログインしてください。');
      return;
    }

    try {
      if (hasReceivedLike) {
        setNewMatchId(null);
        const matchIdStr = [currentUser.uid, user.id].sort().join('_');
        setNewMatchId(matchIdStr);

        const matchAnswers: Record<string, string | null> = {};
        if (partnerAnswer) matchAnswers[user.id] = partnerAnswer;
        if (answer) matchAnswers[currentUser.uid] = answer;

        await firestore().collection('matches').doc(matchIdStr).set({
          users: [currentUser.uid, user.id],
          createdAt: firestore.FieldValue.serverTimestamp(),
          lastMessage: 'マッチングが成立しました！',
          lastMessageAt: firestore.FieldValue.serverTimestamp(),
          answers: matchAnswers,
        });
      } else {
        await firestore().collection('users').doc(currentUser.uid).collection('sentLikes').doc(user.id).set({
          targetUserId: user.id,
          answer: answer,
          createdAt: firestore.FieldValue.serverTimestamp(),
          targetUserSnapshot: {
            displayName: user.displayName || '名無し',
            photoURL: user.photoURL || '',
            photoStoragePath: user.photoStoragePath || '',
            age: calculateAge(user.birthDate),
            gender: user.gender || '',
            location: user.location || '',
            mainPhotoStatus: user.mainPhotoStatus || 'pending'
          }
        });
      }

      animateLikeButton();
      showLikePopup();
      setIsLiked(true);
      setAnswerText('');
    } catch (error) {
      console.error('Firestore write error:', error);
      Alert.alert('エラー', 'いいねの送信に失敗しました。通信環境を確認してください。');
    } finally {
      setIsProcessing(false);
    }
  };

  const animateLikeButton = () => {
    Animated.sequence([
      Animated.timing(scaleAnim, { toValue: 0.8, duration: 100, useNativeDriver: true, easing: Easing.ease }),
      Animated.spring(scaleAnim, { toValue: 1, friction: 3, tension: 40, useNativeDriver: true })
    ]).start();
  };

  const showLikePopup = () => {
    fadeAnim.setValue(0);
    translateYAnim.setValue(0);
    translateXAnim.setValue(0);
    popupScaleAnim.setValue(0.8);

    Animated.parallel([
      Animated.sequence([
        Animated.timing(fadeAnim, { toValue: 1, duration: 200, useNativeDriver: true }),
        Animated.delay(800),
        Animated.timing(fadeAnim, { toValue: 0, duration: 400, useNativeDriver: true }),
      ]),
      Animated.timing(translateYAnim, { toValue: -80, duration: 1400, easing: Easing.out(Easing.exp), useNativeDriver: true }),
      Animated.timing(translateXAnim, { toValue: -40, duration: 1400, easing: Easing.out(Easing.exp), useNativeDriver: true }),
      Animated.timing(popupScaleAnim, { toValue: 1.1, duration: 1400, useNativeDriver: true })
    ]).start();
  };

  const handleLikePress = () => {
    if (isLiked || isProcessing || !user) return;
    if (hasReceivedLike) {
      if (user.question && user.question.trim().length > 0) {
        setQuestionModalVisible(true);
      } else {
        sendLikeToCloud();
        setIsMatchingModalVisible(true);
      }
    } else {
      if (user.question && user.question.trim().length > 0) {
        setQuestionModalVisible(true);
      } else {
        sendLikeToCloud();
      }
    }
  };

  const handleSubmitAnswer = () => {
    if (!answerText.trim()) {
      Alert.alert('未入力', '質問への回答を入力してください。');
      return;
    }
    if (hasReceivedLike) {
      sendLikeToCloud(answerText);
      setIsMatchingModalVisible(true);
    } else {
      sendLikeToCloud(answerText);
    }
  };

  const handleMessagePress = () => {
    if (matchId) {
      navigation.navigate('Chat', {
        matchId: matchId, recipientId: user?.id, recipientName: user?.displayName,
        recipientImage: { uri: user?.photoURL }
      });
    } else {
      Alert.alert("エラー", "マッチング情報が見つかりません。");
    }
  };

  const handleNotePress = () => {
    if (user?.id) {
      navigation.navigate('NoteView', { userId: user.id });
    }
  }

  if (loadingProfile || checkingStatus) {
    return (
      <View style={[styles.container, styles.loadingContainer]}>
        <ActivityIndicator size="large" color={THEME.primary} />
      </View>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent={true} />

      <Modal visible={isMenuVisible} transparent={true} animationType="fade" onRequestClose={() => setIsMenuVisible(false)} >
        <TouchableOpacity style={styles.menuModalOverlay} activeOpacity={1} onPress={() => setIsMenuVisible(false)} >
          <View style={styles.menuContainer}>
            <TouchableOpacity style={styles.menuItem} onPress={handleMemoOpen}>
              <Ionicons name="document-text-outline" size={20} color={THEME.textMain} />
              <Text style={styles.menuItemText}>メモ</Text>
            </TouchableOpacity>

            <View style={styles.menuDivider} />

            <TouchableOpacity style={styles.menuItem} onPress={handleReport} >
              <Ionicons name="warning-outline" size={20} color={THEME.textMain} />
              <Text style={styles.menuItemText}>通報する</Text>
            </TouchableOpacity>

            <View style={styles.menuDivider} />

            <TouchableOpacity style={styles.menuItem} onPress={handleBlockPrompt}>
              <Ionicons name="ban-outline" size={20} color="#EF4444" />
              <Text style={[styles.menuItemText, { color: '#EF4444' }]}>ブロックする</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      <Modal visible={isMemoModalVisible} transparent={true} animationType="slide" onRequestClose={() => setIsMemoModalVisible(false)} >
        {Platform.OS === 'ios' ? (
          <KeyboardAvoidingView behavior={"padding"} style={styles.modalOverlay} >
            <TouchableWithoutFeedback onPress={() => setIsMemoModalVisible(false)}>
              <View style={styles.modalBackdrop} />
            </TouchableWithoutFeedback>

            <View style={[styles.memoModalContent, { paddingBottom: Math.max(insets.bottom, 8) }]}>
              <View style={styles.modalHandle} />

              <View style={styles.memoModalHeader}>
                <Ionicons name="document-text-outline" size={18} color={THEME.primary} style={{ marginRight: 6 }} />
                <Text style={styles.memoModalTitle}>プライベートメモ</Text>
              </View>

              <Text style={styles.memoModalSubtitle}> このメモはお相手には公開されません。{'\n'}気になったことをメモしておきましょう。</Text>

              <TextInput style={styles.memoInput} multiline value={memoText} onChangeText={setMemoText} maxLength={500}
                autoFocus={true} />
              <Text style={styles.charCount}>{memoText.length}/500</Text>

              <View style={styles.modalButtonRow}>
                <TouchableOpacity style={styles.cancelButton} onPress={() => setIsMemoModalVisible(false)} disabled={isSavingMemo}>
                  <Text style={styles.cancelButtonText}>キャンセル</Text>
                </TouchableOpacity>

                <TouchableOpacity style={[styles.saveButton, isSavingMemo && { opacity: 0.7 }]} onPress={handleSaveMemo}
                  disabled={isSavingMemo} >
                  {isSavingMemo ? (
                    <ActivityIndicator color="#FFF" size="small" />
                  ) : (
                    <Text style={styles.saveButtonText}>保存する</Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          </KeyboardAvoidingView>
        ) : (
          <View style={[styles.modalOverlay, { marginBottom: keyboardOffset }]} >
            <TouchableWithoutFeedback onPress={() => setIsMemoModalVisible(false)}>
              <View style={styles.modalBackdrop} />
            </TouchableWithoutFeedback>

            <View style={[styles.memoModalContent, { paddingBottom: Math.max(insets.bottom, 8) }]}>
              <View style={styles.modalHandle} />

              <View style={styles.memoModalHeader}>
                <Ionicons name="document-text-outline" size={18} color={THEME.primary} style={{ marginRight: 6 }} />
                <Text style={styles.memoModalTitle}>プライベートメモ</Text>
              </View>

              <Text style={styles.memoModalSubtitle}>このメモはお相手には公開されません。{'\n'}気になったことをメモしておきましょう。</Text>

              <TextInput style={styles.memoInput} multiline value={memoText} onChangeText={setMemoText} maxLength={500}
                autoFocus={true} />
              <Text style={styles.charCount}>{memoText.length}/500</Text>

              <View style={styles.modalButtonRow}>
                <TouchableOpacity style={styles.cancelButton} onPress={() => setIsMemoModalVisible(false)} disabled={isSavingMemo}>
                  <Text style={styles.cancelButtonText}>キャンセル</Text>
                </TouchableOpacity>

                <TouchableOpacity style={[styles.saveButton, isSavingMemo && { opacity: 0.7 }]} onPress={handleSaveMemo}
                  disabled={isSavingMemo}>
                  {isSavingMemo ? (
                    <ActivityIndicator color="#FFF" size="small" />
                  ) : (
                    <Text style={styles.saveButtonText}>保存する</Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          </View>
        )}
      </Modal>

      <ScrollView contentContainerStyle={{ paddingBottom: 140 }} showsVerticalScrollIndicator={false} bounces={false}
        onScroll={Animated.event([{ nativeEvent: { contentOffset: { y: scrollY } } }], { useNativeDriver: false })}
        scrollEventThrottle={16}>
        <View style={styles.imageSliderContainer}>
          <Image source={imageSource} style={styles.sliderImage} resizeMode="cover" />
          <LinearGradient colors={['transparent', 'transparent', 'rgba(15, 23, 42, 0.9)']} style={styles.imageOverlay} >
            <View style={styles.overlayContent}>
              <View style={styles.leftInfoContainer}>
                <View style={styles.nameRow}>
                  <Text style={styles.name}>{user.displayName || '未設定'}</Text>
                  <Text style={styles.age}>{calculateAge(user.birthDate)}歳</Text>
                  {user.isOnline && <View style={styles.onlineBadge} />}
                </View>
                <View style={styles.locationRow}>
                  <Ionicons name="location-outline" size={16} color="#E2E8F0" style={{ marginRight: 4 }} />
                  <Text style={styles.location}>{user.location}</Text>
                </View>
              </View>

              <View style={styles.matchBadgeContainer}>
                <View style={styles.matchBadgeGlass}>
                  <BlurView blurType="light" blurAmount={3} style={StyleSheet.absoluteFill} />
                  <View style={styles.matchContent}>
                    <MaterialCommunityIcons name="creation" size={20} color={THEME.accent} style={styles.icon} />
                    <Text style={styles.matchPercentage}>{user.matchRate || 0}%</Text>
                    <Text style={styles.matchLabel}>MATCH</Text>
                  </View>
                </View>
              </View>
            </View>
          </LinearGradient>
        </View>

        <View style={styles.contentContainer}>
          <View style={styles.contentHeaderLine} />

          {user.isVerified !== false && (
            <View style={styles.verifiedBadgeContainer}>
              <Ionicons name="shield-checkmark" size={16} color="#10B981" style={styles.verifiedIcon} />
              <Text style={styles.verifiedText}>本人確認済み</Text>
            </View>
          )}

          {user.interests && user.interests.length > 0 && (
            <View style={styles.tagsContainer}>
              {user.interests.map((tag, index) =>
                <TouchableOpacity key={index} onPress={() => navigation.navigate('SearchList', { initialKeyword: tag })}>
                  <Tag text={tag} />
                </TouchableOpacity>
              )}
            </View>
          )}

          <View style={styles.subPhotosSection}>
            <View style={styles.sectionHeaderRow}>
              <Text style={styles.bioTitle}>オフショット</Text>
              <View style={styles.titleUnderline} />
            </View>

            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.subPhotosContainer}>
              {isnotePage && (
                <TouchableOpacity activeOpacity={0.8} onPress={handleNotePress} style={styles.subPhotoThumbnailWrapper}>
                  <Image source={NOTE_IMAGE} style={styles.subPhotoThumbnail} resizeMode="cover" />
                  <View style={styles.noteOverlay}>
                    <LinearGradient colors={['transparent', 'rgba(0,0,0,0.8)']} style={StyleSheet.absoluteFill} />
                    <View style={styles.noteIconContainer}>
                      <Ionicons name="book" size={26} color="#FFFFFF" />
                      <Text style={styles.noteLabelText}>Note</Text>
                    </View>
                  </View>
                </TouchableOpacity>
              )}

              {subPhotos.map((photo, index) => (
                <TouchableOpacity key={index} activeOpacity={0.8} onPress={() => setSelectedPhotoIndex(index)}
                  style={styles.subPhotoThumbnailWrapper}>
                  <Image source={{ uri: photo.url }} style={styles.subPhotoThumbnail} resizeMode="cover" />

                  <View style={styles.subPhotoOverlayInfo}>
                    {photo.comment ? (
                      <View style={styles.subPhotoCommentBadge}>
                        <Ionicons name="chatbubble-ellipses" size={14} color="#FFF" />
                      </View>
                    ) : <View />}

                    {photo.tags && photo.tags.length > 0 && (
                      <LinearGradient colors={['transparent', 'rgba(0,0,0,0.8)']} style={styles.subPhotoTagsGradient}>
                        <View style={styles.subPhotoTagsRow}>
                          {photo.tags.slice(0, 2).map((tag, i) => (
                            <Text key={i} style={styles.subPhotoTagMiniText} numberOfLines={1}>#{tag}</Text>
                          ))}
                          {photo.tags.length > 2 && (
                            <Text style={styles.subPhotoTagMiniText}>...</Text>
                          )}
                        </View>
                      </LinearGradient>
                    )}
                  </View>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>

          <View style={styles.section}>
            <View style={styles.sectionHeaderRow}>
              <Text style={styles.bioTitle}>自己紹介</Text>
              <View style={styles.titleUnderline} />
            </View>
            <Text style={styles.bioText}>{user.bio || '自己紹介文はありません。'}</Text>
          </View>

          <InfoSection title="基本プロフィール" icon="person-outline">
            <InfoRow iconName="map-outline" iconLib="Ionicons" label="出身地" value={user.birthPlace} />
            <InfoRow iconName="resize" iconLib="Ionicons" label="身長" value={user.height} />
            <InfoRow iconName="body-outline" iconLib="Ionicons" label="体型" value={user.bodyType} />
            <InfoRow iconName="water-outline" iconLib="Ionicons" label="血液型" value={user.bloodType} />
            <InfoRow iconName="people-outline" iconLib="Ionicons" label="兄弟姉妹" value={user.sibling} />
            <InfoRow iconName="happy-outline" iconLib="Ionicons" label="性格"
              value={Array.isArray(user.personality) ? user.personality.join(' / ') : user.personality} />
          </InfoSection>

          <InfoSection title="仕事・学歴" icon="briefcase-outline">
            <InfoRow iconName="briefcase-outline" label="職業" value={user.occupation} />
            <InfoRow iconName="time-outline" iconLib="Ionicons" label="勤務時間" value={user.workTime} />
            <InfoRow iconName="cash-outline" label="年収" value={user.income} />
            <InfoRow iconName="school-outline" label="学歴" value={user.education} />
          </InfoSection>

          <InfoSection title="ライフスタイル" icon="home-outline">
            <InfoRow iconName="sunny-outline" iconLib="Ionicons" label="生活リズム" value={user.lifeStyle} />
            <InfoRow iconName="restaurant-outline" iconLib="Ionicons" label="料理の頻度" value={user.cookingFrequency} />
            <InfoRow iconName="calendar-outline" label="休日" value={user.holiday} />
            <InfoRow iconName="beer-outline" iconLib="Ionicons" label="お酒" value={user.alcohol} />
            <InfoRow iconName="cigar" iconLib="MaterialCommunityIcons" label="タバコ" value={user.tobacco} />
            <InfoRow iconName="home-outline" label="同居人" value={user.roommate} />
          </InfoSection>

          <InfoSection title="恋愛・結婚観" icon="heart-outline">
            <InfoRow iconName="chatbubble-ellipses-outline" iconLib="Ionicons" label="連絡頻度" value={user.contactFrequency} />
            <InfoRow iconName="ring" iconLib="MaterialCommunityIcons" label="婚姻歴" value={user.marital} />
            <InfoRow iconName="baby-carriage" iconLib="MaterialCommunityIcons" label="子供の有無" value={user.child} />
            <InfoRow iconName="heart-outline" label="結婚意思" value={user.marry} />
            <InfoRow iconName="wallet-outline" label="初回デート" value={user.date} />
            <InfoRow iconName="chatbubbles-outline" label="出会い希望" value={user.encounter} />
          </InfoSection>
        </View>
      </ScrollView >

      <View style={styles.headerButtons}>
        <TouchableOpacity style={styles.headerIconBtn} onPress={() => navigation.goBack()}>
          <BlurView blurType="dark" blurAmount={3} style={StyleSheet.absoluteFill} />
          <Ionicons name="chevron-back" size={24} color="#FFF" />
        </TouchableOpacity>

        <View style={styles.headerRightContainer}>
          <TouchableOpacity style={styles.headerIconBtn} onPress={handleFavoritePress} disabled={isFavoriteProcessing}>
            <BlurView blurType="dark" blurAmount={3} style={StyleSheet.absoluteFill} />
            {isFavoriteProcessing ? (
              <ActivityIndicator size="small" color="#F59E0B" />
            ) : (
              <Ionicons name={isFavorited ? "star" : "star-outline"} size={22} color={isFavorited ? "#F59E0B" : "#FFF"} />
            )}
          </TouchableOpacity>

          <TouchableOpacity style={styles.headerIconBtn} onPress={handleBlockAction}>
            <BlurView blurType="dark" blurAmount={3} style={StyleSheet.absoluteFill} />
            <Ionicons name="ellipsis-horizontal" size={24} color="#FFF" />
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.floatingButtonContainer}>
        {!isMatched && hasReceivedLike && !isLiked && (
          <Animated.View style={[styles.receivedLikePopup, { transform: [{ translateY: floatAnim }] }]}>
            <LinearGradient colors={['#F43F5E', '#E11D48']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
              style={styles.receivedLikeGradient}>
              <Ionicons name="heart" size={16} color="#FFF" style={{ marginRight: 6 }} />
              <Text style={styles.receivedLikeText}>"いいね"と"質問回答"が届いています！</Text>
            </LinearGradient>
            <View style={styles.receivedLikeTail} />
          </Animated.View>
        )}

        {isMatched ? (
          <Animated.View style={{ transform: [{ scale: scaleAnim }], flexDirection: 'row', alignItems: 'center' }} >
            <TouchableOpacity activeOpacity={0.9} onPress={handleMessagePress} style={styles.touchableButton} >
              <LinearGradient colors={[THEME.likeStart, THEME.likeEnd]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                style={styles.messageButton} >
                <Ionicons name="chatbubbles" size={24} color="#FFF" style={{ marginRight: 8 }} />
                <Text style={[styles.likeText, { marginTop: 0, fontSize: 16 }]}>メッセージへ</Text>
              </LinearGradient>
              <View style={styles.matchedBadgeAbsolute}>
                <Text style={styles.matchedBadgeTextAbsolute}>マッチング！</Text>
              </View>
            </TouchableOpacity>

            {partnerAnswer && partnerAnswer.trim() !== '' ? (
              <TouchableOpacity activeOpacity={0.9} onPress={() => setAnswerModalVisible(true)}
                style={[styles.touchableButton, styles.answerCircleMatchButton]}>
                <LinearGradient colors={['#FF8993', '#FF5C67']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                  style={[styles.answerCircleMatchGradient, { overflow: 'hidden' }]}>
                  <MaterialCommunityIcons name="comment-question-outline" size={24} color="#FFF" />
                  <Text style={styles.likeText}>回答</Text>
                </LinearGradient>
              </TouchableOpacity>
            ) : null}
          </Animated.View>
        ) : (
          <>
            <Animated.View
              style={[styles.popupContainer,
              {
                opacity: fadeAnim,
                transform: [
                  { translateY: translateYAnim },
                  { translateX: translateXAnim },
                  { scale: popupScaleAnim }
                ]
              }
              ]}
              pointerEvents="none"
            >
              <LinearGradient colors={[THEME.likeStart, THEME.likeEnd]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                style={styles.popupBubble}>
                <Ionicons name="heart" size={10} color="#FFF" style={{ marginRight: 4 }} />
                <Text style={styles.popupText}>いいねしました</Text>
              </LinearGradient>
              <View style={styles.popupTail} />
            </Animated.View>

            <Animated.View style={{ transform: [{ scale: scaleAnim }], flexDirection: 'row', alignItems: 'center' }}>
              <TouchableOpacity activeOpacity={0.9} onPress={handleLikePress} disabled={isLiked || isProcessing}
                style={styles.touchableButton}>
                {isLiked ? (
                  <View style={[styles.gradientButton, styles.disabledButton]}>
                    <Ionicons name="checkmark-circle" size={32} color="#94A3B8" />
                    <Text style={styles.likeTextSent}>送信済み</Text>
                  </View>
                ) : (
                  <LinearGradient colors={[THEME.likeStart, THEME.likeEnd]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                    style={styles.gradientButton}>
                    {isProcessing ? (
                      <ActivityIndicator color="#FFF" size="small" />
                    ) : (
                      <>
                        <Ionicons name="heart" size={32} color="#FFF" />
                        <Text style={styles.likeText}>いいね</Text>
                      </>
                    )}
                  </LinearGradient>
                )}
              </TouchableOpacity>

              {partnerAnswer && partnerAnswer.trim() !== '' ? (
                <TouchableOpacity activeOpacity={0.9} onPress={() => setAnswerModalVisible(true)}
                  style={[styles.touchableButton, styles.answerCircleButton]}>
                  <LinearGradient colors={['#FF8993', '#FF5C67']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                    style={[styles.answerCircleGradient, { overflow: 'hidden' }]}>
                    <MaterialCommunityIcons name="comment-question-outline" size={32} color="#FFF" />
                    <Text style={styles.likeText}>回答</Text>
                  </LinearGradient>
                </TouchableOpacity>
              ) : null}
            </Animated.View>
          </>
        )}
      </View>

      <Modal visible={questionModalVisible} transparent={true} animationType="fade"
        onRequestClose={() => setQuestionModalVisible(false)}>
        {Platform.OS === 'ios' ? (
          <KeyboardAvoidingView behavior={"padding"} style={styles.modalOverlay}>
            <TouchableWithoutFeedback onPress={() => setQuestionModalVisible(false)}>
              <View style={styles.modalBackdrop} />
            </TouchableWithoutFeedback>

            <View style={[styles.modalContent, { paddingBottom: Math.max(insets.bottom, 8) }]}>
              <View style={styles.modalHandle} />

              <Text style={styles.modalTitle}>Message & Like</Text>
              <Text style={styles.modalSubtitle}>質問に答えてアピールしましょう！</Text>

              <View style={styles.modalQuestionBox}>
                <Text style={styles.modalQuestionLabel}>QUESTION</Text>
                <Text style={styles.modalQuestionText}>{user.question}</Text>
              </View>

              <TextInput style={styles.answerInput} placeholder="回答を入力してください..." placeholderTextColor="#94A3B8"
                multiline value={answerText} onChangeText={setAnswerText} maxLength={200} />
              <Text style={styles.charCount}>{answerText.length}/200</Text>

              <View style={styles.modalButtonRow}>
                <TouchableOpacity style={styles.cancelButton} onPress={() => setQuestionModalVisible(false)}>
                  <Text style={styles.cancelButtonText}>キャンセル</Text>
                </TouchableOpacity>

                <TouchableOpacity style={[styles.submitButton, !answerText.trim() && styles.submitButtonDisabled]}
                  onPress={handleSubmitAnswer} disabled={!answerText.trim()}>
                  <LinearGradient colors={answerText.trim() ? [THEME.likeStart, THEME.likeEnd] : ['#E2E8F0', '#E2E8F0']}
                    start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.submitGradient}>
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

              <Text style={styles.modalTitle}>Message & Like</Text>
              <Text style={styles.modalSubtitle}>質問に答えてアピールしましょう！</Text>

              <View style={styles.modalQuestionBox}>
                <Text style={styles.modalQuestionLabel}>QUESTION</Text>
                <Text style={styles.modalQuestionText}>{user.question}</Text>
              </View>

              <TextInput style={styles.answerInput} placeholder="回答を入力してください..." placeholderTextColor="#94A3B8"
                multiline value={answerText} onChangeText={setAnswerText} maxLength={200} />
              <Text style={styles.charCount}>{answerText.length}/200</Text>

              <View style={styles.modalButtonRow}>
                <TouchableOpacity style={styles.cancelButton} onPress={() => setQuestionModalVisible(false)}>
                  <Text style={styles.cancelButtonText}>キャンセル</Text>
                </TouchableOpacity>

                <TouchableOpacity style={[styles.submitButton, !answerText.trim() && styles.submitButtonDisabled]}
                  onPress={handleSubmitAnswer} disabled={!answerText.trim()} >
                  <LinearGradient colors={answerText.trim() ? [THEME.likeStart, THEME.likeEnd] : ['#E2E8F0', '#E2E8F0']}
                    start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.submitGradient}>
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

      <Modal visible={answerModalVisible} transparent={true} animationType="slide" onRequestClose={() => setAnswerModalVisible(false)}>
        <View style={styles.answerModalOverlay}>
          <TouchableWithoutFeedback onPress={() => setAnswerModalVisible(false)}>
            <View style={styles.modalBackdrop} />
          </TouchableWithoutFeedback>

          <View style={[styles.answerModalContent, { paddingBottom: Math.max(insets.bottom, 8) }]}>
            <View style={styles.modalHandle} />

            <View style={styles.answerModalHeader}>
              <MaterialCommunityIcons name="comment-question-outline" size={28} color="#FF5C67" />
              <Text style={styles.answerModalTitle}>ANSWER</Text>
            </View>

            <ScrollView style={styles.answerModalScroll} showsVerticalScrollIndicator={false}>
              <View style={styles.answerModalQuestionContainer}>
                <Text style={styles.answerModalQuestionLabel}>あなたの質問</Text>
                <Text style={styles.answerModalQuestionText}>{myQuestion}</Text>
              </View>

              <View style={styles.previewCard}>
                <View style={styles.previewHeader}>
                  <View style={styles.previewBadge}>
                    <Text style={styles.previewBadgeText}>ANSWER</Text>
                  </View>
                </View>

                <Text style={styles.previewText}>{partnerAnswer}</Text>
              </View>
            </ScrollView>

            <View style={styles.answerModalFooter}>
              <TouchableOpacity style={styles.answerModalCloseButton} onPress={() => setAnswerModalVisible(false)}>
                <Text style={styles.answerModalCloseText}>閉じる</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={selectedPhotoIndex !== null} transparent={false} animationType="fade"
        onRequestClose={() => setSelectedPhotoIndex(null)}>
        <View style={styles.photoModalContainer}>
          <LinearGradient colors={['#F0F9FF', '#DBEAFE']} style={StyleSheet.absoluteFill} />

          <SafeAreaView style={styles.photoModalSafeArea}>
            <TouchableOpacity style={styles.closeImageButton} onPress={() => setSelectedPhotoIndex(null)}>
              <View style={styles.closeImageButtonSolid}>
                <Ionicons name="close" size={24} color="#1E293B" />
              </View>
            </TouchableOpacity>

            {selectedPhotoIndex !== null && (
              <View style={{ flex: 1 }}>
                <FlatList ref={flatListRef} data={subPhotos} keyExtractor={(_item, index) => index.toString()}
                  horizontal pagingEnabled showsHorizontalScrollIndicator={false} initialScrollIndex={selectedPhotoIndex}
                  getItemLayout={(_data, index) => ({ length: width, offset: width * index, index })}
                  onMomentumScrollEnd={(e) => {
                    const newIndex = Math.round(e.nativeEvent.contentOffset.x / width);
                    setSelectedPhotoIndex(newIndex);
                  }}
                  scrollEnabled={enableModalScroll}
                  renderItem={({ item: photo }) => (
                    <View style={[{ width: width }, styles.photoModalContentWrapper]}>
                      <View style={styles.photoModalImageContainer}>
                        <Image source={{ uri: photo.url }} style={styles.photoModalImage} resizeMode="contain" />

                        {photo.tags && photo.tags.length > 0 && (
                          <LinearGradient colors={['transparent', 'rgba(255, 255, 255, 0.9)']}
                            style={styles.photoModalTagsOverlay}>
                            <ScrollView horizontal showsHorizontalScrollIndicator={false}
                              contentContainerStyle={styles.photoModalTagsScroll}
                              nestedScrollEnabled={true}
                              onTouchStart={() => setEnableModalScroll(false)}
                              onTouchEnd={() => setEnableModalScroll(true)}
                              onTouchCancel={() => setEnableModalScroll(true)}
                            >
                              {photo.tags.map((tag: any, i: any) => (
                                <TouchableOpacity key={i} style={styles.photoModalTagBadge}
                                  onPress={() => navigation.navigate('SearchList', { initialKeyword: tag })}>
                                  <Text style={styles.photoModalTagText}>#{tag}</Text>
                                </TouchableOpacity>
                              ))}
                            </ScrollView>
                          </LinearGradient>
                        )}
                      </View>

                      {photo.comment && (
                        <View style={styles.photoModalCommentArea}>
                          <View style={styles.photoModalCommentSolid}>
                            <Text style={styles.photoModalCommentText}>{photo.comment}</Text>
                          </View>
                        </View>
                      )}
                    </View>
                  )}
                />

                {selectedPhotoIndex > 0 && (
                  <View style={styles.leftArrowContainer} pointerEvents="none">
                    <Ionicons name="chevron-back" size={48} color="rgba(255, 255, 255, 0.7)" style={styles.arrowShadow} />
                  </View>
                )}

                {selectedPhotoIndex < subPhotos.length - 1 && (
                  <View style={styles.rightArrowContainer} pointerEvents="none">
                    <Ionicons name="chevron-forward" size={48} color="rgba(255,255,255,0.7)" style={styles.arrowShadow} />
                  </View>
                )}
              </View>
            )}
          </SafeAreaView>
        </View>
      </Modal>

      <MatchingScreen visible={isMatchingModalVisible} partnerName={user.displayName} onClose={() => setIsMatchingModalVisible(false)}
        onGoToChat={() => {
          setIsMatchingModalVisible(false); navigation.navigate('Chat', {
            matchId: newMatchId, recipientId: user.id, recipientName: user.displayName,
            recipientImage: typeof user.photoURL === 'string' ? { uri: user.photoURL } : user.photoURL
          });
        }}
      />

    </View >
  );
}

interface InfoSectionProps { title: string; icon: any; children: React.ReactNode; }

const InfoSection: React.FC<InfoSectionProps> = ({ title, icon, children }) => (
  <View style={styles.infoSection}>
    <View style={styles.sectionTitleContainer}>
      <View style={styles.sectionIconBg}>
        <Ionicons name={icon} size={16} color={THEME.primary} />
      </View>
      <Text style={styles.sectionTitle}>{title}</Text>
    </View>
    <View style={styles.infoBox}>
      {children}
    </View>
  </View>
);

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: THEME.background },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  imageSliderContainer: { height: IMAGE_HEIGHT, position: 'relative', backgroundColor: '#1E293B' },
  sliderImage: { width: width, height: IMAGE_HEIGHT },
  imageOverlay: {
    position: 'absolute', bottom: 0, left: 0, right: 0, paddingTop: 120, paddingBottom: 40, justifyContent: 'flex-end',
    paddingHorizontal: 20
  },
  overlayContent: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', width: '100%' },
  leftInfoContainer: { flex: 1, paddingRight: 10 },
  nameRow: { flexDirection: 'row', alignItems: 'baseline', marginBottom: 6 },
  name: { fontSize: 34, fontWeight: '800', color: '#FFF', marginRight: 8, letterSpacing: 0.5 },
  age: { fontSize: 20, fontWeight: '300', color: '#E2E8F0' },
  onlineBadge: {
    backgroundColor: '#10B981', width: 10, height: 10, borderRadius: 5, marginLeft: 8, marginBottom: 8, borderWidth: 1.5,
    borderColor: '#FFF'
  },
  locationRow: { flexDirection: 'row', alignItems: 'center', opacity: 0.9 },
  location: { color: '#CBD5E1', fontSize: 14, fontWeight: '500' },
  matchBadgeContainer: { marginLeft: 10, marginBottom: 5 },
  matchBadgeGlass: {
    width: 70, height: 70, borderRadius: 18, overflow: 'hidden', justifyContent: 'center', alignItems: 'center',
    borderColor: 'rgba(255, 255, 255, 0.2)', borderWidth: 1, backgroundColor: 'rgba(255,255,255,0.1)'
  },
  matchContent: { alignItems: 'center', justifyContent: 'center', padding: 8 },
  icon: { marginBottom: 2 },
  matchPercentage: { fontSize: 18, fontWeight: '800', color: '#FFF' },
  matchLabel: { fontSize: 9, fontWeight: '600', color: '#E2E8F0', marginTop: 2, letterSpacing: 1 },
  contentContainer: {
    backgroundColor: THEME.background, borderTopLeftRadius: 32, borderTopRightRadius: 32, marginTop: -24, paddingTop: 12,
    paddingHorizontal: 20, minHeight: height * 0.5
  },
  contentHeaderLine: { width: 40, height: 4, alignSelf: 'center', marginBottom: 24, opacity: 0.5 },
  tagsContainer: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: 28 },
  tag: {
    backgroundColor: '#EFF6FF', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 100, marginRight: 8,
    marginBottom: 8, borderWidth: 1, borderColor: '#DBEAFE'
  },
  tagText: { color: THEME.primary, fontSize: 12, fontWeight: '700' },
  subPhotosSection: { marginBottom: 32 },
  subPhotosContainer: { paddingRight: 20, paddingTop: 4 },
  subPhotoThumbnailWrapper: {
    width: 110, height: 146, borderRadius: 16, marginRight: 12, overflow: 'hidden', backgroundColor: '#E2E8F0',
    borderWidth: 1, borderColor: '#F1F5F9',
  },
  subPhotoThumbnail: { width: '100%', height: '100%', },
  noteOverlay: { ...StyleSheet.absoluteFill, justifyContent: 'center', alignItems: 'center', },
  noteIconContainer: {
    alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255, 255, 255, 0.25)', paddingHorizontal: 16,
    paddingVertical: 12, borderRadius: 16, borderWidth: 1, borderColor: 'rgba(255,255,255,0.5)', shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 6, elevation: 5,
  },
  noteLabelText: { color: '#FFFFFF', fontSize: 14, fontWeight: '800', marginTop: 4, letterSpacing: 1.5, },
  subPhotoOverlayInfo: { ...StyleSheet.absoluteFill, justifyContent: 'space-between', },
  subPhotoCommentBadge: {
    alignSelf: 'flex-end', backgroundColor: 'rgba(37, 99, 235, 0.9)', paddingHorizontal: 8, paddingVertical: 6,
    borderBottomLeftRadius: 12,
  },
  subPhotoTagsGradient: { paddingTop: 24, paddingBottom: 6, paddingHorizontal: 6, },
  subPhotoTagsRow: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'flex-start', gap: 3, },
  subPhotoTagMiniText: {
    color: '#E0F2FE', fontSize: 9, fontWeight: '800', backgroundColor: 'rgba(0,0,0,0.5)',
    paddingHorizontal: 5, paddingVertical: 2, borderRadius: 6, overflow: 'hidden',
  },
  photoModalContainer: { flex: 1, },
  photoModalSafeArea: { flex: 1, },
  closeImageButton: { position: 'absolute', top: Platform.OS === 'ios' ? 50 : 20, right: 20, zIndex: 10, },
  closeImageButtonSolid: {
    width: 44, height: 44, borderRadius: 22, justifyContent: 'center', alignItems: 'center',
    backgroundColor: '#FFFFFF', shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1,
    shadowRadius: 4, elevation: 3,
  },
  photoModalContentWrapper: { flex: 1, paddingTop: 80, paddingBottom: 40, },
  photoModalImageContainer: { width: width, height: height * 0.55, position: 'relative', marginTop: 40, },
  photoModalImage: { width: '100%', height: '100%' },
  photoModalTagsOverlay: { position: 'absolute', bottom: 17, left: 0, right: 0, paddingTop: 60, paddingBottom: 8, },
  photoModalTagsScroll: { paddingHorizontal: 20, gap: 8, alignItems: 'center', },
  photoModalTagBadge: {
    backgroundColor: 'rgba(255,255,255,0.6)', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.8)',
  },
  photoModalTagText: { color: '#334155', fontSize: 14, fontWeight: '700', },
  photoModalCommentArea: { position: 'absolute', bottom: 40, left: 0, right: 0, paddingHorizontal: 20 },
  photoModalCommentSolid: {
    borderRadius: 24, padding: 20, overflow: 'hidden', backgroundColor: '#FFFFFF', borderWidth: 1,
    borderColor: '#EFF6FF', shadowColor: "#2563EB", shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.08,
    shadowRadius: 12, elevation: 4,
  },
  photoModalCommentHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 12, },
  photoModalCommentIconBg: { backgroundColor: '#EFF6FF', padding: 8, borderRadius: 12, marginRight: 10, },
  photoModalCommentTitle: { color: '#2563EB', fontSize: 14, fontWeight: '800', letterSpacing: 1, },
  photoModalCommentText: { color: '#1E293B', fontSize: 15, lineHeight: 26, fontWeight: '600', },
  section: { marginBottom: 32 },
  sectionHeaderRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  bioTitle: { fontSize: 18, fontWeight: '800', color: THEME.textMain },
  titleUnderline: { width: 30, height: 4, backgroundColor: THEME.primary, borderRadius: 2, marginLeft: 12, opacity: 0.3 },
  bioText: { fontSize: 15, color: THEME.textMain, lineHeight: 26, letterSpacing: 0.2 },
  questionSection: {
    marginBottom: 32, backgroundColor: '#EFF6FF', padding: 20, borderRadius: 20, borderWidth: 1,
    borderColor: '#DBEAFE'
  },
  questionBadge: {
    backgroundColor: THEME.primary, alignSelf: 'flex-start', paddingHorizontal: 8, paddingVertical: 4,
    borderRadius: 6, marginBottom: 10
  },
  questionBadgeText: { color: '#FFF', fontSize: 10, fontWeight: '800', letterSpacing: 1 },
  questionText: { fontSize: 16, fontWeight: '700', color: THEME.textMain, lineHeight: 24, marginBottom: 8 },
  questionNoteContainer: { flexDirection: 'row', alignItems: 'center', marginTop: 4 },
  questionNote: { fontSize: 12, color: THEME.primary, fontWeight: '600' },
  infoSection: { marginBottom: 28 },
  sectionTitleContainer: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  sectionIconBg: {
    width: 28, height: 28, borderRadius: 8, backgroundColor: '#EFF6FF', justifyContent: 'center',
    alignItems: 'center', marginRight: 10
  },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: THEME.textMain },
  infoBox: {
    backgroundColor: THEME.cardBg, borderRadius: 20, paddingVertical: 8, paddingHorizontal: 20, shadowColor: "#64748B",
    shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.05, shadowRadius: 10, elevation: 2
  },
  infoRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#F1F5F9' },
  infoLabelContainer: { flexDirection: 'row', alignItems: 'center', width: '35%' },
  infoLabel: { fontSize: 13, color: THEME.textSub, fontWeight: '600' },
  infoValue: { fontSize: 15, color: THEME.textMain, fontWeight: '600', flex: 1, textAlign: 'right' },
  headerButtons: {
    position: 'absolute', top: 50, left: 20, right: 20, zIndex: 10, flexDirection: 'row',
    justifyContent: 'space-between'
  },
  headerIconBtn: {
    width: 44, height: 44, borderRadius: 22, overflow: 'hidden', justifyContent: 'center', alignItems: 'center',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)'
  },
  headerRightContainer: { flexDirection: 'row', gap: 12, },
  floatingButtonContainer: { position: 'absolute', bottom: 50, alignSelf: 'center', zIndex: 100, alignItems: 'center' },
  receivedLikePopup: { alignItems: 'center', marginBottom: 16, },
  receivedLikeGradient: {
    flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 10,
    borderRadius: 20, shadowColor: '#F43F5E', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3,
    shadowRadius: 8, elevation: 5,
  },
  receivedLikeText: { color: '#FFF', fontSize: 12, fontWeight: '800', letterSpacing: 0.5, },
  receivedLikeTail: {
    width: 0, height: 0, backgroundColor: 'transparent', borderStyle: 'solid', borderLeftWidth: 8, borderRightWidth: 8,
    borderTopWidth: 10, borderLeftColor: 'transparent', borderRightColor: 'transparent', borderTopColor: '#E11D48',
    marginTop: -1,
  },
  touchableButton: {
    borderRadius: 40, shadowColor: THEME.primary, shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3, shadowRadius: 12, elevation: 8
  },
  gradientButton: {
    width: 80, height: 80, flexDirection: 'column', justifyContent: 'center', alignItems: 'center',
    paddingHorizontal: 10, borderRadius: 40
  },
  messageButton: {
    width: 180, height: 60, flexDirection: 'row', justifyContent: 'center', alignItems: 'center',
    paddingHorizontal: 20, borderRadius: 30
  },
  matchedBadgeAbsolute: {
    position: 'absolute', top: -10, right: -10, backgroundColor: '#EF4444', paddingHorizontal: 8,
    paddingVertical: 4, borderRadius: 12, borderWidth: 2, borderColor: '#FFF', transform: [{ rotate: '10deg' }]
  },
  matchedBadgeTextAbsolute: { color: '#FFF', fontSize: 10, fontWeight: '900', letterSpacing: 1 },
  disabledButton: { backgroundColor: '#E2E8F0' },
  likeText: { color: '#FFF', fontSize: 12, fontWeight: '800', marginTop: 2, letterSpacing: 1 },
  likeTextSent: { color: '#94A3B8', fontSize: 12, fontWeight: '800', marginTop: 2 },
  popupContainer: { position: 'absolute', bottom: 90, alignItems: 'center', zIndex: 20, },
  popupBubble: {
    backgroundColor: THEME.primary, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16,
    flexDirection: 'row', alignItems: 'center', shadowColor: "#000", shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2, shadowRadius: 6, elevation: 0,
  },
  popupText: { color: '#FFF', fontSize: 11, fontWeight: 'bold', },
  popupTail: {
    width: 0, height: 0, backgroundColor: 'transparent', borderStyle: 'solid', borderLeftWidth: 5,
    borderRightWidth: 5, borderTopWidth: 8, borderLeftColor: 'transparent', borderRightColor: 'transparent',
    borderTopColor: THEME.primary, marginTop: -1,
  },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(15, 23, 42, 0.6)', justifyContent: 'flex-end' },
  modalBackdrop: { ...StyleSheet.absoluteFill },
  modalContent: {
    backgroundColor: '#FFF', borderTopLeftRadius: 32, borderTopRightRadius: 32, padding: 24,
    paddingBottom: 40, minHeight: 480
  },
  modalHandle: { width: 40, height: 4, backgroundColor: '#E2E8F0', borderRadius: 2, alignSelf: 'center', marginBottom: 24 },
  modalTitle: { fontSize: 22, fontWeight: '800', color: THEME.textMain, textAlign: 'center', marginBottom: 8 },
  modalSubtitle: { fontSize: 14, color: THEME.textSub, textAlign: 'center', marginBottom: 24 },
  modalQuestionBox: {
    backgroundColor: '#EFF6FF', padding: 16, borderRadius: 16, marginBottom: 24,
    borderLeftWidth: 4, borderLeftColor: THEME.primary
  },
  modalQuestionLabel: { fontSize: 11, fontWeight: '800', color: THEME.primary, marginBottom: 6, letterSpacing: 1 },
  modalQuestionText: { fontSize: 16, fontWeight: '700', color: THEME.textMain, lineHeight: 24 },
  answerInput: {
    backgroundColor: '#F8FAFC', borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 16,
    padding: 16, height: 120, fontSize: 16, color: THEME.textMain, textAlignVertical: 'top', marginBottom: 8
  },
  charCount: { textAlign: 'right', fontSize: 12, color: '#94A3B8', marginBottom: 24 },
  modalButtonRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 12 },
  cancelButton: { flex: 1, paddingVertical: 16, borderRadius: 30, backgroundColor: '#F1F5F9', alignItems: 'center' },
  cancelButtonText: { fontSize: 15, fontWeight: '700', color: '#64748B' },
  submitButton: { flex: 2, borderRadius: 30, overflow: 'hidden', elevation: 2 },
  submitButtonDisabled: { elevation: 0 },
  submitGradient: { paddingVertical: 16, alignItems: 'center', justifyContent: 'center' },
  submitButtonText: { fontSize: 16, fontWeight: '700', color: '#FFF' },
  menuModalOverlay: { flex: 1 },
  menuContainer: {
    position: 'absolute', top: 100, right: 10, backgroundColor: '#FFFFFF', borderRadius: 16, width: 180, shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.15, shadowRadius: 12, elevation: 8, overflow: 'hidden',
  },
  menuItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 14, paddingHorizontal: 16, },
  menuItemText: { fontSize: 15, fontWeight: '600', color: THEME.textMain, marginLeft: 12, },
  menuDivider: { height: 1, backgroundColor: '#F1F5F9' },
  memoModalContent: {
    backgroundColor: '#FFF', borderTopLeftRadius: 32, borderTopRightRadius: 32, padding: 24,
    paddingBottom: Platform.OS === 'ios' ? 40 : 24,
  },
  memoModalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginBottom: 8, },
  memoModalTitle: { fontSize: 20, fontWeight: '800', color: THEME.textMain, },
  memoModalSubtitle: { fontSize: 13, color: THEME.textSub, textAlign: 'center', marginBottom: 20, lineHeight: 20, },
  memoInput: {
    backgroundColor: '#F8FAFC', borderWidth: 1, borderColor: '#E2D8F0', borderRadius: 16, padding: 16, height: 160, fontSize: 16,
    color: THEME.textMain, textAlignVertical: 'top', marginBottom: 8,
  },
  saveButton: {
    flex: 2, borderRadius: 30, backgroundColor: THEME.primary, alignItems: 'center', justifyContent: 'center', paddingVertical: 16,
    shadowColor: THEME.primary, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 4,
  },
  saveButtonText: { fontSize: 16, fontWeight: '700', color: '#FFF', },
  answerCircleMatchButton: { borderRadius: 30, width: 60, height: 60, marginLeft: 16, },
  answerCircleButton: { borderRadius: 40, width: 80, height: 80, marginLeft: 16, },
  answerCircleMatchGradient: {
    width: '100%', height: '100%', flexDirection: 'column', borderRadius: 30,
    justifyContent: 'center', alignItems: 'center',
  },
  answerCircleGradient: {
    width: '100%', height: '100%', flexDirection: 'column', borderRadius: 40,
    justifyContent: 'center', alignItems: 'center',
  },
  answerModalOverlay: { flex: 1, backgroundColor: 'rgba(15, 23, 42, 0.6)', justifyContent: 'flex-end', },
  answerModalContent: {
    backgroundColor: '#FFF', borderTopLeftRadius: 32, borderTopRightRadius: 32, paddingTop: 16,
    paddingHorizontal: 24, maxHeight: '85%'
  },
  answerModalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginBottom: 24, },
  answerModalTitle: { fontSize: 20, fontWeight: '800', color: '#333', marginLeft: 8, },
  answerModalScroll: { marginBottom: 24, },
  answerModalQuestionContainer: {
    backgroundColor: '#F8FAFC', padding: 16, borderRadius: 16, marginBottom: 20, borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  answerModalQuestionLabel: { fontSize: 12, fontWeight: '700', color: '#64748B', marginBottom: 8, },
  answerModalQuestionText: { fontSize: 15, fontWeight: '600', color: '#333', lineHeight: 22, },
  previewCard: {
    backgroundColor: '#EFF6FF', borderRadius: 20, padding: 20, borderWidth: 1, borderColor: '#DBEAFE', borderLeftWidth: 4,
    borderLeftColor: '#2563EB', shadowColor: "#2563EB", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.05,
    shadowRadius: 12, elevation: 2,
  },
  previewHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, },
  previewBadge: { backgroundColor: '#2563EB', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, },
  previewBadgeText: { color: '#FFF', fontSize: 9, fontWeight: '800', letterSpacing: 1, },
  previewText: { fontSize: 16, fontWeight: '700', color: '#1E293B', lineHeight: 24, marginBottom: 12, },
  answerModalFooter: { alignItems: 'center', },
  answerModalCloseButton: { paddingVertical: 14, width: '100%', alignItems: 'center' },
  answerModalCloseText: { fontSize: 15, fontWeight: '700', color: '#64748B', },
  verifiedBadgeContainer: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: '#D1FAE5', paddingHorizontal: 12,
    paddingVertical: 6, borderRadius: 100, alignSelf: 'flex-start', marginBottom: 16, borderWidth: 1, borderColor: '#6EE7B7',
  },
  verifiedIcon: { marginRight: 4, },
  verifiedText: { color: "#047857", fontSize: 12, fontWeight: '800', letterSpacing: 0.5, },
  leftArrowContainer: { position: 'absolute', left: 8, top: height * 0.35, justifyContent: 'center', alignItems: 'center', padding: 10, },
  rightArrowContainer: { position: 'absolute', right: 8, top: height * 0.35, justifyContent: 'center', alignItems: 'center', padding: 10, },
  arrowShadow: { textShadowColor: 'rgba(0, 0, 0, 0.3)', textShadowOffset: { width: 0, height: 2 }, textShadowRadius: 6, },
});