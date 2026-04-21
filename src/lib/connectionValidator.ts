import { Connection } from '@xyflow/react';

// Define what data type each handle carries or accepts
const HANDLE_TYPES: Record<string, 'text' | 'image' | 'video' | 'any'> = {
  // Sources (outputs)
  'output':     'text',
  'image_url':  'image',      // ImageUploadNode & ExtractFrameNode
  'video_url':  'video',

  // Targets (inputs)
  'user_message': 'text',
  'system_prompt': 'text',
  'images':        'image',   // LLMNode accepts images
  'imageUrl':      'image',
  'videoUrl':      'video',
};

export function isValidConnection(connection: Connection | { sourceHandle?: string | null; targetHandle?: string | null }): boolean {
  const sourceHandle = connection.sourceHandle ?? undefined;
  const targetHandle = connection.targetHandle ?? undefined;
  
  const sourceType = sourceHandle ? HANDLE_TYPES[sourceHandle] : undefined;
  const targetType = targetHandle ? HANDLE_TYPES[targetHandle] : undefined;

  // If either handle is unknown, allow it (for forward compatibility)
  if (!sourceType || !targetType) return true;

  // 'any' accepts everything
  if (targetType === 'any') return true;

  // Types must match
  return sourceType === targetType;
}