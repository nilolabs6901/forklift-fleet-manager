/**
 * Fleet Manager AI Chat Widget
 * Helps users query and understand fleet data
 * Includes voice response capability via Eleven Labs
 */

class FleetChatWidget {
    constructor() {
        this.isOpen = false;
        this.isTyping = false;
        this.messages = [];
        this.voiceEnabled = false;
        this.isPlaying = false;
        this.currentAudio = null;
        this.init();
    }

    init() {
        this.createWidget();
        this.attachEventListeners();
        this.addWelcomeMessage();
        this.checkVoiceAvailability();
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
                    <button class="voice-toggle-btn" id="voiceToggle" title="Toggle voice responses">
                        <i class="bi bi-volume-mute-fill" id="voiceIcon"></i>
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
            voiceToggle: document.getElementById('voiceToggle'),
            voiceIcon: document.getElementById('voiceIcon')
        };
    }

    attachEventListeners() {
        this.elements.toggle.addEventListener('click', () => this.toggleChat());
        this.elements.sendBtn.addEventListener('click', () => this.sendMessage());
        this.elements.input.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.sendMessage();
        });

        // Voice toggle
        this.elements.voiceToggle.addEventListener('click', () => this.toggleVoice());

        // Quick action buttons
        this.elements.quickActions.querySelectorAll('.quick-action-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const query = btn.dataset.query;
                this.elements.input.value = query;
                this.sendMessage();
            });
        });
    }

    async checkVoiceAvailability() {
        try {
            const response = await fetch('/api/v1/chat/voice/status');
            const result = await response.json();
            if (result.available) {
                this.elements.voiceToggle.classList.add('available');
                this.elements.voiceToggle.title = 'Click to enable voice responses';
            } else {
                this.elements.voiceToggle.classList.add('unavailable');
                this.elements.voiceToggle.title = 'Voice not configured';
            }
        } catch (e) {
            this.elements.voiceToggle.classList.add('unavailable');
        }
    }

    toggleVoice() {
        if (this.elements.voiceToggle.classList.contains('unavailable')) {
            this.showToast('Voice is not configured. Add ELEVEN_LABS_API_KEY to enable.');
            return;
        }

        this.voiceEnabled = !this.voiceEnabled;
        this.elements.voiceToggle.classList.toggle('active', this.voiceEnabled);

        if (this.voiceEnabled) {
            this.elements.voiceIcon.className = 'bi bi-volume-up-fill';
            this.showToast('Voice responses enabled');
        } else {
            this.elements.voiceIcon.className = 'bi bi-volume-mute-fill';
            this.stopAudio();
            this.showToast('Voice responses disabled');
        }
    }

    showToast(message) {
        // Create a simple toast notification
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
        }, 2000);
    }

    toggleChat() {
        this.isOpen = !this.isOpen;
        this.elements.window.classList.toggle('open', this.isOpen);
        this.elements.toggle.classList.toggle('active', this.isOpen);
        if (this.isOpen) {
            this.elements.input.focus();
        } else {
            this.stopAudio();
        }
    }

    addWelcomeMessage() {
        this.addMessage('bot', `Hello! I'm your Fleet Assistant. I can help you with:

• **Fleet status** - Get summaries and statistics
• **Find forklifts** - Search by ID, location, or status
• **Maintenance info** - Check schedules and history
• **Alerts** - View active alerts and issues
• **Analytics** - Costs, downtime, and trends

What would you like to know?`);
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
        if (type === 'bot' && this.elements.voiceToggle.classList.contains('available')) {
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
        // Convert markdown-style formatting
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

        // Add user message
        this.addMessage('user', text);
        this.elements.input.value = '';
        this.elements.sendBtn.disabled = true;

        // Show typing indicator
        this.showTyping();

        try {
            // Send to API
            const response = await fetch('/api/v1/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ message: text })
            });

            const result = await response.json();

            this.hideTyping();

            if (result.success) {
                this.addMessage('bot', result.response, result.data);

                // Auto-play voice if enabled
                if (this.voiceEnabled) {
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
        // Stop any currently playing audio
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
        this.elements.voiceToggle.classList.toggle('playing', playing);
    }
}

// Initialize widget when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    window.fleetChat = new FleetChatWidget();
});
