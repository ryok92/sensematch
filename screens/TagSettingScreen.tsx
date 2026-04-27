import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, ActivityIndicator, StatusBar, TextInput,
  Platform, KeyboardAvoidingView
} from 'react-native';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import Ionicons from 'react-native-vector-icons/Ionicons';
import auth from '@react-native-firebase/auth';
import firestore from '@react-native-firebase/firestore';
import { SafeAreaView } from 'react-native-safe-area-context';

const THEME = {
  primary: '#2563EB',
  secondary: '#4F46E5',
  background: '#FFFFFF',
  textMain: '#1E293B',
  textSub: '#64748B',
  border: '#F1F5F9',
  surface: '#F8FAFC'
};

const TAG_CATEGORIES = [
  {
    id: 'hobby',
    title: '趣味・休日の過ごし方',
    icon: 'coffee-outline',
    library: 'MaterialCommunityIcons',
    tags: [
      'カフェ巡り', '映画鑑賞', '読書', 'ゲーム', '料理', 'サウナ',
      'キャンプ', '温泉', 'カメラ', 'ドライブ', 'カラオケ', 'ショッピング',
      '筋トレ', 'ヨガ', '散歩', 'DIY', '観葉植物', '御朱印巡り'
    ]
  },
  {
    id: 'music art',
    title: '音楽・エンタメ',
    icon: 'music-note-outline',
    library: 'MaterialCommunityIcons',
    tags: [
      '邦ロック', '洋楽', 'K-POP', 'アニメ', '漫画', '美術館巡り',
      'フェス', 'ライブ', '舞台鑑賞', 'お笑い', 'YouTube', 'Netflix'
    ]
  },
  {
    id: 'travel food',
    title: '旅行・グルメ',
    icon: 'airplane',
    library: 'MaterialCommunityIcons',
    tags: [
      '海外旅行', '国内旅行', '一人旅', 'リゾート', '食べ歩き',
      'お酒好き', 'スイーツ', 'ラーメン', '焼肉', '寿司', '激辛'
    ]
  },
  {
    id: 'lifestyle',
    icon: 'account-heart-outline',
    library: 'MaterialCommunityIcons',
    tags: [
      '朝型', '夜型', 'インドア', 'アウトドア', 'ミニマリスト',
      '犬派', '猫派', 'フットワーク軽い', 'マイペース', '綺麗好き'
    ]
  }
];

const MAX_TAGS = 10;

export default function TagSettingScrren({ navigation }: any) {
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [saving, setSaving] = useState<boolean>(false);
  const [inputText, setInputText] = useState<string>('');

  useEffect(() => {
    const fetchUserTags = async () => {
      const user = auth().currentUser;
      if (!user) return;

      try {
        const doc = await firestore().collection('users').doc(user.uid).get();
        if (doc.exists()) {
          const data = doc.data();
          if (data?.interests && Array.isArray(data.interests)) {
            setSelectedTags(data.interests);
          }
        }
      } catch (error) {
        console.error("Failed to fetch tags:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchUserTags();
  }, []);

  const toggleTag = (tag: string) => {
    if (selectedTags.includes(tag)) {
      setSelectedTags(prev => prev.filter(t => t !== tag));
    } else {
      if (selectedTags.length >= MAX_TAGS) {
        Alert.alert('上限到達', `タグは最大${MAX_TAGS}個までしか設定できません。`);
        return;
      }
      setSelectedTags(prev => [...prev, tag]);
    }
  };

  const handleAddManualTag = () => {
    const trimmed = inputText.trim();
    if (!trimmed) return;

    if (selectedTags.includes(trimmed)) {
      Alert.alert('重複', 'そのタグはすでに追加されています。');
      setInputText('');
      return;
    }

    if (selectedTags.length >= MAX_TAGS) {
      Alert.alert('上限到達', `タグは最大${MAX_TAGS}個までしか設定できません。`);
      return;
    }

    setSelectedTags(prev => [...prev, trimmed]);
    setInputText('');
  };

  const handleSave = async () => {
    const user = auth().currentUser;
    if (!user) return;

    setSaving(true);

    try {
      await firestore().collection('users').doc(user.uid).update({
        interests: selectedTags
      });
      navigation.goBack();
    } catch (error) {
      console.error("Save failed:", error);
      Alert.alert('エラー', '保存に失敗しました。もう一度お試し下さい。');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={THEME.primary} />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFF" />

      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.headerBtn}>
          <Ionicons name="close" size={24} color={THEME.textSub} />
        </TouchableOpacity>

        <Text style={styles.headerTitle}>タグ設定</Text>

        <TouchableOpacity
          onPress={handleSave}
          disabled={saving}
          style={[styles.saveBtn, saving && styles.saveBtnDisabled]}
        >
          {saving ? (
            <ActivityIndicator size="small" color="#FFF" />
          ) : (
            <Text style={styles.saveBtnText}>保存</Text>
          )}
        </TouchableOpacity>
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={styles.content}
      >
        <View style={styles.selectedArea}>

          <View style={styles.selectedHeader}>
            <Text style={styles.selectedLabel}>選択中</Text>
            <Text style={[styles.counterText, selectedTags.length >= MAX_TAGS && styles.counterLimit]}>
              {selectedTags.length}/{MAX_TAGS}
            </Text>
          </View>

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.selectedScroll}
          >
            {selectedTags.length === 0 ? (
              <Text style={styles.placeholderText}>気になるタグを追加</Text>
            ) : (
              selectedTags.map((tag) => (
                <TouchableOpacity
                  key={tag}
                  activeOpacity={0.8}
                  onPress={() => toggleTag(tag)}
                  style={styles.selectedChip}
                >
                  <Text style={styles.selectedChipText}>#{tag}</Text>
                  <Ionicons name="close-circle" size={16} color="rgba(255, 255, 255, 0.8)" style={{ marginLeft: 4 }} />
                </TouchableOpacity>
              ))
            )}
          </ScrollView>
        </View>

        <ScrollView
          style={styles.listContainer}
          contentContainerStyle={styles.listContent}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.manualInputSection}>

            <View style={styles.manualInputHeader}>
              <View style={styles.manualIconBox}>
                <MaterialCommunityIcons name="pencil-outline" size={16} color="#F59E0B" />
              </View>

              <Text style={styles.manualInputTitle}>自由に入力して追加</Text>
            </View>

            <View style={styles.inputRow}>
              <TextInput
                style={styles.inputField}
                value={inputText}
                onChangeText={setInputText}
                placeholder="例：激辛ラーメン、御朱印..."
                placeholderTextColor="94A3B8"
                maxLength={20}
                returnKeyType="done"
                onSubmitEditing={handleAddManualTag}
              />

              <TouchableOpacity
                style={[
                  styles.addButton,
                  !inputText.trim() && styles.addButtonDisabled
                ]}
                onPress={handleAddManualTag}
                disabled={!inputText.trim()}
              >
                <Ionicons name="add" size={24} color="#FFF" />
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.recommendedHeader}>
            <Text style={styles.recommendedTitle}>おすすめのタグ</Text>
          </View>

          {TAG_CATEGORIES.map((category) => (
            <View key={category.id} style={styles.categorySection}>

              <View style={styles.categoryHeader}>
                <View style={styles.categoryIconBox}>
                  <MaterialCommunityIcons name={category.icon} size={18} color={THEME.primary} />
                </View>

                <Text style={styles.categoryTitle}>{category.title}</Text>
              </View>

              <View style={styles.tagsFlex}>
                {category.tags.map((tag) => {
                  const isSelected = selectedTags.includes(tag);
                  return (
                    <TouchableOpacity
                      key={tag}
                      activeOpacity={0.7}
                      onPress={() => toggleTag(tag)}
                      style={[
                        styles.tagChip,
                        isSelected && styles.tagChipActive
                      ]}
                    >
                      <Text style={[
                        styles.tagText,
                        isSelected && styles.tagChipActive
                      ]}>
                        #{tag}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          ))}
          <View style={{ height: 40 }} />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}


const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFF', },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: THEME.border, backgroundColor: '#FFF', zIndex: 10,
  },
  headerBtn: { padding: 8, },
  headerTitle: { fontSize: 16, fontWeight: 'bold', color: THEME.textMain, },
  saveBtn: {
    backgroundColor: THEME.primary, paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, minWidth: 64, alignItems: 'center',
  },
  saveBtnDisabled: { backgroundColor: '#94A3B8', },
  saveBtnText: { color: '#FFF', fontWeight: 'bold', fontSize: 12, },
  content: { flex: 1, },
  selectedArea: { paddingVertical: 16, backgroundColor: THEME.surface, borderBottomWidth: 1, borderBottomColor: THEME.border, },
  selectedHeader: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 16, marginBottom: 12, },
  selectedLabel: { fontSize: 12, fontWeight: 'bold', color: THEME.textSub, },
  counterText: { fontSize: 12, fontWeight: 'bold', color: THEME.primary, },
  counterLimit: { color: '#EF4444', },
  selectedScroll: { paddingHorizontal: 16, minHeight: 36, alignItems: 'center', },
  placeholderText: { fontSize: 12, color: '#94A3B8', },
  selectedChip: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: THEME.primary, paddingVertical: 8, paddingHorizontal: 12,
    borderRadius: 20, marginRight: 8, shadowColor: THEME.primary, shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2, shadowRadius: 4, elevation: 3,
  },
  selectedChipText: { color: '#FFF', fontSize: 12, fontWeight: 'bold', },
  listContainer: { flex: 1, },
  listContent: { paddingVertical: 24, },
  manualInputSection: {
    marginHorizontal: 24, marginBottom: 24, padding: 16, backgroundColor: '#FFF', borderRadius: 16,
    borderWidth: 1, borderColor: '#E2E8F0', shadowColor: "#000", shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.03, shadowRadius: 4, elevation: 1,
  },
  manualInputHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 12, },
  manualIconBox: {
    width: 28, height: 28, borderRadius: 8, backgroundColor: '#FEF3C7', justifyContent: 'center',
    alignItems: 'center', marginRight: 8,
  },
  manualInputTitle: { fontSize: 14, fontWeight: 'bold', color: THEME.textMain, },
  inputRow: { flexDirection: 'row', alignItems: 'center', },
  inputField: {
    flex: 1, backgroundColor: THEME.surface, borderWidth: 1, borderColor: THEME.border, borderRadius: 12,
    paddingHorizontal: 16, paddingVertical: 10, fontSize: 14, color: THEME.textMain, marginRight: 8,
  },
  addButton: {
    width: 44, height: 44, borderRadius: 12, backgroundColor: THEME.primary, justifyContent: 'center',
    alignItems: 'center', shadowColor: THEME.primary, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.3,
    shadowRadius: 4, elevation: 3,
  },
  addButtonDisabled: { backgroundColor: '#E2E8F0', shadowOpacity: 0, elevation: 0, },
  recommendedHeader: { paddingHorizontal: 24, marginBottom: 16, paddingTop: 8, },
  recommendedTitle: { fontSize: 12, fontWeight: 'bold', color: '#94A3B8', letterSpacing: 1, },
  categorySection: { marginBottom: 32, paddingHorizontal: 24, },
  categoryHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 16, },
  categoryIconBox: {
    width: 32, height: 32, borderRadius: 8, backgroundColor: '#EFF6FF', justifyContent: 'center', alignItems: 'center', marginRight: 10,
  },
  categoryTitle: { fontSize: 14, fontWeight: 'bold', color: THEME.textMain, },
  tagsFlex: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, },
  tagChip: {
    paddingVertical: 8, paddingHorizontal: 14, borderRadius: 24, borderWidth: 1, borderColor: '#E2E8F0', backgroundColor: '#FFF',
  },
  tagChipActive: { borderColor: THEME.primary, backgroundColor: '#EFF6FF', },
  tagText: { fontSize: 12, color: '#64748B', fontWeight: '500', },
  tagTextActive: { color: THEME.primary, fontWeight: 'bold', },
});