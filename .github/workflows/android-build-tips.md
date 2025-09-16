# Android Build Optimization Tips

## Quick Build Time Improvements

### 1. Use Debug Builds for Development
```bash
# Instead of building release APK during development
./gradlew assembleDebug
# This skips minification, obfuscation, and other release optimizations
```

### 2. Incremental Builds
```bash
# Use incremental sync instead of full rebuild
npx cap sync android --no-build
# Then build only when needed
cd android && ./gradlew assembleDebug
```

### 3. Android Studio Settings
- **File → Settings → Build → Compiler**
  - Check "Build project automatically"
  - Set "User-local build cache" to enabled
  
- **File → Settings → Build → Gradle**
  - Check "Offline work" (if no new dependencies)
  - Set Gradle JVM to use Java 11+
  - Set max heap size to 4GB or more

### 4. System Optimizations
- Close unnecessary apps/browsers while building
- Use SSD storage for faster I/O
- Ensure adequate RAM (8GB+ recommended)
- Disable antivirus real-time scanning for project folder

### 5. Capacitor Development Mode
```bash
# Enable live reload for faster development cycles
npx cap run android --livereload --external
# This allows hot reloading without rebuilding APK
```

### Expected Build Times
- **First build**: 5-10 minutes (downloads dependencies)
- **Incremental builds**: 30 seconds - 2 minutes
- **Clean builds**: 2-5 minutes
- **Release builds**: 3-8 minutes (includes optimization)

### Pro Tips
- Use `--offline` flag when no new dependencies needed
- Build debug APKs during development, release only for distribution
- Use Android Studio's "Instant Run" feature
- Consider using Gradle Build Cache across projects