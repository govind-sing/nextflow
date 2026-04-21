# NextFlow - AI-Powered Workflow Builder

A full-stack web application for building, visualizing, and executing AI-powered workflows with support for text processing, image manipulation, video analysis, and LLM integration.

## Overview

NextFlow is a visual workflow builder that allows users to:
- Create complex automation workflows using a drag-and-drop canvas interface
- Chain multiple operations: text processing, image cropping, video frame extraction, and LLM calls
- Execute workflows asynchronously with real-time status tracking
- Store and manage workflow definitions in a PostgreSQL database
- Integrate with Google Gemini API for AI-powered text and vision capabilities

## Tech Stack

### Frontend
- **Next.js 16.2.4** - Full-stack React framework
- **React 18.3.1** - UI library
- **React Flow 12.10.2** - Graph-based workflow visualization
- **Tailwind CSS** - Utility-first CSS framework
- **Zustand 5.0.12** - State management
- **Uppy 5.x** - File upload handling with Transloadit support

### Backend & Services
- **Next.js API Routes** - Serverless API endpoints
- **Prisma 6.19.3** - ORM for database management
- **PostgreSQL (Neon)** - Cloud database
- **Trigger.dev v4.4.4** - Background task queue and execution engine

### AI & Processing
- **Google Generative AI (Gemini)** - LLM API for text and vision tasks
- **FFmpeg** - Video frame extraction and processing
- **Sharp** - Image processing library

### Authentication & Validation
- **Clerk** - User authentication and management
- **Zod 4.3.6** - TypeScript-first schema validation

## Features

### Core Workflow Nodes
1. **Text Node** - Static text input and display
2. **Image Upload Node** - Upload and process images
3. **Video Upload Node** - Upload video files
4. **Crop Image Node** - Crop images by percentage coordinates
5. **Extract Frame Node** - Extract frames from videos at specific timestamps
6. **LLM Node** - Call Gemini API with text or vision capabilities

### Workflow Management
- Visual canvas editor with drag-and-drop interface
- Node connection validation
- DAG (Directed Acyclic Graph) validation
- Workflow execution with real-time status tracking
- Node output persistence to database

### API Endpoints
- **`POST /api/workflow/run`** - Authenticated endpoint to trigger workflows
- **`GET /api/workflow/run/[runId]`** - Get workflow execution results
- **`POST /api/workflow/webhook`** - Public webhook for external task triggering

## Project Structure

```
nextflow/
├── src/
│   ├── app/
│   │   ├── layout.tsx              # Root layout with Clerk provider
│   │   ├── page.tsx                # Home (redirects to /editor)
│   │   ├── editor/
│   │   │   └── page.tsx            # Main workflow editor
│   │   ├── sign-in/
│   │   │   └── [[...sign-in]]/
│   │   │       └── page.tsx        # Clerk sign-in page
│   │   ├── sign-up/
│   │   │   └── [[...sign-up]]/
│   │   │       └── page.tsx        # Clerk sign-up page
│   │   └── api/
│   │       └── workflow/
│   │           ├── route.ts        # Workflow creation endpoint
│   │           ├── run/
│   │           │   ├── route.ts    # Workflow execution endpoint
│   │           │   └── [runId]/
│   │           │       └── route.ts # Get execution results
│   │           └── webhook/
│   │               └── route.ts    # Public webhook endpoint
│   ├── components/
│   │   ├── canvas/
│   │   │   └── WorkflowCanvas.tsx  # React Flow canvas component
│   │   ├── nodes/
│   │   │   ├── TextNode.tsx
│   │   │   ├── ImageUploadNode.tsx
│   │   │   ├── VideoUploadNode.tsx
│   │   │   ├── CropImageNode.tsx
│   │   │   ├── ExtractFrameNode.tsx
│   │   │   └── LLMNode.tsx
│   │   └── sidebar/
│   │       ├── LeftSidebar.tsx     # Node palette
│   │       └── RightSidebar.tsx    # Node settings
│   ├── lib/
│   │   ├── connectionValidator.ts  # Edge validation logic
│   │   ├── dagValidator.ts         # Workflow DAG validation
│   │   ├── prisma.ts               # Prisma client initialization
│   │   ├── workflowIO.ts           # Workflow import/export
│   │   ├── workflowRunner.ts       # Workflow execution logic
│   │   └── sampleWorkflow.ts       # Example workflows
│   ├── store/
│   │   └── workflowStore.ts        # Zustand state management
│   ├── trigger/
│   │   ├── cropImageTask.ts        # Crop image task
│   │   ├── extractFrameTask.ts     # Extract frame task
│   │   └── llmTask.ts              # LLM task
│   └── types/
│       └── workflow.ts             # TypeScript interfaces
├── prisma/
│   └── schema.prisma               # Database schema
├── public/                         # Static assets
├── trigger.config.ts               # Trigger.dev configuration
├── next.config.ts                  # Next.js configuration
├── tsconfig.json                   # TypeScript configuration
└── package.json                    # Dependencies
```

## Getting Started

### Prerequisites
- Node.js 20+ (required by Next.js 16)
- npm or yarn
- PostgreSQL database (Neon recommended)
- Google Generative AI API key
- Clerk account and API keys

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/govind-sing/nextflow.git
   cd nextflow
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**
   Create `.env.local` with:
   ```env
   # Clerk Authentication
   NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=your_clerk_key
   CLERK_SECRET_KEY=your_clerk_secret

   # Database
   DATABASE_URL=postgresql://user:pass@host/dbname

   # Gemini AI
   GEMINI_API_KEY=your_gemini_key

   # Trigger.dev
   NEXT_PUBLIC_TRIGGER_API_URL=https://api.trigger.dev
   TRIGGER_SECRET_KEY=your_trigger_key

   # File Upload (Transloadit)
   NEXT_PUBLIC_TRANSLOADIT_KEY=your_transloadit_key
   TRANSLOADIT_SECRET=your_transloadit_secret
   ```

4. **Set up database**
   ```bash
   npx prisma migrate dev
   npx prisma generate
   ```

### Development

```bash
# Start development server
npm run dev

# In another terminal, start Trigger.dev worker
npx trigger.dev@latest dev

# Open http://localhost:3000 (redirects to /editor)
```

### Production Deployment

**Vercel (Frontend):**
```bash
git push origin main  # Auto-deploys on Vercel
```

**Trigger.dev Cloud (Background Tasks):**
```bash
npx trigger.dev@latest deploy --env prod
```

## Architecture

### Workflow Execution Flow
```
User creates workflow in editor
        ↓
Submit via /api/workflow/run
        ↓
Trigger.dev queues tasks
        ↓
Trigger.dev Cloud executes each node task
        ↓
Tasks update Prisma database
        ↓
Frontend queries database for results
        ↓
Display results in editor
```

### Node Types & Operations

**Text Node**: Stores static text
```typescript
Input: text string
Output: same text
```

**Image Upload Node**: Upload and store images
```typescript
Input: file upload
Output: image URL
```

**Crop Image Node** (Trigger.dev Task)
```typescript
Input: image URL, crop coordinates (%)
Output: cropped image URL
Process: Download → Crop with Sharp → Upload
```

**Extract Frame Node** (Trigger.dev Task)
```typescript
Input: video URL, timestamp/percentage
Output: frame image URL
Process: Download → FFmpeg extract → Upload
```

**LLM Node** (Trigger.dev Task)
```typescript
Input: text prompt, optional image URLs, model
Output: LLM response text
Process: Call Gemini API with images and text
```

## Database Schema

Key tables:
- **Workflow** - Workflow definitions (nodes + edges)
- **WorkflowRun** - Individual workflow executions
- **NodeExecution** - Individual node execution results
- **Node** - Workflow node definitions

## API Documentation

### Run Workflow (Authenticated)
```bash
POST /api/workflow/run
Authorization: Bearer <clerk_token>
Content-Type: application/json

{
  "workflowId": "workflow_123",
  "nodes": [...],
  "edges": [...]
}

Response: { "runId": "run_123" }
```

### Get Run Results
```bash
GET /api/workflow/run/run_123
Authorization: Bearer <clerk_token>

Response: { "status": "SUCCESS", "results": {...} }
```

### Webhook (Public)
```bash
POST /api/workflow/webhook
Content-Type: application/json

{
  "workflowId": "workflow_123",
  "nodes": [...],
  "edges": [...],
  "userId": "user_123"
}

Response: { "runId": "run_123" }
```

## Troubleshooting

**API key expired error:**
- Regenerate Gemini API key at [Google AI Studio](https://aistudio.google.com/app/apikey)
- Update `GEMINI_API_KEY` in `.env.local`

**Workflow execution fails:**
- Check Trigger.dev dashboard for task errors
- Verify `TRIGGER_SECRET_KEY` is set in both Vercel and local env
- Check database connectivity

**Node connections not working:**
- Validate node types against `connectionValidator.ts`
- Ensure source node output type matches target node input type

## Future Enhancements

- [ ] Support for more LLM providers (OpenAI, Anthropic)
- [ ] Custom node creation UI
- [ ] Workflow templates and library
- [ ] Scheduled workflow execution
- [ ] Webhook triggers
- [ ] More image/video operations
- [ ] Collaboration features
- [ ] Workflow versioning and rollback

## License

MIT

## Support

For issues or questions, please open a GitHub issue or contact the development team.
