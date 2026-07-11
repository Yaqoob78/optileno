import React, { useState, useEffect } from 'react';
import { usePlanner } from '../../hooks/usePlanner';
import { useUser } from '../../hooks/useUser';
import { Modal } from '../common/Modal';
import { Target, Sparkles, Brain, Lock, ArrowRight, Loader2, Calendar } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export const OnboardingFlow: React.FC = () => {
    const { goals, tasks, isLoading } = usePlanner();
    const { isUltra } = useUser();
    const navigate = useNavigate();

    const [isOpen, setIsOpen] = useState(false);
    const [step, setStep] = useState<1 | 2 | 3>(1);
    const [goalTitle, setGoalTitle] = useState('');
    const [isGenerating, setIsGenerating] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Initial Check
    useEffect(() => {
        const hasCompleted = localStorage.getItem('optileno_onboarding_completed');

        // Wait till data is loaded to make sure we don't flash it
        if (!isLoading && !hasCompleted && goals.length === 0 && tasks.length === 0) {
            // Delay slightly to ensure smooth rendering
            const timer = setTimeout(() => setIsOpen(true), 1500);
            return () => clearTimeout(timer);
        }
    }, [isLoading, goals.length, tasks.length]);

    const handleDismiss = () => {
        localStorage.setItem('optileno_onboarding_completed', 'true');
        setIsOpen(false);
    };

    const handleGenerate = async () => {
        if (!goalTitle.trim()) {
            setError('Please enter a goal to continue.');
            return;
        }

        setError(null);
        setStep(2);
        setIsGenerating(true);
        setTimeout(() => {
            setIsGenerating(false);
            setStep(3);
        }, 1200);
    };

    const openLenoChat = () => {
        const prompt = `I added this goal: "${goalTitle}". Please ask me 2-3 quick questions first, then break it down into tasks, habits, and deep work based on my timeline.`;
        localStorage.setItem('optileno_chat_prefill', prompt);
        localStorage.setItem('optileno_chat_mode', 'PLAN');
        handleDismiss();
        navigate('/chat');
    };

    if (!isOpen) return null;

    return (
        <Modal
            isOpen={isOpen}
            onOpenChange={(open) => {
                if (!open && !isGenerating) handleDismiss();
            }}
            title={
                step === 1 ? "Welcome to Optileno" :
                    step === 2 ? "Preparing Leno Chat..." :
                        "Ready To Plan"
            }
            maxWidth="md"
            footer={null} // We manage our own custom footer buttons inside the body
        >
            <div className="flex flex-col gap-6 pt-2 pb-4">

                {/* STEP 1: The Primary Objective */}
                {step === 1 && (
                    <div className="flex flex-col gap-5 animate-in fade-in slide-in-from-bottom-4 duration-500">
                        <div className="flex items-center justify-center p-4 bg-primary/10 rounded-full w-16 h-16 mx-auto mb-2 text-primary">
                            <Target size={32} />
                        </div>
                        <div className="text-center">
                            <h3 className="text-xl font-bold text-[var(--text-primary)] mb-2">What's your #1 objective right now?</h3>
                            <p className="text-[var(--text-secondary)] text-sm mb-6">
                                Stop staring at a blank slate. Tell us your biggest goal, and Optileno will instantly generate an execution plan for you.
                            </p>
                        </div>

                        <div className="flex flex-col gap-2">
                            <input
                                type="text"
                                placeholder="e.g., Launch my SaaS MVP, Lose 10 lbs, Learn Rust..."
                                value={goalTitle}
                                onChange={(e) => setGoalTitle(e.target.value)}
                                className="w-full px-4 py-3 bg-black/10 dark:bg-black/20 border border-[var(--border-primary)] rounded-xl outline-none focus:border-[var(--primary)] text-[var(--text-primary)] transition-all placeholder:text-[var(--text-tertiary)]"
                                autoFocus
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter') handleGenerate();
                                }}
                            />
                            {error && <span className="text-xs text-red-500 mt-1">{error}</span>}
                        </div>

                        <div className="flex justify-between items-center mt-4">
                            <button
                                onClick={handleDismiss}
                                className="text-sm text-[var(--text-tertiary)] hover:text-[var(--text-primary)] transition-colors"
                            >
                                Skip for now
                            </button>
                            <button
                                onClick={handleGenerate}
                                className="app-modal-btn app-modal-btn-primary flex items-center gap-2"
                                disabled={!goalTitle.trim()}
                            >
                                <Sparkles size={16} /> Generate Plan
                            </button>
                        </div>
                    </div>
                )}

                {/* STEP 2: The Leno Magic */}
                {step === 2 && (
                    <div className="flex flex-col items-center justify-center gap-6 py-8 animate-in fade-in duration-500">
                        <div className="relative">
                            <div className="absolute inset-0 bg-primary/20 rounded-full blur-xl animate-pulse"></div>
                            <div className="relative bg-black/10 dark:bg-black/40 p-5 rounded-full border border-primary/30">
                                <Loader2 size={40} className="text-primary animate-spin" />
                            </div>
                        </div>
                        <div className="text-center">
                            <h3 className="text-lg font-bold text-[var(--text-primary)] mb-2">Preparing your goal...</h3>
                            <p className="text-[var(--text-secondary)] text-sm max-w-[280px] mx-auto">
                                Preparing your goal briefing for Leno chat agentic planning.
                            </p>
                        </div>
                    </div>
                )}

                {/* STEP 3: The Ultra Pitch & Journey Begin */}
                {step === 3 && (
                    <div className="flex flex-col gap-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                        <div className="flex items-center justify-center p-4 bg-green-500/10 rounded-full w-16 h-16 mx-auto text-green-500">
                            <Sparkles size={32} />
                        </div>
                        <div className="text-center">
                            <h3 className="text-2xl font-bold bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent mb-2">Ready To Plan</h3>
                            <p className="text-[var(--text-secondary)] text-sm mb-4">
                                Leno will build your personalized breakdown for <strong>"{goalTitle}"</strong> in chat.
                            </p>
                        </div>

                        {/* Ultra pitch block */}
                        {!isUltra && (
                            <div className="relative p-[1px] rounded-2xl bg-gradient-to-r from-yellow-500/50 to-amber-500/50 overflow-hidden shadow-lg mb-2">
                                <div className="absolute inset-0 bg-yellow-500/10 opacity-50"></div>
                                <div className="relative bg-[var(--bg-card)] rounded-[15px] p-5 flex flex-col gap-3">
                                    <div className="flex items-center gap-2 font-bold text-yellow-500">
                                        <Lock size={16} /> Unlock Ultra Output
                                    </div>
                                    <p className="text-sm text-[var(--text-secondary)] leading-relaxed">
                                        Get the most out of your execution. Upgrade to <strong>Ultra</strong> to let AI track burnout risk and schedule Deep Work sessions specifically for <em>"{goalTitle}"</em>.
                                    </p>
                                    <div className="flex gap-4 mt-2">
                                        <div className="flex items-center gap-2 text-xs text-[var(--text-primary)]">
                                            <Calendar size={14} className="text-yellow-600" /> Goal Timeline
                                        </div>
                                        <div className="flex items-center gap-2 text-xs text-[var(--text-primary)]">
                                            <Brain size={14} className="text-yellow-600" /> AI Analytics
                                        </div>
                                    </div>
                                    <button
                                        onClick={() => { handleDismiss(); navigate('/settings'); }}
                                        className="mt-3 w-full py-2.5 rounded-lg bg-yellow-500 hover:bg-yellow-400 text-black font-semibold text-sm transition-colors shadow-[0_0_15px_rgba(234,179,8,0.3)]"
                                    >
                                        Upgrade to Ultra
                                    </button>
                                </div>
                            </div>
                        )}

                        {isUltra && (
                            <div className="relative p-[1px] rounded-2xl bg-gradient-to-r from-cyan-500/40 to-emerald-500/40 overflow-hidden shadow-lg mb-2">
                                <div className="relative bg-[var(--bg-card)] rounded-[15px] p-5 flex flex-col gap-3">
                                    <div className="flex items-center gap-2 font-bold text-cyan-400">
                                        <Brain size={16} /> Agentic Planning
                                    </div>
                                    <p className="text-sm text-[var(--text-secondary)] leading-relaxed">
                                        Leno will ask a few focused questions and then generate tasks, habits, and deep work aligned to your goal timeline.
                                    </p>
                                </div>
                            </div>
                        )}

                        <button
                            onClick={openLenoChat}
                            className="w-full py-3 rounded-xl font-medium transition-colors flex items-center justify-center gap-2 bg-[var(--primary)] text-white hover:bg-[var(--primary)]/90"
                        >
                            Open Leno Chat <ArrowRight size={16} />
                        </button>
                    </div>
                )}
            </div>
        </Modal>
    );
};
