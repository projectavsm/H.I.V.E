# H.I.V.E. — Hardened Isolation Vector Engine

### Privacy-First Local AI Runtime Platform & Agentic Middleware Gateway

H.I.V.E. is a local, air-gapped AI runtime system that combines a FastAPI backend, SQLite semantic cache, and a local vector retrieval engine with a React frontend.

---

## 🏗️ Core Architectural Topology

[cite_start]H.I.V.E. runs on a modular, asynchronous Three-Tier Topology connected entirely over explicit IPv4 loopback socket targets to bypass local Windows 11 IPv6 handshaking bottlenecks[cite: 427, 819]:

+-------------------------------------------------------------------------+| 1. APPLICATION UI TIER                                                  ||    React (Vite) -> Custom Native Fetch Streams (useOllamaStream)        |+-------------------------------------------------------------------------+http://127.0.0.1:5173│▼+-------------------------------------------------------------------------+| 2. MIDDLEWARE CONTROLLER TIER                                           ||    FastAPI Engine + SQLite Cache Layer + ChromaDB Embeddings Vectorizer |+-------------------------------------------------------------------------+http://127.0.0.1:8000│▼+-------------------------------------------------------------------------+| 3. CORE RUNTIME INTELLIGENCE TIER                                       ||    Ollama Daemon + CUDA 12 Core Logic Acceleration + Quantized GGUF     |+-------------------------------------------------------------------------+http://127.0.0.1:11434
---

## ⚡ High-Performance Telemetry & Data Processing Flow

To maximize processing headroom, the backend relies on an asynchronous data pipeline. When a client issues a prompt, it traces through the following pipeline layers[cite: 792]:

[ Incoming User Turn Prompt ]
│
▼
[ Defense Layer 1: FIFO Pruner ] ---> Caps Conversation History at Last 10 Turns 
│
▼
┌───────────────────────────────┐
│     Semantic Cache Lookup     │ ---> Query SQLite Storage Vault Cache 
└──────────────┬────────────────┘
├───────────────────────────────┐
[ Cache HIT ]                   [ Cache MISS ]
│                               │
▼                               ▼
(5ms Response Latency)            ┌───────────────────────────────┐
Emulate SSE Token Stream             │      Local RAG Extraction     │ ---> Query ChromaDB Context Directly to Frontend      └───────────────┬───────────────┘
▼
┌───────────────────────────────┐
│ Agent Trigger Check (Regex)   │ ---> Scrape live web context if text └───────────────┬───────────────┘      contains search keywords 
▼
┌───────────────────────────────┐
│       Invoke Ollama LLM       │ ---> Execute CUDA-accelerated └───────────────┬───────────────┘      Model Inference (llama3.1) 
▼
┌───────────────────────────────┐
│     Commit Pair to Cache      │ ---> Append to SQLite database 
└───────────────┬───────────────┘
▼
[ Return Real-Time SSE Token Stream to Cyberpunk Frontend Interface ]   
### 📊 Real-Time Server-Sent Events (SSE) Telemetry
To prevent main-thread layout freezing, a persistent HTTP transport layer channel pushes system metrics to the frontend UI client smoothly every 2.0 seconds[cite: 435, 611]:
* **Backend (`app/api/telemetry.py`):** Utilizes FastAPI's `StreamingResponse` wrapping an asynchronous generator loop throttled via `asyncio.sleep` to completely eradicate console logging spam[cite: 596].
* **Frontend (`hooks/useTelemetry.ts`):** Leverages the browser's native `EventSource` API with auto-reconnection and explicit unmount socket cleanups (`eventSource.close()`) to mitigate memory leak vectors.

---

## 🔒 Hardware Boundaries & Production Safeguards

The platform is explicitly optimized for consumer-grade hardware (Baseline target: **NVIDIA RTX 4060 Laptop GPU with 8GB VRAM** and **16GB Host RAM**) running Windows 11. Crossing VRAM boundaries causes PCIe fallback mechanisms to trigger, collapsing text generation performance[cite: 505]:

* **Desktop Reservation Overhead:** Windows reserves ~0.8GB–1.2GB VRAM for rendering[cite: 425]. Maximum stable inference budget is locked between **6.5GB–7.0GB VRAM**[cite: 425].
* **Context Ceiling:** Core context token pool (`num_ctx`) is fixed permanently at **4096**.
* **Memory Pruning:** A server-side sliding FIFO filter truncates history beyond **10 conversational turns**[cite: 426, 777].
* **RAG Retrieval Limits:** Ingestion engine caps context injection at top **K=3** chunks with a strict cosine similarity threshold of **> 0.4** to stop hallucination trends[cite: 426, 444].

---

## 📁 Repository Scaffolding Diagram

```text
hive-root/
├── backend/
│   ├── app/
│   │   ├── api/             # API Router, chat streaming endpoints, telemetry stream
│   │   ├── core/            # Centralized Pydantic-Settings configs, firewall limits
│   │   ├── models/          # Pydantic validation schemas (MessageParam, ChatCompletionRequest)
│   │   ├── services/        # LocalRAGEngine, Ollama socket connection handlers
│   │   └── tools/           # Isolated AutonomousWebScraper engine
│   ├── storage_vault/       # Physical storage for user uploads & SQLite semantic_cache.db
│   ├── vector_store/        # Local ChromaDB/FAISS vector extraction index indexes
│   ├── .env                 # Environment configurations
│   ├── main.py              # Main system entrypoint & CORS origin controller
│   └── requirements.txt     # Python dependency matrix
└── frontend/
    ├── src/
    │   ├── components/      # Modular layout components (ChatWindow, Dashboard Sidebar)
    │   ├── hooks/           # useOllamaStream.ts (Binary stream processing), useTelemetry.ts
    │   ├── services/        # Client API fetch wrappers
    │   ├── index.css        # Global Cyberpunk token variable styling systems
    │   ├── App.tsx          # Master state compilation & token text parsing interface
    │   └── main.tsx         # React app boot root node
    ├── vite.config.ts       # Frontend server configuration mappings
    └── package.json         # Node dependency manifestations
🔧 Step-by-Step System Installation & SetupPrerequisitesOperating System: Windows 11 (64-bit architecture).  CUDA Support: Install NVIDIA CUDA Toolkit 12+ matching your active graphics driver.Environment Runtimes: Python 3.10+ and Node.js v18+.Step 1: Clone and Stage the RepositoryBashgit clone [https://github.com/your-repo/hive-root.git](https://github.com/your-repo/hive-root.git)
cd hive-root
Step 2: Core Hardware Layer Setup (Ollama)Download and install Ollama for Windows.Force Ollama to run locally over IPv4 by launching your terminal and configuring the environment:DOSset OLLAMA_HOST=127.0.0.1:11434
ollama serve
Open a separate terminal and pull the baseline inference and embedding layers:Bashollama pull llama3.1
ollama pull all-minilm
Step 3: Backend Gateway ImplementationNavigate to the backend directory:Bashcd backend
Create and isolate your virtual environment:Bashpython -m venv venv
source venv/Scripts/activate  # On Windows CMD/Powershell use: .\venv\Scripts\activate
Install Python dependencies:Bashpip install -r requirements.txt
Configure your .env variables inside backend/.env:Ini, TOMLAPP_NAME="H.I.V.E. Core Engine"
DEBUG=False
OLLAMA_BASE_URL="[http://127.0.0.1:11434](http://127.0.0.1:11434)"
OLLAMA_MODEL="llama3.1"
EMBED_MODEL="all-minilm"
Step 4: Launching the Backend CoreBoot the FastAPI application server using Uvicorn. To prevent recursive reload engine crashes during file extraction and cache commits, always apply explicit folder exclusions:Bashuvicorn main:app --host 127.0.0.1 --port 8000 --reload --reload-exclude "storage_vault/*" --reload-exclude "vector_store/*"
Verify connection by opening http://127.0.0.1:8000/docs to test active endpoints.Step 5: Frontend Interface InstallationOpen a new terminal window and navigate to the frontend folder:Bashcd ../frontend
Install package dependencies:Bashnpm install
Run the development server interface:Bashnpm run dev
Access the primary system dashboard at: http://127.0.0.1:5173.📡 Unified Core API Blueprint SpecificationsHTTP MethodAPI Route PathDescriptionData Structure ConstraintsPOST/api/chat/streamCore message completion router. Targets SQLite cache directly before model initialization.  ChatCompletionRequest Pydantic payload schema.  POST/api/uploadExtracts files via python-docx / PyPDF, fragments blocks, generates embeddings through all-minilm and stores to vector store.  Multipart Form Data (.pdf, .md, .docx, .txt, .csv).  GET/api/vault/filesLists active file metadata nodes indexed securely within the database.  Returns verified file listing arrays.  DELETE/api/vault/files/{filename}Evicts chosen vector chunks from ChromaDB and purges physical file from disk.  String parameter: {filename} passed in route URL.  GET/api/telemetrySpits out a persistent Server-Sent Events stream delivering physical hardware tracking parameters.  Continuous stream (text/event-stream) returning raw JSON string blocks.  🛠️ Edge-Case Resilience MatrixFailure Condition PatternSystem Failure Recovery ProtocolOllama Service InterruptionCatches connection dropping and feeds specialized structural payload: {"error": "H.I.V.E. Core Engine offline."} back to the client.  Vector Indexing Slicing CorruptionsIgnores single characters, loose whitespace, or fragments under 15 characters using the Semantic Text Guard Layer.  Browser DisconnectionIntercepts broken socket events server-side and forcefully tears down dangling processes.  GPU Memory Spike ThresholdRejects memory-heavy operations and steps down to low-quantization lightweight alternative targets.  Web Scraper Timeout FailureEmits a structured fallback notifying that online data matrices are temporarily unreachable to preserve response stability.  📜 Architectural Sync MandateThis document stands as the definitive Source-of-Truth Blueprint for the H.I.V.E. environment. Any updates, model swaps, path modifications, schema shifts, or configuration bindings must be explicitly logged down into this master document to maintain a tight development lifecycle and block structural system debt