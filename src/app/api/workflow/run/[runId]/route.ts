import { auth }         from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';
import { prisma }       from '@/lib/prisma';

export async function GET(
  req: Request,
  { params }: { params: Promise<{ runId: string }> }  // ← Promise now
) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { runId } = await params;  // ← await it

  const run = await prisma.workflowRun.findUnique({
    where:   { id: runId },
    include: { nodeExecutions: true },
  });

  if (!run || run.userId !== userId) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  // Transform nodeExecutions to ensure outputData is properly formatted
  const nodeExecutions = (run.nodeExecutions || []).map((e: any) => ({
    nodeId:      e.nodeId,
    nodeType:    e.nodeType,
    label:       e.label,
    status:      e.status,
    duration:    e.duration,
    error:       e.error,
    outputData:  e.outputData ? (typeof e.outputData === 'string' ? JSON.parse(e.outputData) : e.outputData) : undefined,
    startedAt:   e.startedAt,
    completedAt: e.completedAt,
  }));

  return NextResponse.json({
    ...run,
    nodeExecutions,
  });
}