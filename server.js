require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const TronWeb = require('tronweb');
const helmet = require('helmet');
const cors = require('cors');
const axios = require('axios');

const app = express();
app.use(helmet());
app.use(cors());
app.use(bodyParser.json());
app.use(express.static('public'));

const PORT = process.env.PORT || 3000;
const TRON_API_KEY = process.env.TRON_API_KEY || '';
const WALLET_ADDRESS = process.env.TRON_WALLET_ADDRESS || '';
const USDT_CONTRACT = process.env.USDT_CONTRACT_ADDRESS || 'TR7NHqjeKQxGTCuuQdCA3f2Y2Y8pSQVr7i';
const BING_API_KEY = process.env.BING_API_KEY || '';
const BING_ENDPOINT = process.env.BING_ENDPOINT || 'https://api.bing.microsoft.com/v7.0/search';

const tronWeb = new TronWeb({
  fullHost: 'https://api.trongrid.io',
  headers: { 'TRON-PRO-API-KEY': TRON_API_KEY }
});

// Return config (wallet) to frontend
app.get('/config', (req, res) => {
  res.json({ wallet: WALLET_ADDRESS });
});

// in-memory jobs for demo — replace with DB in production
const jobs = [];

/**
 * Detect TRC20 transfer logs related to USDT contract.
 */
function detectTrc20Transfer(txInfo, contractAddress) {
  try {
    if (!txInfo) return false;
    const logs = txInfo.log || [];
    const transferSig = 'ddf252ad';
    for (const l of logs) {
      const addr = (l.address || l.contractAddress || '').toLowerCase();
      if (addr && contractAddress.toLowerCase().includes(addr.replace(/^41/, ''))) {
        return true;
      }
      if (l.topics && Array.isArray(l.topics)) {
        for (const t of l.topics) {
          if (typeof t === 'string' && t.replace(/^0x/, '').startsWith(transferSig)) return true;
        }
      }
      if (l.data && typeof l.data === 'string' && l.data.includes(transferSig)) return true;
    }
  } catch (e) {
    console.error('detect error', e);
  }
  return false;
}

async function verifyTx(txId) {
  try {
    if (!txId) return { success: false, reason: 'no-txid' };
    const txInfo = await tronWeb.trx.getTransactionInfo(txId).catch(()=>null);
    const tx = await tronWeb.trx.getTransaction(txId).catch(()=>null);
    if (!txInfo) return { success: false, reason: 'no-txinfo', tx };
    if (!txInfo.receipt || txInfo.receipt.result !== 'SUCCESS') return { success: false, reason: 'receipt-not-success', txInfo };
    const found = detectTrc20Transfer(txInfo, USDT_CONTRACT);
    if (found) return { success: true, reason: 'transfer-detected', txInfo, tx };
    return { success: false, reason: 'no-transfer-log', txInfo, tx };
  } catch (err) {
    return { success: false, reason: 'error', error: String(err) };
  }
}

// lightweight scan
async function performScan(query) {
  if (BING_API_KEY) {
    try {
      const resp = await axios.get(BING_ENDPOINT, { params: { q: query, count: 5 }, headers: { 'Ocp-Apim-Subscription-Key': BING_API_KEY } });
      const items = (resp.data.webPages && resp.data.webPages.value) || [];
      return items.map(i => ({ name: i.name, url: i.url, snippet: i.snippet }));
    } catch (e) {
      console.error('Bing error', e.message);
    }
  }
  // fallback simulated results
  return [
    { name: 'Example Directory', url: 'https://example.com/profile/john', snippet: 'Public listing with name and email' },
    { name: 'Public Forum', url: 'https://forum.example.com/u/john', snippet: 'User posted contact info in thread' }
  ];
}

// lightweight erase (simulated)
async function performErase(query) {
  return [
    { site: 'Example Directory', action: 'submit removal form', status: 'requested' },
    { site: 'Public Forum', action: 'contact moderator', status: 'requested' }
  ];
}

app.post('/confirm-payment', async (req, res) => {
  try {
    const { txId, type, query } = req.body;
    if (!txId || !type) return res.status(400).json({ error: 'txId and type required' });
    const ver = await verifyTx(txId);
    const job = { id: Date.now().toString(), txId, type, query, status: ver.success ? 'queued' : 'pending', createdAt: new Date().toISOString() };
    jobs.push(job);
    if (ver.success) {
      processJob(job).catch(e => console.error('job error', e));
      return res.json({ message: 'payment-accepted', jobId: job.id });
    } else {
      return res.status(202).json({ message: 'payment-pending', reason: ver.reason });
    }
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: String(err) });
  }
});

app.get('/jobs', (req, res) => res.json(jobs));
app.get('/health', (req, res) => res.json({ status: 'ok', now: new Date().toISOString() }));

// Poll pending txs periodically
setInterval(async () => {
  try {
    const pending = jobs.filter(j => j.status === 'pending');
    for (const p of pending) {
      const ver = await verifyTx(p.txId);
      if (ver.success) {
        p.status = 'queued';
        processJob(p).catch(e => console.error('late job', e));
      }
    }
  } catch (e) {
    console.error('poller error', e);
  }
}, 15000);

async function processJob(job) {
  job.status = 'processing';
  if (job.type === 'scan') {
    job.result = { scan: await performScan(job.query) };
  } else if (job.type === 'erase') {
    job.result = { erase: await performErase(job.query) };
  }
  job.status = 'done';
  job.completedAt = new Date().toISOString();
  console.log('job done', job.id);
}

app.listen(PORT, () => {
  console.log('ClearShield listening on port', PORT);
});
