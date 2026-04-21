import { create } from 'zustand';
import {
  Node, Edge, addEdge, Connection,
  applyNodeChanges, applyEdgeChanges,
  NodeChange, EdgeChange,
} from '@xyflow/react';
import {
  WorkflowNodeData, WorkflowRun,
  ExecutionStatus, NodeExecutionDetail,
} from '@/types/workflow';

interface HistoryEntry {
  nodes: Node<WorkflowNodeData>[];
  edges: Edge[];
}

interface WorkflowState {
  nodes:    Node<WorkflowNodeData>[];
  edges:    Edge[];
  runs:     WorkflowRun[];
  past:     HistoryEntry[];   // undo stack
  future:   HistoryEntry[];   // redo stack

  onNodesChange:  (changes: NodeChange[]) => void;
  onEdgesChange:  (changes: EdgeChange[]) => void;
  onConnect:      (connection: Connection) => void;
  addNode:        (node: Node<WorkflowNodeData>) => void;
  updateNodeData: (nodeId: string, data: Partial<WorkflowNodeData>) => void;
  loadWorkflow:   (nodes: Node<WorkflowNodeData>[], edges: Edge[]) => void;
  addRun:         (run: WorkflowRun) => void;
  updateRunStatus:(runId: string, status: ExecutionStatus) => void;
  updateRunNodes: (runId: string, nodes: NodeExecutionDetail[]) => void;
  undo:           () => void;
  redo:           () => void;
  snapshot:       () => void;  // save current state to past
}

export const useWorkflowStore = create<WorkflowState>((set, get) => ({
  nodes:   [],
  edges:   [],
  runs:    [],
  past:    [],
  future:  [],

  // Save current state to undo stack
  snapshot: () => {
    const { nodes, edges, past } = get();
    set({
      past:   [...past.slice(-20), { nodes, edges }], // keep last 20
      future: [],  // clear redo stack on new action
    });
  },

  undo: () => {
    const { past, nodes, edges, future } = get();
    if (past.length === 0) return;

    const previous = past[past.length - 1];
    set({
      past:    past.slice(0, -1),
      nodes:   previous.nodes,
      edges:   previous.edges,
      future:  [{ nodes, edges }, ...future],
    });
  },

  redo: () => {
    const { future, nodes, edges, past } = get();
    if (future.length === 0) return;

    const next = future[0];
    set({
      future:  future.slice(1),
      nodes:   next.nodes,
      edges:   next.edges,
      past:    [...past, { nodes, edges }],
    });
  },

  onNodesChange: (changes) =>
    set((state) => ({
      nodes: applyNodeChanges(
        changes, state.nodes
      ) as Node<WorkflowNodeData>[],
    })),

  onEdgesChange: (changes) =>
    set((state) => ({
      edges: applyEdgeChanges(changes, state.edges),
    })),

  onConnect: (connection) => {
    get().snapshot();  // ← snapshot before adding edge
    set((state) => ({
      edges: addEdge(
        { ...connection, animated: true, style: { stroke: '#8b5cf6' } },
        state.edges
      ),
    }));
  },

  addNode: (node) => {
    get().snapshot();  // ← snapshot before adding node
    set((state) => ({
      nodes: [
        ...state.nodes,
        {
          ...node,
          position: {
            x: 250 + state.nodes.length * 30,
            y: 150 + state.nodes.length * 30,
          },
        },
      ],
    }));
  },

  updateNodeData: (nodeId, newData) =>
    set((state) => ({
      nodes: state.nodes.map((n) =>
        n.id === nodeId
          ? { ...n, data: { ...n.data, ...newData } }
          : n
      ),
    })),

  loadWorkflow: (nodes, edges) => {
    get().snapshot();
    set({ nodes, edges, future: [] });
  },

  addRun: (run) =>
    set((state) => ({ runs: [run, ...state.runs] })),

  updateRunStatus: (runId, status) =>
    set((state) => ({
      runs: state.runs.map((r) =>
        r.id === runId ? { ...r, status } : r
      ),
    })),

  updateRunNodes: (runId, nodes) =>
    set((state) => ({
      runs: state.runs.map((r) =>
        r.id === runId ? { ...r, nodes } : r
      ),
    })),
}));