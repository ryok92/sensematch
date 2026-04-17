import React, { useState, useEffect } from 'react';
import {
  Text, View, TouchableOpacity, TextInput, ScrollView, Platform, Alert, ActivityIndicator, KeyboardAvoidingView,
  StyleSheet, Dimensions, Image, StatusBar // 🌟RN CLI仕様変更: StatusBarをreact-nativeからインポート
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient'; // 🌟RN CLI仕様変更: react-native-linear-gradientに変更

import auth from '@react-native-firebase/auth';
import firestore from '@react-native-firebase/firestore';

import { GoogleSignin } from '@react-native-google-signin/google-signin';
// 🌟RN CLI仕様変更: @invertase/react-native-apple-authenticationに変更
import { appleAuth, AppleButton } from '@invertase/react-native-apple-authentication';
// 🌟RN CLI仕様変更: react-native-vector-iconsに変更
import Ionicons from 'react-native-vector-icons/Ionicons';
import zxcvbn from 'zxcvbn';

const { width } = Dimensions.get('window');

const COLORS = {
  primary: '#3B82F6',
  primaryLight: '#EFF6FF',
  background: '#F5F8FF',
  surface: '#FFFFFF',
  textMain: '#1E293B',
  textSub: '#64748B',
  accent: '#F59E0B',
  danger: '#EF4444',
  border: '#E2E8F0',
};

const actionCodeSettings = {
  url: 'https://synapse-8f371.firebaseapp.com/vreified',
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

export default function LoginScreen({ navigation }) {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const [passwordStrength, setPasswordStrength] = useState(0);
  const [strengthText, setStrengthText] = useState('');
  const [strengthColor, setStrengthColor] = useState(COLORS.border);

  const [passwordError, setPasswordError] = useState('');
  const [isPasswordValid, setIsPasswordValid] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    GoogleSignin.configure({
      webClientId: '862000804017-nrqnm49aujsl91j3dq7er9u9tcms8637.apps.googleusercontent.com',
    });
  }, []);

  useEffect(() => {
    if (!isLogin) {
      let isValid = true;
      let errorMessage = '';

      if (password.length < 8) {
        isValid = false;
        errorMessage += '・8文字以上必要です\n';
      }
      if (!/[0-9]/.test(password)) {
        isValid = false;
        errorMessage += '・数字を含める必要があります\n';
      }
      if (!/[a-z]/.test(password) || !/[A-Z]/.test(password)) {
        isValid = false;
        errorMessage += '・英字は大文字と小文字の両方が必要です\n';
      }

      setIsPasswordValid(isValid);
      setPasswordError(errorMessage.trim());
    } else {
      setIsPasswordValid(true);
      setPasswordError('');
    }

    if (password.length > 0 && !isLogin) {
      const { score } = zxcvbn(password);
      setPasswordStrength(score);
      switch (score) {
        case 0: case 1: setStrengthText('弱い'); setStrengthColor(COLORS.danger); break;
        case 2: case 3: setStrengthText('普通'); setStrengthColor(COLORS.accent); break;
        case 4: setStrengthText('強い'); setStrengthColor('#10B981'); break;
        default: setStrengthText(''); setStrengthColor(COLORS.border);
      }
    } else {
      setPasswordStrength(0); setStrengthText(''); setStrengthColor(COLORS.border);
    }
  }, [password, isLogin]);

  const createUserData = async (user, emailToSave = null) => {
    try {
      const userDoc = await firestore().collection('users').doc(user.uid).get();
      if (!userDoc.exists) {
        const data = {
          is2FAEnabled: false,
          isProfilingCompleted: false,
          isTermsAgreed: false,
          isBasicInfoCompleted: false,
          createdAt: firestore.FieldValue.serverTimestamp(),
        };
        if (emailToSave) {
          data.email = emailToSave;
        }
        await firestore().collection('users').doc(user.uid).set(data);
      }
    } catch (error) {
      console.error("ユーザーデータ作成エラー:", error);
    }
  };

  const handleGoogleSignIn = async () => {
    try {
      await GoogleSignin.hasPlayServices();
      const { idToken } = await GoogleSignin.signIn();
      const googleCredential = auth.GoogleAuthProvider.credential(idToken);
      const userCredential = await auth().signInWithCredential(googleCredential);
      await createUserData(userCredential.user, null);
      console.log('Google ログイン 成功');
    } catch (error) {
      console.error('Google SignIn エラー:', error);
      Alert.alert("Google認証エラー", error.message);
    }
  };

  const handleAppleSignIn = async () => {
    try {
      // 🌟RN CLI仕様変更: appleAuthモジュールを使った認証フローに変更
      const appleAuthRequestResponse = await appleAuth.performRequest({
        requestedOperation: appleAuth.Operation.LOGIN,
        requestedScopes: [appleAuth.Scope.EMAIL, appleAuth.Scope.FULL_NAME],
      });

      const { identityToken, nonce } = appleAuthRequestResponse;

      if (!identityToken) {
        throw new Error('Apple Auth Error - no identity token returned');
      }

      const appleCredential = auth.AppleAuthProvider.credential(
        identityToken,
        nonce
      );

      const userCredential = await auth().signInWithCredential(appleCredential);
      await createUserData(userCredential.user, null);
      console.log('Apple ログイン 成功');
    } catch (error) {
      // 🌟RN CLI仕様変更: エラーコードの判定をappleAuth.Error.CANCELEDに変更
      if (error.code !== appleAuth.Error.CANCELED) {
        console.error('Apple SignIn エラー:', error);
        Alert.alert("Apple認証エラー", error.message || "認証に失敗しました。");
      }
    }
  };

  const handleMainButtonPress = async () => {
    if (email === '' || password === '') {
      Alert.alert("エラー", "メールアドレスとパスワードを入力してください。");
      return;
    }
    setLoading(true);

    if (isLogin) {
      try {
        const userCredential = await auth().signInWithEmailAndPassword(email, password);
        console.log('Eメール ログイン 成功');
        if (!userCredential.user.emailVerified) {
          // 未認証時の処理
        }
      } catch (error) {
        Alert.alert("ログインエラー", "メールアドレスまたはパスワードが正しくありません。");
      }
    } else {
      try {
        const userCredential = await auth().createUserWithEmailAndPassword(email, password);
        await userCredential.user.sendEmailVerification(actionCodeSettings);
        navigation.navigate('VerifyEmail', { email: email });
      } catch (error) {
        if (error.code === 'auth/email-already-in-use') {
          Alert.alert(
            "確認",
            "すでに登録手続き中のメールアドレスです。\n登録処理を再開しますか？",
            [
              { text: "いいえ", style: "cancel" },
              {
                text: "はい",
                onPress: async () => {
                  setLoading(true);
                  try {
                    await auth().signInWithEmailAndPassword(email, password);
                  } catch (signInError) {
                    setLoading(false);
                    Alert.alert("エラー", "パスワードが正しくないか、ログインできませんでした。\nログイン画面からお試し下さい。");
                  }
                }
              }
            ]
          );
        } else {
          Alert.alert("エラー", "新規登録に失敗しました。" + error.message);
        }
      }
    }
    setLoading(false);
  };

  return (
    <View style={localStyles.container}>
      {/* 🌟RN CLI仕様変更: react-nativeのStatusBarコンポーネントのPropsに合わせて変更 */}
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent={true} />

      {/* 🌟RN CLI仕様変更: import元が変わったが、プロパティの使い方はほぼ同じ */}
      <LinearGradient
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        colors={['#A7F3E8', '#3B82F6']}
        style={localStyles.headerBackground}
      >
        <View style={localStyles.decorativeCircle1} />
        <View style={localStyles.decorativeCircle2} />
      </LinearGradient>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        <ScrollView contentContainerStyle={localStyles.scrollContent} showsVerticalScrollIndicator={false}>

          <View style={localStyles.headerTextContainer}>
            <Text style={localStyles.logo}>Sense Match</Text>
            <Text style={localStyles.tagline}>"感性"でつながる、新しい出会い</Text>
          </View>

          <View style={localStyles.card}>

            <View style={localStyles.toggleContainer}>
              <TouchableOpacity
                style={isLogin ? localStyles.activeToggle : localStyles.inactiveToggle}
                onPress={() => setIsLogin(true)}
                activeOpacity={0.8}
              >
                <Text style={isLogin ? localStyles.activeToggleText : localStyles.inactiveToggleText}>
                  ログイン
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={!isLogin ? localStyles.activeToggle : localStyles.inactiveToggle}
                onPress={() => setIsLogin(false)}
                activeOpacity={0.8}
              >
                <Text style={!isLogin ? localStyles.activeToggleText : localStyles.inactiveToggleText}>
                  新規登録
                </Text>
              </TouchableOpacity>
            </View>

            <View style={localStyles.inputGroup}>
              <Text style={localStyles.inputLabel}>メールアドレス</Text>
              <TextInput
                style={localStyles.input}
                placeholder="example@sense-match.com"
                placeholderTextColor={COLORS.textSub}
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
              />
            </View>

            <View style={localStyles.inputGroup}>
              <Text style={localStyles.inputLabel}>パスワード</Text>
              <View style={localStyles.passwordContainer}>
                <TextInput
                  style={localStyles.inputPassword}
                  placeholder="8文字以上の英数字"
                  placeholderTextColor={COLORS.textSub}
                  value={password}
                  onChangeText={setPassword}
                  autoCapitalize="none"
                  secureTextEntry={!showPassword}
                />
                <TouchableOpacity onPress={() => setShowPassword(!showPassword)} style={localStyles.eyeIconContainer}>
                  {/* 🌟RN CLI仕様変更: react-native-vector-iconsを使用 */}
                  <Ionicons
                    name={showPassword ? "eye-off-outline" : "eye-outline"}
                    size={22}
                    color={COLORS.textSub}
                  />
                </TouchableOpacity>
              </View>
            </View>

            {!isLogin && passwordError !== '' && (
              <View style={localStyles.errorContainer}>
                <Ionicons name="information-circle" size={16} color={COLORS.danger} style={{ marginRight: 4 }} />
                <Text style={localStyles.errorText}>{passwordError}</Text>
              </View>
            )}

            {!isLogin && password.length > 0 && (
              <View style={localStyles.strengthIndicatorContainer}>
                <View style={localStyles.strengthHeader}>
                  <Text style={localStyles.strengthLabel}>セキュリティ強度</Text>
                  <Text style={[localStyles.strengthText, { color: strengthColor }]}>{strengthText}</Text>
                </View>
                <View style={localStyles.strengthBarBase}>
                  <View
                    style={[
                      localStyles.strengthBarFill,
                      { width: `${(passwordStrength + 1) * 20}%`, backgroundColor: strengthColor }
                    ]}
                  />
                </View>
              </View>
            )}

            <TouchableOpacity
              style={[
                localStyles.mainButton,
                (!isLogin && !isPasswordValid) && localStyles.mainButtonDisabled
              ]}
              onPress={handleMainButtonPress}
              disabled={loading || (!isLogin && !isPasswordValid)}
              activeOpacity={0.8}
            >
              {loading ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text style={localStyles.mainButtonText}>
                  {isLogin ? 'ログイン' : 'メールアドレスで登録'}
                </Text>
              )}
            </TouchableOpacity>

            {isLogin && (
              <TouchableOpacity style={localStyles.forgotPasswordContainer}>
                <Text style={localStyles.forgotPasswordText}>パスワードをお忘れですか？</Text>
              </TouchableOpacity>
            )}

            <View style={localStyles.dividerContainer}>
              <View style={localStyles.dividerLine} />
              <Text style={localStyles.dividerText}>または他のアカウントで続ける</Text>
              <View style={localStyles.dividerLine} />
            </View>

            <View style={localStyles.socialButtonsContainer}>
              <TouchableOpacity style={localStyles.googleButton} onPress={handleGoogleSignIn} activeOpacity={0.8}>
                <Image
                  source={{ uri: 'https://developers.google.com/identity/images/g-logo.png' }}
                  style={{ width: 20, height: 20, marginRight: 8 }}
                  resizeMode="contain"
                />
                <Text style={localStyles.googleButtonText}>Googleで続ける</Text>
              </TouchableOpacity>

              {/* 🌟RN CLI仕様変更: @invertase/react-native-apple-authenticationのAppleButtonに変更 */}
              {Platform.OS === 'ios' && appleAuth.isSupported && (
                <AppleButton
                  buttonStyle={AppleButton.Style.BLACK}
                  buttonType={AppleButton.Type.CONTINUE}
                  style={localStyles.appleButton}
                  onPress={handleAppleSignIn}
                />
              )}
            </View>

          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const localStyles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  headerBackground: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 290,
    borderBottomLeftRadius: 40,
    borderBottomRightRadius: 40,
    overflow: 'hidden',
  },
  decorativeCircle1: {
    position: 'absolute',
    top: -20,
    right: -20,
    width: 192,
    height: 192,
    borderRadius: 96,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  decorativeCircle2: {
    position: 'absolute',
    top: 128,
    left: -40,
    width: 128,
    height: 128,
    borderRadius: 64,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingTop: Platform.OS === 'ios' ? 80 : 60,
    paddingBottom: 40,
  },
  headerTextContainer: {
    alignItems: 'center',
    marginBottom: 32,
  },
  logo: {
    fontSize: 36,
    fontWeight: '900',
    color: '#FFFFFF',
    letterSpacing: -0.5,
    marginBottom: 8,
  },
  tagline: {
    fontSize: 14,
    color: '#DBEAFE',
    fontWeight: '600',
    letterSpacing: 1,
  },
  card: {
    backgroundColor: COLORS.surface,
    borderRadius: 28,
    padding: 24,
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.1,
    shadowRadius: 20,
    elevation: 8,
  },
  toggleContainer: {
    flexDirection: 'row',
    backgroundColor: '#F1F5F9',
    borderRadius: 14,
    padding: 4,
    marginBottom: 24,
  },
  activeToggle: {
    width: '50%',
    backgroundColor: COLORS.surface,
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  inactiveToggle: {
    width: '50%',
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  activeToggleText: {
    color: COLORS.primary,
    fontWeight: 'bold',
    fontSize: 14,
  },
  inactiveToggleText: {
    color: COLORS.textSub,
    fontWeight: '600',
    fontSize: 14,
  },
  inputGroup: {
    marginBottom: 16,
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: 'bold',
    color: COLORS.textSub,
    marginBottom: 6,
    marginLeft: 4,
  },
  input: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
    color: COLORS.textMain,
    fontSize: 15,
  },
  passwordContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 14,
  },
  inputPassword: {
    flex: 1,
    paddingHorizontal: 16,
    paddingVertical: 14,
    color: COLORS.textMain,
    fontSize: 15,
  },
  eyeIconContainer: {
    padding: 14,
  },
  errorContainer: {
    flexDirection: 'row',
    backgroundColor: '#FEF2F2',
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#FECACA',
    marginBottom: 16,
  },
  errorText: {
    color: COLORS.danger,
    fontSize: 12,
    fontWeight: '600',
    lineHeight: 18,
  },
  strengthIndicatorContainer: {
    marginBottom: 20,
    paddingHorizontal: 4,
  },
  strengthHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  strengthLabel: {
    fontSize: 12,
    fontWeight: 'bold',
    color: COLORS.textSub,
  },
  strengthText: {
    fontSize: 12,
    fontWeight: 'bold',
  },
  strengthBarBase: {
    height: 6,
    backgroundColor: '#F1F5F9',
    borderRadius: 3,
    overflow: 'hidden',
  },
  strengthBarFill: {
    height: '100%',
    borderRadius: 3,
  },
  mainButton: {
    backgroundColor: COLORS.primary,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 8,
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  mainButtonDisabled: {
    backgroundColor: '#94A3B8',
    shadowOpacity: 0,
    elevation: 0,
  },
  mainButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: 'bold',
    letterSpacing: 0.5,
  },
  forgotPasswordContainer: {
    alignItems: 'center',
    marginTop: 20,
  },
  forgotPasswordText: {
    color: COLORS.textSub,
    fontSize: 12,
    fontWeight: 'bold',
  },
  dividerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 32,
    marginBottom: 20,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: COLORS.border,
  },
  dividerText: {
    color: COLORS.textSub,
    fontSize: 11,
    fontWeight: '600',
    paddingHorizontal: 12,
  },
  socialButtonsContainer: {
    gap: 12,
  },
  googleButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 12,
    paddingVertical: 14,
  },
  googleButtonText: {
    color: COLORS.textMain,
    fontSize: 14,
    fontWeight: 'bold',
  },
  appleButton: {
    width: '100%',
    height: 50,
  },
});