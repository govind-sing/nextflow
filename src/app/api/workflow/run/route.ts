import { auth }         from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';
import { prisma }       from '@/lib/prisma';
import { cropImageTask }    from '@/trigger/cropImageTask';
import { extractFrameTask } from '@/trigger/extractFrameTask';
import { llmTask }          from '@/trigger/llmTask';
import { z }            from 'zod';

const RunWorkflowSchema = z.object({
  workflowId: z.string(),
  nodes:      z.array(z.any()),
  edges:      z.array(z.any()),
});

export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body   = await req.json();
  const parsed = RunWorkflowSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid data' }, { status: 400 });
  }

  const { workflowId, nodes, edges } = parsed.data;

  // Debug logging
  console.log('[Workflow Run] Starting workflow execution', {
    workflowId,
    nodeCount: nodes.length,
    userId,
    timestamp: new Date().toISOString(),
  });

  // Step 1: Create WorkflowRun record
  const run = await prisma.workflowRun.create({
    data: {
      userId,
      workflowId,
      runNumber: await prisma.workflowRun.count({ where: { workflowId } }) + 1,
      status:    'RUNNING',
      scope:     'FULL',
    },
  });

  // Step 2: Create NodeExecution records (all PENDING)
  const nodeExecutions = await Promise.all(
    nodes.map((node: any) =>
      prisma.nodeExecution.create({
        data: {
          runId:    run.id,
          nodeId:   node.id,
          nodeType: node.type,
          label:    node.data.label,
          status:   'PENDING',
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
      (e: any) => e.target === targetNodeId && 
                  e.targetHandle === targetHandle
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
      // (they don't need Trigger.dev, data is already in node)
      if (
        node.type === 'textNode' ||
        node.type === 'imageUploadNode' ||
        node.type === 'videoUploadNode'
      ) {
        await prisma.nodeExecution.update({
          where: { id: execution.id },
          data: {
            status:      'SUCCESS',
            outputData:  { 
              text:     node.data.text,
              imageUrl: node.data.imageUrl,
              videoUrl: node.data.videoUrl,
            },
            duration:    '0.0s',
            completedAt: new Date(),
          },
        });
        continue; // no Trigger.dev needed
      }

      if (node.type === 'llmNode') {
        const userMsgNode    = getConnectedNodeData(node.id, 'user_message');
        const systemPrmtNode = getConnectedNodeData(node.id, 'system_prompt');
        const imageNode      = getConnectedNodeData(node.id, 'images');

        const userMessage  = userMsgNode?.data?.text  as string || 'Hello';
        const systemPrompt = systemPrmtNode?.data?.text as string || undefined;
        
        // Support both imageUrl (from ImageUploadNode) and outputUrl (from ExtractFrameNode)
        const imageUrl = imageNode?.data?.imageUrl || imageNode?.data?.outputUrl;
        const imageUrls = imageUrl ? [imageUrl as string] : [];

        console.log('[LLM Task] Triggering LLM node', {
          nodeId: node.id,
          model: node.data.model,
          hasSystemPrompt: !!systemPrompt,
          userMessageLength: userMessage.length,
          imageUrlCount: imageUrls.length,
        });

        await llmTask.trigger({
          nodeExecutionId: execution.id,
          model:           node.data.model as string || 'gemini-2.5-flash',
          systemPrompt,
          userMessage,
          imageUrls,
        });
        console.log('[LLM Task] Successfully triggered', { nodeId: node.id });
      }

      if (node.type === 'cropImageNode') {
        const imageNode = getConnectedNodeData(node.id, 'image_url');
        
        // Fallback: check node.data.imageUrl if no connected node
        let imageUrl = imageNode?.data?.imageUrl as string || '';
        if (!imageUrl && node.data.imageUrl) {
          imageUrl = node.data.imageUrl as string;
        }
        
        // If still no image, skip this node
        if (!imageUrl) {
          await prisma.nodeExecution.update({
            where: { id: execution.id },
            data: {
              status:      'FAILED',
              error:       'No image URL provided. Connect an image upload node.',
              completedAt: new Date(),
            },
          });
          continue;
        }

        await cropImageTask.trigger({
          nodeExecutionId: execution.id,
          imageUrl,
          xPercent:        node.data.xPercent      as number ?? 0,
          yPercent:        node.data.yPercent       as number ?? 0,
          widthPercent:    node.data.widthPercent   as number ?? 100,
          heightPercent:   node.data.heightPercent  as number ?? 100,
        });
      }

      if (node.type === 'extractFrameNode') {
        const videoNode = getConnectedNodeData(node.id, 'video_url');
        
        // Fallback: check node.data.videoUrl if no connected node
        let videoUrl = videoNode?.data?.videoUrl as string || '';
        if (!videoUrl && node.data.videoUrl) {
          videoUrl = node.data.videoUrl as string;
        }
        
        // If still no video, skip this node
        if (!videoUrl) {
          await prisma.nodeExecution.update({
            where: { id: execution.id },
            data: {
              status:      'FAILED',
              error:       'No video URL provided. Connect a video upload node.',
              completedAt: new Date(),
            },
          });
          continue;
        }

        await extractFrameTask.trigger({
          nodeExecutionId: execution.id,
          videoUrl,
          timestamp:       node.data.timestamp as string || '0',
        });
      }
    } catch (nodeError) {
      console.error('[Workflow Run] Error triggering node task', {
        nodeId: node.id,
        nodeType: node.type,
        error: String(nodeError),
        stack: nodeError instanceof Error ? nodeError.stack : undefined,
      });
      
      // Mark execution as failed
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
  // (only Trigger.dev tasks are async — text/upload are already done)
  const allExecutions = await prisma.nodeExecution.findMany({
    where: { runId: run.id }
  });

  const allDone = allExecutions.every(
    (e) => e.status === 'SUCCESS' || e.status === 'FAILED'
  );

  if (allDone) {
    const anyFailed = allExecutions.some((e) => e.status === 'FAILED');
    await prisma.workflowRun.update({
      where: { id: run.id },
      data:  { 
        status:      anyFailed ? 'FAILED' : 'SUCCESS',
        completedAt: new Date(),
      },
    });
  }

  console.log('[Workflow Run] Completed', {
    runId: run.id,
    workflowId,
    totalNodes: nodes.length,
    executionStatuses: allExecutions.map(e => ({ nodeId: e.nodeId, status: e.status })),
  });

  return NextResponse.json({ runId: run.id });
}