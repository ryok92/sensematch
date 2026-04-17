import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Dimensions,
  PanResponder,
  Animated,
  TouchableOpacity,
  StatusBar,
} from 'react-native';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const CONTROL_SIZE = Math.min(SCREEN_WIDTH - 40, 300);
const CIRCLE_SIZE = Math.min(SCREEN_WIDTH * 0.9, 500);

export default function LightControlGame() {
  const [level, setLevel] = useState(1);
  const [timeLeft, setTimeLeft] = useState(60);
  const [isPaused, setIsPaused] = useState(false);
  const [gameOver, setGameOver] = useState(false);
  const [gameStarted, setGameStarted] = useState(false);

  // Light control position (0-100)
  const [lightX, setLightX] = useState(50);
  const [lightY, setLightY] = useState(50);

  // Rock position
  const [rockX, setRockX] = useState(50);
  const [rockProgress, setRockProgress] = useState(0);

  // Holes (obstacles)
  const [holes, setHoles] = useState<Array<{ id: number; x: number; progress: number }>>([]);

  // Animated values
  const lightPosX = useRef(new Animated.Value(50)).current;
  const lightPosY = useRef(new Animated.Value(50)).current;
  const rockPosX = useRef(new Animated.Value(50)).current;

  // Initialize holes
  useEffect(() => {
    const initialHoles = [];
    for (let i = 0; i < 10; i++) {
      initialHoles.push({
        id: i,
        x: Math.random() * 80 + 10,
        progress: i * 15 + 20,
      });
    }
    setHoles(initialHoles);
  }, []);

  // Timer
  useEffect(() => {
    if (!gameStarted || isPaused || gameOver) return;

    const timer = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          setGameOver(true);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [gameStarted, isPaused, gameOver]);

  // Rock auto-forward movement
  useEffect(() => {
    if (!gameStarted || isPaused || gameOver) return;

    const moveInterval = setInterval(() => {
      setRockProgress((prev) => {
        const newProgress = prev + 0.5;
        if (newProgress >= 100) {
          setLevel((l) => l + 1);
          setRockProgress(0);
          const newHoles = [];
          for (let i = 0; i < 10; i++) {
            newHoles.push({
              id: Date.now() + i,
              x: Math.random() * 80 + 10,
              progress: i * 15 + 20,
            });
          }
          setHoles(newHoles);
        }
        return newProgress >= 100 ? 0 : newProgress;
      });
    }, 50);

    return () => clearInterval(moveInterval);
  }, [gameStarted, isPaused, gameOver]);

  // Check collision with holes
  useEffect(() => {
    if (!gameStarted || gameOver) return;

    holes.forEach((hole) => {
      const distanceFromHole = Math.abs(rockProgress - hole.progress);
      const horizontalDistance = Math.abs(rockX - hole.x);

      if (distanceFromHole < 3 && horizontalDistance < 12) {
        setGameOver(true);
      }
    });
  }, [rockProgress, rockX, holes, gameStarted, gameOver]);

  // Light control PanResponder
  const lightPanResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (evt) => {
        updateLightPosition(evt.nativeEvent.locationX, evt.nativeEvent.locationY);
      },
      onPanResponderMove: (evt) => {
        updateLightPosition(evt.nativeEvent.locationX, evt.nativeEvent.locationY);
      },
    })
  ).current;

  // Rock control PanResponder
  const rockPanResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => gameStarted && !gameOver,
      onMoveShouldSetPanResponder: () => gameStarted && !gameOver,
      onPanResponderMove: (evt) => {
        updateRockPosition(evt.nativeEvent.pageX);
      },
    })
  ).current;

  const updateLightPosition = (x: number, y: number) => {
    const percentX = Math.max(0, Math.min(100, (x / CONTROL_SIZE) * 100));
    const percentY = Math.max(0, Math.min(100, (y / CONTROL_SIZE) * 100));

    setLightX(percentX);
    setLightY(percentY);

    Animated.parallel([
      Animated.timing(lightPosX, {
        toValue: percentX,
        duration: 0,
        useNativeDriver: false,
      }),
      Animated.timing(lightPosY, {
        toValue: percentY,
        duration: 0,
        useNativeDriver: false,
      }),
    ]).start();
  };

  const updateRockPosition = (pageX: number) => {
    const circleLeft = (SCREEN_WIDTH - CIRCLE_SIZE) / 2;
    const percentX = Math.max(10, Math.min(90, ((pageX - circleLeft) / CIRCLE_SIZE) * 100));

    setRockX(percentX);
    Animated.timing(rockPosX, {
      toValue: percentX,
      duration: 100,
      useNativeDriver: false,
    }).start();
  };

  const startGame = () => {
    setGameStarted(true);
    setGameOver(false);
    setTimeLeft(60);
    setRockProgress(0);
    setRockX(50);
    setLevel(1);
  };

  const togglePause = () => {
    setIsPaused(!isPaused);
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Calculate light beam position
  const lightBeamX = lightPosX.interpolate({
    inputRange: [0, 100],
    outputRange: [0, CIRCLE_SIZE],
  });

  const lightBeamY = lightPosY.interpolate({
    inputRange: [0, 100],
    outputRange: [CIRCLE_SIZE * 0.3, CIRCLE_SIZE * 0.7],
  });

  const rockPositionX = rockPosX.interpolate({
    inputRange: [0, 100],
    outputRange: [0, CIRCLE_SIZE],
  });

  return (
    <View style={styles.container} {...rockPanResponder.panHandlers}>
      <StatusBar barStyle="light-content" />

      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.level}>LEVEL {level}</Text>
        <View style={styles.timerSection}>
          <Text style={styles.timer}>TIME: {formatTime(timeLeft)}</Text>
          {gameStarted && (
            <TouchableOpacity style={styles.pauseButton} onPress={togglePause}>
              <Text style={styles.pauseButtonText}>{isPaused ? '▶' : '❚❚'}</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Light Control */}
      <View style={styles.lightControlContainer}>
        <Text style={styles.lightControlLabel}>LIGHT CONTROL</Text>
        <View style={styles.lightControl} {...lightPanResponder.panHandlers}>
          {/* Grid lines */}
          <View style={[styles.gridLineVertical]} />
          <View style={[styles.gridLineHorizontal]} />

          {/* Light knob */}
          <Animated.View
            style={[
              styles.lightKnob,
              {
                left: lightPosX.interpolate({
                  inputRange: [0, 100],
                  outputRange: [0, CONTROL_SIZE],
                }),
                top: lightPosY.interpolate({
                  inputRange: [0, 100],
                  outputRange: [0, CONTROL_SIZE],
                }),
              },
            ]}
          />
        </View>
      </View>

      {/* Game Area */}
      <View style={styles.gameArea}>
        <View style={[styles.rockCircle, { width: CIRCLE_SIZE, height: CIRCLE_SIZE }]}>
          {/* Holes */}
          {holes.map((hole) => {
            const visible = Math.abs(rockProgress - hole.progress) < 20;
            if (!visible) return null;

            const scale = 1 - Math.abs(rockProgress - hole.progress) / 30;
            const opacity = Math.max(0, scale);

            return (
              <View
                key={hole.id}
                style={[
                  styles.hole,
                  {
                    left: `${hole.x}%`,
                    transform: [{ scale }, { translateX: -30 }, { translateY: -30 }],
                    opacity,
                  },
                ]}
              />
            );
          })}

          {/* Rock */}
          <Animated.View
            style={[
              styles.rock,
              {
                left: rockPositionX,
              },
            ]}
          />

          {/* Light beam - multiple circles for gradient effect */}
          <Animated.View
            style={[
              styles.lightBeam,
              {
                left: lightBeamX,
                top: lightBeamY,
              },
            ]}
          >
            <View style={[styles.lightCircle, styles.lightCircle1]} />
            <View style={[styles.lightCircle, styles.lightCircle2]} />
            <View style={[styles.lightCircle, styles.lightCircle3]} />
            <View style={[styles.lightCircle, styles.lightCircle4]} />

            {/* Light indicator */}
            <View style={styles.lightIndicator} />
          </Animated.View>
        </View>
      </View>

      {/* Overlays */}
      {(!gameStarted || gameOver) && (
        <View style={styles.overlay}>
          <View style={styles.overlayContent}>
            {gameOver && (
              <>
                <Text style={styles.gameOverTitle}>GAME OVER</Text>
                <Text style={styles.finalScore}>Level Reached: {level}</Text>
              </>
            )}
            {!gameStarted && !gameOver && (
              <>
                <Text style={styles.gameTitle}>LIGHT CONTROL</Text>
                <Text style={styles.instructions}>
                  上部でライトを操作{'\n'}
                  画面タッチで岩を左右に移動{'\n'}
                  落とし穴を避けよう！
                </Text>
              </>
            )}
            <TouchableOpacity style={styles.startButton} onPress={startGame}>
              <Text style={styles.startButtonText}>
                {gameOver ? 'RESTART' : 'START GAME'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {isPaused && gameStarted && !gameOver && (
        <View style={styles.overlay}>
          <View style={styles.overlayContent}>
            <Text style={styles.pauseTitle}>PAUSED</Text>
            <TouchableOpacity style={styles.startButton} onPress={togglePause}>
              <Text style={styles.startButtonText}>RESUME</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    padding: 20,
    paddingTop: 50,
  },
  level: {
    color: '#FFD700',
    fontSize: 28,
    fontWeight: 'bold',
  },
  timerSection: {
    alignItems: 'flex-end',
  },
  timer: {
    color: '#FFD700',
    fontSize: 24,
    fontWeight: 'bold',
    fontFamily: 'monospace',
  },
  pauseButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.3)',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 4,
    marginTop: 8,
  },
  pauseButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  lightControlContainer: {
    paddingHorizontal: 20,
    marginTop: 10,
    alignItems: 'center',
  },
  lightControlLabel: {
    color: '#888',
    fontSize: 14,
    fontWeight: 'bold',
    marginBottom: 10,
    letterSpacing: 2,
  },
  lightControl: {
    width: CONTROL_SIZE,
    height: CONTROL_SIZE,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 12,
    position: 'relative',
  },
  gridLineVertical: {
    position: 'absolute',
    width: 1,
    height: '100%',
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    left: '50%',
  },
  gridLineHorizontal: {
    position: 'absolute',
    height: 1,
    width: '100%',
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    top: '50%',
  },
  lightKnob: {
    position: 'absolute',
    width: 40,
    height: 40,
    backgroundColor: '#FFD700',
    borderRadius: 20,
    marginLeft: -20,
    marginTop: -20,
    shadowColor: '#FFD700',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 20,
    elevation: 10,
  },
  gameArea: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rockCircle: {
    backgroundColor: '#000',
    borderRadius: 1000,
    position: 'relative',
    overflow: 'hidden',
  },
  hole: {
    position: 'absolute',
    width: 60,
    height: 60,
    backgroundColor: '#0a0a0a',
    borderRadius: 8,
    top: '50%',
    borderWidth: 2,
    borderColor: '#1a1a1a',
  },
  rock: {
    position: 'absolute',
    bottom: '15%',
    width: 50,
    height: 50,
    backgroundColor: '#c92a2a',
    borderRadius: 4,
    marginLeft: -25,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.5,
    shadowRadius: 15,
    elevation: 10,
    zIndex: 10,
  },
  lightBeam: {
    position: 'absolute',
    width: 320,
    height: 320,
    marginLeft: -160,
    marginTop: -160,
    zIndex: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  lightCircle: {
    position: 'absolute',
    borderRadius: 1000,
  },
  lightCircle1: {
    width: 320,
    height: 320,
    backgroundColor: 'rgba(60, 60, 60, 0.2)',
  },
  lightCircle2: {
    width: 240,
    height: 240,
    backgroundColor: 'rgba(50, 50, 50, 0.4)',
  },
  lightCircle3: {
    width: 160,
    height: 160,
    backgroundColor: 'rgba(45, 45, 45, 0.6)',
  },
  lightCircle4: {
    width: 80,
    height: 80,
    backgroundColor: 'rgba(60, 60, 60, 0.9)',
  },
  lightIndicator: {
    width: 18,
    height: 18,
    backgroundColor: '#FFD700',
    borderRadius: 9,
    shadowColor: '#FFD700',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 1,
    shadowRadius: 30,
    elevation: 15,
    zIndex: 25,
  },
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.9)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  overlayContent: {
    alignItems: 'center',
    padding: 40,
  },
  gameTitle: {
    color: '#FFD700',
    fontSize: 48,
    fontWeight: 'bold',
    marginBottom: 20,
  },
  gameOverTitle: {
    color: '#FFD700',
    fontSize: 48,
    fontWeight: 'bold',
    marginBottom: 20,
  },
  pauseTitle: {
    color: '#FFD700',
    fontSize: 48,
    fontWeight: 'bold',
    marginBottom: 20,
  },
  instructions: {
    color: '#fff',
    fontSize: 18,
    lineHeight: 32,
    marginBottom: 30,
    textAlign: 'center',
  },
  finalScore: {
    color: '#fff',
    fontSize: 24,
    marginBottom: 30,
  },
  startButton: {
    backgroundColor: '#FFD700',
    paddingVertical: 16,
    paddingHorizontal: 48,
    borderRadius: 8,
    shadowColor: '#FFD700',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 20,
    elevation: 10,
  },
  startButtonText: {
    color: '#000',
    fontSize: 24,
    fontWeight: 'bold',
  },
});