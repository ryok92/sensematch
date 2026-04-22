import React, { useState } from 'react';
import {
  Text, View, TouchableOpacity, StyleSheet, ScrollView, Alert, ActivityIndicator, Linking, Platform, KeyboardAvoidingView, StatusBar,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import Ionicons from 'react-native-vector-icons/Ionicons';
import auth from '@react-native-firebase/auth'
import firestore from '@react-native-firebase/firestore';
import { RouteProp } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';

type RootStackParamList = {
  TermsAgreement: { onAgreed?: () => void };
}

type TermsAgreementScreenRouteProp = RouteProp<RootStackParamList, 'TermsAgreement'>;
type TermsAgreementScreenNavigationProp = StackNavigationProp<RootStackParamList, 'TermsAgreement'>;

type Props = {
  route: TermsAgreementScreenRouteProp;
  navigation: TermsAgreementScreenNavigationProp;
};

const COLORS = {
  primary: '#3B82F6', primaryLight: 'EFF6FF', background: '#F5F8FF', surface: '#FFFFFF', textMain: '#1E293B',
  textSub: '#64748B', border: '#E2E8F0',
};

export default function TermsAgreementScreen({ navigation, route }: Props) {
  const onAgreed = route.params?.onAgreed;
  const [isOver18, setIsOver18] = useState<boolean>(false);
  const [isAgreed, setIsAgreed] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(false);

  const openLink = (url: string) => {
    Linking.openURL(url).catch(err => console.error("URLを開けませんでした", err));
  };

  const handleRegister = async () => {
    if (!isOver18 || !isAgreed) {
      Alert.alert("確認", "全ての項目にチェックを入れてください。");
      return;
    }

    setLoading(true);
    try {
      const user = auth().currentUser;
      if (!user) {
        throw new Error("ユーザーが見つかりません");
      }

      const userRef = firestore().collection('users').doc(user.uid).collection('private').doc('settings');
      await userRef.set({
        isOver18: true,
        isTermsAgreed: true,
        agreedAt: firestore.FieldValue.serverTimestamp(),
        is2FAEnabled: false,
        isBasicInfoCompleted: false,
      }, { merge: true });

      await user.getIdToken(true);

      if (onAgreed) {
        onAgreed();
      }
    } catch (error) {
      console.error("登録エラー:", error);
      Alert.alert("エラー", "登録処理に失敗しました。もう一度お試し下さい。")
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    try {
      await auth().signOut();
    } catch (error) {
      console.error('ログアウトエラー:', error);
    }
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent={true} />

      <LinearGradient
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        colors={['#A7F3E8', '#3B82F6']}
        style={styles.headerBackground}
      >
        <View style={styles.decorativeCircle1} />
        <View style={styles.decorativeCircle2} />
      </LinearGradient>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>

          <View style={styles.headerTextContainer}>
            <Text style={styles.logo}>SENSE MATCH</Text>
            <Text style={styles.tagline}>利用登録と確認</Text>
          </View>

          <View style={styles.card}>
            <Text style={styles.description}>
              サービスの利用を開始するには、{'\n'}以下の確認事項への同意が必要です。
            </Text>

            <TouchableOpacity
              style={styles.checkboxContainer}
              activeOpacity={0.8}
              onPress={() => setIsOver18(!isOver18)}
            >
              <View style={[styles.checkbox, isOver18 && styles.checkedBox]}>
                {isOver18 && <Ionicons name="checkmark" size={16} color="#FFF" />}
              </View>

              <Text style={styles.checkboxLabel}>
                私は18歳以上です
              </Text>
            </TouchableOpacity>

            <View style={styles.divider} />

            <View style={styles.termsLinkContainer}>
              <View style={styles.linkRow}>
                <TouchableOpacity onPress={() => openLink('https://example.com/terms')}>
                  <Text style={styles.linkText}>利用規約</Text>
                </TouchableOpacity>

                <Text style={styles.linkDivider}> / </Text>

                <TouchableOpacity onPress={() => openLink('https://example.com/privacy')}>
                  <Text style={styles.linkText}>プライバシーポリシー</Text>
                </TouchableOpacity>
              </View>
              <Text style={styles.linkSuffix}>を確認しました</Text>
            </View>

            <TouchableOpacity
              style={styles.checkboxContainer}
              activeOpacity={0.8}
              onPress={() => setIsAgreed(!isAgreed)}
            >
              <View style={[styles.checkbox, isAgreed && styles.checkedBox]}>
                {isAgreed && <Ionicons name="checkmark" size={16} color="#FFF" />}
              </View>

              <Text style={styles.checkboxLabel}>
                上記の内容に同意します
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.mainButton, (!isOver18 || !isAgreed) && styles.disabledButton
              ]}
              onPress={handleRegister}
              disabled={loading || !isOver18 || !isAgreed}
              activeOpacity={0.8}
            >
              {loading ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text style={[styles.mainButtonText, (!isOver18 || !isAgreed) && styles.disabledButtonText]}>登録を完了して進む</Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              onPress={handleLogout}
              style={styles.logoutButton}
            >
              <Text style={styles.logoutButtonText}>
                中断する
              </Text>
            </TouchableOpacity>

          </View>
        </ScrollView>
      </KeyboardAvoidingView>
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
  scrollContent: {
    flexGrow: 1, paddingHorizontal: 24, paddingTop: Platform.OS === 'ios' ? 80 : 60, paddingBottom: 40, alignItems: 'center',
  },
  headerTextContainer: { alignItems: 'center', marginBottom: 32, },
  logo: { fontSize: 36, fontWeight: '900', color: '#FFFFFF', letterSpacing: -0.5, marginBottom: 8, },
  tagline: { fontSize: 14, color: '#DBEAFE', fontWeight: '600', letterSpacing: 1, },
  card: {
    backgroundColor: COLORS.surface, borderRadius: 28, padding: 24, width: '100%', maxWidth: 400,
    alignItems: 'center', shadowColor: COLORS.primary, shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.1,
    shadowRadius: 20, elevation: 8,
  },
  description: {
    fontSize: 15, fontWeight: 'bold', color: COLORS.textSub, marginBottom: 24, lineHeight: 24, textAlign: 'center',
  },
  checkboxContainer: { flexDirection: 'row', alignItems: 'center', width: '100%', marginBottom: 8, },
  checkbox: {
    width: 24, height: 24, borderRadius: 6, borderWidth: 2, borderColor: COLORS.primary, marginRight: 12,
    alignItems: 'center', justifyContent: 'center', backgroundColor: '#FFF',
  },
  checkedBox: { backgroundColor: COLORS.primary, },
  checkboxLabel: { fontSize: 15, fontWeight: '600', color: COLORS.textMain, flex: 1, },
  divider: { height: 1, width: '100%', backgroundColor: COLORS.border, marginVertical: 16, },
  termsLinkContainer: { width: '100%', alignItems: 'center', marginBottom: 24, },
  linkRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 4, },
  linkText: { fontSize: 13, fontWeight: '600', color: COLORS.primary, textDecorationLine: 'underline', },
  linkDivider: { fontSize: 13, color: COLORS.textSub, marginHorizontal: 8, },
  linkSuffix: { fontSize: 13, fontWeight: '600', color: COLORS.textSub, },
  mainButton: {
    width: '100%', backgroundColor: COLORS.primary, paddingVertical: 16, borderRadius: 14, alignItems: 'center',
    justifyContent: 'center', marginBottom: 16, marginTop: 8, shadowColor: COLORS.primary, shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3, shadowRadius: 8, elevation: 4,
  },
  disabledButton: { backgroundColor: COLORS.primaryLight, shadowOpacity: 0, elevation: 0, },
  mainButtonText: { color: '#FFFFFF', fontSize: 15, fontWeight: 'bold', letterSpacing: 0.5, },
  disabledButtonText: { color: '#93C5FD', },
  logoutButton: { padding: 10, },
  logoutButtonText: { color: COLORS.textSub, fontSize: 13, fontWeight: '600', }
});