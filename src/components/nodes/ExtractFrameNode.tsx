'use client';

import { Handle, Position, NodeProps } from '@xyflow/react';
import { WorkflowNodeData } from '@/types/workflow';
import { useWorkflowStore } from '@/store/workflowStore';

export default function ExtractFrameNode(props: NodeProps) {
  const data = (props.data ?? {}) as WorkflowNodeData;
  const id = props.id;
  const updateNodeData = useWorkflowStore((s) => s.updateNodeData);

  const isExecuting = Boolean(data.isExecuting);
  const timestamp = (data.timestamp as string) || '0';
  const outputUrl = data.outputUrl as string | undefined;

  return (
    <div className={`
      w-56 rounded-xl border-l-3 bg-[#141414] p-3
      transition-all duration-300
      ${isExecuting ? 'border-white/8 border shadow-lg shadow-yellow-600/20' : 'border border-white/8 border-l-yellow-500'}
    `}>
      {/* video_url handle */}
      <Handle
        type="target"
        position={Position.Top}
        id="video_url"
        className="bg-pink-500! w-2! h-2! border border-[#141414]!"
      />

      {/* Header */}
      <div className="flex items-center gap-2 mb-3">
        <div className="w-5 h-5 rounded-md bg-yellow-500
                        flex items-center justify-center text-xs">
          🎞
        </div>
        <span className="text-white text-xs font-semibold uppercase tracking-wide">Extract Frame</span>
      </div>

      {/* Timestamp input */}
      <div className="flex flex-col gap-1">
        <label className="text-[10px] text-gray-600 uppercase font-medium">
          Timestamp
        </label>
        <input
          type="text"
          placeholder='e.g. 5 or "50%"'
          defaultValue={timestamp}
          onChange={(e) => updateNodeData(id, { timestamp: e.target.value })}
          className="w-full bg-[#0d0d0d] text-gray-400 text-xs rounded-lg p-2
                     border border-white/6 outline-none
                     focus:border-yellow-500/50 transition-colors placeholder:text-gray-700"
        />
      </div>

      {/* Output preview */}
      {outputUrl && (
        <div className="mt-2">
          <img
            src={outputUrl}
            alt="extracted frame"
            className="w-full rounded-lg border border-white/6"
          />
        </div>
      )}

      {/* Output label */}
      <div className="flex flex-col gap-1 text-[10px] text-gray-600 px-0.5 mt-2">
        <span>extracted frame →</span>
      </div>

      <Handle
        type="source"
        position={Position.Bottom}
        id="image_url"
        className="bg-yellow-500! w-2! h-2! border border-[#141414]!"
      />
    </div>
  );
}