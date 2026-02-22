import React, { ReactNode } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { X } from 'lucide-react';

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
    const sizeClass = {
        'sm': 'app-modal-size-sm',
        'md': 'app-modal-size-md',
        'lg': 'app-modal-size-lg',
        'xl': 'app-modal-size-xl',
        '2xl': 'app-modal-size-2xl',
        '3xl': 'app-modal-size-3xl',
        '4xl': 'app-modal-size-4xl',
        'full': 'app-modal-size-full',
    }[maxWidth];

    return (
        <Dialog.Root open={isOpen} onOpenChange={onOpenChange}>
            <Dialog.Portal>
                <Dialog.Overlay className="app-modal-overlay" />
                <Dialog.Content
                    aria-describedby={undefined}
                    className={['app-modal-content', sizeClass, className].filter(Boolean).join(' ')}
                >
                    <div className="app-modal-header">
                        <div className="app-modal-title-row">
                            <Dialog.Title className="app-modal-title">
                                {title}
                            </Dialog.Title>
                            <Dialog.Close className="app-modal-close">
                                <X className="app-modal-close-icon" />
                                <span className="sr-only">Close</span>
                            </Dialog.Close>
                        </div>
                        {description && (
                            <Dialog.Description className="app-modal-description">
                                {description}
                            </Dialog.Description>
                        )}
                    </div>
                    <div className="app-modal-body">
                        {children}
                    </div>
                    {footer && (
                        <div className="app-modal-footer">
                            {footer}
                        </div>
                    )}
                </Dialog.Content>
            </Dialog.Portal>
        </Dialog.Root>
    );
};
