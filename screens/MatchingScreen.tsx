import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Modal, Animated, TouchableOpacity, ImageBackground, Dimensions, } from 'react-native';
import { LinearGradient } from 'react-native-linear-gradient';
import Ionicons from 'react-native-vector-icons/Ionicons';

const { width, height } = Dimensions.get('window');

interface Props {
  visible: boolean;
  onClose: () => void;
  onGoToChat: () => void;
  partnerName?: string;
}

export default function MatchingScreen({ visible, onClose, onGoToChat, partnerName }: Props) {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.5)).current;
  const buttonFadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      fadeAnim.setValue(0);
      scaleAnim.setValue(0.5);
      buttonFadeAnim.setValue(0);

      Animated.sequence([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 400,
          useNativeDriver: true,
        }),
        Animated.spring(scaleAnim, {
          toValue: 1,
          tension: 400,
          useNativeDriver: true,
        }),
        Animated.timing(buttonFadeAnim, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        })
      ]).start();
    }
  }, [visible]);

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="none"
      onRequestClose={onClose}
    >
      <Animated.View style={[styles.container, { opacity: fadeAnim }]}>
        <ImageBackground
          source={require('../assets/matching.png')}
          style={styles.backgroundImage}
          resizeMode="cover"
        >
          <View style={styles.overlay}>
            <Animated.View style={[styles.content, { transform: [{ scale: scaleAnim }] }]}>
              <Text style={styles.matchTitle}>MATCHING!</Text>
              <Text style={styles.matchSubtitle}>
                {partnerName || 'お相手'}さんと{'\n'}マッチングしました🎉
              </Text>
              <Text style={styles.congratulationsText}>
                メッセージを送ってみましょう！
              </Text>
            </Animated.View>

            <Animated.View style={[styles.buttonContainer, { opacity: buttonFadeAnim }]}>
              <TouchableOpacity
                activeOpacity={0.9}
                onPress={onGoToChat}
                style={styles.primaryButtonWrapper}
              >
                <LinearGradient
                  colors={['#FF6B6B', '#FF8E53']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.primaryButton}
                >
                  <Ionicons name="chatbubbles" size={24} color="#FFF" style={{ marginRight: 8 }} />
                  <Text style={styles.primaryButtonText}>メッセージを送る</Text>
                </LinearGradient>
              </TouchableOpacity>

              <TouchableOpacity
                activeOpacity={0.8}
                onPress={onClose}
                style={styles.secondaryButton}
              >
                <Text style={styles.secondaryButtonText}>あとで</Text>
              </TouchableOpacity>
            </Animated.View>

          </View>
        </ImageBackground>
      </Animated.View>
    </Modal>
  );
}


const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: 'rgba(0,0,0,0.8)', },
  backgroundImage: { flex: 1, width: '100%', height: '100%', },
  overlay: {
    flex: 1, backgroundColor: 'rgba(255, 255, 255, 0.15)', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 80, paddingHorizontal: 20,
  },
  content: { alignItems: 'center', marginTop: height * 0.1, },
  matchTitle: {
    fontSize: 52, fontWeight: '900', color: '#FFF', textShadowColor: 'rgba(255, 107, 107, 0.9)', textShadowOffset: { width: 0, height: 4 },
    textShadowRadius: 15, letterSpacing: 3, marginBottom: 20, fontStyle: 'italic',
  },
  matchSubtitle: {
    fontSize: 22, fontWeight: '800', color: '#FFF', textAlign: 'center', lineHeight: 34, textShadowColor: 'rgba(0, 0, 0, 0.3)',
    textShadowOffset: { width: 0, height: 2 }, textShadowRadius: 6, marginBottom: 16,
  },
  congratulationsText: {
    fontSize: 14, fontWeight: '600', color: '#FFF', textAlign: 'center', backgroundColor: 'rgba(0,0,0,0.2)', paddingHorizontal: 16,
    paddingVertical: 8, borderRadius: 20, overflow: 'hidden',
  },
  buttonContainer: { width: '100%', alignItems: 'center', marginBottom: 30, },
  primaryButtonWrapper: {
    width: '90%', shadowColor: '#FF6B6B', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.5, shadowRadius: 16,
    elevation: 10, marginBottom: 20,
  },
  primaryButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 18, borderRadius: 30, },
  primaryButtonText: { color: '#FFF', fontSize: 18, fontWeight: '800', letterSpacing: 1, },
  secondaryButton: { paddingVertical: 12, paddingHorizontal: 30, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.2)', },
  secondaryButtonText: { color: '#FFF', fontSize: 15, fontWeight: '700', letterSpacing: 0.5, }
});