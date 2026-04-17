import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, Image, TouchableOpacity, Dimensions, ActivityIndicator, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useFocusEffect } from '@react-navigation/native';

import { getAuth, signOut } from '@react-native-firebase/auth';
import { getFirestore, doc, getDoc, setDoc, collection, getDocs, query, where, } from '@react-native-firebase/firestore';

const { width } = Dimensions.get('window');

const DEFAULT_MALE_IMAGE = require('../assets/man.png');
const DEFAULT_FEMALE_IMAGE = require('../assets/woman.png');

interface UserData {
  displayName?: string; bio?: string; location?: string; bloodType?: string; height?: string;
  bodyType?: string; occupation?: string; jobType?: string; income?: string; education?: string; holiday?: string;
  alcohol?: string; tobacco?: string; marital?: string; marry?: string; roommate?: string; date?: string; child?: string;
  sibling?: string; encounter?: string; personality?: string; interests?: string[]; workTime?: string; lifeStyle?: string;
  contactFrequency?: string; cookingFrequency?: string; birthPlace?: string; birthDate?: any; gender?: string | number;
  photoURL?: string; matchCount?: number; footprintCount?: number; question?: string; senseAnswerCount?: number;[key: string]: any;
}

interface StatCardProps {
  label: string; value: number | string; iconName: keyof typeof Ionicons.glyphMap;
  color: string; bgColor: string; onPress: () => void;
}

interface MenuItemProps {
  title: string; iconName: keyof typeof Ionicons.glyphMap | string; iconColor: string; iconBg: string; hasBadge?: boolean;
  badgeText?: string; isLast?: boolean; onPress?: () => void; isDestructive?: boolean;
}

interface ProfileTagProps {
  text: string;
}

const StatCard: React.FC<StatCardProps> = ({ label, value, iconName, color, bgColor, onPress }) => (
  <TouchableOpacity style={styles.statCard} activeOpacity={0.8} onPress={onPress}>
    <View style={[styles.statIconContainer, { backgroundColor: bgColor }]}>
      <Ionicons name={iconName} size={16} color={color} />
    </View>
    <Text style={styles.statValue} numberOfLines={1} adjustsFontSizeToFit>{value}</Text>
    <Text style={styles.statLabel} numberOfLines={1} adjustsFontSizeToFit>{label}</Text>
  </TouchableOpacity>
);

const MenuItem: React.FC<MenuItemProps> = ({ title, iconName, iconColor, iconBg, hasBadge, badgeText, isLast, onPress, isDestructive }) => (
  <TouchableOpacity style={[styles.menuItem, isLast && styles.menuItemLast]} activeOpacity={0.7} onPress={onPress}>
    <View style={styles.menuLeft}>
      <View style={[styles.menuIconContainer, { backgroundColor: iconBg }]}>
        <Ionicons name={iconName as any} size={20} color={iconColor} />
      </View>
      <Text style={[styles.menuTitle, isDestructive && styles.destructiveText]}>{title}</Text>
    </View>

    <View style={styles.menuRight}>
      {hasBadge && (
        <View style={styles.badgeContainer}>
          <Text style={styles.badgeText}>{badgeText}</Text>
        </View>
      )}
      <Ionicons name="chevron-forward" size={20} color="#CCC" />
    </View>
  </TouchableOpacity>
);

const ProfileTag: React.FC<ProfileTagProps> = ({ text }) => (
  <View style={styles.profileTag}>
    <Text style={styles.profileTagText}>#{text}</Text>
  </View>
);

export default function MyProfileScreen({ navigation }: { navigation: any }) {
  const [userData, setUserData] = useState<UserData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [completeness, setCompleteness] = useState<number>(0);
  const [receivedLikesCount, setReceivedLikesCount] = useState<number>(0);
  const [matchesCount, setMatchesCount] = useState<number>(0);
  const [footprintCount, setFootprintCount] = useState<number>(0);
  const [favoritesCount, setFavoritesCount] = useState<number>(0);
  const [senseCompleteness, setSenseCompleteness] = useState<number>(0);

  const calculateAge = (birthDate: any) => {
    if (!birthDate) return '--';
    const birth = birthDate.toDate ? birthDate.toDate() : new Date(birthDate);
    const today = new Date();
    let age = today.getFullYear() - birth.getFullYear();
    if (today.getMonth() < birth.getMonth() || (today.getMonth() === birth.getMonth() && today.getDate() < birth.getDate())) age--;
    return age;
  };

  const calculateCompleteness = (data: UserData) => {
    if (!data) return 0;
    const targetFields = [
      'displayName', 'bio', 'location', 'bloodType', 'height', 'bodyType', 'occupation', 'jobType',
      'income', 'education', 'holiday', 'alcohol', 'tobacco', 'marital', 'marry', 'roommate',
      'date', 'child', 'sibling', 'encounter', 'personality', 'interests', 'workTime',
      'lifeStyle', 'contactFrequency', 'cookingFrequency', 'birthPlace'
    ];

    let filledCount = 0;
    targetFields.forEach(field => {
      const val = data[field];

      if (Array.isArray(val)) {
        const effectiveValues = val.filter(v => v !== '指定なし');
        if (effectiveValues.length > 0) filledCount++;
      } else if (val && val !== '' && val !== '指定なし') {
        filledCount++;
      }
    });

    return Math.round(filledCount / targetFields.length * 100);
  };

  useFocusEffect(
    useCallback(() => {
      const fetchUserData = async () => {
        const auth = getAuth();
        const currentUser = auth.currentUser;
        if (!currentUser) {
          setLoading(false)
          return;
        }

        try {
          const db = getFirestore();

          const userDocRef = doc(db, 'users', currentUser.uid);
          const userDocSnap = await getDoc(userDocRef)

          if (userDocSnap.exists()) {
            const data = userDocSnap.data() as UserData;
            setUserData(data);
            setCompleteness(calculateCompleteness(data));

            let currentAnswerCount = data.senseAnswerCount;
            if (currentAnswerCount === undefined) {
              currentAnswerCount = 0;
              await setDoc(userDocRef, { senseAnswerCount: 0 }, { merge: true });
            }
            const calculatedSensePercent = Math.min(Math.round((currentAnswerCount / 100) * 100), 100);
            setSenseCompleteness(calculatedSensePercent);
          }

          const footprintRef = collection(db, 'users', currentUser.uid, 'footprints_received');
          const footprintSnapshot = await getDocs(footprintRef);
          setFootprintCount(footprintSnapshot.size);

          const matchesRef = collection(db, 'matches')
          const matchesQuery = query(matchesRef, where('users', 'array-contains', currentUser.uid));
          const matchesSnapshot = await getDocs(matchesQuery);
          setMatchesCount(matchesSnapshot.size);

          const receivedLikesRef = collection(db, 'users', currentUser.uid, 'receivedLikes');
          const likesSnapshot = await getDocs(receivedLikesRef);
          const LikesCount = likesSnapshot.size - matchesSnapshot.size;
          setReceivedLikesCount(LikesCount);

          const favoritesRef = collection(db, 'users', currentUser.uid, 'favorites');
          const favoritesSnapshot = await getDocs(favoritesRef);
          setFavoritesCount(favoritesSnapshot.size);

        } catch (error) {
          console.error("Error fetching user data:", error);
        } finally {
          setLoading(false);
        }
      };

      fetchUserData();
    }, [])
  );

  const handleLogout = () => {
    Alert.alert(
      "ログアウト",
      "ログアウトしてもよろしいですか？",
      [
        {
          text: "キャンセル",
          style: "cancel"
        },
        {
          text: "ログアウト",
          style: "destructive",
          onPress: async () => {
            try {
              const auth = getAuth();
              await signOut(auth);
            } catch (e) {
              Alert.alert("エラー", "ログアウトに失敗しました")
            }
          }
        }
      ]
    );
  };

  if (loading) {
    return (
      <View style={[styles.container, styles.loadingContainer]}>
        <ActivityIndicator size="large" color="#4A90E2" />
      </View>
    );
  }

  const displayData: UserData = userData || {
    displayName: '未設定',
    location: '未設定',
    occupation: '未設定',
    matchCount: 0,
    footprintCount: 0,
    interests: [],
    question: undefined
  };

  let userImage: any;
  if (displayData.photoURL && displayData.photoURL.startsWith('http')) {
    userImage = { uri: displayData.photoURL };
  } else {
    const gender = displayData.gender;
    if (gender === '女性' || gender === 'female' || gender === 2) {
      userImage = DEFAULT_FEMALE_IMAGE;
    } else {
      userImage = DEFAULT_MALE_IMAGE;
    }
  }

  const age = calculateAge(displayData.birthDate);
  const subText = `${displayData.location || '未設定'}・${displayData.occupation || '未設定'}`;
  const tags = Array.isArray(displayData.interests) ? displayData.interests : [];

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false} >
        <LinearGradient colors={['rgba(74, 144, 226, 0.22)', 'rgba(255, 255, 255, 0)']} style={styles.topGradient} />

        <SafeAreaView style={styles.safeArea}>
          <View style={styles.header}>
            <View />
            <Text style={styles.headerTitle}>マイページ</Text>
            <View style={{ width: 28 }} />
          </View>

          <View style={styles.profileSection}>
            <View style={styles.avatarContainer}>
              <Image source={userImage} style={styles.avatar} resizeMode="cover" />
              <TouchableOpacity style={styles.editIconBadge} onPress={() => navigation.navigate('ProfileEdit')}>
                <MaterialCommunityIcons name="pencil" size={14} color="#FFF" />
              </TouchableOpacity>
            </View>

            <View style={styles.profileInfo}>
              <View style={styles.nameRow}>
                <Text style={styles.name} numberOfLines={1}>{displayData.displayName || 'ゲスト'}</Text>
                <Text style={styles.age}>{age}歳</Text>
                <Ionicons name="shield-checkmark" size={18} color="#4A90E2" style={{ marginLeft: 6 }} />
              </View>
              <Text style={styles.subText}>{subText}</Text>

              <View style={styles.progressContainer}>
                <View style={styles.progressLabelRow}>
                  <Text style={styles.progressLabel}>プロフィール充実度</Text>
                  <Text style={styles.progressValue}>{completeness}%</Text>
                </View>
                <View style={styles.progressBarBg}>
                  <View style={[styles.progressBarFill, { width: `${completeness}%` }]} />
                </View>
              </View>
            </View>
          </View>

          <TouchableOpacity style={styles.statusCardWrapper} activeOpacity={0.9} onPress={() => Alert.alert('後日実装')}>
            <LinearGradient colors={['#F0F9FF', '#E0E7FF']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.statusCard}>
              <View style={styles.statusLeft}>
                <LinearGradient colors={['#4A90E2', '#6366F1']} style={styles.statusIconBg}>
                  <MaterialCommunityIcons name="shield-account" size={20} color="#FFF" />
                </LinearGradient>
                <View>
                  <Text style={styles.statusLabel}>会員ステータス</Text>
                  <Text style={styles.statusValue}>スタンダード</Text>
                </View>
              </View>

              <View style={styles.statusRight}>
                <Text style={styles.statusActionText}>詳細</Text>
                <Ionicons name="chevron-forward" size={14} color="#4A90E2" />
              </View>
            </LinearGradient>
          </TouchableOpacity>

          <View style={styles.statsContainer}>
            <StatCard label="いいね" value={receivedLikesCount} iconName="heart" color="#FF6B6B" bgColor="rgba(255, 107, 107, 0.1)"
              onPress={() => navigation.navigate('ReceivedLikes')}
            />
            <StatCard label="マッチング" value={matchesCount > 0 ? matchesCount : (displayData.matchCount || 0)} iconName="chatbubbles"
              color="#F50E0B" bgColor="rgba(245, 158, 11, 0.1)" onPress={() => navigation.navigate('AllMatches')}
            />
            <StatCard label="足あと" value={footprintCount} iconName="eye" color="#4A90E2" bgColor="rgba(74, 144, 226, 0.1)"
              onPress={() => navigation.navigate('Footprints')}
            />
            <StatCard label="お気に入り" value={favoritesCount} iconName="star" color="#F59E0B" bgColor="rgba(245, 158, 11, 0.1)"
              onPress={() => navigation.navigate('Favorites')}
            />
          </View>

          <TouchableOpacity activeOpacity={0.9} style={styles.senseBannerWrapper}
            onPress={() => navigation.navigate('Senseintro')}>
            <LinearGradient colors={['#8B5CF6', '#D946EF']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.senseBanner}>
              <View style={styles.senseContentWrapper}>
                <View style={styles.senseIconBox}>
                  <MaterialCommunityIcons name="head-lightbulb" size={26} color="#8B5CF6" />
                </View>

                <View style={styles.senseTextContent}>
                  <View style={styles.senseTitleRow}>
                    <Text style={styles.senseTitle}>SENSE診断</Text>
                  </View>

                  <Text style={styles.senseSubtitle} numberOfLines={2}>
                    あなたの"感性"を分析して、{'\n'}"感性"の合うお相手を見つけよう✨
                  </Text>

                  <View style={styles.senseProgressContainer}>
                    <View style={styles.senseProgressBg}>
                      <View style={[styles.senseProgressFill, { width: `${senseCompleteness}%` }]} />
                    </View>
                    <Text style={styles.senseProgressText}>{senseCompleteness}% 回答済</Text>
                  </View>
                </View>

                <Ionicons name="chevron-forward" size={20} color="rgba(255, 255, 255, 0.8)" style={styles.senseArrow} />
              </View>

              <View style={styles.senseDecoCircle1} />
              <View style={styles.senseDecoCircle2} />
              <MaterialCommunityIcons name="star-four-points" size={16} color="rgba(255,255,255,0.15)" style={styles.senseDecoStar1} />
              <MaterialCommunityIcons name="star-four-points" size={16} color="rgba(255,255,255,0.2)" style={styles.senseDecoStar2} />
            </LinearGradient>
          </TouchableOpacity>

          <View style={styles.tagsSectionWrapper}>
            <View style={styles.tagsHeaderRow}>
              <View style={styles.tagsTitleContainer}>
                <Ionicons name="sparkles" size={16} color="#F59E0B" style={{ marginRight: 4 }} />
                <Text style={styles.tagsTitle}>興味・関心タグ</Text>
              </View>
              <TouchableOpacity style={styles.tagsEditButton} onPress={() => navigation.navigate('TagSetting')}>
                <Text style={styles.tagsEditButtonText}>編集する</Text>
              </TouchableOpacity>
            </View>

            <TouchableOpacity style={styles.tagsContainer} activeOpacity={0.9} onPress={() => navigation.navigate('TagSetting')} >
              {tags.length > 0 ? (
                <View style={styles.tagsFlex}>
                  {tags.map((tag, index) => (
                    <ProfileTag key={index} text={tag} />
                  ))}
                </View>
              ) : (
                <View style={styles.emptyTagsContainer}>
                  <Text style={styles.emptyTagsText}>
                    まだタグが設定されていません。{'\n'}
                    趣味や好きなものを設定してマッチング率UP！
                  </Text>
                </View>
              )}
            </TouchableOpacity>
          </View>

          <TouchableOpacity style={styles.questionCardWrapper} activeOpacity={0.9} onPress={() => navigation.navigate('Question')} >
            <LinearGradient colors={['#ffffff', '#E3F2FD']} style={styles.questionCard} >
              <View style={styles.questionIconBox}>
                <MaterialCommunityIcons name="comment-question-outline" size={24} color="#2563EB" />
              </View>
              <View style={styles.questionContent}>
                <Text style={styles.questionTitle}>お相手への質問を設定</Text>
                <Text style={styles.questionSubtitle} numberOfLines={1}>
                  {displayData.question ? displayData.question : '未設定：いいねと一緒に回答をもらおう'}
                </Text>
              </View>
              <View style={styles.questionEditBtn}>
                <Text style={styles.questionEditText}>設定する</Text>
                <Ionicons name="chevron-forward" size={16} color="#2563EB" />
              </View>
            </LinearGradient>
          </TouchableOpacity>

          <TouchableOpacity style={styles.noteCardWrapper} activeOpacity={0.9}
            onPress={() => navigation.navigate('NoteSetting')}
          >
            <LinearGradient colors={['#FFFFFF', '#FFF0F5']} style={styles.noteCard} >
              <View style={styles.noteIconBox}>
                <MaterialCommunityIcons name="book-open-page-variant" size={24} color="#E83E8C" />
              </View>

              <View style={styles.noteContent}>
                <Text style={styles.noteTitle}>Note</Text>
                <Text style={styles.noteSubtitle} numberOfLines={2}>
                  写真とコメントで作る{'\n'}あなたを表現するアルバム
                </Text>
              </View>

              <View style={styles.noteEditBtn}>
                <Text style={styles.noteEditText}>作成する</Text>
                <Ionicons name="chevron-forward" size={16} color="#E83E8C" />
              </View>
            </LinearGradient>
          </TouchableOpacity>

          <TouchableOpacity activeOpacity={0.9} style={styles.planBannerWrapper}>
            <LinearGradient colors={['#4A90E2', '#63b3ed']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.planBanner}>
              <View style={styles.planContent}>
                <View>
                  <View style={styles.planTitleRow}>
                    <MaterialCommunityIcons name="crown" size={20} color="#FFD700" style={{ marginRight: 6 }} />
                    <Text style={styles.planTitle}>PREMIUM PLAN</Text>
                  </View>
                  <Text style={styles.planSubtitle}>有料プランでマッチング率UP！</Text>
                </View>
                <View style={styles.planButton}>
                  <Text style={styles.planButtonText}>詳細をみる</Text>
                </View>
              </View>

              <View style={styles.decoCircle1} />
              <View style={styles.decoCircle2} />
            </LinearGradient>
          </TouchableOpacity>

          <View style={styles.menuGroup}>
            <MenuItem title="写真の管理" iconName="camera" iconColor="#6366F1" iconBg="#EEF2FF"
              onPress={() => navigation.navigate('PhotoManager')}
            />
            <MenuItem title="プロフィール詳細編集" iconName="create" iconColor="#4A90E2" iconBg="#EBF8FF"
              onPress={() => navigation.navigate('ProfileEdit')}
            />
            <MenuItem title="本人確認・認証" iconName="shield-checkmark" iconColor="#10B981" iconBg="#ECFDF5"
              hasBadge badgeText="必須" />
            <MenuItem title="メモ" iconName="document-text" iconColor="#F59E0B" iconBg="#FEF3C7" isLast
              onPress={() => navigation.navigate('MemoSetting')}
            />
          </View>

          <View style={styles.menuGroup}>
            <MenuItem title="プライバシー・通知設定" iconName="lock-closed" iconColor="#8B5CF6" iconBg="#F3E8FF"
              onPress={() => navigation.navigate('Setting')}
            />
            <MenuItem title="お支払い方法" iconName="card" iconColor="#6B7280" iconBg="#F3F4F6" isLast />
            <MenuItem title="ご意見" iconName="chatbox-ellipses" iconColor="#14B8A6" iconBg="#F0FDFA"
              onPress={() => navigation.navigate('Feedback')}
            />
            <MenuItem title="アカウント" iconName="settings" iconColor="#3B82F6" iconBg="#EFF6FF"
              onPress={() => navigation.navigate('Account')}
            />
            <MenuItem title="お問い合わせ" iconName="mail" iconColor="#6366F1" iconBg="#EEF2FF"
              onPress={() => navigation.navigate('Contact')}
            />
            <MenuItem title="ログアウト" iconName="log-out" iconColor="#EF4444" iconBg="#FEF2F2" isLast isDestructive
              onPress={handleLogout}
            />
          </View>

          <Text style={styles.versionText}>Sense Match v1.0.6</Text>

        </SafeAreaView>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFF' },
  loadingContainer: { justifyContent: 'center', alignItems: 'center' },
  scrollContent: { paddingBottom: 40 },
  topGradient: { position: 'absolute', top: 0, left: 0, right: 0, height: 200 },
  safeArea: { flex: 1 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12 },
  headerTitle: { fontSize: 18, fontWeight: '700', color: '#333' },
  profileSection: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 24, marginTop: 10, marginBottom: 24 },
  avatarContainer: { position: 'relative', marginRight: 20 },
  avatar: { width: 88, height: 88, borderRadius: 44, borderWidth: 3, borderColor: '#FFF', backgroundColor: '#EEE' },
  editIconBadge: { position: 'absolute', bottom: 0, right: 0, backgroundColor: '#4A90E2', padding: 6, borderRadius: 20, borderWidth: 2, borderColor: '#FFF' },
  profileInfo: { flex: 1 },
  nameRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 4 },
  name: { fontSize: 24, fontWeight: 'bold', color: '#333', marginRight: 8, flexShrink: 1 },
  age: { fontSize: 18, color: '#666', fontWeight: '500' },
  subText: { fontSize: 13, color: '#888', marginBottom: 8 },
  progressContainer: { width: '90%' },
  progressLabelRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  progressLabel: { fontSize: 10, color: '#999' },
  progressValue: { fontSize: 10, fontWeight: 'bold', color: '#4A90E2' },
  progressBarBg: { height: 6, backgroundColor: '#F0F0F0', borderRadius: 3, overflow: 'hidden' },
  progressBarFill: { height: '100%', backgroundColor: '#4A90E2', borderRadius: 3 },
  tagsSectionWrapper: { marginBottom: 24, paddingHorizontal: 24 },
  tagsHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 10, paddingHorizontal: 4 },
  tagsTitleContainer: { flexDirection: 'row', alignItems: 'center' },
  tagsTitle: { fontSize: 14, fontWeight: 'bold', color: '#333' },
  tagsEditButton: { backgroundColor: '#EFF6FF', paddingVertical: 4, paddingHorizontal: 10, borderRadius: 20 },
  tagsEditButtonText: { fontSize: 11, color: '#2563EB', fontWeight: 'bold' },
  tagsContainer: { backgroundColor: '#FFF', borderRadius: 16, padding: 16, borderWidth: 1, borderColor: '#F1F5F9', shadowColor: "#64748B", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 6, elevation: 2, minHeight: 60 },
  tagsFlex: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  profileTag: { backgroundColor: '#F8FAFC', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, borderWidth: 1, borderColor: '#E2E8F0' },
  profileTagText: { fontSize: 12, color: '#475569', fontWeight: '600' },
  emptyTagsContainer: { alignItems: 'center', justifyContent: 'center', paddingVertical: 10 },
  emptyTagsText: { fontSize: 12, color: '#94A3B8', textAlign: 'center', lineHeight: 18 },

  statsContainer: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 24, marginBottom: 16 },
  statCard: { width: '23%', backgroundColor: '#FFF', borderRadius: 12, paddingVertical: 10, paddingHorizontal: 2, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#F5F7FA', shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 2 },

  statIconContainer: { width: 28, height: 28, borderRadius: 14, justifyContent: 'center', alignItems: 'center', marginBottom: 6 },
  statValue: { fontSize: 16, fontWeight: 'bold', color: '#333', marginBottom: 2, textAlign: 'center' },
  statLabel: { fontSize: 9, color: '#999', textAlign: 'center' },

  questionCardWrapper: { marginHorizontal: 24, marginBottom: 24, shadowColor: "#2563EB", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.08, shadowRadius: 10, elevation: 3 },
  questionCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFF', borderRadius: 16, padding: 16, borderWidth: 1, borderColor: '#EFF6FF' },
  questionIconBox: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#EFF6FF', justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  questionContent: { flex: 1, justifyContent: 'center' },
  questionTitle: { fontSize: 14, fontWeight: 'bold', color: '#333', marginBottom: 2 },
  questionSubtitle: { fontSize: 11, color: '#64748B' },
  questionEditBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 12, borderWidth: 1, borderColor: '#EFF6FF' },
  questionEditText: { fontSize: 10, fontWeight: 'bold', color: '#2563EB', marginRight: 2 },
  noteCardWrapper: { marginHorizontal: 24, marginBottom: 24, shadowColor: "#E83E8C", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.08, shadowRadius: 10, elevation: 3 },
  noteCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFF', borderRadius: 16, padding: 16, borderWidth: 1, borderColor: '#FCE4EC' },
  noteIconBox: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#FCE4EC', justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  noteContent: { flex: 1, justifyContent: 'center' },
  noteTitle: { fontSize: 17, fontWeight: 'bold', color: '#333', marginBottom: 2 },
  noteSubtitle: { fontSize: 11, color: '#64748B', lineHeight: 16 },
  noteEditBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 12, borderWidth: 1, borderColor: '#FCE4EC' },
  noteEditText: { fontSize: 10, fontWeight: 'bold', color: '#E83E8C', marginRight: 2 },
  planBannerWrapper: { marginHorizontal: 24, marginBottom: 30, shadowColor: "#4A90E2", shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.2, shadowRadius: 12, elevation: 6 },
  planBanner: { borderRadius: 20, padding: 20, position: 'relative', overflow: 'hidden' },
  planContent: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', zIndex: 1 },
  planTitleRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 4 },
  planTitle: { color: '#FFF', fontSize: 14, fontWeight: 'bold', letterSpacing: 1 },
  planSubtitle: { color: 'rgba(255,255,255,0.9)', fontSize: 11 },
  planButton: { backgroundColor: '#FFF', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20 },
  planButtonText: { color: '#4A90E2', fontSize: 11, fontWeight: 'bold' },
  decoCircle1: { position: 'absolute', top: -20, right: -20, width: 80, height: 80, borderRadius: 40, backgroundColor: 'rgba(255,255,255,0.1)' },
  decoCircle2: { position: 'absolute', bottom: -10, left: -10, width: 60, height: 60, borderRadius: 30, backgroundColor: 'rgba(255,255,255,0.1)' },
  menuGroup: { backgroundColor: '#FFF', marginHorizontal: 24, borderRadius: 20, borderWidth: 1, borderColor: '#F5F7FA', marginBottom: 24, overflow: 'hidden' },
  menuItem: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16, backgroundColor: '#FFF', borderBottomWidth: 1, borderBottomColor: '#F5F7FA' },
  menuItemLast: { borderBottomWidth: 0 },
  menuLeft: { flexDirection: 'row', alignItems: 'center' },
  menuIconContainer: { width: 36, height: 36, borderRadius: 12, justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  menuTitle: { fontSize: 14, fontWeight: '500', color: '#333' },
  destructiveText: { color: '#EF4444' },
  menuRight: { flexDirection: 'row', alignItems: 'center' },
  badgeContainer: { backgroundColor: '#FF6B6B', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10, marginRight: 8 },
  badgeText: { color: '#FFF', fontSize: 10, fontWeight: 'bold' },
  versionText: { textAlign: 'center', fontSize: 11, color: '#CCC', marginBottom: 20 },
  statusCardWrapper: {
    marginHorizontal: 24, marginBottom: 24, borderRadius: 16, shadowColor: "#4A90E2", shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1, shadowRadius: 8, elevation: 3
  },
  statusCard: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16,
    paddingVertical: 14, borderRadius: 16, borderWidth: 1, borderColor: 'rgba(255,255,255, 0.8)'
  },
  statusLeft: { flexDirection: 'row', alignItems: 'center' },
  statusIconBg: {
    width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center', marginRight: 12,
    shadowColor: "#4A90E2", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.3, shadowRadius: 4, elevation: 2
  },
  statusLabel: { fontSize: 10, color: '#4F46E5', marginBottom: 2, fontWeight: '800', letterSpacing: 0.5 },
  statusValue: { fontSize: 15, fontWeight: '800', color: '#1E293B', letterSpacing: 0.5 },
  statusRight: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255, 255, 255, 0.7)', paddingHorizontal: 12,
    paddingVertical: 6, borderRadius: 20, borderWidth: 1, borderColor: 'rgba(255,255,255,0.9)'
  },
  statusActionText: { fontSize: 10, fontWeight: 'bold', color: '#4A90E2', marginRight: 2 },
  senseBannerWrapper: {
    marginHorizontal: 24, marginBottom: 24, shadowColor: "#8B5CF6", shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25, shadowRadius: 10, elevation: 5,
  },
  senseBanner: { borderRadius: 16, padding: 16, overflow: 'hidden', position: 'relative', },
  senseContentWrapper: { flexDirection: 'row', alignItems: 'center', zIndex: 2, },
  senseIconBox: {
    width: 48, height: 48, borderRadius: 24, backgroundColor: '#FFF', justifyContent: 'center', alignItems: 'center',
    marginRight: 14, shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 3, elevation: 2,
  },
  senseTextContent: { flex: 1, justifyContent: 'center', },
  senseTitleRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 4, },
  senseTitle: { fontSize: 16, fontWeight: '900', color: '#FFF', letterSpacing: 1, },
  senseBadge: { backgroundColor: "#FFD700", paddingHorizontal: 6, paddingVertical: 2, borderRadius: 8, marginLeft: 8, },
  senseBadgeText: { color: "#B45309", fontSize: 9, fontWeight: 'bold', },
  senseSubtitle: { fontSize: 11, color: "rgba(255,255,255,0.9)", lineHeight: 16, marginBottom: 8, },
  senseProgressContainer: { flexDirection: 'row', alignItems: 'center', },
  senseProgressBg: { flex: 1, height: 6, backgroundColor: 'rgba(255,255,255,0.3)', borderRadius: 3, overflow: 'hidden', marginRight: 8, },
  senseProgressFill: { height: '100%', backgroundColor: "#FFF", borderRadius: 3, },
  senseProgressText: { fontSize: 10, color: '#FFF', borderRadius: 3, },
  senseArrow: { marginLeft: 8, },
  senseDecoCircle1: {
    position: 'absolute', top: -30, right: -20, width: 100, height: 100, borderRadius: 50,
    backgroundColor: 'rgba(255,255,255,0.1)', zIndex: 1
  },
  senseDecoCircle2: {
    position: 'absolute', bottom: -40, left: 40, width: 80, height: 80, borderRadius: 40,
    backgroundColor: 'rgba(255,255,255,0.08)', zIndex: 1
  },
  senseDecoStar1: { position: 'absolute', top: 12, right: 40, zIndex: 1 },
  senseDecoStar2: { position: 'absolute', bottom: 1, right: 88, zIndex: 1 },
});