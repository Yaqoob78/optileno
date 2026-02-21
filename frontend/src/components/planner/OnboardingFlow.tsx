import React, { useState } from 'react';
import { Target, Activity, CheckSquare, ArrowRight, Zap, CheckCircle2 } from 'lucide-react';
import { Modal } from '../common/Modal';
import { useUserStore } from '../../stores/useUserStore';

export const OnboardingFlow: React.FC = () => {
    const { profile, preferences, updatePreference } = useUserStore();
    const [step, setStep] = useState<number>(0);
    const [isOpen, setIsOpen] = useState(!preferences?.hasCompletedOnboarding);

    if (!isOpen) return null;

    const steps = [
        {
            title: "Users don't pay for planning",
            subtitle: "They pay for fewer missed outcomes.",
            description: "Welcome. Ultra is designed for high-agency individuals who suffer from an execution gap, not a knowledge gap. Let's close your gap right now.",
            icon: <Zap size={40} className="text-[#f59e0b]" />,
            color: 'text-[#f59e0b]',
            bg: 'bg-[#f59e0b]/10',
            buttonText: "Let's Begin"
        },
        {
            title: "1. Lock in the Target",
            subtitle: "What is the single most important outcome you must hit?",
            description: "Goals aren't wishes, they are destinations. Choose a clear, measurable goal that we will relentlessly measure your pace against.",
            icon: <Target size={40} className="text-[#3b82f6]" />,
            color: 'text-[#3b82f6]',
            bg: 'bg-[#3b82f6]/10',
            buttonText: "Define My Goal",
            inputPlaceholder: "e.g., Ship the MVP by Q3, Pass the Bar Exam..."
        },
        {
            title: "2. The Daily Engine",
            subtitle: "What habit guarantees the goal?",
            description: "You do not rise to the level of your goals, you fall to the level of your systems. Define one repeated baseline action.",
            icon: <Activity size={40} className="text-[#10b981]" />,
            color: 'text-[#10b981]',
            bg: 'bg-[#10b981]/10',
            buttonText: "Set My Habit",
            inputPlaceholder: "e.g., 2 hours of Deep Work daily..."
        },
        {
            title: "3. The Immediate Step",
            subtitle: "What is your next physical action?",
            description: "Momentum is everything. Break the goal down into an immediate action that you can complete today.",
            icon: <CheckSquare size={40} className="text-[#8b5cf6]" />,
            color: 'text-[#8b5cf6]',
            bg: 'bg-[#8b5cf6]/10',
            buttonText: "Lock in Task",
            inputPlaceholder: "e.g., Draft database schema, Outline chapter 1..."
        }
    ];

    const handleNext = () => {
        if (step < steps.length - 1) {
            setStep((prev) => prev + 1);
        } else {
            // Finish onboarding
            updatePreference('hasCompletedOnboarding', true);
            setIsOpen(false);
        }
    };

    const currentStep = steps[step];

    return (
        <React.Fragment>
            {/* Using a fixed overlay on top of everything to guarantee they see it */}
            <div className="fixed inset-0 z-[99999] bg-black/80 backdrop-blur-xl flex items-center justify-center p-4">
                <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-lg shadow-2xl shadow-indigo-500/10 overflow-hidden flex flex-col relative text-slate-50">

                    {/* Progress Bar */}
                    <div className="h-1.5 w-full bg-slate-800 overflow-hidden">
                        <div
                            className="h-full bg-gradient-to-r from-blue-500 via-indigo-500 to-purple-500 transition-all duration-700 ease-in-out"
                            style={{ width: `${((step + 1) / steps.length) * 100}%` }}
                        />
                    </div>

                    <div className="p-8 md:p-10 flex flex-col items-center text-center">
                        <div className={`p-5 rounded-2xl mb-8 ${currentStep.bg} border border-white/10 shadow-inner`}>
                            {currentStep.icon}
                        </div>

                        <h2 className="text-2xl md:text-3xl font-bold tracking-tight mb-3 font-sans">
                            {currentStep.title}
                        </h2>

                        <h3 className={`text-lg font-semibold mb-4 ${currentStep.color}`}>
                            {currentStep.subtitle}
                        </h3>

                        <p className="text-slate-400 leading-relaxed mb-8 max-w-sm">
                            {currentStep.description}
                        </p>

                        {currentStep.inputPlaceholder && (
                            <div className="w-full mb-8 relative">
                                <input
                                    type="text"
                                    placeholder={currentStep.inputPlaceholder}
                                    className="w-full bg-slate-800/50 border border-slate-700 rounded-xl px-5 py-4 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 transition-all text-white placeholder-slate-500"
                                    autoFocus
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter') handleNext();
                                    }}
                                />
                                {step === 3 && (
                                    <div className="absolute -bottom-6 left-0 right-0 text-xs text-indigo-400 font-medium tracking-wide pointer-events-none">
                                        We will map this directly.
                                    </div>
                                )}
                            </div>
                        )}

                        <button
                            className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white rounded-xl px-6 py-4 font-bold text-lg flex items-center justify-center gap-3 transition-all active:scale-[0.98] shadow-lg shadow-indigo-500/25"
                            onClick={handleNext}
                        >
                            {currentStep.buttonText}
                            {step < steps.length - 1 ? <ArrowRight size={20} /> : <CheckCircle2 size={20} />}
                        </button>

                        {step === 0 && (
                            <button
                                className="mt-6 text-sm text-slate-500 hover:text-slate-300 transition-colors"
                                onClick={() => {
                                    updatePreference('hasCompletedOnboarding', true);
                                    setIsOpen(false);
                                }}
                            >
                                Skip Onboarding (I know what I'm doing)
                            </button>
                        )}
                    </div>
                </div>
            </div>
        </React.Fragment>
    );
};
