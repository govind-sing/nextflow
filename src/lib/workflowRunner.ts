import { Node, Edge } from '@xyflow/react';
import { WorkflowNodeData, WorkflowRun, NodeExecutionDetail } from '@/types/workflow';
import { validateAndSortDAG } from './dagValidator';

interface RunWorkflowParams {
  nodes: Node<WorkflowNodeData>[];
  edges: Edge[];
  runNumber: number;
  onRunCreated: (run: WorkflowRun) => void;
  onRunUpdated: (runId: string, updatedNodes: NodeExecutionDetail[]) => void;
  onRunFinished: (runId: string, status: 'success' | 'failed') => void;
}

export async function runWorkflow({
  nodes,
  edges,
  runNumber,
  onRunCreated,
  onRunUpdated,
  onRunFinished,
}: RunWorkflowParams) {

  // Step 1: Validate the DAG
  const validation = validateAndSortDAG(nodes, edges);
  if (!validation.isValid || !validation.executionOrder) {
    alert(validation.error);
    return;
  }

  const runId = crypto.randomUUID();

  // Step 2: Create initial run with all nodes as "pending"
  const initialNodeDetails: NodeExecutionDetail[] = nodes.map((n) => ({
    nodeId: n.id,
    label: n.data.label,
    status: 'pending',
  }));

  onRunCreated({
    id: runId,
    runNumber,
    status: 'running',
    startedAt: new Date().toLocaleTimeString(),
    nodes: initialNodeDetails,
  });

  // Step 3: Execute each parallel group sequentially
  let currentNodes = [...initialNodeDetails];
  let failed = false;

  for (const group of validation.executionOrder) {
    // Mark this group as "running"
    currentNodes = currentNodes.map((n) =>
      group.includes(n.nodeId) ? { ...n, status: 'running' } : n
    );
    onRunUpdated(runId, currentNodes);

    // Simulate async execution (replace with Trigger.dev later)
    await new Promise((res) => setTimeout(res, 1500));

    // Mark this group as "success" (or randomly fail for demo)
    const groupFailed = Math.random() < 0.15;  // 15% chance of failure
    currentNodes = currentNodes.map((n) =>
      group.includes(n.nodeId)
        ? {
            ...n,
            status: groupFailed ? 'failed' : 'success',
            duration: `${(Math.random() * 2 + 0.3).toFixed(1)}s`,
          }
        : n
    );
    onRunUpdated(runId, currentNodes);

    if (groupFailed) { failed = true; break; }
  }

  // Step 4: Mark overall run as done
  onRunFinished(runId, failed ? 'failed' : 'success');
}