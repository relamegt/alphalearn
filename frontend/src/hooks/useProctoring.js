import { useState, useEffect, useRef, useCallback } from 'react';
import contestService from '../services/contestService';
import toast from 'react-hot-toast';

/**
 * useProctoring
 *
 * @param {string}   contestId        - current contest id
 * @param {string}   studentId        - current student id
 * @param {boolean}  isActive         - whether proctoring should be active
 * @param {Function} onMaxViolations  - called when violation limit is reached
 * @param {number}   maxViolations    - max violations before auto-submit (from contest config, default 5)
 */
const useProctoring = (contestId, studentId, isActive, onMaxViolations, maxViolations = 5) => {
    const [violations, setViolations] = useState({
        tabSwitchCount: 0,
        tabSwitchDuration: 0,
        pasteAttempts: 0,
        fullscreenExits: 0
    });

    const [isFullscreen, setIsFullscreen] = useState(false);
    const [showViolationModal, setShowViolationModal] = useState(false);
    const [currentViolationType, setCurrentViolationType] = useState('');

    const tabHideTimeRef = useRef(null);
    const fullscreenRequestedRef = useRef(false);
    const isFinishingRef = useRef(false); // NEW: suppress violation on intentional finish
    const violationsRef = useRef(violations);

    // Keep ref in sync
    useEffect(() => {
        violationsRef.current = violations;
    }, [violations]);

    // Fetch initial violations from backend on mount (only from violation logs)
    useEffect(() => {
        if (!contestId || !studentId || !isActive) return;
        const fetchViolations = async () => {
            try {
                const data = await contestService.getProctoringViolations(contestId, studentId);
                if (data.violations) {
                    setViolations({
                        tabSwitchCount: data.violations.totalTabSwitches || 0,
                        tabSwitchDuration: data.violations.totalTabSwitchDuration || 0,
                        pasteAttempts: data.violations.totalPasteAttempts || 0,
                        fullscreenExits: data.violations.totalFullscreenExits || 0
                    });
                }
            } catch (error) {
                console.error('Failed to sync violations:', error);
            }
        };
        fetchViolations();
    }, [contestId, studentId, isActive]);

    // ─── Track Tab Visibility ───
    useEffect(() => {
        if (!isActive) return;

        const handleVisibilityChange = () => {
            if (isFinishingRef.current) return; // suppress during finish

            if (document.hidden) {
                tabHideTimeRef.current = Date.now();

                setViolations(prev => ({
                    ...prev,
                    tabSwitchCount: prev.tabSwitchCount + 1
                }));

                // Log to backend
                if (contestId && studentId) {
                    contestService.logViolation(contestId, {
                        tabSwitchCount: 1,
                        tabSwitchDuration: 0
                    });
                }

                showViolation('Tab Switch', 'You switched away from the contest tab');
            } else if (tabHideTimeRef.current) {
                const duration = Math.floor((Date.now() - tabHideTimeRef.current) / 1000);
                setViolations(prev => ({
                    ...prev,
                    tabSwitchDuration: prev.tabSwitchDuration + duration
                }));

                if (contestId && studentId && duration > 0) {
                    contestService.logViolation(contestId, {
                        tabSwitchCount: 0,
                        tabSwitchDuration: duration
                    });
                }

                tabHideTimeRef.current = null;
            }
        };

        document.addEventListener('visibilitychange', handleVisibilityChange);
        return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
    }, [isActive, contestId, studentId]);

    // ─── Track Fullscreen ───
    useEffect(() => {
        if (!isActive) return;

        const handleFullscreenChange = () => {
            const isFullscreenNow = !!document.fullscreenElement;
            setIsFullscreen(isFullscreenNow);

            // Do NOT count as violation if:
            // 1. We didn't request fullscreen yet (initial state)
            // 2. User is intentionally finishing
            if (!isFullscreenNow && fullscreenRequestedRef.current && isActive && !isFinishingRef.current) {
                setViolations(prev => ({
                    ...prev,
                    fullscreenExits: prev.fullscreenExits + 1
                }));

                if (contestId && studentId) {
                    contestService.logViolation(contestId, {
                        fullscreenExits: 1
                    });
                }

                showViolation('Fullscreen Exit', 'You exited fullscreen mode');
            }

            if (isFullscreenNow) {
                fullscreenRequestedRef.current = true;
            }
        };

        document.addEventListener('fullscreenchange', handleFullscreenChange);
        return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
    }, [isActive, contestId, studentId]);

    // ─── Block Paste ───
    useEffect(() => {
        if (!isActive) return;

        const handlePaste = (e) => {
            e.preventDefault();
            toast('Paste is disabled during the contest!', { icon: '⚠️' });
        };

        document.addEventListener('paste', handlePaste);
        return () => document.removeEventListener('paste', handlePaste);
    }, [isActive]);

    // ─── Check max violations threshold ───
    useEffect(() => {
        if (!isActive) return;
        const totalViolations = violations.tabSwitchCount + violations.fullscreenExits;
        if (totalViolations > 0 && totalViolations >= maxViolations) {
            onMaxViolations?.();
        }
    }, [violations, isActive, maxViolations, onMaxViolations]);

    // ─── Violation Alert (toast + sound) ───
    const showViolation = (type, message) => {
        setCurrentViolationType({ type, message });
        setShowViolationModal(true);

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
        } catch (e) { /* silent */ }

        setTimeout(() => setShowViolationModal(false), 3500);
    };

    const enterFullscreen = useCallback(async () => {
        try {
            if (document.fullscreenElement) return;
            fullscreenRequestedRef.current = true;
            const el = document.documentElement;
            if (el.requestFullscreen) await el.requestFullscreen();
            else if (el.mozRequestFullScreen) await el.mozRequestFullScreen();
            else if (el.webkitRequestFullscreen) await el.webkitRequestFullscreen();
            else if (el.msRequestFullscreen) await el.msRequestFullscreen();
        } catch (error) {
            console.log('Fullscreen request failed:', error.message);
        }
    }, []);

    // Call this BEFORE exiting fullscreen intentionally (on Finish)
    const markAsFinishing = useCallback(() => {
        isFinishingRef.current = true;
    }, []);

    const exitFullscreenSilently = useCallback(async () => {
        isFinishingRef.current = true;
        try {
            if (document.fullscreenElement) {
                await document.exitFullscreen();
            }
        } catch (e) { /* silent */ }
    }, []);

    const getViolationSummary = () => {
        const total = violations.tabSwitchCount + violations.fullscreenExits;
        return {
            ...violations,
            totalViolations: total,
            hasViolations: total > 0,
            isNearLimit: total >= Math.max(1, maxViolations - 2),
            shouldAutoSubmit: total >= maxViolations
        };
    };

    const resetViolations = () => {
        setViolations({ tabSwitchCount: 0, tabSwitchDuration: 0, pasteAttempts: 0, fullscreenExits: 0 });
        fullscreenRequestedRef.current = false;
        isFinishingRef.current = false;
    };

    return {
        violations,
        isFullscreen,
        showViolationModal,
        currentViolationType,
        enterFullscreen,
        exitFullscreenSilently,
        markAsFinishing,
        getViolationSummary,
        resetViolations
    };
};

export default useProctoring;
