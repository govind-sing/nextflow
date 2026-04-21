import { Node, Edge } from '@xyflow/react';
import { WorkflowNodeData } from '@/types/workflow';

export interface ValidationResult {
  isValid: boolean;
  error?: string;
  executionOrder?: string[][];  // groups of parallel node ids
}

export function validateAndSortDAG(
  nodes: Node<WorkflowNodeData>[],
  edges: Edge[]
): ValidationResult {

  // 1. Need at least one node
  if (nodes.length === 0) {
    return { isValid: false, error: 'Add at least one node to run.' };
  }

  // 2. Build adjacency map: nodeId → [children nodeIds]
  const children: Record<string, string[]> = {};
  const inDegree: Record<string, number> = {};  // how many edges point INTO this node

  nodes.forEach((n) => {
    children[n.id] = [];
    inDegree[n.id] = 0;
  });

  edges.forEach((e) => {
    if (children[e.source]) {
      children[e.source].push(e.target);
      inDegree[e.target] = (inDegree[e.target] || 0) + 1;
    }
  });

  // 3. Topological sort using Kahn's Algorithm
  // Start with nodes that have no incoming edges (no dependencies)
  const queue: string[] = nodes
    .filter((n) => inDegree[n.id] === 0)
    .map((n) => n.id);

  const executionOrder: string[][] = [];  // each group runs in parallel
  let visited = 0;

  while (queue.length > 0) {
    // All nodes in current queue can run in PARALLEL
    executionOrder.push([...queue]);
    visited += queue.length;

    const nextQueue: string[] = [];

    queue.forEach((nodeId) => {
      children[nodeId].forEach((childId) => {
        inDegree[childId]--;
        // If all dependencies are resolved, add to next parallel group
        if (inDegree[childId] === 0) {
          nextQueue.push(childId);
        }
      });
    });

    queue.length = 0;
    queue.push(...nextQueue);
  }

  // 4. Cycle detection — if visited !== total nodes, there's a cycle
  if (visited !== nodes.length) {
    return { isValid: false, error: 'Cycle detected — workflow has a loop.' };
  }

  return { isValid: true, executionOrder };
}