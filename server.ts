import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';

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
