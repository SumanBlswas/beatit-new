import React, { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';
import Svg, { Defs, G, Path } from 'react-native-svg';

const BASE_SIZE = 120;
const AnimatedPath = Animated.createAnimatedComponent(Path);

export default function SLiquidLoading({ size = 120, color = '#FF1B2D', background = '#fff' }) {
  const anim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.loop(
      Animated.timing(anim, {
        toValue: 1,
        duration: 500,
        easing: Easing.linear,
        useNativeDriver: false,
      })
    ).start();
  }, [anim]);

  // S path (hand-tuned for a nice S shape, fits 120x120 viewBox)
  const sPath =
    'M 30 30 Q 30 10 60 10 Q 90 10 90 30 Q 90 50 60 50 Q 30 50 30 70 Q 30 90 60 90 Q 90 90 90 70';

  // Length of the S path (approximate, for dash animation)
  const PATH_LENGTH = 320; // hand-tuned for this S

  // Animate the dash offset to create the 'writing' effect
  const strokeDashoffset = anim.interpolate({
    inputRange: [0, 1],
    outputRange: [PATH_LENGTH, 0],
  });

  return (
    <View style={[styles.container, { width: size, height: size, backgroundColor: background, borderRadius: size / 2 }]}> 
      <Svg width={size} height={size} viewBox={`0 0 120 120`}>
        <Defs />
        <G transform={`scale(1,-1) translate(0,-120)`}>
          <AnimatedPath
            d={sPath}
            fill="none"
            stroke={color}
            strokeWidth={BASE_SIZE * 0.08}
            strokeLinejoin="round"
            strokeLinecap="round"
            strokeDasharray={PATH_LENGTH}
            strokeDashoffset={strokeDashoffset}
          />
        </G>
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
}); 