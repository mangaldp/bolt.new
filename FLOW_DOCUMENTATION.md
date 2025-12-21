# Bolt.new - Complete Flow Documentation

## Table of Contents
1. [Architecture Overview](#architecture-overview)
2. [Technology Stack](#technology-stack)
3. [Complete Flow: From Prompt to Execution](#complete-flow-from-prompt-to-execution)
4. [Detailed Phase Breakdown](#detailed-phase-breakdown)
5. [Data Flow Diagram](#data-flow-diagram)
6. [Key Design Patterns](#key-design-patterns)
7. [Performance Optimizations](#performance-optimizations)
8. [Error Handling](#error-handling)
9. [Security Considerations](#security-considerations)
10. [Summary](#summary)

---

## Architecture Overview

Bolt.new is an AI-powered code generation platform that runs entirely in the browser. It uses Claude AI to generate code and WebContainer to execute it without any backend infrastructure.

**Core Philosophy:**
- Everything runs in the browser (no VMs, no cloud servers)
- Real-time streaming responses from AI
- Immediate code execution in WebContainer
- Live preview of generated applications

---

## Technology Stack

### Frontend
- **Framework**: Remix (React-based)
- **Deployment**: Cloudflare Pages
- **State Management**: Nanostores (lightweight reactive state)
- **Styling**: TailwindCSS + UnoCSS
- **Animations**: Framer Motion
- **Code Editor**: CodeMirror 6
- **Terminal**: xterm.js

### Backend/API
- **LLM**: Anthropic Claude 3.5 Sonnet
- **AI SDK**: Vercel AI SDK
- **Streaming**: Server-Sent Events (SSE)

### Runtime Environment
- **Execution**: WebContainer (StackBlitz)
- **Node.js**: WASM-based in-browser runtime
- **Filesystem**: Virtual filesystem (IndexedDB)
- **Shell**: jsh (zsh emulation)

---

## Complete Flow: From Prompt to Execution

### High-Level Overview

```
User Input → API Route → LLM Processing → Response Parsing → 
Action Execution → WebContainer → UI Updates → Live Preview
```

---

## Detailed Phase Breakdown

### Phase 1: User Input & Chat Interface

**Entry Point:** `app/routes/_index.tsx`

**Main Component:** `app/components/chat/Chat.client.tsx`

**Key Features:**
- Text input with auto-resizing textarea
- File attachment support (images, code files)
- Image compression (800x800px, 0.7 JPEG quality)
- Multimodal content support (text + images)
- File modification tracking (shows diffs)
- Auto-save before message submission

**User Actions:**
1. Type prompt in textarea
2. Optionally attach files (images/code)
3. Click send or press Enter
4. System auto-saves any unsaved files
5. Collects file modifications as diffs

**Code Reference:**
```typescript
// app/components/chat/Chat.client.tsx
const sendMessage = async (_event: React.UIEvent, messageInput?: string) => {
  await workbenchStore.saveAllFiles();
  const fileModifications = workbenchStore.getFileModifcations();
  
  // Process attachments
  if (attachments.length > 0) {
    // Handle images and text files
  }
  
  // Append message with modifications
  append({ role: 'user', content: messageContent });
}
```

---

### Phase 2: Message Submission & API Call

**Route:** `app/routes/api.chat.ts`

**Flow:**
```
POST /api/chat
  ↓
chatAction(request)
  ↓
Extract messages from request body
  ↓
Create SwitchableStream
  ↓
Call streamText()
```

**Message Format:**
```typescript
interface Message {
  role: 'user' | 'assistant';
  content: string | Array<TextContent | ImageContent>;
  toolInvocations?: ToolResult[];
}
```

**Key Features:**
- Streaming response handling
- Automatic continuation if token limit reached
- Max 5 response segments
- Error handling with proper status codes

**Code Reference:**
```typescript
// app/routes/api.chat.ts
async function chatAction({ context, request }: ActionFunctionArgs) {
  const { messages } = await request.json<{ messages: Messages }>();
  
  const stream = new SwitchableStream();
  
  const options: StreamingOptions = {
    toolChoice: 'none',
    onFinish: async ({ text: content, finishReason }) => {
      if (finishReason === 'length') {
        // Continue with CONTINUE_PROMPT
        messages.push({ role: 'assistant', content });
        messages.push({ role: 'user', content: CONTINUE_PROMPT });
        const result = await streamText(messages, context.cloudflare.env, options);
        return stream.switchSource(result.toAIStream());
      }
      return stream.close();
    },
  };
  
  const result = await streamText(messages, context.cloudflare.env, options);
  stream.switchSource(result.toAIStream());
  
  return new Response(stream.readable, {
    status: 200,
    headers: { contentType: 'text/plain; charset=utf-8' },
  });
}
```

---

### Phase 3: LLM Processing

**File:** `app/lib/.server/llm/stream-text.ts`

**Model Configuration:**
```typescript
{
  model: 'claude-3-5-sonnet-20241022',
  maxTokens: 8000,
  streaming: true,
  system: getSystemPrompt()
}
```

**System Prompt Components:**

1. **Environment Constraints:**
   - WebContainer limitations (no native binaries)
   - Python stdlib only (no pip)
   - No C++ compiler
   - Git not available
   - Prefer Node.js scripts over shell scripts

2. **Code Formatting Rules:**
   - Use 2 spaces for indentation
   - Provide FULL file contents (no placeholders)
   - Split functionality into smaller modules
   - Follow coding best practices

3. **Artifact Instructions:**
   - Wrap content in `<boltArtifact>` tags
   - Include `<boltAction>` elements for each operation
   - Action types: `shell` (commands) and `file` (file operations)
   - Install dependencies FIRST
   - Provide complete file contents (never truncate)

4. **Response Guidelines:**
   - Think holistically before creating artifacts
   - Consider all relevant files
   - Review previous file changes
   - Don't be verbose unless asked
   - Use valid markdown (no HTML except artifacts)

**Example Artifact Structure:**
```xml
<boltArtifact id="todo-app" title="React Todo App">
  <boltAction type="file" filePath="package.json">
    {
      "name": "todo-app",
      "dependencies": {
        "react": "^18.2.0",
        "vite": "^5.0.0"
      },
      "scripts": {
        "dev": "vite"
      }
    }
  </boltAction>
  
  <boltAction type="file" filePath="index.html">
    <!DOCTYPE html>
    <html>
      <head><title>Todo App</title></head>
      <body><div id="root"></div></body>
    </html>
  </boltAction>
  
  <boltAction type="shell">
    npm install && npm run dev
  </boltAction>
</boltArtifact>
```

**Code Reference:**
```typescript
// app/lib/.server/llm/stream-text.ts
export function streamText(messages: Messages, env: Env, options?: StreamingOptions) {
  const formattedMessages = messages.map((msg) => {
    if (typeof msg.content === 'string') {
      return { role: msg.role, content: msg.content };
    }
    // Handle multimodal content (text + images)
    return {
      role: msg.role,
      content: msg.content.map((item) => {
        if (item.type === 'text') {
          return { type: 'text', text: item.text };
        } else {
          return { type: 'image', image: item.source.data, mimeType: item.source.media_type };
        }
      }),
    };
  });

  return _streamText({
    model: getAnthropicModel(getAPIKey(env)),
    system: getSystemPrompt(),
    maxTokens: MAX_TOKENS,
    messages: formattedMessages,
    ...options,
  });
}
```

---

### Phase 4: Streaming Response & Parsing

**File:** `app/lib/runtime/message-parser.ts`

**Parser Architecture:**

```typescript
class StreamingMessageParser {
  #messages: Map<string, MessageState>
  
  parse(messageId: string, input: string): string {
    // Incremental parsing of streaming response
    // Detects artifact and action tags
    // Triggers callbacks at appropriate times
  }
}
```

**Message State:**
```typescript
interface MessageState {
  position: number;
  insideArtifact: boolean;
  insideAction: boolean;
  currentArtifact?: BoltArtifactData;
  currentAction: BoltActionData;
  actionId: number;
}
```

**Parsing Flow:**

1. **Detect Opening Tags:**
   - `<boltArtifact id="..." title="...">`
   - `<boltAction type="..." filePath="...">`

2. **Extract Attributes:**
   - Parse tag attributes (id, title, type, filePath)
   - Store in current artifact/action state

3. **Accumulate Content:**
   - Collect content between opening and closing tags
   - Handle streaming (partial content)

4. **Detect Closing Tags:**
   - `</boltAction>` → Trigger action execution
   - `</boltArtifact>` → Mark artifact as closed

5. **Trigger Callbacks:**
   - `onArtifactOpen` → Create artifact in workbench
   - `onActionOpen` → Prepare action (file actions)
   - `onActionClose` → Execute action (shell actions)
   - `onArtifactClose` → Finalize artifact

**Hook Integration:**
```typescript
// app/lib/hooks/useMessageParser.ts
const messageParser = new StreamingMessageParser({
  callbacks: {
    onArtifactOpen: (data) => {
      workbenchStore.showWorkbench.set(true);
      workbenchStore.addArtifact(data);
    },
    onActionOpen: (data) => {
      if (data.action.type !== 'shell') {
        workbenchStore.addAction(data);
      }
    },
    onActionClose: (data) => {
      if (data.action.type === 'shell') {
        workbenchStore.addAction(data);
      }
      workbenchStore.runAction(data);
    },
  },
});
```

---

### Phase 5: Workbench Store Management

**File:** `app/lib/stores/workbench.ts`

**Store Architecture:**

```typescript
class WorkbenchStore {
  #previewsStore: PreviewsStore
  #filesStore: FilesStore
  #editorStore: EditorStore
  #terminalStore: TerminalStore
  
  artifacts: MapStore<Record<string, ArtifactState>>
  showWorkbench: WritableAtom<boolean>
  currentView: WritableAtom<WorkbenchViewType>
  unsavedFiles: WritableAtom<Set<string>>
  modifiedFiles: Set<string>
}
```

**Artifact State:**
```typescript
interface ArtifactState {
  id: string;
  title: string;
  closed: boolean;
  runner: ActionRunner;  // Each artifact has its own runner
}
```

**Key Methods:**

1. **addArtifact(data):**
   - Creates new artifact entry
   - Initializes ActionRunner with WebContainer
   - Shows workbench panel

2. **addAction(data):**
   - Finds artifact by messageId
   - Adds action to artifact's runner queue

3. **runAction(data):**
   - Finds artifact by messageId
   - Executes action via runner

4. **saveFile(filePath, content):**
   - Writes to WebContainer filesystem
   - Updates unsaved files set
   - Triggers file store updates

5. **getFileModifications():**
   - Computes diffs of modified files
   - Returns modifications for next prompt

**Code Reference:**
```typescript
// app/lib/stores/workbench.ts
addArtifact({ messageId, title, id }: ArtifactCallbackData) {
  if (!this.artifactIdList.includes(messageId)) {
    this.artifactIdList.push(messageId);
  }

  this.artifacts.setKey(messageId, {
    id,
    title,
    closed: false,
    runner: new ActionRunner(webcontainer),
  });
}

async runAction(data: ActionCallbackData) {
  const { messageId } = data;
  const artifact = this.#getArtifact(messageId);
  
  if (!artifact) {
    unreachable('Artifact not found');
  }
  
  artifact.runner.runAction(data);
}
```

---

### Phase 6: Action Execution

**File:** `app/lib/runtime/action-runner.ts`

**ActionRunner Class:**

```typescript
class ActionRunner {
  #webcontainer: Promise<WebContainer>
  #currentExecutionPromise: Promise<void>
  actions: MapStore<Record<string, ActionState>>
  
  addAction(data: ActionCallbackData)
  runAction(data: ActionCallbackData)
  #executeAction(actionId: string)
  #runShellAction(action: ActionState)
  #runFileAction(action: ActionState)
}
```

**Action State:**
```typescript
type ActionStatus = 'pending' | 'running' | 'complete' | 'aborted' | 'failed';

interface ActionState {
  status: ActionStatus;
  abort: () => void;
  executed: boolean;
  abortSignal: AbortSignal;
  // Action-specific fields (type, content, filePath, etc.)
}
```

**Sequential Execution Pattern:**

```typescript
runAction(data: ActionCallbackData) {
  this.#currentExecutionPromise = this.#currentExecutionPromise
    .then(() => this.#executeAction(actionId))
    .catch((error) => console.error('Action failed:', error));
}
```

**Why Sequential?**
- Ensures correct order (files created before commands run)
- Prevents race conditions
- Maintains predictable state

**File Action Execution:**

```typescript
async #runFileAction(action: ActionState) {
  const webcontainer = await this.#webcontainer;
  
  // 1. Extract file path and content
  let folder = nodePath.dirname(action.filePath);
  
  // 2. Create parent directories
  if (folder !== '.') {
    await webcontainer.fs.mkdir(folder, { recursive: true });
  }
  
  // 3. Write file content
  await webcontainer.fs.writeFile(action.filePath, action.content);
}
```

**Shell Action Execution:**

```typescript
async #runShellAction(action: ActionState) {
  const webcontainer = await this.#webcontainer;
  
  // 1. Spawn shell process
  const process = await webcontainer.spawn('jsh', ['-c', action.content], {
    env: { npm_config_yes: true },
  });
  
  // 2. Handle abort signal
  action.abortSignal.addEventListener('abort', () => {
    process.kill();
  });
  
  // 3. Stream output to console
  process.output.pipeTo(
    new WritableStream({
      write(data) {
        console.log(data);
      },
    }),
  );
  
  // 4. Wait for completion
  const exitCode = await process.exit;
  
  // 5. Log result
  logger.debug(`Process terminated with code ${exitCode}`);
}
```

---

### Phase 7: WebContainer Integration

**File:** `app/lib/webcontainer/index.ts`

**Initialization:**

```typescript
if (!import.meta.env.SSR) {
  webcontainer = WebContainer.boot({ workdirName: WORK_DIR_NAME })
    .then((webcontainer) => {
      webcontainerContext.loaded = true;
      return webcontainer;
    });
}
```

**What is WebContainer?**

WebContainer is a browser-based runtime that executes Node.js code using WebAssembly. It provides:

1. **Virtual Filesystem:**
   - IndexedDB-backed storage
   - POSIX-like API (mkdir, writeFile, readFile)
   - File watching capabilities

2. **Process Execution:**
   - Spawn shell commands
   - Run npm, node, python3
   - Stream stdout/stderr

3. **Network Stack:**
   - Dev server support
   - Port forwarding
   - WebSocket connections

4. **Limitations:**
   - No native binaries
   - Python stdlib only (no pip)
   - No C++ compilation
   - No Git

**WebContainer API:**

```typescript
// Filesystem operations
await webcontainer.fs.writeFile('/path/to/file', content);
const content = await webcontainer.fs.readFile('/path/to/file', 'utf-8');
await webcontainer.fs.mkdir('/path/to/dir', { recursive: true });

// Process spawning
const process = await webcontainer.spawn('npm', ['install']);
await process.exit;

// Port events
webcontainer.on('port', (port, type, url) => {
  console.log(`Port ${port} is ${type} at ${url}`);
});
```

---

### Phase 8: File System Management

**File:** `app/lib/stores/files.ts`

**FilesStore Architecture:**

```typescript
class FilesStore {
  #webcontainer: Promise<WebContainer>
  #size: number
  #modifiedFiles: Map<string, string>
  files: MapStore<FileMap>
}
```

**File Types:**

```typescript
interface File {
  type: 'file';
  content: string;
  isBinary: boolean;
}

interface Folder {
  type: 'folder';
}

type FileMap = Record<string, File | Folder | undefined>;
```

**Key Features:**

1. **File Watching:**
   ```typescript
   async #init() {
     const webcontainer = await this.#webcontainer;
     const watcher = await webcontainer.fs.watch(WORK_DIR, { recursive: true });
     
     for await (const events of bufferWatchEvents(watcher)) {
       await this.#processWatchEvents(events);
     }
   }
   ```

2. **Modification Tracking:**
   ```typescript
   async saveFile(filePath: string, content: string) {
     const oldContent = this.getFile(filePath)?.content;
     
     // Track original content for diff
     if (!this.#modifiedFiles.has(filePath)) {
       this.#modifiedFiles.set(filePath, oldContent);
     }
     
     await webcontainer.fs.writeFile(relativePath, content);
   }
   ```

3. **Binary Detection:**
   ```typescript
   const isBinary = getEncoding(content) === 'binary';
   ```

4. **Diff Computation:**
   ```typescript
   getFileModifications() {
     return computeFileModifications(this.files.get(), this.#modifiedFiles);
   }
   ```

---

### Phase 9: Preview System

**File:** `app/lib/stores/previews.ts`

**PreviewsStore:**

```typescript
class PreviewsStore {
  #availablePreviews: Map<number, PreviewInfo>
  previews: Atom<PreviewInfo[]>
  
  async #init() {
    const webcontainer = await this.#webcontainer;
    
    webcontainer.on('port', (port, type, url) => {
      if (type === 'open') {
        // Dev server started
        this.#availablePreviews.set(port, { port, ready: true, baseUrl: url });
      } else if (type === 'close') {
        // Dev server stopped
        this.#availablePreviews.delete(port);
      }
      
      this.previews.set([...this.#availablePreviews.values()]);
    });
  }
}
```

**Preview Info:**

```typescript
interface PreviewInfo {
  port: number;
  ready: boolean;
  baseUrl: string;  // https://*.webcontainer-api.io/
}
```

**How Previews Work:**

1. **Dev Server Starts:**
   - Command runs: `npm run dev`
   - Vite/other server binds to port (e.g., 3000)
   - WebContainer emits 'port' event

2. **URL Generation:**
   - WebContainer creates unique subdomain
   - Format: `https://{random-id}.local-corp.webcontainer-api.io/`
   - URL is accessible from iframe

3. **Preview Display:**
   - UI creates iframe with preview URL
   - Live reload works automatically
   - HMR (Hot Module Replacement) supported

---

### Phase 10: Terminal System

**File:** `app/lib/stores/terminal.ts`

**TerminalStore:**

```typescript
class TerminalStore {
  #webcontainer: Promise<WebContainer>
  #terminals: Array<{ terminal: ITerminal; process: WebContainerProcess }>
  showTerminal: WritableAtom<boolean>
  
  async attachTerminal(terminal: ITerminal) {
    const shellProcess = await newShellProcess(await this.#webcontainer, terminal);
    this.#terminals.push({ terminal, process: shellProcess });
  }
  
  onTerminalResize(cols: number, rows: number) {
    for (const { process } of this.#terminals) {
      process.resize({ cols, rows });
    }
  }
}
```

**Terminal Features:**

1. **Interactive Shell:**
   - Spawns jsh (zsh emulation)
   - Full terminal emulation via xterm.js
   - Command history, tab completion

2. **Multiple Terminals:**
   - Support for multiple terminal instances
   - Each has independent shell process
   - Synchronized resize events

3. **Shell Process:**
   ```typescript
   async function newShellProcess(webcontainer: WebContainer, terminal: ITerminal) {
     const process = await webcontainer.spawn('jsh');
     
     process.output.pipeTo(
       new WritableStream({
         write(data) {
           terminal.write(data);
         },
       })
     );
     
     return process;
   }
   ```

---

## Data Flow Diagram

```
┌─────────────────────────────────────────────────────────────────────────┐
│                          1. USER INPUT LAYER                            │
│                                                                         │
│  ┌──────────────────────────────────────────────────────────────────┐  │
│  │  Chat.client.tsx                                                 │  │
│  │  • Text prompt input                                             │  │
│  │  • File attachments (images/code)                                │  │
│  │  • File modification tracking                                    │  │
│  │  • Auto-save before send                                         │  │
│  └──────────────────────────────────────────────────────────────────┘  │
└────────────────────────────────┬────────────────────────────────────────┘
                                 │
                                 ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                          2. API ROUTE LAYER                             │
│                                                                         │
│  ┌──────────────────────────────────────────────────────────────────┐  │
│  │  POST /api/chat                                                  │  │
│  │  • Receives messages array                                       │  │
│  │  • Creates SwitchableStream                                      │  │
│  │  • Handles streaming response                                    │  │
│  │  • Auto-continuation on token limit                              │  │
│  └──────────────────────────────────────────────────────────────────┘  │
└────────────────────────────────┬────────────────────────────────────────┘
                                 │
                                 ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                        3. LLM PROCESSING LAYER                          │
│                                                                         │
│  ┌──────────────────────────────────────────────────────────────────┐  │
│  │  Anthropic Claude 3.5 Sonnet                                     │  │
│  │  • System prompt injection                                       │  │
│  │  • Streaming response generation                                 │  │
│  │  • Structured artifact output                                    │  │
│  │  • <boltArtifact> + <boltAction> format                          │  │
│  └──────────────────────────────────────────────────────────────────┘  │
└────────────────────────────────┬────────────────────────────────────────┘
                                 │
                                 ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                       4. PARSING & CALLBACK LAYER                       │
│                                                                         │
│  ┌──────────────────────────────────────────────────────────────────┐  │
│  │  StreamingMessageParser                                          │  │
│  │  • Incremental tag detection                                     │  │
│  │  • Attribute extraction                                          │  │
│  │  • Content accumulation                                          │  │
│  │  • Callback triggering:                                          │  │
│  │    - onArtifactOpen                                              │  │
│  │    - onActionOpen                                                │  │
│  │    - onActionClose                                               │  │
│  └──────────────────────────────────────────────────────────────────┘  │
└────────────────────────────────┬────────────────────────────────────────┘
                                 │
                                 ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                      5. STATE MANAGEMENT LAYER                          │
│                                                                         │
│  ┌──────────────────────────────────────────────────────────────────┐  │
│  │  WorkbenchStore                                                  │  │
│  │  ├─ addArtifact() → Create artifact with ActionRunner           │  │
│  │  ├─ addAction() → Queue action in runner                        │  │
│  │  ├─ runAction() → Execute action sequentially                   │  │
│  │  │                                                               │  │
│  │  ├─ FilesStore → File system management                         │  │
│  │  ├─ EditorStore → Code editor state                             │  │
│  │  ├─ PreviewsStore → Dev server previews                         │  │
│  │  └─ TerminalStore → Terminal instances                          │  │
│  └──────────────────────────────────────────────────────────────────┘  │
└────────────────────────────────┬────────────────────────────────────────┘
                                 │
                                 ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                      6. ACTION EXECUTION LAYER                          │
│                                                                         │
│  ┌──────────────────────────────────────────────────────────────────┐  │
│  │  ActionRunner                                                    │  │
│  │  ├─ File Actions                                                 │  │
│  │  │   • Create directories                                        │  │
│  │  │   • Write file content                                        │  │
│  │  │   • Update FilesStore                                         │  │
│  │  │                                                               │  │
│  │  └─ Shell Actions                                                │  │
│  │      • Spawn jsh process                                         │  │
│  │      • Execute command                                           │  │
│  │      • Stream output                                             │  │
│  │      • Wait for exit code                                        │  │
│  └──────────────────────────────────────────────────────────────────┘  │
└────────────────────────────────┬────────────────────────────────────────┘
                                 │
                                 ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                       7. WEBCONTAINER LAYER                             │
│                                                                         │
│  ┌──────────────────────────────────────────────────────────────────┐  │
│  │  WebContainer (WASM-based Node.js)                               │  │
│  │  ├─ Virtual Filesystem (IndexedDB)                               │  │
│  │  │   • mkdir, writeFile, readFile                                │  │
│  │  │   • File watching                                             │  │
│  │  │                                                               │  │
│  │  ├─ Process Execution                                            │  │
│  │  │   • npm install                                               │  │
│  │  │   • npm run dev                                               │  │
│  │  │   • node scripts                                              │  │
│  │  │                                                               │  │
│  │  └─ Network Stack                                                │  │
│  │      • Port forwarding                                           │  │
│  │      • Dev server URLs                                           │  │
│  │      • WebSocket support                                         │  │
│  └──────────────────────────────────────────────────────────────────┘  │
└────────────────────────────────┬────────────────────────────────────────┘
                                 │
                                 ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                          8. UI UPDATE LAYER                             │
│                                                                         │
│  ┌──────────────────────────────────────────────────────────────────┐  │
│  │  React Components (Nanostores)                                   │  │
│  │  ├─ File Tree                                                    │  │
│  │  │   • Shows virtual filesystem                                  │  │
│  │  │   • Real-time updates                                         │  │
│  │  │                                                               │  │
│  │  ├─ Code Editor (CodeMirror)                                     │  │
│  │  │   • Syntax highlighting                                       │  │
│  │  │   • Auto-save                                                 │  │
│  │  │   • Modification tracking                                     │  │
│  │  │                                                               │  │
│  │  ├─ Preview Panel (iframe)                                       │  │
│  │  │   • Live app preview                                          │  │
│  │  │   • Hot module reload                                         │  │
│  │  │   • Multiple ports support                                    │  │
│  │  │                                                               │  │
│  │  └─ Terminal (xterm.js)                                          │  │
│  │      • Interactive shell                                         │  │
│  │      • Command execution                                         │  │
│  │      • Multiple terminals                                        │  │
│  └──────────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Key Design Patterns

### 1. Streaming Architecture

**Pattern:** Incremental processing of streaming responses

**Benefits:**
- Faster perceived performance
- Progressive UI updates
- Early action execution

**Implementation:**
```typescript
// Parser processes chunks as they arrive
for await (const chunk of stream) {
  const parsed = parser.parse(messageId, chunk);
  // Triggers callbacks immediately when tags detected
}
```

### 2. Sequential Action Execution

**Pattern:** Promise chaining for ordered execution

**Benefits:**
- Prevents race conditions
- Ensures correct order (files before commands)
- Predictable state management

**Implementation:**
```typescript
class ActionRunner {
  #currentExecutionPromise: Promise<void> = Promise.resolve();
  
  runAction(data: ActionCallbackData) {
    this.#currentExecutionPromise = this.#currentExecutionPromise
      .then(() => this.#executeAction(actionId))
      .catch((error) => console.error('Action failed:', error));
  }
}
```

### 3. Reactive State Management

**Pattern:** Nanostores for lightweight reactivity

**Benefits:**
- Minimal bundle size
- Automatic React re-renders
- Hot module reload support

**Implementation:**
```typescript
// Create store
const files = map<FileMap>({});

// Update store
files.setKey('/path/to/file', { type: 'file', content: '...' });

// React hook
const fileMap = useStore(files);
```

### 4. WebContainer Singleton

**Pattern:** Single WebContainer instance shared across stores

**Benefits:**
- Consistent state
- Efficient resource usage
- Simplified initialization

**Implementation:**
```typescript
// Single instance
export let webcontainer: Promise<WebContainer> = WebContainer.boot();

// Shared across stores
class FilesStore {
  constructor(webcontainerPromise: Promise<WebContainer>) {
    this.#webcontainer = webcontainerPromise;
  }
}
```

### 5. Event-Driven Architecture

**Pattern:** WebContainer events drive UI updates

**Benefits:**
- Decoupled components
- Real-time updates
- Scalable architecture

**Implementation:**
```typescript
// Port events
webcontainer.on('port', (port, type, url) => {
  if (type === 'open') {
    // Update preview store
  }
});

// File watch events
for await (const events of watcher) {
  // Update files store
}
```

---

## Performance Optimizations

### 1. File Watching Buffering

**Problem:** Excessive filesystem events cause UI thrashing

**Solution:** Buffer and batch events

```typescript
async function* bufferWatchEvents(watcher: AsyncIterable<PathWatcherEvent[]>) {
  const BUFFER_TIME = 100; // ms
  let buffer: PathWatcherEvent[] = [];
  let timeout: NodeJS.Timeout;
  
  for await (const events of watcher) {
    buffer.push(...events);
    clearTimeout(timeout);
    
    timeout = setTimeout(() => {
      yield buffer;
      buffer = [];
    }, BUFFER_TIME);
  }
}
```

### 2. Lazy Loading

**Problem:** Large initial bundle size

**Solution:** Code splitting and lazy imports

```typescript
// WebContainer only loads in browser
if (!import.meta.env.SSR) {
  webcontainer = WebContainer.boot();
}

// Components load on-demand
const Chat = lazy(() => import('./Chat.client'));
```

### 3. Streaming Parsing

**Problem:** Waiting for full response delays execution

**Solution:** Parse and execute incrementally

```typescript
// Start executing as soon as actions are parsed
parse(messageId, chunk) {
  // Detect closing tag
  if (closeIndex !== -1) {
    // Trigger callback immediately
    this._options.callbacks?.onActionClose(data);
  }
}
```

### 4. Hot Module Reload Persistence

**Problem:** Losing state during development

**Solution:** Persist stores across reloads

```typescript
// Preserve state
if (import.meta.hot) {
  import.meta.hot.data.files = this.files;
  import.meta.hot.data.webcontainer = webcontainer;
}
```

### 5. Image Compression

**Problem:** Large images consume tokens

**Solution:** Compress before sending to LLM

```typescript
const compressImage = async (file: File): Promise<string> => {
  const MAX_WIDTH = 800;
  const MAX_HEIGHT = 800;
  const QUALITY = 0.7;
  
  // Resize and compress to JPEG
  return canvas.toDataURL('image/jpeg', QUALITY);
};
```

---

## Error Handling

### 1. Action Failures

**Shell Command Errors:**
```typescript
const exitCode = await process.exit;

if (exitCode !== 0) {
  logger.error(`Shell command failed with code ${exitCode}: ${action.content}`);
  throw new Error(`Command failed with exit code ${exitCode}`);
}
```

**File Operation Errors:**
```typescript
try {
  await webcontainer.fs.writeFile(relativePath, content);
} catch (error) {
  logger.error('Failed to write file\n\n', error);
  throw error;
}
```

### 2. LLM Errors

**API Failures:**
```typescript
const { messages, isLoading, error } = useChat({
  api: '/api/chat',
  onError: (error) => {
    logger.error('Request failed\n\n', error);
    toast.error('There was an error processing your request');
  },
});
```

**Token Limit Handling:**
```typescript
onFinish: async ({ text: content, finishReason }) => {
  if (finishReason === 'length') {
    // Auto-continue with CONTINUE_PROMPT
    messages.push({ role: 'assistant', content });
    messages.push({ role: 'user', content: CONTINUE_PROMPT });
    const result = await streamText(messages, env, options);
    return stream.switchSource(result.toAIStream());
  }
}
```

### 3. WebContainer Errors

**Boot Failures:**
```typescript
try {
  const webcontainer = await WebContainer.boot();
} catch (error) {
  console.error('Failed to boot WebContainer:', error);
  // Show error UI
}
```

**Terminal Spawn Failures:**
```typescript
try {
  const shellProcess = await newShellProcess(webcontainer, terminal);
} catch (error: any) {
  terminal.write(coloredText.red('Failed to spawn shell\n\n') + error.message);
}
```

### 4. User Feedback

**Toast Notifications:**
```typescript
import { toast } from 'react-toastify';

// Success
toast.success('File saved successfully');

// Error
toast.error('Failed to save file');

// Info
toast.info('Building project...');
```

**Loading States:**
```typescript
const [isLoading, setIsLoading] = useState(false);

// Show spinner during operations
{isLoading && <Spinner />}
```

---

## Security Considerations

### 1. Content Security Policy (CSP)

**Required for WebContainer:**

```typescript
// app/entry.server.tsx
responseHeaders.set('Cross-Origin-Embedder-Policy', 'require-corp');
responseHeaders.set('Cross-Origin-Opener-Policy', 'same-origin');
```

**Why Needed:**
- WebContainer requires SharedArrayBuffer
- COOP/COEP headers enable cross-origin isolation
- Allows WASM execution in browser

### 2. Browser Sandboxing

**WebContainer Limitations:**
- Runs in browser sandbox
- No access to user's filesystem
- Cannot execute native binaries
- No network access outside WebContainer

**Benefits:**
- Safe code execution
- No server-side risks
- User data stays local

### 3. API Key Management

**Server-Side Only:**
```typescript
// Keys stored in Cloudflare env
const apiKey = getAPIKey(env);

// Never exposed to client
export function streamText(messages: Messages, env: Env) {
  return _streamText({
    model: getAnthropicModel(getAPIKey(env)),
    // ...
  });
}
```

### 4. Input Validation

**File Path Validation:**
```typescript
const relativePath = nodePath.relative(webcontainer.workdir, filePath);

if (!relativePath) {
  throw new Error(`EINVAL: invalid file path, write '${relativePath}'`);
}
```

**Content Sanitization:**
```typescript
// Markdown rendering with allowed tags only
const allowedHTMLElements = ['p', 'strong', 'em', 'code', 'pre', 'a'];
```

---

## Summary

### What Happens When You Give a Prompt

**Step-by-Step:**

1. **You type:** "Build a todo app with React and TypeScript"

2. **System prepares:**
   - Auto-saves any unsaved files
   - Collects file modifications as diffs
   - Processes any attached files

3. **API call:**
   - Sends message to `/api/chat`
   - Includes conversation history
   - Streams response back

4. **LLM generates:**
   ```xml
   <boltArtifact id="todo-app" title="React Todo App">
     <boltAction type="file" filePath="package.json">
       { "dependencies": { "react": "^18.2.0", ... } }
     </boltAction>
     <boltAction type="file" filePath="src/App.tsx">
       import React from 'react'; ...
     </boltAction>
     <boltAction type="shell">
       npm install && npm run dev
     </boltAction>
   </boltArtifact>
   ```

5. **Parser extracts:**
   - Artifact metadata (id, title)
   - File actions (package.json, App.tsx, etc.)
   - Shell actions (npm install, npm run dev)

6. **ActionRunner executes:**
   - Creates directories
   - Writes files to WebContainer
   - Runs npm install
   - Starts dev server

7. **WebContainer processes:**
   - Installs dependencies
   - Starts Vite dev server
   - Binds to port 3000
   - Emits port event

8. **UI updates:**
   - File tree shows new files
   - Code editor opens App.tsx
   - Preview shows live app
   - Terminal available for commands

9. **You can:**
   - Edit files in CodeMirror
   - See live updates in preview
   - Run commands in terminal
   - Continue conversation with AI

**The Magic:**
- Everything runs in your browser
- No backend servers needed
- No VMs or containers
- Just WebAssembly + AI

---

## Key Takeaways

1. **Fully Browser-Based:**
   - WebContainer provides Node.js runtime in browser
   - No cloud infrastructure required
   - Instant execution

2. **Streaming Architecture:**
   - LLM responses stream in real-time
   - Actions execute as soon as parsed
   - Progressive UI updates

3. **Sequential Execution:**
   - Actions run in order
   - Files created before commands
   - Predictable state management

4. **Reactive State:**
   - Nanostores for lightweight reactivity
   - Automatic UI updates
   - Hot module reload support

5. **Event-Driven:**
   - WebContainer events drive updates
   - File watching for real-time sync
   - Port events for preview management

6. **Safe Execution:**
   - Browser sandbox isolation
   - No native binary execution
   - Server-side API key management

---

## File Structure Reference

```
app/
├── routes/
│   ├── _index.tsx              # Homepage route
│   ├── api.chat.ts             # Chat API endpoint
│   └── api.enhancer.ts         # Prompt enhancer endpoint
│
├── components/
│   └── chat/
│       ├── Chat.client.tsx     # Main chat component
│       └── BaseChat.tsx        # Chat UI base
│
├── lib/
│   ├── .server/
│   │   └── llm/
│   │       ├── stream-text.ts  # LLM streaming
│   │       └── prompts.ts      # System prompts
│   │
│   ├── runtime/
│   │   ├── action-runner.ts    # Action execution
│   │   └── message-parser.ts   # Response parsing
│   │
│   ├── stores/
│   │   ├── workbench.ts        # Main store
│   │   ├── files.ts            # File system
│   │   ├── editor.ts           # Code editor
│   │   ├── previews.ts         # Dev servers
│   │   └── terminal.ts         # Terminal
│   │
│   ├── hooks/
│   │   └── useMessageParser.ts # Parser hook
│   │
│   └── webcontainer/
│       └── index.ts            # WebContainer init
│
└── entry.server.tsx            # Server entry (CSP)
```

---

## Conclusion

Bolt.new represents a paradigm shift in web development tools by bringing the entire development environment into the browser. By combining:

- **AI-powered code generation** (Claude)
- **In-browser execution** (WebContainer)
- **Real-time streaming** (SSE)
- **Reactive state management** (Nanostores)

It creates a seamless experience where you can go from idea to working application in seconds, all without leaving your browser.

The architecture is carefully designed to handle:
- Streaming responses efficiently
- Sequential action execution reliably
- Real-time file system updates
- Live preview management
- Interactive terminal access

All while maintaining security through browser sandboxing and keeping the user experience smooth through performance optimizations.

**The result:** A powerful, fast, and safe development environment that runs entirely in your browser. 🚀
