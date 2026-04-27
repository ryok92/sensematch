import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Alert } from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { SafeAreaView } from 'react-native-safe-area-context';

interface AccountItemProps {
  title: string;
  iconName: string;
  isDestructive?: boolean;
  isLast?: boolean;
  onPress: () => void;
}
const AccountItem = ({ title, iconName, isDestructive, isLast, onPress }: AccountItemProps) => (
  <TouchableOpacity
    style={[styles.item, isLast && styles.itemLast]}
    onPress={onPress}
    activeOpacity={0.7}
  >
    <View style={styles.itemLeft}>
      <View style={[styles.iconBox, isDestructive ? styles.iconBoxDestructive : styles.iconBoxNormal]}>
        <Ionicons name={iconName} size={20} color={isDestructive ? "#EF4444" : "#4A90E2"} />
      </View>

      <Text style={[styles.itemTitle, isDestructive && styles.destructiveText]}>{title}</Text>
    </View>
    <Ionicons name="chevron-forward" size={20} color="#CCC" />
  </TouchableOpacity>
);

export default function AccountScreen({ navigation }: any) {
  const handleDeleteAccount = () => {
    Alert.alert(
      "退会の確認",
      "退会すると全てのデータが削除され、復元することはできません。本当によろしいですか？",
      [
        { text: "キャンセル", style: "cancel" },
        {
          text: "退会する",
          style: "destructive",
          onPress: () => console.log("退会処理を実行")
        }
      ]
    );
  };


  return (
    <View style={styles.container}>
      <SafeAreaView style={styles.safeArea}>

        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color="#333" />
          </TouchableOpacity>

          <Text style={styles.headerTitle}>アカウント設定</Text>

          <View style={{ width: 40 }} />
        </View>

        <ScrollView contentContainerStyle={styles.content}>
          <Text style={styles.sectionTitle}>ログイン情報</Text>

          <View style={styles.menuGroup}>
            <AccountItem
              title="登録メールアドレスの変更"
              iconName="mail-outline"
              onPress={() => console.log("Email Change")}
            />

            <AccountItem
              title="退会する"
              iconName="warning-outline"
              isDestructive
              isLast
              onPress={handleDeleteAccount}
            />
          </View>

          <Text style={styles.noteText}>
            ※退会手続きが完了すると、マッチング履歴やメッセージなどの全データが即座に削除されます。
          </Text>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC', },
  safeArea: { flex: 1, },
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16,
    paddingVertical: 12, backgroundColor: '#FFF', borderBottomWidth: 1, borderBottomColor: '#F1F5F9',
  },
  backButton: { padding: 8, },
  headerTitle: { fontSize: 17, fontWeight: '700', color: '#333', },
  content: { padding: 24, },
  sectionTitle: { fontSize: 13, color: '#64748B', marginBottom: 8, marginLeft: 4, fontWeight: '600', },
  menuGroup: {
    backgroundColor: '#FFF', borderRadius: 16, borderWidth: 1, borderColor: '#E2E8F0',
    overflow: 'hidden', marginBottom: 16,
  },
  item: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16,
    backgroundColor: '#FFF', borderBottomWidth: 1, borderBottomColor: '#F1F5F9',
  },
  itemLast: { borderBottomWidth: 0, },
  itemLeft: { flexDirection: 'row', alignItems: 'center', },
  iconBox: {
    width: 36, height: 36, borderRadius: 12, justifyContent: 'center', alignItems: 'center', marginRight: 12,
  },
  iconBoxNormal: { backgroundColor: '#EFF6FF', },
  iconBoxDestructive: { backgroundColor: '#FEF2F2', },
  itemTitle: { fontSize: 15, fontWeight: '500', color: '#333', },
  destructiveText: { color: '#EF4444', },
  noteText: { fontSize: 12, color: '#94A3B8', lineHeight: 18, paddingHorizontal: 4, },
});