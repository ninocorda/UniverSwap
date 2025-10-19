const fs = require('fs');
const https = require('https');
const path = require('path');
const { createWriteStream } = require('fs');
const { pipeline } = require('stream/promises');

// Create tokens directory if it doesn't exist
const tokensDir = path.join(process.cwd(), 'apps/web/public/images/tokens');
if (!fs.existsSync(tokensDir)) {
  fs.mkdirSync(tokensDir, { recursive: true });
} else {
  // Clear existing files
  fs.readdirSync(tokensDir).forEach(file => {
    fs.unlinkSync(path.join(tokensDir, file));
  });
}

// Common BSC tokens with their contract addresses and symbols
const tokens = [
  { 
    symbol: 'WBNB',
    address: '0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c'
  },
  { 
    symbol: 'USDT',
    address: '0x55d398326f99059fF775485246999027B3197955'
  },
  { 
    symbol: 'BUSD',
    address: '0xe9e7CEA3DedcA5984780Bafc599bD69ADd087D56'
  },
  { 
    symbol: 'CAKE',
    address: '0x0E09FaBB73Bd3Ade0a17ECC321fD13a19e81cE82'
  },
  { 
    symbol: 'BTCB',
    address: '0x7130d2A12B9BCbFAe4f2634d864A1Ee1Ce3Ead9c'
  },
  { 
    symbol: 'ETH',
    address: '0x2170Ed0880ac9A755fd29B2688956BD959F933F8'
  },
  { 
    symbol: 'DAI',
    address: '0x1AF3F329e8BE154074D8769D1FFa4eE058B1DBc3'
  },
  { 
    symbol: 'USDC',
    address: '0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d'
  },
  { 
    symbol: 'DOT',
    address: '0x7083609fCE4d1d8Dc0C979AAb8c869Ea2C873402'
  },
  { 
    symbol: 'LINK',
    address: '0xF8A0BF9cF54Bb92F17374d9e9A321E6a111a51bD'
  }
];

// Base URL for Trust Wallet token logos (BSC chain ID: 56)
const baseUrl = 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/smartchain/assets';

// Function to download a file with retries
async function downloadFile(url, filePath, maxRetries = 3) {
  let retries = 0;
  
  while (retries < maxRetries) {
    try {
      const response = await new Promise((resolve, reject) => {
        const req = https.get(url, resolve);
        req.on('error', reject);
      });

      if (response.statusCode === 200) {
        const fileStream = createWriteStream(filePath);
        await pipeline(response, fileStream);
        return true;
      } else if (response.statusCode === 404) {
        console.log(`Logo not found at ${url}`);
        return false;
      } else {
        throw new Error(`HTTP ${response.statusCode}`);
      }
    } catch (error) {
      retries++;
      if (retries === maxRetries) {
        console.error(`Failed to download ${url} after ${maxRetries} attempts:`, error.message);
        return false;
      }
      // Wait before retrying
      await new Promise(resolve => setTimeout(resolve, 1000 * retries));
    }
  }
  return false;
}

// Download all token logos
async function downloadTokenLogos() {
  console.log('Starting to download token logos...');
  
  for (const token of tokens) {
    const address = token.address.toLowerCase();
    const fileName = `${address}/logo.png`;
    const url = `${baseUrl}/${fileName}`;
    const filePath = path.join(tokensDir, `${token.symbol.toLowerCase()}.png`);
    
    console.log(`Downloading ${token.symbol} from ${url}...`);
    const success = await downloadFile(url, filePath);
    
    if (success) {
      console.log(`✓ Downloaded ${token.symbol} logo`);
    } else {
      console.log(`× Failed to download ${token.symbol} logo`);
    }
    
    // Add a small delay to avoid rate limiting
    await new Promise(resolve => setTimeout(resolve, 200));
  }
  
  console.log('Token logo download completed!');
}

// Run the download
downloadTokenLogos().catch(console.error);
