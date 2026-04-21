'use client';

import {
  ReactFlow,
  Background,
  BackgroundVariant,
  Controls,
  MiniMap,
  NodeTypes,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { useWorkflowStore } from '@/store/workflowStore';
import { isValidConnection } from '@/lib/connectionValidator';
import TextNode from '@/components/nodes/TextNode';
import LLMNode from '@/components/nodes/LLMNode';
import ImageUploadNode from '@/components/nodes/ImageUploadNode';
import VideoUploadNode  from '@/components/nodes/VideoUploadNode';
import CropImageNode    from '@/components/nodes/CropImageNode';
import ExtractFrameNode from '@/components/nodes/ExtractFrameNode';

// This map tells React Flow: "when node.type === 'textNode', render <TextNode />"
const nodeTypes: NodeTypes = {
  textNode: TextNode as any,
  llmNode: LLMNode as any,
  imageUploadNode: ImageUploadNode as any,
    videoUploadNode: VideoUploadNode as any,
    cropImageNode: CropImageNode as any,
    extractFrameNode: ExtractFrameNode as any,
    
};

export default function WorkflowCanvas() {
  const { nodes, edges, onNodesChange, onEdgesChange, onConnect, snapshot } = useWorkflowStore();

  return (
    <div className="w-full h-full bg-[#0a0a0a] flex flex-col">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        nodeTypes={nodeTypes}
        isValidConnection={isValidConnection}
        onNodesDelete={() => snapshot()}
        onEdgesDelete={() => snapshot()}
        panOnScroll
        zoomOnPinch
        fitView
        defaultEdgeOptions={{
          animated: true,
          style: { stroke: '#7c3aed', strokeWidth: 1.5, strokeDasharray: '5,5' },
        }}
        fitViewOptions={{ padding: 0.2 }}
      >
        <Background
          variant={BackgroundVariant.Dots}
          gap={24}
          size={1}
          color="#1a1a1a"
        />
        <Controls className="bg-[#0f0f0f] border border-white/6 [&>button]:bg-transparent [&>button]:border-0 [&>button]:text-white [&>button]:hover:bg-white/10 [&>button]:cursor-pointer" />
        <MiniMap
          style={{ background: '#0f0f0f', border: '1px solid rgba(255,255,255,0.06)' }}
          nodeColor="#7c3aed"
          maskColor="rgba(0,0,0,0.6)"
          position="bottom-right"
        />
      </ReactFlow>
    </div>
  );
}