import { task } from '@trigger.dev/sdk/v3';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { prisma } from '@/lib/prisma';

// Install: npm install @google/generative-ai
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

export interface LLMTaskPayload {
  nodeExecutionId: string;   // to update DB with result
  model:           string;   // e.g. 'gemini-2.0-flash'
  systemPrompt?:   string;
  userMessage:     string;
  imageUrls?:      string[]; // for vision support
}

export const llmTask = task({
  id: 'llm-node',

  run: async (payload: LLMTaskPayload) => {
    const { nodeExecutionId, model, systemPrompt, userMessage, imageUrls } = payload;

    console.log('[LLM Task] Starting execution', {
      nodeExecutionId,
      model,
      hasSystemPrompt: !!systemPrompt,
      userMessageLength: userMessage.length,
      imageCount: imageUrls?.length || 0,
      geminiApiKeySet: !!process.env.GEMINI_API_KEY,
    });

    // Step 1: Mark as running in DB
    await prisma.nodeExecution.update({
      where: { id: nodeExecutionId },
      data:  { status: 'RUNNING', startedAt: new Date() },
    });

    const startTime = Date.now();

    try {
      // Verify Gemini API key
      if (!process.env.GEMINI_API_KEY) {
        throw new Error('GEMINI_API_KEY environment variable is not set');
      }

      // Sanitize model name (ensure it has 'models/' prefix)
      let modelName = model;
      if (!modelName.startsWith('models/')) {
        modelName = `models/${modelName}`;
      }

      console.log('[LLM Task] Using model', { originalModel: model, sanitizedModel: modelName });

      const geminiModel = genAI.getGenerativeModel({ 
        model: modelName
      });

      // Step 2: Build the prompt parts
      const parts: any[] = [];

      if (systemPrompt) {
        parts.push({ text: `System: ${systemPrompt}\n\n` });
      }

      // Add images if provided (vision support)
      if (imageUrls && imageUrls.length > 0) {
        console.log('[LLM Task] Processing images', { count: imageUrls.length });
        for (const url of imageUrls) {
          try {
            const imageRes = await fetch(url);
            if (!imageRes.ok) {
              throw new Error(`Failed to fetch image: ${imageRes.status} ${imageRes.statusText}`);
            }
            const buffer   = await imageRes.arrayBuffer();
            const base64   = Buffer.from(buffer).toString('base64');
            const mimeType = url.endsWith('.png') ? 'image/png' : 'image/jpeg';

            parts.push({
              inlineData: { data: base64, mimeType },
            });
            console.log('[LLM Task] Image added', { url, size: buffer.byteLength });
          } catch (imgErr) {
            console.error('[LLM Task] Error processing image', { url, error: String(imgErr) });
            throw imgErr;
          }
        }
      }

      parts.push({ text: userMessage });

      // Step 3: Call Gemini
      console.log('[LLM Task] Calling Gemini API', { partCount: parts.length });
      const result   = await geminiModel.generateContent(parts);
      const response = result.response.text();
      const duration = `${((Date.now() - startTime) / 1000).toFixed(1)}s`;

      console.log('[LLM Task] Gemini response received', { 
        duration, 
        responseLength: response.length 
      });

      // Step 4: Save result to DB
      await prisma.nodeExecution.update({
        where: { id: nodeExecutionId },
        data: {
          status:      'SUCCESS',
          outputData:  { text: response },
          duration,
          completedAt: new Date(),
        },
      });

      console.log('[LLM Task] Task completed successfully', { nodeExecutionId, duration });
      return { success: true, output: response, duration };

    } catch (error) {
      const err = error as Error;
      const duration = `${((Date.now() - startTime) / 1000).toFixed(1)}s`;

      console.error('[LLM Task] Task failed', {
        nodeExecutionId,
        errorMessage: err.message,
        errorStack: err.stack,
        duration,
      });

      await prisma.nodeExecution.update({
        where: { id: nodeExecutionId },
        data: {
          status:      'FAILED',
          error:       err.message,
          completedAt: new Date(),
        },
      });

      throw error; // Trigger.dev will mark task as failed
    }
  },
});