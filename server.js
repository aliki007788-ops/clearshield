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
const USDT_CONTRACT = 'TR7NHqjeKQxGTCuuQdCA3f2Y2Y8pSQ9e6';

const tronWeb = new TronWeb({
  fullHost: 'https://api.trongrid.io',
  headers: { 'TRON-PRO-API-KEY': process.env.TRON_API_KEY || '' }
});

const jobs = [];

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

app.get('/config', (req, res) => {
  res.json({ wallet: WALLET_ADDRESS });
});

async function verifyTx(txId) {
  try {
    const transaction = await tronWeb.trx.getTransaction(txId);
    if (!transaction) return false;

    const transactionInfo = await tronWeb.trx.getTransactionInfo(txId);
    if (!transactionInfo || transactionInfo.receipt?.result !== 'SUCCESS') return false;

    const contractData = transaction.raw_data.contract[0];
    if (contractData.type !== 'TriggerSmartContract') return false;

    const parameterValue = contractData.parameter.value;
    const toAddress = tronWeb.address.fromHex(parameterValue.contract_address);
    
    if (toAddress === USDT_CONTRACT) {
      for (const log of (transactionInfo.log || [])) {
        if (log.topics && log.topics[0] === 'ddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef') {
          const toAddressHex = log.topics[2];
          if (toAddressHex) {
            const recipient = tronWeb.address.fromHex('41' + toAddressHex.slice(-40));
            if (recipient === WALLET_ADDRESS) {
              return true;
            }
          }
        }
      }
    }
    return false;
  } catch (error) {
    console.error('Transaction verification error:', error);
    return false;
  }
}

app.post('/confirm-payment', async (req, res) => {
  try {
    const { txId, type, query } = req.body;
    
    if (!txId || !type || !query) {
      return res.status(400).json({ 
        success: false, 
        reason: 'missing_parameters'
      });
    }

    if (!['scan', 'erase'].includes(type)) {
      return res.status(400).json({
        success: false,
        reason: 'invalid_type'
      });
    }

    const verified = await verifyTx(txId);
    if (!verified) {
      return res.status(400).json({
        success: false,
        reason: 'payment_not_verified'
      });
    }

    const job = {
      id: Date.now().toString(),
      query: query.trim(),
      type,
      status: 'processing',
      createdAt: new Date().toISOString()
    };
    
    jobs.push(job);

    setTimeout(() => {
      const count = 5 + Math.floor(Math.random() * 15);
      const scanResults = Array.from({length: count}, () => 
        BROKER_SITES[Math.floor(Math.random() * BROKER_SITES.length)]
      );
      
      job.result = type === 'scan' ? { scan: scanResults } : { erase: true };
      job.status = 'completed';
      job.completedAt = new Date().toISOString();
    }, 5000);

    res.json({
      success: true,
      message: 'Payment confirmed',
      jobId: job.id
    });

  } catch (error) {
    console.error('Payment confirmation error:', error);
    res.status(500).json({
      success: false,
      reason: 'server_error'
    });
  }
});

app.get('/jobs', (req, res) => res.json(jobs));

app.listen(PORT, () => {
  console.log(`ClearShield server running on port ${PORT}`);
});
