import { useState, useEffect } from 'react';

const MOBILE_BREAKPOINT = 768;

const getIsMobileViewport = () => {
    if (typeof window === 'undefined') {
        return false;
    }

    return window.innerWidth < MOBILE_BREAKPOINT;
};

export function useMobile() {
    const [isMobile, setIsMobile] = useState<boolean>(getIsMobileViewport);

    useEffect(() => {
        const checkMobile = () => {
            setIsMobile(getIsMobileViewport());
        };

        // Initial check
        checkMobile();

        // Event listener
        window.addEventListener('resize', checkMobile);

        return () => window.removeEventListener('resize', checkMobile);
    }, []);

    return isMobile;
}
