export type NodeType =
  | 'textNode'
  | 'imageUploadNode'
  | 'videoUploadNode'
  | 'llmNode'
  | 'cropImageNode'
  | 'extractFrameNode';

export interface WorkflowNodeData extends Record<string, unknown> {
  label: string;
  isExecuting?: boolean;
  output?: string;  // For LLM node results
}

// --- Add these below ---

export type ExecutionStatus = 'pending' | 'running' | 'success' | 'failed';

export interface NodeExecutionDetail {
  nodeId: string;
  label: string;
  status: ExecutionStatus;
  duration?: string;   // e.g. "1.2s"
  outputData?: {
    text?: string;
    imageUrl?: string;
    videoUrl?: string;
  };
}

export interface WorkflowRun {
  id: string;
  runNumber: number;
  status: ExecutionStatus;
  startedAt: string;   // human readable e.g. "2:42 PM"
  nodes: NodeExecutionDetail[];
}