import { useState, useEffect, useRef, useCallback } from 'react';
import contestService from '../services/contestService';
import toast from 'react-hot-toast';

const useProctoring = (contestId, studentId, isActive, onMaxViolations) => {
    const [violations, setViolations] = useState({
        tabSwitchCount: 0,
        tabSwitchDuration: 0,
        pasteAttempts: 0,
        fullscreenExits: 0
    });

    const [isFullscreen, setIsFullscreen] = useState(false);
    const [showViolationModal, setShowViolationModal] = useState(false);
    const [currentViolationType, setCurrentViolationType] = useState('');

    const tabSwitchTimeRef = useRef(null);
    const fullscreenRequestedRef = useRef(false);

    // Fetch initial violations
    useEffect(() => {
        if (!contestId || !studentId) return;
        const fetchViolations = async () => {
            try {
                const data = await contestService.getProctoringViolations(contestId, studentId);
                // Map backend response to local state
                // Backend returns: totalTabSwitches, totalFullscreenExits, etc.
                if (data.violations) {
                    setViolations({
                        tabSwitchCount: data.violations.totalTabSwitches || 0,
                        tabSwitchDuration: data.violations.totalTabSwitchDuration || 0,
                        pasteAttempts: data.violations.totalPasteAttempts || 0,
                        fullscreenExits: data.violations.totalFullscreenExits || 0
                    });
                }
            } catch (error) {
                console.error("Failed to sync violations:", error);
            }
        };
        fetchViolations();
    }, [contestId, studentId]);

    // Track tab visibility
    useEffect(() => {
        if (!isActive) return;

        const handleVisibilityChange = () => {
            if (document.hidden) {
                tabSwitchTimeRef.current = Date.now();
                showViolation('Tab Switch Detected', 'You switched away from the contest tab');
            } else if (tabSwitchTimeRef.current) {
                const duration = Math.floor((Date.now() - tabSwitchTimeRef.current) / 1000);
                setViolations(prev => ({
                    ...prev,
                    tabSwitchCount: prev.tabSwitchCount + 1,
                    tabSwitchDuration: prev.tabSwitchDuration + duration
                }));

                // Log immediately to backend
                if (contestId && studentId) {
                    contestService.logViolation(contestId, {
                        tabSwitchCount: 1,
                        tabSwitchDuration: duration
                    });
                }

                tabSwitchTimeRef.current = null;
            }
        };

        document.addEventListener('visibilitychange', handleVisibilityChange);
        return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
    }, [isActive, contestId, studentId]);

    // Track fullscreen
    useEffect(() => {
        if (!isActive) return;

        const handleFullscreenChange = () => {
            const isFullscreenNow = !!document.fullscreenElement;
            setIsFullscreen(isFullscreenNow);

            // Only count as violation if we explicitly requested fullscreen before
            if (!isFullscreenNow && fullscreenRequestedRef.current && isActive) {
                setViolations(prev => ({
                    ...prev,
                    fullscreenExits: prev.fullscreenExits + 1
                }));
                // Log immediately
                if (contestId && studentId) {
                    contestService.logViolation(contestId, {
                        fullscreenExits: 1
                    });
                }
                showViolation('Fullscreen Exit Detected', 'You exited fullscreen mode');
            }
        };

        document.addEventListener('fullscreenchange', handleFullscreenChange);
        return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
    }, [isActive]);

    // Track paste attempts (Blocked, warning only, NO VIOLATION COUNT)
    useEffect(() => {
        if (!isActive) return;

        const handlePaste = (e) => {
            e.preventDefault(); // Block paste
            toast('Paste is disabled in contests!', { icon: '⚠️' });
            // Do NOT increment violation count
        };

        document.addEventListener('paste', handlePaste);
        return () => document.removeEventListener('paste', handlePaste);
    }, [isActive]);

    // Check for max violations (Exclude paste attempts)
    useEffect(() => {
        const totalViolations =
            violations.tabSwitchCount +
            violations.fullscreenExits;

        if (totalViolations >= 5 && isActive) {
            onMaxViolations?.();
        }
    }, [violations, isActive, onMaxViolations]);

    const showViolation = (type, message) => {
        setCurrentViolationType({ type, message });
        setShowViolationModal(true);

        // Play beep sound (using Web Audio API)
        try {
            const audioContext = new (window.AudioContext || window.webkitAudioContext)();
            const oscillator = audioContext.createOscillator();
            const gainNode = audioContext.createGain();

            oscillator.connect(gainNode);
            gainNode.connect(audioContext.destination);

            oscillator.frequency.value = 800;
            oscillator.type = 'sine';

            gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
            gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.5);

            oscillator.start(audioContext.currentTime);
            oscillator.stop(audioContext.currentTime + 0.5);
        } catch (error) {
            console.log('Audio notification failed:', error);
        }

        setTimeout(() => {
            setShowViolationModal(false);
        }, 3000);
    };

    const enterFullscreen = useCallback(async () => {
        try {
            // Check if already in fullscreen
            if (document.fullscreenElement) {
                return;
            }

            // Mark that we're requesting fullscreen
            fullscreenRequestedRef.current = true;

            // Request fullscreen
            const element = document.documentElement;

            if (element.requestFullscreen) {
                await element.requestFullscreen();
            } else if (element.mozRequestFullScreen) { // Firefox
                await element.mozRequestFullScreen();
            } else if (element.webkitRequestFullscreen) { // Chrome, Safari, Opera
                await element.webkitRequestFullscreen();
            } else if (element.msRequestFullscreen) { // IE/Edge
                await element.msRequestFullscreen();
            }
        } catch (error) {
            console.log('Fullscreen request failed:', error.message);
            // Don't show error to user, just log it
        }
    }, []);

    const getViolationSummary = () => {
        const total =
            violations.tabSwitchCount +
            violations.fullscreenExits;
        // Exclude pasteAttempts from total

        return {
            ...violations,
            totalViolations: total,
            hasViolations: total > 0,
            isNearLimit: total >= 3,
            shouldAutoSubmit: total >= 5
        };
    };

    const resetViolations = () => {
        setViolations({
            tabSwitchCount: 0,
            tabSwitchDuration: 0,
            pasteAttempts: 0,
            fullscreenExits: 0
        });
        fullscreenRequestedRef.current = false;
    };

    return {
        violations,
        isFullscreen,
        showViolationModal,
        currentViolationType,
        enterFullscreen,
        getViolationSummary,
        resetViolations
    };
};

export default useProctoring;
