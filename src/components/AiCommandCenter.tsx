import React, { useState, useEffect } from 'react';
import { 
  Bot, 
  Sparkles, 
  CheckCircle2, 
  XCircle, 
  AlertTriangle, 
  Clock, 
  ShieldAlert, 
  Search, 
  Database, 
  RefreshCw, 
  FileText, 
  Layers, 
  ChevronRight, 
  Play, 
  Check, 
  X,
  ExternalLink,
  Shield,
  Activity,
  Cpu
} from 'lucide-react';
import { taskManager } from '../ai/orchestrator/taskManager';
import { AiTask, AiAction, AiApproval, AiAlert, ResearchOutput, ContentVertical } from '../types';
import { STARTUPCREME_CONSTITUTION } from '../ai/policies/constitution';
import { store } from '../lib/store';

interface AiCommandCenterProps {
  onNavigateToEditor?: (initialDraft?: any) => void;
}

export const AiCommandCenter: React.FC<AiCommandCenterProps> = ({ onNavigateToEditor }) => {
  const [activeSubTab, setActiveSubTab] = useState<'overview' | 'tasks' | 'approvals' | 'actions' | 'research' | 'constitution'>('overview');
  const [metrics, setMetrics] = useState(taskManager.getSystemMetrics());
  const [tasks, setTasks] = useState<AiTask[]>(taskManager.listTasks(20));
  const [actions, setActions] = useState<AiAction[]>(taskManager.listActions(25));
  const [approvals, setApprovals] = useState<AiApproval[]>(taskManager.listApprovals());
  const [alerts, setAlerts] = useState<AiAlert[]>(taskManager.listAlerts());
  
  // Research Agent trigger state
  const [researchTopic, setResearchTopic] = useState('');
  const [researchVertical, setResearchVertical] = useState<ContentVertical>('tech');
  const [researchDepth, setResearchDepth] = useState<'brief' | 'standard' | 'deep'>('standard');
  const [isResearching, setIsResearching] = useState(false);
  const [researchResult, setResearchResult] = useState<ResearchOutput | null>(null);
  const [researchError, setResearchError] = useState<string | null>(null);

  // Selected item modal / detail
  const [selectedTask, setSelectedTask] = useState<AiTask | null>(null);
  const [actionNotice, setActionNotice] = useState<string | null>(null);

  const refreshData = () => {
    setMetrics(taskManager.getSystemMetrics());
    setTasks(taskManager.listTasks(20));
    setActions(taskManager.listActions(25));
    setApprovals(taskManager.listApprovals());
    setAlerts(taskManager.listAlerts());
  };

  useEffect(() => {
    refreshData();
    const interval = setInterval(refreshData, 3000);
    return () => clearInterval(interval);
  }, []);

  const handleApprove = async (approvalId: string) => {
    const res = await taskManager.approveTask(approvalId, 'Editorial Admin', 'Approved via Admin AI Command Center');
    if (res.success) {
      setActionNotice('Task approved and scheduled for execution.');
      refreshData();
      setTimeout(() => setActionNotice(null), 4000);
    }
  };

  const handleReject = async (approvalId: string) => {
    const res = await taskManager.rejectTask(approvalId, 'Editorial Admin', 'Rejected via Admin AI Command Center');
    if (res.success) {
      setActionNotice('Task rejected and marked as cancelled.');
      refreshData();
      setTimeout(() => setActionNotice(null), 4000);
    }
  };

  const handleDismissAlert = (alertId: string) => {
    taskManager.dismissAlert(alertId);
    refreshData();
  };

  const handleRunResearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!researchTopic.trim()) return;

    setIsResearching(true);
    setResearchError(null);
    setResearchResult(null);

    try {
      const { task } = await taskManager.submitTask({
        taskType: 'research_topic',
        assignedAgent: 'agent_research',
        payload: {
          topic: researchTopic.trim(),
          vertical: researchVertical,
          depth: researchDepth
        },
        priority: 'high',
        requestedBy: 'admin_command_center'
      });

      // Poll until task is completed or failed
      let currentTask = task;
      let attempts = 0;
      while ((currentTask.status === 'queued' || currentTask.status === 'running') && attempts < 25) {
        await new Promise(r => setTimeout(r, 400));
        currentTask = taskManager.getTask(task.id) || currentTask;
        attempts++;
      }

      refreshData();

      if (currentTask.status === 'completed' && currentTask.result) {
        setResearchResult(currentTask.result as ResearchOutput);
      } else {
        setResearchError(currentTask.error || 'Research failed or timed out.');
      }
    } catch (err: any) {
      setResearchError(err?.message || 'Error running research agent.');
    } finally {
      setIsResearching(false);
      refreshData();
    }
  };

  const handleCreateDraftFromAngle = async (angle: any) => {
    if (!researchResult) return;
    try {
      const slug = angle.title_proposal
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)/g, '')
        .slice(0, 80);

      const htmlContent = `
        <p><em>Research synthesis conducted by StartupCrème AI Research Desk on ${new Date().toLocaleDateString()}.</em></p>
        <h2>Executive Summary</h2>
        <p>${researchResult.summary}</p>
        <h2>Key Market Dynamics</h2>
        <ul>
          ${researchResult.key_claims.map(c => `<li><strong>${c.claim}</strong> &mdash; <em>${c.evidence_basis}</em> (Confidence: ${(c.confidence * 100).toFixed(0)}%)</li>`).join('')}
        </ul>
        <h2>Entities &amp; Structural Landscape</h2>
        <ul>
          ${researchResult.important_entities.map(e => `<li><strong>${e.name}</strong> (${e.type}): ${e.context}</li>`).join('')}
        </ul>
        <h2>Verified Evidence &amp; Citations</h2>
        <ul>
          ${researchResult.sources.map(s => `<li>${s.url ? `<a href="${s.url}" target="_blank" rel="noopener">${s.title}</a>` : s.title} &mdash; ${s.publisher || 'Verified Source'} (Credibility Score: ${(s.credibility_score * 100).toFixed(0)}%)</li>`).join('')}
        </ul>
      `;

      const saveRes = await store.savePost({
        title: angle.title_proposal,
        slug,
        vertical: angle.suggested_vertical,
        excerpt: `${researchResult.summary.slice(0, 180)}...`,
        content: htmlContent,
        status: 'draft',
        author_name: 'StartupCrème Research Desk',
        author_role: 'Autonomous Intelligence Desk',
        tags: [angle.suggested_vertical === 'finance' ? 'Finance' : 'Technology', 'Analysis', 'Market Research']
      });

      if (saveRes.success) {
        setActionNotice(`Article draft "${angle.title_proposal}" created in CMS!`);
        refreshData();
        if (onNavigateToEditor) {
          onNavigateToEditor(saveRes.post);
        }
      } else {
        alert('Failed to save draft: ' + saveRes.error);
      }
    } catch (e: any) {
      alert('Error creating draft: ' + e.message);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'completed':
        return <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">Completed</span>;
      case 'running':
        return <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-50 text-blue-700 border border-blue-200 animate-pulse">Running</span>;
      case 'waiting_approval':
        return <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-amber-50 text-amber-700 border border-amber-200">Awaiting Approval</span>;
      case 'queued':
        return <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-slate-50 text-slate-700 border border-slate-200">Queued</span>;
      case 'failed':
      case 'blocked_policy':
        return <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-rose-50 text-rose-700 border border-rose-200">Blocked / Failed</span>;
      default:
        return <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-slate-50 text-slate-600 border border-slate-200">{status}</span>;
    }
  };

  const getPolicyBadge = (level: string) => {
    switch (level) {
      case 'green':
        return <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-emerald-100 text-emerald-800">Green</span>;
      case 'yellow':
        return <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-amber-100 text-amber-800">Yellow</span>;
      case 'red':
        return <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-rose-100 text-rose-800">Red</span>;
      default:
        return null;
    }
  };

  return (
    <div className="space-y-6">
      {/* Action Notification Toast */}
      {actionNotice && (
        <div className="p-4 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800 flex items-center justify-between text-sm animate-fade-in">
          <div className="flex items-center space-x-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            <span>{actionNotice}</span>
          </div>
          <button onClick={() => setActionNotice(null)} className="text-emerald-700 hover:text-emerald-900">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* System Status Banner */}
      <div className="bg-slate-900 text-slate-100 rounded-xl p-6 shadow-sm border border-slate-800">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="flex items-start space-x-4">
            <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-lg text-amber-400">
              <Bot className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h2 className="text-lg font-bold text-white tracking-tight">Autonomous Media Control Plane</h2>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                  Foundation Phase Active
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-1">
                Controlled, policy-governed agent execution boundary ready for external orchestration (n8n, webhooks).
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-3 self-end md:self-center">
            <button
              onClick={refreshData}
              className="inline-flex items-center space-x-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium rounded-lg border border-slate-700 transition"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Sync</span>
            </button>
            <div className="px-3 py-1.5 bg-slate-800/80 rounded-lg border border-slate-700 text-xs flex items-center space-x-2">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
              <span className="text-slate-300 font-mono">M2M API /api/ai/ready</span>
            </div>
          </div>
        </div>

        {/* Metrics Bar */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mt-6 pt-6 border-t border-slate-800/80">
          <div className="bg-slate-800/40 p-3 rounded-lg border border-slate-800">
            <span className="text-[11px] text-slate-400 block font-medium">Total AI Tasks</span>
            <span className="text-xl font-bold text-white mt-0.5 block">{metrics.totalTasks}</span>
          </div>
          <div className="bg-slate-800/40 p-3 rounded-lg border border-slate-800">
            <span className="text-[11px] text-slate-400 block font-medium">Running</span>
            <span className="text-xl font-bold text-blue-400 mt-0.5 block">{metrics.running}</span>
          </div>
          <div className="bg-slate-800/40 p-3 rounded-lg border border-slate-800">
            <span className="text-[11px] text-slate-400 block font-medium">Pending Approvals</span>
            <span className="text-xl font-bold text-amber-400 mt-0.5 block">{metrics.pendingApprovalsCount}</span>
          </div>
          <div className="bg-slate-800/40 p-3 rounded-lg border border-slate-800">
            <span className="text-[11px] text-slate-400 block font-medium">Completed</span>
            <span className="text-xl font-bold text-emerald-400 mt-0.5 block">{metrics.completed}</span>
          </div>
          <div className="bg-slate-800/40 p-3 rounded-lg border border-slate-800">
            <span className="text-[11px] text-slate-400 block font-medium">Active Alerts</span>
            <span className="text-xl font-bold text-rose-400 mt-0.5 block">{metrics.activeAlertsCount}</span>
          </div>
          <div className="bg-slate-800/40 p-3 rounded-lg border border-slate-800">
            <span className="text-[11px] text-slate-400 block font-medium">Actions Audited</span>
            <span className="text-xl font-bold text-slate-200 mt-0.5 block">{metrics.totalActionsLogged}</span>
          </div>
        </div>
      </div>

      {/* Sub-Tabs Navigation */}
      <div className="flex border-b border-slate-200 bg-white px-2 rounded-t-lg">
        {[
          { id: 'overview', label: 'System Overview', icon: Activity },
          { id: 'research', label: 'Research Agent Lab', icon: Sparkles },
          { id: 'approvals', label: `Human Approvals (${metrics.pendingApprovalsCount})`, icon: ShieldAlert },
          { id: 'tasks', label: `AI Tasks (${metrics.totalTasks})`, icon: Layers },
          { id: 'actions', label: 'Audit Log', icon: FileText },
          { id: 'constitution', label: 'Editorial Constitution', icon: Shield },
        ].map(tab => {
          const Icon = tab.icon;
          const isActive = activeSubTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveSubTab(tab.id as any)}
              className={`flex items-center space-x-2 py-3 px-4 text-xs font-semibold border-b-2 transition ${
                isActive 
                  ? 'border-slate-900 text-slate-900 bg-slate-50/50' 
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              <Icon className={`w-4 h-4 ${isActive ? 'text-amber-600' : 'text-slate-400'}`} />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* Tab: Overview */}
      {activeSubTab === 'overview' && (
        <div className="space-y-6">
          {/* Active Alerts */}
          {alerts.length > 0 && (
            <div className="bg-rose-50 border border-rose-200 rounded-xl p-5">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center space-x-2 text-rose-800 font-bold text-sm">
                  <AlertTriangle className="w-4 h-4 text-rose-600" />
                  <span>Active Operational Alerts ({alerts.length})</span>
                </div>
              </div>
              <div className="space-y-2">
                {alerts.map(a => (
                  <div key={a.id} className="bg-white p-3 rounded-lg border border-rose-200 flex items-center justify-between">
                    <div>
                      <div className="flex items-center space-x-2">
                        <span className="text-xs font-bold text-slate-900">{a.title}</span>
                        <span className="text-[10px] font-mono uppercase px-1.5 py-0.5 rounded bg-rose-100 text-rose-800 font-semibold">{a.severity}</span>
                      </div>
                      <p className="text-xs text-slate-600 mt-1">{a.message}</p>
                    </div>
                    <button
                      onClick={() => handleDismissAlert(a.id)}
                      className="text-xs text-slate-500 hover:text-slate-800 underline ml-4 whitespace-nowrap"
                    >
                      Dismiss
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Pending Approvals Summary */}
          {approvals.filter(a => a.status === 'pending').length > 0 && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-5">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center space-x-2 text-amber-900 font-bold text-sm">
                  <ShieldAlert className="w-4 h-4 text-amber-600" />
                  <span>Awaiting Editorial Approval ({approvals.filter(a => a.status === 'pending').length})</span>
                </div>
                <button
                  onClick={() => setActiveSubTab('approvals')}
                  className="text-xs font-semibold text-amber-800 hover:text-amber-950 underline"
                >
                  Review All &rarr;
                </button>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {approvals.filter(a => a.status === 'pending').slice(0, 2).map(appr => (
                  <div key={appr.id} className="bg-white p-4 rounded-lg border border-amber-200 shadow-sm">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-bold text-slate-900">{appr.action_name}</span>
                      {getPolicyBadge(appr.policy_level)}
                    </div>
                    <p className="text-xs text-slate-600 mb-3">{appr.description}</p>
                    <div className="flex items-center space-x-2">
                      <button
                        onClick={() => handleApprove(appr.id)}
                        className="px-3 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded text-xs font-medium flex items-center space-x-1"
                      >
                        <Check className="w-3.5 h-3.5" />
                        <span>Approve</span>
                      </button>
                      <button
                        onClick={() => handleReject(appr.id)}
                        className="px-3 py-1 bg-slate-100 hover:bg-rose-50 text-slate-700 hover:text-rose-700 rounded text-xs font-medium border border-slate-200"
                      >
                        <X className="w-3.5 h-3.5" />
                        <span>Reject</span>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Quick Launch & System Status */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-bold text-slate-900 flex items-center space-x-2">
                  <Activity className="w-4 h-4 text-slate-500" />
                  <span>Recent AI Actions (Immutable Audit Trail)</span>
                </h3>
                <button onClick={() => setActiveSubTab('actions')} className="text-xs text-amber-600 font-semibold hover:underline">
                  View Full Trail
                </button>
              </div>

              {actions.length === 0 ? (
                <div className="py-8 text-center text-slate-400 text-xs">
                  No actions logged yet. Run the Research Agent or trigger tasks via API to populate.
                </div>
              ) : (
                <div className="divide-y divide-slate-100">
                  {actions.slice(0, 5).map(act => (
                    <div key={act.id} className="py-2.5 flex items-center justify-between text-xs">
                      <div className="flex items-center space-x-3">
                        {getPolicyBadge(act.policy_level)}
                        <div>
                          <span className="font-semibold text-slate-900">{act.action}</span>
                          <span className="text-slate-400 ml-2">by {act.agent}</span>
                        </div>
                      </div>
                      <div className="flex items-center space-x-3">
                        {getStatusBadge(act.status)}
                        <span className="text-[11px] text-slate-400">{new Date(act.created_at).toLocaleTimeString()}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm space-y-4">
              <h3 className="text-sm font-bold text-slate-900 flex items-center space-x-2">
                <Cpu className="w-4 h-4 text-slate-500" />
                <span>Subsystem Topology</span>
              </h3>

              <div className="space-y-3 text-xs">
                <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                  <span className="font-semibold text-slate-800 block">Orchestrator Protocol</span>
                  <span className="text-slate-500 text-[11px]">Strict Gateway: Agents &rarr; Tools &rarr; API &rarr; Store</span>
                </div>
                <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                  <span className="font-semibold text-slate-800 block">Human Oversight Policy</span>
                  <span className="text-slate-500 text-[11px]">GREEN (Auto) &bull; YELLOW (Approval) &bull; RED (Forbidden)</span>
                </div>
                <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                  <span className="font-semibold text-slate-800 block">External Orchestration (n8n)</span>
                  <span className="text-slate-500 text-[11px]">Bearer Token / X-StartupCreme-Automation-Secret</span>
                </div>
              </div>

              <div className="pt-2">
                <button
                  onClick={() => setActiveSubTab('research')}
                  className="w-full py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-semibold flex items-center justify-center space-x-2 transition"
                >
                  <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                  <span>Open Research Agent Lab</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tab: Research Agent Lab */}
      {activeSubTab === 'research' && (
        <div className="space-y-6">
          <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
            <div className="max-w-2xl mb-6">
              <div className="flex items-center space-x-2">
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800 uppercase">Agent 01</span>
                <h3 className="text-base font-bold text-slate-900">StartupCrème Lead Research Agent</h3>
              </div>
              <p className="text-xs text-slate-600 mt-1">
                Conducts deep, factual investigations grounded in verified evidence. Evaluates claims, extracts entities, and creates proposed article angles adhering strictly to the Editorial Constitution.
              </p>
            </div>

            <form onSubmit={handleRunResearch} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Investigation Topic or Market Event
                </label>
                <input
                  type="text"
                  value={researchTopic}
                  onChange={(e) => setResearchTopic(e.target.value)}
                  placeholder="e.g. LLM Inference Unit Economics: Fine-Tuned Open Weights vs Frontier APIs in 2026"
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-slate-900"
                  disabled={isResearching}
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Editorial Vertical
                  </label>
                  <select
                    value={researchVertical}
                    onChange={(e) => setResearchVertical(e.target.value as ContentVertical)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-900 focus:bg-white focus:outline-none"
                    disabled={isResearching}
                  >
                    <option value="tech">Technology (Engineering, AI, Infrastructure)</option>
                    <option value="finance">Finance (Venture, Macro, Fintech)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Research Depth
                  </label>
                  <select
                    value={researchDepth}
                    onChange={(e) => setResearchDepth(e.target.value as any)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-900 focus:bg-white focus:outline-none"
                    disabled={isResearching}
                  >
                    <option value="standard">Standard (Comprehensive Market Analysis)</option>
                    <option value="brief">Brief (Executive Briefing)</option>
                    <option value="deep">Deep Dive (Technical &amp; Financial Synthesis)</option>
                  </select>
                </div>
              </div>

              <div className="flex items-center space-x-3 pt-2">
                <button
                  type="submit"
                  disabled={isResearching || !researchTopic.trim()}
                  className="px-5 py-2.5 bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white rounded-lg text-xs font-bold flex items-center space-x-2 transition"
                >
                  {isResearching ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>Investigating &amp; Synthesizing...</span>
                    </>
                  ) : (
                    <>
                      <Play className="w-3.5 h-3.5" />
                      <span>Execute Research Agent</span>
                    </>
                  )}
                </button>

                <span className="text-xs text-slate-400">
                  Runs via pluggable provider (Gemini 3.8 Flash &bull; Archive &bull; Fallback)
                </span>
              </div>
            </form>
          </div>

          {/* Research Error */}
          {researchError && (
            <div className="bg-rose-50 border border-rose-200 rounded-xl p-4 text-xs text-rose-800">
              <strong>Research Error:</strong> {researchError}
            </div>
          )}

          {/* Validated Output Display */}
          {researchResult && (
            <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm space-y-6">
              <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                <div>
                  <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                    Validated Output (Confidence: {(researchResult.confidence * 100).toFixed(0)}%)
                  </span>
                  <h3 className="text-lg font-bold text-slate-900 mt-1">{researchResult.topic}</h3>
                </div>
                <div className="text-right">
                  <span className="text-xs text-slate-400 block">Recommended Next Action</span>
                  <span className="text-xs font-bold text-slate-800 uppercase">{researchResult.recommended_next_action}</span>
                </div>
              </div>

              <div>
                <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Executive Summary</h4>
                <p className="text-sm text-slate-800 leading-relaxed bg-slate-50 p-4 rounded-lg border border-slate-200">
                  {researchResult.summary}
                </p>
              </div>

              {/* Proposed Angles with Create Draft Button */}
              <div>
                <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                  Proposed Article Angles ({researchResult.potential_article_angles.length})
                </h4>
                <div className="space-y-3">
                  {researchResult.potential_article_angles.map((angle, i) => (
                    <div key={i} className="p-4 rounded-lg border border-slate-200 bg-white hover:border-slate-300 transition flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div>
                        <div className="flex items-center space-x-2">
                          <span className="font-bold text-sm text-slate-900">{angle.title_proposal}</span>
                          <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-slate-100 text-slate-700 uppercase">
                            {angle.suggested_vertical}
                          </span>
                        </div>
                        <p className="text-xs text-slate-600 mt-1">{angle.angle}</p>
                        <span className="text-[11px] text-slate-400 mt-1 block">Target: {angle.target_audience}</span>
                      </div>
                      <button
                        onClick={() => handleCreateDraftFromAngle(angle)}
                        className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded text-xs font-semibold whitespace-nowrap self-start sm:self-center transition flex items-center space-x-1.5"
                      >
                        <FileText className="w-3.5 h-3.5" />
                        <span>Create Draft in CMS</span>
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              {/* Substantiated Claims */}
              <div>
                <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                  Substantiated Claims ({researchResult.key_claims.length})
                </h4>
                <div className="space-y-2">
                  {researchResult.key_claims.map((claim, idx) => (
                    <div key={idx} className="p-3 bg-slate-50 rounded-lg border border-slate-200 text-xs">
                      <p className="font-semibold text-slate-900">{claim.claim}</p>
                      <p className="text-slate-500 mt-0.5">Basis: {claim.evidence_basis}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Verified Sources */}
              <div>
                <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                  Verified Sources &amp; Citations ({researchResult.sources.length})
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                  {researchResult.sources.map((s, idx) => (
                    <div key={idx} className="p-2.5 bg-slate-50 rounded border border-slate-200">
                      <span className="font-semibold text-slate-800 block">{s.title}</span>
                      <span className="text-slate-500 text-[11px] block">{s.publisher || 'Independent Source'} &bull; Credibility: {(s.credibility_score * 100).toFixed(0)}%</span>
                      {s.url && (
                        <a href={s.url} target="_blank" rel="noopener noreferrer" className="text-amber-600 hover:underline text-[11px] mt-1 inline-flex items-center space-x-1">
                          <span>View citation</span>
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Extracted Entities */}
              {researchResult.important_entities.length > 0 && (
                <div>
                  <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                    Extracted Entities ({researchResult.important_entities.length})
                  </h4>
                  <div className="flex flex-wrap gap-2">
                    {researchResult.important_entities.map((ent, idx) => (
                      <span key={idx} className="px-2.5 py-1 bg-slate-100 rounded-full text-xs text-slate-700 border border-slate-200">
                        <strong>{ent.name}</strong> <span className="text-slate-400">({ent.type})</span>
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Tab: Human Approvals */}
      {activeSubTab === 'approvals' && (
        <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-900">Pending Human Editorial Approvals</h3>
            <span className="text-xs text-slate-500">{approvals.length} total records</span>
          </div>

          {approvals.length === 0 ? (
            <div className="py-12 text-center text-slate-400 text-xs">
              No approval requests in queue. Yellow and Red actions trigger tickets automatically.
            </div>
          ) : (
            <div className="space-y-3">
              {approvals.map(appr => (
                <div key={appr.id} className="p-4 rounded-lg border border-slate-200 bg-slate-50/50 flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div>
                    <div className="flex items-center space-x-2">
                      <span className="font-bold text-sm text-slate-900">{appr.action_name}</span>
                      {getPolicyBadge(appr.policy_level)}
                      <span className={`text-[10px] font-semibold px-2 py-0.5 rounded ${
                        appr.status === 'approved' ? 'bg-emerald-100 text-emerald-800' :
                        appr.status === 'rejected' ? 'bg-rose-100 text-rose-800' :
                        'bg-amber-100 text-amber-800'
                      }`}>
                        {appr.status}
                      </span>
                    </div>
                    <p className="text-xs text-slate-600 mt-1">{appr.description}</p>
                    <span className="text-[11px] text-slate-400 mt-1 block">Requested by: {appr.agent} &bull; {new Date(appr.created_at).toLocaleString()}</span>
                  </div>

                  {appr.status === 'pending' && (
                    <div className="flex items-center space-x-2 self-end md:self-center">
                      <button
                        onClick={() => handleApprove(appr.id)}
                        className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded text-xs font-semibold flex items-center space-x-1"
                      >
                        <Check className="w-3.5 h-3.5" />
                        <span>Approve Action</span>
                      </button>
                      <button
                        onClick={() => handleReject(appr.id)}
                        className="px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 rounded text-xs font-semibold border border-rose-200 flex items-center space-x-1"
                      >
                        <X className="w-3.5 h-3.5" />
                        <span>Reject</span>
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Tab: Tasks List */}
      {activeSubTab === 'tasks' && (
        <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-900">Autonomous Task Queue</h3>
            <span className="text-xs text-slate-500">{tasks.length} total</span>
          </div>

          {tasks.length === 0 ? (
            <div className="py-12 text-center text-slate-400 text-xs">
              No tasks logged yet. Tasks submitted via API or the Research Lab appear here.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-200 text-slate-400 font-semibold uppercase text-[10px]">
                    <th className="pb-2">Task ID</th>
                    <th className="pb-2">Type</th>
                    <th className="pb-2">Assigned Agent</th>
                    <th className="pb-2">Priority</th>
                    <th className="pb-2">Status</th>
                    <th className="pb-2">Created</th>
                    <th className="pb-2 text-right">Inspect</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {tasks.map(t => (
                    <tr key={t.id} className="hover:bg-slate-50/80">
                      <td className="py-3 font-mono text-[11px] text-slate-500">{t.id.slice(0, 14)}...</td>
                      <td className="py-3 font-semibold text-slate-900">{t.task_type}</td>
                      <td className="py-3 text-slate-600">{t.assigned_agent}</td>
                      <td className="py-3 uppercase text-[10px] font-bold text-slate-500">{t.priority}</td>
                      <td className="py-3">{getStatusBadge(t.status)}</td>
                      <td className="py-3 text-slate-400">{new Date(t.created_at).toLocaleTimeString()}</td>
                      <td className="py-3 text-right">
                        <button
                          onClick={() => setSelectedTask(t)}
                          className="text-amber-600 hover:underline font-semibold"
                        >
                          Details
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Tab: Action Audit Log */}
      {activeSubTab === 'actions' && (
        <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-900">Autonomous Action Audit Log (Immutable)</h3>
            <span className="text-xs text-slate-500">{actions.length} records</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-200 text-slate-400 font-semibold uppercase text-[10px]">
                  <th className="pb-2">Timestamp</th>
                  <th className="pb-2">Agent</th>
                  <th className="pb-2">Action</th>
                  <th className="pb-2">Policy Level</th>
                  <th className="pb-2">Status</th>
                  <th className="pb-2">Confidence</th>
                  <th className="pb-2">Summary / Reason</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {actions.map(act => (
                  <tr key={act.id} className="hover:bg-slate-50/80">
                    <td className="py-3 text-slate-400 text-[11px] whitespace-nowrap">{new Date(act.created_at).toLocaleTimeString()}</td>
                    <td className="py-3 font-medium text-slate-700">{act.agent}</td>
                    <td className="py-3 font-semibold text-slate-900">{act.action}</td>
                    <td className="py-3">{getPolicyBadge(act.policy_level)}</td>
                    <td className="py-3">{getStatusBadge(act.status)}</td>
                    <td className="py-3 text-slate-600">{act.confidence ? `${(act.confidence * 100).toFixed(0)}%` : '—'}</td>
                    <td className="py-3 text-slate-500 max-w-xs truncate">{act.reason || act.error || 'Execution logged'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab: Editorial Constitution */}
      {activeSubTab === 'constitution' && (
        <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm space-y-6">
          <div>
            <h3 className="text-base font-bold text-slate-900">{STARTUPCREME_CONSTITUTION.publicationName} Editorial Constitution</h3>
            <p className="text-xs text-slate-500 mt-1">{STARTUPCREME_CONSTITUTION.tagline}</p>
          </div>

          <div>
            <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">Quality Principles &amp; Verification Rules</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {STARTUPCREME_CONSTITUTION.qualityPrinciples.map(p => (
                <div key={p.id} className="p-3 bg-slate-50 rounded-lg border border-slate-200 text-xs">
                  <span className="font-bold text-slate-900 block">{p.name}</span>
                  <span className="text-slate-600 text-[11px] mt-1 block">{p.description}</span>
                </div>
              ))}
            </div>
          </div>

          <div>
            <h4 className="text-xs font-bold text-rose-800 uppercase tracking-wider mb-2">Strictly Forbidden Actions (Enforced at Code Level)</h4>
            <ul className="list-disc list-inside space-y-1 text-xs text-slate-700 bg-rose-50/50 p-4 rounded-lg border border-rose-200">
              {STARTUPCREME_CONSTITUTION.forbiddenActions.map((act, i) => (
                <li key={i}>{act}</li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {/* Task Inspection Modal */}
      {selectedTask && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl max-w-xl w-full p-6 shadow-xl border border-slate-200 space-y-4 max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <span className="font-mono text-xs text-slate-400 block">{selectedTask.id}</span>
                <h4 className="font-bold text-slate-900 text-sm">{selectedTask.task_type}</h4>
              </div>
              <button onClick={() => setSelectedTask(null)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-2 text-xs">
              <div className="flex justify-between py-1 border-b border-slate-100">
                <span className="text-slate-500">Status</span>
                <span>{getStatusBadge(selectedTask.status)}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-100">
                <span className="text-slate-500">Assigned Agent</span>
                <span className="font-semibold text-slate-800">{selectedTask.assigned_agent}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-100">
                <span className="text-slate-500">Requested By</span>
                <span className="text-slate-700 font-mono">{selectedTask.requested_by}</span>
              </div>
              {selectedTask.idempotency_key && (
                <div className="flex justify-between py-1 border-b border-slate-100">
                  <span className="text-slate-500">Idempotency Key</span>
                  <span className="text-slate-700 font-mono">{selectedTask.idempotency_key}</span>
                </div>
              )}
            </div>

            <div>
              <span className="text-xs font-bold text-slate-700 block mb-1">Payload:</span>
              <pre className="bg-slate-900 text-slate-100 p-3 rounded text-[11px] overflow-x-auto">
                {JSON.stringify(selectedTask.payload, null, 2)}
              </pre>
            </div>

            {selectedTask.result && (
              <div>
                <span className="text-xs font-bold text-slate-700 block mb-1">Result:</span>
                <pre className="bg-slate-900 text-emerald-400 p-3 rounded text-[11px] overflow-x-auto max-h-48">
                  {JSON.stringify(selectedTask.result, null, 2)}
                </pre>
              </div>
            )}

            {selectedTask.error && (
              <div className="p-3 bg-rose-50 rounded border border-rose-200 text-xs text-rose-800">
                <strong>Error:</strong> {selectedTask.error}
              </div>
            )}

            <div className="text-right pt-2">
              <button
                onClick={() => setSelectedTask(null)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded text-xs font-semibold"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
