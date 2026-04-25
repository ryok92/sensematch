import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  StyleSheet,
  Text,
  View,
  Dimensions,
  TouchableOpacity,
  StatusBar,
  PanResponder,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

// 🌟 React Native用のThree.jsラッパー
import { Canvas, useFrame } from '@react-three/fiber/native';

// 🌟 ご指定のローカル画像（荒野の地面テクスチャ）を読み込み
const GROUND_IMAGE = require('../assets/gameimage.png');

// --- 🌟 3D Rock Component 🌟 ---
const Rock3D = ({ rockX, rockY }: { rockX: number, rockY: number }) => {
  const meshRef = useRef<any>(null);

  // 毎フレーム岩の回転を計算
  useFrame(() => {
    if (meshRef.current) {
      meshRef.current.rotation.x = -rockY * 0.05; 
      meshRef.current.rotation.z = -(rockX - 50) * 0.03; 
      meshRef.current.rotation.y = (rockX - 50) * 0.02; 
    }
  });

  return (
    <mesh ref={meshRef} scale={[1.4, 1.4, 1.4]}>
      {/* ゴツゴツした隕石のような形状 */}
      <dodecahedronGeometry args={[1, 1]} />
      <meshStandardMaterial color="#8a8a8a" roughness={0.9} metalness={0.2} flatShading={true} />
    </mesh>
  );
};

// --- Types & Constants ---
const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

const GAME_SPEED = 3.5;       
const ROCK_INERTIA = 0.12;    
const LIGHT_RADIUS = 200;     
const VIEWPORT_HEIGHT_UNITS = 1000; 
const PAD_SIZE = 120;         

const VISUAL_LAG_OFFSET = 50; 

const HITBOX_RADIUS_X = 2; 
const HITBOX_RADIUS_Y = 2; 

const wp = (percentage: number) => (percentage / 100) * SCREEN_WIDTH;
const pxToPercent = (px: number) => (px / SCREEN_WIDTH) * 100;

type Hole = { x: number; y: number; w: number; h: number };

const LEVELS = [
  {
    id: 1, length: 2500, timeLimit: 40,
    randomCount: 3,
    holes: [
      { x: 40, y: 300, w: 20, h: 40 },
      { x: 20, y: 500, w: 20, h: 50 },
      { x: 60, y: 800, w: 25, h: 50 },
      { x: 30, y: 1200, w: 20, h: 60 },
      { x: 80, y: 1500, w: 15, h: 50 },
      { x: 40, y: 1800, w: 30, h: 80 },
      { x: 10, y: 2200, w: 20, h: 50 },
    ]
  },
  {
    id: 2, length: 3500, timeLimit: 50,
    randomCount: 5,
    holes: [
      { x: 35, y: 250, w: 30, h: 40 },
      { x: 10, y: 400, w: 30, h: 50 },
      { x: 60, y: 700, w: 30, h: 50 },
      { x: 70, y: 1000, w: 20, h: 200 },
      { x: 20, y: 1400, w: 40, h: 60 },
      { x: 50, y: 1700, w: 30, h: 50 },
      { x: 0, y: 2100, w: 50, h: 60 },
      { x: 60, y: 2500, w: 30, h: 80 },
      { x: 20, y: 2900, w: 20, h: 50 },
    ]
  },
  {
    id: 3, length: 5000, timeLimit: 70,
    randomCount: 8,
    holes: [
      { x: 30, y: 300, w: 40, h: 50 },
      { x: 20, y: 500, w: 60, h: 40 },
      { x: 10, y: 900, w: 15, h: 600 },
      { x: 75, y: 900, w: 15, h: 600 },
      { x: 40, y: 1200, w: 20, h: 30 },
      { x: 30, y: 1800, w: 40, h: 100 },
      { x: 0, y: 2300, w: 35, h: 60 },
      { x: 65, y: 2300, w: 35, h: 60 },
      { x: 45, y: 2800, w: 10, h: 400 },
      { x: 10, y: 3600, w: 80, h: 30 },
      { x: 20, y: 4200, w: 25, h: 50 },
      { x: 60, y: 4400, w: 25, h: 50 },
    ]
  }
];

export default function App() {
  const [gameState, setGameState] = useState<'START' | 'PLAYING' | 'PAUSED' | 'GAME_OVER' | 'VICTORY' | 'LEVEL_COMPLETE'>('START');
  const [levelIndex, setLevelIndex] = useState(0);
  const [timeLeft, setTimeLeft] = useState(0);

  const [rockPos, setRockPos] = useState({ x: 50, y: 0 });
  const [lightPos, setLightPos] = useState({ x: 50, y: 50 });

  const [currentHoles, setCurrentHoles] = useState<Hole[]>([]);

  const targetRockX = useRef(50);
  const currentWorldY = useRef(0);
  const currentWorldX = useRef(50);
  
  const rockDragStart = useRef({ touchX: 0, targetX: 50 });
  const requestRef = useRef<number | null>(null);
  const lastTimeRef = useRef<number | null>(null);
  const touchStartPos = useRef({ x: 0, y: 0 });

  const updateLightPosFromTouch = (locX: number, locY: number) => {
    const xPercent = (locX / PAD_SIZE) * 100;
    const yPercent = 100 - ((locY / PAD_SIZE) * 100);
    setLightPos({
      x: Math.max(0, Math.min(100, xPercent)),
      y: Math.max(0, Math.min(100, yPercent)),
    });
  };

  const panResponderLight = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (evt) => {
        const { locationX, locationY } = evt.nativeEvent;
        touchStartPos.current = { x: locationX, y: locationY };
        updateLightPosFromTouch(locationX, locationY);
      },
      onPanResponderMove: (evt, gestureState) => {
        const currentX = touchStartPos.current.x + gestureState.dx;
        const currentY = touchStartPos.current.y + gestureState.dy;
        updateLightPosFromTouch(currentX, currentY);
      },
    })
  ).current;

  const panResponderRock = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (evt, gestureState) => {
        rockDragStart.current = {
          touchX: gestureState.x0,
          targetX: targetRockX.current,
        };
      },
      onPanResponderMove: (evt, gestureState) => {
        const movePercent = pxToPercent(gestureState.dx);
        targetRockX.current = Math.max(5, Math.min(95, rockDragStart.current.targetX + movePercent));
      },
    })
  ).current;

  const checkCollision = (rockX: number, rockY: number, holes: Hole[]) => {
    const rL = rockX - HITBOX_RADIUS_X;
    const rR = rockX + HITBOX_RADIUS_X;
    const rB = rockY - HITBOX_RADIUS_Y;
    const rT = rockY + HITBOX_RADIUS_Y;

    for (const hole of holes) {
      const hL = hole.x;
      const hR = hole.x + hole.w;
      const hB = hole.y;
      const hT = hole.y + hole.h;

      if (rL < hR && rR > hL && rB < hT && rT > hB) {
        return true;
      }
    }
    return false;
  };

  const update = useCallback(() => {
    if (gameState !== 'PLAYING') return;

    const now = Date.now();
    const dt = Math.min(0.05, (now - (lastTimeRef.current ?? now)) / 1000);
    lastTimeRef.current = now;

    const currentLevel = LEVELS[levelIndex];

    currentWorldY.current += (GAME_SPEED * 60 * dt);
    const diffX = targetRockX.current - currentWorldX.current;
    currentWorldX.current += (diffX * ROCK_INERTIA);

    const visualSyncedY = currentWorldY.current - VISUAL_LAG_OFFSET;
    const isHit = checkCollision(currentWorldX.current, visualSyncedY, currentHoles);

    if (isHit) {
      setGameState('GAME_OVER');
      if (requestRef.current) cancelAnimationFrame(requestRef.current);
      return;
    }

    if (visualSyncedY >= currentLevel.length) {
      setGameState(levelIndex === LEVELS.length - 1 ? 'VICTORY' : 'LEVEL_COMPLETE');
      return;
    }

    setRockPos({ x: currentWorldX.current, y: currentWorldY.current });
    setTimeLeft(prev => Math.max(0, prev - dt));

    requestRef.current = requestAnimationFrame(update);
  }, [gameState, levelIndex, currentHoles]);

  const generateLevelHoles = (levelIdx: number) => {
    const levelData = LEVELS[levelIdx];
    const baseHoles = levelData.holes.map(h => ({
      ...h,
      x: Math.max(0, Math.min(100 - h.w, h.x + (Math.random() * 10 - 5))),
      w: Math.max(10, h.w + (Math.random() * 6 - 3)),
    }));

    const randomHoles: Hole[] = [];
    const safeZoneStart = 400; 
    const safeZoneEnd = levelData.length - 200; 

    for (let i = 0; i < levelData.randomCount; i++) {
      const rY = safeZoneStart + Math.random() * (safeZoneEnd - safeZoneStart);
      const rW = 15 + Math.random() * 20; 
      const rX = Math.random() * (100 - rW); 
      const rH = 40 + Math.random() * 60; 
      randomHoles.push({ x: rX, y: rY, w: rW, h: rH });
    }

    return [...baseHoles, ...randomHoles];
  };

  const startGame = (idx: number) => {
    setLevelIndex(idx);
    const newHoles = generateLevelHoles(idx);
    setCurrentHoles(newHoles);

    currentWorldY.current = 0;
    currentWorldX.current = 50;
    targetRockX.current = 50;
    setRockPos({ x: 50, y: 0 });
    setLightPos({ x: 50, y: 30 });
    setTimeLeft(LEVELS[idx].timeLimit);
    setGameState('PLAYING');
  };

  useEffect(() => {
    if (gameState === 'PLAYING') {
      lastTimeRef.current = Date.now();
      requestRef.current = requestAnimationFrame(update);
    }
    return () => {
      if (requestRef.current) cancelAnimationFrame(requestRef.current);
    };
  }, [gameState, update]);

  // --- 描画計算 ---
  const ROCK_SCREEN_Y_PERCENT = 25; 
  const viewBottomWorldY = rockPos.y - (VIEWPORT_HEIGHT_UNITS * (ROCK_SCREEN_Y_PERCENT / 100));
  const getScreenBottomPx = (worldY: number) => ((worldY - viewBottomWorldY) / VIEWPORT_HEIGHT_UNITS) * SCREEN_HEIGHT;
  const currentLevel = LEVELS[levelIndex];

  // 🌟 地面のスクロール量の計算（画面の高さ分進んだらループさせる）
  const GROUND_SCROLL_SPEED = (SCREEN_HEIGHT / VIEWPORT_HEIGHT_UNITS);
  const groundOffsetY = (rockPos.y * GROUND_SCROLL_SPEED) % SCREEN_HEIGHT;

  const renderOverlay = () => {
    if (!['START', 'GAME_OVER', 'VICTORY', 'LEVEL_COMPLETE'].includes(gameState)) return null;

    let title = '';
    let mainBtnText = '';
    let subBtnText = ''; 
    let noteText = '';
    let onMainPress = () => {};
    let onSubPress = () => {};

    if (gameState === 'START') {
      title = 'ABYSS ROAD';
      mainBtnText = 'START';
      onMainPress = () => startGame(0);
    } else if (gameState === 'GAME_OVER') {
      title = 'GAME OVER';
      mainBtnText = 'RETRY';
      onMainPress = () => startGame(0); 
    } else if (gameState === 'LEVEL_COMPLETE') {
      title = `LEVEL ${levelIndex + 1} クリア！`;
      mainBtnText = 'Next Level';
      subBtnText = 'メッセージへ戻る';
      noteText = '※2人共タップすると移動します。\nお相手にはどちらをタップしたか表示されます';
      onMainPress = () => startGame(levelIndex + 1);
      onSubPress = () => console.log('Back to message');
    } else if (gameState === 'VICTORY') {
      title = '全ステージクリア！';
      mainBtnText = 'メッセージへ戻る';
      noteText = '※2人共タップすると移動します。\nお相手にはどちらをタップしたか表示されます';
      onMainPress = () => console.log('Back to message');
    }

    return (
      <View style={[styles.fullScreenOverlay, gameState === 'GAME_OVER' && {backgroundColor: 'rgba(60,0,0,0.95)'}]}>
        <Text style={styles.titleText}>{title}</Text>
        <TouchableOpacity style={styles.mainButton} onPress={onMainPress}>
          <Text style={styles.mainButtonText}>{mainBtnText}</Text>
        </TouchableOpacity>
        {subBtnText ? (
          <TouchableOpacity style={[styles.subButton, { marginTop: 15 }]} onPress={onSubPress}>
            <Text style={styles.subButtonText}>{subBtnText}</Text>
          </TouchableOpacity>
        ) : null}
        {noteText ? (
          <Text style={styles.noteText}>{noteText}</Text>
        ) : null}
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" />

      {/* HEADER */}
      <View style={styles.header}>
        <View style={styles.headerInfo}>
          <Text style={styles.headerText}>LEVEL {levelIndex + 1}</Text>
          <Text style={styles.headerText}>TIME: {Math.ceil(timeLeft)}</Text>
        </View>

        {(gameState === 'PLAYING' || gameState === 'PAUSED') && (
          <TouchableOpacity onPress={() => setGameState(gameState === 'PLAYING' ? 'PAUSED' : 'PLAYING')} style={styles.pauseButton}>
             <Text style={styles.pauseButtonText}>{gameState === 'PAUSED' ? '▶' : '||'}</Text>
          </TouchableOpacity>
        )}

        {(gameState === 'PLAYING' || gameState === 'PAUSED') && (
          <View style={styles.controlsContainer}>
            <Text style={styles.controlLabel}>LIGHT CONTROL</Text>
            <View style={styles.controlPad} {...panResponderLight.panHandlers}>
              <View style={styles.padGridH} pointerEvents="none" />
              <View style={styles.padGridV} pointerEvents="none" />
              <View style={[styles.controlThumb, { left: `${lightPos.x}%`, top: `${100 - lightPos.y}%` }]} pointerEvents="none" />
            </View>
          </View>
        )}
      </View>

      {/* GAME VIEWPORT */}
      <View style={styles.gameViewport} {...panResponderRock.panHandlers}>
        
        {/* 🌟 ローカル画像を使用したリアルな地面のスクロール背景 🌟 */}
        <View style={[StyleSheet.absoluteFill, { transform: [{ translateY: groundOffsetY }] }]}>
          {/* 現在表示されている地面タイル */}
          <Image 
            source={GROUND_IMAGE} 
            style={{ width: '100%', height: SCREEN_HEIGHT, position: 'absolute', bottom: 0 }} 
            resizeMode="cover"
          />
          {/* 奥から流れてくるループ用の地面タイル */}
          <Image 
            source={GROUND_IMAGE} 
            style={{ width: '100%', height: SCREEN_HEIGHT, position: 'absolute', bottom: SCREEN_HEIGHT }} 
            resizeMode="cover"
          />
        </View>

        {/* 地面全体を少し暗くして雰囲気を作るフィルター */}
        <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0,0,0,0.5)' }]} pointerEvents="none" />

        {currentHoles.map((hole, idx) => (
          <View
            key={idx}
            style={[
              styles.hole,
              {
                left: `${hole.x}%`,
                width: `${hole.w}%`,
                height: (hole.h / VIEWPORT_HEIGHT_UNITS) * SCREEN_HEIGHT,
                bottom: getScreenBottomPx(hole.y),
              }
            ]}
          >
            {/* 穴の深さを表現する擬似インナーシャドウ */}
            <View style={styles.holeInnerShadowTop} />
            <View style={styles.holeInnerShadowBottom} />
          </View>
        ))}

        <View style={[styles.goalLine, { bottom: getScreenBottomPx(currentLevel.length) }]}>
          <Text style={styles.goalText}>GOAL LINE</Text>
        </View>

        {/* 🌟 THE ROCK (3D Native Canvas) 🌟 */}
        <View style={[
          styles.rockContainer, 
          { 
            left: `${rockPos.x}%`, 
            bottom: `${ROCK_SCREEN_Y_PERCENT}%`,
            marginLeft: -40, 
            marginBottom: -40, 
          }
        ]}>
          <Canvas>
            <ambientLight intensity={0.6} />
            <directionalLight position={[5, 8, 5]} intensity={1.5} />
            <Rock3D rockX={rockPos.x} rockY={rockPos.y} />
          </Canvas>
        </View>

        {/* LIGHT MASK */}
        <View style={[styles.spotlightOverlay, { left: wp(lightPos.x) - 1500, bottom: (lightPos.y / 100 * SCREEN_HEIGHT) - 1500 }]} pointerEvents="none" />
        <View style={[styles.lightMarker, { left: wp(lightPos.x), bottom: (lightPos.y / 100 * SCREEN_HEIGHT) }]} pointerEvents="none" />

        {gameState === 'PAUSED' && (
          <View style={styles.centerOverlay}>
            <View style={styles.pauseBox}><Text style={styles.pauseText}>PAUSED</Text></View>
          </View>
        )}
      </View>

      {renderOverlay()}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  header: { height: 190, backgroundColor: '#111', padding: 10, zIndex: 10, borderBottomWidth: 1, borderBottomColor: '#333' },
  headerInfo: { flexDirection: 'row', justifyContent: 'space-between' },
  headerText: { color: '#FFD700', fontWeight: 'bold', fontSize: 16 },
  pauseButton: { position: 'absolute', right: 15, top: 10, backgroundColor: '#333', borderRadius: 15, width: 30, height: 30, alignItems: 'center', justifyContent: 'center' },
  pauseButtonText: { color: '#FFF', fontSize: 12 },
  controlsContainer: { alignItems: 'center', marginTop: 5 },
  controlLabel: { color: '#AAA', fontSize: 10, marginBottom: 4 },
  controlPad: { width: PAD_SIZE, height: PAD_SIZE, backgroundColor: '#222', borderRadius: 8, borderWidth: 1, borderColor: '#555', overflow: 'hidden' },
  controlThumb: { position: 'absolute', width: 20, height: 20, backgroundColor: '#FFD700', borderRadius: 10, marginLeft: -10, marginTop: -10 },
  padGridH: { position: 'absolute', top: '50%', left: 0, right: 0, height: 1, backgroundColor: 'rgba(255,255,255,0.1)' },
  padGridV: { position: 'absolute', left: '50%', top: 0, bottom: 0, width: 1, backgroundColor: 'rgba(255,255,255,0.1)' },
  gameViewport: { flex: 1, backgroundColor: '#000', position: 'relative', overflow: 'hidden' },
  
  hole: { 
    position: 'absolute', 
    backgroundColor: '#050505', 
    borderRadius: 12, 
    borderWidth: 2,
    borderColor: '#3a2a20', 
    overflow: 'hidden',
  },
  holeInnerShadowTop: {
    position: 'absolute', top: 0, left: 0, right: 0, height: 15, backgroundColor: 'rgba(0,0,0,0.9)'
  },
  holeInnerShadowBottom: {
    position: 'absolute', bottom: 0, left: 0, right: 0, height: 10, backgroundColor: 'rgba(255,255,255,0.05)'
  },

  goalLine: { position: 'absolute', left: 0, right: 0, height: 50, backgroundColor: 'rgba(0, 255, 0, 0.2)', alignItems: 'center', justifyContent: 'center', borderTopWidth: 2, borderTopColor: '#0F0', borderBottomWidth: 1, borderBottomColor: 'rgba(0,255,0,0.3)' },
  goalText: { color: '#0F0', fontWeight: 'bold', letterSpacing: 5 },
  
  rockContainer: {
    position: 'absolute',
    width: 80,
    height: 80,
    zIndex: 10,
    backgroundColor: 'transparent',
  },

  spotlightOverlay: { position: 'absolute', width: 3000, height: 3000, borderRadius: 1500, borderWidth: 1500 - LIGHT_RADIUS, borderColor: 'rgba(0,0,0,0.95)' },
  lightMarker: { position: 'absolute', width: 8, height: 8, borderRadius: 4, backgroundColor: '#FFD700', transform: [{translateX: -4}, {translateY: 4}] },
  centerOverlay: { ...StyleSheet.absoluteFill, justifyContent: 'center', alignItems: 'center', zIndex: 20 },
  pauseBox: { padding: 20, backgroundColor: 'rgba(0,0,0,0.8)', borderRadius: 10, borderWidth: 1, borderColor: '#FFF' },
  pauseText: { color: '#FFF', fontSize: 24, fontWeight: 'bold' },
  fullScreenOverlay: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(0,0,0,0.9)', justifyContent: 'center', alignItems: 'center', zIndex: 100, padding: 20 },
  titleText: { color: '#FFD700', fontSize: 32, fontWeight: 'bold', textAlign: 'center', marginBottom: 30 },
  mainButton: { backgroundColor: '#FFD700', paddingHorizontal: 40, paddingVertical: 15, borderRadius: 30 },
  mainButtonText: { color: '#000', fontWeight: 'bold', fontSize: 18 },
  subButton: { backgroundColor: '#333', paddingHorizontal: 30, paddingVertical: 12, borderRadius: 30, borderWidth: 1, borderColor: '#555' },
  subButtonText: { color: '#AAA', fontWeight: 'bold', fontSize: 14 },
  noteText: { color: 'rgba(255,255,255,0.6)', fontSize: 12, textAlign: 'center', marginTop: 30, lineHeight: 18 },
});