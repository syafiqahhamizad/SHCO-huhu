import React, { useMemo, useState } from 'react';
import { Sparkles, Send, Bot, Briefcase, ClipboardList, MessageSquareText, Loader2 } from 'lucide-react';

const MODES = [
  { value: 'general', label: 'General Assistant' },
  { value: 'meeting', label: 'Meeting Summary' },
  { value: 'task', label: 'Task Planner' },
  { value: 'email', label: 'Email Drafting' },
  { value: 'review', label: 'Matter Review' },
] as const;

export const AIAgentView: React.FC = () => {
  const [mode, setMode] = useState<(typeof MODES)[number]['value']>('general');
  const [prompt, setPrompt] = useState('');
  const [context, setContext] = useState('Matter: SHC/LIT/SH/QAL/001/2025\nClient: Nur Syakirah Aiman\nCurrent issue: Appeal filing and client update');
  const [reply, setReply] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const activeModeLabel = useMemo(
    () => MODES.find((item) => item.value === mode)?.label ?? 'General Assistant',
    [mode]
  );

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!prompt.trim()) return;

    setIsLoading(true);
    setReply('');

    try {
      const response = await fetch('/api/ai/assistant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode,
          prompt,
          context,
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data?.error || 'AI assistant request failed.');
      }

      setReply(data.reply || 'No response returned.');
    } catch (error: any) {
      setReply(error?.message || 'The AI assistant is unavailable right now.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="bg-white border border-[#E1DCCF] rounded-xl shadow-xs p-4 sm:p-5">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <div>
            <h2 className="font-serif text-xl font-bold text-[#16223A] flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-[#A9814A]" />
              AI Agent Workspace
            </h2>
            <p className="text-xs text-slate-500 mt-1">
              Use AI for meeting summaries, legal task planning, drafting, and case review support.
            </p>
          </div>
          <div className="rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.12em] text-amber-900">
            Gemini-powered assistant
          </div>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[320px_1fr]">
        <div className="bg-white border border-[#E1DCCF] rounded-xl shadow-xs p-4 space-y-4">
          <div className="flex items-center gap-2 text-[#16223A] font-bold text-xs uppercase tracking-[0.12em]">
            <Bot className="w-4 h-4 text-[#A9814A]" />
            Agent Modes
          </div>

          <div className="space-y-2">
            {MODES.map((item) => (
              <button
                key={item.value}
                type="button"
                onClick={() => setMode(item.value)}
                className={`w-full text-left rounded-lg border px-3 py-2 text-xs transition ${
                  mode === item.value
                    ? 'border-[#A9814A] bg-amber-50 text-[#16223A] font-bold'
                    : 'border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100'
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>

          <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 space-y-3 text-[11px] text-slate-600">
            <div className="flex items-center gap-2 font-bold text-[#16223A] uppercase tracking-[0.08em]">
              <Briefcase className="w-4 h-4 text-[#A9814A]" />
              Use cases
            </div>
            <ul className="space-y-1.5 pl-4 list-disc">
              <li>Summarize client meetings</li>
              <li>Break down legal tasks</li>
              <li>Draft internal or client emails</li>
              <li>Review matter status & risks</li>
            </ul>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="bg-white border border-[#E1DCCF] rounded-xl shadow-xs p-4 space-y-4">
          <div className="flex items-center justify-between gap-3 border-b border-[#E1DCCF] pb-3">
            <div className="flex items-center gap-2 font-serif font-bold text-[#16223A] text-sm">
              <MessageSquareText className="w-4 h-4 text-[#A9814A]" />
              {activeModeLabel}
            </div>
          </div>

          <div>
            <label className="block text-[10px] font-bold uppercase tracking-[0.12em] text-slate-600 mb-1">
              Context
            </label>
            <textarea
              value={context}
              onChange={(e) => setContext(e.target.value)}
              rows={5}
              className="w-full border border-slate-200 rounded-lg p-2.5 text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#A9814A]/25"
              placeholder="Add matter details, case facts, client notes, or transcript context."
            />
          </div>

          <div>
            <label className="block text-[10px] font-bold uppercase tracking-[0.12em] text-slate-600 mb-1">
              Prompt
            </label>
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              rows={7}
              className="w-full border border-slate-200 rounded-lg p-2.5 text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#A9814A]/25"
              placeholder="Ask the AI to summarize, draft, plan, or review the matter."
            />
          </div>

          <button
            type="submit"
            disabled={isLoading || !prompt.trim()}
            className="w-full flex items-center justify-center gap-2 bg-[#16223A] hover:bg-[#1F2E4D] text-white font-bold rounded-lg px-4 py-2.5 text-xs disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            {isLoading ? 'Generating...' : 'Run AI Agent'}
          </button>

          <div className="rounded-xl border border-[#E1DCCF] bg-[#F8F6F1] p-3 min-h-[180px]">
            <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.12em] text-slate-600 mb-2">
              <ClipboardList className="w-4 h-4 text-[#A9814A]" />
              Output
            </div>
            {isLoading ? (
              <div className="flex items-center gap-2 text-sm text-slate-600">
                <Loader2 className="w-4 h-4 animate-spin text-[#A9814A]" />
                The agent is thinking...
              </div>
            ) : (
              <pre className="whitespace-pre-wrap text-xs leading-6 text-slate-700 font-sans">
                {reply || 'Your AI-generated summary, task list, or draft will appear here.'}
              </pre>
            )}
          </div>
        </form>
      </div>
    </div>
  );
};
