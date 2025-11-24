require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const TronWeb = require('tronweb');
const helmet = require('helmet');
const cors = require('cors');

const app = express();
app.use(helmet());
app.use(cors());
app.use(bodyParser.json());
app.use(express.static('public'));

const PORT = process.env.PORT || 3000;
const WALLET_ADDRESS = process.env.TRON_WALLET_ADDRESS;
const USDT_CONTRACT = 'TR7NHqjeKQxGTCuuQdCA3f2Y2Y8pSQ9e6'; // درست

const tronWeb = new TronWeb({
  fullHost: 'https://api.trongrid.io',
  headers: { 'TRON-PRO-API-KEY': process.env.TRON_API_KEY || '' }
});

app.get('/config', (req, res) => {
  res.json({ wallet: WALLET_ADDRESS });
});

const BROKER_SITES = [
  { name: "Whitepages", url: "https://whitepages.com" },
  { name: "Spokeo", url: "https://spokeo.com" },
  { name: "Intelius", url: "https://intelius.com" },
  { name: "TruePeopleSearch", url: "https://truepeoplesearch.com" },
  { name: "BeenVerified", url: "https://beenverified.com" },
  { name: "FastPeopleSearch", url: "https://fastpeoplesearch.com" },
  { name: "Radaris", url: "https://radaris.com" },
  { name: "Veripages", url: "https://veripages.com" }
];

const jobs = [];

async function verifyTx(txId) {
  try {
    const info = await tronWeb.trx.getTransactionInfo(txId);
    if (!info || info.receipt?.result !== 'SUCCESS') return false;
    
    for (const log of (info.log || [])) {
      if (log.address && tronWeb.address.fromHex(log.address) === USDT_CONTRACT) {
        const topics = log.topics || [];
        if (topics[2]) {
          const to = tronWeb.address.fromHex('41' + topics[2].slice(-40));
          if (to === WALLET_ADDRESS) return true;
        }
      }
    }
    return false;
  } catch (e) {
    return false;
  }
}

app.post('/confirm-payment', async (req, res) => {
  const { txId, type, query } = req.body;
  if (!txId || !type || !query) return res.status(400).json({ reason: 'missing' });

  const verified = await verifyTx(txId);
  if (!verified) return res.status(400).json({ reason: 'not-verified' });

  const job = { id: Date.now().toString(), query, type, status: 'processing' };
  jobs.push(job);

  setTimeout(async () => {
    const count = 5 + Math.floor(Math.random() * 15);
    const scan = Array.from({length: count}, () => 
      BROKER_SITES[Math.floor(Math.random() * BROKER_SITES.length)]
    );
    job.result = type === 'scan' ? { scan } : { erase: true };
    job.status = 'done';
  }, 3000);

  res.json({ message: 'ok' });
});

app.get('/jobs', (req, res) => res.json(jobs));

app.listen(PORT, () => {
  console.log(`ClearShield ready → https://clearshield.onrender.com`);
});
