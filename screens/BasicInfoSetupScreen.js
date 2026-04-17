import React, { useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, TextInput, ScrollView, Alert, ActivityIndicator, Dimensions
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { getAuth } from '@react-native-firebase/auth';
import { getFirestore, doc, Timestamp, serverTimestamp, writeBatch } from '@react-native-firebase/firestore';
import { StatusBar } from 'expo-status-bar';

const { width } = Dimensions.get('window');

const COLORS = {
  primary: '#3B82F6', primaryLight: '#EFF6FF', background: '#F5F8FF', surface: '#FFFFFF',
  textMain: '#1E293B', textSub: '#64748B', border: '#E2E8F0',
};

const PREFECTURES = [
  '北海道', '青森県', '岩手県', '宮城県', '秋田県', '山形県', '福島県',
  '茨城県', '栃木県', '群馬県', '埼玉県', '千葉県', '東京都', '神奈川県',
  '新潟県', '富山県', '石川県', '福井県', '山梨県', '長野県', '岐阜県',
  '静岡県', '愛知県', '三重県', '滋賀県', '京都府', '大阪府', '兵庫県',
  '奈良県', '和歌山県', '鳥取県', '島根県', '岡山県', '広島県', '山口県',
  '徳島県', '香川県', '愛媛県', '高知県', '福岡県', '佐賀県', '長崎県',
  '熊本県', '大分県', '宮崎県', '鹿児島県', '沖縄県'
];

const HeaderBackground = () => (
  <LinearGradient
    start={{ x: 0, y: 0 }}
    end={{ x: 1, y: 1 }}
    colors={['#A7F3E8', '#3B82F6']}
    style={styles.headerBackground}
  >
    <View style={styles.decorativeCircle1} />
    <View style={styles.decorativeCircle2} />
  </LinearGradient>
);

const IntroductionView = ({ onStart }) => (
  <View style={styles.introContainer}>
    <View style={styles.introIconContainer}>
      <Ionicons name="person-circle-outline" size={68} color="#FFFFFF" />
    </View>
    <Text style={styles.introTitle}>基本情報の登録</Text>
    <Text style={styles.introSubtitle}>
      より良いマッチングのために、{'\n'}
      あなたの事を少しだけ教えてください。
    </Text>

    <View style={styles.introIconContainer2} />

    <View style={styles.introStepsContainer}>
      <View style={styles.introStepItem}>
        <Ionicons name="checkmark-circle" size={20} color="#A7F3E8" />
        <Text style={styles.introStepText}>性別・居住地</Text>
      </View>
      <View style={styles.introStepItem}>
        <Ionicons name="checkmark-circle" size={20} color="#A7F3E8" />
        <Text style={styles.introStepText}>生年月日（非公開）</Text>
      </View>
      <View style={styles.introStepItem}>
        <Ionicons name="checkmark-circle" size={20} color="#A7F3E8" />
        <Text style={styles.introStepText}>ニックネーム</Text>
      </View>
    </View>
    <TouchableOpacity style={styles.introButton} onPress={onStart}>
      {/* [EDIT] 文字色を新しいプライマリカラーに */}
      <Text style={styles.introButtonText}>はじめる</Text>
      <Ionicons name="arrow-forward" size={20} color={COLORS.primary} />
    </TouchableOpacity>
  </View>
);

const StepHeader = ({ current, total }) => (
  <View style={styles.headerContainer}>
    <View style={styles.progressBarBackground}>
      <View style={[styles.progressBarFill, { width: `${(current / total) * 100}%` }]} />
    </View>
    <Text style={styles.stepIndicator}>STEP {current} / {total}</Text>
  </View>
);

const Step1_Gender = ({ gender, setGender }) => (
  <View style={styles.cardContent}>
    <View style={styles.titleArea}>
      <Text style={styles.mainTitle}>性別を教えてください</Text>
      <View style={styles.badgeContainer}>
        <Ionicons name="alert-circle-outline" size={14} color="#FF6B6B" />
        <Text style={styles.warningText}>後から変更できません</Text>
      </View>
    </View>

    <View style={styles.gridContainer}>
      {[
        { id: 'male', label: '男性', icon: 'man' },
        { id: 'female', label: '女性', icon: 'woman' },
      ].map((item) => {
        const isSelected = gender === item.id;
        return (
          <TouchableOpacity
            key={item.id}
            style={[styles.cleanCard, isSelected && styles.cleanCardSelected]}
            onPress={() => setGender(item.id)}
            activeOpacity={0.9}
          >
            <View style={[styles.iconCircle, isSelected && styles.iconCircleSelected]}>
              {/* [EDIT] 選択されていない時の色を新プライマリカラーに */}
              <Ionicons
                name={item.icon}
                size={32}
                color={isSelected ? '#FFF' : COLORS.primary}
              />
            </View>
            <Text style={[styles.cleanCardText, isSelected && styles.cleanCardTextSelected]}>
              {item.label}
            </Text>
            {isSelected && (
              <View style={styles.checkMark}>
                <Ionicons name="checkmark-circle" size={24} color={COLORS.primary} />
              </View>
            )}
          </TouchableOpacity>
        );
      })}
    </View>
  </View>
);

const Step2_Location = ({ location, setLocation }) => (
  <View style={styles.stepContent}>
    <View style={styles.titleArea}>
      <Text style={styles.mainTitle}>お住まいはどちらですか？</Text>
      <View style={styles.badgeContainer}>
        <Ionicons name="location-outline" size={14} color={COLORS.textSub} />
        <Text style={styles.infoText}>マッチングの参考にされます</Text>
      </View>
    </View>

    <View style={styles.pickerContainer}>
      <ScrollView style={styles.pickerScroll} nestedScrollEnabled={true}>
        {PREFECTURES.map((pref) => (
          <TouchableOpacity
            key={pref}
            style={[styles.pickerItem, location === pref && styles.pickerItemSelected]}
            onPress={() => setLocation(pref)}
          >
            <Text style={[styles.pickerText, location === pref && styles.pickerTextSelected]}>
              {pref}
            </Text>
            {/* [EDIT] チェックマークを新プライマリカラーに */}
            {location === pref && <Ionicons name="checkmark-circle" size={24} color={COLORS.primary} />}
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  </View>
);

const Step3_Birthdate = ({
  birthYear, setBirthYear,
  birthMonth, setBirthMonth,
  birthDay, setBirthDay
}) => (
  <View style={styles.cardContent}>
    <View style={styles.titleArea}>
      <Text style={styles.mainTitle}>生年月日を入力</Text>
      <Text style={styles.subTitle}>年齢確認のため使用されます。{"\n"}他ユーザーには年齢のみ表示されます。</Text>
      <View style={styles.badgeContainer}>
        <Ionicons name="alert-circle-outline" size={14} color="#FF6B6B" />
        <Text style={styles.warningText}>後から変更できません</Text>
      </View>
    </View>

    <View style={styles.dateInputs}>
      <View style={styles.dateField}>
        <Text style={styles.dateLabel}>年</Text>
        <TextInput
          style={styles.cleanInput}
          placeholder="2000"
          placeholderTextColor="#CCC"
          keyboardType="number-pad"
          maxLength={4}
          value={birthYear}
          onChangeText={setBirthYear}
        />
      </View>
      <View style={styles.dateField}>
        <Text style={styles.dateLabel}>月</Text>
        <TextInput
          style={styles.cleanInput}
          placeholder="01"
          placeholderTextColor="#CCC"
          keyboardType="number-pad"
          maxLength={2}
          value={birthMonth}
          onChangeText={setBirthMonth}
        />
      </View>
      <View style={styles.dateField}>
        <Text style={styles.dateLabel}>日</Text>
        <TextInput
          style={styles.cleanInput}
          placeholder="01"
          placeholderTextColor="#CCC"
          keyboardType="number-pad"
          maxLength={2}
          value={birthDay}
          onChangeText={setBirthDay}
        />
      </View>
    </View>
  </View>
);

const Step4_DisplayName = ({ displayName, setDisplayName }) => (
  <View style={styles.cardContent}>
    <View style={styles.titleArea}>
      <Text style={styles.mainTitle}>表示名を設定</Text>
      <Text style={styles.subTitle}>アプリ内で表示されるニックネームです。</Text>
    </View>

    <View style={styles.inputWrapper}>
      <TextInput
        style={[styles.cleanInput, { textAlign: 'left', paddingLeft: 20 }]}
        placeholderTextColor="#CCC"
        value={displayName}
        onChangeText={setDisplayName}
        autoFocus={false}
      />
      <Text style={styles.inputHint}>20文字以内</Text>
    </View>
  </View>
);

export default function BasicInfoSetupScreen({ navigation, route }) {
  const onCompleted = route.params?.onCompleted;
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [gender, setGender] = useState(null);
  const [location, setLocation] = useState('');
  const [birthYear, setBirthYear] = useState('');
  const [birthMonth, setBirthMonth] = useState('');
  const [birthDay, setBirthDay] = useState('');
  const [displayName, setDisplayName] = useState('');

  const handleComplete = async () => {
    if (!displayName.trim()) {
      Alert.alert('確認', '表示名を入力してください');
      return;
    }
    setLoading(true);
    try {
      const auth = getAuth();
      const user = auth.currentUser;
      if (!user) throw new Error('No user found');

      const year = parseInt(birthYear);
      const month = parseInt(birthMonth) - 1;
      const day = parseInt(birthDay);
      const birthDate = new Date(year, month, day);

      if (isNaN(birthDate.getTime()) || birthDate.getFullYear() !== year || birthDate.getMonth() !== month || birthDate.getDate() !== day) {
        throw new Error('Invalid Date');
      }

      const db = getFirestore();
      const batch = writeBatch(db);

      const userRef = doc(db, 'users', user.uid);
      const userPrivateRef = doc(db, 'users', user.uid, 'private', 'settings');

      batch.set(userRef, {
        gender,
        location,
        birthDate: Timestamp.fromDate(birthDate),
        displayName,
        updatedAt: serverTimestamp(),
      }, { merge: true });

      batch.set(userPrivateRef, {
        isBasicInfoCompleted: true,
      }, { merge: true });

      await batch.commit();

      await user.getIdToken(true);

      if (onCompleted) {
        onCompleted();
      } else {
        navigation.navigate('SenseProfiling');
      }

    } catch (error) {
      console.error('Save Error:', error);
      Alert.alert('エラー', '保存に失敗しました。正しい情報を入力してください。');
    } finally {
      setLoading(false);
    }
  };

  const nextStep = () => {
    if (step === 0) {
      setStep(1);
      return;
    }
    if (step === 1 && !gender) {
      Alert.alert('確認', '性別を選択してください');
      return;
    }
    if (step === 2 && !location) {
      Alert.alert('確認', 'お住まいを選択してください');
      return;
    }
    if (step === 3) {
      if (!birthYear || !birthMonth || !birthDay) {
        Alert.alert('確認', '生年月日を入力してください');
        return;
      }
      const currentYear = new Date().getFullYear();
      if (parseInt(birthYear) < 1900 || parseInt(birthYear) > currentYear) {
        Alert.alert('エラー', '正しい年を入力してください');
        return;
      }

      const yearNum = parseInt(birthYear, 10);
      const monthNum = parseInt(birthMonth, 10) - 1;
      const dayNum = parseInt(birthDay, 10);
      const birthDateObj = new Date(yearNum, monthNum, dayNum);
      const today = new Date();

      let age = today.getFullYear() - birthDateObj.getFullYear();
      const m = today.getMonth() - birthDateObj.getMonth();
      if (m < 0 || (m === 0 && today.getDate() < birthDateObj.getDate())) {
        age--;
      }

      if (age < 18) {
        Alert.alert('確認', '18歳未満の方はご利用頂けません。');
        return;
      }
    }

    if (step < 4) {
      setStep(step + 1);
    } else {
      handleComplete();
    }
  };

  const prevStep = () => {
    if (step > 0) setStep(step - 1);
  };

  return (
    <View style={styles.container}>
      <StatusBar style="light" />

      <HeaderBackground />

      <SafeAreaView style={{ flex: 1 }} edges={['top', 'bottom']}>
        {step === 0 ? (
          <IntroductionView onStart={nextStep} />
        ) : (
          <>
            <View style={styles.topBar}>
              <TouchableOpacity onPress={prevStep} style={styles.navButton}>
                <Ionicons name="chevron-back" size={28} color="#FFFFFF" />
              </TouchableOpacity>
              <Text style={styles.navTitle}>基本情報</Text>
              <View style={styles.navButton} />
            </View>

            <StepHeader current={step} total={4} />

            <View style={styles.cardContainer}>
              <ScrollView contentContainerStyle={{ flexGrow: 1 }}>
                {step === 1 && <Step1_Gender gender={gender} setGender={setGender} />}
                {step === 2 && <Step2_Location location={location} setLocation={setLocation} />}
                {step === 3 && (
                  <Step3_Birthdate
                    birthYear={birthYear} setBirthYear={setBirthYear}
                    birthMonth={birthMonth} setBirthMonth={setBirthMonth}
                    birthDay={birthDay} setBirthDay={setBirthDay}
                  />
                )}
                {step === 4 && <Step4_DisplayName displayName={displayName} setDisplayName={setDisplayName} />}
              </ScrollView>
            </View>

            <View style={styles.footer}>
              <TouchableOpacity
                style={[
                  styles.primaryButton,
                  (step === 1 && !gender) ||
                    (step === 2 && !location) ||
                    (step === 3 && (!birthYear || !birthMonth || !birthDay)) ||
                    (step === 4 && !displayName)
                    ? styles.disabledButton : {}
                ]}
                onPress={nextStep}
                disabled={loading}
              >
                {loading ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <Text style={[
                    styles.primaryButtonText,
                    ((step === 1 && !gender) || (step === 2 && !location) || (step === 3 && (!birthYear || !birthMonth || !birthDay)) || (step === 4 && !displayName))
                    && styles.disabledButtonText
                  ]}>
                    {step === 4 ? '完了して次へ' : '次へ進む'}
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          </>
        )}
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background, },

  headerBackground: {
    position: 'absolute', top: 0, left: 0, right: 0, height: 290, borderBottomLeftRadius: 40,
    borderBottomRightRadius: 40, overflow: 'hidden',
  },
  decorativeCircle1: {
    position: 'absolute', top: -20, right: -20, width: 192, height: 192, borderRadius: 96, backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  decorativeCircle2: {
    position: 'absolute', top: 128, left: -40, width: 128, height: 128, borderRadius: 64, backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },

  introContainer: { flex: 1, alignItems: 'center', paddingTop: 20, paddingHorizontal: 30, },
  introIconContainer: {
    marginBottom: 15, shadowColor: "#000", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 5,
  },
  introIconContainer2: {
    marginBottom: 115, shadowColor: "#000", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 5,
  },
  introTitle: {
    fontSize: 26, fontWeight: '900', color: '#FFFFFF', marginBottom: 10, textShadowColor: 'rgba(0, 0, 0, 0.1)',
    textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 3,
  },
  introSubtitle: {
    fontSize: 15, color: '#DBEAFE', textAlign: 'center', marginBottom: 30, lineHeight: 22, fontWeight: '600',
  },
  introStepsContainer: {
    width: '100%', backgroundColor: COLORS.surface, borderRadius: 24, padding: 24, marginBottom: 40, shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.1, shadowRadius: 20, elevation: 8,
  },
  introStepItem: { flexDirection: 'row', alignItems: 'center', marginBottom: 14, },
  introStepText: { color: COLORS.textMain, fontSize: 16, marginLeft: 10, fontWeight: 'bold', },
  introButton: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFFFFF', paddingVertical: 16, paddingHorizontal: 40,
    borderRadius: 30, shadowColor: "#000", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.15, shadowRadius: 8, elevation: 5,
  },
  introButtonText: { color: COLORS.primary, fontSize: 18, fontWeight: 'bold', marginRight: 8, },
  topBar: { height: 50, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 15, },
  navButton: { width: 40, height: 40, justifyContent: 'center', alignItems: 'center', },
  navTitle: { fontSize: 18, color: '#FFFFFF', fontWeight: 'bold', },
  headerContainer: { paddingHorizontal: 24, marginVertical: 15, },
  progressBarBackground: { height: 6, backgroundColor: 'rgba(255, 255, 255, 0.3)', borderRadius: 3, marginBottom: 8, },
  progressBarFill: { height: '100%', backgroundColor: '#FFFFFF', borderRadius: 3, },
  stepIndicator: { fontSize: 12, color: '#FFFFFF', fontWeight: 'bold', textAlign: 'right', opacity: 0.9, },

  cardContainer: {
    flex: 1, backgroundColor: COLORS.surface, marginHorizontal: 16, borderRadius: 28, paddingVertical: 10, shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.1, shadowRadius: 20, elevation: 10, overflow: 'hidden',
  },
  stepContent: { flex: 1, paddingHorizontal: 24, paddingTop: 20, paddingBottom: 20, },
  cardContent: { flex: 1, paddingHorizontal: 24, paddingTop: 20, paddingBottom: 20, },
  titleArea: { marginBottom: 25, },
  mainTitle: { fontSize: 22, fontWeight: 'bold', color: COLORS.textMain, marginBottom: 8, textAlign: 'center', },
  subTitle: {
    fontSize: 14, color: COLORS.textSub, lineHeight: 22, marginBottom: 10, alignSelf: 'center', fontWeight: '500', textAlign: 'center',
  },
  badgeContainer: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.background, paddingVertical: 6,
    paddingHorizontal: 12, borderRadius: 8, borderWidth: 1, borderColor: COLORS.border, alignSelf: 'center',
  },
  warningText: { fontSize: 12, color: '#FF6B6B', marginLeft: 6, fontWeight: 'bold', textAlign: 'center', },
  infoText: { fontSize: 12, color: COLORS.textSub, marginLeft: 6, fontWeight: 'bold', },

  gridContainer: { flexDirection: 'column', gap: 12, },
  cleanCard: {
    width: '100%', alignSelf: 'center', flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.surface,
    borderRadius: 16, padding: 16, borderWidth: 2, borderColor: COLORS.border, marginBottom: 12,
  },
  cleanCardSelected: { borderColor: COLORS.primary, backgroundColor: COLORS.primaryLight, },
  iconCircle: {
    width: 48, height: 48, borderRadius: 24, backgroundColor: COLORS.background, justifyContent: 'center',
    alignItems: 'center', marginRight: 16,
  },
  iconCircleSelected: { backgroundColor: COLORS.primary, },
  cleanCardText: { fontSize: 16, fontWeight: 'bold', color: COLORS.textMain, flex: 1, },
  cleanCardTextSelected: { color: COLORS.primary, },
  checkMark: { marginLeft: 10, },
  pickerContainer: {
    flex: 1, backgroundColor: '#FAFAFA', borderRadius: 16, borderWidth: 1, borderColor: COLORS.border, maxHeight: 400,
    overflow: 'hidden',
  },
  pickerScroll: { flex: 1, },
  pickerItem: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 16, paddingHorizontal: 20,
    borderBottomWidth: 1, borderBottomColor: COLORS.border,
  },
  pickerItemSelected: { backgroundColor: COLORS.primaryLight, },
  pickerText: { fontSize: 16, color: COLORS.textMain, fontWeight: '500', },
  pickerTextSelected: { color: COLORS.primary, fontWeight: 'bold', },
  dateInputs: {
    flexDirection: 'row', justifyContent: 'space-between', width: '100%', alignSelf: 'center', marginTop: 10,
  },
  dateField: { width: '31%', alignItems: 'center', },
  dateLabel: { fontSize: 12, color: COLORS.textSub, marginBottom: 8, fontWeight: 'bold', letterSpacing: 1, },
  cleanInput: {
    width: '100%', height: 56, backgroundColor: '#FAFAFA', borderRadius: 12, borderWidth: 1, borderColor: COLORS.border,
    textAlign: 'center', fontSize: 20, fontWeight: 'bold', color: COLORS.textMain,
  },
  inputWrapper: { marginTop: 10, width: '100%', alignSelf: 'center', },
  inputHint: { fontSize: 12, color: COLORS.textSub, marginTop: 8, textAlign: 'right', fontWeight: 'bold', },
  footer: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 24, },
  primaryButton: {
    width: '100%', backgroundColor: COLORS.primary, paddingVertical: 16, borderRadius: 16, alignItems: 'center',
    justifyContent: 'center', shadowColor: COLORS.primary, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3,
    shadowRadius: 8, elevation: 4,
  },
  disabledButton: { backgroundColor: COLORS.primaryLight, shadowOpacity: 0, elevation: 0, },
  primaryButtonText: { color: '#FFFFFF', fontSize: 15, fontWeight: 'bold', letterSpacing: 0.5, },
  disabledButtonText: { color: '#93C5FD', },
});