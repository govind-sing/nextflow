'use client';

import { useState } from 'react';
import { useWorkflowStore } from '@/store/workflowStore';
import { NodeType } from '@/types/workflow';

// Each button's config in one place — easy to extend later
const NODE_BUTTONS: { type: NodeType; label: string; icon: string; color: string }[] = [
  { type: 'textNode',         label: 'Text',           icon: 'T',  color: 'bg-violet-600' },
  { type: 'imageUploadNode',  label: 'Upload Image',   icon: '🖼', color: 'bg-blue-600'   },
  { type: 'videoUploadNode',  label: 'Upload Video',   icon: '🎬', color: 'bg-pink-600'   },
  { type: 'llmNode',          label: 'Run Any LLM',    icon: '🤖', color: 'bg-emerald-600'},
  { type: 'cropImageNode',    label: 'Crop Image',     icon: '✂️', color: 'bg-orange-500' },
  { type: 'extractFrameNode', label: 'Extract Frame',  icon: '🎞', color: 'bg-yellow-500' },
];

export default function LeftSidebar() {
  const addNode = useWorkflowStore((state) => state.addNode);
  const [hoveredButton, setHoveredButton] = useState<NodeType | null>(null);

  const handleAddNode = (type: NodeType, label: string) => {
    addNode({
      id: crypto.randomUUID(),   // unique id every time
      type,
      position: { x: 300, y: 200 },  // drops near center, user can drag it
      data: {
        label,
        isExecuting: false,
      },
    });
  };

  return (
    <aside className="w-14 h-full bg-[#0f0f0f] sm:bg-[#1a1a1a] md:bg-[#151515] lg:bg-[#0f0f0f] border-r border-white/6 sm:border-white/8 md:border-white/5 lg:border-white/6 flex flex-col items-center py-4 gap-2 transition-colors duration-300">

      {/* Header - NODES label */}
      <div className="text-[9px] text-gray-500 uppercase tracking-widest mb-2 rotate-90 origin-center whitespace-nowrap">
        NODES
      </div>

      {/* Divider */}
      <div className="w-6 h-px bg-white/5 mb-2"></div>

      {/* Node buttons - icon only */}
      <div className="flex flex-col gap-2 items-center flex-1">
        {NODE_BUTTONS.map(({ type, label, icon, color }) => (
          <div key={type} className="relative">
            <button
              onClick={() => handleAddNode(type, label)}
              onMouseEnter={() => setHoveredButton(type)}
              onMouseLeave={() => setHoveredButton(null)}
              className={`w-10 h-10 rounded-xl ${color} flex items-center justify-center text-sm transition-all duration-200 hover:scale-110 hover:brightness-125 cursor-pointer sm:brightness-90 md:brightness-100 lg:brightness-110`}
            >
              {icon}
            </button>

            {/* Tooltip */}
            {hoveredButton === type && (
              <div className="absolute left-12 top-1/2 -translate-y-1/2 bg-[#1a1a1a] text-white text-xs rounded-lg px-2 py-1 border border-white/10 whitespace-nowrap z-50">
                {label}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Bottom spacer */}
      <div className="h-px w-6 bg-white/5"></div>
    </aside>
  );
}