import React, { useState, useEffect } from 'react';
import {
  Text, View, TouchableOpacity, Alert, ActivityIndicator, StyleSheet, Dimensions, Platform,
  ScrollView, KeyboardAvoidingView, Linking, StatusBar
} from 'react-native';
import auth from '@react-native-firebase/auth';
import LinearGradient from 'react-native-linear-gradient';
import { RouteProp } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';

type RootStackParamList = {
  VerifyEmail: { email?: string };
  Login: undefined;
};

type VerifyEmailScreenRouteProp = RouteProp<RootStackParamList, 'VerifyEmail'>;
type VerifyEmailScreenNavigationProp = StackNavigationProp<RootStackParamList, 'VerifyEmail'>;

interface Props {
  route: VerifyEmailScreenRouteProp;
  navigation: VerifyEmailScreenNavigationProp;
}

const { width } = Dimensions.get('window');

const COLORS = {
  primary: '#3B82F6', primaryLight: '#EFF6FF', background: '#F5F8FF', surface: '#FFFFFF',
  textMain: '#1E293B', textSub: '#64748B', border: '#E2E8F0',
};

const actionCodeSettings = {
  url: 'https://synapse-8f371.firebaseapp.com/verified',
  handleCodeInApp: true,
  iOS: {
    bundleId: 'com.synapse.app',
  },
  android: {
    packageName: 'com.synapse.app',
    installApp: false,
    minimumVersion: '12'
  },
};

export default function VerifyEmailScreen({ route, navigation }: Props) {
  const email = route.params?.email || auth().currentUser?.email;
  const [loading, setLoading] = useState<boolean>(false);

  useEffect(() => {
    const handleDeepLink = async (event: { url: string }) => {
      const rawUrl = event.url;
      if (!rawUrl) return;

      const url = decodeURIComponent(rawUrl);
      console.log(url);

      if (url.includes('verified')) {
        setLoading(true);
        try {
          const modeMatch = url.match(/[?&]mode=([^&]+)/);
          const oobCodeMatch = url.match(/[?&]oobCode=([^&]+)/);
          console.log(oobCodeMatch);

          if (modeMatch && modeMatch[1] === 'verifyEmail' && oobCodeMatch) {
            await auth().applyActionCode(oobCodeMatch[1]);
          }

          const user = auth().currentUser;
          if (user) {
            await user.reload();
            if (user.emailVerified) {
              console.log("ディープリンクからの認証が完了しました！");
              await user.getIdToken(true);
            }
          }
        } catch (error) {
          console.error('リンクからの認証エラー:', error);
          Alert.alert("エラー", "認証リンクが無効か、既に使用されています。");
        } finally {
          setLoading(false);
        }
      }
    };

    const linkingSubscription = Linking.addEventListener('url', handleDeepLink);

    Linking.getInitialURL().then((url) => {
      if (url) handleDeepLink({ url: url });
    });

    return () => {
      linkingSubscription.remove();
    };
  }, []);

  const handleResendVerification = async () => {
    setLoading(true);
    try {
      const user = auth().currentUser;
      if (user) {
        await user.sendEmailVerification(actionCodeSettings);
        Alert.alert("送信完了", "認証メールを再送信しました。");
      } else {
        Alert.alert("エラー", "ユーザーが見つかりません。ログインし直してください。");
        navigation.navigate('Login');
      }
    } catch (error) {
      console.error('メール再送信エラー:', error);
      Alert.alert("エラー", "再送信に失敗しました。時間をおいて試してください。");
    }
    setLoading(false);
  };

  const handleCheckVerification = async () => {
    setLoading(true);
    try {
      let user = auth().currentUser;
      if (user) {
        await user.reload();
        user = auth().currentUser;

        if (user?.emailVerified) {
          console.log("認証確認完了！");
          await user.getIdToken(true);
        } else {
          Alert.alert("未完了", "まだ認証が完了していません。\nメール内のリンクをクリックしましたか？");
        }
      }
    } catch (error) {
      console.error('確認エラー:', error);
      Alert.alert("エラー", "確認中にエラーが発生しました。");
    }
    setLoading(false);
  };

  const handleGoBackToLogin = async () => {
    try {
      if (auth().currentUser) {
        await auth().signOut();
      }
    } catch (error) {
      console.log('ログアウト処理エラー:', error);
    } finally {
      navigation.reset({
        index: 0,
        routes: [{ name: 'Login' }],
      });
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

          {/* タイトルセクション */}
          <View style={styles.headerTextContainer}>
            <Text style={styles.logo}>SENSE MATCH</Text>
            <Text style={styles.tagline}>メール認証</Text>
          </View>

          {/* メッセージボックス */}
          <View style={styles.card}>
            <Text style={styles.descriptionText}>
              確認用メールを送信しました。
            </Text>
            <Text style={styles.emailText}>
              {email || 'メールアドレス不明'}
            </Text>
            <View style={styles.divider} />
            <Text style={styles.instructionText}>
              メール内のURLをクリックした後、{'\n'}
              下のボタンを押してください。
            </Text>

            {/* メインアクション：認証完了 */}
            <TouchableOpacity
              style={styles.mainButton}
              onPress={handleCheckVerification}
              disabled={loading}
              activeOpacity={0.8}
            >
              {loading ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text style={styles.mainButtonText}>認証完了</Text>
              )}
            </TouchableOpacity>

            {/* サブアクション：再送信 */}
            <TouchableOpacity
              onPress={handleResendVerification}
              disabled={loading}
              style={styles.resendButton}
            >
              <Text style={styles.resendButtonText}>
                メールが届かない場合：再送信
              </Text>
            </TouchableOpacity>

            {/* サブアクション：ログイン画面へ戻る */}
            <TouchableOpacity
              onPress={handleGoBackToLogin}
              style={styles.logoutButton}
            >
              <Text style={styles.logoutButtonText}>
                別のメールアドレスを使う（ログイン画面へ戻る）
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
    backgroundColor: COLORS.surface, borderRadius: 28, padding: 24, width: '100%', maxWidth: 400, alignItems: 'center',
    shadowColor: COLORS.primary, shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.1, shadowRadius: 20, elevation: 8,
  },
  descriptionText: { fontSize: 14, fontWeight: 'bold', color: COLORS.textSub, marginBottom: 8, },
  emailText: { fontSize: 18, fontWeight: 'bold', color: COLORS.textMain, marginBottom: 20, },
  divider: { height: 1, width: '100%', backgroundColor: COLORS.border, marginBottom: 20, },
  instructionText: { fontSize: 14, color: COLORS.textSub, textAlign: 'center', lineHeight: 22, marginBottom: 24, },
  mainButton: {
    width: '100%', backgroundColor: COLORS.primary, paddingVertical: 16, borderRadius: 14, alignItems: 'center',
    justifyContent: 'center', marginBottom: 20, shadowColor: COLORS.primary, shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3, shadowRadius: 8, elevation: 4,
  },
  mainButtonText: { color: '#FFFFFF', fontSize: 15, fontWeight: 'bold', letterSpacing: 0.5, },
  resendButton: { padding: 10, marginBottom: 4, },
  resendButtonText: { color: COLORS.primary, fontSize: 13, fontWeight: 'bold', textDecorationLine: 'underline', },
  logoutButton: { padding: 10, },
  logoutButtonText: { color: COLORS.textSub, fontSize: 13, fontWeight: '600', },
});