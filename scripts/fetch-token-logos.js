const fs = require('fs');
const https = require('https');
const path = require('path');

// Create tokens directory if it doesn't exist
const tokensDir = path.join(process.cwd(), 'apps/web/public/images/tokens');
if (!fs.existsSync(tokensDir)) {
  fs.mkdirSync(tokensDir, { recursive: true });
}

// Common BSC tokens (add more as needed)
const tokens = [
  '0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c', // WBNB
  '0x55d398326f99059fF775485246999027B3197955', // USDT
  '0xe9e7CEA3DedcA5984780Bafc599bD69ADd087D56', // BUSD
  '0x0E09FaBB73Bd3Ade0a17ECC321fD13a19e81cE82', // CAKE
  '0x7130d2A12B9BCbFAe4f2634d864A1Ee1Ce3Ead9c', // BTCB
  '0x2170Ed0880ac9A755fd29B2688956BD959F933F8', // ETH
  '0x1AF3F329e8BE154074D8769D1FFa4eE058B1DBc3', // DAI
  '0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d', // USDC
  '0x7083609fCE4d1d8Dc0C979AAb8c869Ea2C873402', // DOT
  '0xF8A0BF9cF54Bb92F17374d9e9A321E6a111a51bD'  // LINK
];

// Base URL for PancakeSwap token logos
const baseUrl = 'https://raw.githubusercontent.com/pancakeswap/token-list/main/lists/images';

// Function to download a file
function downloadFile(url, filePath) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(filePath);
    https.get(url, response => {
      response.pipe(file);
      file.on('finish', () => {
        file.close(resolve);
      });
    }).on('error', error => {
      fs.unlink(filePath, () => {}); // Delete the file async
      reject(error);
    });
  });
}

// Download all token logos
async function downloadTokenLogos() {
  console.log('Starting to download token logos...');
  
  for (const address of tokens) {
    const fileName = `${address.toLowerCase()}.png`;
    const filePath = path.join(tokensDir, fileName);
    const url = `${baseUrl}/${fileName}`;
    
    try {
      await downloadFile(url, filePath);
      console.log(`Downloaded: ${fileName}`);
    } catch (error) {
      console.error(`Error downloading ${fileName}:`, error.message);
    }
    
    // Add a small delay to avoid rate limiting
    await new Promise(resolve => setTimeout(resolve, 200));
  }
  
  // Create a mapping of token symbols to their addresses for easy reference
  const tokenMap = {
    'WBNB': '0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c',
    'USDT': '0x55d398326f99059fF775485246999027B3197955',
    'BUSD': '0xe9e7CEA3DedcA5984780Bafc599bD69ADd087D56',
    'CAKE': '0x0E09FaBB73Bd3Ade0a17ECC321fD13a19e81cE82',
    'BTCB': '0x7130d2A12B9BCbFAe4f2634d864A1Ee1Ce3Ead9c',
    'ETH': '0x2170Ed0880ac9A755fd29B2688956BD959F933F8',
    'DAI': '0x1AF3F329e8BE154074D8769D1FFa4eE058B1DBc3',
    'USDC': '0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d',
    'DOT': '0x7083609fCE4d1d8Dc0C979AAb8c869Ea2C873402',
    'LINK': '0xF8A0BF9cF54Bb92F17374d9e9A321E6a111a51bD'
  };
  
  // Create symlinks for token symbols (e.g., WBNB.png -> 0xbb4...5c.png)
  for (const [symbol, address] of Object.entries(tokenMap)) {
    const src = path.join(tokensDir, `${address.toLowerCase()}.png`);
    const dest = path.join(tokensDir, `${symbol.toLowerCase()}.png`);
    
    if (fs.existsSync(src) && !fs.existsSync(dest)) {
      try {
        fs.symlinkSync(src, dest, 'file');
        console.log(`Created symlink: ${symbol.toLowerCase()}.png`);
      } catch (error) {
        console.error(`Error creating symlink for ${symbol}:`, error.message);
      }
    }
  }
  
  console.log('Token logo download completed!');
}

// Run the download
downloadTokenLogos().catch(console.error);
