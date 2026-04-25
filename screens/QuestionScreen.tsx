import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity, ScrollView, KeyboardAvoidingView, Platform,
  Alert, ActivityIndicator, Dimensions
} from 'react-native';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import Ionicons from 'react-native-vector-icons/Ionicons';
import auth from '@react-native-firebase/auth';
import firestore from '@react-native-firebase/firestore';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

const { width } = Dimensions.get('window');

const SUGGESTED_QUESTIONS = [
  "一番好きな映画は？", "理想の休日の過ごし方は？", "今一番行きたい国は？", "子供の頃の夢は？", "犬派？猫派？それとも...？",
  "最近買ってよかったものは？", "座右の銘はありますか？", "好きな・嫌いな食べ物はありますか？"
];


type RootStackParamList = { Question: undefined; };
type QuestionScreenNavigationProp = NativeStackNavigationProp<RootStackParamList, 'Question'>;
interface Props { navigation: QuestionScreenNavigationProp; };
interface QuestionChipProps { text: string, onPress: (text: string) => void; };
interface UserData { quetion?: string; };

const QuestionChip: React.FC<QuestionChipProps> = ({ text, onPress }) => (
  <TouchableOpacity style={styles.chip} onPress={() => onPress(text)} activeOpacity={0.7}>
    <Ionicons name="sparkles-outline" size={12} color="#2563EB" style={{ marginRight: 4 }} />
    <Text style={styles.chipText}>{text}</Text>
  </TouchableOpacity>
);

export default function QuestionScreen({ navigation }: Props) {
  const [question, setQuestion] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(true);
  const [saving, setSaving] = useState<boolean>(false);

  useEffect(() => {
    const fetchQuestion = async () => {
      const currentUser = auth().currentUser;
      if (!currentUser) {
        setLoading(false);
        return
      }

      try {
        const docSnap = await firestore().collection('users').doc(currentUser.uid).get();
        if (docSnap.exists()) {
          const data = docSnap.data()
          if (data?.question) {
            setQuestion(data.question);
          }
        }
      } catch (error) {
        console.error("Error fetching question:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchQuestion();
  }, []);

  const handleSave = async () => {
    if (saving) return;
    setSaving(true);

    const currentUser = auth().currentUser;
    if(!currentUser){
      setSaving(false);
      return;
    }
    try {
      await firestore().collection('users').doc(currentUser.uid).update({question:question.trim()});
      Alert.alert("完了", "質問が設定されました。");
    } catch (error) {
      console.error("エラー", "保存に失敗しました。通信環境を確認下さい。");
    } finally {
      setSaving(false);
    }
  };

  const clearQuestion = () => setQuestion('');

  if (loading) {
    return (
      <View style={[styles.container, styles.center]}>
        <ActivityIndicator size="large" color="#2563EB" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>

        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="close" size={28} color="#1E293B" />
        </TouchableOpacity>

        <Text style={styles.headerTitle}>質問の設定</Text>

        <TouchableOpacity
          onPress={handleSave}
          disabled={saving}
          style={styles.saveButton}
        >
          {saving ? (
            <ActivityIndicator size="small" color="#FFF" />
          ) : (
            <Text style={styles.saveButtonText}>保存</Text>
          )}
        </TouchableOpacity>

      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={{ flex: 1 }}
      >
        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>

          <View style={styles.introSection}>
            <Text style={styles.introTitle}>質問カード</Text>
            <Text style={styles.introText}>
              相手が"いいね"を送る時に答えてもらう質問を設定しましょう。{'\n'}共通の話題が見つかりやすくなり、マッチング後の会話が盛り上がります！
            </Text>
          </View>

          <View style={styles.previewContainer}>
            <Text style={styles.label}>プレビュー(相手にはこう表示されます){'\n'}※プロフィール上には表示されません</Text>

            <View style={styles.previewCard}>
              <View style={styles.previewHeader}>

                <View style={styles.previewBadge}>
                  <Text style={styles.previewBadgeText}>QUESTION</Text>
                </View>

              </View>

              <Text style={[styles.previewText, !question.trim() && { color: '#E2E8F0' }]}>
                {question.trim() ? question : '(質問がここに表示されます)'}
              </Text>

              <View style={styles.previewFooter}>
                <Ionicons name="chatbox-ellipses-outline" size={14} color="#94A3B8" />
                <Text style={styles.previewFooterText}>回答していいね！</Text>
              </View>
            </View>
          </View>

          <View style={styles.inputContainer}>
            <Text style={styles.label}>あなたの質問</Text>

            <View style={styles.inputWrapper}>
              <TextInput
                style={styles.input} placeholder="例：休みの日は何をして過ごすのが好きですか？" placeholderTextColor="#94A3B8"
                value={question} onChangeText={setQuestion} multiline maxLength={60}
              />
              {question.length > 0 && (
                <TouchableOpacity onPress={clearQuestion} style={styles.clearBtn}>
                  <Ionicons name="close-circle" size={20} color="#CBD5E1" />
                </TouchableOpacity>
              )}
            </View>

            <View style={styles.inputFooter}>
              <Text style={styles.warningText}>
                公序良俗に反する質問は設定できません{'\n'}
                該当の質問は審査対象となります
              </Text>
              <Text style={styles.charCount}>{question.length}/60</Text>
            </View>
          </View>

          <View style={styles.suggestionsContainer}>
            <View style={styles.suggestionHeader}>
              <MaterialCommunityIcons name="lightbulb-on-outline" size={18} color="#F59E0B" />
              <Text style={styles.suggestionTitle}>おすすめの質問</Text>
            </View>

            <View style={styles.chipsWrapper}>
              {SUGGESTED_QUESTIONS.map((q, index) => (
                <QuestionChip key={index} text={q} onPress={setQuestion} />
              ))}
            </View>
          </View>

        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}


const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC', },
  center: { justifyContent: 'center', alignItems: 'center', },
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingTop: Platform.OS === 'ios' ? 60 : 40,
    paddingHorizontal: 20, paddingBottom: 20, backgroundColor: '#FFF', borderBottomWidth: 1, borderBottomColor: '#F1F5F9',
  },
  headerTitle: { fontSize: 16, fontWeight: '800', color: '#1E293B', },
  backButton: { padding: 4, },
  saveButton: {
    backgroundColor: '#2563EB', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, minWidth: 70, alignItems: 'center',
  },
  saveButtonDisabled: { backgroundColor: '#94A3B8', },
  saveButtonText: { color: '#FFF', fontWeight: 'bold', fontSize: 13, },
  scrollContent: { padding: 24, paddingBottom: 40, },
  introSection: { marginBottom: 32, },
  introTitle: { fontSize: 24, fontWeight: '800', color: '#1E293B', marginBottom: 8, letterSpacing: 0.5, },
  introText: { fontSize: 14, color: '#64748B', lineHeight: 22, },
  previewContainer: { marginBottom: 32, },
  label: { fontSize: 11, fontWeight: '800', color: '#94A3B8', marginBottom: 12, letterSpacing: 1, },
  previewCard: {
    backgroundColor: '#EFF6FF', borderRadius: 20, padding: 20, borderWidth: 1, borderColor: '#DBEAFE', borderLeftWidth: 4,
    borderLeftColor: '#2563EB', shadowColor: "#2563EB", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.05,
    shadowRadius: 12, elevation: 2,
  },
  previewHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, },
  previewBadge: { backgroundColor: '#2563EB', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, },
  previewBadgeText: { color: '#FFF', fontSize: 9, fontWeight: '800', letterSpacing: 1, },
  previewNote: { fontSize: 10, color: '#64748B', },
  previewText: { fontSize: 16, fontWeight: '700', color: '#1E293B', lineHeight: 24, marginBottom: 12, },
  previewFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', },
  previewFooterText: { fontSize: 10, color: '#94A3B8', marginLeft: 4, fontWeight: '600', },
  inputContainer: { marginBottom: 32, },
  inputWrapper: { position: 'relative', },
  input: {
    backgroundColor: '#FFF', borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 16, padding: 16,
    paddingRight: 40, fontSize: 15, color: '#1E293B', minHeight: 100, textAlignVertical: 'top',
  },
  clearBtn: { position: 'absolute', top: 16, right: 12, },
  inputFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginTop: 8, },
  warningText: { fontSize: 10, color: '#64748B', lineHeight: 14, flex: 1, marginRight: 16, },
  charCount: { textAlign: 'right', fontSize: 12, color: '#94A3B8', },
  suggestionsContainer: {},
  suggestionHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 16, },
  suggestionTitle: { fontSize: 14, fontWeight: '700', color: '#475569', marginLeft: 6, },
  chipsWrapper: { flexDirection: 'row', flexWrap: 'wrap', marginHorizontal: -4, },
  chip: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFF', paddingHorizontal: 14, paddingVertical: 10,
    borderRadius: 24, borderWidth: 1, borderColor: '#E2E8F0', margin: 4,
  },
  chipText: { fontSize: 12, color: '#475569', fontWeight: '600', },
});