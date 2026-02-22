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
        'sm': 'max-w-[430px]',
        'md': 'max-w-[540px]',
        'lg': 'max-w-[680px]',
        'xl': 'max-w-[820px]',
        '2xl': 'max-w-[980px]',
        '3xl': 'max-w-[1120px]',
        '4xl': 'max-w-[1280px]',
        'full': 'max-w-[90vw]',
    }[maxWidth];

    return (
        <Dialog.Root open={isOpen} onOpenChange={onOpenChange}>
            <Dialog.Portal>
                {/* Overlay constraints: fixed inset-0, dark backdrop */}
                <Dialog.Overlay className="app-modal-overlay fixed inset-0 z-50 transition-all duration-300 data-[state=closed]:animate-out data-[state=closed]:fade-out data-[state=open]:animate-in data-[state=open]:fade-in" />

                {/* Absolute Centering container. 
            Mobile behavior: Full width/height sheet with border radii adjustments. */}
                <Dialog.Content
                    aria-describedby={undefined}
                    className={twMerge(
                        clsx(
                            // Layout rules for positioning
                            "app-modal-content fixed left-[50%] top-[50%] z-50 translate-x-[-50%] translate-y-[-50%]",
                            // Layout rules for size & dimensions
                            "w-[92vw] max-h-[85dvh] sm:max-h-[85vh]",
                            maxWidthClass,
                            "overflow-hidden",
                            // Flex structure handling inner scrolling
                            "flex flex-col",
                            // Rounded corners
                            "rounded-2xl",
                            // Open/close motion
                            "duration-200 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[state=closed]:slide-out-to-top-[49%] data-[state=open]:slide-in-from-top-[49%]",
                        ),
                        className
                    )}
                >
                    {/* Header - Fixed to top, no shrink */}
                    <div className="app-modal-header flex flex-col gap-1 p-5 sm:p-6 shrink-0">
                        <div className="flex items-start justify-between">
                            <Dialog.Title className="text-lg font-semibold tracking-tight text-[var(--text-primary,#111827)]">
                                {title}
                            </Dialog.Title>
                            <Dialog.Close className="app-modal-close rounded-full p-1.5 opacity-80 transition-all hover:opacity-100 hover:scale-105 focus:outline-none focus:ring-2 focus:ring-[var(--primary)] focus:ring-offset-2 disabled:pointer-events-none">
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
                    <div className="app-modal-body p-5 sm:p-6 overflow-y-auto flex-1 custom-scrollbar">
                        {children}
                    </div>

                    {/* Footer - Fixed to bottom, no shrink */}
                    {footer && (
                        <div className="app-modal-footer flex shrink-0 items-center justify-end px-5 pb-4 pt-2 sm:px-6 sm:pb-5 sm:pt-3">
                            {footer}
                        </div>
                    )}
                </Dialog.Content>
            </Dialog.Portal>
        </Dialog.Root>
    );
};
