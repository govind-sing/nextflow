'use client';

import { Handle, Position, NodeProps } from '@xyflow/react';
import { WorkflowNodeData } from '@/types/workflow';
import { useWorkflowStore } from '@/store/workflowStore';

export default function TextNode(props: NodeProps) {
  const data = props.data as WorkflowNodeData;
  const { id } = props;
  const updateNodeData = useWorkflowStore((s) => s.updateNodeData);
  return (
    <div
      className={`
        w-56 rounded-xl border-l-3 bg-[#141414] p-3
        transition-all duration-300
        ${data.isExecuting
          ? 'border-white/8 border border-violet-500/50 shadow-lg shadow-violet-600/20'
          : 'border border-white/8 border-l-violet-600'
        }
      `}
    >
      {/* Input handle — top center */}
      <Handle
        type="target"
        position={Position.Top}
        className="bg-violet-500! w-2! h-2! border border-[#141414]!"
      />

      {/* Node header */}
      <div className="flex items-center gap-2 mb-3">
        <div className="w-5 h-5 rounded-md bg-violet-600 flex items-center justify-center text-[9px] font-bold">
          T
        </div>
        <span className="text-white text-xs font-semibold uppercase tracking-wide">Text</span>
      </div>

      {/* Text input area */}
      <textarea
        rows={3}
        defaultValue={(data.text as string) || ''}
        onChange={(e) => updateNodeData(id, { text: e.target.value })}
        placeholder="Enter your text..."
        className="w-full bg-[#0d0d0d] text-gray-400 text-xs rounded-lg p-2 
                   border border-white/6 resize-none outline-none
                   focus:border-violet-500/50 transition-colors placeholder:text-gray-700"
      />

      {/* Output handle — bottom center */}
      <Handle
        type="source"
        position={Position.Bottom}
        className="bg-violet-500! w-2! h-2! border border-[#141414]!"
      />
    </div>
  );
}