import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { cropImageTask } from '@/trigger/cropImageTask';
import { extractFrameTask } from '@/trigger/extractFrameTask';
import { llmTask } from '@/trigger/llmTask';
import { z } from 'zod';

const WebhookSchema = z.object({
  workflowId: z.string(),
  nodes: z.array(z.any()),
  edges: z.array(z.any()),
  userId: z.string().optional(), // optional, will use default if not provided
});

/**
 * PUBLIC webhook endpoint to trigger workflows
 * No authentication required
 * 
 * Example:
 * POST /api/workflow/webhook
 * {
 *   "workflowId": "workflow-123",
 *   "userId": "user-123",
 *   "nodes": [...],
 *   "edges": [...]
 * }
 */
export async function POST(req: Request) {
  try {
    // Verify Trigger.dev is configured
    if (!process.env.TRIGGER_SECRET_KEY) {
      console.error('[Webhook] Missing TRIGGER_SECRET_KEY environment variable');
      return NextResponse.json(
        { error: 'Trigger.dev not configured - missing TRIGGER_SECRET_KEY' },
        { status: 500 }
      );
    }

    const body = await req.json();
    const parsed = WebhookSchema.safeParse(body);

    if (!parsed.success) {
      console.error('[Webhook] Invalid payload', { details: parsed.error.flatten() });
      return NextResponse.json(
        { error: 'Invalid data', details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { workflowId, nodes, edges, userId = 'webhook-user' } = parsed.data;

    console.log('[Webhook] Received workflow trigger', {
      workflowId,
      nodeCount: nodes.length,
      userId,
      hasTriggerKey: !!process.env.TRIGGER_SECRET_KEY,
      timestamp: new Date().toISOString(),
    });

    // Step 1: Create WorkflowRun record
    const run = await prisma.workflowRun.create({
      data: {
        userId,
        workflowId,
        runNumber: await prisma.workflowRun.count({ where: { workflowId } }) + 1,
        status: 'RUNNING',
        scope: 'FULL',
      },
    });

    // Step 2: Create NodeExecution records (all PENDING)
    const nodeExecutions = await Promise.all(
      nodes.map((node: any) =>
        prisma.nodeExecution.create({
          data: {
            runId: run.id,
            nodeId: node.id,
            nodeType: node.type,
            label: node.data.label,
            status: 'PENDING',
          },
        })
      )
    );

    // Helper to get connected node's data
    const getConnectedNodeData = (
      targetNodeId: string,
      targetHandle: string
    ) => {
      const edge = edges.find(
        (e: any) =>
          e.target === targetNodeId && e.targetHandle === targetHandle
      );
      if (!edge) return null;
      return nodes.find((n: any) => n.id === edge.source);
    };

    // Step 3: Trigger tasks for all node types
    for (const node of nodes) {
      const execution = nodeExecutions.find((e) => e.nodeId === node.id);
      if (!execution) continue;

      try {
        // Text and Upload nodes → mark SUCCESS immediately
        if (
          node.type === 'textNode' ||
          node.type === 'imageUploadNode' ||
          node.type === 'videoUploadNode'
        ) {
          await prisma.nodeExecution.update({
            where: { id: execution.id },
            data: {
              status: 'SUCCESS',
              outputData: {
                text: node.data.text,
                imageUrl: node.data.imageUrl,
                videoUrl: node.data.videoUrl,
              },
              duration: '0.0s',
              completedAt: new Date(),
            },
          });
          continue;
        }

        if (node.type === 'llmNode') {
          const userMsgNode = getConnectedNodeData(node.id, 'user_message');
          const systemPrmtNode = getConnectedNodeData(
            node.id,
            'system_prompt'
          );
          const imageNode = getConnectedNodeData(node.id, 'images');

          const userMessage =
            (userMsgNode?.data?.text as string) || 'Hello';
          const systemPrompt =
            (systemPrmtNode?.data?.text as string) || undefined;

          const imageUrl =
            imageNode?.data?.imageUrl || imageNode?.data?.outputUrl;
          const imageUrls = imageUrl ? ([imageUrl as string]) : [];

          console.log('[Webhook LLM] Triggering task', {
            nodeId: node.id,
            model: node.data.model,
            hasSystemPrompt: !!systemPrompt,
            userMessageLength: userMessage.length,
            imageUrlCount: imageUrls.length,
          });

          await llmTask.trigger({
            nodeExecutionId: execution.id,
            model: (node.data.model as string) || 'gemini-2.5-flash',
            systemPrompt,
            userMessage,
            imageUrls,
          });

          console.log('[Webhook LLM] Task triggered successfully', { nodeId: node.id });
        }

        if (node.type === 'cropImageNode') {
          const imageNode = getConnectedNodeData(node.id, 'image_url');

          let imageUrl = (imageNode?.data?.imageUrl as string) || '';
          if (!imageUrl && node.data.imageUrl) {
            imageUrl = node.data.imageUrl as string;
          }

          if (!imageUrl) {
            await prisma.nodeExecution.update({
              where: { id: execution.id },
              data: {
                status: 'FAILED',
                error: 'No image URL provided. Connect an image upload node.',
                completedAt: new Date(),
              },
            });
            continue;
          }

          await cropImageTask.trigger({
            nodeExecutionId: execution.id,
            imageUrl,
            xPercent: (node.data.xPercent as number) ?? 0,
            yPercent: (node.data.yPercent as number) ?? 0,
            widthPercent: (node.data.widthPercent as number) ?? 100,
            heightPercent: (node.data.heightPercent as number) ?? 100,
          });
        }

        if (node.type === 'extractFrameNode') {
          const videoNode = getConnectedNodeData(node.id, 'video_url');

          let videoUrl = (videoNode?.data?.videoUrl as string) || '';
          if (!videoUrl && node.data.videoUrl) {
            videoUrl = node.data.videoUrl as string;
          }

          if (!videoUrl) {
            await prisma.nodeExecution.update({
              where: { id: execution.id },
              data: {
                status: 'FAILED',
                error: 'No video URL provided. Connect a video upload node.',
                completedAt: new Date(),
              },
            });
            continue;
          }

          await extractFrameTask.trigger({
            nodeExecutionId: execution.id,
            videoUrl,
            timestamp: (node.data.timestamp as string) || '0',
          });
        }
      } catch (nodeError) {
        console.error('[Webhook] Error triggering node task', {
          nodeId: node.id,
          nodeType: node.type,
          error: String(nodeError),
          stack: nodeError instanceof Error ? nodeError.stack : undefined,
        });

        await prisma.nodeExecution.update({
          where: { id: execution.id },
          data: {
            status: 'FAILED',
            error: String(nodeError),
            completedAt: new Date(),
          },
        });
      }
    }

    // After triggering all tasks, check if run is complete
    const allExecutions = await prisma.nodeExecution.findMany({
      where: { runId: run.id },
    });

    const allDone = allExecutions.every(
      (e) => e.status === 'SUCCESS' || e.status === 'FAILED'
    );

    if (allDone) {
      const anyFailed = allExecutions.some((e) => e.status === 'FAILED');
      await prisma.workflowRun.update({
        where: { id: run.id },
        data: {
          status: anyFailed ? 'FAILED' : 'SUCCESS',
          completedAt: new Date(),
        },
      });
    }

    return NextResponse.json({ runId: run.id, status: 'triggered' });
  } catch (error) {
    console.error('Webhook error:', error);
    return NextResponse.json(
      { error: 'Internal server error', message: String(error) },
      { status: 500 }
    );
  }
}

// GET endpoint for health check
export async function GET() {
  return NextResponse.json({
    status: 'ok',
    message: 'Workflow webhook endpoint is running',
    endpoint: '/api/workflow/webhook',
  });
}
