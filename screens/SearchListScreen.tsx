import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, FlatList, Image, Dimensions, TouchableOpacity,
  StatusBar, TextInput, ScrollView, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Ionicons from 'react-native-vector-icons/Ionicons';
import LinearGradient from 'react-native-linear-gradient';
import auth from '@react-native-firebase/auth';
import firestore, { FirebaseFirestoreTypes } from '@react-native-firebase/firestore';

const { width } = Dimensions.get('window');

const PAGE_SIZE = 10;
const ONLINE_THRESHOLD_MINUTES = 10;

const DEFAULT_MALE_IMAGE: any = require('../assets/man.png');
const DEFAULT_FEMALE_IMAGE: any = require('../assets/woman.png');

const FILTER_TAGS = ['センスマッチング率順', 'ログイン順', '新着', 'いいね多い順'];

const REGIONS: Record<string, string[]> = {
  '北海道': ['北海道'],
  '東北': ['青森県', '岩手県', '宮城県', '秋田県', '山形県', '福島県'],
  '関東': ['茨城県', '栃木県', '群馬県', '埼玉県', '千葉県', '東京都', '神奈川県'],
  '中部': ['新潟県', '富山県', '石川県', '福井県', '山梨県', '長野県', '岐阜県', '静岡県', '愛知県'],
  '近畿': ['三重県', '滋賀県', '京都府', '大阪府', '兵庫県', '奈良県', '和歌山県'],
  '中国': ['鳥取県', '島根県', '岡山県', '広島県', '山口県'],
  '四国': ['徳島県', '香川県', '愛媛県', '高知県'],
  '九州沖縄': ['福岡県', '佐賀県', '長崎県', '熊本県', '大分県', '宮崎県', '鹿児島県', '沖縄県']
};

const getRegionByPrefecture = (prefecture: string): string | null => {
  for (const [region, prefectures] of Object.entries(REGIONS)) {
    if (prefectures.includes(prefecture)) return region;
  }
  return null;
};

interface UserData {
  id: string; name: string; age: number | string; location: string; image: any; tags: string[]; compatibility: number; isOnline: boolean;
  bio: string; gender?: string | number; birthDate?: any; photoURL?: string; interests?: string[]; lastSeen?: any;
  privacySettings?: { ghostMode?: boolean }; displayName?: string; height?: number; bodyType?: string; education?: string;
  income?: string; holiday?: string; drink?: string; smoke?: string; roommate?: string; bloodType?: string; marry?: string;
  date?: string; child?: string; marital?: string; sibling?: string; encounter?: string; occupation?: string; personality?: string;
  workTime?: string; lifeStyle?: string; contactFrequency?: string; cookingFrequency?: string; birthPlace?: string; agreedAt?: any;
  receivedLikesCount?: number;
}

interface ActiveFilters {
  residenceIn?: string[]; regionName?: string; sortType?: string; minAge?: number; maxAge?: number; hasPhoto?: boolean; minHeight?: number;
  maxHeight?: number; bodyType?: string[]; education?: string[]; income?: string[]; holiday?: string[]; alcohol?: string[];
  tobacco?: string[]; roommate?: string[]; bloodType?: string[]; marry?: string[]; date?: string[]; child?: string[]; marital?: string[];
  sibling?: string[]; encounter?: string[]; occupation?: string[]; personality?: string[]; workTime?: string[]; lifeStyle?: string[];
  contactFrequency?: string[]; cookingFrequency?: string[]; birthPlace?: string[];
}

interface TagProps { text: string; isGrid: boolean; }

const Tag: React.FC<TagProps> = ({ text, isGrid }) => (
  <View style={[styles.tag, isGrid ? styles.tagGrid : styles.tagList]}>
    <Text style={[styles.tagText, isGrid ? styles.tagTextGrid : styles.tagTextList]}>#{text}</Text>
  </View>
);

interface UserCardProps { user: UserData; navigation: any; isGrid: boolean; }

const UserCard: React.FC<UserCardProps> = ({ user, navigation, isGrid }) => {
  const imageSource = (typeof user.image === 'string' && user.image.startsWith('http'))
    ? { uri: user.image }
    : user.image;

  return (
    <TouchableOpacity
      style={[styles.card, isGrid ? styles.cardGrid : styles.cardList]}
      activeOpacity={0.9}
      onPress={() => navigation.navigate('UserProfile', { userId: user.id })}
    >
      <View style={[styles.imageContainer, isGrid ? styles.imageContainerGrid : styles.imageContainerList]}>
        <Image source={imageSource} style={styles.image} resizeMode="cover" />
        <LinearGradient colors={['transparent', 'rgba(0,0,0,0.7)']} style={styles.gradient} />

        <View style={[styles.matchBadge, isGrid ? styles.matchBadgeGrid : styles.matchBadgeList]}>
          <Ionicons name="sparkles" size={12} color="#4A90E2" />
          <Text style={[styles.matchText, isGrid ? styles.matchTextGrid : styles.matchTextList]}>{user.compatibility}% Match</Text>
        </View>

        {user.isOnline && (
          <View style={[styles.onlineBadge, isGrid ? styles.onlineBadgeGrid : styles.onlineBadgeList]}>
            <View style={[styles.onlineDot, isGrid && styles.onlineDotGrid]} />
            <Text style={[styles.onlineText, isGrid && styles.onlineTextGrid]}>ONLINE</Text>
          </View>
        )}

        <View style={[styles.cardInfoOverlay, isGrid ? styles.cardInfoOverlayGrid : styles.cardInfoOverlayList]}>
          <View style={styles.nameRow}>
            <Text style={[styles.name, isGrid ? styles.nameGrid : styles.nameList]} numberOfLines={1}>{user.name}</Text>
            <Text style={[styles.age, isGrid ? styles.ageGrid : styles.ageList]}>{user.age}歳</Text>
          </View>

          <View style={[styles.locationContainer, isGrid ? styles.locationContainerGrid : styles.locationContainerList]}>
            <Ionicons name="location-sharp" size={12} color="#FFF" />
            <Text style={[styles.location, isGrid ? styles.locationGrid : styles.locationList]}>{user.location}</Text>
          </View>

          <View style={styles.tagsContainer}>
            {user.tags && user.tags.slice(0, isGrid ? 0 : 10).map((tag, index) => <Tag key={index} text={tag} isGrid={isGrid} />)}
          </View>
        </View>
      </View>

      <View style={[styles.cardFooter, isGrid ? styles.cardFooterGrid : styles.cardFooterList]}>
        <Text style={[styles.bio, isGrid ? styles.bioGrid : styles.bioList]} numberOfLines={isGrid ? 2 : 3} ellipsizeMode="tail">
          {user.bio}
        </Text>
      </View>
    </TouchableOpacity >
  );
};

interface RecommendedUserCardProps { user: UserData; navigation: any; }
const RecommendedUserCard: React.FC<RecommendedUserCardProps> = ({ user, navigation }) => {
  const imageSource = (typeof user.image === 'string' && user.image.startsWith('http'))
    ? { uri: user.image }
    : user.image;

  return (
    <TouchableOpacity
      activeOpacity={0.8}
      onPress={() => navigation.navigate('UserProfile', { userId: user.id })}
      style={styles.recCardWrapper}
    >
      <LinearGradient
        colors={['#FF6B6B', '#FF8E53', '#FFAE34']}
        style={styles.recCardBorder}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      >
        <View style={styles.recCardInner}>
          <Image source={imageSource} style={styles.recImage} resizeMode="cover" />
          <LinearGradient colors={['transparent', 'rgba(0,0,0,0.8)']} style={styles.recGradient} />
          <View style={styles.recInfoContainer}>
            <Text style={styles.recAge}>{user.age}歳</Text>
            <View style={styles.recLocationRow}>
              <Ionicons name="location" size={8} color="#FFF" />
              <Text style={styles.recLocation} numberOfLines={1}>{user.location}</Text>
            </View>
          </View>
        </View>
      </LinearGradient>
    </TouchableOpacity>
  );
};

interface SearchListScreenProps { navigation: any; route: any; }

export default function SearchListScreen({ navigation, route }: SearchListScreenProps) {
  const [users, setUsers] = useState<UserData[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [loadingMore, setLoadingMore] = useState<boolean>(false);
  const [lastDoc, setLastDoc] =
    useState<FirebaseFirestoreTypes.QueryDocumentSnapshot<FirebaseFirestoreTypes.DocumentData> | null>(null);
  const [hasMore, setHasMore] = useState<boolean>(true);
  const [selectedTag, setSelectedTag] = useState<string>('センスマッチング率順');
  const [searchKeyword, setSearchKeyword] = useState<string>(route.params?.initialKeyword || '');
  const [myRegion, setMyRegion] = useState<string | null>(null);

  const [myGender, setMyGender] = useState<string | number | null>(null);
  const [isProfileLoaded, setIsProfileLoaded] = useState<boolean>(false);
  const [activeFilters, setActiveFilters] = useState<ActiveFilters>({});

  const [recommendedUsers, setRecommendedUsers] = useState<UserData[]>([]);
  const [loadingRecommended, setLoadingRecommended] = useState<boolean>(false);

  const [isGrid, setIsGrid] = useState<boolean>(false);

  const calculateAge = (birthDate: any): number | string => {
    if (!birthDate) return '--';
    const birth = birthDate.toDate ? birthDate.toDate() : new Date(birthDate);
    const today = new Date();
    let age = today.getFullYear() - birth.getFullYear();
    if (today.getMonth() < birth.getMonth() || (today.getMonth() === birth.getMonth() && today.getDate() < birth.getDate())) age--;
    return age;
  };

  const checkIsOnline = (lastSeenTimestamp: any): boolean => {
    if (!lastSeenTimestamp) return false;
    const lastSeenDate = lastSeenTimestamp.toDate ? lastSeenTimestamp.toDate() : new Date(lastSeenTimestamp);
    const now = new Date();
    const diffMs = now.getTime() - lastSeenDate.getTime();
    const diffMinutes = diffMs / (1000 * 60);
    return diffMinutes <= ONLINE_THRESHOLD_MINUTES;
  };

  useEffect(() => {
    const init = async () => {
      const user = auth().currentUser;
      if (!user) {
        setIsProfileLoaded(true);
        return;
      }

      try {
        const userDocRef = await firestore().collection('users').doc(user.uid).get();
        const privateSnap = await firestore().collection('users').doc(user.uid).collection('private').doc('settings').get();

        if (userDocRef.exists()) {
          const data = userDocRef.data();
          if (data?.gender) setMyGender(data.gender);

          let savedFilters = null;
          if (privateSnap.exists()) {
            savedFilters = privateSnap.data()?.searchFilters || null;
          }

          let currentRegion = null;
          if (!savedFilters) {
            currentRegion = getRegionByPrefecture(data?.location);
            if (currentRegion) {
              setMyRegion(currentRegion);
              savedFilters = { residenceIn: REGIONS[currentRegion], regionName: currentRegion };
              await firestore().collection('users').doc(user.uid).collection('private').doc('settings').set({ searchFilters: savedFilters }, { merge: true });
            }
          } else {
            if (savedFilters.regionName) {
              currentRegion = savedFilters.regionName;
              setMyRegion(currentRegion);
            }
          }
          if (savedFilters) setActiveFilters(savedFilters);

          if (currentRegion && data?.gender) {
            fetchRecommendedUsers(currentRegion, data.gender, user.uid);
          }
        }
      } catch (e) {
        console.error("Failed to fetch my profile/filters:", e);
      } finally {
        setIsProfileLoaded(true);
      }
    };
    init();
  }, []);

  const fetchRecommendedUsers = async (regionName: string, userGender: string | number, currentUserId: string) => {
    setLoadingRecommended(true);
    try {
      const targetPrefectures = REGIONS[regionName] || [];
      if (targetPrefectures.length === 0) {
        setLoadingRecommended(false);
        return;
      }

      const isMyMale = userGender === '男性' || userGender === 'male' || userGender === 1;
      const targetGenders = isMyMale ? 'female' : 'male';

      const snapshot = await firestore().collection('users').where('location', 'in', targetPrefectures).orderBy('lastseen', 'desc').limit(20).get();

      let fetchedRecs = snapshot.docs.map((doc: any) => ({ id: doc.id, ...doc.data() } as UserData));

      fetchedRecs = fetchedRecs.filter((u: any) =>
        u.id !== currentUserId &&
        targetGenders.includes(u.gender) &&
        u.photoURL && u.photoURL.startsWith('http') &&
        (!u.privacySettings || u.privacySettings.ghostMode !== true)
      );

      fetchedRecs = fetchedRecs.sort(() => 0.5 - Math.random()).slice(0, 6);

      const formattedRecs = fetchedRecs.map((user: any) => ({
        id: user.id,
        name: user.displayName || '未設定',
        age: calculateAge(user.birthDate),
        location: user.location || '未設定',
        image: user.photoURL,
        tags: user.interests || [],
        compatibility: Math.floor(Math.random() * 20 + 80),
        isOnline: checkIsOnline(user.lastSeen),
        bio: user.bio || '',
      }));

      setRecommendedUsers(formattedRecs);
    } catch (error) {
      console.error("Fetch recommended users error:", error);
    } finally {
      setLoadingRecommended(false);
    }
  };

  const handleApplyFilters = async (newFilters: ActiveFilters) => {
    setActiveFilters(prev => ({ ...prev, ...newFilters }));
    const sortTypeMap: Record<string, string> = { 'match': 'センスマッチング率順', 'login': 'ログイン順', 'new': '新着', 'popularity': 'いいね多い順' };
    const sortType = newFilters.sortType;
    if (sortType && sortTypeMap[sortType]) {
      setSelectedTag(sortTypeMap[sortType]);
    }
    const user = auth().currentUser;
    if (user) {
      try {
        await firestore().collection('users').doc(user.uid).collection('private').doc('settings').set({ searchFilters: newFilters }, { merge: true });
      } catch (error) {
        console.error("Failed to save filters to Firestore:", error);
      }
    }
  };

  const SORT_TAG_TO_KEY = { 'センスマッチング率順': 'match', 'ログイン順': 'login', '新着': 'new', 'いいね多い順': 'popularity' };

  const handleTagChange = (tag: string) => {
    setSelectedTag(tag);
    const sortKey = SORT_TAG_TO_KEY[tag as keyof typeof SORT_TAG_TO_KEY];
    if (sortKey) {
      setActiveFilters(prev => ({ ...prev, sortType: sortKey }));
    }
  };

  const fetchUsers = async (loadMore = false) => {
    if (loadMore && (loading || !hasMore || loadingMore)) return;
    try {
      if (loadMore) setLoadingMore(true);
      else setLoading(true);

      const currentUser = auth().currentUser;

      const constraints: any[] = [];
      const sortType = activeFilters.sortType || 'match';

      let usersQuery: FirebaseFirestoreTypes.Query = firestore().collection('users');

      if (sortType === 'login') {
        usersQuery = usersQuery.orderBy('lastSeen', 'desc');
      } else if (sortType === 'new') {
        usersQuery = usersQuery.orderBy('agreedAt', 'desc');
      } else if (sortType === 'popularity') {
        usersQuery = usersQuery.orderBy('receivedLikesCount', 'desc');
      } else {
        usersQuery = usersQuery.orderBy('agreedAt', 'desc');
      }

      if (activeFilters.residenceIn && activeFilters.residenceIn.length > 0) {
        usersQuery = usersQuery.where('location', 'in', activeFilters.residenceIn);
      }

      if (loadMore && lastDoc) {
        usersQuery = usersQuery.startAfter(lastDoc);
      }

      usersQuery = usersQuery.limit(PAGE_SIZE);

      const snapshot = await usersQuery.get();

      if (snapshot.empty) {
        setHasMore(false);
        if (!loadMore) setUsers([]);
      } else {
        let fetchedUsers = snapshot.docs.map((doc: any) => {
          const data = doc.data();
          return { id: doc.id, ...data };
        }).filter((user: any) => user.id !== currentUser?.uid);

        fetchedUsers = fetchedUsers.filter((u: any) => {
          if (u.privacySettings && u.privacySettings.ghostMode === true) return false;
          return true;
        });

        if (myGender) {
          fetchedUsers = fetchedUsers.filter((u: any) => {
            const isMyMale = myGender === '男性' || myGender === 'male' || myGender === 1;
            const isMyFemale = myGender === '女性' || myGender === 'female' || myGender === 2;
            if (isMyMale) return u.gender === '女性' || u.gender === 'female' || u.gender === 2;
            else if (isMyFemale) return u.gender === '男性' || u.gender === 'male' || u.gender === 1;
            return true;
          });
        }

        if (activeFilters.minAge || activeFilters.maxAge) {
          fetchedUsers = fetchedUsers.filter((user: any) => {
            const age = Number(calculateAge(user.birthDate));
            const min = Number(activeFilters.minAge) || 0;
            const max = Number(activeFilters.maxAge) || 100;
            return age >= min && age <= max;
          });
        }

        if (activeFilters.hasPhoto) {
          fetchedUsers = fetchedUsers.filter((user: any) => user.photoURL && user.photoURL.startsWith('http'));
        }

        if (activeFilters.minHeight || activeFilters.maxHeight) {
          fetchedUsers = fetchedUsers.filter((user: any) => {
            if (user.height === undefined || user.height === null) return false;
            const h = Number(user.height);
            const min = activeFilters.minHeight || 0;
            const max = activeFilters.maxHeight || 300;
            return h >= min && h <= max;
          });
        }

        const checkFilter = (userValue: string | undefined, filterList: string[] | undefined) => {
          if (!filterList || filterList.length === 0) return true;
          if (!userValue) return false;
          return filterList.includes(userValue);
        };

        fetchedUsers = fetchedUsers.filter((user: any) => checkFilter(user.bodyType, activeFilters.bodyType));
        fetchedUsers = fetchedUsers.filter((user: any) => checkFilter(user.education, activeFilters.education));
        fetchedUsers = fetchedUsers.filter((user: any) => checkFilter(user.income, activeFilters.income));
        fetchedUsers = fetchedUsers.filter((user: any) => checkFilter(user.holiday, activeFilters.holiday));
        fetchedUsers = fetchedUsers.filter((user: any) => checkFilter(user.drink, activeFilters.alcohol));
        fetchedUsers = fetchedUsers.filter((user: any) => checkFilter(user.smoke, activeFilters.tobacco));
        fetchedUsers = fetchedUsers.filter((user: any) => checkFilter(user.roommate, activeFilters.roommate));
        fetchedUsers = fetchedUsers.filter((user: any) => checkFilter(user.bloodType, activeFilters.bloodType));
        fetchedUsers = fetchedUsers.filter((user: any) => checkFilter(user.marry, activeFilters.marry));
        fetchedUsers = fetchedUsers.filter((user: any) => checkFilter(user.date, activeFilters.date));
        fetchedUsers = fetchedUsers.filter((user: any) => checkFilter(user.child, activeFilters.child));
        fetchedUsers = fetchedUsers.filter((user: any) => checkFilter(user.marital, activeFilters.marital));
        fetchedUsers = fetchedUsers.filter((user: any) => checkFilter(user.sibling, activeFilters.sibling));
        fetchedUsers = fetchedUsers.filter((user: any) => checkFilter(user.encounter, activeFilters.encounter));
        fetchedUsers = fetchedUsers.filter((user: any) => checkFilter(user.occupation, activeFilters.occupation));
        fetchedUsers = fetchedUsers.filter((user: any) => checkFilter(user.personality, activeFilters.personality));
        fetchedUsers = fetchedUsers.filter((user: any) => checkFilter(user.workTime, activeFilters.workTime));
        fetchedUsers = fetchedUsers.filter((user: any) => checkFilter(user.lifeStyle, activeFilters.lifeStyle));
        fetchedUsers = fetchedUsers.filter((user: any) => checkFilter(user.contactFrequency, activeFilters.contactFrequency));
        fetchedUsers = fetchedUsers.filter((user: any) => checkFilter(user.cookingFrequency, activeFilters.cookingFrequency));
        fetchedUsers = fetchedUsers.filter((user: any) => checkFilter(user.birthPlace, activeFilters.birthPlace));

        const getImageSource = (user: any) => {
          if (!user) return DEFAULT_MALE_IMAGE;

          const userImage = user.photoURL;
          const photoStatus = user.mainPhotoStatus;

          if (userImage && photoStatus === 'approved') {
            if (typeof userImage === 'string' && userImage.startsWith('http')) return { uri: userImage };
            if (typeof userImage === 'number') return userImage;
          }

          if (user.gender === 'female' || user.gender === '女性') {
            return DEFAULT_FEMALE_IMAGE;
          }
          return DEFAULT_MALE_IMAGE;
        };

        const formattedUsers = fetchedUsers.map((user: any) => {
          return {
            id: user.id,
            name: user.displayName || '未設定',
            age: calculateAge(user.birthDate),
            location: user.location || '未設定',
            image: getImageSource(user),
            tags: user.interests || [],
            compatibility: Math.floor(Math.random() * 20 + 80),
            isOnline: checkIsOnline(user.lastSeen),
            bio: user.bio || '',
          };
        });

        if (loadMore) {
          setUsers(prev => {
            const existingIds = new Set(prev.map(u => u.id));
            const uniqueNewUsers = formattedUsers.filter((u: any) => !existingIds.has(u.id));
            return [...prev, ...uniqueNewUsers];
          });
        } else {
          setUsers(formattedUsers);
        }

        if (snapshot.docs.length < PAGE_SIZE) setHasMore(false);
        const newLastDoc = snapshot.docs[snapshot.docs.length - 1];
        setLastDoc(newLastDoc);
      }
    } catch (error) {
      console.error("Fetch users error:", error);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  };

  useEffect(() => {
    if (!isProfileLoaded) return;
    setHasMore(true);
    setLastDoc(null);
    fetchUsers(false);
  }, [isProfileLoaded, activeFilters]);

  const filteredUsers = users.filter(user => {
    if (!searchKeyword) return true;
    const cleanKeyword = searchKeyword.replace(/\s+/g, '');
    const cleanName = (user.name || '').replace(/\s+/g, '');
    return cleanName.includes(cleanKeyword) ||
      user.bio.includes(searchKeyword) ||
      (user.tags && user.tags.some(tag => tag.includes(searchKeyword)));
  });

  useEffect(() => {
    if (!loading && !loadingMore && filteredUsers.length === 0 && hasMore) {
      fetchUsers(true);
    }
  }, [filteredUsers.length, loading, loadingMore, hasMore]);

  const goBack = () => navigation.goBack();

  const renderListHeader = () => (
    <View style={styles.filterTagsContainer}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.filterTagsContent}
      >
        {FILTER_TAGS.map((tag, index) => (
          <TouchableOpacity
            key={index}
            onPress={() => handleTagChange(tag)}
            style={[
              styles.filterTag,
              selectedTag === tag ? styles.filterTagSelected : styles.filterTagUnselected
            ]}
          >
            <Text style={[
              styles.filterTagText,
              selectedTag === tag ? styles.filterTagTextSelected : styles.filterTagTextUnselected
            ]}>
              {tag}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );

  const renderEmptyComponent = () => {
    if (!loading && !loadingMore) {
      if (hasMore) {
        return (
          <View style={{ padding: 40, alignItems: 'center' }}>
            <ActivityIndicator size="small" color="#4A90E2" />
          </View>
        );
      } else {
        return (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>
              {myRegion ? `${myRegion}エリアのユーザーが見つかりませんでした` : '条件に合うユーザーが見つかりませんでした'}
            </Text>
          </View>
        );
      }
    }
    return null;
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" />

      <View style={styles.header}>
        <TouchableOpacity onPress={goBack} style={styles.iconButton}>
          <Ionicons name="chevron-back" size={28} color="#333" />
        </TouchableOpacity>

        <View style={styles.headerSearchContainer}>
          <Ionicons name="search" size={20} color="#999" style={styles.searchIcon} />
          <TextInput
            style={styles.searchInput}
            placeholder="キーワードで検索"
            placeholderTextColor="#999"
            value={searchKeyword}
            onChangeText={setSearchKeyword}
          />
        </View>

        <TouchableOpacity
          style={styles.headerToggleButton}
          onPress={() => setIsGrid(!isGrid)}
        >
          <Ionicons name={isGrid ? "list" : "grid"} size={20} color="#333" />
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.headerFilterButton}
          onPress={() => navigation.navigate('SearchFilter', {
            currentFilters: activeFilters,
            myGender: myGender,
            onApply: handleApplyFilters
          })}
        >
          <Ionicons name="options-outline" size={24} color="#333" />
          <View style={styles.filterBadge} />
        </TouchableOpacity>
      </View>

      {filteredUsers.length > 0 && (
        <View style={styles.recommendedSection}>
          <View style={styles.recHeaderRow}>
            <LinearGradient
              colors={['#FF6B6B', '#FFAE34']}
              style={styles.recIconBg}
              start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
            >
              <Ionicons name="sparkles" size={12} color="#FFF" />
            </LinearGradient>
            <Text style={styles.recSectionTitle}>
              {myRegion ? `${myRegion}エリアのおすすめ` : 'おすすめ'}
            </Text>
          </View>

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.recScrollContent}
            snapToInterval={100}
            decelerationRate="fast"
          >
            {filteredUsers.slice(0, 10).map((user) => (
              <RecommendedUserCard key={`rec-${user.id}`} user={user} navigation={navigation} />
            ))}
          </ScrollView>
        </View>
      )}

      {loading && !loadingMore ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#4A90E2" />
        </View>
      ) : (
        <FlatList
          key={isGrid ? 'grid-mode' : 'list-mode'}
          data={filteredUsers}
          numColumns={isGrid ? 2 : 1}
          keyExtractor={item => item.id}
          ListHeaderComponent={renderListHeader()}
          renderItem={({ item }) => <UserCard user={item} navigation={navigation} isGrid={isGrid} />}
          columnWrapperStyle={isGrid ? styles.rowWrapper : undefined}
          contentContainerStyle={[styles.listContent, { paddingBottom: 100 }]}
          showsVerticalScrollIndicator={false}
          onEndReached={() => {
            if (!loading && !loadingMore && hasMore) fetchUsers(true);
          }}
          onEndReachedThreshold={0.5}
          ListFooterComponent={
            loadingMore ? (
              <View style={{ padding: 20 }}>
                <ActivityIndicator size="small" color="#4A90E2" />
              </View>
            ) : null
          }
          ListEmptyComponent={renderEmptyComponent}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFFFFF' },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 8, zIndex: 2000, backgroundColor: '#FFF' },
  iconButton: { padding: 4, position: 'relative' },
  headerSearchContainer: { flex: 1, flexDirection: 'row', alignItems: 'center', backgroundColor: '#F5F7FA', marginHorizontal: 8, paddingHorizontal: 12, height: 38, borderRadius: 19 },
  searchIcon: { marginRight: 6 },
  searchInput: { flex: 1, fontSize: 13, color: '#333' },
  headerToggleButton: { width: 38, height: 38, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F5F7FA', borderRadius: 19, marginRight: 8 },
  headerFilterButton: { width: 38, height: 38, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F5F7FA', borderRadius: 19, position: 'relative' },
  filterBadge: { position: 'absolute', top: 8, right: 8, width: 8, height: 8, borderRadius: 4, backgroundColor: '#FF6B6B', borderWidth: 1.5, borderColor: '#FFF' },
  recommendedSection: {
    backgroundColor: '#FFF5F2', paddingTop: 3, paddingBottom: 3, marginBottom: 16, borderBottomWidth: 1, borderBottomColor: '#FCEAE5',
  },
  recHeaderRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 24, marginBottom: 12, },
  recIconBg: { padding: 4, borderRadius: 12, marginRight: 6 },
  recSectionTitle: { fontSize: 15, fontWeight: '700', color: '#333', letterSpacing: -0.5 },
  recScrollContent: { paddingHorizontal: 20, paddingBottom: 4 },
  recCardWrapper: { marginHorizontal: 4 },
  recCardBorder: { padding: 3, borderRadius: 18, shadowColor: '#FF6B6B', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.15, shadowRadius: 8, elevation: 4 },
  recCardInner: { width: 85, height: 110, backgroundColor: '#FFF', borderRadius: 15, borderWidth: 2, borderColor: '#FFF', overflow: 'hidden', position: 'relative' },
  recImage: { width: '100%', height: '100%' },
  recGradient: { position: 'absolute', bottom: 0, left: 0, right: 0, height: '60%' },
  recInfoContainer: { position: 'absolute', bottom: 6, left: 4, right: 4, alignItems: 'center' },
  recAge: { color: '#FFF', fontSize: 12, fontWeight: '800', textShadowColor: 'rgba(0,0,0,0.6)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 3 },
  recLocationRow: { flexDirection: 'row', alignItems: 'center', marginTop: 2 },
  recLocation: { color: '#FFF', fontSize: 9, fontWeight: '600', marginLeft: 2, textShadowColor: 'rgba(0,0,0,0.6)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 3 },

  filterTagsContainer: { marginBottom: 16 },
  filterTagsContent: { paddingHorizontal: 16 },
  filterTag: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, marginRight: 8, borderWidth: 1 },
  filterTagSelected: { backgroundColor: '#4A90E2', borderColor: '#4A90E2', shadowColor: "#4A90E2", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.3, shadowRadius: 4, elevation: 3 },
  filterTagUnselected: { backgroundColor: '#FFFFFF', borderColor: '#E0E0E0' },
  filterTagText: { fontSize: 12, fontWeight: '600' },
  filterTagTextSelected: { color: '#FFFFFF' },
  filterTagTextUnselected: { color: '#666666' },

  listContent: { paddingHorizontal: 0, paddingBottom: 40 },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  emptyContainer: { padding: 20, alignItems: 'center', marginTop: 50 },
  emptyText: { color: '#999', fontSize: 14 },

  card: { backgroundColor: '#FFFFFF', shadowColor: "#000", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.06, shadowRadius: 12, elevation: 3, borderWidth: 1, borderColor: '#F0F0F0', overflow: 'hidden' },
  cardList: { marginHorizontal: 20, borderRadius: 24, marginBottom: 24 },
  cardGrid: { width: (width - 52) / 2, marginHorizontal: 6, borderRadius: 20, marginBottom: 16 },
  rowWrapper: { paddingHorizontal: 14, justifyContent: 'flex-start' },

  imageContainer: { width: '100%', position: 'relative' },
  imageContainerList: { height: 380 },
  imageContainerGrid: { height: 220 },
  image: { width: '100%', height: '100%' },
  gradient: { position: 'absolute', left: 0, right: 0, bottom: 0, height: '60%' },

  matchBadge: { position: 'absolute', backgroundColor: 'rgba(255,255,255,0.95)', flexDirection: 'row', alignItems: 'center', borderRadius: 20 },
  matchBadgeList: { top: 16, left: 16, paddingHorizontal: 10, paddingVertical: 6 },
  matchBadgeGrid: { top: 8, left: 8, paddingHorizontal: 6, paddingVertical: 4 },
  matchText: { fontWeight: '700', color: '#333', marginLeft: 2 },
  matchTextList: { fontSize: 12 },
  matchTextGrid: { fontSize: 9 },

  onlineBadge: { position: 'absolute', backgroundColor: 'rgba(34, 197, 94, 0.9)', flexDirection: 'row', alignItems: 'center', borderRadius: 20, shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 4, elevation: 2 },
  onlineBadgeList: { top: 16, right: 16, paddingHorizontal: 8, paddingVertical: 4 },
  onlineBadgeGrid: { top: 8, right: 8, paddingHorizontal: 5, paddingVertical: 3 },
  onlineDot: { borderRadius: 3, backgroundColor: '#FFF', marginRight: 3 },
  onlineDotList: { width: 6, height: 6 },
  onlineDotGrid: { width: 4, height: 4 },
  onlineText: { fontWeight: '800', color: '#FFF' },
  onlineTextList: { fontSize: 10 },
  onlineTextGrid: { fontSize: 8 },

  cardInfoOverlay: { position: 'absolute', bottom: 0, left: 0, right: 0 },
  cardInfoOverlayList: { padding: 20 },
  cardInfoOverlayGrid: { padding: 10 },

  nameRow: { flexDirection: 'row', alignItems: 'flex-end', marginBottom: 4 },
  name: { fontWeight: '700', color: '#FFF', marginRight: 6, textShadowColor: 'rgba(0, 0, 0, 0.4)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 4 },
  nameList: { fontSize: 26 },
  nameGrid: { fontSize: 16 },
  age: { fontWeight: '500', color: '#EEE', textShadowColor: 'rgba(0, 0, 0, 0.4)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 4 },
  ageList: { fontSize: 20, marginBottom: 2 },
  ageGrid: { fontSize: 13, marginBottom: 1 },

  locationContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.3)', alignSelf: 'flex-start', borderRadius: 8 },
  locationContainerList: { paddingHorizontal: 8, paddingVertical: 4, marginBottom: 10 },
  locationContainerGrid: { paddingHorizontal: 6, paddingVertical: 2, marginBottom: 6 },
  location: { color: '#FFF', marginLeft: 4 },
  locationList: { fontSize: 12 },
  locationGrid: { fontSize: 9 },

  tagsContainer: { flexDirection: 'row', flexWrap: 'wrap' },
  tag: { backgroundColor: 'rgba(0,0,0,0.5)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.3)' },
  tagList: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8, marginRight: 6, marginBottom: 4 },
  tagGrid: { paddingHorizontal: 6, paddingVertical: 3, borderRadius: 6, marginRight: 4, marginBottom: 4 },
  tagText: { color: '#FFF', fontWeight: '700', textShadowColor: 'rgba(0, 0, 0, 0.5)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 2 },
  tagTextList: { fontSize: 10 },
  tagTextGrid: { fontSize: 8 },

  cardFooter: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', backgroundColor: '#FFF' },
  cardFooterList: { padding: 16 },
  cardFooterGrid: { padding: 8 },
  bio: { color: '#666', flex: 1 },
  bioList: { fontSize: 13, lineHeight: 18, marginRight: 16 },
  bioGrid: { fontSize: 10, lineHeight: 14, marginRight: 0 },

  centerFloatingButtonContainer: { position: 'absolute', bottom: 60, alignSelf: 'center', zIndex: 1000, alignItems: 'center', justifyContent: 'center' },
  centerFloatingButtonEffectRing: { position: 'absolute', width: 90, height: 90, borderRadius: 45, backgroundColor: '#FF6B6B', opacity: 0.2, transform: [{ scale: 1.1 }] },
  centerFloatingButton: { width: 80, height: 80, borderRadius: 40, backgroundColor: 'rgba(255, 255, 255, 0.95)', borderColor: '#E0E0E0', borderWidth: 1, justifyContent: 'center', alignItems: 'center', flexDirection: 'column', shadowColor: "#000", shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.25, shadowRadius: 10, elevation: 8 },
  iconWrapper: { position: 'relative', marginTop: 4 },
  notificationBadge: { position: 'absolute', top: -2, right: -2, width: 10, height: 10, borderRadius: 5, backgroundColor: '#FF6B6B', borderWidth: 1.5, borderColor: '#FFF' },
  centerFloatingButtonText: { color: '#4A90E2', fontSize: 10, fontWeight: '800', marginTop: 2, letterSpacing: 1 },
});