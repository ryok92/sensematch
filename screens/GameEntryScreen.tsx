import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  Alert,
  StyleSheet,
  ActivityIndicator,
  NativeSyntheticEvent
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

import auth from '@react-native-firebase/auth';
import firestore from '@react-native-firebase/firestore';

export default function GameEntryScreen({ navigation }: { navigation: any }) {
  const [code, setCode] = useState<string[]>(['', '', '', '']);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const inputRefs = useRef<Array<TextInput | null>>([]);

  const handleJoin = async () => {
    const enteredCode = code.join('');

    // 1. バリデーション
    if (enteredCode.length !== 4) {
      Alert.alert("入力エラー", "4桁の参加コードを入力してください。");
      return;
    }

    setIsLoading(true);

    try {
      const currentUser = auth().currentUser;
      if (!currentUser) {
        Alert.alert("エラー", "ログイン情報が見つかりません。");
        setIsLoading(false);
        return;
      }

      // 2. Firestoreからルーム検索
      const snapshot = await firestore()
        .collection('rooms')
        .where('code', '==', enteredCode)
        .get();

      if (snapshot.empty) {
        Alert.alert("エラー", "入力されたコードのルームが見つかりません。");
        setIsLoading(false);
        return;
      }

      // 3. ルーム情報の検証
      const roomDoc = snapshot.docs[0];
      const roomData = roomDoc.data();
      const roomId = roomDoc.id;

      // 期限チェック (Timestamp => Date変換)
      const expiresAt = roomData.expiresAt?.toDate ? roomData.expiresAt.toDate() : new Date(roomData.expiresAt);
      const now = new Date();
      const isExpired = now > expiresAt;

      // ゲーム実行済みチェック (waiting以外は実行済み/進行中とみなす)
      const isPlayed = roomData.status !== 'waiting';
      console.log(isPlayed);

      if (isPlayed) {
        // 条件A: 既にゲーム実行済み
        Alert.alert(
          "参加不可",
          "このルームは既にゲームが開始または終了しています。\n新しくルームを作成しますか？",
          [
            { text: "キャンセル", style: "cancel" },
            { 
              text: "作成画面へ", 
              onPress: () => navigation.navigate('GameCreate') 
            }
          ]
        );
      } else if (isExpired) {

        await firestore().collection('rooms').doc(roomId).delete();
        // 条件B: 24時間経過 (期限切れ)
        Alert.alert(
          "有効期限切れ",
          "このコードは有効期限(24時間)が切れています。\n新しくルームを作成しますか？",
          [
            { text: "キャンセル", style: "cancel" },
            { 
              text: "作成画面へ", 
              onPress: () => navigation.navigate('GameCreate') 
            }
          ]
        );
      } else {
        // 条件C: 正常 (参加処理)
        
        // ユーザーIDをplayers配列に追加
        await firestore().collection('rooms').doc(roomId).update({
          players: firestore.FieldValue.arrayUnion(currentUser.uid)
        });

        // 成功時の遷移
        // GameCreateScreenのresultContainer(待機画面)相当へ遷移するため、
        // step='created' 状態になるようパラメータを渡すことを想定
        navigation.navigate('GameCreate', {
          roomId: roomId,
          code: enteredCode,
          isGuest: true // ゲスト参加フラグ(受け取り側で制御用)
        });
      }

    } catch (error) {
      console.error("Join Error:", error);
      Alert.alert("エラー", "通信中にエラーが発生しました。");
    } finally {
      setIsLoading(false);
    }
  };

  const handleCodeChange = (text: string, index: number) => {
    const newCode = [...code];
    newCode[index] = text;
    setCode(newCode);

    if (text.length === 1 && index < 3) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleKeyPress = (e: NativeSyntheticEvent<{ key: string }>, index: number) => {
    if (e.nativeEvent.key === 'Backspace' && !code[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  return (
    <View style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        {/* ヘッダー */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()}>
            <Ionicons name="chevron-back" size={28} color="#333" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>ルーム入室</Text>
        </View>

        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={styles.content}
        >
          {/* ゲーム情報 */}
          <View style={styles.gameCard}>
            <View style={styles.gameCardInner}>
              <LinearGradient
                colors={['#F97316', '#EF4444']}
                style={styles.iconBox}
              >
                <MaterialCommunityIcons name="tower-fire" size={28} color="#FFF" />
              </LinearGradient>
              <View>
                <Text style={styles.selectedLabel}>SELECTED GAME</Text>
                <Text style={styles.gameTitle}>バランスタワー</Text>
              </View>
            </View>
          </View>

          {/* 入力エリア */}
          <Text style={styles.promptTitle}>参加コードを入力</Text>
          <View style={styles.codeContainer}>
            {code.map((c, i) => (
              <TextInput
                key={i}
                ref={(el) => {(inputRefs.current[i] = el)}}
                style={styles.codeInput}
                keyboardType="number-pad"
                value={c}
                onChangeText={(t) => handleCodeChange(t, i)}
                onKeyPress={(e) => handleKeyPress(e, i)}
                maxLength={1}
                selectTextOnFocus={true}
                editable={!isLoading}
              />
            ))}
          </View>

          {/* アクションボタン */}
          <TouchableOpacity 
            onPress={handleJoin} 
            style={[styles.joinButton, isLoading && styles.joinButtonDisabled]}
            disabled={isLoading}
          >
            {isLoading ? (
              <ActivityIndicator color="#FFF" />
            ) : (
              <Text style={styles.joinButtonText}>ルームに入室する</Text>
            )}
          </TouchableOpacity>

          {/* リンク */}
          <View style={styles.footerLink}>
            <Text style={styles.footerText}>コードが分からない場合は</Text>
            <TouchableOpacity onPress={() => navigation.navigate('Chat')}>
              <Text style={styles.linkText}>メッセージ</Text>
            </TouchableOpacity>
            <Text style={styles.footerText}>で確認</Text>
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFF',
  },
  safeArea: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    padding: 16,
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '700',
    marginLeft: 16,
  },
  content: {
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: 32,
    paddingTop: 24,
  },
  gameCard: {
    width: '100%',
    backgroundColor: '#FFF',
    borderRadius: 24,
    padding: 4,
    borderWidth: 1,
    borderColor: '#F5F7FA',
    marginBottom: 40,
  },
  gameCardInner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
    borderRadius: 20,
    padding: 12,
  },
  iconBox: {
    width: 56,
    height: 56,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  selectedLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: '#AAA',
  },
  gameTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#333',
  },
  promptTitle: {
    fontSize: 22,
    fontWeight: '800',
    marginBottom: 8,
  },
  codeContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
    marginBottom: 48,
  },
  codeInput: {
    width: 60,
    height: 68,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: '#E0E0E0',
    fontSize: 28,
    fontWeight: '700',
    textAlign: 'center',
  },
  joinButton: {
    width: '100%',
    backgroundColor: '#4A90E2',
    paddingVertical: 16,
    borderRadius: 30,
    alignItems: 'center',
    marginBottom: 16,
  },
  joinButtonDisabled: {
    backgroundColor: '#A0C4E8',
  },
  joinButtonText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '700',
  },
  footerLink: {
    flexDirection: 'row',
  },
  footerText: {
    fontSize: 10,
    color: '#AAA',
  },
  linkText: {
    fontSize: 10,
    color: '#4A90E2',
    fontWeight: '700',
  },
});