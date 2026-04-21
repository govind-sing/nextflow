import { WorkflowJSON } from './workflowIO';

export const SAMPLE_WORKFLOW: WorkflowJSON = {
  version:    '1.0',
  name:       'Product Marketing Kit Generator',
  exportedAt: new Date().toISOString(),

  nodes: [
    // ── Branch A ──────────────────────────────
    {
      id:       'upload-image',
      type:     'imageUploadNode',
      position: { x: 100, y: 80 },
      data:     { label: 'Upload Image' },
    },
    {
      id:       'crop-image',
      type:     'cropImageNode',
      position: { x: 100, y: 260 },
      data: {
        label:         'Crop Image',
        xPercent:      10,
        yPercent:      10,
        widthPercent:  80,
        heightPercent: 80,
      },
    },
    {
      id:       'system-prompt',
      type:     'textNode',
      position: { x: 380, y: 80 },
      data: {
        label: 'System Prompt',
        text:  'You are a professional marketing copywriter. Generate a compelling one-paragraph product description.',
      },
    },
    {
      id:       'product-details',
      type:     'textNode',
      position: { x: 380, y: 260 },
      data: {
        label: 'Product Details',
        text:  'Product: Wireless Bluetooth Headphones. Features: Noise cancellation, 30-hour battery, foldable design.',
      },
    },
    {
      id:       'llm-1',
      type:     'llmNode',
      position: { x: 660, y: 180 },
      data: {
        label: 'LLM Node #1',
        model: 'models/gemini-1.5-flash',
      },
    },

    // ── Branch B ──────────────────────────────
    {
      id:       'upload-video',
      type:     'videoUploadNode',
      position: { x: 100, y: 500 },
      data:     { label: 'Upload Video' },
    },
    {
      id:       'extract-frame',
      type:     'extractFrameNode',
      position: { x: 100, y: 680 },
      data:     { label: 'Extract Frame', timestamp: '50%' },
    },

    // ── Convergence ───────────────────────────
    {
      id:       'social-prompt',
      type:     'textNode',
      position: { x: 660, y: 500 },
      data: {
        label: 'Social Prompt',
        text:  'You are a social media manager. Create a tweet-length marketing post based on the product image and video frame.',
      },
    },
    {
      id:       'llm-2',
      type:     'llmNode',
      position: { x: 940, y: 380 },
      data: {
        label: 'LLM Node #2 (Convergence)',
        model: 'models/gemini-1.5-flash',
      },
    },
  ],

  edges: [
    // Branch A connections
    { id: 'e1', source: 'upload-image',   target: 'crop-image',
      sourceHandle: 'image_url',    targetHandle: 'image_url',
      animated: true, style: { stroke: '#8b5cf6' } },

    { id: 'e2', source: 'crop-image',     target: 'llm-1',
      sourceHandle: 'output',       targetHandle: 'images',
      animated: true, style: { stroke: '#8b5cf6' } },

    { id: 'e3', source: 'system-prompt',  target: 'llm-1',
      sourceHandle: 'output',       targetHandle: 'system_prompt',
      animated: true, style: { stroke: '#8b5cf6' } },

    { id: 'e4', source: 'product-details',target: 'llm-1',
      sourceHandle: 'output',       targetHandle: 'user_message',
      animated: true, style: { stroke: '#8b5cf6' } },

    // Branch B connections
    { id: 'e5', source: 'upload-video',   target: 'extract-frame',
      sourceHandle: 'video_url',    targetHandle: 'video_url',
      animated: true, style: { stroke: '#8b5cf6' } },

    // Convergence connections
    { id: 'e6', source: 'social-prompt',  target: 'llm-2',
      sourceHandle: 'output',       targetHandle: 'system_prompt',
      animated: true, style: { stroke: '#8b5cf6' } },

    { id: 'e7', source: 'llm-1',          target: 'llm-2',
      sourceHandle: 'output',       targetHandle: 'user_message',
      animated: true, style: { stroke: '#8b5cf6' } },

    { id: 'e8', source: 'crop-image',     target: 'llm-2',
      sourceHandle: 'output',       targetHandle: 'images',
      animated: true, style: { stroke: '#8b5cf6' } },

    { id: 'e9', source: 'extract-frame',  target: 'llm-2',
      sourceHandle: 'output',       targetHandle: 'images',
      animated: true, style: { stroke: '#8b5cf6' } },
  ],
};