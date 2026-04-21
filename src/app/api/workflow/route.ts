import { auth } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';

// Install zod first: npm install zod
const SaveWorkflowSchema = z.object({
  name:  z.string().min(1).max(100),
  nodes: z.array(z.any()),
  edges: z.array(z.any()),
});

// POST /api/workflow — save current canvas
export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await req.json();
  const parsed = SaveWorkflowSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid data', details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const workflow = await prisma.workflow.create({
    data: {
      userId,
      name:  parsed.data.name,
      nodes: parsed.data.nodes,
      edges: parsed.data.edges,
    },
  });

  return NextResponse.json(workflow, { status: 201 });
}

// GET /api/workflow — load user's workflows
export async function GET() {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const workflows = await prisma.workflow.findMany({
    where: { userId },
    orderBy: { updatedAt: 'desc' },
    select: {
      id:        true,
      name:      true,
      updatedAt: true,
      _count: { select: { runs: true } },
    },
  });

  return NextResponse.json(workflows);
}