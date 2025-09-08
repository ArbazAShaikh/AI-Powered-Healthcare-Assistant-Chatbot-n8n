// Global state management
const AppState = {
    chatHistory: [],
    isTyping: false,
    currentUser: 'user_' + Math.random().toString(36).substr(2, 9),
    webhookUrl: 'https://arbazshaikhn8n.app.n8n.cloud/webhook-test/medical-chatbot',
    webhookTested: false,
    lastError: null
};

// DOM elements
const chatMessages = document.getElementById('chatMessages');
const chatInput = document.getElementById('chatInput');
const sendBtn = document.getElementById('sendBtn');
const loadingOverlay = document.getElementById('loadingOverlay');
const modalOverlay = document.getElementById('modalOverlay');
const modalTitle = document.getElementById('modalTitle');
const modalBody = document.getElementById('modalBody');

// Initialize the application
document.addEventListener('DOMContentLoaded', function() {
    initializeApp();
    setupEventListeners();
    autoResizeTextarea();
});

function initializeApp() {
    console.log('HealthCare Plus application initialized');
    loadChatHistory();

    // Remove the automatic webhook test that shows warning messages
    // testWebhookConnectivity();
}

// Webhook testing function
async function testWebhookConnectivity() {
    console.log('Testing webhook connectivity...');

    try {
        const response = await fetch(AppState.webhookUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                test: true,
                message: 'Connectivity test',
                timestamp: new Date().toISOString()
            })
        });

        if (response.ok) {
            AppState.webhookTested = true;
            console.log('✅ Webhook connectivity test passed');

            // Show success message in chat
            addSystemMessage('Webhook connection established successfully! 🟢', 'success');
        } else {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

    } catch (error) {
        AppState.webhookTested = false;
        AppState.lastError = error;
        console.error('❌ Webhook connectivity test failed:', error);

        // Show error message in chat with troubleshooting tips
        addSystemMessage(`
⚠️ Webhook connection failed.

Common solutions:
1. Check if your n8n workflow is active
2. Verify the webhook URL is correct
3. Ensure CORS is configured in n8n
4. Check your internet connection

Error: ${error.message}

You can still use the chat - it will show detailed error information if the webhook fails.`, 'warning');
    }
}

function setupEventListeners() {
    // Chat input events
    chatInput.addEventListener('input', autoResizeTextarea);
    chatInput.addEventListener('keydown', handleInputKeypress);
    
    // Send button event
    sendBtn.addEventListener('click', sendMessage);
    
    // Auto-resize textarea
    chatInput.addEventListener('input', function() {
        this.style.height = 'auto';
        this.style.height = Math.min(this.scrollHeight, 120) + 'px';
    });

    // Close modal on escape key
    document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape') {
            closeModal();
        }
    });
}

// Navigation functions
function scrollToChat() {
    document.getElementById('chat').scrollIntoView({ 
        behavior: 'smooth',
        block: 'start'
    });
    setTimeout(() => {
        chatInput.focus();
    }, 800);
}

function scrollToServices() {
    document.getElementById('services').scrollIntoView({ 
        behavior: 'smooth',
        block: 'start'
    });
}

function toggleMobileMenu() {
    // Mobile menu functionality (to be implemented)
    console.log('Mobile menu toggled');
}

// Chat functionality
function handleInputKeypress(event) {
    if (event.key === 'Enter' && !event.shiftKey) {
        event.preventDefault();
        sendMessage();
    }
}

function autoResizeTextarea() {
    const textarea = chatInput;
    textarea.style.height = 'auto';
    const newHeight = Math.min(textarea.scrollHeight, 120);
    textarea.style.height = newHeight + 'px';
}

async function sendMessage() {
    const message = chatInput.value.trim();
    
    if (!message || AppState.isTyping) {
        return;
    }

    // Disable input and show typing state
    setTypingState(true);
    
    // Add user message to chat
    addMessageToChat('user', message, new Date());
    
    // Clear input
    chatInput.value = '';
    autoResizeTextarea();
    
    // Scroll to bottom
    scrollToBottom();

    try {
        // Send message to webhook
        const response = await sendToWebhook(message);
        
        // Handle response
        await handleWebhookResponse(response);
        
    } catch (error) {
        console.error('Error sending message:', error);
        addErrorMessage('Sorry, I encountered an error while processing your request. Please try again.');
    } finally {
        setTypingState(false);
    }
}

async function sendToWebhook(message) {
    // Remove the loading overlay for immediate response feel
    // showLoadingOverlay('Consulting AI Doctor...');

    const payload = {
        message: message,
        user_id: AppState.currentUser,
        timestamp: new Date().toISOString(),
        session_id: `session_${Date.now()}`,
        context: {
            previous_messages: AppState.chatHistory.slice(-5), // Last 5 messages for context
            user_agent: navigator.userAgent,
            platform: 'web'
        }
    };

    console.log('Sending webhook request:', {
        url: AppState.webhookUrl,
        payload: payload
    });

    try {
        const response = await fetch(AppState.webhookUrl, {
            method: 'POST',
            mode: 'cors', // Explicitly set CORS mode
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json',
                // Add common headers that n8n might expect
                'User-Agent': navigator.userAgent,
                'Origin': window.location.origin
            },
            body: JSON.stringify(payload)
        });

        // hideLoadingOverlay(); // Not needed since we're not showing it

        console.log('Webhook response received:', {
            status: response.status,
            statusText: response.statusText,
            headers: Object.fromEntries(response.headers.entries()),
            url: response.url
        });

        // Get response as text (since you want text format only)
        const responseText = await response.text();
        console.log('Raw response text:', responseText);

        if (!response.ok) {
            // Create detailed error message
            const errorDetails = {
                status: response.status,
                statusText: response.statusText,
                url: response.url,
                responseText: responseText,
                headers: Object.fromEntries(response.headers.entries())
            };

            console.error('HTTP Error Details:', errorDetails);

            // Show detailed error to user
            displayErrorDetails(errorDetails);

            throw new Error(`HTTP ${response.status}: ${response.statusText}\nResponse: ${responseText}`);
        }

        // Return text response directly wrapped in a simple object
        const responseData = {
            message: responseText.trim(),
            raw_response: responseText,
            type: 'text'
        };

        // Log the response for debugging
        console.log('Text webhook response:', responseData);

        return responseData;

    } catch (error) {
        // hideLoadingOverlay(); // Not needed since we're not showing loading overlay
        console.error('Webhook error details:', {
            message: error.message,
            stack: error.stack,
            name: error.name
        });

        // Show user-friendly error with technical details
        displayNetworkError(error);
        throw error;
    }
}

async function handleWebhookResponse(response) {
    try {
        // For text responses, we don't need to show technical details unless there's an error
        if (response.type === 'text' && response.message) {
            // Direct text response - show immediately without typing simulation
            addMessageToChat('bot', response.message, new Date());
        } else {
            // Show response details for debugging if it's not a simple text response
            displayResponseDetails(response);

            // Extract the main message from different possible response formats
            let botMessage = extractBotMessage(response);

            if (botMessage) {
                // Add bot response to chat immediately
                addMessageToChat('bot', botMessage, new Date());
            } else {
                // Fallback message if we can't extract a proper response
                addMessageToChat('bot', 'I received your message and processed it successfully. The response format is shown above.', new Date());
            }
        }

    } catch (error) {
        console.error('Error handling webhook response:', error);
        addErrorMessage('I received a response but had trouble processing it. Please check the response details above.');
    }
}

function extractBotMessage(response) {
    // Try different possible response formats
    if (typeof response === 'string') {
        return response;
    }
    
    if (response && typeof response === 'object') {
        // Try common response format properties
        return response.message || 
               response.response || 
               response.reply || 
               response.text || 
               response.content ||
               response.data?.message ||
               response.result?.message ||
               null;
    }
    
    return null;
}

function displayResponseDetails(response) {
    // Create a formatted display of the webhook response
    const responseDisplay = document.createElement('div');
    responseDisplay.className = 'webhook-response-display';
    responseDisplay.innerHTML = `
        <div class="response-header">
            <i class="fas fa-code"></i>
            <strong>Webhook Response Details</strong>
            <button onclick="this.parentElement.parentElement.remove()" class="close-response-btn">
                <i class="fas fa-times"></i>
            </button>
        </div>
        <div class="response-content">
            <pre><code>${JSON.stringify(response, null, 2)}</code></pre>
        </div>
    `;

    // Add styles for the response display
    const style = document.createElement('style');
    style.textContent = `
        .webhook-response-display, .error-details-display {
            background: #f8f9fa;
            border: 1px solid #e9ecef;
            border-radius: 8px;
            margin: 1rem 0;
            overflow: hidden;
            font-family: monospace;
        }
        .error-details-display {
            border-color: #dc3545;
            background: #fff5f5;
        }
        .response-header, .error-header {
            background: #e9ecef;
            padding: 0.75rem 1rem;
            display: flex;
            align-items: center;
            gap: 0.5rem;
            font-weight: 600;
            color: #495057;
            position: relative;
        }
        .error-header {
            background: #f8d7da;
            color: #721c24;
        }
        .close-response-btn {
            background: none;
            border: none;
            cursor: pointer;
            margin-left: auto;
            color: #6c757d;
            padding: 0.25rem;
            border-radius: 4px;
        }
        .close-response-btn:hover {
            background: #dee2e6;
            color: #495057;
        }
        .response-content, .error-content {
            padding: 1rem;
            max-height: 300px;
            overflow-y: auto;
            background: white;
        }
        .error-content {
            background: #fff;
        }
        .response-content pre, .error-content pre {
            margin: 0;
            font-size: 0.875rem;
            line-height: 1.4;
            color: #495057;
        }
        .response-content code, .error-content code {
            background: none;
        }
        .error-summary {
            background: #f8d7da;
            color: #721c24;
            padding: 0.75rem;
            margin-bottom: 1rem;
            border-radius: 4px;
            font-weight: 500;
        }
    `;

    if (!document.querySelector('#response-display-styles')) {
        style.id = 'response-display-styles';
        document.head.appendChild(style);
    }

    // Add to chat messages area
    chatMessages.appendChild(responseDisplay);
    scrollToBottom();
}

function displayErrorDetails(errorDetails) {
    const errorDisplay = document.createElement('div');
    errorDisplay.className = 'error-details-display';
    errorDisplay.innerHTML = `
        <div class="error-header">
            <i class="fas fa-exclamation-triangle"></i>
            <strong>Webhook Error Details</strong>
            <button onclick="this.parentElement.parentElement.remove()" class="close-response-btn">
                <i class="fas fa-times"></i>
            </button>
        </div>
        <div class="error-content">
            <div class="error-summary">
                HTTP ${errorDetails.status}: ${errorDetails.statusText}
            </div>
            <pre><code>${JSON.stringify(errorDetails, null, 2)}</code></pre>
        </div>
    `;

    chatMessages.appendChild(errorDisplay);
    scrollToBottom();
}

function displayNetworkError(error) {
    const errorDisplay = document.createElement('div');
    errorDisplay.className = 'error-details-display';

    let errorMessage = 'Network or connection error occurred.';
    let troubleshooting = '';

    if (error.name === 'TypeError' && error.message.includes('fetch')) {
        errorMessage = 'Failed to connect to the webhook. This is likely a CORS or network issue.';
        troubleshooting = `
Possible solutions:
1. Check if the n8n webhook URL is correct and accessible
2. Ensure the n8n workflow is active and the webhook is enabled
3. Check if CORS is properly configured in n8n
4. Try accessing the webhook URL directly in a new browser tab
5. Check your internet connection`;
    }

    errorDisplay.innerHTML = `
        <div class="error-header">
            <i class="fas fa-wifi"></i>
            <strong>Connection Error</strong>
            <button onclick="this.parentElement.parentElement.remove()" class="close-response-btn">
                <i class="fas fa-times"></i>
            </button>
        </div>
        <div class="error-content">
            <div class="error-summary">
                ${errorMessage}
            </div>
            <pre><code>Error: ${error.message}

${troubleshooting}</code></pre>
        </div>
    `;

    chatMessages.appendChild(errorDisplay);
    scrollToBottom();
}

function addMessageToChat(sender, message, timestamp) {
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${sender}-message`;
    
    const avatar = document.createElement('div');
    avatar.className = 'message-avatar';
    avatar.innerHTML = sender === 'user' ? '<i class="fas fa-user"></i>' : '<i class="fas fa-robot"></i>';
    
    const content = document.createElement('div');
    content.className = 'message-content';
    
    const text = document.createElement('div');
    text.className = 'message-text';
    
    // Process message for links, formatting, etc.
    text.innerHTML = processMessageText(message);
    
    const time = document.createElement('div');
    time.className = 'message-time';
    time.textContent = formatTime(timestamp);
    
    content.appendChild(text);
    content.appendChild(time);
    
    messageDiv.appendChild(avatar);
    messageDiv.appendChild(content);
    
    chatMessages.appendChild(messageDiv);
    
    // Store in chat history
    AppState.chatHistory.push({
        sender,
        message,
        timestamp: timestamp.toISOString()
    });
    
    // Save to localStorage
    saveChatHistory();
    
    // Scroll to bottom with animation
    setTimeout(() => scrollToBottom(), 100);
}

function addErrorMessage(message) {
    const messageDiv = document.createElement('div');
    messageDiv.className = 'message bot-message message-error';

    const avatar = document.createElement('div');
    avatar.className = 'message-avatar';
    avatar.innerHTML = '<i class="fas fa-exclamation-triangle"></i>';

    const content = document.createElement('div');
    content.className = 'message-content';

    const text = document.createElement('div');
    text.className = 'message-text';
    text.textContent = message;

    const time = document.createElement('div');
    time.className = 'message-time';
    time.textContent = formatTime(new Date());

    content.appendChild(text);
    content.appendChild(time);

    messageDiv.appendChild(avatar);
    messageDiv.appendChild(content);

    chatMessages.appendChild(messageDiv);
    scrollToBottom();
}

function addSystemMessage(message, type = 'info') {
    const messageDiv = document.createElement('div');
    messageDiv.className = `message system-message message-${type}`;

    const avatar = document.createElement('div');
    avatar.className = 'message-avatar';

    let icon = '<i class="fas fa-info-circle"></i>';
    if (type === 'success') icon = '<i class="fas fa-check-circle"></i>';
    if (type === 'warning') icon = '<i class="fas fa-exclamation-triangle"></i>';
    if (type === 'error') icon = '<i class="fas fa-times-circle"></i>';

    avatar.innerHTML = icon;

    const content = document.createElement('div');
    content.className = 'message-content';

    const text = document.createElement('div');
    text.className = 'message-text';
    text.innerHTML = processMessageText(message);

    const time = document.createElement('div');
    time.className = 'message-time';
    time.textContent = formatTime(new Date());

    content.appendChild(text);
    content.appendChild(time);

    messageDiv.appendChild(avatar);
    messageDiv.appendChild(content);

    chatMessages.appendChild(messageDiv);
    scrollToBottom();

    // Add styles for system messages if not already added
    if (!document.querySelector('#system-message-styles')) {
        const style = document.createElement('style');
        style.id = 'system-message-styles';
        style.textContent = `
            .system-message {
                opacity: 0.9;
                font-size: 0.9em;
            }
            .system-message .message-avatar {
                background: #6c757d;
            }
            .message-success .message-avatar {
                background: #28a745;
            }
            .message-warning .message-avatar {
                background: #ffc107;
                color: #212529;
            }
            .message-error .message-avatar {
                background: #dc3545;
            }
            .system-message .message-content {
                background: #f8f9fa;
                border-left: 3px solid #6c757d;
            }
            .message-success .message-content {
                background: #d4edda;
                border-left-color: #28a745;
            }
            .message-warning .message-content {
                background: #fff3cd;
                border-left-color: #ffc107;
            }
            .message-error .message-content {
                background: #f8d7da;
                border-left-color: #dc3545;
            }
        `;
        document.head.appendChild(style);
    }
}

function processMessageText(text) {
    // Convert URLs to links
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    text = text.replace(urlRegex, '<a href="$1" target="_blank" rel="noopener noreferrer">$1</a>');
    
    // Convert line breaks to <br>
    text = text.replace(/\n/g, '<br>');
    
    return text;
}

function formatTime(date) {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

async function simulateTyping() {
    const typingIndicator = document.querySelector('.typing-indicator');
    if (typingIndicator) {
        typingIndicator.style.display = 'flex';
        scrollToBottom();
        
        // Simulate typing delay
        await new Promise(resolve => setTimeout(resolve, 1000 + Math.random() * 2000));
        
        typingIndicator.style.display = 'none';
    }
}

function setTypingState(isTyping) {
    AppState.isTyping = isTyping;
    sendBtn.disabled = isTyping;
    chatInput.disabled = isTyping;
    
    if (isTyping) {
        sendBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
    } else {
        sendBtn.innerHTML = '<i class="fas fa-paper-plane"></i>';
    }
}

function scrollToBottom() {
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

function clearChat() {
    if (confirm('Are you sure you want to clear the chat history?')) {
        chatMessages.innerHTML = `
            <div class="message bot-message">
                <div class="message-avatar">
                    <i class="fas fa-robot"></i>
                </div>
                <div class="message-content">
                    <div class="message-text">
                        Hello! I'm your AI Health Assistant. How can I help you today? You can ask me about symptoms, medications, health tips, or any health-related concerns.
                    </div>
                    <div class="message-time">Just now</div>
                </div>
            </div>
        `;
        AppState.chatHistory = [];
        saveChatHistory();
    }
}

function insertSuggestion(suggestion) {
    chatInput.value = suggestion;
    autoResizeTextarea();
    chatInput.focus();
}

function toggleChatSettings() {
    // Placeholder for chat settings functionality
    alert('Chat settings functionality to be implemented');
}

// Service modal functionality
function openServiceModal(serviceType) {
    const serviceData = getServiceData(serviceType);
    modalTitle.textContent = serviceData.title;
    modalBody.innerHTML = serviceData.content;
    modalOverlay.classList.add('active');
    document.body.style.overflow = 'hidden';
}

function closeModal() {
    modalOverlay.classList.remove('active');
    document.body.style.overflow = '';
}

function getServiceData(serviceType) {
    const services = {
        consultation: {
            title: 'AI Health Consultation',
            content: `
                <div class="service-modal-content">
                    <div class="service-icon-large">
                        <i class="fas fa-user-md"></i>
                    </div>
                    <h4>24/7 AI Health Assistant</h4>
                    <p>Get instant medical advice and health guidance from our advanced AI system.</p>
                    
                    <h5>Features:</h5>
                    <ul>
                        <li>Symptom analysis and assessment</li>
                        <li>Medication information and interactions</li>
                        <li>Health tips and recommendations</li>
                        <li>Emergency guidance</li>
                        <li>Follow-up care suggestions</li>
                    </ul>
                    
                    <div class="modal-actions">
                        <button class="btn btn-primary" onclick="closeModal(); scrollToChat();">
                            <i class="fas fa-comments"></i>
                            Start Consultation
                        </button>
                    </div>
                </div>
            `
        },
        appointment: {
            title: 'Appointment Booking',
            content: `
                <div class="service-modal-content">
                    <div class="service-icon-large">
                        <i class="fas fa-calendar-check"></i>
                    </div>
                    <h4>Book Your Appointment</h4>
                    <p>Schedule appointments with healthcare professionals at your convenience.</p>
                    
                    <div class="appointment-form">
                        <div class="form-group">
                            <label>Select Service</label>
                            <select class="form-control">
                                <option>General Consultation</option>
                                <option>Specialist Visit</option>
                                <option>Health Checkup</option>
                                <option>Follow-up Visit</option>
                            </select>
                        </div>
                        
                        <div class="form-group">
                            <label>Preferred Date</label>
                            <input type="date" class="form-control">
                        </div>
                        
                        <div class="form-group">
                            <label>Preferred Time</label>
                            <select class="form-control">
                                <option>Morning (9 AM - 12 PM)</option>
                                <option>Afternoon (12 PM - 5 PM)</option>
                                <option>Evening (5 PM - 8 PM)</option>
                            </select>
                        </div>
                        
                        <div class="modal-actions">
                            <button class="btn btn-primary">
                                <i class="fas fa-calendar-plus"></i>
                                Book Appointment
                            </button>
                        </div>
                    </div>
                </div>
            `
        },
        checkup: {
            title: 'Health Checkup',
            content: `
                <div class="service-modal-content">
                    <div class="service-icon-large">
                        <i class="fas fa-heartbeat"></i>
                    </div>
                    <h4>Comprehensive Health Assessment</h4>
                    <p>Complete health monitoring and assessment services.</p>
                    
                    <h5>Checkup Packages:</h5>
                    <div class="checkup-packages">
                        <div class="package-card">
                            <h6>Basic Checkup</h6>
                            <ul>
                                <li>Vital signs monitoring</li>
                                <li>Blood pressure check</li>
                                <li>Basic blood tests</li>
                                <li>Health consultation</li>
                            </ul>
                            <div class="package-price">$99</div>
                        </div>
                        
                        <div class="package-card">
                            <h6>Comprehensive Checkup</h6>
                            <ul>
                                <li>Full body examination</li>
                                <li>Complete blood panel</li>
                                <li>ECG and chest X-ray</li>
                                <li>Specialist consultations</li>
                            </ul>
                            <div class="package-price">$299</div>
                        </div>
                    </div>
                </div>
            `
        },
        pharmacy: {
            title: 'Online Pharmacy',
            content: `
                <div class="service-modal-content">
                    <div class="service-icon-large">
                        <i class="fas fa-pills"></i>
                    </div>
                    <h4>Medicine Delivery Service</h4>
                    <p>Order medicines and healthcare products with home delivery.</p>
                    
                    <div class="pharmacy-search">
                        <div class="form-group">
                            <label>Search Medicines</label>
                            <input type="text" class="form-control" placeholder="Enter medicine name...">
                        </div>
                        
                        <div class="upload-prescription">
                            <h6>Upload Prescription</h6>
                            <div class="upload-area">
                                <i class="fas fa-cloud-upload-alt"></i>
                                <p>Drag and drop your prescription or click to upload</p>
                                <input type="file" accept="image/*,.pdf">
                            </div>
                        </div>
                        
                        <div class="modal-actions">
                            <button class="btn btn-primary">
                                <i class="fas fa-search"></i>
                                Search Medicines
                            </button>
                        </div>
                    </div>
                </div>
            `
        },
        records: {
            title: 'Health Records',
            content: `
                <div class="service-modal-content">
                    <div class="service-icon-large">
                        <i class="fas fa-file-medical"></i>
                    </div>
                    <h4>Digital Health Records</h4>
                    <p>Secure storage and management of your health information.</p>
                    
                    <div class="records-features">
                        <div class="feature-item">
                            <i class="fas fa-shield-alt"></i>
                            <div>
                                <h6>Secure Storage</h6>
                                <p>Your data is encrypted and stored securely</p>
                            </div>
                        </div>
                        
                        <div class="feature-item">
                            <i class="fas fa-sync"></i>
                            <div>
                                <h6>Real-time Updates</h6>
                                <p>Automatic synchronization across devices</p>
                            </div>
                        </div>
                        
                        <div class="feature-item">
                            <i class="fas fa-share"></i>
                            <div>
                                <h6>Easy Sharing</h6>
                                <p>Share records with healthcare providers</p>
                            </div>
                        </div>
                    </div>
                    
                    <div class="modal-actions">
                        <button class="btn btn-primary">
                            <i class="fas fa-plus"></i>
                            Add Record
                        </button>
                        <button class="btn btn-outline">
                            <i class="fas fa-eye"></i>
                            View Records
                        </button>
                    </div>
                </div>
            `
        },
        wellness: {
            title: 'Wellness Programs',
            content: `
                <div class="service-modal-content">
                    <div class="service-icon-large">
                        <i class="fas fa-spa"></i>
                    </div>
                    <h4>Personalized Wellness Journey</h4>
                    <p>Custom wellness and fitness programs tailored to your needs.</p>
                    
                    <div class="wellness-programs">
                        <div class="program-card">
                            <h6><i class="fas fa-running"></i> Fitness Program</h6>
                            <p>Personalized workout plans and exercise routines</p>
                        </div>
                        
                        <div class="program-card">
                            <h6><i class="fas fa-utensils"></i> Nutrition Plan</h6>
                            <p>Custom meal plans and dietary recommendations</p>
                        </div>
                        
                        <div class="program-card">
                            <h6><i class="fas fa-brain"></i> Mental Wellness</h6>
                            <p>Stress management and mental health support</p>
                        </div>
                        
                        <div class="program-card">
                            <h6><i class="fas fa-bed"></i> Sleep Optimization</h6>
                            <p>Sleep tracking and improvement strategies</p>
                        </div>
                    </div>
                    
                    <div class="modal-actions">
                        <button class="btn btn-primary">
                            <i class="fas fa-play"></i>
                            Start Program
                        </button>
                    </div>
                </div>
            `
        }
    };
    
    return services[serviceType] || { title: 'Service', content: '<p>Service information not available.</p>' };
}

// Loading overlay functions
function showLoadingOverlay(message = 'Loading...') {
    const loadingText = loadingOverlay.querySelector('p');
    if (loadingText) {
        loadingText.textContent = message;
    }
    loadingOverlay.classList.add('active');
}

function hideLoadingOverlay() {
    loadingOverlay.classList.remove('active');
}

// Local storage functions
function saveChatHistory() {
    try {
        localStorage.setItem('healthapp_chat_history', JSON.stringify(AppState.chatHistory));
    } catch (error) {
        console.error('Error saving chat history:', error);
    }
}

function loadChatHistory() {
    try {
        const stored = localStorage.getItem('healthapp_chat_history');
        if (stored) {
            AppState.chatHistory = JSON.parse(stored);
            // Optionally restore chat messages to UI
            // restoreChatMessages();
        }
    } catch (error) {
        console.error('Error loading chat history:', error);
        AppState.chatHistory = [];
    }
}

// Additional utility functions
function validateInput(input) {
    return input && input.trim().length > 0 && input.trim().length <= 1000;
}

function sanitizeInput(input) {
    return input.trim().replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
}

// Health tips and suggestions
const healthTips = [
    "Drink at least 8 glasses of water daily to stay hydrated.",
    "Get 7-9 hours of quality sleep each night for optimal health.",
    "Exercise for at least 30 minutes daily to maintain fitness.",
    "Eat a balanced diet rich in fruits and vegetables.",
    "Take regular breaks from screen time to protect your eyes.",
    "Practice deep breathing exercises to reduce stress.",
    "Wash your hands frequently to prevent infections.",
    "Schedule regular health checkups with your doctor."
];

function getRandomHealthTip() {
    return healthTips[Math.floor(Math.random() * healthTips.length)];
}

// Export functions for testing (if needed)
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        sendToWebhook,
        handleWebhookResponse,
        extractBotMessage,
        processMessageText,
        formatTime
    };
}