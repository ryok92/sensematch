import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, Alert, ActivityIndicator, Linking } from 'react-native';
import styles from '../styles';
import auth from '@react-native-firebase/auth';
import { RouteProp } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';

type RootStackParamList = {
  TwoFactor: { onVerified: () => void };
};

type TwoFactorScreenRouteProp = RouteProp<RootStackParamList, 'TwoFactor'>;
type TwoFactorScreenNavigationProp = StackNavigationProp<RootStackParamList, 'TwoFactor'>;

type Props = {
  route: TwoFactorScreenRouteProp;
  navigation: TwoFactorScreenNavigationProp;
};

export default function TwoFactorScreen({ navigation, route }:Props) {
  const { onVerified } = route.params;
  const user = auth().currentUser;
  const [loading, setLoading] = useState<boolean>(false);
  const [linkSent, setLinkSent] = useState<boolean>(false);

  const sendSignInLink = async () => {
    if(!user || !user.email){
      Alert.alert("エラー", "ユーザー情報が取得できません。");
      return;
    }

    setLoading(true);
    try {
      const actionCodeSettings = {
        url: 'synapseai://auth',
        handleCodeInApp: true,
        iOS: { bundleId: 'com.synapse.app' },
        android: { packageName: 'com.synapse.app', installApp: true, minimumVersion: '12' },
      };
      await auth().sendSignInLinkToEmail(user.email, actionCodeSettings);
      setLinkSent(true);
      Alert.alert("送信完了", "認証リンクを送信しました。");
    } catch (error) {
      Alert.alert("エラー", "送信に失敗しました。");
    }
    setLoading(false);
  };

  useEffect(() => {
    Linking.getInitialURL().then((url) => { if (url) handleDeepLink(url); });
    const unsubscribe = Linking.addEventListener('url', (event) => { handleDeepLink(event.url); });
    return () => { unsubscribe.remove(); };
  }, []);

  const handleDeepLink = async (url:string) => {
    if(!user || !user.email) return;

    if (await auth().isSignInWithEmailLink(url)) {
      setLoading(true);
      try {
        await auth().signInWithEmailLink(user.email, url);
        onVerified();
      } catch (error) {
        Alert.alert("エラー", "リンクが無効です。");
      }
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.logo}>2段階認証</Text>
      {!linkSent ? (
        <>
          <Text style={styles.tagline}>セキュリティ設定がONです。</Text>
          <TouchableOpacity style={styles.mainButton} onPress={sendSignInLink} disabled={loading}>
            {loading ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.mainButtonText}>認証メールを送信</Text>}
          </TouchableOpacity>
        </>
      ) : (
        <Text style={styles.tagline}>メールを確認し、リンクをタップしてください。</Text>
      )}
    </View>
  );
}