/**
 * Fleet Manager AI Chat Widget
 * Helps users query and understand fleet data
 * Includes voice input (speech-to-text) and voice output (Eleven Labs)
 */

class FleetChatWidget {
    constructor() {
        this.isOpen = false;
        this.isTyping = false;
        this.messages = [];
        this.voiceOutputEnabled = false;
        this.isPlaying = false;
        this.currentAudio = null;
        this.isListening = false;
        this.recognition = null;
        this.voiceAvailable = false;
        this.speechRecognitionAvailable = 'webkitSpeechRecognition' in window || 'SpeechRecognition' in window;
        this.init();
    }

    init() {
        this.createWidget();
        this.attachEventListeners();
        this.addWelcomeMessage();
        this.checkVoiceAvailability();
        this.initSpeechRecognition();
    }

    createWidget() {
        const widget = document.createElement('div');
        widget.className = 'chat-widget';
        widget.innerHTML = `
            <div class="chat-window" id="chatWindow">
                <div class="chat-header">
                    <div class="chat-header-avatar">
                        <i class="bi bi-robot"></i>
                    </div>
                    <div class="chat-header-info">
                        <h4>Fleet Assistant</h4>
                        <p>Ask me about your fleet data</p>
                    </div>
                </div>

                <!-- Voice Controls Bar - Prominent placement -->
                <div class="voice-controls-bar" id="voiceControlsBar">
                    <button class="voice-control-btn" id="micBtn" title="Click to speak">
                        <i class="bi bi-mic-fill" id="micIcon"></i>
                        <span class="voice-label">Speak</span>
                    </button>
                    <div class="voice-divider"></div>
                    <button class="voice-control-btn" id="speakerBtn" title="Toggle voice responses">
                        <i class="bi bi-volume-mute-fill" id="speakerIcon"></i>
                        <span class="voice-label">Listen</span>
                    </button>
                </div>

                <!-- Listening indicator -->
                <div class="listening-indicator" id="listeningIndicator">
                    <div class="listening-pulse"></div>
                    <span>Listening... Speak now</span>
                    <button class="stop-listening-btn" id="stopListeningBtn">
                        <i class="bi bi-x"></i>
                    </button>
                </div>

                <div class="chat-messages" id="chatMessages"></div>
                <div class="chat-quick-actions" id="quickActions">
                    <button class="quick-action-btn" data-query="fleet summary">Fleet Summary</button>
                    <button class="quick-action-btn" data-query="high risk forklifts">High Risk Units</button>
                    <button class="quick-action-btn" data-query="maintenance due">Maintenance Due</button>
                    <button class="quick-action-btn" data-query="active alerts">Active Alerts</button>
                </div>
                <div class="chat-input-container">
                    <button class="mic-input-btn" id="micInputBtn" title="Voice input">
                        <i class="bi bi-mic-fill"></i>
                    </button>
                    <input type="text" class="chat-input" id="chatInput" placeholder="Ask about your fleet..." autocomplete="off">
                    <button class="chat-send-btn" id="chatSendBtn">
                        <i class="bi bi-send-fill"></i>
                    </button>
                </div>
            </div>
            <button class="chat-toggle-btn" id="chatToggle">
                <i class="bi bi-chat-dots-fill chat-icon"></i>
                <i class="bi bi-x-lg close-icon"></i>
            </button>
        `;
        document.body.appendChild(widget);

        this.elements = {
            window: document.getElementById('chatWindow'),
            messages: document.getElementById('chatMessages'),
            input: document.getElementById('chatInput'),
            sendBtn: document.getElementById('chatSendBtn'),
            toggle: document.getElementById('chatToggle'),
            quickActions: document.getElementById('quickActions'),
            voiceControlsBar: document.getElementById('voiceControlsBar'),
            micBtn: document.getElementById('micBtn'),
            micIcon: document.getElementById('micIcon'),
            speakerBtn: document.getElementById('speakerBtn'),
            speakerIcon: document.getElementById('speakerIcon'),
            listeningIndicator: document.getElementById('listeningIndicator'),
            stopListeningBtn: document.getElementById('stopListeningBtn'),
            micInputBtn: document.getElementById('micInputBtn')
        };
    }

    attachEventListeners() {
        this.elements.toggle.addEventListener('click', () => this.toggleChat());
        this.elements.sendBtn.addEventListener('click', () => this.sendMessage());
        this.elements.input.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.sendMessage();
        });

        // Voice controls
        this.elements.micBtn.addEventListener('click', () => this.toggleListening());
        this.elements.micInputBtn.addEventListener('click', () => this.toggleListening());
        this.elements.speakerBtn.addEventListener('click', () => this.toggleVoiceOutput());
        this.elements.stopListeningBtn.addEventListener('click', () => this.stopListening());

        // Quick action buttons
        this.elements.quickActions.querySelectorAll('.quick-action-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const query = btn.dataset.query;
                this.elements.input.value = query;
                this.sendMessage();
            });
        });
    }

    initSpeechRecognition() {
        if (!this.speechRecognitionAvailable) {
            this.elements.micBtn.classList.add('unavailable');
            this.elements.micInputBtn.classList.add('unavailable');
            this.elements.micBtn.title = 'Speech recognition not supported in this browser';
            return;
        }

        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        this.recognition = new SpeechRecognition();
        this.recognition.continuous = false;
        this.recognition.interimResults = true;
        this.recognition.lang = 'en-US';

        this.recognition.onstart = () => {
            this.isListening = true;
            this.elements.micBtn.classList.add('listening');
            this.elements.micInputBtn.classList.add('listening');
            this.elements.micIcon.className = 'bi bi-mic-fill';
            this.elements.listeningIndicator.classList.add('show');
        };

        this.recognition.onresult = (event) => {
            let transcript = '';
            for (let i = event.resultIndex; i < event.results.length; i++) {
                transcript += event.results[i][0].transcript;
            }
            this.elements.input.value = transcript;

            // If final result, send the message
            if (event.results[event.results.length - 1].isFinal) {
                setTimeout(() => {
                    if (this.elements.input.value.trim()) {
                        this.sendMessage();
                    }
                }, 500);
            }
        };

        this.recognition.onend = () => {
            this.isListening = false;
            this.elements.micBtn.classList.remove('listening');
            this.elements.micInputBtn.classList.remove('listening');
            this.elements.listeningIndicator.classList.remove('show');
        };

        this.recognition.onerror = (event) => {
            console.error('Speech recognition error:', event.error);
            this.isListening = false;
            this.elements.micBtn.classList.remove('listening');
            this.elements.micInputBtn.classList.remove('listening');
            this.elements.listeningIndicator.classList.remove('show');

            if (event.error === 'not-allowed') {
                this.showToast('Microphone access denied. Please allow microphone access.');
            } else if (event.error !== 'aborted') {
                this.showToast('Speech recognition error. Please try again.');
            }
        };

        this.elements.micBtn.classList.add('available');
        this.elements.micInputBtn.classList.add('available');
    }

    toggleListening() {
        if (!this.speechRecognitionAvailable || !this.recognition) {
            this.showToast('Speech recognition not supported in this browser');
            return;
        }

        if (this.isListening) {
            this.stopListening();
        } else {
            this.startListening();
        }
    }

    startListening() {
        if (this.recognition && !this.isListening) {
            try {
                this.recognition.start();
            } catch (e) {
                console.error('Failed to start recognition:', e);
            }
        }
    }

    stopListening() {
        if (this.recognition && this.isListening) {
            this.recognition.stop();
        }
    }

    async checkVoiceAvailability() {
        try {
            const response = await fetch('/api/v1/chat/voice/status');
            const result = await response.json();
            if (result.available) {
                this.voiceAvailable = true;
                this.elements.speakerBtn.classList.add('available');
                this.elements.speakerBtn.title = 'Click to enable voice responses';
            } else {
                this.elements.speakerBtn.classList.add('unavailable');
                this.elements.speakerBtn.title = 'Voice not configured';
            }
        } catch (e) {
            this.elements.speakerBtn.classList.add('unavailable');
        }
    }

    toggleVoiceOutput() {
        if (!this.voiceAvailable) {
            this.showToast('Voice output not configured. Contact administrator.');
            return;
        }

        this.voiceOutputEnabled = !this.voiceOutputEnabled;
        this.elements.speakerBtn.classList.toggle('active', this.voiceOutputEnabled);

        if (this.voiceOutputEnabled) {
            this.elements.speakerIcon.className = 'bi bi-volume-up-fill';
            this.elements.speakerBtn.querySelector('.voice-label').textContent = 'Listening';
            this.showToast('Voice responses enabled');
        } else {
            this.elements.speakerIcon.className = 'bi bi-volume-mute-fill';
            this.elements.speakerBtn.querySelector('.voice-label').textContent = 'Listen';
            this.stopAudio();
            this.showToast('Voice responses disabled');
        }
    }

    showToast(message) {
        const toast = document.createElement('div');
        toast.className = 'chat-toast';
        toast.textContent = message;
        this.elements.window.appendChild(toast);

        setTimeout(() => {
            toast.classList.add('show');
        }, 10);

        setTimeout(() => {
            toast.classList.remove('show');
            setTimeout(() => toast.remove(), 300);
        }, 2500);
    }

    toggleChat() {
        this.isOpen = !this.isOpen;
        this.elements.window.classList.toggle('open', this.isOpen);
        this.elements.toggle.classList.toggle('active', this.isOpen);
        if (this.isOpen) {
            this.elements.input.focus();
        } else {
            this.stopAudio();
            this.stopListening();
        }
    }

    addWelcomeMessage() {
        this.addMessage('bot', `Hello! I'm your Fleet Assistant. I can help you with:

• **Fleet status** - Get summaries and statistics
• **Find forklifts** - Search by ID, location, or status
• **Maintenance info** - Check schedules and history
• **Alerts** - View active alerts and issues
• **Analytics** - Costs, downtime, and trends

🎤 **Click "Speak" to talk to me!**
🔊 **Click "Listen" to hear my responses!**`);
    }

    addMessage(type, content, data = null) {
        const message = { type, content, data, timestamp: new Date() };
        this.messages.push(message);

        const messageEl = document.createElement('div');
        messageEl.className = `chat-message ${type}`;

        let html = `<div class="message-content">${this.formatMessage(content)}</div>`;

        if (data) {
            html += this.formatDataCard(data);
        }

        // Add speaker button for bot messages
        if (type === 'bot' && this.voiceAvailable) {
            const msgId = `msg-${Date.now()}`;
            html += `<button class="message-speaker-btn" data-msgid="${msgId}" title="Play this message">
                <i class="bi bi-volume-up"></i>
            </button>`;
            messageEl.dataset.content = content;
            messageEl.id = msgId;
        }

        messageEl.innerHTML = html;
        this.elements.messages.appendChild(messageEl);

        // Attach speaker button listener
        const speakerBtn = messageEl.querySelector('.message-speaker-btn');
        if (speakerBtn) {
            speakerBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.playMessageAudio(content);
            });
        }

        this.scrollToBottom();
    }

    formatMessage(text) {
        return text
            .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
            .replace(/\*(.*?)\*/g, '<em>$1</em>')
            .replace(/`(.*?)`/g, '<code>$1</code>')
            .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>')
            .replace(/\n/g, '<br>');
    }

    formatDataCard(data) {
        if (data.type === 'table') {
            let html = `<div class="chat-data-card"><h5>${data.title || 'Results'}</h5><table>`;
            data.rows.forEach(row => {
                html += `<tr><td>${row.label}</td><td>${row.value}</td></tr>`;
            });
            html += '</table></div>';
            return html;
        }

        if (data.type === 'list') {
            let html = `<div class="chat-data-card"><h5>${data.title || 'Results'}</h5>`;
            data.items.forEach(item => {
                html += `<div style="padding: 4px 0; border-bottom: 1px solid #eee;">
                    <a href="${item.link}" style="color: #667eea; text-decoration: none;">${item.id}</a>
                    <span style="color: #666; margin-left: 8px;">${item.description}</span>
                </div>`;
            });
            html += '</div>';
            return html;
        }

        return '';
    }

    showTyping() {
        this.isTyping = true;
        const typingEl = document.createElement('div');
        typingEl.className = 'typing-indicator';
        typingEl.id = 'typingIndicator';
        typingEl.innerHTML = '<span></span><span></span><span></span>';
        this.elements.messages.appendChild(typingEl);
        this.scrollToBottom();
    }

    hideTyping() {
        this.isTyping = false;
        const typingEl = document.getElementById('typingIndicator');
        if (typingEl) typingEl.remove();
    }

    scrollToBottom() {
        this.elements.messages.scrollTop = this.elements.messages.scrollHeight;
    }

    async sendMessage() {
        const text = this.elements.input.value.trim();
        if (!text || this.isTyping) return;

        this.addMessage('user', text);
        this.elements.input.value = '';
        this.elements.sendBtn.disabled = true;

        this.showTyping();

        try {
            const response = await fetch('/api/v1/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ message: text })
            });

            const result = await response.json();

            this.hideTyping();

            if (result.success) {
                this.addMessage('bot', result.response, result.data);

                if (this.voiceOutputEnabled) {
                    this.playMessageAudio(result.response);
                }
            } else {
                this.addMessage('bot', 'Sorry, I encountered an error. Please try again.');
            }
        } catch (error) {
            this.hideTyping();
            this.addMessage('bot', 'Sorry, I\'m having trouble connecting. Please try again later.');
        }

        this.elements.sendBtn.disabled = false;
    }

    async playMessageAudio(text) {
        this.stopAudio();

        try {
            this.isPlaying = true;
            this.updatePlayingState(true);

            const response = await fetch('/api/v1/chat/voice', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ text })
            });

            if (!response.ok) {
                throw new Error('Voice generation failed');
            }

            const audioBlob = await response.blob();
            const audioUrl = URL.createObjectURL(audioBlob);

            this.currentAudio = new Audio(audioUrl);
            this.currentAudio.onended = () => {
                this.isPlaying = false;
                this.updatePlayingState(false);
                URL.revokeObjectURL(audioUrl);
            };
            this.currentAudio.onerror = () => {
                this.isPlaying = false;
                this.updatePlayingState(false);
                URL.revokeObjectURL(audioUrl);
            };

            await this.currentAudio.play();
        } catch (error) {
            console.error('Voice playback error:', error);
            this.isPlaying = false;
            this.updatePlayingState(false);
            this.showToast('Failed to play voice response');
        }
    }

    stopAudio() {
        if (this.currentAudio) {
            this.currentAudio.pause();
            this.currentAudio = null;
        }
        this.isPlaying = false;
        this.updatePlayingState(false);
    }

    updatePlayingState(playing) {
        this.elements.speakerBtn.classList.toggle('playing', playing);
    }
}

// Initialize widget when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    window.fleetChat = new FleetChatWidget();
});
