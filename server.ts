import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI } from '@google/genai';

async function startServer() {
  const app = express();
  const PORT = Number(process.env.PORT) || 3000;

  app.use(express.json());

  // Health check endpoint
  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  // Google Drive folder categorization map definition
  const CATEGORY_MAP: Record<string, { categoryName: string; parentFolder: string; parentFolderUrl: string }> = {
    Litigation: {
      categoryName: 'Litigation',
      parentFolder: 'SHCO Practice - Litigation Cases',
      parentFolderUrl: 'https://drive.google.com/drive/folders/1sY6K_OtFRoWCkBNd5ArDOoKtSZHiYN3h?usp=drive_link',
    },
    Conveyancing: {
      categoryName: 'Conveyancing',
      parentFolder: 'SHCO Practice - Conveyancing & Property',
      parentFolderUrl: 'https://drive.google.com/drive/folders/shco_conveyancing_master',
    },
    Criminal: {
      categoryName: 'Criminal',
      parentFolder: 'SHCO Practice - Criminal Defence',
      parentFolderUrl: 'https://drive.google.com/drive/folders/shco_criminal_master',
    },
    Corporate: {
      categoryName: 'Corporate',
      parentFolder: 'SHCO Practice - Corporate & Advisory',
      parentFolderUrl: 'https://drive.google.com/drive/folders/shco_corporate_master',
    },
  };

  // Endpoint to resolve or provision a Google Drive folder for a case based on type
  app.post('/api/drive/create-case-folder', (req, res) => {
    const { caseRef, caseTitle, practiceArea } = req.body;

    // Determine category based on practice area / case type
    let category = 'Corporate';
    const lowerArea = (practiceArea || '').toLowerCase();

    if (lowerArea.includes('litigation') || lowerArea.includes('civil') || lowerArea.includes('dispute') || lowerArea.includes('court') || lowerArea.includes('appeal')) {
      category = 'Litigation';
    } else if (lowerArea.includes('convey') || lowerArea.includes('property') || lowerArea.includes('spa') || lowerArea.includes('land') || lowerArea.includes('tenancy')) {
      category = 'Conveyancing';
    } else if (lowerArea.includes('criminal') || lowerArea.includes('defence') || lowerArea.includes('macc') || lowerArea.includes('bail') || lowerArea.includes('penal')) {
      category = 'Criminal';
    }

    const catInfo = CATEGORY_MAP[category] || CATEGORY_MAP['Corporate'];
    const sanitizedTitle = (caseTitle || 'New Matter').replace(/[/\\?%*:|"<>]/g, '-');
    const folderName = `[${caseRef || 'MATTER'}] ${sanitizedTitle}`;

    // Generated Google Drive folder URLs
    const folderId = category === 'Litigation' ? '1sY6K_OtFRoWCkBNd5ArDOoKtSZHiYN3h' : `gdrive_${category.toLowerCase()}_${Date.now()}`;
    const parentFolderUrl = catInfo.parentFolderUrl;
    const folderUrl = category === 'Litigation' 
      ? 'https://drive.google.com/drive/folders/1sY6K_OtFRoWCkBNd5ArDOoKtSZHiYN3h?usp=drive_link'
      : `https://drive.google.com/drive/folders/${folderId}`;

    res.json({
      success: true,
      category,
      parentFolderName: catInfo.parentFolder,
      parentFolderUrl,
      caseFolderName: folderName,
      folderId,
      folderUrl,
      subfolders: [
        '01_Pleadings & Court Papers',
        '02_Evidentiary Documents & Bundles',
        '03_Correspondences & Notices',
        '04_Bills & Financials',
      ],
      createdAt: new Date().toISOString(),
    });
  });

  // ================= Gemini AI — billing description drafter =================
  // POST /api/ai/draft-billing-items
  // Body: { practiceArea, clientName, matterTitle, matterRef, courtLevel?, stage?, subtype?, consideration?, hint? }
  // Returns: { items: [{ description, category, amount }] }
  app.post('/api/ai/draft-billing-items', async (req, res) => {
    try {
      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) {
        res.status(503).json({ error: 'GEMINI_API_KEY is not configured on the server.' });
        return;
      }
      const { practiceArea, clientName, matterTitle, matterRef, courtLevel, stage, subtype, consideration, hint } = req.body || {};

      const ai = new GoogleGenAI({ apiKey });
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
        .filter((i: any) => i && typeof i.description === 'string')
        .map((i: any) => ({
          description: String(i.description).slice(0, 200),
          category: validCategories.includes(i.category) ? i.category : 'Fee - Fixed',
          amount: Number(i.amount) >= 0 ? Number(i.amount) : 0,
        }))
        .slice(0, 6);

      res.json({ items });
    } catch (err: any) {
      console.error('AI draft error:', err);
      res.status(500).json({ error: err?.message || 'AI drafting failed' });
    }
  });

  // Disable aggressive caching so browser preview always loads fresh app state
  app.use((req, res, next) => {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    next();
  });

  // Vite middleware for development vs static build in production
  if (process.env.NODE_ENV !== 'production' || !process.env.NODE_ENV) {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath, { maxAge: 0, etag: false }));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`SHCO Legal System server running on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
});
