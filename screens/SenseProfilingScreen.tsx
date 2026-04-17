import React, { useState, useEffect } from 'react';
import {
  View, Text, TouchableOpacity, Alert, ActivityIndicator, Dimensions, StyleSheet, ScrollView, StatusBar, Platform
} from 'react-native';
import { Image } from 'expo-image';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { getFirestore, doc, getDoc, setDoc, serverTimestamp, updateDoc } from '@react-native-firebase/firestore';
import { getAuth } from '@react-native-firebase/auth';
import questionsDataJson from '../assets/questions.json';

const { width, height } = Dimensions.get('window');
const COLORS = {
  primary: '#3B82F6', primaryLight: '#EFF6FF', background: '#F5F8FF', surface: '#FFFFFF', textMain: '#1E293B',
  textSub: '#64748B', border: '#E2E8F0',
};

interface QuestionMaster {
  id: string; category: string; type: 'binary_choice' | 'three_choice' | 'image_choice'; text: string;
  options: string; image_url?: string | null; text_for_true?: string; text_for_false?: string;
  vector_text_1?: string; vector_text_2?: string; vector_text_3?: string;
}

interface DisplayQuestion extends Omit<QuestionMaster, 'options'> { optionsArray: string[]; }

const allQuestions = questionsDataJson as QuestionMaster[];

const HeaderBackground = () => (
  <View style={styles.headerBackground}>
    <Image source={require('../assets/brain.webp')} style={styles.headerBackgroundImage} contentFit="cover" />
  </View>
);

export default function SenseProfilingScreen({ navigation, route }: { navigation: any, route: any }) {
  const onCompleted = route.params?.onCompleted;
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [questions, setQuestions] = useState<DisplayQuestion[]>([]);
  const [answers, setAnswers] = useState<{ [key: string]: string }>({});
  const [aiProfiles, setAiProfiles] = useState<{ [key: string]: string }>({});
  const [savedImageUrls, setSavedImageUrls] = useState<{ [key: string]: string }>({});
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  const auth = getAuth();
  const db = getFirestore();

  useEffect(() => {
    const initialzeProfiling = async () => {
      try {
        const user = auth.currentUser;
        if (!user) {
          Alert.alert("エラー", "ログインしていません");
          setLoading(false);
          return;
        }

        const userRef = doc(db, 'users', user.uid);
        const senseDataRef = doc(db, 'users', user.uid, 'senseData', 'profile');

        const userSnap = await getDoc(userRef);
        let answerCount = 0;
        if (userSnap.exists()) {
          answerCount = userSnap.data()?.senseAnswerCount || 0;
        }

        const senseDataSnap = await getDoc(senseDataRef);
        let questionIds: string[] = [];
        let savedAnswers: { [key: string]: string } = {};
        let savedAiProfiles: { [key: string]: string } = {};
        let fetchedUrls: { [key: string]: string } = {};

        if (senseDataSnap.exists()) {
          const senseData = senseDataSnap.data();
          savedAnswers = senseData?.senseAnswers || {};
          savedAiProfiles = senseData?.senseProfiles || {};
          questionIds = senseData?.senseQuestionIds || [];
          fetchedUrls = senseData?.senseImageUrls || {};
        }

        if (questionIds.length === 0) {
          Alert.alert("エラー", "質問データの読み込みに失敗しました。前の画面に戻り、再度お試し下さい。");
          setLoading(false);
          if (navigation.goBack) navigation.goBack();
          return;
        }

        const displayQs = questionIds.map(id => {
          const qData = allQuestions.find(q => q.id === id);
          if (qData) {
            return {
              ...qData, optionsArray: qData.options.split(',')
            };
          }
          return null;
        }).filter(q => q !== null);

        setQuestions(displayQs);
        setAnswers(savedAnswers);
        setAiProfiles(savedAiProfiles);
        setSavedImageUrls(fetchedUrls);

        if (answerCount > 0 && answerCount < displayQs.length) {
          setCurrentQuestionIndex(answerCount);
        } else if (answerCount >= displayQs.length && displayQs.length > 0) {
          setCurrentQuestionIndex(displayQs.length - 1);
        }
      } catch (error) {
        console.error("初期化エラー", error);
        Alert.alert("エラー", "データの読み込みに失敗しました。");
      } finally {
        setLoading(false);
      }
    };

    initialzeProfiling();
  }, []);

  const currentQuestion = (currentQuestionIndex >= 0 && currentQuestionIndex < questionsDataJson.length) ?
    questions[currentQuestionIndex] : null;

  const progress = currentQuestionIndex >= 0 ? (currentQuestionIndex + 1) / (questions.length || 1) : 0;

  useEffect(() => {
    if (currentQuestion?.type === 'image_choice' && currentQuestion.image_url) {
      if (currentQuestion.image_url.startsWith('http')) {
        setImageUrl(currentQuestion.image_url);
      } else {
        setImageUrl(savedImageUrls[currentQuestion.id] || null);
      }
    } else {
      setImageUrl(null);
    }
  }, [currentQuestion, savedImageUrls]);

  const handleNext = async () => {
    if (!currentQuestion || !selectedOption) return;

    setSaving(true);
    const newAnswers = { ...answers, [currentQuestion.id]: selectedOption };
    const selectedIndex = currentQuestion.optionsArray.indexOf(selectedOption);
    let profileText = "";
    if (currentQuestion.type === 'binary_choice') {
      profileText = selectedIndex === 0 ? (currentQuestion.text_for_true || "") : (currentQuestion.text_for_false || "");
    } else {
      if (selectedIndex === 0) profileText = currentQuestion.vector_text_1 || "";
      if (selectedIndex === 1) profileText = currentQuestion.vector_text_2 || "";
      if (selectedIndex === 2) profileText = currentQuestion.vector_text_3 || "";
    }
    const newAiProfiles = { ...aiProfiles, [currentQuestion.id]: profileText };

    setAiProfiles(newAiProfiles);
    setAnswers(newAnswers);

    try {
      const user = auth.currentUser;
      if (user) {
        const senseDataRef = doc(db, 'users', user.uid, 'senseData', 'profile');
        await setDoc(senseDataRef, {
          senseAnswers: newAnswers, senseProfiles: newAiProfiles, shouldGenerateVector: false, uploadedAt: serverTimestamp(),
        }, { merge: true });

        const userRef = doc(db, 'users', user.uid);
        await setDoc(userRef, {
          senseAnswerCount: currentQuestionIndex + 1,
        }, { merge: true });
      }

      if (currentQuestionIndex < questions.length - 1) {
        setCurrentQuestionIndex(currentQuestionIndex + 1);
        setSelectedOption(null);
      } else {
        navigation.goBack();
      }
    } catch (error) {
      console.error("保存エラー", error);
      Alert.alert("エラー", "データの保存に失敗しました。再度お試し下さい");
    } finally {
      setSaving(false);
    }
  };

  const handleInterrupt = () => {
    Alert.alert('確認', 'ここまでの回答を保存して中断しますか？',
      [
        { text: "キャンセル", style: "cancel" },
        {
          text: "保存して中断",
          style: "destructive",
          onPress: async () => {
            try {
              setSaving(true);
              const user = auth.currentUser;
              if (user) {
                const senseDataRef = doc(db, 'users', user.uid, 'senseData', 'profile');
                await updateDoc(senseDataRef, {
                  shouldGenerateVector: true,
                });
              }
              navigation.goBack();
            } catch (error) {
              console.error("中断保存エラー", error);
              Alert.alert("エラー", "保存に失敗しました。再度お試し下さい。");
              setSaving(false);
            }
          }
        }
      ]
    );
  };

  if (loading) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color={COLORS.primary} />
        <Text style={{ marginTop: 10, color: COLORS.textSub, fontWeight: 'bold' }}>AIを準備中...</Text>
      </View>
    );
  }

  const isNextDisabled = saving || !selectedOption;
  const isInterruptDisabled = currentQuestionIndex <= 10;

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />
      <HeaderBackground />

      <SafeAreaView style={{ flex: 1 }} edges={['top', 'bottom']}>
        <View style={styles.topSection}>
          <View style={styles.headerRow}>
            <View style={{ width: 40 }} />

            <View style={styles.headerTitleRow}>
              <Text style={styles.headerTitle}>分析中</Text>
              <ActivityIndicator size="small" color="#FFFFFF" />
            </View>

            <View style={{ width: 40 }} />
          </View>

          <View style={styles.progressContainer}>
            <View style={[styles.progressBar, { width: `${progress * 100}%` }]} />
          </View>
          <Text style={styles.stepText}>STEP {currentQuestionIndex + 1} / {questions.length}</Text>
        </View>

        <View style={styles.cardContainer}>
          <ScrollView contentContainerStyle={styles.cardContent} showsVerticalScrollIndicator={true}>
            {currentQuestion?.type === 'image_choice' && (
              <View style={styles.imageQuestionContainer}>
                {imageUrl ? (
                  <Image source={{ uri: imageUrl }} style={styles.fullQuestionImage} contentFit="cover" cachePolicy="memory-disk" />
                ) : (
                  <View style={[styles.fullQuestionImage, { justifyContent: 'center', alignItems: 'center' }]}>
                    <ActivityIndicator color={COLORS.primary} />
                  </View>
                )}
                <View style={styles.imageOverlay} />
              </View>
            )}

            <Text style={styles.questionText}>
              {currentQuestion?.text}
            </Text>

            <View style={styles.optionsContainer}>
              {currentQuestion?.optionsArray.map((option, index) => {
                const isSelected = selectedOption === option;
                return (
                  <TouchableOpacity key={index} style={[styles.optionButton, isSelected && styles.optionButtonSelected]}
                    onPress={() => setSelectedOption(option)} activeOpacity={0.8}
                  >
                    <Text style={[styles.optionText, isSelected && styles.optionTextSelected]}>{option}</Text>
                    {isSelected ? (
                      <Ionicons name="checkmark-circle" size={24} color={COLORS.primary} />
                    ) : (
                      <View style={styles.radioCircle} />
                    )}
                  </TouchableOpacity>
                );
              })}
            </View>
          </ScrollView>
        </View>

        <View style={styles.footer}>
          <TouchableOpacity style={[styles.secondaryButton, isInterruptDisabled && styles.secondaryButtonDisabled]}
            onPress={handleInterrupt} disabled={isInterruptDisabled} activeOpacity={0.8}
          >
            <Text style={[styles.secondaryButtonText, isInterruptDisabled && styles.secondaryButtonTextDisabled]}>
              保存して中断
            </Text>
          </TouchableOpacity>

          <TouchableOpacity style={[styles.primaryButton, isNextDisabled && styles.primaryButtonDisabled]} onPress={handleNext}
            disabled={isNextDisabled} activeOpacity={0.9}
          >
            {saving ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={[styles.primaryButtonText, isNextDisabled && styles.primaryButtonTextDisabled]}>
                {currentQuestionIndex === questions.length - 1 ? '分析を完了する' : '次へ進む'}
              </Text>
            )}
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </View>
  )
}


const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background, },
  headerBackground: {
    position: 'absolute', top: 0, left: 0, right: 0, height: 320, borderBottomLeftRadius: 40, borderBottomRightRadius: 40,
    overflow: 'hidden', backgroundColor: COLORS.primary,
  },
  headerBackgroundImage: { ...StyleSheet.absoluteFillObject, width: '100%', height: '100%', opacity: 0.8, },
  introContainer: { flex: 1, alignItems: 'center', paddingTop: 10, paddingHorizontal: 24, },
  introTitle: {
    fontSize: 28, fontWeight: '900', color: '#FFFFFF', marginBottom: 12, textShadowColor: 'rgba(0,0,0,0.4)',
    textShadowOffset: { width: 0, height: 2 }, textShadowRadius: 6, textAlign: 'center',
  },
  introSubTitle: {
    fontSize: 15, color: '#FFFFFF', textAlign: 'center', marginBottom: 30, lineHeight: 24, fontWeight: '700',
    textShadowColor: 'rgba(0,0,0,0.3)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 4,
  },
  inrtoCard: {
    width: '100%', backgroundColor: COLORS.surface, borderRadius: 24, padding: 24, marginBottom: 40,
    shadowColor: COLORS.primary, shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.1, shadowRadius: 20, elevation: 8,
  },
  introFeatureItem: { flexDirection: 'row', alignItems: 'center', marginBottom: 20, },
  iconCircle: {
    width: 48, height: 48, borderRadius: 24, backgroundColor: COLORS.primaryLight, justifyContent: 'center', alignItems: 'center',
    marginRight: 16,
  },
  introFeatureTextConteiner: { flex: 1, },
  introFeatureTitle: { color: COLORS.textMain, fontSize: 15, fontWeight: 'bold', marginBottom: 4, },
  topSection: { alignItems: 'center', paddingTop: Platform.OS === 'android' ? 10 : 0, paddingHorizontal: 16, marginBottom: 8, },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', width: '100%', marginBottom: 5, },
  backButton: {
    width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(0,0,0,0.15)', justifyContent: 'center', alignItems: 'center',
  },
  headerTitleRow: { flexDirection: 'row', alignItems: 'center', },
  headerTitle: { fontSize: 18, fontWeight: 'bold', color: '#FFFFFF', marginRight: 7 },
  progressContainer: { width: '80%', height: 6, backgroundColor: 'rgba(255,255,255,0.3)', borderRadius: 3, marginBottom: 5, },
  progressBar: { height: '100%', backgroundColor: '#FFFFFF', borderRadius: 3, },
  stepText: { fontSize: 12, color: '#FFFFFF', fontWeight: 'bold', letterSpacing: 1, },
  cardContainer: {
    flex: 1, backgroundColor: COLORS.surface, marginHorizontal: 16, borderRadius: 28, shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.1, shadowRadius: 20, elevation: 10, overflow: 'hidden', marginBottom: 16,
  },
  cardContent: { paddingHorizontal: 24, paddingVertical: 30, alignItems: 'center', flexGrow: 1, },
  imageQuestionContainer: {
    width: '100%', height: 180, borderRadius: 20, marginBottom: 24, backgroundColor: '#E2E8F0', overflow: 'hidden',
    shadowColor: COLORS.primary, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.15, shadowRadius: 10, elevation: 4,
  },
  fullQuestionImage: { width: '100%', height: '100%' },
  imageOverlay: { ...StyleSheet.absoluteFillObject, borderWidth: 1, borderColor: 'rgba(255,255,255,0.4)', borderRadius: 20, },
  questionText: { fontSize: 18, fontWeight: 'bold', color: COLORS.textMain, textAlign: 'center', marginBottom: 30, lineHeight: 28, },
  optionsContainer: { width: '100%', gap: 12, },
  optionButton: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: COLORS.surface,
    paddingVertical: 16, paddingHorizontal: 20, borderRadius: 16, borderWidth: 2, borderColor: COLORS.border, marginBottom: 12,
  },
  optionButtonSelected: { borderColor: COLORS.primary, backgroundColor: COLORS.primaryLight, },
  optionText: { fontSize: 15, color: COLORS.textMain, fontWeight: '600', flex: 1, paddingRight: 8, },
  optionTextSelected: { color: COLORS.primary, fontWeight: 'bold', },
  radioCircle: { width: 24, height: 24, borderRadius: 12, borderWidth: 2, borderColor: '#CBD5E1', },
  footer: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    paddingHorizontal: 20, paddingBottom: Platform.OS === 'ios' ? 0 : 10,
  },
  secondaryButton: {
    paddingVertical: 16, paddingHorizontal: 20, borderRadius: 30, backgroundColor: COLORS.surface, borderWidth: 2,
    borderColor: COLORS.primary, justifyContent: 'center', alignItems: 'center', marginRight: 12,
  },
  secondaryButtonDisabled: { borderColor: '#E2E8F0', backgroundColor: '#F8FAFC', },
  secondaryButtonText: { color: COLORS.primary, fontSize: 14, fontWeight: 'bold', },
  secondaryButtonTextDisabled: { color: '#CBD5E1', },
  primaryButton: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.primary,
    paddingVertical: 16, paddingHorizontal: 40, borderRadius: 30, width: '100%', shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 5,
  },
  primaryButtonText: { color: '#FFFFFF', fontSize: 16, fontWeight: 'bold', letterSpacing: 0.5, },
  primaryButtonDisabled: { backgroundColor: COLORS.primaryLight, shadowOpacity: 0, elevation: 0 },
  primaryButtonTextDisabled: { color: '#93C5FD', },
});