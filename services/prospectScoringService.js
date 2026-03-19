/**
 * Prospect Scoring Service
 * Uses Claude API to score B2B prospects for Fleet Shield outreach.
 * Called by Make.com as part of the daily prospecting pipeline.
 *
 * Scoring:
 *   A — Multiple locations, heavy industry, decision-maker title → direct opener
 *   B — Likely has a fleet but unconfirmed → curiosity opener
 *   C — Poor fit → skip (log only, do not contact)
 */

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
const MODEL = 'claude-opus-4-6';

class ProspectScoringService {
    async scoreProspect(prospect) {
        if (!ANTHROPIC_API_KEY) {
            throw new Error('ANTHROPIC_API_KEY environment variable is not set');
        }

        const name = prospect.name || 'Unknown';
        const title = prospect.title || 'Unknown';
        const company = prospect.company || 'Unknown';
        const industry = prospect.industry || 'Unknown';
        const location = prospect.location || 'Unknown';
        const email = prospect.email || '';

        const promptLines = [
            'Evaluate this prospect for Fleet Shield, a SaaS platform that reduces forklift fleet costs through AI-powered risk scoring and predictive maintenance.',
            '',
            'Prospect details:',
            '- Name: ' + name,
            '- Title: ' + title,
            '- Company: ' + company,
            '- Industry: ' + industry,
            '- Location: ' + location,
            '- Email: ' + email,
            '',
            'Scoring rules:',
            '- A: Company very likely has a large forklift fleet (warehousing, distribution, manufacturing, logistics, food & beverage), 50+ employees, and the contact is a decision-maker (VP Ops, Director of Ops, Fleet Manager, Facilities Manager, COO, CEO). Write a direct, confident opener.',
            '- B: Company probably has some forklifts but it is not confirmed, or the title is mid-level. Write a curiosity-style opener that asks a question.',
            '- C: Poor fit — wrong industry, company too small, or contact has no fleet decision influence. Do not contact. Leave opener blank.',
            '',
            'Return valid JSON only with no additional text: {"score":"A","reason":"one sentence","opener":"personalized line under 2 sentences"}'
        ];

        const prompt = promptLines.join('\n');

        const response = await fetch('https://api.anthropic.com/v1/messages', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-api-key': ANTHROPIC_API_KEY,
                'anthropic-version': '2023-06-01'
            },
            body: JSON.stringify({
                model: MODEL,
                max_tokens: 300,
                system: 'You are a B2B sales assistant for Fleet Shield. Always respond with valid JSON only — no extra text, no markdown, no code fences.',
                messages: [{ role: 'user', content: prompt }]
            })
        });

        if (!response.ok) {
            const errorBody = await response.text();
            throw new Error('Claude API error ' + response.status + ': ' + errorBody);
        }

        const data = await response.json();
        const text = (data.content && data.content[0] && data.content[0].text || '').trim();

        if (!text) {
            throw new Error('Empty response from Claude API');
        }

        let result;
        try {
            result = JSON.parse(text);
        } catch (parseErr) {
            throw new Error('Could not parse Claude response as JSON: ' + text);
        }

        if (!['A', 'B', 'C'].includes(result.score)) {
            throw new Error('Unexpected score value: ' + result.score);
        }

        return {
            score: result.score,
            reason: result.reason || '',
            opener: result.opener || ''
        };
    }
}

module.exports = new ProspectScoringService();
