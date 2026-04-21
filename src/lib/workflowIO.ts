import { Node, Edge } from '@xyflow/react';
import { WorkflowNodeData } from '@/types/workflow';

export interface WorkflowJSON {
  version:   string;
  name:      string;
  exportedAt: string;
  nodes:     Node<WorkflowNodeData>[];
  edges:     Edge[];
}

// Export current canvas to JSON file
export function exportWorkflow(
  nodes: Node<WorkflowNodeData>[],
  edges: Edge[],
  name:  string = 'My Workflow'
): void {
  const data: WorkflowJSON = {
    version:    '1.0',
    name,
    exportedAt: new Date().toISOString(),
    nodes,
    edges,
  };

  const blob = new Blob(
    [JSON.stringify(data, null, 2)],
    { type: 'application/json' }
  );

  const url = URL.createObjectURL(blob);
  const a   = document.createElement('a');
  a.href     = url;
  a.download = `${name.replace(/\s+/g, '-').toLowerCase()}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

// Import workflow from JSON file
export function importWorkflow(file: File): Promise<WorkflowJSON> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = JSON.parse(e.target?.result as string);
        // Basic validation
        if (!data.nodes || !data.edges) {
          reject(new Error('Invalid workflow file'));
          return;
        }
        resolve(data);
      } catch {
        reject(new Error('Failed to parse workflow file'));
      }
    };
    reader.readAsText(file);
  });
}