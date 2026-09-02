const { exec } = require('child_process');
const path = require('path');
const fs = require('fs');

// For Windows, generate self-signed cert using PowerShell
const scriptPath = path.join(__dirname, 'generate-windows-cert.ps1');

const psScript = `
$cert = New-SelfSignedCertificate -Type Custom -KeySpec Signature -Subject "CN=192.168.155.16" -FriendlyName "MetroCount PRO" -TextExtension "2.5.29.37={text}1.3.6.1.5.5.7.3.1" -HashAlgorithm sha256 -NotAfter (Get-Date).AddYears(1) -CertStoreLocation "cert:\\CurrentUser\\My"
$thumbprint = $cert.Thumbprint

# Export private key
$password = ConvertTo-SecureString -String "temp-password" -Force -AsPlainText
Export-PfxCertificate -Cert "cert:\\CurrentUser\\My\\$thumbprint" -FilePath "${__dirname}\\temp.pfx" -Password $password -Force | Out-Null

# Export certificate only
Export-Certificate -Cert "cert:\\CurrentUser\\My\\$thumbprint" -FilePath "${__dirname}\\server.crt" -Type CERT | Out-Null

Write-Host "Certificate generated successfully"
`;

fs.writeFileSync('temp-gen-cert.ps1', psScript.replace(/\$\{__dirname\}/g, __dirname.replace(/\\\\/g, '\\\\\\\\')));

exec('powershell -ExecutionPolicy Bypass -File "temp-gen-cert.ps1"', (error, stdout, stderr) => {
  if (error) {
    console.error('Error:', stderr);
    process.exit(1);
  }
  
  // For now, warn user to manually set up HTTPS or provide a pre-generated cert
  console.log('⚠️  Certificate setup incomplete. Please try accessing via HTTP first.');
  process.exit(0);
});

