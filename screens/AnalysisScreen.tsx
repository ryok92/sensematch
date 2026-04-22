import React, { useState, useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Dimensions, Animated, Easing, StatusBar } from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { RouteProp } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';

type RootStackParamList = {
  Analysis: { onCompleted?: () => void };
  Home: undefined;
};

type AnalysisScreenRouteProp = RouteProp<RootStackParamList, 'Analysis'>;
type AnalysisScreenNavigationProp = StackNavigationProp<RootStackParamList, 'Analysis'>;

type Props = {
  route: AnalysisScreenRouteProp;
  navigation: AnalysisScreenNavigationProp;
};

const { width } = Dimensions.get('window');

export default function AnalysisScreen({ navigation, route }: Props) {
  const onCompleted = route.params?.onCompleted;

  const [isAnalyzed, setIsAnalyzed] = useState<boolean>(false);

  const spinValue = useRef(new Animated.Value(0)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.8)).current;

  useEffect(() => {
    startSpinAnimation();
    const timer = setTimeout(() => {
      setIsAnalyzed(true);
      startResultAnimation();
    }, 3000);
    return () => clearTimeout(timer);
  }, []);

  const startSpinAnimation = () => {
    Animated.loop(
      Animated.timing(spinValue, {
        toValue: 1,
        duration: 2000,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    ).start();
  };

  const startResultAnimation = () => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 800,
        useNativeDriver: true,
      }),
      Animated.spring(scaleAnim, {
        toValue: 1,
        friction: 6,
        useNativeDriver: true,
      }),
    ]).start();
  };

  const spin = spinValue.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  const handleGoToList = () => {
    console.log("一覧画面へ推移");
    if (onCompleted) onCompleted();
  };

  const handleGoToHome = () => {
    if (onCompleted) {
      onCompleted();
    } else {
      navigation.navigate('Home');
    }
  };

  return (
    <LinearGradient
      colors={['#4A90E2', '#7ACBE6', '#9BE5E0']}
      style={styles.container}
    >
      <StatusBar barStyle="light-content" />
      <SafeAreaView style={styles.safeArea}>
        {!isAnalyzed ? (
          <View style={styles.centerContent}>
            <View style={styles.animationContainer}>
              <Animated.View style={{ transform: [{ rotate: spin }] }}>
                <View style={styles.spinnerCircle}>
                  <Ionicons name="sync-outline" size={80} color="#FFFFFF" style={{ opacity: 0.5 }} />
                </View>
              </Animated.View>

              <View style={styles.centerIconOverlay}>
                <Ionicons name="analytics" size={40} color="#FFFFFF" />
              </View>
            </View>

            <Text style={styles.analyzingTitle}>感性データを分析中...</Text>
            <Text style={styles.analyzingSubTitle}>
              あなたの深層心理ベクトルと{'\n'}
              相性の良いパートナーを探しています
            </Text>
          </View>
        ) : (
          <Animated.View
            style={[
              styles.centerContent,
              { opacity: fadeAnim, transform: [{ scale: scaleAnim }] }
            ]}
          >
            <View style={styles.successIconContainer}>
              <Ionicons name="checkmark-circle" size={120} color="#FFFFFF" />
            </View>

            <Text style={styles.resultTitle}>分析完了！</Text>
            <Text style={styles.resultSubTitle}>
              あなたと感性の近い{'\n'}
              「運命の人」が見つかりました。
            </Text>

            <View style={styles.buttonContainer}>
              <TouchableOpacity
                style={styles.primaryButton}
                onPress={handleGoToList}
                activeOpacity={0.9}
              >
                <Text style={styles.primaryButtonText}>すぐに相手を見る</Text>
                <View style={styles.iconCircle}>
                  <Ionicons name="heart" size={20} color="#4A90E2" />
                </View>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.secondaryButton}
                onPress={handleGoToHome}
                activeOpacity={0.7}
              >
                <Text style={styles.secondaryButtontext}>ホームへ</Text>
              </TouchableOpacity>
            </View>
          </Animated.View>
        )}
      </SafeAreaView>
    </LinearGradient>
  );
}


const styles = StyleSheet.create({
  container: { flex: 1, },
  safeArea: { flex: 1, justifyContent: 'center', alignItems: 'center', },
  centerContent: { alignItems: 'center', width: '100%', paddingHorizontal: 30, },
  animationContainer: { width: 160, height: 160, justifyContent: 'center', alignItems: 'center', marginBottom: 40, },
  spinnerCircle: {
    width: 150, height: 150, borderRadius: 75, borderWidth: 4, borderColor: 'rgba(255,255,255,0.3)', borderTopColor: '#FFFFFF',
    justifyContent: 'center', alignItems: 'center',
  },
  centerIconOverlay: { position: 'absolute', justifyContent: 'center', alignItems: 'center', },
  analyzingTitle: { fontSize: 24, fontWeight: 'bold', color: '#FFFFFF', marginBottom: 16, letterSpacing: 1.5, },
  analyzingSubTitle: { fontSize: 15, color: 'rgba(255,255,255,0.9)', textAlign: 'center', lineHeight: 24, },
  successIconContainer: {
    marginBottom: 20, shadowColor: "#000", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 10, elevation: 5,
  },
  resultTitle: {
    fontSize: 32, fontWeight: '800', color: '#FFFFFF', marginBottom: 10, textShadowColor: 'rgba(0,0,0,0.1)',
    textShadowOffset: { width: 0, height: 2 }, textShadowRadius: 4,
  },
  resultSubTitle: {
    fontSize: 16, color: '#FFFFFF', textAlign: 'center', lineHeight: 26, marginBottom: 50, fontWeight: '600',
  },
  buttonContainer: { width: '100%', alignItems: 'center', gap: 15, },
  primaryButton: {
    flexDirection: 'row', backgroundColor: '#FFFFFF', width: '100%', height: 60, borderRadius: 30, justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 25, shadowColor: "#000", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 5, elevation: 6,
  },
  primaryButtonText: { color: '#4A90E2', fontSize: 18, fontWeight: 'bold', letterSpacing: 0.5, },
  iconCircle: {
    width: 34, height: 34, borderRadius: 17, backgroundColor: '#F0F7FF', justifyContent: 'center', alignItems: 'center',
  },
  secondaryButton: { paddingVertical: 15, paddingHorizontal: 30, },
  secondaryButtontext: {
    color: '#FFFFFF', fontSize: 15, fontWeight: '600', opacity: 0.9, textDecorationLine: 'underline',
  },
});