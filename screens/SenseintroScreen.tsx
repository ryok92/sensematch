import React from 'react';
import { View, Text, StyleSheet, Image, TouchableOpacity, ScrollView, StatusBar, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons, Ionicons } from '@expo/vector-icons';

const BRAIN_IMAGE = require('../assets/brain.webp');

const COLORS = {
  primary: '#3B82F6', primaryLight: '#EFF6FF', background: '#F5F8FF', surface: '#FFFFFF', textMain: '#1E3A8A',
  textSub: '#64748B', border: '#E2E8F0',
};

interface FeatureItemProps { icon: keyof typeof MaterialCommunityIcons.glyphMap; title: string; description: string; }

const FeatureItem: React.FC<FeatureItemProps> = ({ icon, title, description }) => (
  <View style={styles.featureItem}>
    <View style={styles.iconCircle}>
      <MaterialCommunityIcons name={icon} size={24} color={COLORS.primary} />
    </View>
    <View style={styles.featureTextContainer}>
      <Text style={styles.featureTitle}>{title}</Text>
      <Text style={styles.featureDescription} numberOfLines={3}>{description}</Text>
    </View>
  </View>
);

export default function SenseIntroScreen({ navigation }: { navigation: any }) {
  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />
      <View style={styles.headerBackground}>
        <Image source={BRAIN_IMAGE} style={styles.headerBackgroundImage} resizeMode="cover" />
      </View>

      <SafeAreaView style={styles.safeArea}>
        <View style={styles.header}>
          <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()} activeOpacity={0.8} >
            <Ionicons name="chevron-back" size={26} color="#FFF" />
          </TouchableOpacity>
        </View>

        <View style={styles.scrollContent} >
          <View style={styles.titleSection}>
            <View style={styles.titleTopSpace} />
            <Text style={styles.mainTitle}>SENSE診断</Text>
            <Text style={styles.subTitle}>あなたの深層心理を紐解き、{'\n'}"感性"の合うパートナーを見つけます。</Text>
          </View>

          <View style={styles.spacer} />

          <View style={styles.cardContainer}>
            <FeatureItem icon="lightning-bolt" title="直感で、サクサク回答！"
              description="考え込まずに、パッと思い浮かんだ感覚を大切に。あなたのありのままの感性が最もよく表れます。" />
            <FeatureItem icon="clock-outline" title="いつでも中断OK！"
              description="質問は全100問。途中でやめても次回はその続きからスタートできます。スキマ時間に進めましょう。" />
            <FeatureItem icon="bullseye-arrow" title="答えるほど精度UP！"
              description="多くの質問に答えるほど分析が正確に。本当に「感性が響き合う」お相手が見つかりやすくなります。" />
          </View>

          <View style={styles.buttonContainer}>
            <TouchableOpacity style={styles.primaryButton} activeOpacity={0.9} onPress={() => navigation.navigate('SenseProfiling')}>
              <Text style={styles.primaryButtonText}>診断をはじめる</Text>
              <Ionicons name="arrow-forward" size={20} color="#FFFFFF" />
            </TouchableOpacity>

            <Text style={styles.bottomNote}>※結果を分析し、プロフィールにMatch度"%"を表示します。</Text>
          </View>
        </View>
      </SafeAreaView>
    </View>
  );
}


const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background, },
  headerBackground: {
    position: 'absolute', top: 0, left: 0, right: 0, height: 320, borderBottomLeftRadius: 40, borderBottomRightRadius: 40,
    overflow: 'hidden', backgroundColor: COLORS.primary,
  },
  headerBackgroundImage: { ...StyleSheet.absoluteFillObject, width: '100%', height: '100%', opacity: 0.8 },
  safeArea: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingTop: 8, zIndex: 10 },
  backButton: {
    width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(0,0,0,0.15)', justifyContent: 'center',
    alignItems: 'center'
  },
  scrollContent: { paddingBottom: 40, paddingHorizontal: 24 },
  titleSection: { alignItems: 'center' },
  titleTopSpace: { height: 30 },
  mainTitle: {
    fontSize: 28, fontWeight: '900', color: "#FFFFFF", letterSpacing: 2, marginBottom: 12, textShadowColor: 'rgba(0,0,0,0.2)',
    textShadowOffset: { width: 0, height: 2 }, textShadowRadius: 4, textAlign: 'center',
  },
  subTitle: {
    fontSize: 15, color: '#FFFFFF', textAlign: 'center', lineHeight: 24, fontWeight: '700', textShadowColor: 'rgba(0,0,0,0.2)',
    textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 3
  },
  spacer: { height: 60 },
  cardContainer: {
    width: '100%', backgroundColor: COLORS.surface, borderRadius: 24, padding: 24, marginBottom: 32,
    shadowColor: COLORS.primary, shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.1, shadowRadius: 20, elevation: 8
  },
  featureItem: { flexDirection: 'row', alignItems: 'center', marginBottom: 20 },
  iconCircle: {
    width: 48, height: 48, borderRadius: 24, backgroundColor: COLORS.primaryLight, justifyContent: 'center',
    alignItems: 'center', marginRight: 16,
  },
  featureTextContainer: { flex: 1 },
  featureTitle: { color: COLORS.textMain, fontSize: 15, fontWeight: 'bold', marginBottom: 4 },
  featureDescription: { color: COLORS.textSub, fontSize: 12, lineHeight: 18 },
  buttonContainer: { alignItems: 'center', paddingBottom: 20 },
  primaryButton: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.primary,
    paddingVertical: 16, paddingHorizontal: 40, borderRadius: 30, width: '100%', shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 5, marginBottom: 16,
  },
  primaryButtonText: { color: '#FFFFFF', fontSize: 16, fontWeight: 'bold', marginRight: 8, letterSpacing: 0.5 },
  bottomNote: { textAlign: 'center', color: COLORS.textSub, fontSize: 11, fontWeight: '500' },
})