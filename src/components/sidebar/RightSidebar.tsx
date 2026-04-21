'use client';

import { useState } from 'react';
import { useWorkflowStore } from '@/store/workflowStore';
import { WorkflowRun, ExecutionStatus, NodeExecutionDetail } from '@/types/workflow';

const STATUS_CONFIG: Record<ExecutionStatus, {
  label: string; color: string; dot: string; border: string;
}> = {
  pending: { label: 'Pending', color: 'text-gray-500',   dot: 'bg-gray-500',   border: '#4b5563' },
  running: { label: 'Running', color: 'text-yellow-400', dot: 'bg-yellow-400', border: '#facc15' },
  success: { label: 'Success', color: 'text-emerald-400',dot: 'bg-emerald-400',border: '#10b981' },
  failed:  { label: 'Failed',  color: 'text-red-400',    dot: 'bg-red-400',    border: '#ef4444' },
};

function StatusDot({ status }: { status: ExecutionStatus }) {
  const config = STATUS_CONFIG[status];
  return (
    <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${config.dot}
                    ${status === 'running' ? 'animate-pulse' : ''}`} />
  );
}

function StatusBadge({ status }: { status: ExecutionStatus }) {
  const config = STATUS_CONFIG[status];
  return (
    <div className={`flex items-center gap-1 text-[10px] ${config.color}`}>
      <StatusDot status={status} />
      {config.label}
    </div>
  );
}

function OutputPanel({ nodes }: { nodes: NodeExecutionDetail[] }) {
  const [expandedNodeId, setExpandedNodeId] = useState<string | null>(null);
  const successNodes = nodes.filter(
    (n) => n.status === 'success' && n.outputData
  );

  if (successNodes.length === 0) return null;

  return (
    <div className="flex flex-col gap-2">
      <p className="text-[10px] uppercase tracking-widest text-gray-600 px-3 pt-3">
        Outputs
      </p>
      {successNodes.map((node) => (
        <div key={node.nodeId}
             className="mx-3 rounded-lg bg-[#0d0d0d] border border-white/5 overflow-hidden">
          {/* Output header */}
          <div className="px-2 py-1.5 border-b border-white/5 flex items-center gap-1.5">
            <StatusDot status="success" />
            <span className="text-[10px] text-gray-400 font-medium">
              {node.label}
            </span>
            {node.duration && (
              <span className="text-[10px] text-gray-600 ml-auto">
                {node.duration}
              </span>
            )}
          </div>

          {/* Text output */}
          {node.outputData?.text && (
            <div 
              onClick={() => setExpandedNodeId(expandedNodeId === node.nodeId ? null : node.nodeId)}
              className={`p-2 cursor-pointer hover:bg-[#141414] transition-colors
                          ${expandedNodeId === node.nodeId ? 'max-h-96' : 'max-h-24'} overflow-y-auto`}
            >
              <p className="text-[11px] text-gray-300 leading-relaxed whitespace-pre-wrap">
                {node.outputData.text}
              </p>
              {node.outputData.text.length > 200 && (
                <p className="text-[10px] text-gray-600 mt-1">
                  {expandedNodeId === node.nodeId ? '▲ Click to collapse' : '▼ Click to expand'}
                </p>
              )}
            </div>
          )}

          {/* Image output */}
          {node.outputData?.imageUrl && (
            <img
              src={node.outputData.imageUrl}
              alt="output"
              className="w-full object-cover max-h-40 cursor-pointer hover:opacity-90 transition-opacity"
              onClick={() => window.open(node.outputData!.imageUrl, '_blank')}
              title="Click to open in new tab"
            />
          )}
        </div>
      ))}
    </div>
  );
}

function RunCard({
  run,
  isSelected,
  onClick,
}: {
  run: WorkflowRun;
  isSelected: boolean;
  onClick: () => void;
}) {
  const borderColor = STATUS_CONFIG[run.status]?.border || '#4b5563';

  return (
    <div
      onClick={onClick}
      className="mx-3 rounded-xl overflow-hidden cursor-pointer
                 bg-[#141414] border border-white/5
                 hover:border-white/10 transition-all"
      style={{ borderLeft: `3px solid ${borderColor}` }}
    >
      {/* Run header */}
      <div className="flex items-center justify-between px-3 py-2.5">
        <div>
          <p className="text-white text-xs font-semibold">
            Run #{run.runNumber}
          </p>
          <p className="text-gray-600 text-[10px] mt-0.5">
            {run.startedAt}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <StatusBadge status={run.status} />
          <span className="text-gray-600 text-[10px]">
            {isSelected ? '▲' : '▼'}
          </span>
        </div>
      </div>

      {/* Expanded node list */}
      {isSelected && run.nodes.length > 0 && (
        <div className="border-t border-white/5 px-3 py-2 flex flex-col gap-1.5">
          {run.nodes.map((node) => (
            <div key={node.nodeId}
                 className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-1.5 min-w-0">
                <StatusDot status={node.status} />
                <span className="text-[11px] text-gray-400 truncate">
                  {node.label}
                </span>
              </div>
              <div className="flex items-center gap-1.5 flex-shrink-0">
                {node.duration && (
                  <span className="text-[10px] text-gray-600">
                    {node.duration}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function RightSidebar() {
  const runs = useWorkflowStore((state) => state.runs);
  const [selectedRunId, setSelectedRunId] = useState<string | null>(null);

  const selectedRun = runs.find((r) => r.id === selectedRunId);

  const handleSelectRun = (runId: string) => {
    setSelectedRunId((prev) => prev === runId ? null : runId);
  };

  return (
    <aside className="w-72 h-full bg-[#0f0f0f] border-l border-white/5
                      flex flex-col overflow-hidden">

      {/* Top half — History */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <div className="px-3 py-3 border-b border-white/5 flex-shrink-0">
          <p className="text-[11px] uppercase tracking-widest text-gray-500 font-medium">
            Workflow History
          </p>
          <p className="text-gray-600 text-[10px] mt-0.5">
            {runs.length} run{runs.length !== 1 ? 's' : ''}
          </p>
        </div>

        {/* Run list */}
        <div className="overflow-y-auto flex flex-col gap-2 py-2"
             style={{ maxHeight: selectedRun ? '45%' : '100%' }}>
          {runs.length === 0 ? (
            <div className="flex flex-col items-center justify-center
                            h-32 gap-2">
              <p className="text-3xl">⏳</p>
              <p className="text-gray-600 text-[11px] text-center px-4">
                No runs yet. Add nodes and hit Run.
              </p>
            </div>
          ) : (
            runs.map((run) => (
              <RunCard
                key={run.id}
                run={run}
                isSelected={selectedRunId === run.id}
                onClick={() => handleSelectRun(run.id)}
              />
            ))
          )}
        </div>
      </div>

      {/* Bottom half — Output Panel */}
      {selectedRun && (
        <div className="border-t border-white/5 overflow-y-auto"
             style={{ maxHeight: '55%' }}>
          <div className="flex items-center justify-between px-3 pt-3 pb-1">
            <p className="text-[11px] uppercase tracking-widest text-gray-500 font-medium">
              Run #{selectedRun.runNumber} Output
            </p>
            <button
              onClick={() => setSelectedRunId(null)}
              className="text-gray-600 hover:text-gray-400 text-xs cursor-pointer"
            >
              ✕
            </button>
          </div>

          {selectedRun.status === 'running' ? (
            <div className="flex items-center gap-2 px-3 py-4">
              <div className="w-2 h-2 bg-yellow-400 rounded-full animate-pulse"/>
              <p className="text-[11px] text-gray-500">
                Executing... results will appear here
              </p>
            </div>
          ) : selectedRun.nodes.every(
              (n) => !n.outputData?.text && !n.outputData?.imageUrl
            ) ? (
            <p className="text-[11px] text-gray-600 px-3 py-4">
              No output data available.
            </p>
          ) : (
            <OutputPanel nodes={selectedRun.nodes} />
          )}

          <div className="h-3" />
        </div>
      )}
    </aside>
  );
}