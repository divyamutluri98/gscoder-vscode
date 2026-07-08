# GSCODER VS Code

A production-ready, white-labeled IDE forked from Microsoft VS Code with advanced AI-first features and complete privacy protection.

## Overview

GSCODER is a custom IDE built on the open-source VS Code core, enhanced with:
- **Native inline AI completions** with ghost text and inline diffs
- **Local-first architecture** with optional private server support
- **AST-based code indexing** for intelligent context retrieval
- **Multi-file agent orchestration** for complex code modifications
- **Complete privacy shield** - zero telemetry, local-only processing
- **Private extension marketplace** using Open VSX registry
- **Performance observability** with local metrics dashboard
- **Sovereign update server** for air-gapped deployments

## Features

### Phase 1: Rebranding Automation
- Automated brand configuration via `rebrand.ts`
- Custom application icons for all platforms
- Telemetry removal and privacy-first defaults

### Phase 2: Core UX Modifications
- Inline input container (Ctrl+K / Cmd+K)
- Native ghost text overlay with 0.5 opacity
- Surgical inline diff component (green/red highlights)
- Layout resilience for font resizing and scrolling

### Phase 3: Context Processing Layer
- Tree-sitter based AST parsing
- Semantic code chunking (functions, classes, interfaces)
- Incremental file hashing (Merkle tree strategy)
- Local vector database with LanceDB/Hnswlib
- Context similarity search with cosine scoring

### Phase 4: Token Management (Priompt)
- JSX-based prompt configuration
- Sliding token priorities (p={1000}, p={600}, prel)
- Automatic truncation boundary for context culling
- Dynamic priority based on similarity scores

### Phase 5: Fast Inference Gateway
- Server-Sent Events (SSE) streaming
- Aggressive request interception on typing
- Fill-In-The-Middle (FIM) context structuring
- Token normalization for multiple LLM providers

### Phase 6: Multi-File Agent Orchestrator
- Planning phase with structured JSON output
- Surgical multi-file editing with diff patches
- Sandbox terminal runner with verification
- Self-correction loop (max 3 retries)

### Phase 7: Production Compilation
- Cross-platform builds (Windows, macOS, Linux)
- Native packaging (EXE, DMG, DEB, RPM)
- Code signing and notarization support
- Update server manifest generation

### Phase 8: Local Model Routing
- Feature-based model tier assignment
- Context window boundary enforcement
- Automatic failover to smaller models
- VRAM out-of-memory handling

### Phase 9: Privacy Shield
- Telemetry interception (null-sink routing)
- Local secret scanning (passwords, API keys, certificates)
- .gitignore and .ideignore compliance
- Blocked path filtering (node_modules, dist, etc.)

### Phase 10: Private Extensions Marketplace
- Open VSX registry integration
- Signed VSIX side-loading
- Air-gapped sync for team deployments

### Phase 11: Performance Observability
- Time to First Token (TTFT) tracking
- Acceptance vs rejection rate metrics
- Hardware context warnings (>800ms)
- Local SQLite database storage
- Markdown report generation

### Phase 12: AI Settings Panel
- Custom model endpoint configuration
- Temperature, Top_P, Max Tokens sliders
- Custom system instructions insertion
- Context window size limits

### Phase 13: Fine-Tuning Pipeline
- Successful session capture
- JSONL and Alpaca format export
- Automated code de-duplication
- Training data filtering

### Phase 14: Terminal Integration
- Shell integration hooks
- Non-zero exit code capture
- One-click "Fix with Local AI" buttons
- Context bundling for agent resolution

### Phase 15: Sovereign Update Server
- Version check endpoint (`/api/update/:platform/:arch/:version`)
- Binary download streaming
- Graceful no-update fallback (204 No Content)
- Release manifest generation

### Phase 16: Remote Index Caching
- Pre-computed index check by git hash
- Delta index distribution
- Incremental local override
- Secure private network communication

## Installation

### Prerequisites
- Node.js >= 20.0.0
- Python 3.8+
- Yarn 1.22+
- Git 2.30+

### Build from Source

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

# Development build
npm run watch

# Production builds
npm run gulp vscode-win32-x64-min      # Windows x64
npm run gulp vscode-darwin-x64-min     # macOS Intel
npm run gulp vscode-linux-x64-min      # Linux x64
```

## Configuration

### Brand Configuration

Edit `brand.config.json` to customize:
- Brand names (short, long, application name)
- Platform-specific identifiers
- Telemetry settings
- Asset paths

### AI Model Setup

#### Ollama (Local)
```bash
# Install Ollama
curl -fsSL https://ollama.com/install.sh | sh

# Pull required models
ollama pull deepseek-coder:1.3b
ollama pull deepseek-coder:7b
ollama pull llama3.1:70b
```

#### vLLM (Private Server)
```bash
pip install vllm

# Start vLLM server
python -m vllm.entrypoints.openai.api_server \
    --model deepseek-coder \
    --tensor-parallel-size 1 \
    --port 8000
```

### Settings

Access AI settings via:
- **Command Palette**: `GSCODER: AI Settings`
- **Settings UI**: Configure model endpoints, temperature, context limits

## Usage

### Inline Completions
- Pause typing to see ghost text suggestions
- Press `Tab` to accept, `Esc` to reject
- Suggestions use local models (<100ms latency)

### Inline Edits (Ctrl+K / Cmd+K)
- Select code and press `Ctrl+K` / `Cmd+K`
- Enter natural language instruction
- View inline diff with green/red highlights
- Accept or reject changes

### Multi-File Agent
- Use `GSCODER: Agent Composer` command
- Describe complex multi-file changes
- Agent generates execution plan
- Automatic verification and self-correction

### Terminal Error Fixing
- Run commands in integrated terminal
- On error, click "Fix with Local AI" button
- Agent analyzes error and generates fix
- Apply fix with one click

## Privacy

GSCODER is designed for complete privacy:
- **Zero telemetry** - all analytics intercepted
- **Local-only processing** - no cloud dependencies
- **Secret scanning** - prevents accidental data leaks
- **Air-gappable** - works completely offline
- **Private extensions** - Open VSX registry only

## Performance

### Metrics
- **TTFT**: <100ms for inline completions
- **Acceptance Rate**: Tracked locally
- **Context Window**: Configurable (4K-64K tokens)
- **Memory**: Optimized for local execution

### Monitoring
View performance analytics:
- `GSCODER: View Performance Analytics` command
- Local SQLite database storage
- Markdown report generation

## Updates

### Automatic Updates
- Built-in update checker
- Sovereign update server support
- Manual update download option

### Air-Gapped Mode
- Download updates to internal server
- Team sync via private network
- Manual VSIX installation

## Development

### Project Structure
```
gscoder-vscode/
├── src/vs/editor/browser/widget/
│   └── InlineDiffWidget.ts          # Phase 2
├── src/vs/workbench/services/
│   ├── contextIndex/
│   │   └── ASTIndexer.ts            # Phase 3
│   ├── priompt/
│   │   └── AdvancedCodeQueryPrompt.tsx  # Phase 4
│   ├── inferenceGateway/
│   │   └── InferenceGateway.ts       # Phase 5
│   ├── agentOrchestrator/
│   │   └── AgentOrchestrator.ts      # Phase 6
│   ├── modelRouter/
│   │   └── ModelRouter.ts            # Phase 8
│   ├── privacyShield/
│   │   └── PrivacyShield.ts          # Phase 9
│   ├── extensionRegistry/
│   │   └── ExtensionRegistry.ts      # Phase 10
│   ├── metricsCollector/
│   │   └── MetricsCollector.ts       # Phase 11
│   ├── aiSettingsPanel/
│   │   └── AISettingsPanel.ts        # Phase 12
│   ├── finetunePrepPipeline/
│   │   └── FinetunePrepPipeline.ts  # Phase 13
│   ├── terminalInterceptor/
│   │   └── TerminalInterceptor.ts    # Phase 14
│   ├── updateServer/
│   │   └── SovereignUpdateServer.ts  # Phase 15
│   └── contextCacheSync/
│       └── ContextCacheSync.ts       # Phase 16
├── rebrand.ts                        # Phase 1
├── brand.config.json                 # Brand configuration
├── BUILD.md                          # Build instructions
└── package.json                      # Dependencies
```

### Contributing
1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## License

MIT License - See LICENSE file for details

## Support

- **Issues**: GitHub Issues
- **Documentation**: See BUILD.md
- **Community**: [Your Community Platform]

## Acknowledgments

- Built on Microsoft VS Code (Code - OSS)
- Uses Open VSX for extensions
- Powered by local LLMs (Ollama, vLLM)
- Tree-sitter for AST parsing
