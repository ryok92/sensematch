import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TextInput, TouchableOpacity, KeyboardAvoidingView, Platform, Alert, ActivityIndicator,
  Modal, FlatList, Animated, PanResponder, Dimensions, Image, StatusBar, StyleProp, ViewStyle, ImageSourcePropType
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { getAuth } from '@react-native-firebase/auth';
import { getFirestore, doc, getDoc, setDoc, serverTimestamp } from '@react-native-firebase/firestore';

const { width, height } = Dimensions.get('window');
const IMAGE_HEIGHT = height * 0.7;
const DEFAULT_MALE_IMAGE = require('../assets/man.png');
const DEFAULT_FEMALE_IMAGE = require('../assets/woman.png');

export type Gender = 'male' | 'female';
export interface UserFormData {
  displayName: string; bio: string; location: string; birthPlace: string; bloodType: string; height: string; bodyType: string;
  occupation: string; jobType: string; workTime: string; income: string; education: string; holiday: string; lifeStyle: string;
  cookingFrequency: string; alcohol: string; tobacco: string; marital: string; marry: string; roommate: string; date: string;
  child: string; sibling: string; encounter: string; contactFrequency: string; personality: string[]; photoURL?: string;
  gender?: Gender; birthDate?: any;[key: string]: any;
}

interface ModalConfig {
  title: string;
  options: string[];
  fieldKey: keyof UserFormData;
  multiSelect?: boolean;
}

const OPTIONS: Record<string, any> = {
  bloodType: ['A型', 'B型', 'O型', 'AB型', '不明'],
  bodyType: {
    male: ['スリム', '普通', '筋肉質', 'がっちり', 'ややぽっちゃり', 'ぽっちゃり'],
    female: ['スリム', 'やや細身', '普通', 'グラマラス', 'ややぽっちゃり', 'ぽっちゃり']
  },
  occupation: ['上場企業', 'メーカー/商社', 'IT/通信', '金融/保険', '不動産/建設', '広告/マスコミ', 'コンサルティング',
    '事務職,営業職', '公務員（国家/地方）', '警察官/消防士/自衛隊', '医師', '歯科医師', '看護師', '薬剤師/医療系専門職',
    '弁護士/公認会計士/税理士', '経営者/役員', '自営業/個人事業主', '投資家', 'クリエイター・WEBデザイナー', '接客/サービス業',
    '調理師/栄養士', 'アパレル/美容関係', '保育士/幼稚園教諭', 'キャビンアテンダント/航空関係', '芸能/モデル関係', '学生', 'フリーランス', 'その他'
  ],
  jobType: ['営業', '企画', '事務', 'エンジニア', 'デザイナー', '販売・サービス', '専門職', 'その他'],
  income: ['秘密', '～200万円', '200万円～400万円', '400万円～600万円', '600万円～800万円', '800万円～1000万円', '1000万円～1500万円', '1500万円～2000万円', '2000万円～3000万円', '3000万円～'],
  education: ['高校卒', '短大/専門/高専卒', '大学卒', '大学院卒', 'その他'],
  holiday: ['土日祝', '平日', '不定期/不定休', 'その他'],
  alcohol: ['飲まない', 'あまり飲まない', '付き合い程度', 'ときどき飲む', 'よく飲む'],
  tobacco: ['吸わない', '吸う(電子・加熱式)', '吸う(紙タバコ)', 'ときどき吸う', '非喫煙者の前では吸わない'],
  roommate: ['一人暮らし', '実家暮らし', '兄弟・姉妹と同居', '子供と同居', 'ペットと同居', '友達とシェアハウス', 'その他'],
  marry: ['すぐにでもしたい', '2〜3年のうちに', 'いい人がいれば', '今のところ考えていない'],
  date: ['自分が多めに払う', '割り勘', '相談して決める', '相手に払ってほしい'],
  child: ['なし', '別居', '同居'],
  marital: ['未婚', '離婚', '死別'],
  sibling: {
    male: ['一人っ子', '長男', '次男', '三男', 'その他'],
    female: ['一人っ子', '長女', '次女', '三女', 'その他']
  },
  encounter: ['すぐに会いたい', 'メッセージを重ねてから', '共体験から', 'ビデオ通話してから'],
  personality: ['明るい・元気', '落ち着いている', '社交的・話し好き', 'マイペース', '穏やか・癒し系', 'クール', '情熱的', 'ポジティブ',
    '天然と言われる', '聞き上手', 'リーダー気質・引っ張るタイプ', '甘えん坊', '世話好き・尽くすタイプ', '人見知り・シャイ', '誠実・真面目',
    'ロマンチスト', 'アウトドア派', 'インドア派', 'フットワークが軽い', '計画的・慎重派', '直感・感覚派', '好奇心旺盛', '一人の時間も大切'
  ],
  workTime: ['日中(9時〜18時頃)', '朝・昼間メイン', '午後・夕方から', '夜勤・深夜メイン', 'シフト制', 'フレックス・自由'],
  lifeStyle: ['完全な朝型', 'どちらかといえば朝型', 'どちらかといえば夜型', '完全な夜型'],
  contactFrequency: ['マメに連絡したい', '1日1回〜数回程度', '気づいた時に返す', '要件がある時だけでOK', 'メッセージより電話派'],
  cookingFrequency: ['ほぼ毎日作る', '週に2〜3回程度', '休日や気が向いた時だけ', '今はしないが興味はある', '覚えたい', '食べる専門'],
};

const PREFECTURES = [
  '北海道', '青森県', '岩手県', '宮城県', '秋田県', '山形県', '福島県',
  '茨城県', '栃木県', '群馬県', '埼玉県', '千葉県', '東京都', '神奈川県',
  '新潟県', '富山県', '石川県', '福井県', '山梨県', '長野県', '岐阜県', '静岡県', '愛知県',
  '三重県', '滋賀県', '京都府', '大阪府', '兵庫県', '奈良県', '和歌山県',
  '鳥取県', '島根県', '岡山県', '広島県', '山口県',
  '徳島県', '香川県', '愛媛県', '高知県',
  '福岡県', '佐賀県', '長崎県', '熊本県', '大分県', '宮崎県', '鹿児島県', '沖縄県',
  '海外', '未設定'
];

const HEIGHTS = Array.from({ length: 71 }, (_, i) => `${130 + i}cm`);

const RequiredBadge: React.FC = () => (
  <View style={styles.badge}>
    <Text style={styles.badgeText}>必須</Text>
  </View>
);

interface SectionProps {
  title: string;
  subTitle?: string;
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}

const Section: React.FC<SectionProps> = ({ title, subTitle, children, style }) => (
  <View style={[styles.section, style]}>
    <View style={styles.sectionHeaderRow}>
      <Ionicons
        name={
          title === '基本情報' ? 'person-outline' :
            title === '仕事・学歴' ? 'briefcase-outline' :
              title === 'ライフスタイル' ? 'cafe-outline' :
                title === '恋愛・結婚観' ? 'heart-outline' :
                  'information-circle-outline'
        }
        size={20}
        color="#4A90E2"
        style={{ marginRight: 8 }}
      />
      <View>
        <Text style={styles.sectionTitle}>{title}</Text>
        {subTitle && <Text style={styles.sectionSubTitle}>{subTitle}</Text>}
      </View>
    </View>
    {children}
  </View>
);

interface TextInputFieldProps {
  label: string;
  value: string;
  onChangeText: (text: string) => void;
  required?: boolean;
  placeholder?: string;
  multiline?: boolean;
  maxLength?: number;
  style?: StyleProp<ViewStyle>;
}

const TextInputField: React.FC<TextInputFieldProps> = ({ label, value, onChangeText, required, placeholder, multiline, maxLength, style }) => (
  <View style={[styles.fieldContainer, style]}>
    <View style={styles.labelRow}>
      <Text style={styles.label}>{label}</Text>
      {required && <RequiredBadge />}
    </View>
    <TextInput
      style={[styles.inputBox, multiline && styles.textArea]}
      value={value}
      onChangeText={onChangeText}
      placeholder={placeholder}
      placeholderTextColor="#CCC"
      multiline={multiline}
      maxLength={maxLength}
    />
    {maxLength && (
      <Text style={styles.charCount}>{value ? value.length : 0} / {maxLength}</Text>
    )}
  </View>
);

interface SelectFieldProps {
  label: string;
  value: string | string[];
  onPress: () => void;
  required?: boolean;
  placeholder?: string;
  halfWidth?: boolean;
}
const SelectField: React.FC<SelectFieldProps> = ({ label, value, onPress, required, placeholder, halfWidth }) => {
  const displayValue = Array.isArray(value)
    ? (value.length > 0 ? value.join(' / ') : null)
    : value;

  return (
    <TouchableOpacity
      style={[styles.fieldContainer, halfWidth && styles.halfWidthContainer]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <View style={styles.labelRow}>
        <Text style={styles.label}>{label}</Text>
        {required && <RequiredBadge />}
      </View>
      <View style={styles.selectBox}>
        <Text style={[styles.selectValue, !displayValue && styles.placeholderText]} numberOfLines={1}>
          {displayValue || placeholder || '選択してください'}
        </Text>
        <Ionicons name="chevron-forward" size={16} color="#CCC" />
      </View>
    </TouchableOpacity>
  );
};

interface SelectionModalProps {
  visible: boolean;
  title: string;
  options: string[];
  onSelect: (value: string | string[]) => void;
  onClose: () => void;
  multiSelect?: boolean;
  selectedValues: string | string[];
}

const SelectionModal: React.FC<SelectionModalProps> = ({ visible, title, options, onSelect, onClose, multiSelect, selectedValues }) => {
  const insets = useSafeAreaInsets();
  const panY = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) panY.setValue(0);
  }, [visible]);

  const closeWithAnimation = useCallback(() => {
    Animated.timing(panY, {
      toValue: height,
      duration: 250,
      useNativeDriver: true,
    }).start(onClose);
  }, [onClose, panY]);

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, gestureState) => gestureState.dy > 5,
      onPanResponderMove: (_, gestureState) => {
        if (gestureState.dy > 0) panY.setValue(gestureState.dy);
      },
      onPanResponderRelease: (_, gestureState) => {
        if (gestureState.dy > 100) closeWithAnimation();
        else Animated.spring(panY, { toValue: 0, useNativeDriver: true }).start();
      },
    })
  ).current;

  const handleItemPress = (item: string) => {
    if (multiSelect) {
      const current = Array.isArray(selectedValues) ? selectedValues : [];
      let newValues: any;

      if (item === '指定なし') {
        if (current.includes('指定なし')) {
          newValues = [];
        } else {
          newValues = ['指定なし'];
        }
      } else {
        if (current.includes(item)) {
          newValues = current.filter(i => i !== item);
        } else {
          newValues = [...current.filter(i => i !== '指定なし'), item];
        }
      }
      onSelect(newValues);
    } else {
      onSelect(item);
      closeWithAnimation();
    }
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={closeWithAnimation}>
      <View style={styles.modalOverlay}>
        <TouchableOpacity style={styles.modalBackdrop} onPress={closeWithAnimation} />
        <Animated.View style={[styles.modalSheet, { transform: [{ translateY: panY }], paddingBottom: Math.max(insets.bottom, 20) }]}>

          <View style={styles.modalHandleContainer} {...panResponder.panHandlers}>
            <View style={styles.modalHandle} />
          </View>

          <View style={styles.modalHeader}>
            <View style={styles.modalHeaderTitleArea} {...panResponder.panHandlers}>
              <Text style={styles.modalTitle}>{title}</Text>
              {multiSelect && <Text style={styles.multiSelectHint}>（複数選択可）</Text>}
            </View>
            <TouchableOpacity onPress={closeWithAnimation} style={styles.modalCloseBtn}>
              <Text style={styles.modalCloseText}>閉じる</Text>
            </TouchableOpacity>
          </View>

          <FlatList
            data={options}
            keyExtractor={(item) => item}
            renderItem={({ item }) => {
              const isSelected = multiSelect && Array.isArray(selectedValues) && selectedValues.includes(item);
              return (
                <TouchableOpacity style={styles.modalItem} onPress={() => handleItemPress(item)}>
                  <View style={styles.modalItemContent}>
                    <Text style={[styles.modalItemText, isSelected && styles.selectedItemText]}>{item}</Text>
                    {isSelected && <Ionicons name="checkmark-circle" size={22} color="#4A90E2" />}
                  </View>
                </TouchableOpacity>
              );
            }}
            style={{ maxHeight: height * 0.6 }}
          />
        </Animated.View>
      </View>
    </Modal>
  );
};

const calculateAge = (birthDate: any): string | number => {
  if (!birthDate) return '??';
  const birth = birthDate.toDate ? birthDate.toDate() : new Date(birthDate);
  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  if (today.getMonth() < birth.getMonth() || (today.getMonth() === birth.getMonth() && today.getDate() < birth.getDate())) age--;
  return age;
};

interface PreviewInfoRowProps {
  iconName: any;
  iconLib?: 'Ionicons' | 'MaterialCommunityIcons';
  label: string;
  value: string | string[];
}

const PreviewInfoRow: React.FC<PreviewInfoRowProps> = ({ iconName, iconLib, label, value }) => {
  const IconComponent = iconLib === 'MaterialCommunityIcons' ? MaterialCommunityIcons : Ionicons;
  const displayValue = Array.isArray(value) ? value.join(' / ') : value;

  return (
    <View style={previewStyles.infoRow}>
      <View style={previewStyles.infoLabelContainer}>
        <IconComponent name={iconName} size={18} color="#888" style={{ marginRight: 8 }} />
        <Text style={previewStyles.infoLabel}>{label}</Text>
      </View>
      <Text style={previewStyles.infoValue}>{displayValue || '未設定'}</Text>
    </View>
  );
};

const PreviewTag: React.FC<{ text: string }> = ({ text }) => (
  <View style={previewStyles.tag}>
    <Text style={previewStyles.tagText}>#{text}</Text>
  </View>
);

interface UserProfilePreviewModalProps {
  visible: boolean;
  onClose: () => void;
  formData: UserFormData;
  gender: string;
}
const UserProfilePreviewModal: React.FC<UserProfilePreviewModalProps> = ({ visible, onClose, formData, gender }) => {
  let imageSource = DEFAULT_MALE_IMAGE;

  if (formData.photoURL && typeof formData.photoURL === 'string' && formData.photoURL.startsWith('http')) {
    imageSource = { uri: formData.photoURL };
  } else {
    const targetGender = formData.gender || gender;

    if (targetGender === 'female') {
      imageSource = DEFAULT_FEMALE_IMAGE;
    } else {
      imageSource = DEFAULT_MALE_IMAGE;
    }
  }

  const age = calculateAge(formData.birthDate);

  const user = {
    name: formData.displayName || '名無しさん', age: age, location: formData.location || '未設定', birthPlace: formData.birthPlace,
    bio: formData.bio || '自己紹介文はまだありません。', isOnline: true, compatibility: '??', tags: formData.interests || [],
    question: '休日は何をされていますか？', height: formData.height, bodyType: formData.bodyType, bloodType: formData.bloodType,
    sibling: formData.sibling, personality: formData.personality, job: formData.occupation || formData.jobType, workTime: formData.workTime,
    income: formData.income, education: formData.education, holiday: formData.holiday, lifeStyle: formData.lifeStyle,
    cookingFrequency: formData.cookingFrequency, drink: formData.alcohol, smoke: formData.tobacco, roommate: formData.roommate,
    marital: formData.marital, kids: formData.child, marry: formData.marry, date: formData.date, encounter: formData.encounter,
    contactFrequency: formData.contactFrequency,
  };

  return (
    <Modal visible={visible} animationType="slide" transparent={false} onRequestClose={onClose}>
      <View style={previewStyles.container}>
        <StatusBar barStyle="light-content" backgroundColor="transparent" translucent={true} />
        <View style={previewStyles.previewHeaderContainer}>
          <SafeAreaView edges={['top']} style={{ backgroundColor: 'transparent' }}>
            <TouchableOpacity onPress={onClose} style={previewStyles.closePreviewButton}>
              <Ionicons name="close" size={28} color="#FFF" />
              <Text style={previewStyles.closePreviewText}>編集に戻る</Text>
            </TouchableOpacity>
          </SafeAreaView>
        </View>

        <ScrollView contentContainerStyle={{ paddingBottom: 120 }} showsVerticalScrollIndicator={false} bounces={false}>
          <View style={previewStyles.imageSliderContainer}>
            <Image source={imageSource} style={previewStyles.sliderImage} resizeMode="cover" />
            <LinearGradient colors={['transparent', 'rgba(0,0,0,0.1)', 'rgba(0,0,0,0.8)']} style={previewStyles.imageOverlay}>
              <View style={previewStyles.overlayContent}>
                <View style={previewStyles.leftInfoContainer}>
                  <View style={previewStyles.nameRow}>
                    <Text style={previewStyles.name}>{user.name}</Text>
                    <Text style={previewStyles.age}>{user.age}歳</Text>
                    {user.isOnline && <View style={previewStyles.onlineBadge} />}
                  </View>
                  <View style={previewStyles.locationRow}>
                    <Ionicons name="location-sharp" size={16} color="#FFF" style={{ marginRight: 4 }} />
                    <Text style={previewStyles.location}>{user.location}</Text>
                  </View>
                </View>
                <View style={previewStyles.matchBadgeContainer}>
                  <View style={previewStyles.matchBadgeCircle}>
                    <BlurView intensity={50} tint="dark" style={StyleSheet.absoluteFill} />
                    <View style={previewStyles.content}>
                      <MaterialCommunityIcons name="creation" size={24} color="#FFD700" style={previewStyles.icon} />
                      <Text style={previewStyles.matchPercentage}>{user.compatibility}%</Text>
                      <Text style={previewStyles.matchLabel}>Match</Text>
                    </View>
                  </View>
                </View>
              </View>
            </LinearGradient>
          </View>

          <View style={previewStyles.contentContainer}>
            {user.tags && user.tags.length > 0 && (
              <View style={previewStyles.tagsContainer}>
                {user.tags.map((tag: any, index: any) => <PreviewTag key={index} text={tag} />)}
              </View>
            )}

            <View style={previewStyles.section}>
              <Text style={previewStyles.bioTitle}>自己紹介</Text>
              <Text style={previewStyles.bioText}>{user.bio}</Text>
            </View>

            <View style={previewStyles.infoSection}>
              <Text style={previewStyles.sectionTitle}>基本プロフィール</Text>
              <View style={previewStyles.infoBox}>
                <PreviewInfoRow iconName="map-outline" iconLib="Ionicons" label="出身地" value={user.birthPlace} />
                <PreviewInfoRow iconName="resize" iconLib="Ionicons" label="身長" value={user.height} />
                <PreviewInfoRow iconName="body-outline" iconLib="Ionicons" label="体型" value={user.bodyType} />
                <PreviewInfoRow iconName="water-outline" iconLib="Ionicons" label="血液型" value={user.bloodType} />
                <PreviewInfoRow iconName="people-outline" iconLib="Ionicons" label="兄弟姉妹" value={user.sibling} />
                <PreviewInfoRow iconName="happy-outline" iconLib="Ionicons" label="性格" value={user.personality} />
              </View>
            </View>

            <View style={previewStyles.infoSection}>
              <Text style={previewStyles.sectionTitle}>仕事・学歴</Text>
              <View style={previewStyles.infoBox}>
                <PreviewInfoRow iconName="briefcase-outline" label="職業" value={user.job} />
                <PreviewInfoRow iconName="time-outline" iconLib="Ionicons" label="勤務時間" value={user.workTime} />
                <PreviewInfoRow iconName="cash-outline" label="年収" value={user.income} />
                <PreviewInfoRow iconName="school-outline" label="学歴" value={user.education} />
              </View>
            </View>

            <View style={previewStyles.infoSection}>
              <Text style={previewStyles.sectionTitle}>ライフスタイル</Text>
              <View style={previewStyles.infoBox}>
                <PreviewInfoRow iconName="sunny-outline" iconLib="Ionicons" label="生活リズム" value={user.lifeStyle} />
                <PreviewInfoRow iconName="restaurant-outline" iconLib="Ionicons" label="料理の頻度" value={user.cookingFrequency} />
                <PreviewInfoRow iconName="calendar-outline" label="休日" value={user.holiday} />
                <PreviewInfoRow iconName="beer-outline" iconLib="Ionicons" label="お酒" value={user.drink} />
                <PreviewInfoRow iconName="cigar" iconLib="MaterialCommunityIcons" label="タバコ" value={user.smoke} />
                <PreviewInfoRow iconName="home-outline" label="同居人" value={user.roommate} />
              </View>
            </View>

            <View style={previewStyles.infoSection}>
              <Text style={previewStyles.sectionTitle}>恋愛・結婚観</Text>
              <View style={previewStyles.infoBox}>
                <PreviewInfoRow iconName="chatbubble-ellipses-outline" iconLib="Ionicons" label="連絡頻度" value={user.contactFrequency} />
                <PreviewInfoRow iconName="ring" iconLib="MaterialCommunityIcons" label="婚姻歴" value={user.marital} />
                <PreviewInfoRow iconName="baby-carriage" iconLib="MaterialCommunityIcons" label="子供の有無" value={user.kids} />
                <PreviewInfoRow iconName="heart-outline" label="結婚意思" value={user.marry} />
                <PreviewInfoRow iconName="wallet-outline" label="初回デート" value={user.date} />
                <PreviewInfoRow iconName="chatbubbles-outline" label="出会い希望" value={user.encounter} />
              </View>
            </View>
          </View>
        </ScrollView>

      </View>
    </Modal>
  );
};

export default function ProfileEditScreen({ navigation }: any) {
  const insets = useSafeAreaInsets();
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [myGender, setMyGender] = useState<string>('male');
  const [previewVisible, setPreviewVisible] = useState(false);
  const [formData, setFormData] = useState<UserFormData>({
    displayName: '', bio: '', location: '', birthPlace: '', bloodType: '', height: '', bodyType: '', occupation: '', jobType: '', workTime: '',
    income: '', education: '', holiday: '', lifeStyle: '', cookingFrequency: '', alcohol: '', tobacco: '', marital: '', marry: '',
    roommate: '', date: '', child: '', sibling: '', encounter: '', contactFrequency: '', personality: [],
  });
  const [modalVisible, setModalVisible] = useState(false);
  const [currentModalConfig, setCurrentModalConfig] = useState<ModalConfig>({ title: '', options: [], fieldKey: '', multiSelect: false });

  const auth = getAuth();
  const db = getFirestore();

  const calculateCompleteness = (): number => {
    console.log(formData);
    const targetFields: (keyof UserFormData)[] = [
      'displayName', 'bio', 'location', 'birthPlace', 'bloodType', 'height', 'bodyType', 'occupation', 'jobType', 'workTime', 'income',
      'education', 'holiday', 'lifeStyle', 'cookingFrequency', 'alcohol', 'tobacco', 'marital', 'marry', 'roommate', 'date', 'child',
      'sibling', 'encounter', 'contactFrequency', 'personality', 'photoURL'
    ];

    let filledCount = 0;
    targetFields.forEach(key => {
      const val = formData[key];
      if (Array.isArray(val)) {
        const effectiveValues = val.filter(v => v !== '指定なし');
        if (effectiveValues.length > 0) filledCount++;
      } else if (val && val !== '' && val !== '指定なし') {
        filledCount++;
      }
    });
    return Math.round((filledCount / targetFields.length) * 100);
  };

  const completeness = calculateCompleteness();

  const getOptions = (key: string): string[] => {
    if (key === 'location' || key === 'birthPlace') return PREFECTURES;

    let options = OPTIONS[key];
    if (key === 'bodyType' || key === 'sibling') {
      const isFemale = myGender === 'female';
      options = isFemale ? options.female : options.male;
    }
    return ['指定なし', ...options];
  };

  useEffect(() => {
    const fetchProfile = async () => {
      const user = auth.currentUser;
      if (!user) {
        setLoading(false);
        return;
      }
      try {
        const docRef = doc(db, 'users', user.uid);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          const data = docSnap.data();
          if (data?.gender) setMyGender(data.gender);

          let safePersonality: string[] = [];
          if (Array.isArray(data?.personality)) {
            safePersonality = data.personality;
          } else if (typeof data?.personality === 'string' && data.personality !== '') {
            safePersonality = [data.personality];
          }

          setFormData(prev => ({
            ...prev,
            ...data,
            personality: safePersonality,
            bio: data?.bio || '',
          }));
        }
      } catch (error) {
        console.error("Firestore error:", error);
        Alert.alert('エラー', 'プロフィールの取得に失敗しました');
      } finally {
        setLoading(false);
      }
    };
    fetchProfile();
  }, []);

  const handleSave = async () => {
    const user = auth.currentUser;
    if (!user) {
      Alert.alert('エラー', 'ログインが必要です');
      return;
    }

    if (!formData.displayName || formData.displayName.trim() === '') {
      Alert.alert('必須項目エラー', 'ニックネームを入力してください');
      return;
    }

    setUploading(true);
    try {
      const docRef = doc(db, 'users', user.uid);
      await setDoc(docRef, {
        ...formData,
        updatedAt: serverTimestamp(),
      }, { merge: true });

      Alert.alert('完了', 'プロフィールを更新しました', [
        { text: 'OK', onPress: () => navigation.goBack() }
      ]);
    } catch (error) {
      console.error("Firestore update error:", error);
      Alert.alert('エラー', '保存に失敗しました');
    } finally {
      setUploading(false);
    }
  };

  const openModal = (key: keyof UserFormData, title: string, multiSelect = false) => {
    const options = getOptions(key as string);
    const safeOptions = Array.isArray(options) ? options : [];

    setCurrentModalConfig({ title, options: safeOptions, fieldKey: key, multiSelect });
    setModalVisible(true);
  };

  const handleSelect = (value: string | string[]) => {
    setFormData(prev => ({ ...prev, [currentModalConfig.fieldKey]: value }));
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#4A90E2" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <SafeAreaView style={{ flex: 1 }}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.headerBtn}>
            <Ionicons name="chevron-back" size={28} color="#333" />
          </TouchableOpacity>
          <View style={styles.headerCenter}>
            <Text style={styles.headerTitle}>プロフィール編集</Text>
          </View>
          <TouchableOpacity onPress={() => setPreviewVisible(true)} style={styles.headerBtn}>
            <Text style={styles.previewText}>プレビュー</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.progressContainer}>
          <Text style={styles.progressLabel}>完成度 {completeness}%</Text>

          <View style={styles.progressBarBg}>
            <View style={[styles.progressBarFill, { width: `${completeness}%` }]} />
          </View>
        </View>

        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={{ flex: 1 }}>
          <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
            <TouchableOpacity style={styles.photoManageCard} activeOpacity={0.8}
              onPress={() => navigation.navigate('PhotoManager')}
            >
              <LinearGradient colors={['#FF9A9E', '#FECFEF']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                style={styles.photoManageIconContainer}>
                <Ionicons name="camera" size={24} color="#FFF" />
              </LinearGradient>

              <View style={styles.photoManageTextContainer}>
                <Text style={styles.photoManageTitle}>プロフィール写真の設定</Text>
                <Text style={styles.photoManageSub}>魅力的な写真でマッチ率Up！</Text>
              </View>
              <View style={styles.photoManageArrow}>
                <Ionicons name="chevron-forward" size={20} color="#CCC" />
              </View>
            </TouchableOpacity>

            <Section title="自己紹介文">
              <View style={styles.bioContainer}>
                <TextInput style={styles.bioInput} multiline placeholder="趣味や休日の過ごし方などを書いてみましょう！"
                  value={formData.bio} onChangeText={(text) => setFormData(prev => ({ ...prev, bio: text }))}
                  maxLength={1000}
                />
                <Text style={styles.bioCharCount}>{formData.bio.length} / 1000</Text>
              </View>

              <TouchableOpacity activeOpacity={0.8} onPress={() => Alert.alert('AI機能', '近日公開予定！')}>
                <LinearGradient colors={['#8E2DE2', '#4A00E0']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.aiButton}>
                  <MaterialCommunityIcons name="magic-staff" size={20} color="#FFF" style={{ marginRight: 8 }} />
                  <Text style={styles.aiButtonText}>AIに自己紹介を書いてもらう</Text>
                  <View style={styles.aiBadge}><Text style={styles.aiBadgeText}>BETA</Text></View>
                </LinearGradient>
              </TouchableOpacity>
            </Section>

            <Section title="基本情報">
              <TextInputField
                label="ニックネーム" value={formData.displayName} onChangeText={t => setFormData(prev => ({ ...prev, displayName: t }))}
                required
              />

              <View style={styles.row}>
                <SelectField
                  label="居住地" value={formData.location} onPress={() => openModal('location', '居住地')} halfWidth
                />
                <SelectField
                  label="出身地" value={formData.birthPlace} onPress={() => openModal('birthPlace', '出身地')} halfWidth
                />
              </View>

              <SelectField
                label="血液型" value={formData.bloodType} onPress={() => openModal('bloodType', '血液型')}
              />

              <View style={styles.row}>
                <SelectField
                  label="身長" value={formData.height}
                  onPress={() => {
                    setCurrentModalConfig({
                      title: '身長', options: ['指定なし', ...HEIGHTS],
                      fieldKey: 'height'
                    });
                    setModalVisible(true);
                  }}
                  halfWidth
                />
                <SelectField
                  label="体型" value={formData.bodyType} onPress={() => openModal('bodyType', '体型')} halfWidth
                />
              </View>

              <SelectField
                label="兄弟姉妹" value={formData.sibling} onPress={() => openModal('sibling', '兄弟姉妹')}
              />
              <SelectField
                label="性格・タイプ" value={formData.personality} onPress={() => openModal('personality', '性格・タイプ', true)}
              />
            </Section>

            <Section title="仕事・学歴">
              <SelectField
                label="職業" value={formData.occupation} onPress={() => openModal('occupation', '職業')}
              />
              <SelectField
                label="職種" value={formData.jobType} onPress={() => openModal('jobType', '職種')}
              />
              <SelectField
                label="勤務時間" value={formData.workTime} onPress={() => openModal('workTime', '勤務時間')}
              />
              <SelectField
                label="年収" value={formData.income} onPress={() => openModal('income', '年収')}
              />
              <SelectField
                label="学歴" value={formData.education} onPress={() => openModal('education', '学歴')}
              />
            </Section>

            <Section title="ライフスタイル">
              <SelectField
                label="生活リズム" value={formData.lifeStyle} onPress={() => openModal('lifeStyle', '生活リズム')}
              />
              <SelectField
                label="料理の頻度" value={formData.cookingFrequency} onPress={() => openModal('cookingFrequency', '料理の頻度')}
              />
              <SelectField
                label="休日" value={formData.holiday} onPress={() => openModal('holiday', '休日')}
              />
              <View style={styles.row}>
                <SelectField
                  label="お酒" value={formData.alcohol} onPress={() => openModal('alcohol', 'お酒')} halfWidth
                />
                <SelectField
                  label="タバコ" value={formData.tobacco} onPress={() => openModal('tobacco', 'タバコ')} halfWidth
                />
              </View>
              <SelectField
                label="同居人" value={formData.roommate} onPress={() => openModal('roommate', '同居人')}
              />
            </Section>

            <Section title="恋愛・結婚観">
              <SelectField
                label="連絡頻度" value={formData.contactFrequency} onPress={() => openModal('contactFrequency', '連絡頻度')}
              />
              <View style={styles.row}>
                <SelectField
                  label="結婚歴" value={formData.marital} onPress={() => openModal('marital', '結婚歴')} halfWidth
                />
                <SelectField
                  label="子供の有無" value={formData.child} onPress={() => openModal('child', '子供の有無')} halfWidth
                />
              </View>

              <SelectField
                label="結婚に対する意思" value={formData.marry} onPress={() => openModal('marry', '結婚に対する意思')}
              />

              <SelectField
                label="出会うまでの希望" value={formData.encounter} onPress={() => openModal('encounter', '出会うまでの希望')}
              />

              <SelectField
                label="初回デート費用" value={formData.date} onPress={() => openModal('date', '初回デート費用')}
              />

            </Section>

            <View style={{ height: 100 }} />
          </ScrollView>
        </KeyboardAvoidingView>

        <View style={[styles.footer, { paddingBottom: insets.bottom + 10 }]}>
          <TouchableOpacity style={styles.saveButton} onPress={handleSave} disabled={uploading}>
            {uploading ? (
              <ActivityIndicator color="#FFF" />
            ) : (
              <>
                <Ionicons name="checkmark" size={24} color="#FFF" style={{ marginRight: 8 }} />
                <Text style={styles.saveButtonText}>プロフィールを更新する</Text>
              </>
            )}
          </TouchableOpacity>
        </View>

        <SelectionModal
          visible={modalVisible} title={currentModalConfig.title} options={currentModalConfig.options}
          multiSelect={currentModalConfig.multiSelect} selectedValues={formData[currentModalConfig.fieldKey]}
          onSelect={handleSelect} onClose={() => setModalVisible(false)}
        />

        <UserProfilePreviewModal
          visible={previewVisible} onClose={() => setPreviewVisible(false)} formData={formData} gender={myGender}
        />
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5F7FA', },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F5F7FA', },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16,
    paddingVertical: 12, backgroundColor: '#FFF',
  },
  headerBtn: { minWidth: 40, alignItems: 'center', justifyContent: 'center', padding: 4, },
  headerCenter: { flex: 1, alignItems: 'center', },
  headerTitle: { fontSize: 18, fontWeight: '800', color: '#333', },
  previewText: { fontSize: 14, color: '#4A90E2', fontWeight: '600', },
  progressContainer: {
    backgroundColor: '#FFF', paddingHorizontal: 16, paddingBottom: 16, alignItems: 'center', borderBottomWidth: 1,
    borderBottomColor: '#EEE',
  },
  progressLabel: { fontSize: 12, fontWeight: '700', color: '#4A90E2', marginBottom: 6, },
  progressBarBg: { width: '100%', height: 6, backgroundColor: '#F0F2F5', borderRadius: 3, },
  progressBarFill: { height: '100%', backgroundColor: '#4A90E2', borderRadius: 3, },
  scrollContent: { padding: 16, },
  section: {
    backgroundColor: '#FFF', borderRadius: 16, padding: 16, marginBottom: 16, shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 2, elevation: 2,
  },
  sectionHeaderRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 16, },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: '#333', },
  sectionSubTitle: { fontSize: 10, color: '#888', marginTop: 2, },
  fieldContainer: { marginBottom: 20, },
  halfWidthContainer: { flex: 0.48, },
  labelRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8, },
  label: { fontSize: 14, fontWeight: '700', color: '#555', },
  badge: { backgroundColor: '#FF6B6B', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, },
  badgeText: { color: '#FFF', fontSize: 10, fontWeight: '700', },
  inputBox: {
    backgroundColor: '#FFF', borderWidth: 1, borderColor: '#DDD', borderRadius: 12, padding: 14,
    fontSize: 16, color: '#333',
  },
  textArea: { minHeight: 120, textAlignVertical: 'top', lineHeight: 22, },
  charCount: { textAlign: 'right', fontSize: 12, color: '#999', marginTop: 4, },
  selectBox: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#FFF',
    borderWidth: 1, borderColor: '#DDD', borderRadius: 12, padding: 14, minHeight: 50,
  },
  selectValue: { fontSize: 16, color: '#333', flex: 1, },
  placeholderText: { color: '#AAA', },
  row: { flexDirection: 'row', justifyContent: 'space-between', },
  bioContainer: {
    backgroundColor: '#F9F9F9', borderWidth: 1, borderColor: '#E5E5E5', borderRadius: 12, padding: 12, marginBottom: 16,
  },
  bioInput: {
    fontSize: 15, color: '#333', lineHeight: 24, minHeight: 150, textAlignVertical: 'top',
  },
  bioCharCount: { textAlign: 'right', fontSize: 12, color: '#AAA', marginTop: 8, },
  aiButton: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 12,
    borderRadius: 25, marginTop: 4,
  },
  aiButtonText: { color: '#FFF', fontSize: 14, fontWeight: 'bold', },
  aiBadge: {
    marginLeft: 8, backgroundColor: 'rgba(255,255,255,0.2)', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4,
  },
  aiBadgeText: { color: '#FFF', fontSize: 9, fontWeight: 'bold', },
  footer: {
    position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: 'rgba(255,255,255,0.95)',
    padding: 16, borderTopWidth: 1, borderTopColor: '#EEE',
  },
  saveButton: {
    backgroundColor: '#4A90E2', borderRadius: 30, paddingVertical: 16, flexDirection: 'row', justifyContent: 'center',
    alignItems: 'center', shadowColor: "#4A90E2", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3,
    shadowRadius: 8, elevation: 5,
  },
  saveButtonText: { color: '#FFF', fontSize: 16, fontWeight: 'bold', },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end', },
  modalBackdrop: { ...StyleSheet.absoluteFillObject, },
  modalSheet: {
    backgroundColor: '#FFF', borderTopLeftRadius: 20, borderTopRightRadius: 20, maxHeight: '70%',
  },
  modalHandleContainer: { alignItems: 'center', paddingVertical: 10, },
  modalHandle: { width: 40, height: 4, backgroundColor: '#DDD', borderRadius: 2, },
  modalHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingBottom: 16,
    borderBottomWidth: 1, borderBottomColor: '#EEE',
  },
  modalHeaderTitleArea: { flex: 1, flexDirection: 'row', alignItems: 'center', paddingVertical: 5, },
  modalCloseBtn: { paddingLeft: 10, paddingVertical: 5, },
  modalTitle: { fontSize: 16, fontWeight: '700', color: '#333', },
  multiSelectHint: { fontSize: 12, color: '#888', marginLeft: 8, fontWeight: 'normal', },
  modalCloseText: { color: '#888', fontSize: 14, },
  modalItem: {
    paddingVertical: 16, paddingHorizontal: 20, borderBottomWidth: 1, borderBottomColor: '#F5F5F5',
  },
  modalItemContent: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', },
  modalItemText: { fontSize: 16, color: '#333', },
  selectedItemText: { color: '#4A90E2', fontWeight: '700', },
  photoManageCard: {
    backgroundColor: '#FFF', borderRadius: 16, padding: 16, marginBottom: 20, flexDirection: 'row', alignItems: 'center',
    shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 3,
  },
  photoManageIconContainer: {
    width: 50, height: 50, borderRadius: 25, justifyContent: 'center', alignItems: 'center', marginRight: 16,
  },
  photoManageTextContainer: { flex: 1, },
  photoManageTitle: { fontSize: 16, fontWeight: '700', color: '#333', marginBottom: 4, },
  photoManageSub: { fontSize: 12, color: '#FF6B6B', fontWeight: '600', },
  photoManageArrow: { paddingLeft: 8, },
});

const previewStyles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFF' },
  previewHeaderContainer: { position: 'absolute', top: 0, left: 0, right: 0, zIndex: 50, paddingHorizontal: 20, paddingTop: 10 },
  closePreviewButton: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.5)', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 24, alignSelf: 'flex-start' },
  closePreviewText: { color: '#FFF', fontWeight: 'bold', marginLeft: 4, fontSize: 14 },

  imageSliderContainer: { height: IMAGE_HEIGHT, position: 'relative', backgroundColor: '#222' },
  sliderImage: { width: width, height: IMAGE_HEIGHT },
  imageOverlay: { position: 'absolute', bottom: 0, left: 0, right: 0, paddingHorizontal: 20, paddingTop: 100, paddingBottom: 40, justifyContent: 'flex-end' },
  overlayContent: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', width: '100%' },
  leftInfoContainer: { flex: 1, paddingRight: 10 },
  nameRow: { flexDirection: 'row', alignItems: 'baseline', marginBottom: 4 },
  name: { fontSize: 32, fontWeight: '800', color: '#FFF', marginRight: 8, textShadowColor: 'rgba(0, 0, 0, 0.5)', textShadowOffset: { width: 0, height: 2 }, textShadowRadius: 6, letterSpacing: 0.5 },
  age: { fontSize: 24, fontWeight: '600', color: '#EEE', textShadowColor: 'rgba(0, 0, 0, 0.5)', textShadowOffset: { width: 0, height: 2 }, textShadowRadius: 6 },
  onlineBadge: { backgroundColor: '#22C55E', width: 12, height: 12, borderRadius: 6, marginLeft: 8, marginBottom: 6, borderWidth: 2, borderColor: '#FFF' },
  locationRow: { flexDirection: 'row', alignItems: 'center', opacity: 0.9 },
  location: { color: '#EEE', fontSize: 15, fontWeight: '500', textShadowColor: 'rgba(0, 0, 0, 0.5)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 3 },
  matchBadgeContainer: { marginLeft: 10, marginBottom: 5 },
  matchBadgeCircle: { width: 68, height: 68, borderRadius: 20, overflow: 'hidden', justifyContent: 'center', alignItems: 'center', borderColor: 'rgba(255, 255, 255, 0.1)', borderWidth: 1 },
  content: { alignItems: 'center', justifyContent: 'center', padding: 10, zIndex: 1 },
  icon: { marginBottom: 4, textShadowColor: 'rgba(255, 215, 0, 0.5)', textShadowOffset: { width: 0, height: 0 }, textShadowRadius: 10 },
  matchPercentage: { fontSize: 18, fontWeight: '800', color: '#FFF', includeFontPadding: false, textShadowColor: 'rgba(0, 0, 0, 0.3)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 2 },
  matchLabel: { fontSize: 10, fontWeight: '600', color: '#FFF', marginTop: -2, textShadowColor: 'rgba(0, 0, 0, 0.3)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 2 },

  contentContainer: { backgroundColor: '#FFF', borderTopLeftRadius: 32, borderTopRightRadius: 32, marginTop: -24, paddingTop: 32, paddingHorizontal: 24 },
  tagsContainer: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: 24 },
  tag: { backgroundColor: '#F3F5F7', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 24, marginRight: 8, marginBottom: 8, borderWidth: 1, borderColor: '#E8E8E8' },
  tagText: { color: '#444', fontSize: 13, fontWeight: '600' },
  bioTitle: { fontSize: 18, fontWeight: '700', color: '#111', marginBottom: 12 },
  bioText: { fontSize: 15, color: '#444', lineHeight: 26, letterSpacing: 0.5 },

  questionSection: { marginBottom: 32, backgroundColor: '#FFF5F7', padding: 20, borderRadius: 16, borderWidth: 1, borderColor: '#FFEBEE' },
  questionBadge: { backgroundColor: '#FF6B6B', alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12, marginBottom: 10 },
  questionBadgeText: { color: '#FFF', fontSize: 12, fontWeight: '700' },
  questionText: { fontSize: 16, fontWeight: '700', color: '#333', lineHeight: 24, marginBottom: 8 },
  questionNote: { fontSize: 12, color: '#FF6B6B', fontWeight: '500' },

  section: { marginBottom: 32 },
  infoSection: { marginBottom: 28 },
  sectionTitle: { fontSize: 16, fontWeight: '800', color: '#111', marginBottom: 16, borderLeftWidth: 4, borderLeftColor: '#4A90E2', paddingLeft: 10 },
  infoBox: { backgroundColor: '#F8F9FA', borderRadius: 20, padding: 20, borderWidth: 1, borderColor: '#EAEAEA' },
  infoRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#EAEAEA' },
  infoLabelContainer: { flexDirection: 'row', alignItems: 'center', width: '38%' },
  infoLabel: { fontSize: 13, color: '#555', fontWeight: '600' },
  infoValue: { fontSize: 15, color: '#444', fontWeight: '600', flex: 1, textAlign: 'right' },

  floatingButtonContainer: { position: 'absolute', bottom: 60, alignSelf: 'center', zIndex: 100, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 6, elevation: 8 },
  gradientButton: { width: 80, height: 80, borderRadius: 40, flexDirection: 'column', justifyContent: 'center', alignItems: 'center', paddingHorizontal: 10 },
  likeText: { color: '#FFF', fontSize: 12, fontWeight: 'bold', marginTop: 4 },
});