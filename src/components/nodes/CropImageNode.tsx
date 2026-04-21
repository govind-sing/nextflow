'use client';

import { Handle, Position, NodeProps } from '@xyflow/react';
import { WorkflowNodeData } from '@/types/workflow';
import { useWorkflowStore } from '@/store/workflowStore';

export default function CropImageNode(props: NodeProps) {
  const data = (props.data ?? {}) as WorkflowNodeData;
  const id = props.id;
  const updateNodeData = useWorkflowStore((s) => s.updateNodeData);

  const crop = {
    x:      (data.xPercent      as number) ?? 0,
    y:      (data.yPercent      as number) ?? 0,
    width:  (data.widthPercent  as number) ?? 100,
    height: (data.heightPercent as number) ?? 100,
  };

  const isExecuting = Boolean(data.isExecuting);
  const outputUrl = data.outputUrl as string | undefined;

  const update = (key: string, value: number) =>
    updateNodeData(id, { [key]: value });

  return (
    <div className={`
      w-56 rounded-xl border-l-3 bg-[#141414] p-3
      transition-all duration-300
      ${isExecuting ? 'border-yellow-500/50 border shadow-lg shadow-orange-600/20' : 'border border-white/8 border-l-orange-500'}
    `}>
      {/* image_url input handle */}
      <Handle
        type="target"
        position={Position.Top}
        id="image_url"
        className="bg-blue-500! w-2! h-2! border border-[#141414]!"
      />

      {/* Header */}
      <div className="flex items-center gap-2 mb-3">
        <div className="w-5 h-5 rounded-md bg-orange-500
                        flex items-center justify-center text-xs">
          ✂️
        </div>
        <span className="text-white text-xs font-semibold uppercase tracking-wide">Crop Image</span>
      </div>

      {/* Crop parameters */}
      <div className="flex flex-col gap-1.5">
        {[
          { label: 'X %',      key: 'xPercent',      val: crop.x      },
          { label: 'Y %',      key: 'yPercent',      val: crop.y      },
          { label: 'Width %',  key: 'widthPercent',  val: crop.width  },
          { label: 'Height %', key: 'heightPercent', val: crop.height },
        ].map(({ label, key, val }) => (
          <div key={key} className="flex items-center justify-between gap-2">
            <span className="text-[10px] text-gray-600 w-14 shrink-0">
              {label}
            </span>
            <input
              type="range"
              min={0}
              max={100}
              value={val}
              onChange={(e) => update(key, Number(e.target.value))}
              className="flex-1 accent-orange-500 h-1"
            />
            <span className="text-[10px] text-gray-600 w-7 text-right">
              {val}
            </span>
          </div>
        ))}
      </div>

      {/* Output preview text */}
      {outputUrl && (
        <div className="mt-2 p-2 bg-[#0d0d0d] rounded-lg border border-white/6">
          <p className="text-[10px] text-gray-600 truncate">
            ✅ Cropped
          </p>
        </div>
      )}

      {/* Output label */}
      <div className="flex flex-col gap-1 text-[10px] text-gray-600 px-0.5 mt-2">
        <span>cropped image →</span>
      </div>

      <Handle
        type="source"
        position={Position.Bottom}
        id="image_url"
        className="bg-orange-500! w-2! h-2! border border-[#141414]!"
      />
    </div>
  );
}