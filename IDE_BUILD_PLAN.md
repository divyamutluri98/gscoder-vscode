---

## Phase 1: Automation for Forking and Rebranding 

### Target
Decouple the open-source `microsoft/vscode` (Code - OSS) core from Microsoft’s ecosystem and re-brand the binary.

### Prompt 1
```text
We are building a custom, white-labeled IDE forked directly from the open-source VS Code core ([github.com/microsoft/vscode](https://github.com/microsoft/vscode)). 
I need you to write a production-grade NodeJS / TypeScript automation script (`rebrand.ts`) that runs at the root of the cloned vscode repository to change all default system identifiers to our custom brand: "YourBrand".

The script must programmatically modify the following files and structural layers:
1. `product.json`: Update `nameShort`, `nameLong`, `applicationName`, `dataFolderName`, `win32AppId`, and `urlProtocol` to match our brand. Strip out Microsoft's default telemetry and crash-reporting configurations, replacing them with a custom placeholder object.
2. `package.json`: Adjust package metadata, author parameters, and internal build properties.
3. Asset Overwrite Pipeline: Script an automated copy routine that replaces default VS Code application icons, app logos, and window splash graphics across all desktop compile formats (macOS `.icns`, Windows `.ico`, Linux `.png`).
4. Build Infrastructure Documentation: Provide a complete markdown file (`BUILD.md`) listing all cross-compilation system dependencies (Node toolchain version, Python setups, native C++ build-essential libraries) along with the precise execution paths for compiling the branded production binaries using `yarn watch` or `gulp vscode-[platform]`.
Phase 2: Core UX Modification (Inline Diffs & Ghost Text)
Target
Inject code directly into the native editor UI layout to handle inline generation without relying on restricted extension APIs.

Prompt 2
Plaintext
We need to implement a native inline code editing panel inside our custom VS Code fork, matching an AI-first IDE interface. Write a TypeScript system patch targeting the core text-buffer rendering pipeline (specifically extending or integrating with `src/vs/editor/browser/widget/codeEditorWidget.ts` or the native workbench zone widgets).

The module must implement:
1. An Inline Input Container: A custom UI input strip that can slide open smoothly between lines of text when triggered by a custom keybinding (e.g., Ctrl+K / Cmd+K).
2. Native Ghost Text Overlay: A line rendering interceptor that draws predictive completions (gray inline text with 0.5 opacity) directly within the active text buffer before a user accepts or rejects it.
3. Surgical Inline Diff Component: A custom view model that dynamically tracks an active code-patch payload and paints green line highlights for new insertions and red strike-through highlights for deletions directly inside the live editor space without using separate side-by-side split panels.
4. Layout Resilience: Ensure this interface safely adapts to font resizing, editor viewport scrolling, multi-root workspace views, and cursor position shifts without throwing layout boundary panics.
Phase 3: The Context Processing Layer (AST-Based Indexing)
Target
Build a local daemon that splits files into semantic blocks using tree-sitter and tracks variations with an incremental layout index.

Prompt 3
Plaintext
Build a high-performance local indexing daemon in Rust or TypeScript that runs as a background service inside our custom workbench to provide comprehensive repository-wide context.

The engine must implement the following operations:
1. **Semantic Code Chunking:** Integrate `web-tree-sitter` (or native node-tree-sitter bindings) to parse source code files (`.ts`, `.py`, `.rs`, `.go`) into Abstract Syntax Trees (AST). Instead of slicing text blindly by raw line counts, slice files intelligently into complete functional units (e.g., individual functions, complete class declarations, interfaces, methods).
2. **Incremental State Syncing:** Implement a high-speed workspace watcher using an incremental file-hashing pipeline (Merkle tree strategy). The indexer must track file edits and recalculate hashes so that only modified blocks are re-parsed and re-embedded, minimizing disk overhead.
3. **Local Vector Database System:** Create an interface to pass extracted code blocks through a local embedding mechanism (configured to call a local instance running `nomic-embed-text` via Ollama, or a private microservice). Store the resulting data locally inside an embedded database like LanceDB, Hnswlib, or a highly optimized flat-file index.
4. **Context Similarity Engine:** Expose a retrieval API function that accepts an input search string from the user, vectorizes it, computes a cosine-similarity matrix score against the local store, and returns the top 5 most relevant structural code snippets alongside their absolute file paths and line number ranges.
Phase 4: Token Management & Prompts (Priompt Interface)
Target
Incorporate Priority Prompt (Priompt) JSX layout algorithms to prioritize essential context items dynamically within sliding parameter tokens.

Prompt 4
Plaintext
We are creating a custom context routing architecture using the open-source JSX prompt configuration standard (`@anysphere/priompt`). Write a TypeScript TSX component called `AdvancedCodeQueryPrompt`.

The component must map out an input model payload containing:
- `userIntentText`: string
- `currentOpenFileState`: { path: string, content: string, selectionStart: number, selectionEnd: number }
- `retrievedCodebaseContext`: Array<{ path: string, content: string, rankingScore: number }>
- `compilerDiagnostics`: Array<{ message: string, severity: string, errorLine: number }>

Configure the prompt layout using strict sliding token priorities (`p` or `prel` attributes):
1. **Critical Priority (p={1000}):** The global system persona configurations and the core `userIntentText`. This block must never be culled.
2. **High Priority (p={600}):** The developer's currently open text view window and active compiler/linter error array (`compilerDiagnostics`).
3. **Dynamic Decoupling (prel):** Loop through the items inside `retrievedCodebaseContext`. Use a sliding priority score based on their similarity index values. Wrap these elements inside an automatic truncation boundary tag so that the lowest-scoring code snippets are cleanly pruned one by one if the complete prompt calculation nears the model’s context length window edge.
Phase 5: Fast Inference and Speculative Completion Gateway
Target
Handle high-speed streaming autocompletions (Fill-In-The-Middle) using real-time debouncing and cancellation hooks.

Prompt 5
Plaintext
Write an enterprise-grade, low-latency API gateway server in Go or Node.js (Fastify) designed to route real-time inline completion requests between our custom desktop IDE and our private backend model instances.

The gateway architecture must implement:
1. **Server-Sent Events (SSE) Streaming:** Establish a highly responsive SSE connection channel to deliver streaming text completions frame-by-frame to the desktop editor.
2. **Aggressive Request Interception:** Monitor client-side typing states. If a developer keystroke event is registered while an active inference stream is running, instantly dispatch an `AbortController` cancellation signal upstream to terminate the current model run and free execution hardware.
3. **Fill-In-The-Middle (FIM) Context Structuring:** Collect the active text document state, current cursor offset position, and surrounding code boundaries from the incoming payload. Structure this data instantly into standard FIM structural blocks using targeted tokens (like `<pre>`, `<suf>`, and `<img>` formats) optimized for deep-learning models like DeepSeek-Coder, StarCoder, or local Llama open-weight fine-tunes.
4. **Token Normalization:** Standardize the raw delta emissions from the upstream LLM provider and re-format them into a lightweight JSON stream pattern that our desktop ghost-text interface can instantly process and render smoothly.
Phase 6: Multi-File Agent Orchestrator (Composer Mode)
Target
Coordinate complex, multi-file execution plans using a localized sandboxed execution toolchain and self-correction telemetry.

Prompt 6
Plaintext
We need to implement a background Agent Orchestrator inside our IDE backend that can execute complex, multi-file code modifications (similar to a Composer agent). Write a TypeScript module (`AgentOrchestrator.ts`) that manages this planning and editing execution loop.

The agent engine must implement the following multi-step pipeline:
1. **The Planning Phase:** Accept a complex user goal (e.g., "Add JWT auth to the backend and update the frontend login view"). Pass this to a high-reasoning model along with the workspace directory map. The model must output a structured JSON plan listing a sequence of file modifications, file creations, or file deletions.
2. **Surgical Multi-File Editing:** Implement a file-writing coordinator that reads the JSON plan. For existing files, it must apply precise patches or diff modifications without rewriting entire files from scratch to save tokens. For new files, it must write them to disk.
3. **Execution & Verification Loop:** Build a sandboxed terminal runner using native Node.js `child_process` or `node-pty`. After the agent applies changes, it must automatically execute terminal verification tasks (e.g., running `npm run lint` or `npm test`).
4. **Self-Correction Layer:** If the verification tasks return an error code or logs containing exceptions, feed the error logs back into the model along with the modified files, allowing the agent to self-correct its changes in a loop up to a max retry limit of 3.
Phase 7: Production Compilation and Desktop Packaging
Target
Package the modified application codebase into optimized installers native to target operating systems.

Prompt 7
Plaintext
We have completed our code modifications to our custom VS Code fork. Now, we need to create a rock-solid, production-ready desktop compilation and packaging pipeline. Write a comprehensive CI/CD automation configuration script (GitHub Actions YAML or a standalone master Bash script) to compile and bundle our application for production distribution.

The automation script must execute and handle the following deployment phases cleanly:
1. **Production Compilation:** Run the native VS Code production optimizations (`yarn compile` and `yarn gulp vscode-linux-x64-min` / `vscode-win32-x64-min` / `vscode-darwin-x64-min` or native ARM64 targets). Ensure all minification, tree-shaking, and code obfuscation tasks complete successfully without compilation errors.
2. **Native Packaging Wrapper:** Configure Electron Builder or the native VS Code gulp-packaging scripts to bundle the compiled binary into production installers: `.dmg` and `.pkg` for macOS (including Apple Silicon / Intel universal targets), an `.exe` installer (and portable `.zip`) for Windows 10/11, and `.deb` / `.rpm` architectures for Linux distributions.
3. **App Code-Signing and Notarization Block:** Include placeholder blocks and detailed configuration instructions for automated application code-signing. For macOS, integrate Apple Developer code-signing identities and the `xcrun altool` notarization verification flow. For Windows, include SignTool certificate hooks to ensure users don't encounter security or Microsoft Defender SmartScreen warnings upon installation.
4. **Update Server Manifest:** Output a production-ready `latest.json` or update manifest file alongside the binaries so our desktop application can track automated updates over-the-air from our central release server.
Phase 8: Establishing Local Model Routing and Fallbacks
Target
Establish an independent local routing map connecting directly with vLLM/Ollama private model allocations.

Prompt 8
Plaintext
We need to finalize our custom IDE backend infrastructure by building an internal routing layer that connects to open-source models running locally or on a private server via Ollama/vLLM APIs, removing any commercial cloud wrappers. Write a Node.js (TypeScript) routing module (`ModelRouter.ts`).

The router must implement the following specific behaviors:
1. **Model Route Assignment:** Map distinct features inside our editor to the most efficient local model weights:
   - `Inline Tab Completion (FIM):` Route to a local instance running `deepseek-coder:1.3b` or `qwen2.5-coder:1.5b` for sub-100ms latency.
   - `Inline Edits (Ctrl+K):` Route to `deepseek-coder:7b` or `qwen2.5-coder:7b` to balance code structure adherence with processing speed.
   - `Agent Composer Loop (Phase 6):` Route to a highly capable model like `llama3.1:70b` or `deepseek-coder:33b` to process heavy system context and multiple file modifications.
2. **Context Window Boundary Enforcement:** Check the output token limits before hitting the local endpoint. If a user provides a massive repository context that risks crashing a smaller model's context window, implement an automatic threshold check that safely cascades the request up to the next highest model tier or triggers our Priompt culling logic.
3. **Local Failover and Error Recovery:** If a heavy model instance reports a local hardware VRAM out-of-memory error or hangs during a long loop execution, seamlessly down-scale the task to the next smaller, highly responsive local model and append an inline warning to the editor UI log console.
Phase 9: Setting up Workspace Security and Local Privacy Shield
Target
Isolate tracking modules, enforce .gitignore compliance parameters, and block key/secret leakage.

Prompt 9
Plaintext
Write a robust workspace boundary and privacy protection module (`PrivacyShield.ts`) for our custom IDE. This module will run locally inside the application runtime to ensure user code remains completely private and zero telemetry data escapes to third parties.

The privacy module must enforce the following strict constraints:
1. **Sovereign Telemetry Override:** Intercept all internal native analytics hooks inherited from the original VS Code codebase. Force-route them to a completely isolated null-sink (`/dev/null`) or an internal local logging file so that no usage data ever pings foreign servers.
2. **Local Token Scanning:** Before any text snippet is compiled into a prompt layout or sent to our local inference gateway, run a high-speed Regex/AST-based scanner over the text buffer to find and flag accidental exposures of local secrets, like hardcoded passwords, private `.env` variables, or raw security certificates.
3. **Local .gitignore & .ideignore Compliance:** Ensure the indexing engine (from Phase 3) strictly reads and respects standard `.gitignore` and a custom `.ideignore` file. The indexer must block private data directories, build outputs, or local system caches from ever entering the vector database or passing through embedding layers.
Phase 10: Building an Internal Private Extensions Marketplace
Target
Point extensions to the Open VSX registry registry model and add support for signed local VSIX side-loading.

Prompt 10
Plaintext
Since our white-labeled IDE binary cannot legally use Microsoft's proprietary extension marketplace, we must build our own infrastructure for installing tools. Write a TypeScript configuration and extension manager utility (`ExtensionRegistry.ts`).

The system must handle:
1. **Open VSX Registry Connection:** Configure the desktop client's primary market endpoint to connect directly to the public, open-source `open-vsx.org` API registry instead of Microsoft's service.
2. **Private Team VSIX Side-Loading:** Build an internal workspace drop-zone component. If a developer drops a raw packaged `.vsix` extension file directly into the application, the utility must unpack it, verify its signature matches our private internal key, and install it directly into the application's local extension directory safely.
3. **Air-Gapped Sync:** Provide a straightforward command script that lets an administrator download a list of vital development extensions to an internal storage server so that the entire team can pull verified plugins within a completely air-gapped network.
Phase 11: Real-Time Performance Observability Dashboard
Target
Implement high-fidelity tracking metrics capturing Time to First Token (TTFT) and autocomplete suggestions validation telemetry.

Prompt 11
Plaintext
We need to build an internal observability and performance analytics dashboard for our custom IDE. Write a TypeScript system module (`MetricsCollector.ts`) that runs locally inside the editor workbench to track AI interaction health without compromising privacy.

The module must capture and log the following metrics to a local SQLite database or an internal dashboard file:
1. **Time to First Token (TTFT):** Track the exact millisecond delay between a user triggering an AI request (or pausing their typing for autocomplete) and the first token rendering in the UI.
2. **Acceptance vs. Rejection Rates:** Log user interaction events with "Ghost Text" completions. Track whether an inline suggestion was Accepted (Tab key pressed), Partially Accepted, or Rejected (user kept typing or pressed Escape).
3. **Hardware Context Warnings:** Monitor and flag instances where inference requests take more than 800ms, logging the size of the active file context window at that exact moment to help us optimize our Priompt configuration boundaries.
4. Provide a local markdown-rendering script that transforms this stored performance data into clean visual tables and graphs directly accessible via a custom editor command (e.g., "Developer Brand: View Performance Analytics").
Phase 12: Advanced Local User Personalization & Model Settings UI
Target
Expose custom configuration forms handling temperature parameter sweeps and local endpoint redirection boundaries.

Prompt 12
Plaintext
We need to provide an interactive settings interface inside our custom workbench so developers can manage their local AI parameters directly. Write a TypeScript UI view component (`AISettingsPanel.ts`) that hooks into our fork's native configuration registry.

The panel must expose clean, interactive form controls for the following options:
1. **Model Endpoint Selection:** Allow the user to input custom base URLs for their local inference engines (e.g., toggling between a local `http://localhost:11434` Ollama setup and a shared private team server `http://10.0.0.50:8000` running vLLM).
2. **Model Personalization Overrides:** Provide interactive sliders and inputs for standard generation parameters: Temperature (0.0 to 1.0), Top_P, Max Tokens, and Presence Penalty.
3. **Custom System Instructions Insertion:** Add a rich text area where developers can inject global system instructions (e.g., "Always write TypeScript using functional composition guidelines and use strict error checking") which will be parsed directly into our Phase 4 Priompt layout template.
4. **Context Window Sliders:** Let users set a maximum token cap for repository indexing queries (e.g., limiting vector searches to a maximum of 4,000 tokens on lower-spec laptops or opening it up to 64,000 tokens on high-end developer workstations).
Phase 13: Local Model Fine-Tuning Prep Pipeline
Target
Aggregate high-quality successful sessions into clean structured training datasets formatted into JSONL instruction pairs.

Prompt 13
Plaintext
Write a background utility script (`FinetunePrepPipeline.ts`) that runs securely on the developer's local machine to convert successful coding sessions into clean training datasets for fine-tuning our open-weights models later.

The pipeline must execute the following background processes:
1. **Successful Session Capture:** When a developer successfully writes, builds, and saves a file without any compilation errors, compile that code file alongside the original `userQuery` or feature request that prompted it.
2. **JSONL Formatting:** Format these paired data interaction blocks into a clean, standard standard training format (such as OpenAI's JSONL message structure or Alpaca instruction sets), separating the system prompt, user instruction, and the optimized code output response.
3. **Automated Code De-Duplication:** Implement a filtering mechanism that strips out boilerplate code, generic configuration files, or massive third-party library files (`node_modules`), ensuring only high-quality, logic-dense team code patterns are stored in the training dataset folder (`.ide-training-data/`).
Phase 14: Terminal Shell Integration and Automatic Error Interception
Target
Capture non-zero exit codes directly from the active shell view buffer and create one-click terminal fix shortcuts.

Prompt 14
Plaintext
We need to implement an automatic terminal diagnostic interception framework inside our custom IDE workbench. Write a TypeScript system module (`TerminalInterceptor.ts`) that patches into the core integrated terminal manager (`src/vs/workbench/contrib/terminal`).

The module must execute the following operations:
1. **Shell Integration Hooks:** Tap into the editor's native shell integration capability (using standard xterm.js or VS Code terminal buffer hooks) to track the lifecycle of executed commands.
2. **Failure Capture:** Listen for non-zero command exit codes (e.g., exit code 1 or 127). When a failure occurs, grab the immediate trailing 50 lines of raw stdout/stderr text data from the terminal scrollback buffer.
3. **One-Click Quick Fix Trigger:** When a terminal error is detected, dynamically render an inline actionable button directly above the failing command line inside the terminal window pane (labeled e.g., "Fix with Local AI").
4. **Context Bundling:** Clicking the action button must pack the execution context—the original command string, the raw error scrollback text, and the path of the active open file—and stream it to our local Phase 6 Agent Orchestrator to generate an automated terminal resolution patch.
Phase 15: Sovereign Over-the-Air (OTA) Release Update Server
Target
Serve version confirmation queries and deploy compressed update binaries smoothly over the private network.

Prompt 15
Plaintext
Build a production-grade, minimal update distribution microservice engine in Go or Node.js (Fastify) called `SovereignUpdateServer`. This standalone service will handle secure over-the-air update pings coming directly from our desktop IDE clients.

The server application must handle the following endpoints and protocols:
1. **Client Update Check:** Expose an API endpoint matching the native VS Code update check format (`GET /api/update/:platform/:arch/:version`). 
2. **Version Evaluation Engine:** Read a static local manifest data array (`releases.json`) containing signed production builds compiled from our Phase 7 deployment pipeline. If the client version is behind our latest release commit, serve a clean `200 OK` JSON response passing the artifact download target URL, update release summary, and binary SHA-256 validation hash.
3. **Graceful No-Update Fallback:** If the client version already matches the latest server asset signature, cleanly return a `204 No Content` response to minimize heartbeat polling traffic over our network.
4. **Download Streaming:** Provide a secure streaming route (`GET /api/download/binaries/:filename`) that feeds compressed packaging files (`.dmg`, `.exe`, or `.deb`) down to clients using structured streaming chunks to reduce localized server VRAM memory consumption during simultaneous team downloads.
Phase 16: Centralized Remote Repository Index Caching (Hybrid Mode)
Target
Query repository hashes from a central engine to synchronize syntax configurations and download delta index sets seamlessly.

Prompt 16
Plaintext
Write a robust synchronization module (`ContextCacheSync.ts`) to split codebase context workloads between a local developer environment and a central team server.

The module must orchestrate the following sync logic:
1. **Pre-Computed Index Check:** When a developer opens a workspace project folder, the module must query our internal team server using the repository's primary git tracking hash.
2. **Delta Index Distribution:** If a verified global index mapping for that repository already exists on the central server, stream down the pre-computed tree-sitter node mappings and vector database records directly into the developer's local LanceDB/Hnswlib instance.
3. **Incremental Local Override:** After the global index layers copy over, pass processing control back down to our local Phase 3 engine to track new files, modifications, and untracked git changes locally.
4. Ensure the sync engine communicates strictly over secure, internal, private network