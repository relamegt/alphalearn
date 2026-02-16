// Track paste attempts (in-memory only, no DB storage)
let pasteAttempts = 0;

export const initPasteDetection = (editorRef, onPasteAttempt) => {
    const editor = editorRef.current;
    if (!editor) return;

    // Detect paste events
    const handlePaste = (e) => {
        const clipboardData = e.clipboardData || window.clipboardData;
        const pastedText = clipboardData.getData('text');
        const currentCode = editor.getValue();

        // Allow inline paste (if pasted text exists in current code)
        const isInlinePaste = currentCode.includes(pastedText.substring(0, Math.min(20, pastedText.length)));

        if (!isInlinePaste && pastedText.trim().length > 0) {
            e.preventDefault();
            pasteAttempts++;

            if (onPasteAttempt) {
                onPasteAttempt(pasteAttempts);
            }

            // Show warning
            const confirmPaste = window.confirm(
                '⚠️ External paste detected!\n\n' +
                'Pasting code from external sources is restricted.\n' +
                'Only inline pasting (copy-paste within editor) is allowed.\n\n' +
                `Paste attempts: ${pasteAttempts}`
            );

            if (!confirmPaste) {
                return false;
            }
        }
    };

    document.addEventListener('paste', handlePaste);

    // Cleanup
    return () => {
        document.removeEventListener('paste', handlePaste);
    };
};

export const getPasteAttempts = () => pasteAttempts;

export const resetPasteAttempts = () => {
    pasteAttempts = 0;
};
