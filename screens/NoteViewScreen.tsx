import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ImageBackground, Image,
  ActivityIndicator, Alert, Dimensions, PanResponder,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Ionicons from 'react-native-vector-icons/Ionicons';
import firestore from '@react-native-firebase/firestore';

const NOTE_BG_IMAGE = require('../assets/open_note.png');
const DESK_BG_IMAGE = require('../assets/desk.png');
const { width } = Dimensions.get('window');
const NOTE_ASPECT_RATIO = 1.4;
const NOTE_WIDTH = width;
const NOTE_HEIGHT = NOTE_WIDTH / NOTE_ASPECT_RATIO;

interface NotePage {
  id: string;
  photoUri: string | null;
  comment: string;
}

export default function NoteViewScreen({ navigation, route }: { navigation: any, route: any }) {
  const { userId } = route.params;
  const [pages, setPages] = useState<NotePage[]>([]);
  const [currentIndex, setCurrentIndex] = useState<number>(0);
  const [loading, setLoading] = useState<boolean>(true);

  const pagesRef = useRef(pages);
  useEffect(() => {
    pagesRef.current = pages;
  }, [pages]);

  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (evt, gestureState) => {
        return Math.abs(gestureState.dx) > Math.abs(gestureState.dy);
      },
      onPanResponderRelease: (evt, gestureState) => {
        if (gestureState.dx < -10) {
          handleNextPage();
        } else if (gestureState.dx > 5) {
          handlePrevPage();
        }
      },
      onPanResponderTerminate: (evt, gestureState) => {
        console.log("Swipe Terminate dx:", gestureState.dx);
        if (gestureState.dx < -50) {
          handleNextPage();
        } else if (gestureState.dx > 50) {
          handlePrevPage();
        }
      }
    })
  ).current;

  useEffect(() => {
    const fetchNoteData = async () => {
      try {
        const userDocSnap = await firestore().collection('users').doc(userId).collection('private').doc('settings').get();

        if (userDocSnap.exists()) {
          const data = userDocSnap.data();
          if (data?.notePages && Array.isArray(data.notePages) && data.notePages.length >= 2) {
            setPages(data.notePages);
          } else {
            Alert.alert("お知らせ", "このユーザーはまだNoteを作成していません。");
            navigation.goBack();
          }
        }
      } catch (error) {
        console.error("Error fecthing note data:", error);
        Alert.alert("エラー", "データの取得に失敗しました。");
        navigation.goBack();
      } finally {
        setLoading(false);
      }
    };
    fetchNoteData();
  }, [userId]);

  const handleNextPage = () => {
    setCurrentIndex((prev) => (prev < pagesRef.current.length - 1 ? prev + 1 : prev));
  };

  const handlePrevPage = () => {
    setCurrentIndex((prev) => (prev > 0 ? prev - 1 : prev));
  };

  if (loading) {
    return (
      <View style={[styles.container, styles.centered]}>
        <ActivityIndicator size="large" color="#E83E8C" />
      </View>
    );
  }

  if (pages.length === 0) return null;

  const currentPage = pages[currentIndex];

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <View style={[styles.bgCircle, styles.bgCircleTopRight]} />
      <View style={[styles.bgCircle, styles.bgCircleBottomLeft]} />
      <View style={[styles.bgCircle, styles.bgCircleMiddleLeft]} />

      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.closeButton}>
          <Ionicons name="close" size={28} color="#333" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Note</Text>
        <View style={styles.closeButton} />
      </View>

      <View style={styles.mainContent} {...panResponder.panHandlers}>

        <View style={styles.topPhotoSection}>
          <View style={styles.topPhotoWrapper}>
            {currentPage.photoUri ? (
              <>
                <Image source={{ uri: currentPage.photoUri }} style={styles.topPhotoBackground} blurRadius={15} />
                <View style={styles.topPhotoOverlay}>
                  <Image source={{ uri: currentPage.photoUri }} style={styles.topPhotoMain} />
                </View>
              </>
            ) : (
              <View style={styles.topPhotoPlaceholder} />
            )}
          </View>
        </View>

        <ImageBackground
          source={DESK_BG_IMAGE}
          style={styles.deskBackground}
          imageStyle={styles.deskBackgroundImage}
        >

          <View style={styles.noteContainer}>
            <ImageBackground
              source={NOTE_BG_IMAGE}
              style={[styles.noteBackground, { width: NOTE_WIDTH, height: NOTE_HEIGHT }]}
              imageStyle={styles.noteImageStyle}
            >
              <View style={styles.notePagesWrapper}>

                <View style={styles.leftPage}>
                  <View style={styles.photoContainer}>
                    {currentPage.photoUri ? (
                      <Image source={{ uri: currentPage.photoUri }} style={styles.photo} />
                    ) : (
                      <View style={styles.photoPlaceholder} />
                    )}
                  </View>
                </View>

                <View style={styles.centerBinding} />

                <View style={styles.rightPage}>
                  <Text style={styles.commentText}>{currentPage.comment}</Text>
                </View>

              </View>
            </ImageBackground>
          </View>
        </ImageBackground>

      </View>

      <View style={styles.paginationContainer}>
        {pages.map((_, idx) => (
          <View key={idx} style={[styles.dot, currentIndex === idx && styles.activeDot]} />
        ))}
      </View>

    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FAFAFA' },
  centered: { justifyContent: 'center', alignItems: 'center' },
  bgCircle: { position: 'absolute', borderRadius: 999, opacity: 0.4 },
  bgCircleTopRight: { width: 250, height: 250, backgroundColor: '#d4e7fd', top: -50, right: -50 },
  bgCircleBottomLeft: { width: 300, height: 300, backgroundColor: '#FCE7F3', bottom: 50, left: -100 },
  bgCircleMiddleLeft: { width: 150, height: 150, backgroundColor: '#FEE2E2', top: '35%', left: -50 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12, zIndex: 10 },
  headerTitle: { fontSize: 25, fontWeight: 'bold', color: '#333', letterSpacing: 1 },
  closeButton: { width: 40, height: 40, justifyContent: 'center', alignItems: 'center' },
  mainContent: { flex: 1, flexDirection: 'column', paddingHorizontal: 0 },
  topPhotoSection: { flex: 1, width: '100%', paddingHorizontal: 16, paddingTop: 16, paddingBottom: 16, justifyContent: 'center', alignItems: 'center' },
  topPhotoWrapper: {
    width: '100%', height: '100%', borderRadius: 16, overflow: 'hidden', backgroundColor: '#E2E8F0', shadowColor: "#000",
    shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.25, shadowRadius: 10, elevation: 8
  },
  topPhotoBackground: { ...StyleSheet.absoluteFill, width: '100%', height: '100%', opacity: 0.6 },
  topPhotoOverlay: { ...StyleSheet.absoluteFill, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.15)' },
  topPhotoMain: { width: '92%', height: '92%', resizeMode: 'contain', borderRadius: 8 },
  topPhotoPlaceholder: { flex: 1, backgroundColor: '#E2E8F0' },
  deskBackground: { width: '100%', paddingTop: 40, justifyContent: 'flex-end', alignItems: 'center', marginBottom: 5, },
  deskBackgroundImage: { resizeMode: 'cover', },
  noteContainer: {
    width: '100%', alignItems: 'center', shadowColor: "#000", shadowOffset: { width: 0, height: 5 }, shadowOpacity: 0.15,
    shadowRadius: 15, elevation: 10, transform: [{ translateY: 10 }],
  },
  noteBackground: { justifyContent: 'center', alignItems: 'center' },
  noteImageStyle: { borderRadius: 12, resizeMode: 'contain' },
  notePagesWrapper: { flex: 1, flexDirection: 'row', width: '100%', paddingVertical: '6%', paddingHorizontal: '4%' },
  leftPage: {
    flex: 1, paddingTop: 11, paddingLeft: 11, paddingBottom: 11, paddingRight: 15, justifyContent: 'center',
    marginLeft: 15, marginBottom: 5
  },
  photoContainer: { flex: 1, borderRadius: 8, overflow: 'hidden', justifyContent: 'center', alignItems: 'center' },
  photo: { width: '100%', height: '100%', resizeMode: 'cover' },
  photoPlaceholder: { flex: 1, width: '100%', height: '100%', backgroundColor: '#E2E8F0' },
  centerBinding: { width: 15 },
  rightPage: { flex: 1, paddingTop: 20, paddingBottom: 10, paddingLeft: 2, paddingRight: 27, justifyContent: 'flex-start' },
  commentText: { fontSize: 13, color: '#333', lineHeight: 22 },
  paginationContainer: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', paddingBottom: 30, gap: 8 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#CBD5E1' },
  activeDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#E83E8C' },
  nextButtonOverlay: {
    position: 'absolute', bottom: 30, left: 20, backgroundColor: 'rgba(232, 62, 140, 0.85)', paddingHorizontal: 12,
    paddingVertical: 8, borderRadius: 20, flexDirection: 'row', alignItems: 'center', zIndex: 20, shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.2, shadowRadius: 4, elevation: 4,
  },
  nextButtonText: { color: '#FFF', fontSize: 12, fontWeight: 'bold', marginRight: 2, },
});