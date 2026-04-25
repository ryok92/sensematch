import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, StatusBar, Dimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import LinearGradient from 'react-native-linear-gradient';
import { ChevronLeft, Gamepad2, Flashlight, Utensils, Palette, Clock, Sparkles, Info, Users, Plus, ArrowRight, LucideIcon } from 'lucide-react-native';

const { width } = Dimensions.get('window');

interface Props {
  navigation: any;
}

interface Game {
  id: string;
  title: string;
  enTitle: string;
  desc: string;
  time: string;
  tag: string;
  icon: LucideIcon;
  gradient: (string | number)[];
  shadowColor: string;
  textColor: string;
  bgColor: string;
}

export default function CoExperienceMenuScreen({ navigation }: Props) {
  const [selectedGame, setSelectedGame] = useState<string | null>(null);

  const games = [
    {
      id: 'abyss',
      title: 'ダークエスケープ',
      enTitle: 'Dark Escape',
      desc: '一人はライトで道を照らし、一人は障害物を避ける。暗闇の中で試される二人の信頼関係。',
      time: '3分〜',
      tag: '究極の協力',
      icon: Flashlight,
      gradient: ['#2E1065', '#000000'],
      shadowColor: '#2E1065',
      textColor: '#D97706',
      bgColor: '#FEF3C7',
    },
    {
      id: 'kitchen',
      title: '料理の達人',
      enTitle: 'Co-op Kitchen',
      desc: '切って、焼いて、提供して。二人の連携力が試される！',
      time: '5分〜',
      tag: '共同作業',
      icon: Utensils,
      gradient: ['#4ADE80', '#10B981'],
      shadowColor: '#10B981',
      textColor: '#10B981',
      bgColor: '#ECFDF5',
    },
    {
      id: 'art',
      title: 'お絵描きリレー',
      enTitle: 'Artistic Sync',
      desc: '半分ずつ描いて一つの絵に。完成した絵はシュール？それとも名作？',
      time: '3分〜',
      tag: '緊張緩和',
      icon: Palette,
      gradient: ['#C084FC', '#6366F1'],
      shadowColor: '#8B5CF6',
      textColor: '#A855F7',
      bgColor: '#FAF5FF',
    }
  ];

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#F9FAFB" />

      <View style={styles.header}>
        <TouchableOpacity style={styles.iconButton}>
          <ChevronLeft size={28} color="#374151" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>共体験を選ぶ</Text>
        <TouchableOpacity style={styles.iconButton}>
          <Info size={24} color="#9CA3AF" />
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.introContainer}>
          <LinearGradient
            colors={['rgba(74, 144, 226, 0.05)', 'rgba(74, 144, 226, 0.1)']}
            style={styles.introBox}
          >
            <View style={styles.decorativeCircle} />
            <View style={styles.introContent}>
              <View style={styles.introIconBox}>
                <Gamepad2 size={24} color="#4A90E2" />
              </View>
              <View style={styles.introTextContainer}>
                <Text style={styles.introTitle}>Play Together!</Text>
                <Text style={styles.introDesc}>
                  ゲームを通じて、普段の会話では見えない{'\n'}
                  お相手の素敵な一面を見つけましょう。
                </Text>
              </View>
            </View>
          </LinearGradient>
        </View>

        <View style={styles.listContainer}>
          {games.map((game) => {
            const isSelected = selectedGame === game.id;
            const Icon = game.icon;

            return (
              <TouchableOpacity
                key={game.id}
                onPress={() => setSelectedGame(isSelected ? null : game.id)}
                activeOpacity={0.9}
                style={[
                  styles.cardContainer,
                  isSelected && styles.cardContainerSelected
                ]}
              >

                <View style={styles.cardBackgroundClipper}>
                  <LinearGradient
                    colors={game.gradient}
                    style={styles.cardBackgroundDeco}
                  />
                </View>

                <View style={styles.cardContent}>

                  <View style={styles.cardTopRow}>
                    <View style={[
                      styles.shadowContainer,
                      {
                        shadowColor: game.shadowColor,
                        shadowOpacity: 0.4,
                        shadowRadius: 10,
                        shadowOffset: { width: 0, height: 8 },
                        elevation: 10,
                        backgroundColor: 'white',
                        borderRadius: 16,
                      }
                    ]}>
                      <LinearGradient
                        colors={game.gradient}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 1 }}
                        style={styles.gameIconBox}
                      >
                        <Icon size={28} color="#FFF" />
                      </LinearGradient>
                    </View>

                    <View style={styles.tagContainer}>
                      <View style={[styles.tagBadge, { backgroundColor: game.bgColor }]}>
                        <Text style={[styles.tagText, { color: game.textColor }]}>
                          #{game.tag}
                        </Text>
                      </View>
                      <View style={styles.timeContainer}>
                        <Clock size={12} color="#9CA3AF" style={{ marginRight: 4 }} />
                        <Text style={styles.timeText}>{game.time}</Text>
                      </View>
                    </View>
                  </View>

                  <View style={styles.textContainer}>
                    <Text style={styles.gameTitle}>{game.title}</Text>
                    <Text style={styles.gameEnTitle}>{game.enTitle}</Text>
                    <Text style={styles.gameDesc}>{game.desc}</Text>
                  </View>

                  {isSelected && (
                    <View style={styles.actionArea}>
                      <TouchableOpacity style={styles.actionButton} onPress={() => navigation.navigate('GameEntry')}>
                        <LinearGradient
                          colors={['#4A90E2', '#357ABD']}
                          style={styles.actionGradient}
                          start={{ x: 0, y: 0 }}
                          end={{ x: 1, y: 0 }}
                        >
                          <View style={styles.buttonContent}>
                            <Text style={styles.actionButtonSubText}>コードをお持ちの方</Text>
                            <Text style={styles.actionButtonText}>このゲームで遊ぶ</Text>
                          </View>
                          <ArrowRight size={20} color="#FFF" style={{ opacity: 0.8 }} />
                        </LinearGradient>
                      </TouchableOpacity>

                      <View style={styles.separatorContainer}>
                        <View style={styles.separatorLine} />
                        <Text style={styles.separatorText}>または</Text>
                        <View style={styles.separatorLine} />
                      </View>

                      <TouchableOpacity
                        style={styles.createRoomButton}
                        onPress={() => navigation.navigate('GameCreate')}
                        activeOpacity={0.7}
                      >
                        <View style={styles.createRoomIconBox}>
                          <Plus size={20} color="#4A90E2" />
                        </View>

                        <View style={styles.createRoomTexts}>
                          <Text style={styles.createRoomTitle}>ルームを作成する</Text>
                          <Text style={styles.createRoomDesc}>コードを発行して相手を招待</Text>
                        </View>
                      </TouchableOpacity>
                    </View>
                  )}
                </View>
              </TouchableOpacity>
            );
          })}
        </View>

        <View style={{ height: 80 }} />
      </ScrollView>

      <View style={styles.footer}>
        <LinearGradient
          colors={['rgba(255,255,255,0)', 'rgba(255,255,255,0.95)', '#FFFFFF']}
          style={styles.footerGradient}
        >
          <View style={styles.footerContent}>
            <Users size={12} color="#9CA3AF" style={{ marginRight: 6 }} />
            <Text style={styles.footerText}>相手が承認するとゲームが開始されます</Text>
          </View>
        </LinearGradient>
      </View>

      <View style={styles.demo}>
        <TouchableOpacity
          onPress={() => { navigation.navigate('karigame') }}
        >
          <Text>デモゲーム</Text>
        </TouchableOpacity>
      </View>

    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    paddingVertical: 16,
    backgroundColor: '#F9FAFB',
    zIndex: 10,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1F2937',
  },
  iconButton: {
    padding: 8,
    borderRadius: 20,
  },
  scrollContent: {
    paddingBottom: 20,
  },
  introContainer: {
    paddingHorizontal: 24,
    marginBottom: 24,
  },
  introBox: {
    borderRadius: 20,
    padding: 20,
    position: 'relative',
    overflow: 'hidden',
  },
  decorativeCircle: {
    position: 'absolute',
    top: -20,
    right: -20,
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: 'rgba(74, 144, 226, 0.1)',
  },
  introContent: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  introIconBox: {
    backgroundColor: '#FFF',
    padding: 10,
    borderRadius: 50,
    shadowColor: '#4A90E2',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
    marginRight: 16,
  },
  introTextContainer: {
    flex: 1,
  },
  introTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#4A90E2',
    marginBottom: 4,
  },
  introDesc: {
    fontSize: 13,
    color: '#4B5563',
    lineHeight: 20,
  },
  listContainer: {
    paddingHorizontal: 24,
    gap: 20,
  },
  cardContainer: {
    backgroundColor: '#FFF',
    borderRadius: 24,
    // カード自体の影
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
    borderWidth: 1,
    borderColor: '#F3F4F6',
  },
  cardContainerSelected: {
    borderColor: '#4A90E2',
    borderWidth: 2,
    shadowColor: '#4A90E2',
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 4,
  },
  cardBackgroundClipper: {
    ...StyleSheet.absoluteFill,
    borderRadius: 24,
    overflow: 'hidden',
    zIndex: 0,
  },
  cardContent: {
    padding: 20,
    zIndex: 1,
  },
  cardBackgroundDeco: {
    position: 'absolute',
    top: 0,
    right: 0,
    width: 120,
    height: 120,
    borderBottomLeftRadius: 100,
    opacity: 0.05,
  },
  cardTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  shadowContainer: {
    // インラインで設定
  },
  gameIconBox: {
    width: 56,
    height: 56,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tagContainer: {
    alignItems: 'flex-end',
  },
  tagBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    marginBottom: 6,
  },
  tagText: {
    fontSize: 11,
    fontWeight: '700',
  },
  timeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  timeText: {
    fontSize: 11,
    color: '#9CA3AF',
    fontWeight: '500',
  },
  textContainer: {
    marginBottom: 8,
  },
  gameTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1F2937',
    marginBottom: 2,
  },
  gameEnTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: '#9CA3AF',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 8,
  },
  gameDesc: {
    fontSize: 13,
    color: '#6B7280',
    lineHeight: 20,
  },
  actionArea: {
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
  },
  /* ↓↓↓ 編集箇所：スタイル追加 ↓↓↓ */
  actionAreaLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#9CA3AF',
    marginBottom: 12,
    textAlign: 'center',
  },
  buttonContent: {
    flex: 1,
  },
  actionButtonSubText: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 10,
    fontWeight: '600',
    marginBottom: 2,
  },
  actionButton: {
    width: '100%',
    borderRadius: 14,
    shadowColor: '#4A90E2',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
    marginBottom: 4,
  },
  actionGradient: {
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  actionButtonText: {
    color: '#FFF',
    fontSize: 15,
    fontWeight: '700',
  },
  separatorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 12,
  },
  separatorLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#F3F4F6',
  },
  separatorText: {
    fontSize: 11,
    color: '#9CA3AF',
    paddingHorizontal: 8,
    fontWeight: '500',
  },
  createRoomButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF',
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    // 軽い影
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  createRoomIconBox: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: '#F0F9FF',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  createRoomTexts: {
    flex: 1,
  },
  createRoomTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1F2937',
  },
  createRoomDesc: {
    fontSize: 11,
    color: '#6B7280',
    marginTop: 1,
  },
  /* ↑↑↑ 編集箇所：スタイル追加 ↑↑↑ */
  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
  },
  footerGradient: {
    height: 80,
    justifyContent: 'flex-end',
    paddingBottom: 30,
    alignItems: 'center',
  },
  footerContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  footerText: {
    fontSize: 11,
    color: '#9CA3AF',
  },

  demo: {
    flexDirection: 'row',
  },
});