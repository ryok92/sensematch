import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Image, TouchableOpacity, Dimensions, Alert, ActivityIndicator, Platform,
  PanResponder, Animated, LayoutAnimation, UIManager, Modal, TextInput, KeyboardAvoidingView,
  TouchableWithoutFeedback, Keyboard, GestureResponderEvent, PanResponderGestureState
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from 'react-native-vector-icons/Ionicons';
import * as ImagePicker from 'react-native-image-crop-picker';
import auth from '@react-native-firebase/auth';
import firestore from '@react-native-firebase/firestore';
import storage from '@react-native-firebase/storage';

if (Platform.OS === 'android') {
  if (UIManager.setLayoutAnimationEnabledExperimental) {
    UIManager.setLayoutAnimationEnabledExperimental(true);
  }
}

const { width, height } = Dimensions.get('window');
const COLUMN_COUNT = 3;
const SPACING = 12;
const SIDE_PADDING = 24;
const ITEM_SIZE = (width - (SIDE_PADDING * 2) - (SPACING * (COLUMN_COUNT - 1))) / COLUMN_COUNT;

const DEFAULT_MALE_IMAGE = require('../assets/man.png');
const DEFAULT_FEMALE_IMAGE = require('../assets/woman.png');

interface PhotoData {
  id?: string;
  url: string;
  status: 'approved' | 'reviewing' | 'rejected';
  priority?: number;
  comment?: string;
  tags?: string[];
  storagePath: string;
}

export default function PhotoManagerScreen({ navigation }: any) {
  const insets = useSafeAreaInsets();
  const [loading, setLoading] = useState<boolean>(true);
  const [uploading, setUploading] = useState<boolean>(false);
  const [mainPhoto, setMainPhoto] = useState<PhotoData | null>(null);
  const [subPhotos, setSubPhotos] = useState<(PhotoData | null)[]>(Array(5).fill(null));
  const [userGender, setUserGender] = useState<string>('male');
  const [draggingIndex, setDraggingIndex] = useState<number>(-1);
  const [scrollEnabled, setScrollEnabled] = useState<boolean>(true);
  const pan = useRef(new Animated.ValueXY()).current;
  const scale = useRef(new Animated.Value(1)).current;
  const gridContainerRef = useRef<View>(null);
  const gridLayout = useRef({ pageX: 0, pageY: 0, width: 0, height: 0 }).current;
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [detailModalVisible, setDetailModalVisible] = useState<boolean>(false);
  const [detailTargetIndex, setDetailTargetIndex] = useState<number | null>(null);
  const [draftComment, setDraftComment] = useState<string>('');
  const [draftTags, setDraftTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState<string>('');
  const [draftPhotoUri, setDraftPhotoUri] = useState<string | null>(null);
  const [keyboardOffset, setKeyboardOffset] = useState<number>(0);
  const [mainPhotoUploadHistory, setMainPhotoUploadHistory] = useState<number[]>([]);
  const [subPhotoUploadHistory, setSubPhotoUploadHistory] = useState<number[]>([]);

  const ONE_DAY = 24 * 60 * 60 * 1000;

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
    const user = auth().currentUser;
    if (!user) {
      setLoading(false);
      return;
    }

    const userDocRef = firestore().collection('users').doc(user.uid);
    const unsubscribeUser = userDocRef.onSnapshot((docSnap) => {
      if (docSnap.exists) {
        const data = docSnap.data();
        setUserGender(data?.gender || 'male');

        const now = Date.now();
        setMainPhotoUploadHistory(data?.mainPhotoUploadHistory?.filter((time:number) => now - time < ONE_DAY) || []);
        setSubPhotoUploadHistory(data?.subPhotoUploadHistory?.filter((time:number) => now - time < ONE_DAY) || []);

        if (data?.photoURL && data.photoURL !== '') {
          setMainPhoto({
            url: data.photoURL,
            status: data.mainPhotoStatus || 'approved',
            storagePath: data.photoStoragePath
          });
        } else {
          setMainPhoto(null);
        }
      }
      setLoading(false);
    }, (error) => {
      console.error("ユーザー情報の監視エラー:", error);
      setLoading(false);
    });

    const q = firestore().collection('users').doc(user.uid).collection('subPhotos').orderBy('priority', 'asc');
    const unsubscribeSubPhotos = q.onSnapshot((snapshot) => {
      const newSlots: (PhotoData | null)[] = Array(5).fill(null);
      snapshot.docs.forEach((docSnap: any) => {
        const p = docSnap.data() as PhotoData;
        if (p.priority && p.priority >= 1 && p.priority <= 5) {
          newSlots[p.priority - 1] = { ...p, id: docSnap.id };
        }
      });
      setSubPhotos(newSlots);
    }, (error) => {
      console.error("サブ写真の監視エラー:", error);
    });

    return () => {
      unsubscribeUser();
      unsubscribeSubPhotos();
    };
  }, []);

  const checkUploadLimit = (type: 'main' | 'sub') => {
    const now = Date.now();
    if (type === 'main') {
      const recentUploads = mainPhotoUploadHistory.filter(time => now - time < ONE_DAY);
      if (recentUploads.length >= 3) {
        Alert.alert('制限に達しました', 'メイン写真の変更は24時間以内に3回までです。\n時間を置いて再度お試し下さい。');
        return false;
      }
    } else {
      const recentUploads = subPhotoUploadHistory.filter(time => now - time < ONE_DAY);
      if (recentUploads.length >= 5) {
        Alert.alert('制限に達しました', 'オフショットの追加・変更は24時間以内に全体で5回までです。\n時間を置いて再度お試し下さい。');
        return false;
      }
    }
    return true;
  };

  const closeDetailModal = () => {
    setDetailModalVisible(false);
    setDraftPhotoUri(null);
    setTagInput('');
  };

  const pickAndUploadImage = async (targetType: 'main' | 'sub', targetIndex: number | null = null) => {
    if (!checkUploadLimit(targetType)) {
      return;
    }
    try {
      try {
        await ImagePicker.clean();
      } catch (cleanError) {
        console.log("Cache clean error (無視してOKです):", cleanError);
      }
      const cropWidth = targetType === 'main' ? 600 : 800;
      const cropHeight = targetType === 'main' ? 800 : 800;

      const image = await ImagePicker.openPicker({
        mediaType: 'photo', cropping: true, width: cropWidth, height: cropHeight, freeStyleCropEnabled: true,
        compressImageQuality: 0.8, cropperToolbarTitle: '写真を編集', cropperToolbarColor: '#FFFFFF',
        cropperToolbarWidgetColor: '#333333', cropperActiveWidgetColor: '#E83E8C', cropperStatusBarColor: '#FFFFFF',
      });

      if (image && image.path) {
        if (targetType === 'main') {
          handleUploadProcess(image.path);
        } else {
          setDraftPhotoUri(image.path);
          if (targetIndex !== null && !detailModalVisible) {
            setDetailTargetIndex(targetIndex);
            setDraftComment('');
            setDraftTags([]);
            setDetailModalVisible(true);
          }
        }
      }
    } catch (error: any) {
      if (error.message !== 'User cancelled image selection') {
        Alert.alert("エラー", "画像の選択に失敗しました。");
        console.error("Image Crop Picker Error:", error);
      }
    }
  };

  const handleUploadProcess = async (uri: string) => {
    setUploading(true);
    const user = auth().currentUser;
    if (!user) return;

    try {
      const filename = uri.substring(uri.lastIndexOf('/') + 1);
      const timestamp = Date.now();
      const storagePath = `users/${user.uid}/photos/${timestamp}_${filename}`;
      const uploadUri = Platform.OS === 'ios' ? uri.replace('file://', '') : uri;

      /* ▼▼▼ 編集箇所: RNFB形式のStorageアップロード処理 ▼▼▼ */
      const reference = storage().ref(storagePath);
      await reference.putFile(uploadUri);
      const downloadURL = await reference.getDownloadURL();
      /* ▲▲▲ 編集箇所 ▲▲▲ */

      const now = Date.now();
      const recentUploads = mainPhotoUploadHistory.filter(time => now - time < ONE_DAY);
      const newHistory = [...recentUploads, now];

      /* ▼▼▼ 編集箇所: RNFB形式のFirestoreドキュメント更新・serverTimestamp ▼▼▼ */
      const userDocRef = firestore().collection('users').doc(user.uid);
      await userDocRef.update({
        photoURL: downloadURL,
        photoStoragePath: storagePath,
        mainPhotoStatus: 'reviewing',
        updatedAt: firestore.FieldValue.serverTimestamp(),
        mainPhotoUploadHistory: newHistory,
      });
      /* ▲▲▲ 編集箇所 ▲▲▲ */

      Alert.alert('アップロード完了', '審査完了までお待ちください');

    } catch (error) {
      console.error("Upload error:", error);
      Alert.alert('エラー', '画像のアップロードに失敗しました');
    } finally {
      setUploading(false);
    }
  };

  const handleMainPhotoPress = () => {
    pickAndUploadImage('main');
  };

  const handleDeleteMainPhoto = () => {
    if (!mainPhoto || !mainPhoto.url) return;

    Alert.alert(
      'メイン写真を削除',
      'メイン写真を削除しますか？\n検索画面に表示されなくなります。',
      [
        { text: 'キャンセル', style: 'cancel' },
        {
          text: '削除', style: 'destructive',
          onPress: async () => {
            setUploading(true);
            try {
              /* ▼▼▼ 編集箇所: RNFB形式のcurrentUser呼び出し ▼▼▼ */
              const user = auth().currentUser;
              if (!user) return;
              /* ▲▲▲ 編集箇所 ▲▲▲ */

              try {
                let pathToDelete = mainPhoto.storagePath;
                if (pathToDelete) {
                  /* ▼▼▼ 編集箇所: RNFB形式のStorageファイル削除 ▼▼▼ */
                  const photoRef = storage().ref(pathToDelete);
                  await photoRef.delete();
                  /* ▲▲▲ 編集箇所 ▲▲▲ */
                }
              } catch (storageError) {
                console.warn("Storage deletion error:", storageError);
              }

              /* ▼▼▼ 編集箇所: RNFB形式のFirestoreドキュメント更新・delete()・serverTimestamp ▼▼▼ */
              const userDocRef = firestore().collection('users').doc(user.uid);
              await userDocRef.update({
                photoURL: '', 
                mainPhotoStatus: '', 
                photoStoragePath: firestore.FieldValue.delete(), 
                updatedAt: firestore.FieldValue.serverTimestamp(),
              });
              /* ▲▲▲ 編集箇所 ▲▲▲ */

              setMainPhoto(null);
              Alert.alert('削除完了', 'メイン写真を削除しました。')
            } finally {
              setUploading(false);
            }
          }
        }
      ]
    );
  };

  const handleDeletePhoto = async (index: number) => {
    const photo = subPhotos[index];
    if (!photo || !photo.id) {
      closeDetailModal();
      return;
    }

    Alert.alert('写真を削除', 'この写真を削除しますか？', [
      { text: 'キャンセル', style: 'cancel' },
      {
        text: '削除',
        style: 'destructive',
        onPress: async () => {
          try {
            /* ▼▼▼ 編集箇所: RNFB形式のcurrentUser呼び出しとドキュメント削除 ▼▼▼ */
            const user = auth().currentUser;
            if (!user) return;

            const docRef = firestore().collection('users').doc(user.uid).collection('subPhotos').doc(photo.id!);
            await docRef.delete();
            /* ▲▲▲ 編集箇所 ▲▲▲ */

            const newPhotos = [...subPhotos];
            newPhotos[index] = null;
            setSubPhotos(newPhotos);
            closeDetailModal();
          } catch (e) {
            Alert.alert('エラー', '削除に失敗しました');
          }
        }
      }
    ]);
  };

  const handleSaveDetail = async () => {
    /* ▼▼▼ 編集箇所: RNFB形式のcurrentUser呼び出し ▼▼▼ */
    const user = auth().currentUser;
    /* ▲▲▲ 編集箇所 ▲▲▲ */
    
    if (detailTargetIndex === null || !user) return;

    const photo = subPhotos[detailTargetIndex];

    setUploading(true);
    try {
      const tagsArray = draftTags

      let finalPhotoUrl = photo ? photo.url : '';
      let newStatus = photo ? photo.status : 'reviewing';
      let newHistory = subPhotoUploadHistory;
      let isPhotoChanged = false;

      if (draftPhotoUri) {
        const filename = draftPhotoUri.substring(draftPhotoUri.lastIndexOf('/') + 1);
        const timestamp = Date.now();
        const storagePath = `users/${user.uid}/photos/${timestamp}_${filename}`;
        const uploadUri = Platform.OS === 'ios' ? draftPhotoUri.replace('file://', '') : draftPhotoUri;

        /* ▼▼▼ 編集箇所: RNFB形式のStorageアップロード処理 ▼▼▼ */
        const reference = storage().ref(storagePath);
        await reference.putFile(uploadUri);
        finalPhotoUrl = await reference.getDownloadURL();
        /* ▲▲▲ 編集箇所 ▲▲▲ */
        
        newStatus = 'reviewing';

        isPhotoChanged = true;
        const now = Date.now();
        const recentUploads = subPhotoUploadHistory.filter(time => now - time < ONE_DAY);
        newHistory = [...recentUploads, now];
      }

      if (!finalPhotoUrl) {
        Alert.alert('エラー', '画像が選択されていません');
        setUploading(false);
        return;
      }

      const priority = detailTargetIndex + 1;
      
      /* ▼▼▼ 編集箇所: RNFB形式のserverTimestamp ▼▼▼ */
      const subPhotoData = {
        url: finalPhotoUrl,
        priority: priority,
        status: newStatus,
        comment: draftComment.trim(),
        tags: tagsArray,
        updatedAt: firestore.FieldValue.serverTimestamp(),
      };
      /* ▲▲▲ 編集箇所 ▲▲▲ */

      /* ▼▼▼ 編集箇所: RNFB形式のFirestoreドキュメント追加・更新 ▼▼▼ */
      if (photo && photo.id) {
        const docRef = firestore().collection('users').doc(user.uid).collection('subPhotos').doc(photo.id);
        await docRef.update(subPhotoData);
      } else {
        const subCollRef = firestore().collection('users').doc(user.uid).collection('subPhotos');
        await subCollRef.add({ ...subPhotoData, createdAt: firestore.FieldValue.serverTimestamp() });
      }

      if (isPhotoChanged) {
        const userDocRef = firestore().collection('users').doc(user.uid);
        await userDocRef.update({
          subPhotoUploadHistory: newHistory
        });
      }
      /* ▲▲▲ 編集箇所 ▲▲▲ */

      closeDetailModal();
      if (draftPhotoUri) {
        Alert.alert('アップロード完了', '審査完了までお待ちください');
      }
    } catch (e) {
      console.error(e);
      Alert.alert('エラー', '保存に失敗しました');
    } finally {
      setUploading(false);
    }
  };

  const openDetailModal = (index: number) => {
    const photo = subPhotos[index];
    setDetailTargetIndex(index);
    setDraftPhotoUri(null);

    if (photo) {
      setDraftComment(photo.comment || '');
      setDraftTags(photo.tags || []);
      setDetailModalVisible(true);
    } else {
      pickAndUploadImage('sub', index);
    }
  };

  const handleAddTag = () => {
    const trimmed = tagInput.trim().replace(/^#/, '');
    if (!trimmed) return;

    if (draftTags.includes(trimmed)) {
      Alert.alert('重複', 'そのタグは既に追加されています。')
      setTagInput('');
      return;
    }

    if (draftTags.length >= 20) {
      Alert.alert('上限', 'タグ設定の上限数に達しました。');
    }

    setDraftTags(prev => [...prev, trimmed]);
    setTagInput('');
  };

  const handleRemoveTag = (tagToRemove: string) => {
    setDraftTags(prev => prev.filter(tag => tag !== tagToRemove));
  };

  const createPanResponder = (index: number) => {
    return PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,

      onPanResponderGrant: (evt: GestureResponderEvent, gestureState: PanResponderGestureState) => {
        const photo = subPhotos[index];
        if (!photo || photo.status !== 'approved') return;

        longPressTimer.current = setTimeout(() => {
          setDraggingIndex(index);
          setScrollEnabled(false);

          if (gridContainerRef.current) {
            gridContainerRef.current.measure((x, y, width, height, pageX, pageY) => {
              gridLayout.pageX = pageX;
              gridLayout.pageY = pageY;
              gridLayout.width = width;
              gridLayout.height = height;
            });
          }

          Animated.spring(scale, { toValue: 1.1, useNativeDriver: false }).start();
          pan.setOffset({ x: 0, y: 0 });
          pan.setValue({ x: 0, y: 0 });
        }, 300);
      },

      onPanResponderMove: (evt: GestureResponderEvent, gestureState: PanResponderGestureState) => {
        if (draggingIndex === index) {
          pan.setValue({ x: gestureState.dx, y: gestureState.dy });
        } else {
          if (Math.abs(gestureState.dx) > 5 || Math.abs(gestureState.dy) > 5) {
            if (longPressTimer.current) {
              clearTimeout(longPressTimer.current);
              longPressTimer.current = null;
            }
          }
        }
      },

      onPanResponderRelease: async (evt: GestureResponderEvent, gestureState: PanResponderGestureState) => {
        if (longPressTimer.current) {
          clearTimeout(longPressTimer.current);
          longPressTimer.current = null;
        }

        if (draggingIndex === index) {
          const dropX = gestureState.moveX;
          const dropY = gestureState.moveY;

          let targetIndex = -1;

          if (gridLayout.width > 0) {
            const colWidth = ITEM_SIZE + SPACING;
            const rowHeight = ITEM_SIZE + SPACING;

            const relX = dropX - gridLayout.pageX;
            const relY = dropY - gridLayout.pageY;

            const col = Math.floor(relX / colWidth);
            const row = Math.floor(relY / rowHeight);

            if (col >= 0 && col < COLUMN_COUNT && row >= 0) {
              const calculatedIndex = row * COLUMN_COUNT + col;
              if (calculatedIndex >= 0 && calculatedIndex < 5) {
                targetIndex = calculatedIndex;
              }
            }
          }

          if (targetIndex !== -1 && targetIndex !== index) {
            const targetPhoto = subPhotos[targetIndex];
            const isTargetValid = !targetPhoto || targetPhoto.status === 'approved';

            if (isTargetValid) {
              LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);

              const newPhotos = [...subPhotos];
              newPhotos[targetIndex] = subPhotos[index];
              newPhotos[index] = targetPhoto;

              setSubPhotos(newPhotos);
              updatePriorities(newPhotos);
            } else {
              Alert.alert('移動できません', '審査中またはNGの写真がある場所には移動できません。');
            }
          }

          Animated.spring(scale, { toValue: 1, useNativeDriver: false }).start();
          pan.setValue({ x: 0, y: 0 });
          setDraggingIndex(-1);
          setScrollEnabled(true);
        } else {
          if (Math.abs(gestureState.dx) < 5 && Math.abs(gestureState.dy) < 5) {
            openDetailModal(index);
          }
        }
      },

      onPanResponderTerminate: () => {
        if (longPressTimer.current) clearTimeout(longPressTimer.current);
        setDraggingIndex(-1);
        setScrollEnabled(true);
      }
    });
  };

  const updatePriorities = async (photos: (PhotoData | null)[]) => {
    /* ▼▼▼ 編集箇所: RNFB形式のcurrentUserとbatch処理 ▼▼▼ */
    const user = auth().currentUser;
    if (!user) return;
    try {
      const batch = firestore().batch();

      photos.forEach((photo, idx) => {
        if (photo && photo.id) {
          const docRef = firestore().collection('users').doc(user.uid).collection('subPhotos').doc(photo.id);
          batch.update(docRef, { priority: idx + 1 });
        }
      });
      await batch.commit();
    } catch (error) {
      console.error('Priority update error', error);
    }
    /* ▲▲▲ 編集箇所 ▲▲▲ */
  };

  const renderStatusBadge = (status: string) => {
    if (status === 'reviewing') {
      return (
        <View style={[styles.badge, styles.badgeReviewing]}>
          <Ionicons name="time-outline" size={10} color="#FFF" />
          <Text style={styles.badgeText}>審査中</Text>
        </View>
      );
    } else if (status === 'rejected') {
      return (
        <View style={[styles.badge, styles.badgeRejected]}>
          <Ionicons name="alert-circle-outline" size={10} color="#FFF" />
          <Text style={styles.badgeText}>NG</Text>
        </View>
      );
    }
    return null;
  };

  const getMainImageSource = () => {
    if (mainPhoto && mainPhoto.url) {
      return { uri: mainPhoto.url };
    }
    const isFemale = userGender === '女性' || userGender === 'female' || Number(userGender) === 2;
    return isFemale ? DEFAULT_FEMALE_IMAGE : DEFAULT_MALE_IMAGE;
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#4A90E2" />
      </View>
    );
  }

  const previewUri = draftPhotoUri || (detailTargetIndex !== null && subPhotos[detailTargetIndex] ? subPhotos[detailTargetIndex]!.url : null);

  const nowForDisplay = Date.now();
  const mainRemaining = 3 - mainPhotoUploadHistory.filter(t => nowForDisplay - t < ONE_DAY).length;
  const subRemaining = 5 - subPhotoUploadHistory.filter(t => nowForDisplay - t < ONE_DAY).length;

  return (
    <SafeAreaView style={styles.container}>
      {uploading && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color="#FFF" />
          <Text style={styles.loadingText}>処理中...</Text>
        </View>
      )}

      <View style={styles.header}>
        <TouchableOpacity
          style={styles.headerButton}
          onPress={() => navigation.goBack()}
        >
          <Ionicons name="chevron-back" size={28} color="#333" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>写真の管理</Text>
        <View style={styles.headerButton} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} scrollEnabled={scrollEnabled}>

        <View style={styles.tipsContainer}>
          <View style={styles.tipsIconBg}>
            <Ionicons name="information-circle" size={18} color="#4A90E2" />
          </View>
          <View style={styles.tipsTextContainer}>
            <Text style={styles.tipsTitle}>写真アップロードの上限について</Text>
            <Text style={styles.tipsBody}>
              品質維持の為、24時間以内の変更・追加回数に制限を設けています。
            </Text>
            <View style={styles.limitStatusRow}>
              <Text style={styles.limitStatusLabel}>メイン写真</Text>
              <Text style={styles.limitStatusValue}>
                残り<Text style={styles.limitStatusHighlight}>{mainRemaining}</Text>回 / 3回
              </Text>
            </View>

            <View style={styles.limitStatusRow}>
              <Text style={styles.limitStatusLabel}>オフショット</Text>
              <Text style={styles.limitStatusValue}>
                残り<Text style={styles.limitStatusHighlight}>{subRemaining}</Text>回 / 5回
              </Text>
            </View>
          </View>
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>メイン写真</Text>
            <View style={styles.mainLabelTag}>
              <Text style={styles.mainLabelText}>検索画面で表示されます</Text>
            </View>
          </View>

          <View style={styles.mainPhotoContainer}>
            <Image
              source={getMainImageSource()}
              style={[
                styles.mainImage,
                mainPhoto?.status === 'rejected' && styles.rejectedImage
              ]}
            />

            {mainPhoto && (
              <TouchableOpacity style={styles.deleteMainPhotoButton} onPress={handleDeleteMainPhoto} activeOpacity={0.8}
                disabled={mainPhoto?.status === 'reviewing'}>
                <View style={styles.deleteIconBg}>
                  <Ionicons name="close" size={20} color="#FFF" />
                </View>
              </TouchableOpacity>
            )}

            {mainPhoto && renderStatusBadge(mainPhoto.status)}

            {mainPhoto?.status === 'rejected' && (
              <View style={styles.rejectedOverlay}>
                <Text style={styles.rejectedText}>掲載不可</Text>
              </View>
            )}

            <TouchableOpacity
              style={styles.changeMainButton}
              activeOpacity={0.8}
              onPress={handleMainPhotoPress}
              disabled={mainPhoto?.status === 'reviewing'}
            >
              <Ionicons name="camera" size={16} color="#333" style={{ marginRight: 6 }} />
              <Text style={styles.changeMainText}>写真を変更</Text>
            </TouchableOpacity>
          </View>
          <Text style={styles.mainPhotoCautionText}>※審査中は、写真の変更/削除ができません。</Text>
        </View>

        <View style={[styles.section, styles.subSection]}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>オフショット</Text>
            <Text style={styles.subNote}>タップで詳細編集・長押しで移動</Text>
          </View>

          <View style={styles.newFeatureBanner}>
            <View style={styles.newFeatureIconBg}>
              <Ionicons name="sparkles" size={14} color="#3B82F6" />
            </View>
            <View style={styles.newFeatureTextContainer}>
              <Text style={styles.newFeatureTitle}>写真にコメントとタグを付けてみましょう！</Text>
              <Text style={styles.newFeatureDesc}>
                写真をタップして、エピソードや趣味のハッシュタグを設定してみましょう。あなたらしさがもっと伝わります🙌
              </Text>
            </View>
          </View>

          <View style={styles.gridContainer} ref={gridContainerRef}>
            {subPhotos.map((photo, index) => {
              const isDragging = draggingIndex === index;
              const panHandlers = createPanResponder(index).panHandlers;

              return (
                <View key={index} style={[styles.gridItemWrapper, { zIndex: isDragging ? 999 : 1 }]}>
                  {isDragging ? (
                    <Animated.View
                      style={[
                        styles.gridItem,
                        styles.draggingItem,
                        {
                          transform: [
                            { translateX: pan.x },
                            { translateY: pan.y },
                            { scale: scale }
                          ],
                          position: 'absolute',
                          top: 0, left: 0, width: '100%', height: '100%',
                        } as any
                      ]}
                    >
                      <Image source={{ uri: photo?.url }} style={styles.gridImage} />
                    </Animated.View>
                  ) : null}

                  <View
                    {...panHandlers}
                    style={[
                      styles.gridItem,
                      isDragging && { opacity: 0 }
                    ]}
                  >
                    {photo ? (
                      <>
                        <Image
                          source={{ uri: photo.url }}
                          style={[
                            styles.gridImage,
                            photo.status === 'rejected' && styles.rejectedImage
                          ]}
                        />

                        {renderStatusBadge(photo.status)}

                        {photo.status === 'rejected' && (
                          <View style={styles.rejectedOverlay}>
                            <Text style={styles.rejectedText}>掲載不可</Text>
                          </View>
                        )}

                        {(photo.comment || (photo.tags && photo.tags.length > 0)) && (
                          <View style={styles.previewOverlay}>
                            {photo.tags && photo.tags.length > 0 ? (
                              <Text style={styles.previewTagText} numberOfLines={1}>
                                {photo.tags.map(tag => `#${tag}`).join(' ')}
                              </Text>
                            ) : null}
                            {photo.comment ? (
                              <View style={styles.previewCommentRow}>
                                <Ionicons name="chatbubble" size={10} color="#FFF" />
                                <Text style={styles.previewCommentText} numberOfLines={1}>
                                  {photo.comment}
                                </Text>
                              </View>
                            ) : null}
                          </View>
                        )}

                      </>
                    ) : (
                      <View style={[styles.gridItemContent, styles.emptyItem]}>
                        <Ionicons name="add" size={32} color="#CCC" />
                        <Text style={styles.addText}>追加</Text>
                      </View>
                    )}
                  </View>
                </View>
              );
            })}
          </View>

          <Text style={styles.footerNote}>
            ※ 他人の画像やキャラクター・公序良俗に反する写真は掲載できません。{'\n'}
            審査完了まで1時間〜24時間程度かかる場合があります。
          </Text>
        </View>

      </ScrollView>

      <Modal
        visible={detailModalVisible}
        transparent={true}
        animationType="slide"
        onRequestClose={closeDetailModal}
      >
        {uploading && (
          <View style={styles.loadingOverlay}>
            <ActivityIndicator size="large" color="#FFF" />
            <Text style={styles.loadingText}>処理中...</Text>
          </View>
        )}
        {Platform.OS === 'ios' ? (
          <KeyboardAvoidingView
            style={styles.detailModalContainer}
            behavior='padding'
          >
            <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
              <View style={styles.detailModalBackground}>
                <TouchableWithoutFeedback onPress={closeDetailModal}>
                  <View style={styles.detailModalDismissArea} />
                </TouchableWithoutFeedback>

                <View style={[styles.detailModalContent, { paddingBottom: insets.bottom + 20 }]}>
                  <View style={styles.modalHandle} />

                  <View style={styles.detailModalTopRow}>
                    {previewUri && (
                      <View style={styles.detailImagePreviewContainer}>
                        <Image
                          source={{ uri: previewUri }}
                          style={styles.detailImagePreview}
                        />
                      </View>
                    )}

                    <View style={styles.detailActionButtons}>
                      <TouchableOpacity
                        style={styles.detailChangeBtn}
                        onPress={() => pickAndUploadImage('sub', detailTargetIndex)}
                      >
                        <Ionicons name="image" size={16} color="#333" />
                        <Text style={styles.detailChangeBtnText}>写真を変更する</Text>
                      </TouchableOpacity>

                      <TouchableOpacity
                        style={styles.detailDeleteBtn}
                        onPress={() => detailTargetIndex !== null && handleDeletePhoto(detailTargetIndex)}
                      >
                        <Ionicons name="trash" size={16} color="#EF4444" />
                        <Text style={styles.detailDeleteBtnText}>写真を削除する</Text>
                      </TouchableOpacity>
                    </View>
                  </View>

                  <View style={styles.detailFormArea}>
                    <View style={styles.inputGroup}>
                      <View style={styles.inputLabelRow}>
                        <Ionicons name="chatbubble-outline" size={14} color="#666" />
                        <Text style={styles.inputLabel}>コメント（エピソードなど）</Text>
                      </View>
                      <TextInput
                        style={[styles.textInput, styles.textArea]}
                        placeholder="例: 休日はよくカフェで読書をしています！"
                        placeholderTextColor="#999"
                        value={draftComment}
                        onChangeText={setDraftComment}
                        multiline
                        maxLength={100}
                      />
                    </View>

                    <View style={styles.inputGroup}>
                      <View style={styles.inputLabelRow}>
                        <Ionicons name="pricetag-outline" size={14} color="#666" />
                        <Text style={styles.inputLabel}>ハッシュタグ</Text>
                      </View>

                      {draftTags.length >= 1 && (
                        <View style={styles.selectedTagsContainer}>
                          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.selectedTagsScroll}>
                            {draftTags.map(tag => (
                              <TouchableOpacity
                                key={tag}
                                activeOpacity={0.8}
                                onPress={() => handleRemoveTag(tag)}
                                style={styles.tagChip}
                              >
                                <Text style={styles.tagChipText}>#{tag}</Text>
                                <Ionicons name="close-circle" size={16} color="rgba(255, 255, 255, 0.8)" style={{ marginLeft: 4 }} />
                              </TouchableOpacity>
                            ))}
                          </ScrollView>
                        </View>
                      )}

                      <View style={styles.tagInputRow}>
                        <TextInput
                          style={styles.tagInputField}
                          placeholder="#カフェ巡り #読書"
                          placeholderTextColor="#999"
                          value={tagInput}
                          onSubmitEditing={handleAddTag}
                          onChangeText={setTagInput}
                          returnKeyType="done"
                          maxLength={15}
                        />
                        <TouchableOpacity
                          style={[styles.tagAddButton, (!tagInput.trim() || draftTags.length >= 20) && styles.tagAddButtonDisabled]}
                          onPress={handleAddTag}
                          disabled={!tagInput.trim() || draftTags.length >= 20}
                        >
                          <Ionicons name="add" size={24} color="#FFF" />
                        </TouchableOpacity>
                      </View>
                    </View>
                  </View>

                  <TouchableOpacity style={styles.detailSaveBtn} onPress={handleSaveDetail}>
                    <Text style={styles.detailSaveBtnText}>保存して閉じる</Text>
                  </TouchableOpacity>

                </View>
              </View>
            </TouchableWithoutFeedback>
          </KeyboardAvoidingView>
        ) : (
          <View style={[styles.detailModalContainer, { paddingBottom: keyboardOffset }]} >
            <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
              <View style={styles.detailModalBackground}>
                <TouchableWithoutFeedback onPress={closeDetailModal}>
                  <View style={styles.detailModalDismissArea} />
                </TouchableWithoutFeedback>

                <View style={[styles.detailModalContent, { paddingBottom: insets.bottom + 20 }]}>
                  <View style={styles.modalHandle} />

                  <View style={styles.detailModalTopRow}>
                    {previewUri && (
                      <View style={styles.detailImagePreviewContainer}>
                        <Image
                          source={{ uri: previewUri }}
                          style={styles.detailImagePreview}
                        />
                      </View>
                    )}

                    <View style={styles.detailActionButtons}>
                      <TouchableOpacity
                        style={styles.detailChangeBtn}
                        onPress={() => pickAndUploadImage('sub', detailTargetIndex)}
                      >
                        <Ionicons name="image" size={16} color="#333" />
                        <Text style={styles.detailChangeBtnText}>写真を変更する</Text>
                      </TouchableOpacity>

                      <TouchableOpacity
                        style={styles.detailDeleteBtn}
                        onPress={() => detailTargetIndex !== null && handleDeletePhoto(detailTargetIndex)}
                      >
                        <Ionicons name="trash" size={16} color="#EF4444" />
                        <Text style={styles.detailDeleteBtnText}>写真を削除する</Text>
                      </TouchableOpacity>
                    </View>
                  </View>

                  <View style={styles.detailFormArea}>
                    <View style={styles.inputGroup}>
                      <View style={styles.inputLabelRow}>
                        <Ionicons name="chatbubble-outline" size={14} color="#666" />
                        <Text style={styles.inputLabel}>コメント（エピソードなど）</Text>
                      </View>
                      <TextInput
                        style={[styles.textInput, styles.textArea]}
                        placeholder="例: 休日はよくカフェで読書をしています！"
                        placeholderTextColor="#999"
                        value={draftComment}
                        onChangeText={setDraftComment}
                        multiline
                        maxLength={100}
                      />
                    </View>

                    <View style={styles.inputGroup}>
                      <View style={styles.inputLabelRow}>
                        <Ionicons name="pricetag-outline" size={14} color="#666" />
                        <Text style={styles.inputLabel}>ハッシュタグ</Text>
                      </View>

                      {draftTags.length >= 1 && (
                        <View style={styles.selectedTagsContainer}>
                          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.selectedTagsScroll}>
                            {draftTags.map(tag => (
                              <TouchableOpacity
                                key={tag}
                                activeOpacity={0.8}
                                onPress={() => handleRemoveTag(tag)}
                                style={styles.tagChip}
                              >
                                <Text style={styles.tagChipText}>#{tag}</Text>
                                <Ionicons name="close-circle" size={16} color="rgba(255, 255, 255, 0.8)" style={{ marginLeft: 4 }} />
                              </TouchableOpacity>
                            ))}
                          </ScrollView>
                        </View>
                      )}

                      <View style={styles.tagInputRow}>
                        <TextInput
                          style={styles.tagInputField}
                          placeholder="#カフェ巡り #読書"
                          placeholderTextColor="#999"
                          value={tagInput}
                          onSubmitEditing={handleAddTag}
                          onChangeText={setTagInput}
                          returnKeyType="done"
                          maxLength={15}
                        />

                        <TouchableOpacity
                          style={[styles.tagAddButton, (!tagInput.trim() || draftTags.length >= 20) && styles.tagAddButtonDisabled]}
                          onPress={handleAddTag}
                          disabled={!tagInput.trim() || draftTags.length >= 20}
                        >
                          <Ionicons name="add" size={24} color="#FFF" />
                        </TouchableOpacity>
                      </View>
                    </View>
                  </View>

                  <TouchableOpacity style={styles.detailSaveBtn} onPress={handleSaveDetail}>
                    <Text style={styles.detailSaveBtnText}>保存して閉じる</Text>
                  </TouchableOpacity>

                </View>
              </View>
            </TouchableWithoutFeedback>
          </View>
        )}
      </Modal>

    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingOverlay: {
    position: 'absolute',
    top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 999,
  },
  loadingText: {
    color: '#FFF',
    marginTop: 10,
    fontWeight: 'bold',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#333',
  },
  headerButton: {
    padding: 8,
    width: 44,
  },
  scrollContent: {
    paddingBottom: 20,
  },

  tipsContainer: {
    flexDirection: 'row', backgroundColor: '#F0F7FF', padding: 10, marginHorizontal: 24, marginTop: 10, marginBottom: 10,
    borderRadius: 12, borderWidth: 1, borderColor: '#D0E3F5',
  },
  tipsIconBg: {
    width: 32, height: 32, backgroundColor: '#E0EFFF', borderRadius: 16, justifyContent: 'center',
    alignItems: 'center', marginRight: 12,
  },
  tipsTextContainer: { flex: 1, },
  tipsTitle: { fontSize: 14, fontWeight: '700', color: '#2B6CB0', marginBottom: 6, },
  tipsBody: { fontSize: 11, color: '#4A5568', lineHeight: 16, marginBottom: 10, },
  limitStatusBox: {
    backgroundColor: '#FFFFFF', padding: 10, borderRadius: 'sapce-between', alignItems: 'center', paddingVertical: 4,
  },
  limitStatusRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 4, },
  limitStatusLabel: { fontSize: 12, color: '#4A5568', fontWeight: '600', },
  limitStatusValue: { fontSize: 12, color: '#718096' },
  limitStatusHighlight: { fontSize: 14, fontWeight: 'bold', color: '#E53E3E', },

  section: {
    paddingHorizontal: 24,
    paddingVertical: 16,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#333',
  },
  mainLabelTag: {
    backgroundColor: '#4A90E2',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  mainLabelText: {
    fontSize: 10,
    color: '#FFF',
    fontWeight: 'bold',
  },
  subNote: {
    fontSize: 11,
    color: '#999',
  },

  newFeatureBanner: {
    flexDirection: 'row',
    backgroundColor: '#EFF6FF',
    borderColor: '#DBEAFE',
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
    alignItems: 'flex-start',
  },
  newFeatureIconBg: {
    backgroundColor: 'rgba(59, 130, 246, 0.1)',
    padding: 6,
    borderRadius: 20,
    marginRight: 10,
    marginTop: 2,
  },
  newFeatureTextContainer: {
    flex: 1,
  },
  newFeatureTitle: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#1E3A8A',
    marginBottom: 4,
  },
  newFeatureDesc: {
    fontSize: 10,
    color: '#1D4ED8',
    lineHeight: 14,
  },

  mainPhotoContainer: {
    width: 200,
    height: 266,
    borderRadius: 16,
    alignSelf: 'center',
    backgroundColor: '#F5F5F5',
    position: 'relative',
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: '#4A90E2',
    shadowColor: "#4A90E2",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 10,
    elevation: 5,
  },
  mainImage: {
    width: '100%',
    height: '100%',
  },
  changeMainButton: {
    position: 'absolute',
    bottom: 15,
    alignSelf: 'center',
    backgroundColor: 'rgba(255,255,255,0.95)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  changeMainText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#333',
  },
  mainPhotoBadge: {
    position: 'absolute',
    bottom: 12,
    alignSelf: 'center',
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  mainPhotoBadgeText: {
    color: '#FFF',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.5,
  },

  subSection: {
    backgroundColor: '#F9FAFB',
    paddingTop: 24,
    paddingBottom: 30,
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    marginTop: 10,
  },
  gridContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginHorizontal: -SPACING / 2,
  },
  gridItemWrapper: {
    width: ITEM_SIZE,
    height: ITEM_SIZE,
    margin: SPACING / 2,
    position: 'relative',
  },
  gridItem: {
    flex: 1,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: '#FFF',
    position: 'relative',
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  draggingItem: {
    borderColor: '#4A90E2',
    borderWidth: 2,
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 10,
    zIndex: 999,
  },
  gridItemContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyItem: {
    borderWidth: 2,
    borderColor: '#E0E0E0',
    borderStyle: 'dashed',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FAFAFA',
    width: '100%',
    height: '100%',
  },
  gridImage: {
    width: '100%',
    height: '100%',
  },
  addText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#999',
    marginTop: 4,
  },
  rejectedImage: {
    opacity: 0.3,
  },

  badge: {
    position: 'absolute',
    top: 6,
    left: 6,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    zIndex: 10,
  },
  badgeReviewing: {
    backgroundColor: 'rgba(249, 115, 22, 0.9)',
  },
  badgeRejected: {
    backgroundColor: 'rgba(239, 68, 68, 0.9)',
  },
  badgeText: {
    color: '#FFF',
    fontSize: 9,
    fontWeight: 'bold',
    marginLeft: 2,
  },

  rejectedOverlay: {
    position: 'absolute',
    inset: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  rejectedText: {
    backgroundColor: 'rgba(239, 68, 68, 1)',
    color: '#FFF',
    fontSize: 10,
    fontWeight: 'bold',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },

  footerNote: {
    fontSize: 9.3,
    color: '#999',
    textAlign: 'center',
    marginTop: 24,
    lineHeight: 16,
  },

  previewOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingTop: 24,
    paddingBottom: 6,
    paddingHorizontal: 6,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  previewTagText: {
    color: '#93C5FD',
    fontSize: 9,
    fontWeight: 'bold',
    marginBottom: 2,
  },
  previewCommentRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  previewCommentText: {
    color: '#FFF',
    fontSize: 10,
    fontWeight: '600',
    marginLeft: 4,
    flex: 1,
  },

  detailModalContainer: {
    flex: 1,
  },
  detailModalBackground: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  detailModalDismissArea: {
    flex: 1,
  },
  detailModalContent: {
    backgroundColor: '#FFF',
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    paddingHorizontal: 24,
    paddingTop: 12,
  },
  modalHandle: {
    width: 48,
    height: 6,
    backgroundColor: '#E5E7EB',
    borderRadius: 3,
    alignSelf: 'center',
    marginBottom: 24,
  },
  detailModalTopRow: {
    flexDirection: 'row',
    marginBottom: 24,
  },
  detailImagePreviewContainer: {
    width: 100,
    height: 100,
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#F3F4F6',
  },
  detailImagePreview: {
    width: '100%',
    height: '100%',
  },
  detailActionButtons: {
    flex: 1,
    marginLeft: 16,
    justifyContent: 'center',
  },
  detailChangeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F3F4F6',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 12,
    marginBottom: 12,
  },
  detailChangeBtnText: {
    fontSize: 13,
    fontWeight: 'bold',
    color: '#374151',
    marginLeft: 8,
  },
  detailDeleteBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF2F2',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 12,
  },
  detailDeleteBtnText: {
    fontSize: 13,
    fontWeight: 'bold',
    color: '#EF4444',
    marginLeft: 8,
  },
  detailFormArea: {
    marginBottom: 24,
  },
  inputGroup: {
    marginBottom: 16,
  },
  inputLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    marginLeft: 4,
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#6B7280',
    marginLeft: 4,
  },
  textInput: {
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 14,
    color: '#1F2937',
  },
  textArea: {
    height: 80,
    textAlignVertical: 'top',
  },
  detailSaveBtn: {
    backgroundColor: '#3B82F6',
    paddingVertical: 16,
    borderRadius: 16,
    alignItems: 'center',
    shadowColor: '#3B82F6',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
    marginTop: 8,
  },
  detailSaveBtnText: {
    color: '#FFF',
    fontSize: 15,
    fontWeight: 'bold',
  },
  selectedTagsContainer: {
    marginBottom: 12,
    paddingVertical: 12,
  },
  selectedTagsScroll: {
    paddingHorizontal: 12,
    alignItems: 'center',
    minHeight: 32,
  },
  placeholderTagText: {
    fontSize: 12,
    color: '#94A3B8',
  },
  tagChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#2563EB',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 20,
    marginRight: 8,
  },
  tagChipText: {
    color: '#FFF',
    fontSize: 12,
    alignItems: 'center',
  },
  tagInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  tagInputField: {
    flex: 1,
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontSize: 14,
    color: '#1F2937',
    marginRight: 8,
  },
  tagAddButton: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: '#2563EB',
    justifyContent: 'center',
    alignItems: 'center',
  },
  tagAddButtonDisabled: {
    backgroundColor: '#E2E8F0',
  },
  deleteMainPhotoButton: { position: 'absolute', top: 12, right: 12, zIndex: 20 },
  deleteIconBg: {
    width: 28, height: 28, backgroundColor: 'rgba(239, 68, 68, 0.9)', borderRadius: 14,
    justifyContent: 'center', alignItems: 'center', borderWidth: 2, borderColor: '#FFF', shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.3, shadowRadius: 3, elevation: 4,
  },
  mainPhotoCautionText: { fontSize: 9.3, color: '#999', textAlign: 'center', marginTop: 7 },
});