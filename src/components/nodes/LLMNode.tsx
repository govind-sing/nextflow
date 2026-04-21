'use client';

import { Handle, Position, NodeProps } from '@xyflow/react';
import { useEffect, useState } from 'react';
import { WorkflowNodeData } from '@/types/workflow';
import { useWorkflowStore } from '@/store/workflowStore';

const MODELS = [
  'gemini-2.5-flash',
  'gemini-2.5-pro',
  'gemini-2.0-flash',
];

export default function LLMNode(props: NodeProps) {
  const data = props.data as WorkflowNodeData;
  const { id } = props;
  const updateNodeData = useWorkflowStore((state) => state.updateNodeData);
  const [model, setModel] = useState(data.model || 'gemini-2.5-flash');
  const [expandedOutput, setExpandedOutput] = useState(false);

  useEffect(() => {
    if (data.model) {
      setModel(data.model);
    }
  }, [data.model]);

  const handleModelChange = (newModel: string) => {
    setModel(newModel);
    updateNodeData(id, { model: newModel });
  };

  return (
    <div className={`
      w-64 rounded-xl border-l-3 bg-[#141414] p-3
      transition-all duration-300
      ${data.isExecuting
        ? 'border-white/8 border border-emerald-500/50 shadow-lg shadow-emerald-600/20'
        : 'border border-white/8 border-l-emerald-600'}
    `}>

      {/* system_prompt handle */}
      <Handle
        type="target"
        position={Position.Left}
        id="system_prompt"
        style={{ top: '30%' }}
        className="bg-blue-500! w-2! h-2! border border-[#141414]!"
      />

      {/* user_message handle */}
      <Handle
        type="target"
        position={Position.Left}
        id="user_message"
        style={{ top: '55%' }}
        className="bg-violet-500! w-2! h-2! border border-[#141414]!"
      />

      {/* images handle */}
      <Handle
        type="target"
        position={Position.Left}
        id="images"
        style={{ top: '80%' }}
        className="bg-pink-500! w-2! h-2! border border-[#141414]!"
      />

      {/* Header */}
      <div className="flex items-center gap-2 mb-3">
        <div className="w-5 h-5 rounded-md bg-emerald-600 
                        flex items-center justify-center text-xs">
          🤖
        </div>
        <span className="text-white text-xs font-semibold uppercase tracking-wide">Run Any LLM</span>
      </div>

      {/* Model selector */}
      <select
        value={model}
        onChange={(e) => handleModelChange(e.target.value)}
        className="w-full bg-[#0d0d0d] text-gray-400 text-xs rounded-lg p-2
                   border border-white/6 outline-none mb-2
                   focus:border-emerald-500/50 transition-colors"
      >
        {MODELS.map((m) => (
          <option key={m} value={m}>{m}</option>
        ))}
      </select>

      {/* Handle labels */}
      <div className="flex flex-col gap-1 text-[10px] text-gray-600 px-0.5">
        <span>← system_prompt</span>
        <span>← user_message</span>
        <span>← images</span>
      </div>

      {/* Output display — shows after execution */}
      {data.output && (
        <div 
          onClick={() => setExpandedOutput(!expandedOutput)}
          className={`mt-2 p-2 bg-[#0d0d0d] rounded-lg border border-white/6 cursor-pointer 
                      hover:border-white/10 transition-all
                      ${expandedOutput ? 'max-h-64 overflow-y-auto' : ''}`}
        >
          <p className="text-[10px] text-gray-600 mb-1">Output:</p>
          <p className={`text-xs text-gray-400 ${!expandedOutput ? 'line-clamp-3' : ''} whitespace-pre-wrap`}>
            {data.output as string}
          </p>
          {typeof data.output === 'string' && data.output.length > 150 && (
            <p className="text-[9px] text-gray-600 mt-1">
              {expandedOutput ? '▲ Click to collapse' : '▼ Click to expand'}
            </p>
          )}
        </div>
      )}

      {/* Output handle */}
      <Handle
        type="source"
        position={Position.Right}
        id="output"
        className="bg-emerald-500! w-2! h-2! border border-[#141414]!"
      />
    </div>
  );
}
