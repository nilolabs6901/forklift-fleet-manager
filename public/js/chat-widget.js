/**
 * Fleet Manager AI Chat Widget
 * Helps users query and understand fleet data
 */

class FleetChatWidget {
    constructor() {
        this.isOpen = false;
        this.isTyping = false;
        this.messages = [];
        this.init();
    }

    init() {
        this.createWidget();
        this.attachEventListeners();
        this.addWelcomeMessage();
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
            quickActions: document.getElementById('quickActions')
        };
    }

    attachEventListeners() {
        this.elements.toggle.addEventListener('click', () => this.toggleChat());
        this.elements.sendBtn.addEventListener('click', () => this.sendMessage());
        this.elements.input.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.sendMessage();
        });

        // Quick action buttons
        this.elements.quickActions.querySelectorAll('.quick-action-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const query = btn.dataset.query;
                this.elements.input.value = query;
                this.sendMessage();
            });
        });
    }

    toggleChat() {
        this.isOpen = !this.isOpen;
        this.elements.window.classList.toggle('open', this.isOpen);
        this.elements.toggle.classList.toggle('active', this.isOpen);
        if (this.isOpen) {
            this.elements.input.focus();
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

        messageEl.innerHTML = html;
        this.elements.messages.appendChild(messageEl);
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
            } else {
                this.addMessage('bot', 'Sorry, I encountered an error. Please try again.');
            }
        } catch (error) {
            this.hideTyping();
            this.addMessage('bot', 'Sorry, I\'m having trouble connecting. Please try again later.');
        }

        this.elements.sendBtn.disabled = false;
    }
}

// Initialize widget when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    window.fleetChat = new FleetChatWidget();
});
