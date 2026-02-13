// frontend/src/components/chat/AIActionConfirmation.tsx
/**
 * AI Action Confirmation Component
 * 
 * Displays AI suggestions that require user confirmation:
 * - Goal creation requests
 * - Task creation requests  
 * - Habit creation requests
 * - Schedule modifications
 * 
 * User can confirm, modify, or reject the suggestion.
 */

import React, { useState } from 'react';
import {
    Target,
    CheckSquare,
    Repeat,
    Clock,
    Check,
    X,
    Edit2,
    Sparkles,
    ArrowRight,
} from 'lucide-react';
import './AIActionConfirmation.css';

interface ActionData {
    title?: string;
    name?: string;
    description?: string;
    priority?: string;
    category?: string;
    target_date?: string;
    due_date?: string;
    frequency?: string;
    reasoning?: string;
}

interface AIActionConfirmationProps {
    actionType: 'CREATE_GOAL' | 'CREATE_TASK' | 'CREATE_HABIT' | 'UPDATE_GOAL' | 'CREATE_MULTIPLE_TASKS';
    actionId: string;
    data: ActionData | { tasks?: ActionData[]; count?: number };
    message: string;
    confirmButtons?: string[];
    onConfirm: (actionId: string) => void;
    onReject: (actionId: string) => void;
    onModify?: (actionId: string, modifiedData: ActionData) => void;
}

const AIActionConfirmation: React.FC<AIActionConfirmationProps> = ({
    actionType,
    actionId,
    data,
    message,
    confirmButtons = ['Confirm', 'Cancel'],
    onConfirm,
    onReject,
    onModify,
}) => {
    const [isExpanded, setIsExpanded] = useState(true);
    const [isProcessing, setIsProcessing] = useState(false);

    const getActionIcon = () => {
        switch (actionType) {
            case 'CREATE_GOAL':
                return <Target size={20} />;
            case 'CREATE_TASK':
                return <CheckSquare size={20} />;
            case 'CREATE_HABIT':
                return <Repeat size={20} />;
            case 'CREATE_MULTIPLE_TASKS':
                return <CheckSquare size={20} />;
            default:
                return <Sparkles size={20} />;
        }
    };

    const getActionTitle = () => {
        switch (actionType) {
            case 'CREATE_GOAL':
                return 'New Goal';
            case 'CREATE_TASK':
                return 'New Task';
            case 'CREATE_HABIT':
                return 'New Habit';
            case 'CREATE_MULTIPLE_TASKS':
                return `Create ${(data as any).count || 0} Tasks`;
            default:
                return 'AI Suggestion';
        }
    };

    const getActionColor = () => {
        switch (actionType) {
            case 'CREATE_GOAL':
                return '#8b5cf6';
            case 'CREATE_TASK':
                return '#3b82f6';
            case 'CREATE_HABIT':
                return '#22c55e';
            default:
                return '#6366f1';
        }
    };

    const handleConfirm = async () => {
        setIsProcessing(true);
        try {
            await onConfirm(actionId);
        } finally {
            setIsProcessing(false);
        }
    };

    const handleReject = async () => {
        setIsProcessing(true);
        try {
            await onReject(actionId);
        } finally {
            setIsProcessing(false);
        }
    };

    const formatDate = (dateStr: string | undefined): string => {
        if (!dateStr) return 'No deadline';
        const date = new Date(dateStr);
        return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    };

    const getPriorityEmoji = (priority: string | undefined): string => {
        switch (priority?.toLowerCase()) {
            case 'urgent':
                return '🔴';
            case 'high':
                return '🟠';
            case 'medium':
                return '🟡';
            case 'low':
                return '🟢';
            default:
                return '⚪';
        }
    };

    const singleData = data as ActionData;
    const multiData = data as { tasks?: ActionData[]; count?: number };

    return (
        <div
            className={`ai-action-confirmation ${isExpanded ? 'expanded' : ''}`}
            style={{ '--action-color': getActionColor() } as React.CSSProperties}
        >
            {/* Header */}
            <div
                className="aac-header"
                onClick={() => setIsExpanded(!isExpanded)}
            >
                <div className="aac-icon" style={{ backgroundColor: `${getActionColor()}20`, color: getActionColor() }}>
                    {getActionIcon()}
                </div>
                <div className="aac-header-text">
                    <span className="aac-badge">AI Suggestion</span>
                    <span className="aac-title">{getActionTitle()}</span>
                </div>
                <ArrowRight
                    size={16}
                    className={`aac-expand-icon ${isExpanded ? 'rotated' : ''}`}
                />
            </div>

            {/* Content */}
            {isExpanded && (
                <div className="aac-content">
                    {/* Single Item Display */}
                    {actionType !== 'CREATE_MULTIPLE_TASKS' && (
                        <div className="aac-item-card">
                            <div className="aac-item-header">
                                <span className="aac-item-name">
                                    {singleData.title || singleData.name}
                                </span>
                                {singleData.priority && (
                                    <span className="aac-priority">
                                        {getPriorityEmoji(singleData.priority)} {singleData.priority}
                                    </span>
                                )}
                            </div>

                            {singleData.description && (
                                <p className="aac-description">{singleData.description}</p>
                            )}

                            <div className="aac-meta">
                                {singleData.category && (
                                    <span className="aac-meta-item">
                                        📁 {singleData.category}
                                    </span>
                                )}
                                {(singleData.target_date || singleData.due_date) && (
                                    <span className="aac-meta-item">
                                        📅 {formatDate(singleData.target_date || singleData.due_date)}
                                    </span>
                                )}
                                {singleData.frequency && (
                                    <span className="aac-meta-item">
                                        🔄 {singleData.frequency}
                                    </span>
                                )}
                            </div>

                            {singleData.reasoning && (
                                <div className="aac-reasoning">
                                    <Sparkles size={14} />
                                    <span>{singleData.reasoning}</span>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Multiple Tasks Display */}
                    {actionType === 'CREATE_MULTIPLE_TASKS' && multiData.tasks && (
                        <div className="aac-tasks-list">
                            {multiData.tasks.slice(0, 5).map((task, idx) => (
                                <div key={idx} className="aac-task-item">
                                    <CheckSquare size={14} />
                                    <span>{task.title}</span>
                                    {task.priority && (
                                        <span className="aac-task-priority">
                                            {getPriorityEmoji(task.priority)}
                                        </span>
                                    )}
                                </div>
                            ))}
                            {multiData.tasks.length > 5 && (
                                <div className="aac-more-tasks">
                                    +{multiData.tasks.length - 5} more tasks
                                </div>
                            )}
                        </div>
                    )}

                    {/* Action Buttons */}
                    <div className="aac-actions">
                        <button
                            className="aac-btn aac-btn-confirm"
                            onClick={handleConfirm}
                            disabled={isProcessing}
                        >
                            <Check size={16} />
                            <span>{confirmButtons[0] || 'Confirm'}</span>
                        </button>

                        {onModify && (
                            <button
                                className="aac-btn aac-btn-modify"
                                disabled={isProcessing}
                            >
                                <Edit2 size={16} />
                                <span>Modify</span>
                            </button>
                        )}

                        <button
                            className="aac-btn aac-btn-reject"
                            onClick={handleReject}
                            disabled={isProcessing}
                        >
                            <X size={16} />
                            <span>{confirmButtons[confirmButtons.length - 1] || 'Cancel'}</span>
                        </button>
                    </div>
                </div>
            )}

            {isProcessing && (
                <div className="aac-processing">
                    <div className="aac-spinner" />
                    <span>Processing...</span>
                </div>
            )}
        </div>
    );
};

export default AIActionConfirmation;
