import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, FlatList, Image, TouchableOpacity, ActivityIndicator, Modal, TextInput,
  KeyboardAvoidingView, Platform, TouchableWithoutFeedback, Keyboard, Alert
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { getAuth } from '@react-native-firebase/auth';
import {
  getFirestore, collection, getDocs, doc, getDoc, setDoc, serverTimestamp, query, orderBy
} from '@react-native-firebase/firestore';

const DEFAULT_MALE_IMAGE = require('../assets/man.png');
const DEFAULT_FEMALE_IMAGE = require('../assets/woman.png');
const THEME = {
  primary: '#2563EB',
  background: '#F8FAFC',
  textMain: '#1E293B',
  textSub: '#64748B',
};

interface MemoData {
  id: string; targetUserId: string; text: string; updatedAt: any;
  userProfile?: { displayName?: string; photoURL?: string; gender?: string | number; mainPhotoStatus?: string; }
};

export default function MyMemoSettingScreen({ navigation }: any) {
  const insets = useSafeAreaInsets();
  const [memos, setMemos] = useState<MemoData[]>([]);
  const [loading, setLoading] = useState(false);
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [selectedMemo, setSelectedMemo] = useState<MemoData | null>(null);
  const [memoText, setMemoText] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [keyboardOffset, setKeyboardOffset] = useState<number>(0);
  const auth = getAuth();
  const db = getFirestore();

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

  const fetchMemosAndProfiles = async () => {
    const currentUser = auth.currentUser;
    if (!currentUser) {
      setLoading(false);
      return;
    }

    try {
      const memosRef = collection(db, 'users', currentUser.uid, 'memos');
      const q = query(memosRef, orderBy('updatedAt', 'desc'));
      const memoSnap = await getDocs(q);

      const memosDataPromises = memoSnap.docs.map(async (document: any) => {
        const data = document.data();
        const targetId = data.targetUserId;

        let profileData = {};
        try {
          const userDoc = await getDoc(doc(db, 'users', targetId));
          if (userDoc.exists()) {
            const uData = userDoc.data();
            profileData = {
              displayName: uData?.displayName, photoURL: uData?.photoURL, gender: uData?.gender, mainPhotoStatus: uData?.mainPhotoStatus,
            };
          }
        } catch (e) {
          console.error("Profile fetch error for:", targetId, e);
        }

        if (data.text && data.text.trim() !== '') {
          return {
            id: document.id, targetUserId: targetId, text: data.text, updatedAt: data.updatedAt, userProfile: profileData
          } as MemoData;
        }
        return null;
      });

      const resolvedMemosData = await Promise.all(memosDataPromises);
      const finalMemoData = resolvedMemosData.filter((memo: any): memo is MemoData => memo !== null);
      setMemos(finalMemoData);
    } catch (error) {
      console.error("Memos fetch error:", error);
      Alert.alert('エラー', 'メモの取得に失敗しました。');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMemosAndProfiles();
  }, []);

  const formatUpdatedAt = (dateObj: any) => {
    if (!dateObj) return '--/-- --:--';
    const date = dateObj.toDate ? dateObj.toDate() : new Date(dateObj);
    const now = new Date();
    const y = date.getFullYear();
    const m = date.getMonth() + 1;
    const d = date.getDate();
    const h = String(date.getHours()).padStart(2, '0');
    const min = String(date.getMinutes()).padStart(2, '0');
    if (y !== now.getFullYear()) {
      return `${y}/${m}/${d} ${h}:${min}`;
    } else {
      return `${m}/${d} ${h}:${min}`;
    }
  };

  const getAvatorSource = (profile?: MemoData['userProfile']) => {
    if (!profile) return DEFAULT_MALE_IMAGE;
    const userImage = profile.photoURL;
    const photoStatus = profile.mainPhotoStatus;
    if (userImage && photoStatus === 'approved') {
      if (typeof userImage === 'string' && userImage.startsWith('http')) return { uri: userImage };
    }
    if (profile.gender === 'female') {
      return DEFAULT_FEMALE_IMAGE;
    }
    return DEFAULT_MALE_IMAGE;
  };

  const openMemoModal = (memo: MemoData) => {
    setSelectedMemo(memo);
    setMemoText(memo.text);
    setIsModalVisible(true);
  };

  const handleSaveMemo = async () => {
    if (!selectedMemo) return;
    setIsSaving(true);

    const currentUser = auth.currentUser;
    if (!currentUser) {
      setIsSaving(false);
      Alert.alert('エラー', 'ログイン状態を確認できませんでした。')
      return;
    }

    try {
      const memoRef = doc(db, 'users', currentUser.uid, 'memos', selectedMemo.targetUserId);
      await setDoc(memoRef, {
        text: memoText.trim(), targetUserId: selectedMemo.targetUserId, updatedAt: serverTimestamp(),
      }, { merge: true });
      setIsModalVisible(false);
      fetchMemosAndProfiles();
    } catch (error) {
      console.error('Memo save error:', error);
      Alert.alert('エラー', 'メモの保存に失敗しました。');
    } finally {
      setIsSaving(false);
    }
  };

  const renderMemoItem = ({ item }: { item: MemoData }) => (
    <View style={styles.cardContainer}>
      <TouchableOpacity style={styles.profileSection} activeOpacity={0.7}
        onPress={() => navigation.navigate('UserProfile', { userId: item.targetUserId })}
      >
        <Image source={getAvatorSource(item.userProfile)} style={styles.avatar} resizeMode="cover" />
        <View style={styles.profileInfo}>
          <Text style={styles.userName} numberOfLines={1}>{item.userProfile?.displayName}</Text>
          <View style={styles.dateRow}>
            <Ionicons name="time-outline" size={12} color="#94A3B8" />
            <Text style={styles.dateText}>{formatUpdatedAt(item.updatedAt)}</Text>
          </View>
        </View>
        <Ionicons name="chevron-forward" size={18} color="#CBD5E1" style={styles.chevronIcon} />
      </TouchableOpacity>

      <View style={styles.divider} />

      <TouchableOpacity style={styles.memoButtonSection} activeOpacity={0.7} onPress={() => openMemoModal(item)}>
        <View style={styles.memoIconBg}>
          <Ionicons name="document-text" size={20} color="#F59E0B" />
        </View>
      </TouchableOpacity>
    </View>
  );

  return (
    <View style={styles.container}>
      <SafeAreaView edges={['top']} style={styles.headerSafeArea}>
        <View style={styles.header}>
          <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
            <Ionicons name="chevron-back" size={26} color={THEME.textMain} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>登録済みメモ</Text>
          <View style={{ width: 40 }} />
        </View>
      </SafeAreaView>

      {loading || memos.length === 0 ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={THEME.primary} />
        </View>
      ) : memos.length > 0 ? (
        <FlatList data={memos} keyExtractor={(item) => item.id} renderItem={renderMemoItem}
          contentContainerStyle={[styles.listContent, { paddingBottom: insets.bottom + 40 }]}
          showsVerticalScrollIndicator={false}
        />
      ) : (
        <View style={styles.emptyContainer}>
          <View style={styles.emptyIconCircle}>
            <Ionicons name="document-text" size={36} color="#CBD5E1" />
          </View>
          <Text style={styles.emptyText}>
            まだ登録されたメモはありません。{'\n'}気になったお相手のプロフィールから{'\n'}メモを残してみましょう。
          </Text>
        </View>
      )
      }

      <Modal visible={isModalVisible} transparent={true} animationType="slide" onRequestClose={() =>
        setIsModalVisible(false)} >
        {Platform.OS === 'ios' ? (
          <KeyboardAvoidingView behavior="padding" style={styles.modalOverlay}>
            <TouchableWithoutFeedback onPress={() => setIsModalVisible(false)}>
              <View style={styles.modalBackdrop} />
            </TouchableWithoutFeedback>

            <View style={[styles.memoModalContent, { paddingBottom: Math.max(insets.bottom, 16) }]}>
              <View style={styles.modalHandle} />

              <View style={styles.memoModalHeader}>
                <Ionicons name="document-text" size={20} color={THEME.primary} style={{ marginRight: 8 }} />
                <Text style={styles.memoModalTitle}>プライベートメモ</Text>
              </View>

              <Text style={styles.memoModalSubtitle}>
                <Text style={{ fontWeight: 'bold', color: THEME.textMain }}>
                  {selectedMemo?.userProfile?.displayName}
                </Text>
                さんについてもメモです。{'\n'}このメモはお相手には公開されません。
              </Text>

              <View style={styles.inputContainer}>
                <TextInput style={styles.memoInput} multiline value={memoText} onChangeText={setMemoText}
                  maxLength={500} placeholder="気になったことをメモしておきましょう..." placeholderTextColor="#94A3B8" autoFocus={true}
                />
                <Text style={styles.charCount}>{memoText.length}/500</Text>
              </View>

              <View style={styles.modalButtonRow}>
                <TouchableOpacity style={styles.cancelButton} onPress={() => setIsModalVisible(false)} disabled={isSaving}>
                  <Text style={styles.cancelButtonText}>キャンセル</Text>
                </TouchableOpacity>

                <TouchableOpacity style={[styles.saveButton, isSaving && { opacity: 0.7 }]} onPress={handleSaveMemo} disabled={isSaving}>
                  {isSaving ? (
                    <ActivityIndicator color="#FFF" size="small" />
                  ) : (
                    <Text style={styles.saveButtonText}>保存する</Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          </KeyboardAvoidingView>
        ) : (
          <View style={[styles.modalOverlay, { marginBottom: keyboardOffset }]}>
            <TouchableWithoutFeedback onPress={() => setIsModalVisible(false)}>
              <View style={styles.modalBackdrop} />
            </TouchableWithoutFeedback>

            <View style={[styles.memoModalContent, { paddingBottom: Math.max(insets.bottom, 16) }]}>
              <View style={styles.modalHandle} />

              <View style={styles.memoModalHeader}>
                <Ionicons name="document-text" size={20} color={THEME.primary} style={{ marginRight: 8 }} />
                <Text style={styles.memoModalTitle}>プライベートメモ</Text>
              </View>

              <Text style={styles.memoModalSubtitle}>
                <Text style={{ fontWeight: 'bold', color: THEME.textMain }}>
                  {selectedMemo?.userProfile?.displayName}
                </Text>
                さんについてもメモです。{'\n'}このメモはお相手には公開されません。
              </Text>

              <View style={styles.inputContainer}>
                <TextInput style={styles.memoInput} multiline value={memoText} onChangeText={setMemoText}
                  maxLength={500} placeholder="気になったことをメモしておきましょう..." placeholderTextColor="#94A3B8" autoFocus={true}
                />
                <Text style={styles.charCount}>{memoText.length}/500</Text>
              </View>

              <View style={styles.modalButtonRow}>
                <TouchableOpacity style={styles.cancelButton} onPress={() => setIsModalVisible(false)} disabled={isSaving}>
                  <Text style={styles.cancelButtonText}>キャンセル</Text>
                </TouchableOpacity>

                <TouchableOpacity style={[styles.saveButton, isSaving && { opacity: 0.7 }]} onPress={handleSaveMemo} disabled={isSaving}>
                  {isSaving ? (
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
    </View >
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: THEME.background },
  headerSafeArea: { backgroundColor: '#FFFFFF', borderBottomWidth: 1, borderBottomColor: '#F1F5F9' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, height: 50 },
  backButton: { width: 40, height: 40, justifyContent: 'center', alignItems: 'flex-start' },
  headerTitle: { fontSize: 17, fontWeight: '700', color: THEME.textMain },
  centerContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  listContent: { padding: 16 },
  cardContainer: {
    flexDirection: 'row', backgroundColor: '#FFFFFF', borderRadius: 20, marginBottom: 12, borderWidth: 1,
    borderColor: '#F1F5F9', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.04,
    shadowRadius: 8, elevation: 2, overflow: 'hidden'
  },
  profileSection: { flex: 1, flexDirection: 'row', alignItems: 'center', padding: 14 },
  avatar: { width: 52, height: 52, borderRadius: 26, backgroundColor: '#F1F5F9', borderWidth: 1, borderColor: '#E2E8F0' },
  profileInfo: { flex: 1, marginLeft: 12 },
  userName: { fontSize: 15, fontWeight: '700', color: THEME.textMain, marginBottom: 4 },
  dateRow: { flexDirection: 'row', alignItems: 'center' },
  dateText: { fontSize: 11, color: THEME.textSub, marginLeft: 4, fontWeight: '500', letterSpacing: 0.3 },
  chevronIcon: { marginLeft: 8 },
  divider: { width: 1, backgroundColor: '#F1F5F9', marginVertical: 12 },
  memoButtonSection: { width: 76, justifyContent: 'center', alignItems: 'center' },
  memoIconBg: {
    width: 44, height: 44, borderRadius: 22, backgroundColor: '#FEF3C7', borderWidth: 1, borderColor: '#FDE68A',
    justifyContent: 'center', alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05, shadowRadius: 4, elevation: 1
  },
  emptyContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 32, marginTop: -50 },
  emptyIconCircle: {
    width: 80, height: 80, borderRadius: 40, backgroundColor: '#F1F5F9', justifyContent: 'center',
    alignItems: 'center', marginBottom: 16
  },
  emptyText: { fontSize: 14, color: '#94A3B8', textAlign: 'center', lineHeight: 24 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(15, 23, 42, 0.6)', justifyContent: 'flex-end' },
  modalBackdrop: { ...StyleSheet.absoluteFillObject },
  memoModalContent: { backgroundColor: '#FFF', borderTopLeftRadius: 32, borderTopRightRadius: 32, padding: 24 },
  modalHandle: { width: 40, height: 4, backgroundColor: '#E2E8F0', borderRadius: 2, alignSelf: 'center', marginBottom: 24 },
  memoModalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
  memoModalTitle: { fontSize: 20, fontWeight: '800', color: THEME.textMain },
  memoModalSubtitle: { fontSize: 13, color: THEME.textSub, textAlign: 'center', marginBottom: 20, lineHeight: 22 },
  inputContainer: { position: 'relative', marginBottom: 24 },
  memoInput: {
    backgroundColor: '#F8FAFC', borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 16, padding: 16,
    height: 160, fontSize: 15, color: THEME.textMain, textAlignVertical: 'top'
  },
  charCount: { position: 'absolute', bottom: 12, right: 16, fontSize: 11, fontWeight: '500', color: '#94A3B8' },
  modalButtonRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 12 },
  cancelButton: { flex: 1, paddingVertical: 16, borderRadius: 30, backgroundColor: '#F1F5F9', alignItems: 'center' },
  cancelButtonText: { fontSize: 15, fontWeight: '700', color: '#64748B' },
  saveButton: {
    flex: 2, borderRadius: 30, backgroundColor: THEME.primary, alignItems: 'center', justifyContent: 'center',
    paddingVertical: 16, shadowColor: THEME.primary, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8,
    elevation: 4
  },
  saveButtonText: { fontSize: 16, fontWeight: '700', color: '#FFF' },
})