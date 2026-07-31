export default async function handler(req, res) {
  // Only accept POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { code, payload } = req.body;

  if (!code || !payload) {
    return res.status(400).json({ error: 'Missing code or payload' });
  }

  // GitHub details from Environment Variables
  const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
  const REPO_OWNER = process.env.REPO_OWNER;
  const REPO_NAME = process.env.REPO_NAME;
  const FILE_PATH = 'setups.json';

  if (!GITHUB_TOKEN || !REPO_OWNER || !REPO_NAME) {
    return res.status(500).json({ error: 'Server environment variables not configured' });
  }

  const apiUrl = `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/contents/${FILE_PATH}`;

  try {
    // 1. Fetch current setups.json file details (need file SHA to update it)
    const getRes = await fetch(apiUrl, {
      headers: {
        'Authorization': `Bearer ${GITHUB_TOKEN}`,
        'User-Agent': 'Vercel-Function'
      }
    });

    let existingData = {};
    let sha = '';

    if (getRes.ok) {
      const fileInfo = await getRes.json();
      sha = fileInfo.sha;
      // Content is Base64 encoded from GitHub API
      const decodedContent = Buffer.from(fileInfo.content, 'base64').toString('utf-8');
      existingData = JSON.parse(decodedContent || '{}');
    }

    // 2. Append the new setup to the JSON database
    existingData[code] = payload;

    // 3. Commit updated JSON back to GitHub
    const updatedContent = Buffer.from(JSON.stringify(existingData, null, 2)).toString('base64');

    const putRes = await fetch(apiUrl, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${GITHUB_TOKEN}`,
        'Content-Type': 'application/json',
        'User-Agent': 'Vercel-Function'
      },
      body: JSON.stringify({
        message: `Add build setup code ${code}`,
        content: updatedContent,
        sha: sha || undefined
      })
    });

    if (!putRes.ok) {
      const errData = await putRes.json();
      throw new Error(errData.message || 'Failed to update GitHub repository file');
    }

    return res.status(200).json({ success: true, code });

  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: error.message || 'Internal server error' });
  }
}
