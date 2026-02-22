import React, { ReactNode } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

interface ModalProps {
    isOpen: boolean;
    onOpenChange: (open: boolean) => void;
    title: string;
    description?: string;
    children: ReactNode;
    footer?: ReactNode;
    maxWidth?: 'sm' | 'md' | 'lg' | 'xl' | '2xl' | '3xl' | '4xl' | 'full';
    className?: string;
}

export const Modal = ({
    isOpen,
    onOpenChange,
    title,
    description,
    children,
    footer,
    maxWidth = 'md',
    className
}: ModalProps) => {
    const maxWidthClass = {
        'sm': 'max-w-sm',
        'md': 'max-w-md',
        'lg': 'max-w-lg',
        'xl': 'max-w-xl',
        '2xl': 'max-w-2xl',
        '3xl': 'max-w-3xl',
        '4xl': 'max-w-4xl',
        'full': 'max-w-[90vw]',
    }[maxWidth];

    return (
        <Dialog.Root open={isOpen} onOpenChange={onOpenChange}>
            <Dialog.Portal>
                {/* Overlay constraints: fixed inset-0, dark backdrop */}
                <Dialog.Overlay className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm transition-all duration-300 data-[state=closed]:animate-out data-[state=closed]:fade-out data-[state=open]:animate-in data-[state=open]:fade-in" />

                {/* Absolute Centering container. 
            Mobile behavior: Full width/height sheet with border radii adjustments. */}
                <Dialog.Content
                    aria-describedby={undefined}
                    className={twMerge(
                        clsx(
                            // Layout rules for positioning
                            "fixed left-[50%] top-[50%] z-50 translate-x-[-50%] translate-y-[-50%]",
                            // Layout rules for size & dimensions
                            "w-[95vw] sm:w-full max-h-[85dvh] sm:max-h-[85vh]",
                            maxWidthClass,
                            // Layout styling
                            "app-modal-surface bg-[var(--background-secondary)] sm:rounded-2xl border border-[var(--border-primary)] shadow-[0_24px_70px_-20px_rgba(0,0,0,0.65)] overflow-hidden",
                            // Flex structure handling inner scrolling
                            "flex flex-col",
                            // Animations
                            "duration-200 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[state=closed]:slide-out-to-left-1/2 data-[state=closed]:slide-out-to-top-[48%] data-[state=open]:slide-in-from-left-1/2 data-[state=open]:slide-in-from-top-[48%]"
                        ),
                        className
                    )}
                >
                    {/* Header - Fixed to top, no shrink */}
                    <div className="flex flex-col gap-1 p-5 sm:p-6 shrink-0 border-b border-[var(--border-primary)] bg-[var(--background-secondary)]">
                        <div className="flex items-start justify-between">
                            <Dialog.Title className="text-lg font-semibold tracking-tight text-[var(--text-primary,#111827)]">
                                {title}
                            </Dialog.Title>
                            <Dialog.Close className="rounded-full border border-[var(--border-primary)] bg-[var(--background-tertiary)] p-1.5 opacity-80 transition-all hover:opacity-100 hover:bg-[var(--background-primary)] hover:scale-105 focus:outline-none focus:ring-2 focus:ring-[var(--primary)] focus:ring-offset-0 disabled:pointer-events-none">
                                <X className="h-5 w-5 text-[var(--text-secondary,#6b7280)]" />
                                <span className="sr-only">Close</span>
                            </Dialog.Close>
                        </div>
                        {description && (
                            <Dialog.Description className="text-sm text-[var(--text-secondary,#6b7280)]">
                                {description}
                            </Dialog.Description>
                        )}
                    </div>

                    {/* Internal Scrolling Body */}
                    <div className="p-5 sm:p-6 overflow-y-auto flex-1 custom-scrollbar bg-[var(--background-secondary)]">
                        {children}
                    </div>

                    {/* Footer - Fixed to bottom, no shrink */}
                    {footer && (
                        <div className="flex shrink-0 items-center justify-end p-5 sm:p-6 border-t border-[var(--border-primary)] bg-[var(--background-secondary)] rounded-b-2xl">
                            {footer}
                        </div>
                    )}
                </Dialog.Content>
            </Dialog.Portal>
        </Dialog.Root>
    );
};
