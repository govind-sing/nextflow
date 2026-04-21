'use client';

import { Handle, Position, NodeProps } from '@xyflow/react';
import { useRef, useState } from 'react';
import { WorkflowNodeData } from '@/types/workflow';
import { useWorkflowStore } from '@/store/workflowStore';

export default function VideoUploadNode(props: NodeProps) {
  const data = (props.data ?? {}) as WorkflowNodeData;
  const id = props.id;
  const [videoUrl, setVideoUrl]   = useState<string | null>(
    data.videoUrl as string || null
  );
  const [uploading, setUploading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const updateNodeData = useWorkflowStore((s) => s.updateNodeData);

  const isExecuting = Boolean(data.isExecuting);

  const handleUpload = async (file: File) => {
    setUploading(true);

    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('params', JSON.stringify({
        auth: { key: process.env.NEXT_PUBLIC_TRANSLOADIT_KEY },
        steps: {
          ':original': {
            robot:  '/upload/handle',
            result: true,
          },
        },
      }));

      const res      = await fetch('https://api2.transloadit.com/assemblies', {
        method: 'POST',
        body:   formData,
      });
      const assembly = await res.json();

      if (assembly.error) throw new Error(assembly.error);

      const url = await pollUntilComplete(assembly.assembly_ssl_url);
      setVideoUrl(url);
      updateNodeData(id, { videoUrl: url });

    } catch (err) {
      console.error('Upload failed:', err);
      alert('Upload failed. Check your Transloadit key.');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className={`
      w-56 rounded-xl border-l-3 bg-[#141414] p-3
      transition-all duration-300
      ${isExecuting ? 'border-white/8 border border-pink-500/50 shadow-lg shadow-pink-600/20' : 'border border-white/8 border-l-pink-600'}
    `}>
      {/* Header */}
      <div className="flex items-center gap-2 mb-3">
        <div className="w-5 h-5 rounded-md bg-pink-600 
                        flex items-center justify-center text-xs">
          🎬
        </div>
        <span className="text-white text-xs font-semibold uppercase tracking-wide">Upload Video</span>
      </div>

      {/* Upload / Preview area */}
      {videoUrl ? (
        <video
          src={videoUrl}
          controls
          className="w-full rounded-lg border border-white/6 bg-black"
        />
      ) : (
        <div
          onClick={() => inputRef.current?.click()}
          className="w-full h-20 rounded-lg border border-white/6 border-dashed
                     hover:border-pink-500/30 transition-colors cursor-pointer
                     flex items-center justify-center bg-white/2"
        >
          {uploading ? (
            <span className="text-xs text-gray-500 animate-pulse">
              Uploading...
            </span>
          ) : (
            <div className="text-center">
              <p className="text-lg">🎥</p>
              <p className="text-[9px] text-gray-600 mt-1">Click to upload</p>
            </div>
          )}
        </div>
      )}

      <input
        ref={inputRef}
        type="file"
        accept="video/mp4,video/mov,video/webm,video/m4v"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleUpload(file);
        }}
      />

      <Handle
        type="source"
        position={Position.Bottom}
        id="video_url"
        className="bg-pink-500! w-2! h-2! border border-[#141414]!"
      />
    </div>
  );
}

async function pollUntilComplete(assemblyUrl: string): Promise<string> {
  for (let i = 0; i < 60; i++) {
    await new Promise((r) => setTimeout(r, 1500));

    const res  = await fetch(assemblyUrl);
    const data = await res.json();

    console.log('Status:', data.ok);

    if (data.ok === 'ASSEMBLY_COMPLETED') {
      // Try results first, then uploads as fallback
      const resultKeys = Object.keys(data.results || {});
      const fromResults = data.results?.[':original']?.[0] ||
                          data.results?.[resultKeys[0]]?.[0];

      const file = fromResults || data.uploads?.[0];

      if (!file?.ssl_url && !file?.url) {
        throw new Error('No upload URL found');
      }

      return file.ssl_url || file.url;
    }

    if (data.ok === 'ASSEMBLY_FAILED' || data.error) {
      throw new Error(data.message || 'Assembly failed');
    }
  }

  throw new Error('Upload timed out');
}