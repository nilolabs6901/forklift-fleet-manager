/**
 * Eleven Labs Text-to-Speech Service
 * Converts text responses to voice audio using Eleven Labs API
 */

const https = require('https');
const path = require('path');
const fs = require('fs');

class ElevenLabsService {
    constructor() {
        this.apiKey = process.env.ELEVEN_LABS_API_KEY;
        this.baseUrl = 'api.elevenlabs.io';

        // Default voice - Rachel (clear, professional female voice)
        // Other options: 21m00Tcm4TlvDq8ikWAM (Rachel), EXAVITQu4vr4xnSDxMaL (Bella),
        // ErXwobaYiN019PkySvjV (Antoni), MF3mGyEYCl7XYWbV9V6O (Elli)
        this.defaultVoiceId = '21m00Tcm4TlvDq8ikWAM'; // Rachel

        // Voice settings for natural speech
        this.voiceSettings = {
            stability: 0.5,
            similarity_boost: 0.75
        };

        // Audio output directory
        this.audioDir = path.join(__dirname, '..', 'public', 'audio');
        this.ensureAudioDirectory();
    }

    /**
     * Ensure audio directory exists
     */
    ensureAudioDirectory() {
        if (!fs.existsSync(this.audioDir)) {
            fs.mkdirSync(this.audioDir, { recursive: true });
        }
    }

    /**
     * Check if service is configured
     */
    isConfigured() {
        return !!this.apiKey;
    }

    /**
     * Convert text to speech and return audio buffer
     * @param {string} text - Text to convert to speech
     * @param {string} voiceId - Optional voice ID override
     * @returns {Promise<Buffer>} Audio buffer (mp3)
     */
    async textToSpeech(text, voiceId = null) {
        if (!this.isConfigured()) {
            throw new Error('Eleven Labs API key not configured');
        }

        // Clean text for speech (remove markdown, special chars)
        const cleanText = this.cleanTextForSpeech(text);

        if (!cleanText || cleanText.length === 0) {
            throw new Error('No text provided for speech synthesis');
        }

        // Truncate very long responses for voice
        const maxLength = 1000;
        const truncatedText = cleanText.length > maxLength
            ? cleanText.substring(0, maxLength) + '... For more details, please check the displayed information.'
            : cleanText;

        const voice = voiceId || this.defaultVoiceId;

        const requestBody = JSON.stringify({
            text: truncatedText,
            model_id: 'eleven_multilingual_v2',
            voice_settings: this.voiceSettings
        });

        console.log('Eleven Labs TTS request - voice:', voice, 'text length:', truncatedText.length);

        return new Promise((resolve, reject) => {
            const options = {
                hostname: this.baseUrl,
                port: 443,
                path: `/v1/text-to-speech/${voice}`,
                method: 'POST',
                headers: {
                    'Accept': 'audio/mpeg',
                    'Content-Type': 'application/json',
                    'xi-api-key': this.apiKey,
                    'Content-Length': Buffer.byteLength(requestBody)
                }
            };

            const req = https.request(options, (res) => {
                const chunks = [];

                if (res.statusCode !== 200) {
                    let errorBody = '';
                    res.on('data', chunk => errorBody += chunk);
                    res.on('end', () => {
                        console.error('Eleven Labs API error:', res.statusCode, errorBody);
                        reject(new Error(`Eleven Labs API error: ${res.statusCode}`));
                    });
                    return;
                }

                res.on('data', (chunk) => {
                    chunks.push(chunk);
                });

                res.on('end', () => {
                    const audioBuffer = Buffer.concat(chunks);
                    resolve(audioBuffer);
                });
            });

            req.on('error', (error) => {
                console.error('Eleven Labs request error:', error);
                reject(error);
            });

            req.write(requestBody);
            req.end();
        });
    }

    /**
     * Convert text to speech and save as file
     * @param {string} text - Text to convert
     * @param {string} filename - Output filename (without extension)
     * @returns {Promise<string>} Public URL path to audio file
     */
    async textToSpeechFile(text, filename) {
        const audioBuffer = await this.textToSpeech(text);

        const audioFilename = `${filename}_${Date.now()}.mp3`;
        const filePath = path.join(this.audioDir, audioFilename);

        fs.writeFileSync(filePath, audioBuffer);

        // Clean up old audio files (keep last 50)
        this.cleanupOldAudioFiles();

        return `/audio/${audioFilename}`;
    }

    /**
     * Stream text to speech response directly
     * @param {string} text - Text to convert
     * @param {object} res - Express response object
     */
    async streamToResponse(text, res) {
        if (!this.isConfigured()) {
            res.status(500).json({ error: 'Voice service not configured' });
            return;
        }

        try {
            const audioBuffer = await this.textToSpeech(text);

            if (!audioBuffer || audioBuffer.length === 0) {
                throw new Error('Empty audio response from Eleven Labs');
            }

            console.log('Eleven Labs TTS success - audio size:', audioBuffer.length, 'bytes');

            res.set({
                'Content-Type': 'audio/mpeg',
                'Content-Length': audioBuffer.length,
                'Cache-Control': 'no-cache'
            });

            res.send(audioBuffer);
        } catch (error) {
            console.error('Voice stream error:', error.message);
            if (!res.headersSent) {
                res.status(500).json({ error: 'Failed to generate voice: ' + error.message });
            }
        }
    }

    /**
     * Clean text for speech synthesis
     * Removes markdown, URLs, special formatting
     */
    cleanTextForSpeech(text) {
        if (!text) return '';

        return text
            // Remove markdown bold/italic
            .replace(/\*\*([^*]+)\*\*/g, '$1')
            .replace(/\*([^*]+)\*/g, '$1')
            .replace(/__([^_]+)__/g, '$1')
            .replace(/_([^_]+)_/g, '$1')
            // Remove markdown links, keep text
            .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
            // Remove URLs
            .replace(/https?:\/\/[^\s]+/g, '')
            // Remove code blocks
            .replace(/`([^`]+)`/g, '$1')
            .replace(/```[\s\S]*?```/g, '')
            // Remove bullet points
            .replace(/^[\s]*[-•]\s*/gm, '')
            // Remove numbered lists formatting
            .replace(/^\d+\.\s*/gm, '')
            // Remove extra whitespace
            .replace(/\s+/g, ' ')
            // Remove special characters that don't speak well
            .replace(/[│├└─┌┐┘┴┬┤┼]/g, '')
            // Clean up parentheses with just numbers
            .replace(/\(\d+\)/g, '')
            // Expand common abbreviations for better speech
            .replace(/FL-(\d+)/g, 'Forklift $1')
            .replace(/PM-([A-C])/g, 'PM $1')
            .replace(/\bPM\b/g, 'preventive maintenance')
            .replace(/\bID\b/g, 'I.D.')
            .trim();
    }

    /**
     * Clean up old audio files to prevent disk bloat
     */
    cleanupOldAudioFiles() {
        try {
            const files = fs.readdirSync(this.audioDir)
                .filter(f => f.endsWith('.mp3'))
                .map(f => ({
                    name: f,
                    path: path.join(this.audioDir, f),
                    time: fs.statSync(path.join(this.audioDir, f)).mtime.getTime()
                }))
                .sort((a, b) => b.time - a.time);

            // Keep only last 50 files
            if (files.length > 50) {
                files.slice(50).forEach(f => {
                    try {
                        fs.unlinkSync(f.path);
                    } catch (e) {
                        // Ignore cleanup errors
                    }
                });
            }
        } catch (e) {
            // Ignore cleanup errors
        }
    }

    /**
     * Get available voices from Eleven Labs
     * @returns {Promise<Array>} List of available voices
     */
    async getVoices() {
        if (!this.isConfigured()) {
            return [];
        }

        return new Promise((resolve, reject) => {
            const options = {
                hostname: this.baseUrl,
                port: 443,
                path: '/v1/voices',
                method: 'GET',
                headers: {
                    'Accept': 'application/json',
                    'xi-api-key': this.apiKey
                }
            };

            const req = https.request(options, (res) => {
                let data = '';

                res.on('data', (chunk) => {
                    data += chunk;
                });

                res.on('end', () => {
                    try {
                        const result = JSON.parse(data);
                        resolve(result.voices || []);
                    } catch (e) {
                        resolve([]);
                    }
                });
            });

            req.on('error', () => resolve([]));
            req.end();
        });
    }
}

module.exports = new ElevenLabsService();
