'use client';

import { useState, useRef, useEffect } from 'react';
import WorkflowCanvas from '@/components/canvas/WorkflowCanvas';
import LeftSidebar from '@/components/sidebar/LeftSidebar';
import RightSidebar from '@/components/sidebar/RightSidebar';
import { UserButton } from '@clerk/nextjs';
import { useWorkflowStore } from '@/store/workflowStore';
import { exportWorkflow, importWorkflow } from '@/lib/workflowIO';
import { SAMPLE_WORKFLOW } from '@/lib/sampleWorkflow';

export default function EditorPage() {
  const { nodes, edges, runs, addRun, updateRunStatus, updateRunNodes, updateNodeData, loadWorkflow, undo, redo } =
    useWorkflowStore();

  const [isRunning, setIsRunning] = useState(false);
  const [workflowId, setWorkflowId] = useState<string | null>(null);
  const importRef = useRef<HTMLInputElement>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const isMac = navigator.platform.includes('Mac');
      const ctrl  = isMac ? e.metaKey : e.ctrlKey;

      if (ctrl && e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        undo();
      }
      if (ctrl && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) {
        e.preventDefault();
        redo();
      }
      if (ctrl && e.key === 's') {
        e.preventDefault();
        handleSave();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [undo, redo]);

  const handleExport = () => {
    exportWorkflow(nodes, edges, 'My NextFlow Workflow');
  };

  const handleImport = async (file: File) => {
    try {
      const data = await importWorkflow(file);
      loadWorkflow(data.nodes, data.edges);
    } catch (err) {
      alert('Invalid workflow file.');
    }
  };

  const handleSave = async (): Promise<string | null> => {
    const res = await fetch('/api/workflow', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'My Workflow',
        nodes,
        edges,
      }),
    });

    if (!res.ok) return null;
    const data = await res.json();
    setWorkflowId(data.id);
    return data.id;
  };

  const pollRunStatus = async (runId: string) => {
    const MAX_WAIT = 120000; // 2 minutes max
    const startTime = Date.now();

    const interval = setInterval(async () => {
      // Auto-stop after 2 minutes
      if (Date.now() - startTime > MAX_WAIT) {
        clearInterval(interval);
        setIsRunning(false);
        updateRunStatus(runId, 'failed');
        return;
      }

      try {
        const res = await fetch(`/api/workflow/run/${runId}`);
        if (!res.ok) return;

        const data = await res.json();

        // Update node executions in sidebar
        updateRunNodes(runId, data.nodeExecutions.map((e: any) => ({
          nodeId:     e.nodeId,
          label:      e.label,
          status:     e.status.toLowerCase(),
          duration:   e.duration,
          outputData: e.outputData,  // ← pass output data
        })));

        // Push outputs back to canvas nodes
        data.nodeExecutions.forEach((e: any) => {
          if (e.status === 'SUCCESS' && e.outputData) {
            updateNodeData(e.nodeId, {
              isExecuting: false,
              output:      e.outputData.text,
              outputUrl:   e.outputData.imageUrl,
            });
          }
          if (e.status === 'RUNNING') {
            updateNodeData(e.nodeId, { isExecuting: true });
          }
          if (e.status === 'FAILED') {
            updateNodeData(e.nodeId, { isExecuting: false });
          }
        });

        // Check if ALL nodes are done (not just run status, since tasks execute async)
        const allNodesDone = data.nodeExecutions.every(
          (e: any) => e.status === 'SUCCESS' || e.status === 'FAILED'
        );

        if (allNodesDone) {
          const anyFailed = data.nodeExecutions.some((e: any) => e.status === 'FAILED');
          updateRunStatus(runId, anyFailed ? 'failed' : 'success');
          setIsRunning(false);
          clearInterval(interval);
        }

      } catch (err) {
        console.error('Polling error:', err);
      }
    }, 2000);

    // Store interval ref so Stop button can clear it
    intervalRef.current = interval;
  };

  const handleRun = async () => {
    if (nodes.length === 0) {
      alert('Add at least one node first.');
      return;
    }

    setIsRunning(true);

    // Auto-save first to get workflowId
    const savedId = workflowId || await handleSave();
    if (!savedId) {
      alert('Failed to save workflow.');
      setIsRunning(false);
      return;
    }

    // Call real run API
    const res = await fetch('/api/workflow/run', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        workflowId: savedId,
        nodes,
        edges,
      }),
    });

    if (!res.ok) {
      alert('Failed to start run.');
      setIsRunning(false);
      return;
    }

    const { runId } = await res.json();

    // Add optimistic run to sidebar immediately
    addRun({
      id:         runId,
      runNumber:  runs.length + 1,
      status:     'running',
      startedAt:  new Date().toLocaleTimeString(),
      nodes:      nodes.map((n) => ({
        nodeId:  n.id,
        label:   n.data.label,
        status:  'pending',
      })),
    });

    // Start polling for real status
    pollRunStatus(runId);
  };

  const handleStop = () => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    setIsRunning(false);
  };

  const handleNewWorkflow = () => {
    if (confirm('Start a new workflow? Current canvas will be cleared.')) {
      loadWorkflow([], []);
      setWorkflowId(null);
    }
  };

  return (
    <main className="flex w-screen h-screen overflow-hidden bg-[#0a0a0a]">
      <LeftSidebar />

      <section className="flex-1 h-full flex flex-col relative">
        {/* Floating Navbar - Centered Pill */}
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 backdrop-blur-xl">
          <div className="bg-[rgba(17,17,17,0.85)] border border-white/8 rounded-full px-6 py-3 flex items-center gap-4 shadow-lg">
            {/* Logo */}
            <span className="text-white text-xs font-semibold tracking-wide">NextFlow</span>
            
            {/* Center Buttons */}
            <div className="flex items-center gap-2">
              <button
                onClick={() => loadWorkflow(
                  SAMPLE_WORKFLOW.nodes,
                  SAMPLE_WORKFLOW.edges
                )}
                className="px-4 py-1.5 rounded-full bg-transparent border border-white/10 text-white text-xs font-medium hover:bg-white/5 transition-colors cursor-pointer"
              >
                ✨ Load Sample
              </button>

              <button
                onClick={handleNewWorkflow}
                className="px-3 py-1.5 rounded-full bg-transparent hover:bg-white/5 border border-white/10 text-white text-xs font-medium transition-colors cursor-pointer"
              >
                + New
              </button>

              <button
                onClick={handleExport}
                className="px-4 py-1.5 rounded-full bg-transparent border border-white/10 text-white text-xs font-medium hover:bg-white/5 transition-colors cursor-pointer"
              >
                ⬇ Export
              </button>

              <button
                onClick={() => importRef.current?.click()}
                className="px-4 py-1.5 rounded-full bg-transparent border border-white/10 text-white text-xs font-medium hover:bg-white/5 transition-colors cursor-pointer"
              >
                ⬆ Import
              </button>

              <input
                ref={importRef}
                type="file"
                accept=".json"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleImport(file);
                }}
              />
            </div>

            {/* Right Buttons */}
            <div className="flex items-center gap-2">
              <button
                onClick={handleSave}
                className="px-4 py-1.5 rounded-full bg-transparent border border-white/10 text-white text-xs font-medium hover:bg-white/5 transition-colors cursor-pointer"
              >
                💾 Save
              </button>

              {isRunning ? (
                <button
                  onClick={handleStop}
                  className="px-4 py-1.5 bg-red-600 hover:bg-red-500
                             text-white text-xs rounded-full transition-colors
                             flex items-center gap-2 font-medium shadow-lg shadow-red-600/50 cursor-pointer"
                >
                  <span className="w-2 h-2 bg-white rounded-sm"/>
                  Stop
                </button>
              ) : (
                <button
                  onClick={handleRun}
                  className="px-6 py-1.5 rounded-full bg-violet-600 hover:bg-violet-500
                             text-white text-xs font-medium transition-colors shadow-lg shadow-violet-600/50 cursor-pointer"
                >
                  ▶ Run
                </button>
              )}

              <UserButton />
            </div>
          </div>
        </div>

        {/* Canvas with responsive layout - full width */}
        <div className="flex-1 pt-20 overflow-hidden">
          <WorkflowCanvas />
        </div>
      </section>

      <RightSidebar />
    </main>
  );
}