import React, { useState, useEffect, useRef, useMemo } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Image,
  TouchableOpacity,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  Alert,
  ActivityIndicator,
  TouchableWithoutFeedback,
  Modal,
  Keyboard,
  StatusBar,
} from "react-native";
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";

// ✏️ [変更点]：@expo/vector-icons から react-native-vector-icons に変更
import Ionicons from "react-native-vector-icons/Ionicons";
import MaterialCommunityIcons from "react-native-vector-icons/MaterialCommunityIcons";
import Feather from "react-native-vector-icons/Feather";

// ✏️ [変更点]：expo-linear-gradient から react-native-linear-gradient に変更し、波括弧を削除
import LinearGradient from "react-native-linear-gradient";

// ✏️ [変更点]：expo-image-picker から react-native-image-crop-picker に変更
import ImagePicker from "react-native-image-crop-picker";

// ✏️ [変更点]：expo-navigation-bar を削除（CLIの組み込み機能や他の代替ライブラリを使用するため）
// import * as NavigationBar from "expo-navigation-bar";

import { RouteProp } from "@react-navigation/native";

// ✏️ [変更点]：firebaseモジュール（Web版）のインポートを削除し、@react-native-firebase/xxxx に統一
import auth from "@react-native-firebase/auth";
import firestore, { FirebaseFirestoreTypes } from "@react-native-firebase/firestore";
import storage from "@react-native-firebase/storage";

const ONLINE_THRESHOLD_MINUTES = 10;

type RootStackParamList = {
  Chat: { matchId: string; user: { id: string; name: string; avatarUrl?: string } };
};

type ChatScreenRouteProp = RouteProp<RootStackParamList, "Chat">;

interface Props {
  route: ChatScreenRouteProp;
  navigation: any;
}

export default function ChatScreen({ route, navigation }: Props) {
  const insets = useSafeAreaInsets();
  const { matchId, user: chatPartner } = route.params;
  const [messages, setMessages] = useState<any[]>([]);
  const [inputText, setInputText] = useState("");
  const [partnerStatus, setPartnerStatus] = useState<"オンライン" | "オフライン">("オフライン");
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [menuVisible, setMenuVisible] = useState(false);
  const flatListRef = useRef<FlatList>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);

  // ✏️ [変更点]：currentUserの取得方法を @react-native-firebase/auth の形式に変更
  const currentUser = auth().currentUser;

  useEffect(() => {
    if (!currentUser) return;
    
    // ✏️ [変更点]：Firestoreのクエリ構築を @react-native-firebase/firestore の形式に変更
    const messagesRef = firestore()
      .collection("matches")
      .doc(matchId)
      .collection("messages");
    
    const messagesQuery = messagesRef.orderBy("createdAt", "asc");

    // メッセージのリアルタイムリスナー
    const unsubscribeMessages = messagesQuery.onSnapshot((snapshot) => {
      if (snapshot && !snapshot.empty) {
        const msgs = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }));
        setMessages(msgs);
        
        // 既読処理（バッチ処理）
        // ✏️ [変更点]：バッチ処理のインスタンス生成方法を変更
        const batch = firestore().batch();
        let needsUpdate = false;
        snapshot.docs.forEach((doc) => {
          if (doc.data().senderId !== currentUser.uid && !doc.data().isRead) {
            batch.update(doc.ref, { isRead: true });
            needsUpdate = true;
          }
        });
        if (needsUpdate) {
          batch.commit();
        }
      } else {
        setMessages([]);
      }
      setLoading(false);
    }, (error) => {
      console.error("Messages listener error:", error);
      setLoading(false);
    });

    // パートナーのステータスリスナー
    const partnerRef = firestore().collection("users").doc(chatPartner.id);
    const unsubscribePartner = partnerRef.onSnapshot((doc) => {
      if (doc && doc.exists) {
        const data = doc.data();
        if (data?.lastActive) {
          const lastActiveDate = data.lastActive.toDate();
          const now = new Date();
          const diffMinutes = (now.getTime() - lastActiveDate.getTime()) / (1000 * 60);
          setPartnerStatus(diffMinutes <= ONLINE_THRESHOLD_MINUTES ? "オンライン" : "オフライン");
        }
      }
    });

    return () => {
      unsubscribeMessages();
      unsubscribePartner();
    };
  }, [matchId, currentUser]);

  const sendMessage = async (text: string, imageUrl: string | null = null) => {
    if ((!text.trim() && !imageUrl) || !currentUser) return;

    const messageData = {
      senderId: currentUser.uid,
      text: text.trim(),
      imageUrl: imageUrl || null,
      // ✏️ [変更点]：サーバータイムスタンプの取得方法を変更
      createdAt: firestore.FieldValue.serverTimestamp(),
      isRead: false,
    };

    try {
      // ✏️ [変更点]：ドキュメント追加と更新の処理を変更
      const matchRef = firestore().collection("matches").doc(matchId);
      await matchRef.collection("messages").add(messageData);

      await matchRef.update({
        lastMessage: imageUrl ? "画像を送信しました" : text.trim(),
        lastMessageTime: firestore.FieldValue.serverTimestamp(),
        // ✏️ [変更点]：incrementの使用方法を変更
        [`unreadCount.${chatPartner.id}`]: firestore.FieldValue.increment(1),
      });

      setInputText("");
      setImagePreview(null);
    } catch (error) {
      console.error("Error sending message:", error);
      Alert.alert("エラー", "メッセージの送信に失敗しました");
    }
  };

  const handleSend = () => {
    if (inputText.trim() || imagePreview) {
      if (imagePreview) {
        uploadImageAndSend(imagePreview);
      } else {
        sendMessage(inputText);
      }
    }
  };

  // ✏️ [変更点]：画像選択処理を react-native-image-crop-picker に変更
  const pickImage = async () => {
    try {
      const image = await ImagePicker.openPicker({
        width: 800,
        height: 800,
        cropping: false,
        mediaType: 'photo',
      });
      
      // image.pathにファイルのURLが入っています
      setImagePreview(image.path);
    } catch (error: any) {
      if (error.code !== 'E_PICKER_CANCELLED') {
         console.error("Image picking error:", error);
         Alert.alert("エラー", "画像の選択に失敗しました");
      }
    }
  };

  const uploadImageAndSend = async (uri: string) => {
    if (!currentUser) return;
    setUploading(true);
    try {
      const filename = `${matchId}_${Date.now()}.jpg`;
      // ✏️ [変更点]：Storageの参照とアップロード方法を変更
      const reference = storage().ref(`chat_images/${filename}`);
      await reference.putFile(uri);
      const downloadURL = await reference.getDownloadURL();
      
      await sendMessage(inputText, downloadURL);
    } catch (error) {
      console.error("Upload error:", error);
      Alert.alert("エラー", "画像の送信に失敗しました");
    } finally {
      setUploading(false);
    }
  };

  const clearChatHistory = () => {
    Alert.alert("トーク履歴を削除", "すべてのメッセージを削除しますか？", [
      { text: "キャンセル", style: "cancel" },
      {
        text: "削除",
        style: "destructive",
        onPress: async () => {
          try {
            // ✏️ [変更点]：クエリとドキュメントの削除処理を変更
            const messagesRef = firestore().collection("matches").doc(matchId).collection("messages");
            const snapshot = await messagesRef.get();
            
            const batch = firestore().batch();
            snapshot.docs.forEach((doc) => {
              batch.delete(doc.ref);
            });
            await batch.commit();

            await firestore().collection("matches").doc(matchId).update({
              lastMessage: "",
              // createdAtを消さないように注意が必要な場合は、削除ではなくnull等にするか検討
            });
            setMenuVisible(false);
          } catch (error) {
            console.error("Delete error:", error);
            Alert.alert("エラー", "削除に失敗しました");
          }
        },
      },
    ]);
  };

  const renderMessage = ({ item }: { item: any }) => {
    const isMe = item.senderId === currentUser?.uid;
    const time = item.createdAt?.toDate ? 
      item.createdAt.toDate().toLocaleTimeString("ja-JP", { hour: "2-digit", minute: "2-digit" }) : 
      "";

    return (
      <View style={[styles.messageWrapper, isMe ? styles.messageWrapperMe : styles.messageWrapperPartner]}>
        {!isMe && (
          <Image
            source={chatPartner.avatarUrl ? { uri: chatPartner.avatarUrl } : require("../assets/images/default-avatar.png")}
            style={styles.avatar}
          />
        )}
        <View style={isMe ? styles.messageContentMe : styles.messageContentPartner}>
          <View style={[styles.messageBubble, isMe ? styles.bubbleMe : styles.bubblePartner]}>
            {item.imageUrl && (
              <Image source={{ uri: item.imageUrl }} style={styles.messageImage} />
            )}
            {item.text ? <Text style={[styles.messageText, isMe ? styles.textMe : styles.textPartner]}>{item.text}</Text> : null}
          </View>
          <View style={[styles.messageInfo, isMe ? styles.messageInfoMe : styles.messageInfoPartner]}>
            {isMe && <Text style={styles.timeText}>{item.isRead ? "既読 " : ""}</Text>}
            <Text style={styles.timeText}>{time}</Text>
          </View>
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <StatusBar barStyle="dark-content" />
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <Ionicons name="chevron-back" size={28} color="#333" />
        </TouchableOpacity>
        <TouchableOpacity style={styles.headerCenter} onPress={() => navigation.navigate("UserProfile", { userId: chatPartner.id })}>
          <Image
            source={chatPartner.avatarUrl ? { uri: chatPartner.avatarUrl } : require("../assets/images/default-avatar.png")}
            style={styles.headerAvatar}
          />
          <View>
            <Text style={styles.headerName}>{chatPartner.name}</Text>
            <Text style={styles.headerStatus}>{partnerStatus}</Text>
          </View>
        </TouchableOpacity>
        <TouchableOpacity style={styles.menuButton} onPress={() => setMenuVisible(true)}>
          <Ionicons name="ellipsis-vertical" size={24} color="#333" />
        </TouchableOpacity>
      </View>

      {/* Messages */}
      <KeyboardAvoidingView 
        style={styles.keyboardAvoidingView} 
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#007AFF" />
          </View>
        ) : (
          <FlatList
            ref={flatListRef}
            data={messages}
            keyExtractor={(item) => item.id}
            renderItem={renderMessage}
            contentContainerStyle={styles.messageList}
            onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
            onLayout={() => flatListRef.current?.scrollToEnd({ animated: true })}
            showsVerticalScrollIndicator={false}
          />
        )}

        {/* Input Area */}
        {imagePreview && (
          <View style={styles.imagePreviewContainer}>
             <Image source={{ uri: imagePreview }} style={styles.imagePreview} />
             <TouchableOpacity style={styles.cancelImagePreview} onPress={() => setImagePreview(null)}>
               <Ionicons name="close-circle" size={24} color="#FFF" />
             </TouchableOpacity>
          </View>
        )}
        <View style={[styles.inputContainer, { paddingBottom: Math.max(insets.bottom, 10) }]}>
          <TouchableOpacity style={styles.attachButton} onPress={pickImage} disabled={uploading}>
            <Feather name="image" size={24} color="#007AFF" />
          </TouchableOpacity>
          <TextInput
            style={styles.textInput}
            value={inputText}
            onChangeText={setInputText}
            placeholder="メッセージを入力..."
            multiline
            maxLength={500}
            editable={!uploading}
          />
          <TouchableOpacity onPress={handleSend} disabled={(!inputText.trim() && !imagePreview) || uploading}>
            {/* ✏️ [変更点]：LinearGradientの波括弧を削除したことによる通常のタグとしての利用 */}
            <LinearGradient
              colors={inputText.trim() || imagePreview ? ["#007AFF", "#00C6FF"] : ["#E5E5EA", "#E5E5EA"]}
              style={styles.sendButton}
            >
              {uploading ? (
                <ActivityIndicator size="small" color="#FFF" />
              ) : (
                <Ionicons name="send" size={20} color="#FFF" style={{ marginLeft: 4 }} />
              )}
            </LinearGradient>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>

      {/* Menu Modal */}
      <Modal visible={menuVisible} transparent animationType="fade" onRequestClose={() => setMenuVisible(false)}>
        <TouchableWithoutFeedback onPress={() => setMenuVisible(false)}>
          <View style={styles.menuOverlay}>
            <TouchableWithoutFeedback>
              <View style={styles.menuContainer}>
                <TouchableOpacity style={styles.menuItem} onPress={clearChatHistory}>
                  <MaterialCommunityIcons name="delete-sweep-outline" size={20} color="#FF3B30" style={{ marginRight: 8 }} />
                  <Text style={[styles.menuText, { color: "#FF3B30" }]}>トーク履歴を削除</Text>
                </TouchableOpacity>
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#FFF" },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#F0F0F0",
    backgroundColor: "#FFF",
    zIndex: 10,
  },
  backButton: { padding: 4 },
  headerCenter: { flexDirection: "row", alignItems: "center", flex: 1, marginLeft: 12 },
  headerAvatar: { width: 40, height: 40, borderRadius: 20, marginRight: 12 },
  headerName: { fontSize: 16, fontWeight: "600", color: "#333", marginBottom: 2 },
  headerStatus: { fontSize: 12, color: "#8E8E93" },
  menuButton: { padding: 4 },
  keyboardAvoidingView: { flex: 1 },
  loadingContainer: { flex: 1, justifyContent: "center", alignItems: "center" },
  messageList: { padding: 16, paddingBottom: 20 },
  messageWrapper: { flexDirection: "row", marginBottom: 16, alignItems: "flex-end" },
  messageWrapperMe: { justifyContent: "flex-end" },
  messageWrapperPartner: { justifyContent: "flex-start" },
  avatar: { width: 32, height: 32, borderRadius: 16, marginRight: 8 },
  messageContentMe: { alignItems: "flex-end", maxWidth: "75%" },
  messageContentPartner: { alignItems: "flex-start", maxWidth: "75%" },
  messageBubble: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 20, overflow: "hidden" },
  bubbleMe: { backgroundColor: "#007AFF", borderBottomRightRadius: 4 },
  bubblePartner: { backgroundColor: "#F0F0F0", borderBottomLeftRadius: 4 },
  messageText: { fontSize: 15, lineHeight: 20 },
  textMe: { color: "#FFF" },
  textPartner: { color: "#333" },
  messageImage: { width: 200, height: 200, borderRadius: 12, marginBottom: 4 },
  messageInfo: { flexDirection: "row", marginTop: 4 },
  messageInfoMe: { justifyContent: "flex-end" },
  messageInfoPartner: { justifyContent: "flex-start" },
  timeText: { fontSize: 11, color: "#8E8E93" },
  imagePreviewContainer: { padding: 16, paddingBottom: 0, alignItems: "center" },
  imagePreview: { width: 100, height: 100, borderRadius: 12 },
  cancelImagePreview: { position: "absolute", top: 10, right: 10 },
  inputContainer: { flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingTop: 10, borderTopWidth: 1, borderTopColor: "#F0F0F0", backgroundColor: "#FFF" },
  attachButton: { padding: 8, marginRight: 4 },
  textInput: {
    flex: 1,
    backgroundColor: "#F5F7FA",
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    marginRight: 8,
    maxHeight: 100,
    color: "#333",
  },
  sendButton: { width: 40, height: 40, borderRadius: 20, justifyContent: "center", alignItems: "center" },
  menuOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.1)" },
  menuContainer: {
    position: "absolute",
    top: 60,
    right: 16,
    width: 160,
    backgroundColor: "#FFF",
    borderRadius: 12,
    paddingVertical: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 10,
  },
  menuItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  menuText: { fontSize: 14, fontWeight: "600", color: "#333" },
});