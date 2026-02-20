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
                <Dialog.Overlay className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm transition-all duration-200 data-[state=closed]:animate-out data-[state=closed]:fade-out data-[state=open]:animate-in data-[state=open]:fade-in" />

                {/* Absolute Centering container. 
            Mobile behavior: Full width/height sheet with border radii adjustments. */}
                <Dialog.Content
                    className={twMerge(
                        clsx(
                            // Layout rules for positioning
                            "fixed left-[50%] top-[50%] z-50 translate-x-[-50%] translate-y-[-50%]",
                            // Layout rules for size & dimensions
                            "w-full sm:w-[90vw] h-full sm:h-auto max-h-[100dvh] sm:max-h-[85vh]",
                            maxWidthClass,
                            // Layout styling
                            "bg-[var(--bg-primary,white)] sm:rounded-xl border border-[var(--border-color,#e5e7eb)] shadow-2xl",
                            // Flex structure handling inner scrolling
                            "flex flex-col",
                            // Animations
                            "duration-200 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[state=closed]:slide-out-to-left-1/2 data-[state=closed]:slide-out-to-top-[48%] data-[state=open]:slide-in-from-left-1/2 data-[state=open]:slide-in-from-top-[48%]"
                        ),
                        className
                    )}
                >
                    {/* Header - Fixed to top, no shrink */}
                    <div className="flex flex-col gap-1 p-6 shrink-0 border-b border-[var(--border-color,#e5e7eb)]">
                        <div className="flex items-start justify-between">
                            <Dialog.Title className="text-lg font-semibold tracking-tight text-[var(--color-text-primary,#111827)]">
                                {title}
                            </Dialog.Title>
                            <Dialog.Close className="rounded-sm opacity-70 ring-offset-[var(--bg-primary,white)] transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-[var(--brand-accent)] focus:ring-offset-2 disabled:pointer-events-none data-[state=open]:bg-secondary">
                                <X className="h-5 w-5 text-[var(--color-text-secondary,#6b7280)]" />
                                <span className="sr-only">Close</span>
                            </Dialog.Close>
                        </div>
                        {description && (
                            <Dialog.Description className="text-sm text-[var(--color-text-secondary,#6b7280)]">
                                {description}
                            </Dialog.Description>
                        )}
                    </div>

                    {/* Internal Scrolling Body */}
                    <div className="p-6 overflow-y-auto flex-1 custom-scrollbar">
                        {children}
                    </div>

                    {/* Footer - Fixed to bottom, no shrink */}
                    {footer && (
                        <div className="flex shrink-0 items-center justify-end p-6 border-t border-[var(--border-color,#e5e7eb)] bg-[var(--bg-secondary,#f9fafb)] rounded-b-xl">
                            {footer}
                        </div>
                    )}
                </Dialog.Content>
            </Dialog.Portal>
        </Dialog.Root>
    );
};
