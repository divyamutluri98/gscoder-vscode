# GSCODER VS Code - Production Build Guide

## System Dependencies

### Required Tools
- **Node.js**: >= 20.0.0 (LTS recommended)
- **Python**: 3.8+ (for native module compilation)
- **Yarn**: 1.22+ (package manager)
- **Git**: 2.30+ (for cloning VS Code repository)

### Platform-Specific Dependencies

#### Windows
```powershell
# Install Visual Studio Build Tools
# Required for native C++ module compilation
winget install Microsoft.VisualStudio.2022.BuildTools

# Or install via Visual Studio Installer:
# - C++ build tools
# - Windows 10/11 SDK
```

#### macOS
```bash
# Install Xcode Command Line Tools
xcode-select --install

# Install Homebrew dependencies
brew install python@3.8 yarn git
```

#### Linux (Ubuntu/Debian)
```bash
sudo apt update
sudo apt install -y \
    build-essential \
    python3 \
    python3-pip \
    nodejs \
    yarn \
    git \
    libx11-dev \
    libxkbfile-dev \
    libsecret-1-dev \
    libkrb5-dev
```

## Build Process

### Phase 1: Clone and Rebrand

```bash
# Clone VS Code repository
git clone https://github.com/microsoft/vscode.git gscoder-vscode
cd gscoder-vscode

# Copy rebrand toolkit
cp -r /path/to/gscoder-vscode-rebrand/* .

# Install dependencies
npm install

# Run rebrand automation
npm run rebrand

# Generate icons from master logo
npm run generate-icons
```

### Phase 2-6: Feature Implementation

The core features are implemented in the following modules:
- `src/vs/editor/browser/widget/codeEditorWidget.ts` - Inline diffs & ghost text
- `src/vs/workbench/services/contextIndex` - AST-based indexing
- `src/vs/workbench/services/priompt` - Token management
- `src/vs/workbench/services/inferenceGateway` - Fast inference
- `src/vs/workbench/services/agentOrchestrator` - Multi-file agent

### Phase 7: Production Compilation

```bash
# Development build
npm run watch

# Production builds
npm run gulp vscode-win32-x64-min      # Windows x64
npm run gulp vscode-win32-arm64-min    # Windows ARM64
npm run gulp vscode-darwin-x64-min     # macOS Intel
npm run gulp vscode-darwin-arm64-min   # macOS Apple Silicon
npm run gulp vscode-linux-x64-min      # Linux x64
npm run gulp vscode-linux-arm64-min    # Linux ARM64
```

### Phase 7: Desktop Packaging

```bash
# Windows installer
npm run gulp vscode-win32-x64

# macOS DMG
npm run gulp vscode-darwin-x64

# Linux packages
npm run gulp vscode-linux-x64
```

## Code Signing

### Windows Code Signing
```powershell
# Sign the executable
signtool sign /f certificate.pfx /p password /t http://timestamp.digicert.com \
    /fd sha256 "VSCode-win32-x64\gscoder.exe"
```

### macOS Code Signing & Notarization
```bash
# Sign the application
codesign --deep --force --verify --verbose \
    --sign "Developer ID Application: Your Name" \
    "VSCode-darwin-x64/GSCODER.app"

# Notarize
xcrun altool --notarize-app \
    --primary-bundle-id "com.gscoder.ide" \
    --username "your@email.com" \
    --password "app-specific-password" \
    --file "VSCode-darwin-x64/GSCODER.dmg"
```

## Update Server

The update server (`SovereignUpdateServer`) serves:
- Version check endpoint: `GET /api/update/:platform/:arch/:version`
- Download endpoint: `GET /api/download/binaries/:filename`
- Manifest file: `latest.json`

## Local Model Setup

### Ollama Setup
```bash
# Install Ollama
curl -fsSL https://ollama.com/install.sh | sh

# Pull required models
ollama pull deepseek-coder:1.3b
ollama pull deepseek-coder:7b
ollama pull llama3.1:70b
```

### vLLM Setup
```bash
pip install vllm

# Start vLLM server
python -m vllm.entrypoints.openai.api_server \
    --model deepseek-coder \
    --tensor-parallel-size 1 \
    --port 8000
```

## Verification

```bash
# Run tests
npm run test

# Run linting
npm run lint

# Build verification
npm run gulp vscode-win32-x64-min
```

## Troubleshooting

### Build Failures
- Ensure Node.js version is >= 20.0.0
- Clear cache: `rm -rf node_modules .yarn_cache`
- Reinstall: `npm install`

### Icon Generation Issues
- Ensure `branding/logo-master.png` exists
- Install sharp dependencies: `npm install sharp`

### Native Module Compilation
- Ensure Python 3.8+ is installed
- Ensure C++ build tools are installed
- Set PYTHON environment variable if needed

## Production Deployment

1. **Rebrand**: Run `npm run rebrand`
2. **Generate Icons**: Run `npm run generate-icons`
3. **Compile**: Run `npm run gulp vscode-[platform]-x64-min`
4. **Package**: Run platform-specific packaging commands
5. **Sign**: Apply code signatures
6. **Notarize** (macOS): Submit to Apple for notarization
7. **Deploy**: Upload to update server
8. **Test**: Verify installation and auto-updates
