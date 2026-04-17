import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, Switch, Dimensions, Modal, FlatList,
  PanResponder, Animated, Easing,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

const { width, height } = Dimensions.get('window');

const COLORS = {
  primary: '#4a90E2', primaryLight: '#F0F7FF', text: '#333333', subText: '#8E8E93', border: '#E5E5EA',
  background: '#FFFFFF', modalOverlay: 'rgba(0,0,0,0.4)',
};

const REGIONS = [
  { name: '北海道・東北', prefs: ['北海道', '青森県', '岩手県', '宮城県', '秋田県', '山形県', '福島県'] },
  { name: '関東', prefs: ['茨城県', '栃木県', '群馬県', '埼玉県', '千葉県', '東京都', '神奈川県'] },
  { name: '中部', prefs: ['新潟県', '富山県', '石川県', '福井県', '山梨県', '長野県', '岐阜県', '静岡県', '愛知県'] },
  { name: '近畿', prefs: ['三重県', '滋賀県', '京都府', '大阪府', '兵庫県', '奈良県', '和歌山県'] },
  { name: '中国', prefs: ['鳥取県', '島根県', '岡山県', '広島県', '山口県'] },
  { name: '四国', prefs: ['徳島県', '香川県', '愛媛県', '高知県'] },
  { name: '九州・沖縄', prefs: ['福岡県', '佐賀県', '長崎県', '熊本県', '大分県', '宮崎県', '鹿児島県', '沖縄県'] },
];

const RangeSlider = ({ min, max, step = 1, initialLow, initialHigh, onValueChange, label, unit = '' }) => {
  const [sliderWidth, setSliderWidth] = useState(0);
  const [low, setLow] = useState(initialLow);
  const [high, setHigh] = useState(initialHigh);

  const widthRef = useRef(0);
  const lowRef = useRef(initialLow);
  const highRef = useRef(initialHigh);

  const gestureStartLow = useRef(initialLow);
  const gestureStartHigh = useRef(initialHigh);

  useEffect(() => { setLow(initialLow); }, [initialLow]);
  useEffect(() => { setHigh(initialHigh); }, [initialHigh]);

  useEffect(() => { lowRef.current = low; }, [low]);
  useEffect(() => { highRef.current = high; }, [high]);

  const handleLayout = (e) => {
    const w = e.nativeEvent.layout.width;
    setSliderWidth(w);
    widthRef.current = w;
  };

  const valueToPercent = (val) => {
    return ((val - min) / (max - min)) * 100;
  };

  const panLowResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: () => {
        gestureStartLow.current = lowRef.current;
      },
      onPanResponderMove: (evt, gestureState) => {
        if (widthRef.current === 0) return;

        const range = max - min;
        const diff = (gestureState.dx / widthRef.current) * range;

        let newValue = Math.round((gestureStartLow.current + diff) / step) * step;

        const currentHigh = highRef.current !== undefined ? highRef.current : max;
        newValue = Math.max(min, Math.min(currentHigh, newValue));

        if (newValue !== lowRef.current) {
          setLow(newValue);
          if (onValueChange) onValueChange(newValue, currentHigh);
        }
      },
    })
  ).current;

  const panHighResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: () => {
        gestureStartHigh.current = highRef.current;
      },
      onPanResponderMove: (evt, gestureState) => {
        if (widthRef.current === 0) return;

        const range = max - min;
        const diff = (gestureState.dx / widthRef.current) * range;

        let newValue = Math.round((gestureStartHigh.current + diff) / step) * step;

        const currentLow = lowRef.current !== undefined ? lowRef.current : min;
        newValue = Math.max(currentLow, Math.min(max, newValue));

        if (newValue !== highRef.current) {
          setHigh(newValue);
          if (onValueChange) onValueChange(currentLow, newValue);
        }
      },
    })
  ).current;

  return (
    <View style={styles.rangeContainer}>
      <View style={styles.rangeHeader}>
        <Text style={styles.rangeLabel}>{label}</Text>
        <Text style={styles.rangeValue}>{low}{unit} ～ {high}{unit}</Text>
      </View>

      <View
        style={styles.sliderContainer}
        onLayout={handleLayout}
      >
        <View style={styles.track} />
        <View
          style={[
            styles.trackActive,
            {
              left: `${valueToPercent(low)}%`,
              width: `${valueToPercent(high) - valueToPercent(low)}%`
            }
          ]}
        />
        <View
          style={[styles.thumb, { left: `${valueToPercent(low)}%` }]}
          {...panLowResponder.panHandlers}
          hitSlop={{ top: 20, bottom: 20, left: 20, right: 20 }}
        >
          <View style={styles.thumbLabel} />
        </View>
        <View
          style={[styles.thumb, { left: `${valueToPercent(high)}%` }]}
          {...panHighResponder.panHandlers}
          hitSlop={{ top: 20, bottom: 20, left: 20, right: 20 }}
        >
          <View style={styles.thumbLabel} />
        </View>
      </View>
    </View>
  );
};

const OPTIONS = {
  bodyType: {
    male: ['スリム', '普通', '筋肉質', 'がっちり', 'ややぽっちゃり', 'ぽっちゃり'],
    female: ['スリム', 'やや細身', '普通', 'グラマラス', 'ややぽっちゃり', 'ぽっちゃり']
  },
  education: ['短大/専門/高専卒', '高校卒', '大学卒', '大学院卒', 'その他'],
  income: ['～200万円', '200万円～400万円', '400万円～600万円', '600万円～800万円', '800万円～1000万円', '1000万円～1500万円', '1500万円～2000万円', '2000万円～3000万円', '3000万円～'],
  holiday: ['土日祝', '平日', '不定期/不定休', 'その他'],
  alcohol: ['飲まない', 'あまり飲まない', '付き合い程度', 'ときどき飲む', 'よく飲む'],
  tobacco: ['吸わない', '吸う(電子・加熱式)', '吸う(紙タバコ)', 'ときどき吸う', '非喫煙者の前では吸わない'],
  roommate: ['一人暮らし', '実家暮らし', '兄弟・姉妹と同居', '子供と同居', 'ペットと同居', '友達とシェアハウス', 'その他'],
  bloodType: ['A型', 'B型', 'O型', 'AB型'],
  marry: ['すぐにでもしたい', '2〜3年のうちに', 'いい人がいれば'],
  date: ['自分が多めに払う', '割り勘', '相談して決める'],
  child: ['なし', '別居', '同居'],
  marital: ['未婚', '離婚', '死別'],
  sibling: {
    male: ['一人っ子', '長男', '次男', '三男'],
    female: ['長女', '次女', '三女', '一人っ子']
  },
  encounter: ['すぐに会いたい', 'メッセージを重ねてから', '共体験から'],
  occupation: ['上場企業', 'メーカー/商社', 'IT/通信', '金融/保険', '不動産/建設', '広告/マスコミ', 'コンサルティング',
    '事務職,営業職', '公務員（国家/地方）', '警察官・消防士・自衛隊', '医師', '歯科医師', '看護師', '薬剤師・医療系専門職',
    '弁護士・公認会計士・税理士', '経営者・役員', '自営業・個人事業主', '投資家', 'クリエイター・WEBデザイナー', '接客・サービス業',
    '調理師・栄養士', 'アパレル・美容関係', '保育士・幼稚園教諭', 'キャビンアテンダント・航空関係', '芸能・モデル関係', '学生', 'フリーランス'
  ],
  personality: ['明るい・元気', '落ち着いている', '社交的・話し好き', 'マイペース', '穏やか・癒し系', 'クール', '情熱的', 'ポジティブ',
    '天然と言われる', '聞き上手', 'リーダー気質・引っ張るタイプ', '甘えん坊', '世話好き・尽くすタイプ', '人見知り・シャイ', '誠実・真面目',
    'ロマンチスト', 'アウトドア派', 'インドア派', 'フットワークが軽い', '計画的・慎重派', '直感・感覚派', '好奇心旺盛', '一人の時間も大切'
  ],
  workTime: ['日中(9時〜18時頃)', '朝・昼間メイン', '午後・夕方から', '夜勤・深夜メイン', 'シフト制', 'フレックス・自由'],
  lifeStyle: ['完全な朝型', 'どちらかといえば朝型', 'どちらかといえば夜型', '完全な夜型'],
  contactFrequency: ['マメに連絡したい', '1日1回〜数回程度', '気づいた時に返す', '要件がある時だけでOK', 'メッセージより電話派'],
  cookingFrequency: ['ほぼ毎日作る', '週に2〜3回程度', '休日や気が向いた時だけ', '今はしないが興味はある', '覚えたい', '食べる専門'],
};

const SelectChip = ({ label, selected, onPress }) => (
  <TouchableOpacity
    style={[
      styles.chip,
      selected ? styles.chipSelected : styles.chipUnSelected
    ]}
    onPress={onPress}
    activeOpacity={0.8}
  >
    <Text style={[
      styles.chipText,
      selected ? styles.chipTextSelected : styles.chipTextUnselected
    ]}>
      {label}
    </Text>
  </TouchableOpacity>
);

const DetailSelectButton = ({ label, value, onPress }) => (
  <TouchableOpacity
    style={styles.detailButton}
    activeOpacity={0.7}
    onPress={onPress}
  >
    <Text style={styles.detailLabel}>{label}</Text>
    <View style={styles.detailValueRow}>
      <Text style={styles.detailValue} numberOfLines={1}>{value}</Text>
      <Ionicons name="chevron-down" size={14} color="#CCC" />
    </View>
  </TouchableOpacity>
);

const PrefectureModal = ({ visible, selectedValues, onSelect, onClose }) => {
  const [tempSelected, setTempSelected] = useState([]);

  const insets = useSafeAreaInsets();

  const panY = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      setTempSelected(selectedValues || []);
    }
  }, [visible, selectedValues]);

  useEffect(() => {
    if (visible) {
      panY.setValue(0);
    }
  }, [visible]);

  const closeWithAnimation = useCallback(() => {
    Animated.timing(panY, {
      toValue: height,
      duration: 250,
      useNativeDriver: true,
      easing: Easing.out(Easing.cubic),
    }).start(() => {
      onClose();
    });
  }, [onClose, panY]);

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, gestureState) => {
        return gestureState.dy > 5 && Math.abs(gestureState.dy) > Math.abs(gestureState.dx);
      },
      onPanResponderMove: (_, gestureState) => {
        if (gestureState.dy > 0) {
          panY.setValue(gestureState.dy);
        }
      },
      onPanResponderRelease: (_, gestureState) => {
        if (gestureState.dy > 150 || gestureState.vy > 0.5) {
          closeWithAnimation();
        } else {
          Animated.spring(panY, {
            toValue: 0,
            useNativeDriver: true,
            bounciness: 4,
          }).start();
        }
      },
    })
  ).current;

  const toggleSelection = (pref) => {
    let newSelected;
    if (tempSelected.includes(pref)) {
      newSelected = tempSelected.filter(item => item !== pref);
    } else {
      newSelected = [...tempSelected, pref];
    }
    setTempSelected(newSelected);
  };

  const handleApply = () => {
    onSelect(tempSelected);
    closeWithAnimation();
  };

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="fade"
      onRequestClose={closeWithAnimation}
    >
      <View style={styles.modalOverlay}>
        <TouchableOpacity
          style={styles.modalBackdrop}
          onPress={closeWithAnimation}
          activeOpacity={1}
        />

        <Animated.View
          style={[
            styles.modalSheet,
            { transform: [{ translateY: panY }] },
            { paddingBottom: Math.max(insets.bottom, 20) }
          ]}
        >
          <View style={styles.modalHandleContainer} {...panResponder.panHandlers}>
            <View style={styles.modalHandle} />
          </View>

          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={closeWithAnimation} hitSlop={10}>
              <Text style={styles.modalCanselText}>キャンセル</Text>
            </TouchableOpacity>
            <View style={{ flex: 1, height: 40, backgroundColor: 'transparent' }} {...panResponder.panHandlers} />
            <TouchableOpacity onPress={handleApply} hitSlop={10}>
              <Text style={styles.modalDoneText}>決定</Text>
            </TouchableOpacity>
          </View>

          <ScrollView contentContainerStyle={styles.prefScrollContent}>
            {REGIONS.map((region, index) => (
              <View key={index} style={styles.prefRegionContainer}>
                <View style={styles.prefRegionHeader}>
                  <Text style={styles.prefRegionTitle}>{region.name}</Text>
                </View>
                <View style={styles.prefList}>
                  {region.prefs.map((pref) => {
                    const isSelected = tempSelected.includes(pref);
                    return (
                      <TouchableOpacity
                        key={pref}
                        style={[styles.prefItem, isSelected && styles.prefItemSelected]}
                        onPress={() => toggleSelection(pref)}
                        activeOpacity={0.7}
                      >
                        <Text style={[styles.prefItemText, isSelected && styles.prefItemTextSelected]}>
                          {pref}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
            ))}
          </ScrollView>
        </Animated.View>
      </View>
    </Modal>
  );
};

const SelectionModal = ({ visible, title, options, selectedValues, onSelect, onClose }) => {
  const [tempSelected, setTempSelected] = useState([]);
  const insets = useSafeAreaInsets();
  const panY = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      setTempSelected(selectedValues || []);
    }
  }, [visible, selectedValues]);

  useEffect(() => {
    if (visible) {
      panY.setValue(0);
    }
  }, [visible]);

  const closeWithAnimation = useCallback(() => {
    Animated.timing(panY, {
      toValue: height,
      duration: 250,
      useNativeDriver: true,
      easing: Easing.out(Easing.cubic),
    }).start(() => {
      onClose();
    });
  }, [onClose, panY]);

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, gestureState) => {
        return gestureState.dy > 5 && Math.abs(gestureState.dy) > Math.abs(gestureState.dx);
      },
      onPanResponderMove: (_, gestureState) => {
        if (gestureState.dy > 0) {
          panY.setValue(gestureState.dy);
        }
      },
      onPanResponderRelease: (_, gestureState) => {
        if (gestureState.dy > 150 || gestureState.vy > 0.5) {
          closeWithAnimation();
        } else {
          Animated.spring(panY, {
            toValue: 0,
            useNativeDriver: true,
            bounciness: 4,
          }).start();
        }
      },
    })
  ).current;

  const toggleSelection = (option) => {
    let newSelected;
    if (tempSelected.includes(option)) {
      newSelected = tempSelected.filter(item => item !== option);
    } else {
      newSelected = [...tempSelected, option];
    }
    setTempSelected(newSelected);
  };

  const handleApply = () => {
    onSelect(tempSelected);
    closeWithAnimation();
  };

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="fade"
      onRequestClose={closeWithAnimation}
    >
      <View style={styles.modalOverlay}>
        <TouchableOpacity
          style={styles.modalBackdrop}
          onPress={closeWithAnimation}
          activeOpacity={1}
        />

        <Animated.View
          style={[
            styles.modalSheet,
            { transform: [{ translateY: panY }] },
            { paddingBottom: Math.max(insets.bottom, 40) }
          ]}
        >
          <View style={styles.modalHandleContainer} {...panResponder.panHandlers}>
            <View style={styles.modalHandle} />
          </View>

          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={closeWithAnimation} hitSlop={10}>
              <Text style={styles.modalCanselText}>キャンセル</Text>
            </TouchableOpacity>
            <View style={{ flex: 1, height: 40, backgroundColor: 'transparent' }} {...panResponder.panHandlers} />
            <TouchableOpacity onPress={handleApply} hitSlop={10}>
              <Text style={styles.modalDoneText}>決定</Text>
            </TouchableOpacity>
          </View>

          <FlatList
            data={options}
            keyExtractor={(item) => item}
            contentContainerStyle={styles.listContainer}
            showVerticalScrollIndicator={false}
            renderItem={({ item }) => {
              const isSelected = tempSelected.includes(item);
              return (
                <TouchableOpacity
                  style={[styles.listItem, isSelected && styles.listItemSelected]}
                  onPress={() => toggleSelection(item)}
                  activeOpacity={0.7}
                >
                  <Text style={[
                    styles.listItemText,
                    isSelected && styles.listItemTextSelected]}>
                    {item}
                  </Text>

                  <View
                    style={[
                      styles.checkIconContainer,
                      isSelected ? styles.checkIconContainerSelected : styles.checkIconContainerUnselected
                    ]}
                  >
                    <Ionicons
                      name="checkmark"
                      size={14}
                      color={isSelected ? "#FFF" : "#CCCCCC"}
                    />
                  </View>
                </TouchableOpacity>
              );
            }}
          />
        </Animated.View>
      </View>
    </Modal>
  );
};

export default function SearchFilterScreen({ navigation, route }) {
  const insets = useSafeAreaInsets();
  const initialFilters = route.params?.currentFilters || {};
  const myGender = route.params?.myGender;
  const [sortType, setSortType] = useState(initialFilters.sortType || 'match');
  const [hasPhoto, setHasPhoto] = useState(initialFilters.hasPhoto !== undefined ? initialFilters.hasPhoto : true);
  const [minAge, setMinAge] = useState(initialFilters.minAge || 20);
  const [maxAge, setMaxAge] = useState(initialFilters.maxAge || 40);
  const [enableHeightFilter, setEnableHeightFilter] = useState(initialFilters.enableHeightFilter || false);
  const [minHeight, setMinHeight] = useState(initialFilters.minHeight || 150);
  const [maxHeight, setMaxHeight] = useState(initialFilters.maxHeight || 180);
  const [residenceIn, setResidenceIn] = useState(() => {
    if (initialFilters.residenceIn && initialFilters.residenceIn.length > 0) {
      return initialFilters.residenceIn;
    }
    const userRegion = initialFilters.regionName;
    if (userRegion && userRegion !== '未設定') {
      const targetRegion = REGIONS.find(r =>
        r.prefs.some(pref => userRegion.includes(pref) || pref.includes(userRegion))
      );
      if (targetRegion) {
        return [...targetRegion.prefs];
      }
    }
    return [];
  });
  const [bodyType, setBodyType] = useState(initialFilters.bodyType || []);
  const [education, setEducation] = useState(initialFilters.education || []);
  const [income, setIncome] = useState(initialFilters.income || []);
  const [holiday, setHoliday] = useState(initialFilters.holiday || []);
  const [alcohol, setAlcohol] = useState(initialFilters.alcohol || []);
  const [tobacco, setTobacco] = useState(initialFilters.tobacco || []);
  const [roommate, setRoommate] = useState(initialFilters.roommate || []);
  const [bloodType, setBloodType] = useState(initialFilters.bloodType || []);
  const [marry, setMarry] = useState(initialFilters.marry || []);
  const [date, setDate] = useState(initialFilters.date || []);
  const [child, setChild] = useState(initialFilters.child || []);
  const [marital, setMarital] = useState(initialFilters.marital || []);
  const [sibling, setSibling] = useState(initialFilters.sibling || []);
  const [encounter, setEncounter] = useState(initialFilters.encounter || []);
  const [occupation, setOccupation] = useState(initialFilters.occupation || []);
  const [personality, setPersonality] = useState(initialFilters.personality || []);
  const [workTime, setWorkTime] = useState(initialFilters.workTime || []);
  const [lifeStyle, setLifeStyle] = useState(initialFilters.lifeStyle || []);
  const [contactFrequency, setContactFrequency] = useState(initialFilters.contactFrequency || []);
  const [cookingFrequency, setCookingFrequency] = useState(initialFilters.cookingFrequency || []);
  const [birthPlace, setBirthPlace] = useState(initialFilters.birthPlace || []);
  const [regionName, setRegionName] = useState(initialFilters.regionName || '未設定');
  const [modalVisible, setModalVisible] = useState(false);
  const [currentModalType, setCurrentModalType] = useState(null);
  const [prefModalVisible, setPrefModalVisible] = useState(false);
  const [birthPlaceModalVisible, setBirthPlaceModalVisible] = useState(false);

  const handleClose = () => {
    navigation.goBack();
  };

  const handleApply = () => {
    const filters = {
      sortType, hasPhoto, minAge, maxAge, enableHeightFilter, minHeight: enableHeightFilter ? minHeight : null,
      maxHeight: enableHeightFilter ? maxHeight : null, residenceIn, bodyType, education, income, holiday, alcohol, tobacco, roommate,
      bloodType, marry, date, child, marital, sibling, encounter, occupation, personality, workTime, lifeStyle, contactFrequency,
      cookingFrequency, birthPlace,
    };

    if (route.params?.onApply) {
      route.params.onApply(filters);
      navigation.goBack();
    } else {
      console.warn('onApply callback not found');
      navigation.goBack();
    }
  };

  const handleReset = () => {
    setSortType('match'); setHasPhoto(false); setMinAge(20); setMaxAge(40); setEnableHeightFilter(false);
    setMinHeight(150); setMaxHeight(180); setResidenceIn([]); setBodyType([]); setEducation([]); setIncome([]); setHoliday([]);
    setAlcohol([]); setTobacco([]); setRoommate([]); setBloodType([]); setMarry([]); setDate([]); setChild([]); setMarital([]);
    setSibling([]); setEncounter([]); setOccupation([]); setPersonality([]); setWorkTime([]); setLifeStyle([]); setContactFrequency([]);
    setCookingFrequency([]); setBirthPlace([]);
  };

  const openModal = (type) => {
    setCurrentModalType(type);
    setModalVisible(true);
  };

  const getModalConfig = () => {
    switch (currentModalType) {
      case 'bodyType':
        const options = (myGender === '女性' || myGender === 'female' || myGender === 2)
          ? OPTIONS.bodyType.male
          : OPTIONS.bodyType.female;
        return { title: '体型', options, values: bodyType, setter: setBodyType };
      case 'education':
        return { title: '学歴', options: OPTIONS.education, values: education, setter: setEducation };
      case 'income':
        return { title: '年収', options: OPTIONS.income, values: income, setter: setIncome };
      case 'holiday':
        return { title: '休日', options: OPTIONS.holiday, values: holiday, setter: setHoliday };
      case 'alcohol':
        return { title: 'お酒', options: OPTIONS.alcohol, values: alcohol, setter: setAlcohol };
      case 'tobacco':
        return { title: 'タバコ', options: OPTIONS.tobacco, values: tobacco, setter: setTobacco };
      case 'roommate':
        return { title: '同居人', options: OPTIONS.roommate, values: roommate, setter: setRoommate };
      case 'sibling':
        const option = (myGender === '女性' || myGender === 'female' || myGender === 2)
          ? OPTIONS.sibling.male
          : OPTIONS.sibling.female;
        return { title: "兄弟姉妹", options: option, values: sibling, setter: setSibling };
      case 'bloodType':
        return { title: '血液型', options: OPTIONS.bloodType, values: bloodType, setter: setBloodType };
      case 'marry':
        return { title: '結婚意思', options: OPTIONS.marry, values: marry, setter: setMarry };
      case 'date':
        return { title: '初回デート費用', options: OPTIONS.date, values: date, setter: setDate };
      case 'child':
        return { title: '子供の有無', options: OPTIONS.child, values: child, setter: setChild };
      case 'marital':
        return { title: '結婚歴', options: OPTIONS.marital, values: marital, setter: setMarital };
      case 'encounter':
        return { title: '出会うまでの希望', options: OPTIONS.encounter, values: encounter, setter: setEncounter };
      case 'occupation':
        return { title: '職種', options: OPTIONS.occupation, values: occupation, setter: setOccupation };
      case 'personality':
        return { title: '性格/タイプ', options: OPTIONS.personality, values: personality, setter: setPersonality };
      case 'workTime':
        return { title: '勤務時間', options: OPTIONS.workTime, values: workTime, setter: setWorkTime };
      case 'lifeStyle':
        return { title: '生活リズム', options: OPTIONS.lifeStyle, values: lifeStyle, setter: setLifeStyle };
      case 'contactFrequency':
        return { title: '連絡頻度', options: OPTIONS.contactFrequency, values: contactFrequency, setter: setContactFrequency };
      case 'cookingFrequency':
        return { title: '料理の頻度', options: OPTIONS.cookingFrequency, values: cookingFrequency, setter: setCookingFrequency };
      default:
        return { title: '', options: [], values: [], setter: () => { } };
    }
  };

  const modalConfig = getModalConfig();

  const getDisplayValue = (values) => {
    if (!values || values.length === 0) return 'こだわらない';
    if (values.length === 1) return values[0];
    return `${values[0]} 他${values.length - 1}件`;
  };

  return (
    <View style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
        <View style={styles.header}>
          <TouchableOpacity onPress={handleClose} style={styles.closeButton}>
            <Ionicons name="chevron-back" size={28} color="#333" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>検索条件</Text>
          <TouchableOpacity onPress={handleReset}>
            <Text style={styles.resetText}>クリア</Text>
          </TouchableOpacity>
        </View>

        <ScrollView
          contentContainerStyle={[
            styles.scrollContent,
            { paddingBottom: 120 + Math.max(insets.bottom, 20) }
          ]}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>並び替え</Text>
            <View style={styles.chipContainer}>
              {[
                { key: 'match', label: 'センスマッチ率順' },
                { key: 'login', label: 'ログイン順' },
                { key: 'popularity', label: 'いいね多い順' },
                { key: 'new', label: '新着' }
              ].map((item) => (
                <SelectChip
                  key={item.key}
                  label={item.label}
                  selected={sortType === item.key}
                  onPress={() => setSortType(item.key)}
                />
              ))}
            </View>
          </View>

          <View style={styles.divider} />

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>基本ステータス</Text>

            <RangeSlider
              label="年齢"
              min={18} max={80}
              initialLow={minAge} initialHigh={maxAge}
              unit="歳"
              onValueChange={(l, h) => { setMinAge(l); setMaxAge(h); }}
            />

            <View style={{ marginTop: 12 }}>
              <DetailSelectButton
                label="居住地"
                value={getDisplayValue(residenceIn)}
                onPress={() => setPrefModalVisible(true)}
              />
            </View>

            <View style={[styles.switchRow, { marginTop: 24, marginBottom: 8 }]}>
              <Text style={styles.switchLabel}>写真があるユーザーのみ表示</Text>
              <Switch
                value={hasPhoto}
                onValueChange={setHasPhoto}
                trackColor={{ false: COLORS.border, true: COLORS.primary }}
                thumbColor={'#FFFFFF'}
              />
            </View>
          </View>

          <View style={styles.divider} />

          <View style={[styles.section, { paddingBottom: 0 }]}>
            <Text style={styles.sectionTitle}>詳細プロフィール</Text>

            <View style={styles.heightFilterContainer}>
              <View style={styles.switchRow}>
                <Text style={styles.detailLabel}>身長</Text>
                <Switch
                  value={enableHeightFilter}
                  onValueChange={setEnableHeightFilter}
                  trackColor={{ false: COLORS.border, true: COLORS.primary }}
                  thumbColor={'#FFFFFF'}
                />
              </View>
              {enableHeightFilter && (
                <View style={{ marginTop: 12 }}>
                  <RangeSlider
                    label=""
                    min={130} max={200}
                    initialLow={minHeight} initialHigh={maxHeight}
                    unit="cm"
                    onValueChange={(l, h) => { setMinHeight(l); setMaxHeight(h); }}
                  />
                </View>
              )}
            </View>
            <View style={styles.separator} />

            <View style={styles.detailList}>
              <DetailSelectButton label="出身地" value={getDisplayValue(birthPlace)} isActive={birthPlace.length > 0}
                onPress={() => setBirthPlaceModalVisible(true)} />
              <View style={styles.separator} />

              <DetailSelectButton label="体型" value={getDisplayValue(bodyType)} isActive={bodyType.length > 0}
                onPress={() => openModal('bodyType')} />
              <View style={styles.separator} />

              <DetailSelectButton label="学歴" value={getDisplayValue(education)} isActive={education.length > 0}
                onPress={() => openModal('education')} />
              <View style={styles.separator} />

              <DetailSelectButton label="年収" value={getDisplayValue(income)} isActive={income.length > 0}
                onPress={() => openModal('income')} />
              <View style={styles.separator} />

              <DetailSelectButton label="職種" value={getDisplayValue(occupation)} isActive={occupation.length > 0}
                onPress={() => openModal('occupation')} />
              <View style={styles.separator} />

              <DetailSelectButton label="勤務時間" value={getDisplayValue(workTime)} isActive={workTime.length > 0}
                onPress={() => openModal('workTime')} />
              <View style={styles.separator} />

              <DetailSelectButton label="休日" value={getDisplayValue(holiday)} isActive={holiday.length > 0}
                onPress={() => openModal('holiday')} />
              <View style={styles.separator} />

              <DetailSelectButton label="生活リズム" value={getDisplayValue(lifeStyle)} isActive={lifeStyle.length > 0}
                onPress={() => openModal('lifeStyle')} />
              <View style={styles.separator} />

              <DetailSelectButton label="料理の頻度" value={getDisplayValue(cookingFrequency)} isActive={cookingFrequency.length > 0}
                onPress={() => openModal('cookingFrequency')} />
              <View style={styles.separator} />

              <DetailSelectButton label="お酒" value={getDisplayValue(alcohol)} isActive={alcohol.length > 0}
                onPress={() => openModal('alcohol')} />
              <View style={styles.separator} />

              <DetailSelectButton label="タバコ" value={getDisplayValue(tobacco)} isActive={tobacco.length > 0}
                onPress={() => openModal('tobacco')} />
              <View style={styles.separator} />

              <DetailSelectButton label="同居人" value={getDisplayValue(roommate)} isActive={roommate.length > 0}
                onPress={() => openModal('roommate')} />
              <View style={styles.separator} />
              <DetailSelectButton label="血液型" value={getDisplayValue(bloodType)} isActive={bloodType.length > 0}
                onPress={() => openModal('bloodType')} />
              <View style={styles.separator} />
              <DetailSelectButton label="兄弟姉妹" value={getDisplayValue(sibling)} isActive={sibling.length > 0}
                onPress={() => openModal('sibling')} />
              <View style={styles.separator} />

              <DetailSelectButton label="連絡頻度" value={getDisplayValue(contactFrequency)} isActive={contactFrequency.length > 0}
                onPress={() => openModal('contactFrequency')} />
              <View style={styles.separator} />

              <DetailSelectButton label="結婚意思" value={getDisplayValue(marry)} isActive={marry.length > 0}
                onPress={() => openModal('marry')} />
              <View style={styles.separator} />
              <DetailSelectButton label="初回デート費用" value={getDisplayValue(date)} isActive={date.length > 0}
                onPress={() => openModal('date')} />
              <View style={styles.separator} />
              <DetailSelectButton label="子供の有無" value={getDisplayValue(child)} isActive={child.length > 0}
                onPress={() => openModal('child')} />
              <View style={styles.separator} />
              <DetailSelectButton label="結婚歴" value={getDisplayValue(marital)} isActive={marital.length > 0}
                onPress={() => openModal('marital')} />
              <View style={styles.separator} />
              <DetailSelectButton label="出会うまでの希望" value={getDisplayValue(encounter)} isActive={encounter.length > 0}
                onPress={() => openModal('encounter')} />
              <View style={styles.separator} />
              <DetailSelectButton label="性格/タイプ" value={getDisplayValue(personality)} isActive={personality.length > 0}
                onPress={() => openModal('personality')} />
              <View style={styles.separator} />
            </View>
          </View>

          <View style={styles.section}>
          </View>

        </ScrollView>

        <View
          style={[
            styles.footer,
            { paddingBottom: Math.max(insets.bottom, 16) }
          ]}
        >
          <TouchableOpacity
            style={styles.applyButton}
            activeOpacity={0.9}
            onPress={handleApply}
          >
            <Ionicons name="search" size={18} color="#FFF" style={{ marginRight: 8 }} />
            <Text style={styles.applyButtonText}>この条件で検索</Text>
          </TouchableOpacity>
        </View>

        <SelectionModal
          visible={modalVisible}
          title={modalConfig.title}
          options={modalConfig.options}
          selectedValues={modalConfig.values}
          onSelect={modalConfig.setter}
          onClose={() => setModalVisible(false)}
        />

        <PrefectureModal
          visible={prefModalVisible}
          selectedValues={residenceIn}
          onSelect={setResidenceIn}
          onClose={() => setPrefModalVisible(false)}
        />

        <PrefectureModal
          visible={birthPlaceModalVisible}
          selectedValues={birthPlace}
          onSelect={setBirthPlace}
          onClose={() => setBirthPlaceModalVisible(false)}
        />
      </SafeAreaView>
    </View >
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  safeArea: { flex: 1 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#F2F2F2' },
  headerTitle: { fontSize: 16, fontWeight: '700', color: COLORS.text },
  resetText: { fontSize: 14, color: COLORS.subText },
  iconButton: { padding: 4 },
  scrollContent: { paddingBottom: 100 },
  section: { paddingHorizontal: 20, paddingVertical: 24 },
  sectionTitle: { fontSize: 17, fontWeight: '700', color: COLORS.text, marginBottom: 16 },
  divider: { height: 8, backgroundColor: '#F9F9F9' },
  chipContainer: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  chip: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 24, borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.background, marginRight: 8, marginBottom: 8 },
  chipSelected: { backgroundColor: COLORS.primary, borderColor: COLORS.primary, shadowColor: COLORS.primary, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.2, shadowRadius: 4, elevation: 3 },
  chipText: { fontSize: 13, fontWeight: '600', color: COLORS.subText },
  chipTextSelected: { color: '#FFF' },
  rangeContainer: { marginBottom: 20 },
  rangeHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12 },
  rangeLabel: { fontSize: 14, fontWeight: '600', color: COLORS.text },
  rangeValue: { fontSize: 16, fontWeight: '700', color: COLORS.primary },
  sliderContainer: { height: 40, justifyContent: 'center', position: 'relative', marginHorizontal: 12 },
  track: { height: 4, backgroundColor: COLORS.border, borderRadius: 2, width: '100%', position: 'absolute' },
  trackActive: { height: 4, backgroundColor: COLORS.primary, borderRadius: 2, position: 'absolute' },
  thumb: { width: 28, height: 28, borderRadius: 14, backgroundColor: '#FFF', borderWidth: 0.5, borderColor: 'rgba(0,0,0,0.1)', position: 'absolute', top: 6, marginLeft: -14, shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.3, shadowRadius: 3, elevation: 4, justifyContent: 'center', alignItems: 'center' },
  thumbLabel: { width: 8, height: 8, borderRadius: 4, backgroundColor: COLORS.primary },
  locationContainer: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 12 },
  locationValueRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.surface, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8 },
  locationText: { marginLeft: 4, fontSize: 14, fontWeight: '600', color: COLORS.text },
  noteText: { fontSize: 11, color: COLORS.subText, marginTop: 8 },
  heightFilterContainer: { paddingVertical: 16 },
  detailList: {},
  detailButton: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 16 },
  detailButtonActive: {},
  detailLabel: { fontSize: 15, color: COLORS.text, fontWeight: '500' },
  detailLabelActive: { color: COLORS.text },
  detailValueRow: { flexDirection: 'row', alignItems: 'center' },
  detailValue: { fontSize: 14, color: COLORS.subText, marginRight: 8, maxWidth: width * 0.5, textAlign: 'right' },
  detailValueActive: { color: COLORS.primary, fontWeight: '600' },
  separator: { height: 1, backgroundColor: '#F0F0F0', marginLeft: 0 },
  switchRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  switchLabel: { fontSize: 15, fontWeight: '500', color: COLORS.text },
  footer: { position: 'absolute', bottom: 0, left: 0, right: 0, padding: 16, backgroundColor: 'rgba(255,255,255,0.95)', borderTopWidth: 1, borderTopColor: '#F0F0F0' },
  applyButton: { backgroundColor: COLORS.primary, borderRadius: 30, paddingVertical: 16, alignItems: 'center', shadowColor: COLORS.primary, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 5 },
  applyButtonText: { color: '#FFF', fontSize: 16, fontWeight: '700' },
  modalOverlay: { flex: 1, backgroundColor: COLORS.modalOverlay, justifyContent: 'flex-end' },
  modalBackdrop: { ...StyleSheet.absoluteFillObject },
  modalSheet: { backgroundColor: '#FFF', borderTopLeftRadius: 20, borderTopRightRadius: 20, maxHeight: '85%', paddingBottom: 40 },
  modalHandleContainer: { alignItems: 'center', paddingTop: 12, paddingBottom: 8, height: 30, width: '100%' },
  modalHandle: { width: 40, height: 4, backgroundColor: '#E0E0E0', borderRadius: 2 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingBottom: 16, borderBottomWidth: 1, borderBottomColor: '#F5F5F5' },
  modalTitle: { fontSize: 17, fontWeight: '700', color: COLORS.text },
  modalCanselText: { fontSize: 15, color: COLORS.subText },
  modalDoneText: { fontSize: 15, fontWeight: '600', color: COLORS.primary },
  listContainer: { paddingVertical: 8 },
  listItem: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 16, paddingHorizontal: 24 },
  listItemSelected: { backgroundColor: COLORS.primaryLight },
  listItemText: { fontSize: 16, color: COLORS.text },
  listItemTextSelected: { color: COLORS.primary, fontWeight: '700' },
  checkIconContainer: { borderRadius: 10, width: 20, height: 20, justifyContent: 'center', alignItems: 'center' },
  checkIconContainerSelected: { backgroundColor: COLORS.primary, borderWidth: 0 },
  checkIconContainerUnselected: { backgroundColor: 'transparent', borderWidth: 1, borderColor: '#E5E5EA' },
  prefScrollContent: { paddingHorizontal: 20, paddingBottom: 50 },
  prefRegionContainer: { marginBottom: 24 },
  prefRegionHeader: { marginBottom: 10, borderBottomWidth: 1, borderBottomColor: '#EEEEEE', paddingBottom: 6 },
  prefRegionTitle: { fontSize: 14, fontWeight: '700', color: COLORS.subText },
  prefList: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  prefItem: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, borderWidth: 1, borderColor: COLORS.border, backgroundColor: '#FFF', marginBottom: 0 },
  prefItemSelected: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  prefItemText: { fontSize: 13, color: COLORS.text },
  prefItemTextSelected: { color: '#FFF', fontWeight: '600' }
});