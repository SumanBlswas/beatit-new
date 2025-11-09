import React, { useEffect, useRef } from "react";
import { Animated, Dimensions, Easing, StyleSheet, View } from "react-native";
import Svg, { Circle, Defs, G, Line, LinearGradient, Path, Polygon, RadialGradient, Rect, Stop } from "react-native-svg";

const { width: screenWidth, height: screenHeight } = Dimensions.get("window");

export default function AnimatedSplash() {
  // Animated values for all six floating particles
  const particles = [
    { cx: 200, cyStart: 400, cyMid: 300, r: 8, duration: 5000, delay: 0 },
    { cx: 880, cyStart: 600, cyMid: 700, r: 6, duration: 3000, delay: 400 },
    { cx: 150, cyStart: 1200, cyMid: 1100, r: 10, duration: 6000, delay: 800 },
    { cx: 900, cyStart: 1400, cyMid: 1500, r: 7, duration: 4000, delay: 1200 },
    { cx: 100, cyStart: 800, cyMid: 750, r: 5, duration: 3500, delay: 1600 },
    { cx: 950, cyStart: 1000, cyMid: 1050, r: 9, duration: 4500, delay: 2000 },
  ];

  // Create animated values for each particle (hooks must be called at the top level)
  const animatedParticles = [
    { y: useRef(new Animated.Value(0)).current, opacity: useRef(new Animated.Value(0.7)).current },
    { y: useRef(new Animated.Value(0)).current, opacity: useRef(new Animated.Value(0.7)).current },
    { y: useRef(new Animated.Value(0)).current, opacity: useRef(new Animated.Value(0.7)).current },
    { y: useRef(new Animated.Value(0)).current, opacity: useRef(new Animated.Value(0.7)).current },
    { y: useRef(new Animated.Value(0)).current, opacity: useRef(new Animated.Value(0.7)).current },
    { y: useRef(new Animated.Value(0)).current, opacity: useRef(new Animated.Value(0.7)).current },
  ];

  // Animated values for the three scan lines
  const scanLines = [
    { y: 300, duration: 200, delay: 0 },
    { y: 800, duration: 250, delay: 1000 },
    { y: 1400, duration: 150, delay: 2000 },
  ];
  const scanLineOpacities = [
    useRef(new Animated.Value(0)).current,
    useRef(new Animated.Value(0)).current,
    useRef(new Animated.Value(0)).current,
  ];

  // Calculate vertical center for the S shape
  // The original SVG is 1920px tall, and the S is centered at y=800 (so 800/1920 from the top)
  // We'll center it at screenHeight * (800/1920), but better: center it at screenHeight/2
  const sCenterY = (screenHeight / 2);
  const sCenterX = (screenWidth / 2);

  useEffect(() => {
    particles.forEach((p, i) => {
      const animate = () => {
        animatedParticles[i].y.setValue(0);
        animatedParticles[i].opacity.setValue(0.7);
        Animated.parallel([
          Animated.sequence([
            Animated.timing(animatedParticles[i].y, {
              toValue: 1,
              duration: p.duration / 2,
              delay: p.delay,
              useNativeDriver: false,
              easing: Easing.inOut(Easing.sin),
            }),
            Animated.timing(animatedParticles[i].y, {
              toValue: 0,
              duration: p.duration / 2,
              useNativeDriver: false,
              easing: Easing.inOut(Easing.sin),
            }),
          ]),
          Animated.sequence([
            Animated.timing(animatedParticles[i].opacity, {
              toValue: 1,
              duration: p.duration / 2,
              delay: p.delay,
              useNativeDriver: false,
            }),
            Animated.timing(animatedParticles[i].opacity, {
              toValue: 0.7,
              duration: p.duration / 2,
              useNativeDriver: false,
            }),
          ]),
        ]).start(() => animate());
      };
      animate();
    });
    // Animate scan lines
    scanLines.forEach((line, i) => {
      const animateLine = () => {
        scanLineOpacities[i].setValue(0);
        Animated.sequence([
          Animated.timing(scanLineOpacities[i], {
            toValue: 0.6,
            duration: line.duration,
            delay: line.delay,
            useNativeDriver: false,
          }),
          Animated.timing(scanLineOpacities[i], {
            toValue: 0,
            duration: line.duration,
            useNativeDriver: false,
          }),
        ]).start(() => animateLine());
      };
      animateLine();
    });
  }, []);

  return (
    <View style={styles.container}>
      <Svg
        width={screenWidth}
        height={screenHeight}
        viewBox="0 0 1080 1920"
        style={StyleSheet.absoluteFill}
        preserveAspectRatio="xMidYMid slice"
      >
        <Defs>
          <LinearGradient id="holographic" x1="0%" y1="0%" x2="100%" y2="100%">
            <Stop offset="0%" stopColor="#00ff87" />
            <Stop offset="25%" stopColor="#60efff" />
            <Stop offset="50%" stopColor="#ff0080" />
            <Stop offset="75%" stopColor="#ffaa00" />
            <Stop offset="100%" stopColor="#8000ff" />
          </LinearGradient>
          <RadialGradient id="bgGradient" cx="50%" cy="50%" r="70%">
            <Stop offset="0%" stopColor="#1a0033" />
            <Stop offset="50%" stopColor="#000000" />
            <Stop offset="100%" stopColor="#000000" />
          </RadialGradient>
        </Defs>
        {/* Full screen dark background */}
        <Rect width="1080" height="1920" fill="url(#bgGradient)" />
        {/* Massive liquid S shape - centered and scaled up */}
        <G transform="translate(540, 960)">
          <Path
            d="M 0 -400 Q -200 -450 -320 -350 Q -440 -250 -400 -100 Q -360 50 -150 100 Q 60 150 150 50 Q 240 -50 200 -200 Q 160 -350 0 -400 M 0 400 Q 200 450 320 350 Q 440 250 400 100 Q 360 -50 150 -100 Q -60 -150 -150 -50 Q -240 50 -200 200 Q -160 350 0 400 M -150 100 Q 0 50 150 100 Q 300 150 350 250 Q 300 350 150 300 Q 0 250 -150 300 Q -300 250 -350 150 Q -300 50 -150 100 M 150 -100 Q 0 -50 -150 -100 Q -300 -150 -350 -250 Q -300 -350 -150 -300 Q 0 -250 150 -300 Q 300 -250 350 -150 Q 300 -50 150 -100"
            fill="url(#holographic)"
            opacity="0.95"
          />
          {/* Crystalline structure overlay */}
          <G stroke="url(#holographic)" strokeWidth={8} opacity={0.8}>
            <Polygon points="0,-400 -200,-300 -320,-100 -150,0 60,0 150,-100 200,-300" fill="none" />
            <Polygon points="0,400 200,300 320,100 150,0 -60,0 -150,100 -200,300" fill="none" />
            <Line x1="-150" y1="0" x2="150" y2="0" />
            <Line x1="0" y1="-200" x2="0" y2="200" />
            <Line x1="-320" y1="-100" x2="320" y2="100" />
            <Line x1="-320" y1="100" x2="320" y2="-100" />
          </G>
          {/* Pulsing core (static) */}
          <Circle cx="0" cy="0" r="30" fill="#00ffff" opacity="0.9" />
        </G>
        {/* Animated floating energy particles */}
        <G fill="#00ffff" opacity="0.7">
          {particles.map((p, i) => {
            const cy = animatedParticles[i].y.interpolate({
              inputRange: [0, 1],
              outputRange: [p.cyStart, p.cyMid],
            });
            return (
              <AnimatedCircle
                key={i}
                cx={p.cx}
                cy={cy}
                r={p.r}
                opacity={animatedParticles[i].opacity}
              />
            );
          })}
        </G>
        {/* Animated cyberpunk scan lines */}
        <G>
          {scanLines.map((line, i) => (
            <AnimatedLine
              key={i}
              x1={0}
              y1={line.y}
              x2={1080}
              y2={line.y}
              stroke="#ff0080"
              strokeWidth={2}
              opacity={scanLineOpacities[i]}
            />
          ))}
        </G>
        {/* Full screen holographic overlay */}
        <Rect width="1080" height="1920" fill="url(#holographic)" opacity={0.12} />
      </Svg>
    </View>
  );
}

// Animated SVG primitives
const AnimatedCircle = Animated.createAnimatedComponent(Circle);
const AnimatedLine = Animated.createAnimatedComponent(Line);

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "#000",
    alignItems: "stretch",
    justifyContent: "flex-start",
  },
}); 