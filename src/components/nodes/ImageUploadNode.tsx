'use client';

import { Handle, Position, NodeProps } from '@xyflow/react';
import { useRef, useState } from 'react';
import { WorkflowNodeData } from '@/types/workflow';
import { useWorkflowStore } from '@/store/workflowStore';

export default function ImageUploadNode(props: NodeProps) {
  const data = (props.data ?? {}) as WorkflowNodeData;
  const { id } = props;
  const [preview, setPreview]   = useState<string | null>(
    data.imageUrl as string || null
  );
  const [uploading, setUploading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const updateNodeData = useWorkflowStore((s) => s.updateNodeData);

  const isExecuting = Boolean(data.isExecuting);

  const handleUpload = async (file: File) => {
    setUploading(true);

    // Use Transloadit for upload
    const formData = new FormData();
    formData.append('file', file);
    formData.append('params', JSON.stringify({
      auth: { key: process.env.NEXT_PUBLIC_TRANSLOADIT_KEY },
      steps: {
        ':original': { robot: '/upload/handle' },
        resized: {
          use:    ':original',
          robot:  '/image/resize',
          width:  1200,
          format: 'jpg',
        },
      },
    }));

    try {
      const res = await fetch('https://api2.transloadit.com/assemblies', {
        method: 'POST',
        body: formData,
      });

      // Check if response is OK
      if (!res.ok) {
        const text = await res.text();
        throw new Error(`Upload failed: ${res.status} - ${text.substring(0, 200)}`);
      }

      // Parse response as JSON (Transloadit may return text/plain even for JSON)
      const data = await res.json();

      // Check for assembly_ssl_url
      if (!data.assembly_ssl_url) {
        throw new Error('No assembly_ssl_url in response');
      }

      // Poll Transloadit until assembly is complete
      const imageUrl = await pollTransloadit(data.assembly_ssl_url);

      setPreview(imageUrl);
      updateNodeData(id, { imageUrl });   // save to Zustand
    } catch (err) {
      console.error('Upload failed:', err);
      alert(`Upload error: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className={`
      w-56 rounded-xl border-l-3 bg-[#141414] p-3
      transition-all duration-300
      ${isExecuting ? 'border-white/8 border border-blue-500/50 shadow-lg shadow-blue-600/20' : 'border border-white/8 border-l-blue-600'}
    `}>
      {/* Header */}
      <div className="flex items-center gap-2 mb-3">
        <div className="w-5 h-5 rounded-md bg-blue-600 
                        flex items-center justify-center text-xs">
          🖼
        </div>
        <span className="text-white text-xs font-semibold uppercase tracking-wide">Upload Image</span>
      </div>

      {/* Upload area */}
      <div
        onClick={() => inputRef.current?.click()}
        className="w-full h-20 rounded-lg border border-white/6 border-dashed
                   hover:border-blue-500/30 transition-colors cursor-pointer
                   flex items-center justify-center overflow-hidden bg-white/2"
      >
        {uploading ? (
          <span className="text-xs text-gray-500 animate-pulse">Uploading...</span>
        ) : preview ? (
          <img src={preview} alt="preview"
               className="w-full h-full object-cover rounded-lg" />
        ) : (
          <div className="text-center">
            <p className="text-lg">📁</p>
            <p className="text-[9px] text-gray-600 mt-1">
              Click to upload
            </p>
          </div>
        )}
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="image/jpg,image/jpeg,image/png,image/webp,image/gif"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleUpload(file);
        }}
      />

      {/* Output handle */}
      <Handle
        type="source"
        position={Position.Bottom}
        id="image_url"
        className="bg-blue-500! w-2! h-2! border border-[#141414]!"
      />
    </div>
  );
}

// Poll Transloadit until assembly completes
async function pollTransloadit(assemblyUrl: string): Promise<string> {
  for (let i = 0; i < 30; i++) {
    await new Promise((r) => setTimeout(r, 1000));
    const res  = await fetch(assemblyUrl);
    const data = await res.json();

    if (data.ok === 'ASSEMBLY_COMPLETED') {
      return data.results.resized?.[0]?.ssl_url ||
             data.results[':original']?.[0]?.ssl_url;
    }
    if (data.error) throw new Error(data.error);
  }
  throw new Error('Upload timed out');
}