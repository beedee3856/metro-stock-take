const https = require('https');
const http = require('http');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const certPath = path.join(__dirname, 'server.crt');
const keyPath = path.join(__dirname, 'server.key');

// Function to create a self-signed certificate using mkcert
function ensureCertificates() {
  if (fs.existsSync(certPath) && fs.existsSync(keyPath)) {
    console.log('✅ Certificates already exist');
    return;
  }

  console.log('🔑 Generating self-signed certificate...');
  try {
    // Use Node.js to generate a basic certificate
    // For production, consider using mkcert or proper CA
    const { execSync } = require('child_process');
    
    // Try using PowerShell to generate certificate
    const psCommand = `
$cert = New-SelfSignedCertificate -CertStoreLocation "cert:\\CurrentUser\\My" -DnsName "192.168.155.16","localhost" -FriendlyName "MetroCount PRO" -Type Custom -KeyUsage DigitalSignature -KeyAlgorithm RSA -KeyLength 2048 -TextExtension "2.5.29.37={text}1.3.6.1.5.5.7.3.1" -NotAfter (Get-Date).AddYears(1);
$thumb = $cert.Thumbprint;
$pass = ConvertTo-SecureString -String "password" -Force -AsPlainText;
Export-PfxCertificate -Cert "cert:\\CurrentUser\\My\\$thumb" -FilePath "${__dirname}\\temp.pfx" -Password $pass;
Export-Certificate -Cert "cert:\\CurrentUser\\My\\$thumb" -FilePath "${__dirname}\\server.crt" -Type CERT;
Remove-Item "cert:\\CurrentUser\\My\\$thumb";
`;
    
    execSync(`powershell -Command "${psCommand}"`, { stdio: 'inherit' });
    console.log('✅ Certificate generated');
  } catch (error) {
    console.error('⚠️  Could not generate certificate via PowerShell');
    process.exit(1);
  }
}

ensureCertificates();

// Create HTTPS server that proxies to HTTP dev server
const options = {
  key: fs.readFileSync(keyPath),
  cert: fs.readFileSync(certPath)
};

const server = https.createServer(options, (req, res) => {
  // Proxy request to Next.js dev server running on localhost:3000
  const proxyReq = http.request({
    hostname: 'localhost',
    port: 3000,
    path: req.url,
    method: req.method,
    headers: {
      ...req.headers,
      host: 'localhost:3000'
    }
  }, (proxyRes) => {
    // Copy headers from proxied response
    Object.keys(proxyRes.headers).forEach(key => {
      res.setHeader(key, proxyRes.headers[key]);
    });
    res.writeHead(proxyRes.statusCode);
    proxyRes.pipe(res);
  });

  req.pipe(proxyReq);

  proxyReq.on('error', (error) => {
    console.error('Proxy error:', error);
    res.writeHead(502, { 'Content-Type': 'text/plain' });
    res.end('Bad Gateway - Is the dev server running on port 3000?');
  });
});

const PORT = 3443;
server.listen(PORT, '0.0.0.0', () => {
  console.log(`\n✅ HTTPS server running on https://192.168.155.16:${PORT}`);
  console.log(`📱 Open this on your phone: https://192.168.155.16:${PORT}`);
  console.log(`⚠️  Browser may show security warning - this is normal for self-signed certificates`);
  console.log(`   Click "Advanced" and proceed to the website\n`);
});
