/**
 * SHCO Portal — Cloud Functions
 * AI billing drafter (Gemini) served from the same Firebase project,
 * so portal.shcolaw.com needs no separate backend server.
 */
const { onRequest } = require('firebase-functions/v2/https');
const { defineSecret } = require('firebase-functions/params');
const { GoogleGenAI } = require('@google/genai');

const GEMINI_API_KEY = defineSecret('GEMINI_API_KEY');

const corsHeaders = (req, res) => {
  const origin = req.headers.origin || '*';
  res.set('Access-Control-Allow-Origin', origin);
  res.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.set('Access-Control-Allow-Headers', 'Content-Type');
};

exports.draftBillingItems = onRequest(
  { secrets: [GEMINI_API_KEY], region: 'asia-southeast1', timeoutSeconds: 60 },
  async (req, res) => {
    corsHeaders(req, res);
    if (req.method === 'OPTIONS') {
      res.status(204).send('');
      return;
    }
    if (req.method !== 'POST') {
      res.status(405).json({ error: 'POST only' });
      return;
    }

    try {
      const {
        practiceArea, clientName, matterTitle, matterRef,
        courtLevel, stage, subtype, consideration, hint,
      } = req.body || {};

      const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY.value() });
      const prompt = `You are the billing clerk of a Malaysian law firm (Syafiqah Hamizad & Co).
Draft professional billing line items for a ${practiceArea || 'legal'} matter.

Context:
- Client: ${clientName || 'Client'}
- Matter: ${matterTitle || 'General matter'} ${matterRef ? `(ref ${matterRef})` : ''}
${subtype ? `- Conveyancing type: ${subtype}\n` : ''}${courtLevel ? `- Court level: ${courtLevel}\n` : ''}${stage ? `- Stage: ${stage}\n` : ''}${consideration ? `- Consideration/loan amount: RM ${consideration}\n` : ''}${hint ? `- Partner instruction: ${hint}\n` : ''}
Rules:
- Produce 2 to 6 line items.
- category must be exactly one of: "Fee - Fixed", "Fee - SRO", "Disbursement", "Reimbursement".
- Professional fees go under "Fee - Fixed" or "Fee - SRO".
- Court fees, stamp duty, search fees go under "Disbursement".
- Photocopy/courier/travel go under "Reimbursement".
- amount is a number in MYR, no currency symbols. Use 0 for amounts the firm will fill in manually.
- Descriptions must sound like a real Malaysian legal bill (formal, specific).

Respond with ONLY valid JSON in this exact shape, no markdown:
{"items":[{"description":"...","category":"Fee - Fixed","amount":0}]}`;

      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt,
      });

      const text = (response.text || '').trim();
      const jsonStart = text.indexOf('{');
      const jsonEnd = text.lastIndexOf('}');
      if (jsonStart === -1 || jsonEnd === -1) throw new Error('AI returned non-JSON');
      const parsed = JSON.parse(text.slice(jsonStart, jsonEnd + 1));

      const validCategories = ['Fee - Fixed', 'Fee - SRO', 'Disbursement', 'Reimbursement'];
      const items = (parsed.items || [])
        .filter((i) => i && typeof i.description === 'string')
        .map((i) => ({
          description: String(i.description).slice(0, 200),
          category: validCategories.includes(i.category) ? i.category : 'Fee - Fixed',
          amount: Number(i.amount) >= 0 ? Number(i.amount) : 0,
        }))
        .slice(0, 6);

      res.json({ items });
    } catch (err) {
      console.error('AI draft error:', err);
      res.status(500).json({ error: (err && err.message) || 'AI drafting failed' });
    }
  }
);

exports.aiAssistant = onRequest(
  { secrets: [GEMINI_API_KEY], region: 'asia-southeast1', timeoutSeconds: 60 },
  async (req, res) => {
    corsHeaders(req, res);
    if (req.method === 'OPTIONS') {
      res.status(204).send('');
      return;
    }
    if (req.method !== 'POST') {
      res.status(405).json({ error: 'POST only' });
      return;
    }

    try {
      const { prompt, mode = 'general', context = '' } = req.body || {};
      const userInput = typeof prompt === 'string' ? prompt.trim() : '';
      if (!userInput) {
        res.status(400).json({ error: 'A prompt is required.' });
        return;
      }

      const modeInstructions = {
        general: 'You are a legal operations assistant for a Malaysian law firm. Help with summaries, drafting, task planning, and risk review in clear professional language.',
        meeting: 'You are a legal meeting assistant. Turn raw meeting transcript notes into a concise meeting summary with key issues, decisions, risks, and next steps.',
        task: 'You are a legal workflow planner. Break the request into practical tasks, owners, and sequencing.',
        email: 'You are a legal communication assistant. Draft clear, professional client or internal emails. Keep tone formal and concise.',
        review: 'You are a legal case review assistant. Highlight risks, missing items, and recommended next steps for the matter.',
      };
      const instruction = modeInstructions[mode] || modeInstructions.general;
      const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY.value() });
      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: `${instruction}\n\nContext:\n${context || 'No extra context provided.'}\n\nUser request:\n${userInput}`,
      });

      const reply = String(response.text || '').trim();
      if (!reply) throw new Error('AI returned no response text.');
      res.json({ reply, mode, generatedAt: new Date().toISOString() });
    } catch (err) {
      console.error('AI assistant error:', err);
      res.status(500).json({ error: (err && err.message) || 'AI assistant failed' });
    }
  }
);

exports.meetingSummary = onRequest(
  { secrets: [GEMINI_API_KEY], region: 'asia-southeast1', timeoutSeconds: 60 },
  async (req, res) => {
    corsHeaders(req, res);
    if (req.method === 'OPTIONS') {
      res.status(204).send('');
      return;
    }
    if (req.method !== 'POST') {
      res.status(405).json({ error: 'POST only' });
      return;
    }

    try {
      const { transcript, caseTitle, clientName, meetingDate } = req.body || {};
      const rawTranscript = typeof transcript === 'string' ? transcript.trim() : '';
      if (!rawTranscript) {
        res.status(400).json({ error: 'Meeting transcript is required.' });
        return;
      }

      const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY.value() });
      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: `You are a legal assistant for a Malaysian law firm. Summarize the meeting transcript into a formal internal meeting record.

Matter: ${caseTitle || 'General matter'}
Client: ${clientName || 'Client'}
Meeting date: ${meetingDate || new Date().toISOString().slice(0, 10)}

Transcript:
${rawTranscript}

Return valid JSON only in this exact schema:
{"summary":"Short professional summary","decisions":"Main decisions and agreed actions","nextSteps":"Ordered list of next steps","risks":"Key legal or commercial risks, if any"}

Do not add markdown fences or extra text.`,
      });

      const text = String(response.text || '').trim();
      const jsonStart = text.indexOf('{');
      const jsonEnd = text.lastIndexOf('}');
      if (jsonStart === -1 || jsonEnd === -1) throw new Error('AI returned a non-JSON response.');
      const parsed = JSON.parse(text.slice(jsonStart, jsonEnd + 1));
      res.json({
        summary: parsed.summary || 'Summary not generated.',
        decisions: parsed.decisions || 'No decisions recorded.',
        nextSteps: parsed.nextSteps || 'No next steps identified.',
        risks: parsed.risks || 'No material risks identified.',
        generatedAt: new Date().toISOString(),
      });
    } catch (err) {
      console.error('AI meeting summary error:', err);
      res.status(500).json({ error: (err && err.message) || 'Meeting summary generation failed' });
    }
  }
);
