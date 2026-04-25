import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ImageBackground, TextInput, Image, KeyboardAvoidingView, ActivityIndicator,
  Platform, Alert, Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityicons';
import Ionicons from 'react-native-vector-icons/Ionicons';
import LinearGradient from 'react-native-linear-gradient';
import ImagePicker from 'react-native-image-crop-picker';
import auth from '@react-native-firebase/auth';
import firestore from '@react-native-firebase/firestore';
import storage from '@react-native-firebase/storage';

const NOTE_BG_IMAGE = require('../assets/open_note.png');
const { width } = Dimensions.get('window');
const NOTE_ASPECT_RATIO = 1.4;
const NOTE_WIDTH = width - 32;
const NOTE_HEIGHT = NOTE_WIDTH / NOTE_ASPECT_RATIO;

interface NotePage {
  id: string;
  photoUri: string | null;
  comment: string;
}

export default function NoteSettingScreen({ navigation }: any) {
  const [pages, setPages] = useState<NotePage[]>([
    { id: 'page-1', photoUri: null, comment: '' },
    { id: 'page-2', photoUri: null, comment: '' },
  ]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const currentPage = pages[currentIndex];

  useEffect(() => {
    const fetchNoteData = async () => {
      try {
        const currentUser = auth().currentUser;

        if (!currentUser) {
          setLoading(false);
          return;
        }

        const userDocSnap = await firestore().collection('users').doc(currentUser.uid).get();

        if (userDocSnap.exists()) {
          const data = userDocSnap.data();
          if (data?.notePages && Array.isArray(data.notePages) && data.notePages.length >= 2) {
            setPages(data.notePages);
          }
        }
      } catch (error) {
        console.error("Error fecthing note data:", error);
        Alert.alert("エラー", "データの取得に失敗しました。")
      } finally {
        setLoading(false);
      }
    };
    fetchNoteData();
  }, []);

  const handlePickImage = async () => {
    try {
      const image = await ImagePicker.openPicker({
        mediaType: 'photo',
        cropping: true,
        width: 700,
        height: 1000,
        freeStyleCropEnabled: false,
        compressImageQuality: 0.8,

        cropperToolbarTitle: '写真を編集',
        cropperToolbarColor: '#FFFFFF',
        cropperToolbarWigetColor: '#333333',
        cropperActiveWidgetColor: '#E83E8C',
        cropperStatusBarColor: '#FFFFFF',
      });

      if (image && image.path) {
        const newPages = [...pages];
        newPages[currentIndex].photoUri = image.path;
        setPages(newPages);
      }
    } catch (error: any) {
      if (error.message !== 'User cancelled image selection') {
        Alert.alert("エラー", "画像の選択に失敗しました。");
        console.error("Imaga Crop Picker Error:", error);
      }
    }
  };

  const handleCommentChange = (text: string) => {
    const newPages = [...pages];
    newPages[currentIndex].comment = text;
    setPages(newPages);
  };

  const handleNextPage = () => {
    if (currentIndex < pages.length - 1) {
      setCurrentIndex(currentIndex + 1);
    }
  };

  const handlePrevPage = () => {
    if (currentIndex > 0) {
      setCurrentIndex(currentIndex - 1);
    }
  };

  const handleAddPage = () => {
    if (pages.length < 5) {
      const newPage = { id: `page-${Date.now()}`, photoUri: null, comment: '' };
      setPages([...pages, newPage]);
      setCurrentIndex(pages.length);
    }
  };

  const handleRemovePage = () => {
    if (currentIndex === 0) {
      Alert.alert("確認", "1ページ目は削除できません。")
      return;
    }
    Alert.alert(
      "ページの削除",
      `現在のページ（${currentIndex + 1}ページ目）を削除しますか？`,
      [
        { text: "キャンセル", style: "cancel" },
        {
          text: "削除",
          style: "destructive",
          onPress: () => {
            const newPages = pages.filter((_, index) => index !== currentIndex);
            setPages(newPages);
            if (currentIndex >= newPages.length) {
              setCurrentIndex(newPages.length - 1);
            }
          }
        }
      ]
    );
  };

  const handleSave = async () => {
    const isComplete = pages.every(p => p.photoUri);
    if (!isComplete) {
      Alert.alert("確認", "写真が未入力のページがあります");
      return;
    } else if (pages.length < 2) {
      Alert.alert("確認", "2ページ以上で作成して下さい");
      return;
    } else {
      saveToDatabase();
    }
  };

  const saveToDatabase = async () => {
    try {
      setLoading(true);
      const currentUser = auth().currentUser;

      if (!currentUser) {
        setLoading(false);
        return;
      }

      const uploadPages = await Promise.all(
        pages.map(async (pages, index) => {
          let finalPhotoUri = pages.photoUri;
          if (finalPhotoUri && !finalPhotoUri.startsWith('http')) {
            try {
              const fileRef = storage().ref(`users/${currentUser.uid}/notePages/${Date.now()}_${index}.jpg`);
              await fileRef.putFile(finalPhotoUri);

              finalPhotoUri = await fileRef.getDownloadURL();
            } catch (uploadError) {
              console.error(`Error uploading image for page ${index}:`, uploadError);
              throw new Error('画像のアップロードに失敗しました。');
            }
          }

          return {
            ...pages,
            photoUri: finalPhotoUri,
          };
        })
      );

      await firestore().collection('users').doc(currentUser.uid).collection('private').doc('settings').set({
        notePages: uploadPages
      }, { merge: true });

      Alert.alert("保存完了", "Noteを更新しました。")
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteAll = () => {
    Alert.alert(
      "Noteの削除",
      "作成したNoteのデータを全て削除します。\n一度削除すると元に戻せません、本当によろしいですか？",
      [
        { text: "キャンセル", style: "cancel" },
        {
          text: "削除する",
          onPress: async () => {
            try {
              setLoading(true);
              const currentUser = auth().currentUser;
              if (!currentUser) return;

              await firestore().collection('usres').doc(currentUser.uid).collection('private').doc('settings').update({
                notePages: firestore.FieldValue.delete()
              });

              Alert.alert("削除完了", "Noteデータを削除しました。", [
                { text: "OK", onPress: () => navigation.goBack() }
              ]);
            } catch (error) {
              Alert.alert("エラー", "削除に失敗しました。");
              console.error("Delete Note Error:", error);
            } finally {
              setLoading(false)
            }
          }
        }
      ]
    );
  };

  if (loading) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color="#E83E8C" />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="chevron-back" size={24} color="#333" />
        </TouchableOpacity>

        <Text style={styles.headerTitle}>Note</Text>
        <View style={styles.backButton} />
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.mainContent}>
          <View style={styles.introSection}>
            <Text style={styles.introText}>
              写真とコメントでページを繋いで、{'\n'}あなたの事を伝える”ノート”を作ろう！
              {'\n'}最低3ページ、最大5ページまで作成できます。
            </Text>
          </View>

          <View style={styles.paginationContainer}>
            {pages.map((_, idx) => (
              <View key={idx} style={[styles.dot, currentIndex === idx && styles.activeDot]} />
            ))}
          </View>

          <View style={styles.noteContainer}>
            <ImageBackground
              source={NOTE_BG_IMAGE}
              style={[styles.noteBackground, { width: NOTE_WIDTH, height: NOTE_HEIGHT }]}
              imageStyle={styles.noteImageStyle}
            >
              <View style={styles.notePagesWrapper}>
                <View style={styles.leftPage}>
                  <TouchableOpacity
                    style={[styles.photoUploadArea, currentPage.photoUri && styles.photoUploadAreaActive]}
                    activeOpacity={0.8}
                    onPress={handlePickImage}
                  >
                    {currentPage.photoUri ? (
                      <Image source={{ uri: currentPage.photoUri }} style={styles.uploadedPhoto} />
                    ) : (
                      <View style={styles.photoPlaceholder}>
                        <MaterialCommunityIcons name="camera-plus" size={32} color="#E83E8C" />
                        <Text style={styles.photoPlaceholderText}>写真をタップして追加</Text>
                      </View>
                    )}
                  </TouchableOpacity>
                </View>

                <View style={styles.centerBinding} />

                <View style={styles.rightPage}>
                  <TouchableOpacity
                    style={styles.pageCloseButton}
                    onPress={handleRemovePage}
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                  >
                    <Ionicons name="close-outline" size={22} color="#EF4444" />
                  </TouchableOpacity>

                  <TextInput
                    style={styles.commentInput}
                    placeholder="この写真についてのエピソードや、あなたの思いを書いてみましょう。"
                    placeholderTextColor="#A0AEC0"
                    multiline
                    maxLength={40}
                    value={currentPage.comment}
                    onChangeText={handleCommentChange}
                    textAlignVertical="top"
                  />

                  <Text style={styles.charCount}>
                    {currentPage.comment.length}/40
                  </Text>
                </View>

              </View>
            </ImageBackground>
          </View>

          <View style={styles.controlsContainer}>
            <View style={styles.navButtonsRow}>
              <TouchableOpacity
                style={[styles.navButton, currentIndex === 0 && styles.disabledButton]}
                onPress={handlePrevPage}
                disabled={currentIndex === 0}
              >
                <Ionicons name="chevron-back" size={20} color={currentIndex === 0 ? "#CBD5E1" : "#475569"} />
                <Text style={[styles.navButtonText, currentIndex === 0 && styles.disabledText]}>前のページ</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.navButton, currentIndex === pages.length - 1 && styles.disabledButton]}
                onPress={handleNextPage}
                disabled={currentIndex === pages.length - 1}
              >
                <Text style={[styles.navButtonText, currentIndex === pages.length - 1 && styles.disabledText]}>次のページ</Text>
                <Ionicons name="chevron-forward" size={20} color={currentIndex === pages.length - 1 ? "#CBD5E1" : "#475569"} />
              </TouchableOpacity>
            </View>

            <View style={styles.editButtonsRow}>
              {pages.length < 5 ? (
                <TouchableOpacity style={styles.addPageButton} onPress={handleAddPage}>
                  <Ionicons name="add-circle-outline" size={18} color="#E83E8C" style={{ marginRight: 4 }} />
                  <Text style={styles.addPageButtonText}>ページを追加</Text>
                </TouchableOpacity>
              ) : (
                <View style={{ flex: 1 }} />
              )}
            </View>
          </View>
        </View>

        <View style={styles.bottomBar}>
          <TouchableOpacity style={styles.saveButtonWrapper} onPress={handleSave} activeOpacity={0.8}>
            <LinearGradient
              colors={['#E83E8C', '#FF6B6B']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.saveButton}
            >
              <Text style={styles.saveButtonText}>保存</Text>
            </LinearGradient>
          </TouchableOpacity>

          <TouchableOpacity style={styles.deleteAllButton} onPress={handleDeleteAll} activeOpacity={0.6}>
            <Text style={styles.deleteAllButtonText}>Noteを削除する</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}


const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FAFAFA' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12, backgroundColor: '#FFF', borderBottomWidth: 1, borderBottomColor: '#F1F5F9' },
  headerTitle: { fontSize: 20, fontWeight: 'bold', color: '#333' },
  backButton: { width: 40, height: 40, justifyContent: 'center', alignItems: 'flex-start' },
  mainContent: { flex: 1, padding: 16, justifyContent: 'flex-start' },
  introSection: { marginBottom: 16, alignItems: 'center' },
  introText: { fontSize: 13, color: '#64748B', textAlign: 'center', lineHeight: 20 },
  paginationContainer: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', marginBottom: 16, gap: 8 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#E2E8F0' },
  activeDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#E83E8C' },
  noteContainer: { alignItems: 'center', marginBottom: 24, shadowColor: "#000", shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.15, shadowRadius: 12, elevation: 8 },
  noteBackground: { justifyContent: 'center', alignItems: 'center' },
  noteImageStyle: { borderRadius: 8, resizeMode: 'cover' },
  notePagesWrapper: { flex: 1, flexDirection: 'row', width: '100%', paddingVertical: '6%', paddingHorizontal: '4%', },
  leftPage: { flex: 1, padding: 8, justifyContent: 'center', marginLeft: 5 },
  photoUploadArea: { flex: 1, backgroundColor: 'rgba(255, 255, 255, 0.6)', borderRadius: 8, borderWidth: 1, borderColor: 'rgba(232, 62, 140, 0.3)', borderStyle: 'dashed', overflow: 'hidden', justifyContent: 'center', alignItems: 'center' },
  photoUploadAreaActive: { backgroundColor: 'transparent', borderWidth: 0 },
  uploadedPhoto: { width: '100%', height: '100%', resizeMode: 'cover' },
  photoPlaceholder: { alignItems: 'center', justifyContent: 'center', padding: 10 },
  photoPlaceholderText: { fontSize: 11, color: '#E83E8C', marginTop: 8, fontWeight: 'bold', textAlign: 'center' },
  centerBinding: { width: 20 },
  rightPage: { flex: 1, padding: 8, paddingTop: 12, paddingBottom: 4, marginRight: 1 },
  pageCloseButton: { position: 'absolute', top: 1, right: 8, zIndex: 10, backgroundColor: 'rgba(255, 255, 255,0.6)', borderRadius: 12 },
  commentInput: { flex: 1, fontSize: 13, color: '#333', lineHeight: 22, backgroundColor: 'transparent' },
  charCount: { fontSize: 10, color: '#94A3B8', textAlign: 'right', marginTop: 3, marginRight: 4 },
  controlsContainer: { backgroundColor: '#FFF', borderRadius: 16, padding: 13, borderWidth: 1, borderColor: '#F1F5F9' },
  navButtonsRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  navButton: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, paddingHorizontal: 12, backgroundColor: '#F8FAFC', borderRadius: 8 },
  disabledButton: { backgroundColor: '#F1F5F9', opacity: 0.5 },
  navButtonText: { fontSize: 13, fontWeight: 'bold', color: '#475569', marginHorizontal: 4 },
  disabledText: { color: '#CBD5E1' },
  bottomDotContainer: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  bottomDot: { width: 12, height: 12, borderRadius: 6, borderWidth: 1.5, borderColor: '#888', backgroundColor: 'transparent' },
  bottomActiveDot: { backgroundColor: '#333', borderColor: '#333' },
  editButtonsRow: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', borderTopWidth: 1, borderTopColor: '#F1F5F9', paddingTop: 16 },
  addPageButton: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFF0F5', paddingVertical: 8, paddingHorizontal: 16, borderRadius: 20 },
  addPageButtonText: { fontSize: 12, fontWeight: 'bold', color: '#E83E8C' },
  bottomBar: { backgroundColor: '#FFF', paddingHorizontal: 24, paddingVertical: 16, borderTopWidth: 1, borderTopColor: '#F1F5F9', },
  saveButtonWrapper: { shadowColor: "#E83E8C", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 8, elevation: 4 },
  saveButton: { paddingVertical: 16, borderRadius: 30, alignItems: 'center', justifyContent: 'center' },
  saveButtonText: { color: '#FFF', fontSize: 16, fontWeight: 'bold', letterSpacing: 1 },
  deleteAllButton: { marginTop: 12, paddingVertical: 8, alignItems: 'center' },
  deleteAllButtonText: { color: '#94A3B8', fontSize: 12, fontWeight: 'bold' },
});