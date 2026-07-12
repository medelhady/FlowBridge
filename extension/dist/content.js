// ==================== FlowBridge Character: Terminal Output Fetcher ====================
const fbCharStyle = document.createElement('style');
fbCharStyle.textContent = `
@keyframes fb-peek-bob { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-5px); } }
@keyframes fb-eye-track { 0%, 100% { transform: translateX(0); } 30% { transform: translateX(2.5px); } 70% { transform: translateX(-2.5px); } }
@keyframes fb-grip-wiggle { 0%, 100% { transform: rotate(0deg); } 50% { transform: rotate(-6deg); } }
@keyframes fb-pop { 0% { transform: scale(1); } 40% { transform: scale(1.15); } 100% { transform: scale(1); } }
#fb-char-wrap { position: fixed; z-index: 99999; cursor: pointer; animation: fb-peek-bob 2.2s ease-in-out infinite; transition: transform 0.4s ease; }
#fb-char-wrap .fb-eyes { animation: fb-eye-track 2.4s ease-in-out infinite; }
#fb-char-wrap .fb-grip-l { animation: fb-grip-wiggle 1.6s ease-in-out infinite; transform-origin: 6px 50px; }
#fb-char-wrap .fb-grip-r { animation: fb-grip-wiggle 1.6s ease-in-out infinite reverse; transform-origin: 72px 50px; }
#fb-mouth-normal, #fb-mouth-happy { transition: opacity 0.2s ease; }
#fb-mouth-happy { opacity: 0; }
#fb-char-wrap.happy #fb-mouth-normal { opacity: 0; }
#fb-char-wrap.happy #fb-mouth-happy { opacity: 1; }
#fb-char-wrap.happy .fb-head { animation: fb-pop 0.4s ease; }
#fb-eyes-open, #fb-eyes-closed { transition: opacity 0.2s ease; }
#fb-eyes-closed { opacity: 0; }
#fb-char-wrap.sleeping { animation: none; transform: translateY(24px); }
#fb-char-wrap.sleeping .fb-head { fill: #6B7280; }
#fb-char-wrap.sleeping .fb-grip-l, #fb-char-wrap.sleeping .fb-grip-r { fill: #6B7280; animation: none; }
#fb-char-wrap.sleeping #fb-eyes-open { opacity: 0; }
#fb-char-wrap.sleeping #fb-eyes-closed { opacity: 1; }
#fb-char-wrap.sleeping #fb-mouth-normal { opacity: 0; }
`;
document.head.appendChild(fbCharStyle);

const fbCharWrap = document.createElement('div');
fbCharWrap.id = 'fb-char-wrap';
fbCharWrap.innerHTML = `
<svg width="56" height="40" viewBox="0 0 78 56">
  <circle class="fb-head" cx="39" cy="30" r="26" fill="#1E1B4B"/>
  <g class="fb-eyes" id="fb-eyes-open">
    <circle cx="27" cy="26" r="9" fill="#ffffff"/><circle cx="27" cy="26" r="4.5" fill="#0F0D2B"/><circle cx="29" cy="24" r="1.5" fill="#ffffff"/>
    <circle cx="51" cy="26" r="9" fill="#ffffff"/><circle cx="51" cy="26" r="4.5" fill="#0F0D2B"/><circle cx="53" cy="24" r="1.5" fill="#ffffff"/>
  </g>
  <g id="fb-eyes-closed">
    <path d="M20 26 Q27 30 34 26" stroke="#ffffff" stroke-width="2.4" fill="none" stroke-linecap="round"/>
    <path d="M44 26 Q51 30 58 26" stroke="#ffffff" stroke-width="2.4" fill="none" stroke-linecap="round"/>
  </g>
  <path id="fb-mouth-normal" d="M32 40 Q39 44 46 40" stroke="#34D399" stroke-width="2.2" fill="none" stroke-linecap="round"/>
  <path id="fb-mouth-happy" d="M29 39 Q39 49 49 39 Q39 47 29 39 Z" fill="#34D399"/>
  <g class="fb-grip-l"><ellipse cx="6" cy="50" rx="8" ry="6.5" fill="#1E1B4B"/></g>
  <g class="fb-grip-r"><ellipse cx="72" cy="50" rx="8" ry="6.5" fill="#1E1B4B"/></g>
</svg>
`;
document.body.appendChild(fbCharWrap);

let fbSleeping = localStorage.getItem('fb-sleeping') !== '0';

function fbApplySleepState() {
    if (fbSleeping) {
        fbCharWrap.classList.add('sleeping');
    } else {
        fbCharWrap.classList.remove('sleeping');
    }
}
fbApplySleepState();

function fbWakeUp() {
    fbSleeping = false;
    localStorage.setItem('fb-sleeping', '0');
    fbApplySleepState();
    fbUpdateButtonPositions();
}

function fbGoToSleep() {
    fbSleeping = true;
    localStorage.setItem('fb-sleeping', '1');
    fbApplySleepState();
    fbUpdateButtonPositions();
}

function fbFindInputField() {
    let el = document.querySelector('div[contenteditable="true"]');
    if (el) return el;
    const textareas = Array.from(document.querySelectorAll('textarea'));
    for (const ta of textareas) {
        const rect = ta.getBoundingClientRect();
        if (rect.width > 100 && rect.height > 15 && ta.offsetParent !== null) {
            return ta;
        }
    }
    return null;
}

function fbPositionCharacter() {
    fbCharWrap.style.display = 'block';
    fbCharWrap.style.position = 'fixed';
    fbCharWrap.style.bottom = '20px';
    fbCharWrap.style.right = '20px';
    fbCharWrap.style.left = 'auto';
    fbCharWrap.style.top = 'auto';
}

function fbResetChar() {
    fbCharWrap.classList.remove('happy');
}

function fbTriggerHappy() {
    fbCharWrap.classList.add('happy');
    setTimeout(fbResetChar, 900);
}

async function fbDoFetchAndInject() {
    fbTriggerHappy();
    try {
        const inputField = fbFindInputField();
        if (!inputField) {
            alert('Please open a chat session first!');
            return;
        }
        inputField.focus();

        fetch('http://127.0.0.1:9988/')
        .then(response => response.json())
        .then(data => {
            const terminalOutput = data.output ? data.output.trim() : "";

            if (!terminalOutput || terminalOutput === "No recent terminal output found.") {
                alert('No recent terminal output captured yet. Run a command first!');
                return;
            }

            let formattedText = (terminalOutput.includes("Error") || terminalOutput.includes("failed")) ?
                `The command failed with this output in my terminal. Please analyze and fix it:\n\n${terminalOutput}` :
                `Here is the automatic output from the last executed command:\n\n${terminalOutput}`;

            document.execCommand('insertText', false, formattedText);
        })
        .catch(err => {
            alert('Bridge offline! Please make sure bridge_server.py is running.');
        });

    } catch (err) {
        console.error("Injection failed:", err);
    }
}

let fbClickTimer = null;
fbCharWrap.addEventListener('click', () => {
    if (fbClickTimer === null) {
        fbClickTimer = setTimeout(() => {
            fbClickTimer = null;
            if (fbSleeping) {
                fbWakeUp();
            } else {
                fbDoFetchAndInject();
            }
        }, 280);
    } else {
        clearTimeout(fbClickTimer);
        fbClickTimer = null;
        if (!fbSleeping) {
            fbGoToSleep();
        }
    }
});

let fbCharPosTimer = null;
window.addEventListener('scroll', () => {
    clearTimeout(fbCharPosTimer);
    fbCharPosTimer = setTimeout(fbPositionCharacter, 50);
}, true);
window.addEventListener('resize', fbPositionCharacter);
setInterval(fbPositionCharacter, 500);
fbPositionCharacter();

// ==================== Code Block Buttons: FlowBridge Run rows ====================
const fbRunCss = document.createElement('style');
fbRunCss.textContent = `
.fb-run-btn { display: none !important; }
.fb-run-row { display: flex !important; justify-content: flex-start; align-items: center; margin: 6px 0 10px 0; min-height: 34px; }
.fb-run-row .fb-run-btn { display: inline-flex !important; }
.fb-gemini-run-row { display: flex !important; justify-content: flex-end; align-items: center; margin: 0 0 6px 0; min-height: 34px; }
.fb-gemini-run-row .fb-run-btn { display: inline-flex !important; }
pre .fb-run-btn, pre button[title="Run in Terminal"] { display: none !important; }
.fb-run-btn .fb-bridge-spark { animation: fb-bridge-spark 1.15s ease-in-out infinite; color: #34d399; text-shadow: 0 0 10px rgba(52, 211, 153, .9); }
.fb-run-btn:hover { box-shadow: 0 0 24px rgba(52, 211, 153, .42) !important; transform: translateY(-1px); }
@keyframes fb-bridge-spark {
    0%, 100% { opacity: .62; transform: scale(1); }
    50% { opacity: 1; transform: scale(1.28); }
}
`;
document.head.appendChild(fbRunCss);

let fbCodeBlockCounter = 0;
const fbBridgeIcon = '<svg class="fb-bridge-spark" width="13" height="15" viewBox="0 0 13 15" fill="none" aria-hidden="true"><path d="M7.4 1 2.1 7.7h4.2L5.6 14l5.3-7.5H6.8L7.4 1Z" fill="currentColor"/><path d="M2.8 10.8 1 12.1M11.8 2.8 10 4.1" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/></svg>';

function fbButtonLabel(label) {
    return `${fbBridgeIcon}<span>${label}</span>`;
}

function fbGetStableCodeBlockId(block) {
    if (!block.dataset.fbCodeBlockId) {
        fbCodeBlockCounter += 1;
        block.dataset.fbCodeBlockId = String(fbCodeBlockCounter);
    }
    return block.dataset.fbCodeBlockId;
}

function fbGetCodeText(block) {
    const codeEl = block.querySelector('code');
    return (codeEl ? codeEl.innerText : block.innerText).trim();
}

function fbMakeRunButton(block) {
    const btn = document.createElement('button');
    btn.innerHTML = fbButtonLabel('Bridge');
    btn.className = 'fb-run-btn';
    btn.type = 'button';
    btn.title = 'Run in Terminal';
    btn.style.alignItems = 'center';
    btn.style.justifyContent = 'center';
    btn.style.gap = '7px';
    btn.style.padding = '6px 12px';
    btn.style.backgroundColor = '#0f172a';
    btn.style.color = '#34d399';
    btn.style.border = '1px solid rgba(52, 211, 153, 0.55)';
    btn.style.borderRadius = '7px';
    btn.style.fontSize = '12px';
    btn.style.fontWeight = '700';
    btn.style.cursor = 'pointer';
    btn.style.lineHeight = '1.4';
    btn.style.textShadow = '0 0 8px rgba(52, 211, 153, 0.75)';
    btn.style.boxShadow = '0 0 18px rgba(52, 211, 153, 0.25)';
    btn.onclick = () => {
        const command = fbGetCodeText(block);
        if (!command) return;

        fetch('http://127.0.0.1:9988/', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ command })
        })
        .then(() => {
            btn.innerHTML = fbButtonLabel('Sent');
            btn.style.backgroundColor = '#16a34a';
            btn.style.color = '#ffffff';
            setTimeout(() => {
                btn.innerHTML = fbButtonLabel('Bridge');
                btn.style.backgroundColor = '#0f172a';
                btn.style.color = '#34d399';
            }, 2000);
        })
        .catch(() => {
            alert('Bridge offline! Please make sure bridge_server.py is running.');
        });
    };
    return btn;
}

function fbIsGemini() {
    return location.hostname === 'gemini.google.com';
}

function fbFindGeminiToolbar(block) {
    const blockRect = block.getBoundingClientRect();
    let parent = block.parentElement;
    for (let depth = 0; parent && depth < 8; depth++) {
        const parentRect = parent.getBoundingClientRect();
        const containsBlock =
            parentRect.top <= blockRect.top &&
            parentRect.bottom >= blockRect.bottom &&
            parentRect.width >= blockRect.width;

        if (containsBlock) {
            const buttons = Array.from(parent.querySelectorAll('button')).filter(btn => !btn.classList.contains('fb-run-btn'));
            const headerButtons = buttons.filter(btn => {
                const rect = btn.getBoundingClientRect();
                return rect.top >= parentRect.top - 4 &&
                    rect.bottom <= blockRect.top + 28 &&
                    rect.left >= parentRect.left - 4 &&
                    rect.right <= parentRect.right + 4;
            });

            if (headerButtons.length >= 1) {
                return { codeBox: parent, anchor: headerButtons[headerButtons.length - 1] };
            }
        }
        parent = parent.parentElement;
    }
    return null;
}

function fbCleanupRunControls() {
    document.querySelectorAll('pre .fb-run-btn, pre button[title="Run in Terminal"]').forEach(el => el.remove());

    const rowsByBlock = new Map();
    document.querySelectorAll('.fb-run-row').forEach(row => {
        const blockId = row.dataset.fbBlockId || '';
        if (!blockId || rowsByBlock.has(blockId)) {
            row.remove();
            return;
        }
        rowsByBlock.set(blockId, row);
    });

    const geminiRowsByBlock = new Map();
    document.querySelectorAll('.fb-gemini-run-row').forEach(row => {
        const blockId = row.dataset.fbBlockId || '';
        if (!blockId || geminiRowsByBlock.has(blockId)) {
            row.remove();
            return;
        }
        geminiRowsByBlock.set(blockId, row);
    });

    document.querySelectorAll('button').forEach(btn => {
        const text = (btn.innerText || '').trim();
        if (!['Run', 'Bridge', 'Sent', 'Offline', '?Bridge', '? Bridge', '?Sent', '? Sent'].includes(text)) return;
        if (btn.closest('.fb-run-row')) return;
        if (btn.closest('.fb-gemini-run-row')) return;
        if (btn.title === 'Run in Terminal' || btn.classList.contains('fb-run-btn')) btn.remove();
    });
}

function fbEnsureRunRows() {
    fbCleanupRunControls();
    if (fbSleeping) return;

    document.querySelectorAll('pre').forEach(block => {
        const rect = block.getBoundingClientRect();
        const command = fbGetCodeText(block);
        if (!block.isConnected || rect.width < 120 || rect.height < 24 || !command) return;

        const blockId = fbGetStableCodeBlockId(block);
        let row = document.querySelector(`.fb-run-row[data-fb-block-id="${blockId}"]`);

        if (fbIsGemini()) {
            const existingGeminiRows = Array.from(document.querySelectorAll(`.fb-gemini-run-row[data-fb-block-id="${blockId}"]`));
            let geminiRow = existingGeminiRows[0];
            existingGeminiRows.slice(1).forEach(extraRow => extraRow.remove());
            if (!geminiRow) {
                geminiRow = document.createElement('div');
                geminiRow.className = 'fb-gemini-run-row';
                geminiRow.dataset.fbBlockId = blockId;
                geminiRow.appendChild(fbMakeRunButton(block));
            }
            const existingGeminiBtn = document.querySelector(`.fb-run-btn[data-fb-block-id="${blockId}"]`);
            const runBtn = existingGeminiBtn || geminiRow.querySelector('.fb-run-btn') || fbMakeRunButton(block);
            runBtn.dataset.fbBlockId = blockId;
            if (row) row.remove();
            runBtn.style.position = 'static';
            if (runBtn.parentElement !== geminiRow) geminiRow.appendChild(runBtn);
            if (geminiRow.nextElementSibling !== block) block.insertAdjacentElement('beforebegin', geminiRow);
            return;
        }

        if (!row) {
            row = document.createElement('div');
            row.className = 'fb-run-row';
            row.dataset.fbBlockId = blockId;
            row.appendChild(fbMakeRunButton(block));
        }

        if (row.previousElementSibling !== block) {
            block.insertAdjacentElement('afterend', row);
        }
    });
}

function fbUpdateButtonPositions() {
    fbEnsureRunRows();
}

let fbRunDebounceTimer = null;
const fbRunObserver = new MutationObserver(() => {
    clearTimeout(fbRunDebounceTimer);
    fbRunDebounceTimer = setTimeout(fbEnsureRunRows, 500);
});
fbRunObserver.observe(document.body, { childList: true, subtree: true });
setInterval(fbEnsureRunRows, 1500);
fbEnsureRunRows();
