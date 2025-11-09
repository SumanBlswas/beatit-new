# Animated Splash Screen

This project includes a stunning animated splash screen with holographic effects, shooting stars, and cyberpunk aesthetics.

## Features

- **Holographic Gradients**: Multi-color gradients that create a futuristic look
- **Animated Shooting Stars**: Dynamic star trails that move across the screen
- **Liquid S-Shape Logo**: Animated geometric shapes with glow effects
- **Floating Energy Particles**: Subtle animated particles for atmosphere
- **Cyberpunk Scan Lines**: Animated horizontal lines for retro-futuristic feel
- **Pulsing Core**: Central animated element with breathing effect

## Implementation

### 1. Static Splash Screen (app.json)
The static splash screen is configured in `app.json` and uses the SVG file at `assets/images/splash-icon.svg`:

```json
{
  "expo": {
    "plugins": [
      [
        "expo-splash-screen",
        {
          "image": "./assets/images/splash-icon.svg",
          "imageWidth": 1080,
          "imageHeight": 1920,
          "resizeMode": "contain",
          "backgroundColor": "#000000"
        }
      ]
    ]
  }
}
```

### 2. Animated Splash Screen Component
The animated splash screen is implemented in `components/SVGSplashScreen.tsx` and provides:

- **React Native SVG**: Native SVG rendering for better performance
- **Animated Effects**: Smooth transitions and animations
- **Custom Timing**: Configurable animation duration and timing
- **Splash Screen Integration**: Proper integration with expo-splash-screen

## Usage

The animated splash screen is automatically used in the app layout (`app/_layout.tsx`):

```typescript
import SVGSplashScreen from "@/components/SVGSplashScreen";

export default function RootLayout() {
  const [isSplashComplete, setIsSplashComplete] = useState(false);

  if (!isSplashComplete) {
    return (
      <SVGSplashScreen onAnimationComplete={() => setIsSplashComplete(true)} />
    );
  }

  // ... rest of your app
}
```

## Customization

### Animation Duration
You can modify the animation duration by changing the timeout in `SVGSplashScreen.tsx`:

```typescript
// Change from 3000ms to your preferred duration
const timer = setTimeout(() => {
  // ... fade out animation
}, 3000); // <-- Change this value
```

### Colors and Effects
The splash screen uses several color schemes that can be customized:

- **Holographic Gradient**: `#00ff87`, `#60efff`, `#ff0080`, `#ffaa00`, `#8000ff`
- **Background**: `#000000` (pure black)
- **Accent Colors**: `#00ffff` (cyan), `#ff0080` (magenta)

### Alternative Implementation
There's also a WebView-based implementation in `components/AnimatedSplashScreen.tsx` that provides full SVG animation support but may be less performant.

## Dependencies

The animated splash screen requires these dependencies (already included):

- `expo-splash-screen`: For splash screen management
- `react-native-svg`: For SVG rendering
- `react-native-reanimated`: For smooth animations

## Performance Notes

- The React Native SVG implementation (`SVGSplashScreen.tsx`) is more performant than the WebView version
- Animations use the native driver for better performance
- The splash screen automatically hides after animation completion
- Font loading and other initialization happens during the splash screen display

## Troubleshooting

### Splash Screen Not Showing
1. Ensure `expo-splash-screen` is properly configured in `app.json`
2. Check that the SVG file exists at `assets/images/splash-icon.svg`
3. Verify that `SplashScreen.preventAutoHideAsync()` is called

### Animation Issues
1. Make sure `react-native-reanimated` is properly installed
2. Check that animations are using `useNativeDriver: true`
3. Verify that the component is properly mounted in the app layout

### Performance Issues
1. Use the React Native SVG version instead of WebView
2. Reduce animation complexity if needed
3. Consider reducing animation duration for faster app startup

## Design Credits

The splash screen design features:
- Cyberpunk aesthetic with holographic effects
- Geometric patterns and crystalline structures
- Dynamic lighting and glow effects
- Futuristic color palette
- Smooth, fluid animations

This creates an immersive and visually striking introduction to your app! 