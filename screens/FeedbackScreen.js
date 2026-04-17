import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput, ScrollView, Alert, KeyboardAvoidingView, Platform, ActionSheetIOS } from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function FeedbackScreen({ navigation }) {
  const [category, setCategory] = useState('機能追加の要望'); // デフォルト値
  const [message, setMessage] = useState('');

  // カテゴリ選択肢
  const categories = [
    '機能追加の要望',
    'デザイン・UIについて',
    'マッチングの仕組みについて',
    'イベント・キャンペーンについて',
    'その他',
    'キャンセル' // ActionSheet用
  ];

  const handleCategoryPress = () => {
    // 簡易的な実装としてActionSheetを表示（Androidの場合はModal等で実装推奨だが、今回はコード簡略化のためiOS想定またはアラートで代用）
    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        {
          options: categories,
          cancelButtonIndex: categories.length - 1,
        },
        (buttonIndex) => {
          if (buttonIndex !== categories.length - 1) {
            setCategory(categories[buttonIndex]);
          }
        }
      );
    } else {
      // Android等での簡易実装（実際はPickerやModalを使用）
      Alert.alert(
        "カテゴリ選択",
        "カテゴリを選んでください",
        categories.slice(0, categories.length - 1).map(cat => ({
          text: cat,
          onPress: () => setCategory(cat)
        }))
      );
    }
  };

  const handleSubmit = () => {
    if (!message.trim()) {
      Alert.alert("エラー", "ご意見を入力してください");
      return; 
    }
    // ここで送信処理 (category と message を送信)
    Alert.alert("ありがとうございます！", "貴重なご意見ありがとうございます。サービス向上の参考にさせていただきます。", [
      { text: "OK", onPress: () => navigation.goBack() }
    ]);
  };

  return (
    <View style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color="#333" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>ご意見・ご要望</Text>
          <View style={{ width: 40 }} />
        </View>

        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={{flex:1}}>
          <ScrollView contentContainerStyle={styles.content}>
            
            <View style={styles.infoBox}>
              <MaterialCommunityIcons name="comment-quote-outline" size={24} color="#F59E0B" style={styles.infoIcon} />
              <Text style={styles.infoText}>
                サービス向上のため、あなたのご意見をお聞かせください。{'\n'}
                <Text style={{fontSize: 11, color: '#B45309'}}>※こちらにお送りいただいた内容への個別の返信は行っておりませんので、予めご了承ください。</Text>
              </Text>
            </View>
            
            {/* ★ NEW: カテゴリ選択リスト */}
            <Text style={styles.label}>ご意見の種別</Text>
            <TouchableOpacity 
              style={styles.inputContainer} 
              onPress={handleCategoryPress}
              activeOpacity={0.7}
            >
              <Text style={styles.inputText}>{category}</Text>
              <Ionicons name="chevron-down" size={20} color="#94A3B8" />
            </TouchableOpacity>

            <Text style={styles.label}>詳細内容</Text>
            <View style={[styles.inputContainer, styles.textAreaContainer]}>
              <TextInput
                style={styles.textArea}
                multiline
                placeholder="「もっとこうしてほしい」「ここが使いにくい」など、率直なご意見をお待ちしております！"
                placeholderTextColor="#CBD5E1"
                value={message}
                onChangeText={setMessage}
                textAlignVertical="top"
              />
            </View>

            <TouchableOpacity style={styles.submitButton} onPress={handleSubmit}>
              <Text style={styles.submitButtonText}>送信</Text>
              <Ionicons name="paper-plane-outline" size={18} color="#FFF" style={{marginLeft: 8}} />
            </TouchableOpacity>

          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  safeArea: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#FFF',
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#333',
  },
  content: {
    padding: 24,
  },
  infoBox: {
    backgroundColor: '#FFFBEB',
    padding: 16,
    borderRadius: 12,
    flexDirection: 'row',
    marginBottom: 24,
    borderWidth: 1,
    borderColor: '#FEF3C7',
  },
  infoIcon: {
    marginRight: 12,
    marginTop: 2,
  },
  infoText: {
    flex: 1,
    fontSize: 13,
    color: '#92400E',
    lineHeight: 20,
  },
  // ★ NEW Styles
  label: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
    marginLeft: 4,
  },
  inputContainer: {
    backgroundColor: '#FFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 16,
    marginBottom: 24,
    // Flex for select box feel
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  inputText: {
    fontSize: 15,
    color: '#333',
  },
  textAreaContainer: {
    height: 240,
    alignItems: 'flex-start',
  },
  textArea: {
    flex: 1,
    width: '100%',
    height: '100%',
    fontSize: 15,
    color: '#333',
    padding: 0,
  },
  submitButton: {
    backgroundColor: '#1E293B',
    borderRadius: 16,
    paddingVertical: 16,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: "#1E293B",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  submitButtonText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
});