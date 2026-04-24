import React, { useState, useEffect, useRef, useMemo } from "react";
import {
  View, Text, StyleSheet, FlatList, Image, TouchableOpacity, TextInput, KeyboardAvoidingView, Platform, Alert, ActivityIndicator,
  TouchableWithoutFeedback, Modal, Keyboard, StatusBar,
} from "react-native";
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";
import Ionicons from 'react-native-vector-icons/Ionicons';
import MaterialCommunityIcons from 'react-native-vector-icons/Ionicons';
import Feather from 'react-native-vector-icons/Ionicons';
import LinearGradient from 'react-native-linear-gradient';
import ImagePicker from 'react-native-image-crop-picker';
import { RouteProp } from "@react-navigation/native";
import auth from "@react-native-firebase/auth";
import firestore, { FirebaseFirestoreTypes } from "@react-native-firebase/firestore";
import storage from "@react-native-firebase/storage";

const ONLINE_THRESHOLD_MINUTES = 10;

type RootStackParamList = {
  Chat: { matchId: string; recipientId: string; recipientName: string; recipientImage: any };
};

type ChatScreenRouteProp = RouteProp<RootStackParamList, "Chat">;

interface Props {
  navigation: any;
  route: ChatScreenRouteProp;
}

interface Message {
  id: string;
  text: string;
  senderId: string;
  createdAt: any;
  type: string;
  read: boolean;
  gameTitle?: string;
}

export default function ChatScreen({ navigation, route }: Props) {
  const insets = useSafeAreaInsets();
  const { matchId, recipientId, recipientName, recipientImage } = route.params || {};
  const [inputText, setInputText] = useState<string>("");
  const [messages, setMessages] = useState<any[]>([]);
  const [partnerStatus, setPartnerStatus] = useState<"オンライン" | "オフライン">("オフライン");
  const [loading, setLoading] = useState<boolean>(true);
  const [uploading, setUploading] = useState<boolean>(false);
  const flatListRef = useRef<FlatList>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [viewerVisible, setViewerVisible] = useState<boolean>(false);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [keyboardOffset, setKeyboardOffset] = useState<number>(0);

  const currentUser = auth().currentUser;

  useEffect(() => {
    if (Platform.OS === 'android') {
      const keyboardDidShowListener = Keyboard.addListener(
        'keyboardDidShow', (e) => setKeyboardOffset(e.endCoordinates.height)
      );
      const keyboardDidHideListener = Keyboard.addListener(
        'keyboardDidHide', () => setKeyboardOffset(0)
      );

      return () => {
        keyboardDidShowListener.remove();
        keyboardDidHideListener.remove();
      };
    }
  }, []);

  useEffect(() => {
    if (!currentUser) return;

    const messageRef = firestore().collection('matches').doc(matchId).collection('messages');

    const unsubscribeMessages = messageRef.orderBy("createdAt", "asc").onSnapshot((snapshot) => {
      if (snapshot && !snapshot.empty) {
        const msgs = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        })) as Message[];
        setMessages(msgs);
      } else {
        setMessages([]);
      }
      setLoading(false);
    },
      (error) => {
        console.error("Message subscription error:", error);
        setLoading(false);
      }
    );

    const markAsRead = async () => {
      try {
        await firestore().collection("matches").doc(matchId).update({
          [`unreadCounts.${currentUser.uid}`]: 0,
        });
      } catch (error) {
        console.error("Mark as read error:", error);
      }
    };
    markAsRead();

    return () => {
      unsubscribeMessages();
    };
  }, [matchId, currentUser]);

  const handleSend = async (
    text: string = inputText,
    type: string = "text",
    gameTitle: string | null = null,
  ) => {
    if (type === "text" && !text?.trim()) return;
    if (!currentUser || !matchId) return;

    const textToSend = text;
    if (type === "text") setInputText("");

    try {
      const batch = firestore().batch();
      const messageRef = firestore().collection('matches').doc('matchId').collection('messages').doc();

      const messageData: any = {
        text: textToSend,
        senderId: currentUser.uid,
        createdAt: firestore.FieldValue.serverTimestamp(),
        type: type,
        read: false,
      };

      if (type === "invite" && gameTitle) {
        messageData.gameTitle = gameTitle;
      }

      batch.set(messageRef, messageData);

      let previewText = textToSend;
      if (type === "invite") previewText = "共体験への招待が届きました";
      if (type === "image") previewText = "画像を送信しました";

      const matchRef = firestore().collection('matches').doc('matchId');
      batch.update(matchRef, {
        lastMessage: previewText,
        lastMessageAt: firestore.FieldValue.serverTimestamp(),
        [`unreadCounts.${recipientId}`]: firestore.FieldValue.increment(1),
      });

      await batch.commit();
    } catch (error) {
      console.error("Send message error:", error);
      Alert.alert("エラー", "メッセージの送信に失敗しました");
    }
  };

  const handleAttachImage = async () => {
    try {
      const result = await ImagePicker.openPicker({
        mediaType: "photo",
        compressImageQuality: 0.7,
      });

      if (result && result.path) {
        uploadAndSendImage(result.path);
      }
    } catch (error) {
      console.error("ImagePicker Error:", error);
      Alert.alert("エラー", "画像選択機能の起動に失敗しました。");
    }
  };

  const uploadAndSendImage = async (uri: string) => {
    try {
      setUploading(true);
      const ext = uri.split(".").pop() || "jpg";
      const safeFieldname = `${Date.now()}_${Math.floor(
        Math.random() * 10000,
      )}.${ext}`;
      const storagePath = `chat_images/${matchId}/${safeFieldname}`;
      const uploadUri = Platform.OS === "ios" ? uri.replace("file://", "") : uri;

      const storageReference = storage().ref(storagePath);
      await storageReference.putFile(uploadUri);
      const url = await storageReference.getDownloadURL();

      await handleSend(url, "image");
    } catch (error) {
      console.error("Image upload error:", error);
      Alert.alert("アップロードエラー", "画像の送信に失敗しました。");
    } finally {
      setUploading(false);
    }
  };

  const handleDeleteImage = async (messageId: string) => {
    if (!matchId || !messageId) {
      Alert.alert("エラー", "削除に必要な情報が不足しています。");
      return;
    }

    try {
      const isLatesMessage =
        messages.length > 0 && messages[messages.length - 1].id === messageId;
      const updateMessages = messages.filter((msg) => msg.id !== messageId);
      setMessages(updateMessages);

      await firestore().collection('matches').doc(matchId).collection('messages').doc(messageId).delete();

      if (isLatesMessage) {
        const matchRef = firestore().collection('matches').doc(matchId);

        if (updateMessages.length > 0) {
          const newLatesMsg = updateMessages[updateMessages.length - 1];
          let previewText = newLatesMsg.text;
          if (newLatesMsg.type === "invite")
            previewText = "共体験への招待が届きました";
          if (newLatesMsg.type === "image") previewText = "画像を送信しました";

          await matchRef.update({
            lastMessage: previewText,
            lastMessageAt: newLatesMsg.createdAt || firestore.FieldValue.serverTimestamp(),
          });
        } else {
          await matchRef.update({
            lastMessage: "マッチングが成立しました！",
          });
        }
      }
    } catch (error: any) {
      console.error("[Delete Debug] Delete message error:", error);
      Alert.alert("削除エラー", `削除に失敗しました: ${error.message}`);
    }
  };

  const handleLongPressImage = (item: Message) => {
    if (item.senderId !== currentUser?.uid) {
      return;
    }

    Alert.alert(
      "送信を取り消し",
      "この画像を削除しますか？\n (お相手の画面からも消えます)",
      [
        { text: "キャンセル", style: "cancel" },
        {
          text: "削除する",
          style: "destructive",
          onPress: () => handleDeleteImage(item.id),
        },
      ],
    );
  };

  const handlePressImage = (imageUrl: string) => {
    setSelectedImage(imageUrl);
    setViewerVisible(true);
  };

  const handleInvite = () => {
    Alert.alert("共体験へ誘う", "「ダークエスケープ」への招待を送りますか？", [
      { text: "キャンセル", style: "cancel" },
      {
        text: "送信",
        onPress: () =>
          handleSend(
            "少し時間があれば、ミニゲームで遊びませんか？",
            "invite",
            "ダークエスケープ",
          ),
      },
    ]);
  };

  const handleAiTopic = () => {
    Alert.alert("AIアシスタント", "Gemini APIで後日実装");
  };

  const handleAvatarPress = async () => {
    if (!recipientId) return;
    navigation.navigate('UserProfile', { userId: recipientId });
  };

  const formatTime = (dateObj: Date) => {
    if (!dateObj) return "";

    const hours = dateObj.getHours().toString().padStart(2, "0");
    const minutes = dateObj.getMinutes().toString().padStart(2, "0");
    return `${hours}:${minutes}`;
  };

  const renderItem = ({ item, index }: { item: Message; index: number }) => {
    const isMe = item.senderId === currentUser?.uid;

    let showDateHeader = false;
    if (index === 0) {
      showDateHeader = true;
    } else {
      const prevItem = messages[index - 1];
      const currentDate = item.createdAt;
      const prevDate = prevItem.createdAt;
      if (
        currentDate.getFullYear() !== prevDate.getFullYear() ||
        currentDate.getMonth() !== prevDate.getMonth() ||
        currentDate.getDate() !== prevDate.getDate()
      ) {
        showDateHeader = true;
      }
    }

    const formatDateHeader = (dateObj: Date) => {
      if (!dateObj) return "";
      const m = dateObj.getMonth() + 1;
      const d = dateObj.getDate();
      const days = ["日", "月", "火", "水", "木", "金", "土"];
      const day = days[dateObj.getDay()];

      const today = new Date();
      if (
        d === today.getDate() &&
        dateObj.getMonth() === today.getMonth() &&
        dateObj.getFullYear() === today.getFullYear()
      ) {
        return "今日";
      }
      return `${m}月${d}日 (${day})`;
    };

    const renderMessageContent = () => {
      if (item.type === "image") {
        return (
          <TouchableOpacity
            activeOpacity={0.9}
            onPress={() => handlePressImage(item.text)}
            onLongPress={() => handleLongPressImage(item)}
            style={styles.imageContainer}
          >
            <Image
              source={{ uri: item.text }}
              style={styles.messageImageNoBubble}
              resizeMode="cover"
            />
          </TouchableOpacity>
        );
      } else if (item.type === "invite") {
        return (
          <View style={styles.inviteCard}>
            <LinearGradient
              colors={["#F97316", "#EF4444"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.inviteHeader}
            >
              <MaterialCommunityIcons
                name="gamepad-variant"
                size={16}
                color="#FFF"
                style={{ marginRight: 4 }}
              />
              <Text style={styles.inviteLabel}>共体験に招待</Text>
            </LinearGradient>

            <View style={styles.inviteBody}>
              <Text style={styles.inviteTitle}>
                {item.gameTitle || "ゲーム"}
              </Text>
              <Text style={styles.inviteDesc}>{item.text}</Text>

              <TouchableOpacity
                style={styles.joinButton}
                onPress={() => navigation.navigate("GameEntry")}
                disabled={isMe}
              >
                <Text style={styles.joinButtonText}>参加する</Text>
              </TouchableOpacity>
            </View>
          </View>
        );
      } else {
        return (
          <View
            style={[
              styles.bubble,
              isMe ? styles.bubbleMe : styles.bubblePartner,
            ]}
          >
            <Text
              style={[
                styles.msgText,
                isMe ? styles.msgTextMe : styles.msgTextPartner,
              ]}
            >
              {item.text}
            </Text>
          </View>
        );
      }
    };

    return (
      <View>
        {showDateHeader && (
          <View style={styles.dateHeaderContainer}>
            <Text style={styles.dateHeaderText}>
              {formatDateHeader(item.createdAt)}
            </Text>
          </View>
        )}

        <View
          style={[styles.msgRow, isMe ? styles.msgRowMe : styles.msgRowPartner]}
        >
          {!isMe && (
            <TouchableOpacity activeOpacity={0.8} onPress={handleAvatarPress}>
              <Image
                source={
                  recipientImage &&
                    typeof recipientImage === "object" &&
                    recipientImage.uri
                    ? { uri: recipientImage.uri }
                    : typeof recipientImage === "number"
                      ? recipientImage
                      : { uri: "https://via.placeholder.com/150" }
                }
                style={styles.avatar}
              />
            </TouchableOpacity>
          )}

          <View
            style={[
              styles.messageContentWrapper,
              isMe
                ? { flexDirection: "row-reverse" }
                : { flexDirection: "row" },
            ]}
          >
            <View
              style={[
                styles.bubbleWrapper,
                isMe
                  ? { alignItems: "flex-end" }
                  : { alignItems: "flex-start" },
              ]}
            >
              {renderMessageContent()}
            </View>

            <View
              style={[
                styles.timeContainer,
                isMe
                  ? { alignItems: "flex-end" }
                  : { alignItems: "flex-start" },
              ]}
            >
              {isMe && item.read && (
                <Text style={styles.readText}>既読</Text>
              )}
              <Text style={styles.timeText}>{formatTime(item.createdAt)}</Text>
            </View>
          </View>
        </View>
      </View>
    );
  };

  const renderInputArea = () => (
    <>
      {uploading && (
        <View style={styles.uploadingOverlayModal}>
          <ActivityIndicator size="small" color="#FFF" />
          <Text style={styles.uploadingText}>送信中...</Text>
        </View>
      )}

      <View
        style={[
          styles.inputArea,
          { paddingBottom: Math.max(insets.bottom, 8) },
        ]}
      >
        <View style={styles.suggestionRow}>
          <TouchableOpacity
            onPress={handleInvite}
            style={styles.suggestionChip}
          >
            <MaterialCommunityIcons
              name="gamepad-variant-outline"
              size={14}
              color="#EA580C"
              style={{ marginRight: 4 }}
            />
            <Text style={styles.suggestionText}>共体験へ誘う</Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={handleAiTopic}
            style={[
              styles.suggestionChip,
              {
                backgroundColor: "#F0F9FF",
                borderColor: "#BAE6FD",
                marginLeft: 8,
              },
            ]}
          >
            <MaterialCommunityIcons
              name="robot-excited-outline"
              size={14}
              color="#0284C7"
              style={{ marginRight: 4 }}
            />
            <Text style={[styles.suggestionText, { color: "#0284C7" }]}>
              話題を考案
            </Text>
          </TouchableOpacity>
        </View>

        <View style={styles.inputBar}>
          <TouchableOpacity
            onPress={handleAttachImage}
            style={styles.attachButton}
            disabled={uploading}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Feather
              name="plus"
              size={24}
              color={uploading ? "#CCC" : "#999"}
            />
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

          <TouchableOpacity
            onPress={() => handleSend()}
            disabled={uploading || !inputText.trim()}
            style={{ padding: 4 }}
          >
            <Ionicons
              name="send"
              size={24}
              color={inputText.trim() && !uploading ? "#4A90E2" : "#CCC"}
            />
          </TouchableOpacity>
        </View>
      </View>
    </>
  );

  return (
    <View style={styles.container}>
      <SafeAreaView
        edges={["top"]}
        style={{ flex: 0, backgroundColor: "#FFF" }}
      />

      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={{ padding: 4 }}
        >
          <Ionicons name="chevron-back" size={28} color="#333" />
        </TouchableOpacity>

        <Text style={styles.headerTitle} numberOfLines={1}>
          {recipientName || "ユーザー"}
        </Text>

        <View style={styles.headerRight} />
      </View>

      {Platform.OS === "ios" ? (
        <KeyboardAvoidingView behavior="padding" style={{ flex: 1 }}>
          <View style={styles.contentContainer}>
            {loading ? (
              <View style={styles.centered}>
                <ActivityIndicator size="large" color="#4A90E2" />
              </View>
            ) : (
              <FlatList
                ref={flatListRef}
                data={messages}
                keyExtractor={(item) => item.id}
                renderItem={renderItem}
                contentContainerStyle={styles.listContent}
                onContentSizeChange={() =>
                  flatListRef.current?.scrollToEnd({ animated: true })
                }
                onLayout={() =>
                  flatListRef.current?.scrollToEnd({ animated: true })
                }
              />
            )}
          </View>

          {renderInputArea()}
        </KeyboardAvoidingView>
      ) : (
        <View style={{ flex: 1, paddingBottom: keyboardOffset }}>
          <View style={styles.contentContainer}>
            {loading ? (
              <View style={styles.centered}>
                <ActivityIndicator size="large" color="#4A90E2" />
              </View>
            ) : (
              <FlatList
                ref={flatListRef}
                data={messages}
                keyExtractor={(item) => item.id}
                renderItem={renderItem}
                contentContainerStyle={styles.listContent}
                onContentSizeChange={() =>
                  flatListRef.current?.scrollToEnd({ animated: true })
                }
                onLayout={() =>
                  flatListRef.current?.scrollToEnd({ animated: true })
                }
              />
            )}
          </View>

          {renderInputArea()}
        </View>
      )}

      <Modal
        visible={viewerVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setViewerVisible(false)}
      >
        <View style={styles.viewerContainer}>
          <StatusBar hidden />

          <TouchableOpacity
            style={styles.viewerCloseButton}
            onPress={() => setViewerVisible(false)}
          >
            <Ionicons name="close" size={30} color="#FFF" />
          </TouchableOpacity>

          <TouchableWithoutFeedback onPress={() => setViewerVisible(false)}>
            <View style={styles.viewerContent}>
              {selectedImage && (
                <Image
                  source={{ uri: selectedImage }}
                  style={styles.viewerImage}
                  resizeMode="contain"
                />
              )}
            </View>
          </TouchableWithoutFeedback>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#FFF" },
  contentContainer: { flex: 1, backgroundColor: "#F5F7FA" },
  centered: { flex: 1, justifyContent: "center", alignItems: "center" },
  header: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 10, paddingVertical: 10,
    borderBottomWidth: 1, borderColor: "#F0F0F0", backgroundColor: "#FFF", zIndex: 10,
  },
  headerTitle: {
    fontSize: 16, fontWeight: "700", color: "#333", flex: 1, textAlign: "center", marginHorizontal: 16, marginLeft: 4,
  },
  headerRight: { flexDirection: "row", alignItems: "center" },
  listContent: { padding: 16, paddingBottom: 20, flexGrow: 1 },
  dateHeaderContainer: { alignItems: "center", marginTop: 8, marginBottom: 24 },
  dateHeaderText: {
    backgroundColor: "rgba(0, 0, 0, 0.05)", color: "#6B7280", fontSize: 12, fontWeight: "600", paddingHorizontal: 16,
    paddingVertical: 4, borderRadius: 14, overflow: "hidden",
  },
  messageContentWrapper: { flexDirection: "row", alignItems: "flex-end", flex: 1, },
  timeContainer: { marginHorizontal: 6, marginBottom: 2 },
  timeText: { fontSize: 10, color: "#9CA3AF", fontWeight: "500" },
  readText: { fontSize: 10, color: "#9CA3AF", fontWeight: "500", marginBottom: 2, },
  msgRow: { flexDirection: "row", marginBottom: 16, width: "100%" },
  msgRowMe: { justifyContent: "flex-end" },
  msgRowPartner: { justifyContent: "flex-start" },
  avatar: { width: 32, height: 32, borderRadius: 16, marginRight: 8, backgroundColor: "#DDD", },
  bubbleWrapper: { maxWidth: "75%" },
  bubble: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 18 },
  bubbleMe: { backgroundColor: "#4A90E2", borderBottomRightRadius: 4 },
  bubblePartner: { backgroundColor: "#FFF", borderWidth: 1, borderColor: "#F0F0F0", borderBottomLeftRadius: 4, },
  msgText: { fontSize: 15, lineHeight: 22 },
  msgTextMe: { color: "#FFF" },
  msgTextPartner: { color: "#333" },
  imageContainer: { borderRadius: 14, overflow: "hidden", backgroundColor: "#E0E0E0", },
  messageImageNoBubble: { width: 200, height: 200, borderRadius: 14 },
  inviteCard: { width: 240, backgroundColor: "#FFF", borderRadius: 16, overflow: "hidden", borderWidth: 1, borderColor: "rgba(74, 144, 226, 0.2)", },
  inviteHeader: { flexDirection: "row", padding: 12, alignItems: "center" },
  inviteLabel: { color: "#FFF", fontWeight: "700", fontSize: 11 },
  inviteBody: { padding: 12 },
  inviteTitle: { fontWeight: "700", color: "#333", marginBottom: 4 },
  inviteDesc: { fontSize: 12, color: "#666", marginBottom: 12 },
  joinButton: { backgroundColor: "#4A90E2", paddingVertical: 8, borderRadius: 20, alignItems: "center", },
  joinButtonText: { color: "#FFF", fontWeight: "700", fontSize: 12 },
  uploadingOverlayModal: {
    alignSelf: "center", marginBottom: 16, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(0,0,0,0.7)",
    borderRadius: 20, padding: 10, flexDirection: "row", zIndex: 20,
  },
  inputArea: { paddingHorizontal: 8, paddingTop: 8, borderTopWidth: 1, borderColor: "#F0F0F0", backgroundColor: "#FFF", },
  suggestionRow: { flexDirection: "row", paddingBottom: 8, paddingHorizontal: 4, },
  suggestionChip: {
    flexDirection: "row", alignItems: "center", paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16,
    backgroundColor: "#FFF7ED", borderWidth: 1, borderColor: "#FFEDD5",
  },
  suggestionText: { fontSize: 11, fontWeight: "700", color: "#EA580C" },
  inputBar: { flexDirection: "row", alignItems: "center", paddingBottom: 4 },
  attachButton: { padding: 8, marginRight: 4 },
  textInput: {
    flex: 1, backgroundColor: "#F5F7FA", borderRadius: 20, paddingHorizontal: 16, paddingVertical: 10, marginRight: 8,
    maxHeight: 100, color: "#333",
  },
  menuOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.1)" },
  menuContainer: {
    position: "absolute", top: 60, right: 16, width: 160, backgroundColor: "#FFF", borderRadius: 12, paddingVertical: 8,
    shadowColor: "#000", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 8, elevation: 10,
  },
  menuItem: { flexDirection: "row", alignItems: "center", paddingVertical: 12, paddingHorizontal: 16, },
  menuText: { fontSize: 14, fontWeight: "600", color: "#333" },
  uploadingText: { color: "#FFF", marginLeft: 8, fontSize: 12, fontWeight: "600", },
  viewerContainer: { flex: 1, backgroundColor: "#000", justifyContent: "center", alignItems: "center", },
  viewerContent: { width: "100%", height: "100%", justifyContent: "center", alignItems: "center", },
  viewerImage: { width: "100%", height: "100%" },
  viewerCloseButton: {
    position: "absolute", top: 50, right: 20, zIndex: 99, padding: 8, backgroundColor: "rgba(0,0,0,0.5)", borderRadius: 20,
  },
});
