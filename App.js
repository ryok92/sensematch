import React, {useState, useEffect, useRef} from 'react';
import {NavigationContainer, DefaultTheme} from '@react-navigation/native';
import {createNativeStackNavigator} from '@react-navigation/native-stack';
import {createBottomTabNavigator} from '@react-navigation/bottom-tabs';
import {View, ActivityIndicator, AppState} from 'react-native';
import {SafeAreaProvider} from 'react-native-safe-area-context';
import Ionicons from 'react-native-vector-icons/Ionicons';
import auth from '@react-native-firebase/auth';
import firestore from '@react-native-firebase/firestore';

// 画面コンポーネント群
import LoginScreen from './screens/LoginScreen';
import VerifyEmailScreen from './screens/VerifyEmailScreen';
import TermsAgreementScreen from './screens/TermsAgreementScreen';
import BasicInfoSetupScreen from './screens/BasicInfoSetupScreen';
import TwoFactorScreen from './screens/TwoFactorScreen';
import AnalysisScreen from './screens/AnalysisScreen';

import HomeScreen from './screens/HomeScreen';
import SearchListScreen from './screens/SearchListScreen';
import SearchFilterScreen from './screens/SearchFilterScreen';
import UserProfileScreen from './screens/UserProfileScreen';
import MyProfileScreen from './screens/MyProfileScreen';
import ReceivedLikesScreen from './screens/ReceivedLikesScreen';
import MatchesScreen from './screens/MatchesScreen';
import ChatScreen from './screens/ChatScreen';
import Footprints from './screens/Footprints';
import ProfileEditScreen from './screens/ProfileEditScreen';
import PhotoManagerScreen from './screens/PhotoManagerScreen';
import QuestionScreen from './screens/QuestionScreen';
import TagSettingScreen from './screens/TagSettingScreen';
import SettingScreen from './screens/SettingScreen';
import BlockListScreen from './screens/BlockListScreen';
import AccountScreen from './screens/AccountScreen';
import ContactScreen from './screens/ContactScreen';
import FeedbackScreen from './screens/FeedbackScreen';
import GameHomeScreen from './screens/GameHomeScreen';
import karigame from './screens/karigame';
import GameEntryScreen from './screens/GameEntryScreen';
import GameCreateScreen from './screens/GameCreateScreen';
import AllMatchesScreen from './screens/AllMatchesScreen';
import NoteSettingScreen from './screens/NoteSettingScreen';
import NoteViewScreen from './screens/NoteViewScreen';
import FavoritesScreen from './screens/FavoritesScreen';
import MemoSettingScreen from './screens/MemoSettingScreen';
import SenseintroScreen from './screens/SenseintroScreen';
import SenseProfilingScreen from './screens/SenseProfilingScreen';
import FirstSenseintroScreen from './screens/FirstSenseintroScreen';
import FirstSenseProfilingScreen from './screens/FirstSenseProfilingScreen';

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

// アプリ全体のテーマ（画面遷移時の白フラッシュ防止）
const MyTheme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    background: '#FFFFFF',
  },
};

function HomeTabs() {
  return (
    <Tab.Navigator
      screenOptions={({route}) => ({
        headerShown: false,
        tabBarShowLabel: true,
        tabBarActiveTintColor: '#4A90E2',
        tabBarInactiveTintColor: '#999',
        tabBarStyle: {
          height: 105,
          paddingBottom: 25,
          paddingTop: 10,
          backgroundColor: '#FFFFFF',
          borderTopWidth: 1,
          borderTopColor: '#F0F0F0',
          elevation: 8,
          shadowColor: '#000',
          shadowOffset: {width: 0, height: -2},
          shadowOpacity: 0.1,
          shadowRadius: 4,
        },
        tabBarLabelStyle: {
          fontSize: 10,
          fontWeight: '600',
          marginTop: 1,
        },
      })}>
      <Tab.Screen
        name="HomeTab"
        component={HomeScreen}
        options={{
          tabBarLabel: 'ホーム',
          tabBarIcon: ({color, size}) => (
            <Ionicons name="home" size={size} color={color} />
          ),
        }}
      />

      <Tab.Screen
        name="MessageTab"
        component={MatchesScreen}
        options={{
          tabBarLabel: 'メッセージ',
          tabBarIcon: ({color, size}) => (
            <Ionicons name="chatbubble-ellipses" size={size} color={color} />
          ),
          tabBarBadge: 2,
        }}
      />

      <Tab.Screen
        name="GameHomeTab"
        component={GameHomeScreen}
        options={{
          tabBarLabel: '共体験',
          tabBarIcon: ({color, size}) => (
            <Ionicons name="heart" size={size} color={color} />
          ),
        }}
      />

      <Tab.Screen
        name="MyPageTab"
        component={MyProfileScreen}
        options={{
          tabBarLabel: 'マイページ',
          tabBarIcon: ({color, size}) => (
            <Ionicons name="person" size={size} color={color} />
          ),
        }}
      />
    </Tab.Navigator>
  );
}

export default function App() {
  const [initializing, setInitializing] = useState(true);
  const [user, setUser] = useState(null);

  const appState = useRef(AppState.currentState);

  const [isTermsAgreed, setIsTermsAgreed] = useState(null);
  const [isBasicInfoCompleted, setIsBasicInfoCompleted] = useState(null);
  const [is2FAVerified, setIs2FAVerified] = useState(null);
  const [isProfilingCompleted, setIsProfilingCompleted] = useState(null);

  const updateLastSeen = async currentUser => {
    if (currentUser) {
      try {
        const userRef = firestore().collection('users').doc(currentUser.uid);
        await userRef.update({
          lastSeen:firestore.FieldValue.serverTimestamp(),
        });
      } catch (error) {
        console.error('App.js: lastSeenの更新に失敗しました:', error);
      }
    }
  };

  async function handleAuthStateChanged(currentUser) {
    setUser(currentUser);
    if (currentUser) {
      updateLastSeen(currentUser);
      try {
        const userRef = firestore().collection('users').doc(currentUser.uid);
        const userDoc = await userRef.get();

        if (userDoc.exists) {
          const userData = userDoc.data();

          if (userData && userData.isTermsAgreed) {
            setIsTermsAgreed(true);
          } else {
            setIsTermsAgreed(false);
          }

          if (userData && userData.isBasicInfoCompleted) {
            setIsBasicInfoCompleted(true);
          } else {
            setIsBasicInfoCompleted(false);
          }

          if (userData && userData.is2FAEnabled) {
            setIs2FAVerified(false);
          } else {
            setIs2FAVerified(true);
          }

          if (userData && userData.isProfilingCompleted) {
            setIsProfilingCompleted(true);
          } else {
            setIsProfilingCompleted(false);
          }
        } else {
          setIsTermsAgreed(false);
          setIsBasicInfoCompleted(false);
          setIs2FAVerified(true);
          setIsProfilingCompleted(false);
        }
      } catch (error) {
        console.error('設定取得エラー:', error);

        //エラー時は通さない
        setIsTermsAgreed(false);
        setIsBasicInfoCompleted(false);
        setIs2FAVerified(false);
        setIsProfilingCompleted(false);
      }
    } else {
      // ログアウト時の状態リセット
      setIsTermsAgreed(null);
      setIsBasicInfoCompleted(null);
      setIs2FAVerified(null);
      setIsProfilingCompleted(null);
    }

    if (initializing) setInitializing(false);
  }

  useEffect(() => {
    const subscriber = auth().onIdTokenChanged(handleAuthStateChanged);

    const subscription = AppState.addEventListener('change', nextAppState => {
      if (
        appState.current.match(/inactive|background/) &&
        nextAppState === 'active'
      ) {
        console.log('App has come to the foreground!');
        const currentUser = auth().currentUser;
        updateLastSeen(currentUser);
      }
      appState.current = nextAppState;
    });

    return () => {
      subscriber();

      subscription.remove();
    };
  }, []);

  const isEmailVerified = user ? user.emailVerified : false;

  // ローディング画面の表示
  if (
    initializing ||
    (user &&
      (isTermsAgreed === null ||
        isBasicInfoCompleted === null ||
        is2FAVerified === null ||
        isProfilingCompleted === null))
  ) {
    return (
      <View
        style={{
          flex: 1,
          justifyContent: 'center',
          alignItems: 'center',
          backgroundColor: '#FFFFFF',
        }}>
        <ActivityIndicator size="large" color="#007AFF" />
      </View>
    );
  }

  return (
    <SafeAreaProvider>
      <NavigationContainer theme={MyTheme}>
        <Stack.Navigator screenOptions={{headerShown: false}}>
          {!user ? (
            // 1. 未ログイン
            <>
              <Stack.Screen name="Login" component={LoginScreen} />
              <Stack.Screen name="VerifyEmail" component={VerifyEmailScreen} />
            </>
          ) : !isEmailVerified ? (
            // 2. メール未認証
            <Stack.Screen name="VerifyEmail" component={VerifyEmailScreen} />
          ) : !isTermsAgreed ? (
            // 3. 規約未同意
            <Stack.Screen
              name="TermsAgreement"
              component={TermsAgreementScreen}
              initialParams={{onAgreed: () => setIsTermsAgreed(true)}}
            />
          ) : !isBasicInfoCompleted ? (
            // 4. 基本情報未入力
            <Stack.Screen
              name="BasicInfoSetup"
              component={BasicInfoSetupScreen}
              initialParams={{onCompleted: () => setIsBasicInfoCompleted(true)}}
            />
          ) : !is2FAVerified ? (
            // 5. 2FA
            <Stack.Screen
              name="TwoFactor"
              component={TwoFactorScreen}
              initialParams={{onVerified: () => setIs2FAVerified(true)}}
            />
          ) : !isProfilingCompleted ? (
            // 6. プロファイリング
            <>
              <Stack.Screen
                name="FirstSenseintro"
                component={FirstSenseintroScreen}
              />
              <Stack.Screen
                name="FirstSenseProfiling"
                component={FirstSenseProfilingScreen}
                initialParams={{
                  onCompleted: () => setIsProfilingCompleted(true),
                }}
              />
              <Stack.Screen name="Analysis" component={AnalysisScreen} />
            </>
          ) : (
            // 7. メイン画面
            <>
              <Stack.Screen name="MainTabs" component={HomeTabs} />

              <Stack.Screen name="SearchList" component={SearchListScreen} />
              <Stack.Screen
                name="ReceivedLikes"
                component={ReceivedLikesScreen}
              />
              <Stack.Screen name="Footprints" component={Footprints} />
              <Stack.Screen name="Chat" component={ChatScreen} />
              <Stack.Screen name="UserProfile" component={UserProfileScreen} />
              <Stack.Screen
                name="SearchFilter"
                component={SearchFilterScreen}
              />
              <Stack.Screen name="ProfileEdit" component={ProfileEditScreen} />
              <Stack.Screen
                name="PhotoManager"
                component={PhotoManagerScreen}
              />
              <Stack.Screen name="Question" component={QuestionScreen} />
              <Stack.Screen name="TagSetting" component={TagSettingScreen} />
              <Stack.Screen name="Setting" component={SettingScreen} />
              <Stack.Screen name="BlockList" component={BlockListScreen} />
              <Stack.Screen name="Account" component={AccountScreen} />
              <Stack.Screen name="Contact" component={ContactScreen} />
              <Stack.Screen name="Feedback" component={FeedbackScreen} />
              <Stack.Screen name="karigame" component={karigame} />
              <Stack.Screen name="GameEntry" component={GameEntryScreen} />
              <Stack.Screen name="GameCreate" component={GameCreateScreen} />
              <Stack.Screen name="AllMatches" component={AllMatchesScreen} />
              <Stack.Screen name="NoteSetting" component={NoteSettingScreen} />
              <Stack.Screen name="NoteView" component={NoteViewScreen} />
              <Stack.Screen name="Favorites" component={FavoritesScreen} />
              <Stack.Screen name="MemoSetting" component={MemoSettingScreen} />
              <Stack.Screen name="Senseintro" component={SenseintroScreen} />
              <Stack.Screen
                name="SenseProfiling"
                component={SenseProfilingScreen}
              />
            </>
          )}
        </Stack.Navigator>
      </NavigationContainer>
    </SafeAreaProvider>
  );
}
