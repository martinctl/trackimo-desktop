#!/usr/bin/env node

/**
 * Deploys release artifacts to VPS
 * 
 * This script uploads the MSI installer, signature file, and manifest to your VPS.
 * It expects the artifacts to be in ./release-artifacts directory (from GitHub Actions).
 * 
 * Environment variables:
 *   VPS_HOST - VPS hostname (e.g., trackimo.lol)
 *   VPS_USER - SSH username (default: trackimo)
 *   VPS_SSH_KEY - Base64 encoded SSH private key (from GitHub Secrets)
 *   VPS_RELEASE_PATH - Remote directory path (default: /var/www/release.trackimo.lol)
 *   VERSION - Version number (from GitHub Actions or manual)
 */

import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import os from 'os';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Get environment variables
const vpsHost = process.env.VPS_HOST;
const vpsUser = process.env.VPS_USER || 'trackimo';
const vpsSshKey = process.env.VPS_SSH_KEY;
const vpsReleasePath = process.env.VPS_RELEASE_PATH || '/var/www/release.trackimo.lol';
const version = process.env.VERSION || process.env.GITHUB_REF?.replace('refs/tags/app-v', '') || '1.0.0';

if (!vpsHost) {
  console.error('❌ Error: VPS_HOST environment variable is required');
  process.exit(1);
}

if (!vpsSshKey) {
  console.error('❌ Error: VPS_SSH_KEY environment variable is required');
  console.error('   This should be a base64-encoded SSH private key stored in GitHub Secrets');
  process.exit(1);
}

// Create temporary SSH key file
const sshKeyPath = path.join(__dirname, '../.tmp-ssh-key');
const sshKeyDir = path.dirname(sshKeyPath);

try {
  // Decode base64 SSH key
  const sshKeyBuffer = Buffer.from(vpsSshKey, 'base64');
  const sshKeyContent = sshKeyBuffer.toString('utf-8');
  
  // Ensure directory exists
  if (!fs.existsSync(sshKeyDir)) {
    fs.mkdirSync(sshKeyDir, { recursive: true });
  }
  
  // Write SSH key
  fs.writeFileSync(sshKeyPath, sshKeyContent);
  
  // Set secure permissions (Windows-compatible)
  const isWindows = os.platform() === 'win32';
  if (isWindows) {
    // On Windows, use icacls to set permissions
    // Remove inheritance and all permissions, then grant only to current user
    try {
      // First, remove inheritance and all existing permissions
      execSync(`icacls "${sshKeyPath}" /inheritance:r`, { stdio: 'ignore' });
      // Grant full control to current user (usually runneradmin in GitHub Actions)
      execSync(`icacls "${sshKeyPath}" /grant:r "${process.env.USERNAME || 'runneradmin'}:(F)"`, { stdio: 'ignore' });
      // Explicitly deny access to BUILTIN\Users (this is what SSH requires)
      execSync(`icacls "${sshKeyPath}" /remove "BUILTIN\\Users"`, { stdio: 'ignore' });
    } catch (e) {
      // If icacls fails, try using PowerShell with proper ACL
      try {
        const escapedPath = sshKeyPath.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
        const psScript = `$path = "${escapedPath}"; $acl = Get-Acl $path; $acl.SetAccessRuleProtection($true, $false); $user = [System.Security.Principal.WindowsIdentity]::GetCurrent().Name; $accessRule = New-Object System.Security.AccessControl.FileSystemAccessRule($user, "FullControl", "Allow"); $acl.RemoveAccessRuleAll($accessRule); $acl.AddAccessRule($accessRule); Set-Acl $path $acl`;
        execSync(`powershell -Command "${psScript}"`, { stdio: 'ignore' });
      } catch (e2) {
        console.warn('⚠️  Warning: Could not set Windows file permissions.');
        console.warn('   Attempting to continue anyway...');
      }
    }
  } else {
    // On Unix/Linux, use chmod
    fs.chmodSync(sshKeyPath, 0o600);
  }
  
  console.log(`📦 Deploying version ${version} to ${vpsUser}@${vpsHost}:${vpsReleasePath}`);
  
  // Debug: Show configuration
  console.log(`\n🔍 Debug Info:`);
  console.log(`   VPS Host: ${vpsHost}`);
  console.log(`   VPS User: ${vpsUser}`);
  console.log(`   Remote Path: ${vpsReleasePath}`);
  console.log(`   SSH Key Path: ${sshKeyPath}`);
  console.log(`   Platform: ${os.platform()}\n`);
  
  // Find MSI and signature files
  const artifactsDir = path.join(__dirname, '../release-artifacts');
  
  if (!fs.existsSync(artifactsDir)) {
    console.error(`❌ Error: Release artifacts directory not found: ${artifactsDir}`);
    process.exit(1);
  }
  
  // Recursively find all files
  function findFiles(dir, extension) {
    const files = [];
    const items = fs.readdirSync(dir, { withFileTypes: true });
    for (const item of items) {
      const fullPath = path.join(dir, item.name);
      if (item.isDirectory()) {
        files.push(...findFiles(fullPath, extension));
      } else if (item.isFile() && item.name.endsWith(extension)) {
        files.push(fullPath);
      }
    }
    return files;
  }
  
  const msiFiles = findFiles(artifactsDir, '.msi');
  const sigFiles = findFiles(artifactsDir, '.sig');
  const jsonFiles = findFiles(artifactsDir, '.json');
  
  if (msiFiles.length === 0) {
    console.error('❌ Error: No MSI installer found in release artifacts');
    console.error(`   Searched in: ${artifactsDir}`);
    process.exit(1);
  }
  
  const msiFile = path.basename(msiFiles[0]);
  const msiFullPath = msiFiles[0];
  const sigFile = sigFiles.length > 0 ? path.basename(sigFiles[0]) : null;
  const sigFullPath = sigFiles.length > 0 ? sigFiles[0] : null;
  const manifestFile = jsonFiles.find(f => f.includes('manifest')) || jsonFiles[0];
  const manifestPath = manifestFile ? manifestFile : null;
  
  if (!sigFile) {
    console.warn('⚠️  Warning: No signature file found. Updates will fail without signature.');
  }
  
  // Create manifest if it doesn't exist
  let finalManifestPath = manifestPath;
  if (!manifestPath || !fs.existsSync(manifestPath)) {
    console.log('📝 Generating manifest...');
    const manifest = {
      version: version.replace(/^v/, ''),
      notes: `Trackimo Desktop v${version}`,
      pub_date: new Date().toISOString(),
      platforms: {
        'windows-x86_64': {
          signature: sigFile ? `https://release.trackimo.lol/${sigFile}` : '',
          url: `https://release.trackimo.lol/${msiFile}`
        }
      }
    };
    finalManifestPath = path.join(artifactsDir, 'latest.json');
    fs.writeFileSync(finalManifestPath, JSON.stringify(manifest, null, 2));
    console.log('✅ Manifest generated');
  }
  
  // Build SCP commands
  const scpOptions = [
    '-i', sshKeyPath,
    '-o', 'StrictHostKeyChecking=no',
    '-o', 'UserKnownHostsFile=/dev/null',
    '-o', 'BatchMode=yes'
  ];
  
  // Upload files
  console.log('📤 Uploading files to VPS...');
  
  const remotePath = `${vpsUser}@${vpsHost}:${vpsReleasePath}`;
  
  // Debug: Check remote directory permissions first
  console.log('\n🔍 Checking remote directory permissions...');
  try {
    const checkDir = execSync(`ssh ${scpOptions.join(' ')} ${vpsUser}@${vpsHost} "ls -ld ${vpsReleasePath}"`, { 
      encoding: 'utf-8',
      stdio: 'pipe'
    });
    console.log(`   ${checkDir.trim()}`);
    
    const checkWrite = execSync(`ssh ${scpOptions.join(' ')} ${vpsUser}@${vpsHost} "test -w ${vpsReleasePath} && echo 'writable' || echo 'NOT writable'"`, { 
      encoding: 'utf-8',
      stdio: 'pipe'
    });
    if (checkWrite.trim() === 'writable') {
      console.log(`   ✅ Directory is writable\n`);
    } else {
      console.error(`   ❌ Directory is NOT writable!\n`);
      console.error(`   💡 Fix with: ssh ${vpsUser}@${vpsHost} "sudo chown -R ${vpsUser}:${vpsUser} ${vpsReleasePath}"`);
      console.error(`   💡 Or: ssh ${vpsUser}@${vpsHost} "sudo chmod 755 ${vpsReleasePath}"\n`);
    }
  } catch (e) {
    console.warn(`   ⚠️  Could not check permissions: ${e.message}\n`);
  }
  
  // Ensure remote directory exists
  console.log('📁 Ensuring remote directory exists...');
  const sshCmd = ['ssh', ...scpOptions, `${vpsUser}@${vpsHost}`, `mkdir -p ${vpsReleasePath}`];
  try {
    execSync(sshCmd.join(' '), { stdio: 'inherit' });
    console.log('   ✅ Directory check complete\n');
  } catch (e) {
    console.error(`   ❌ Failed to create directory: ${e.message}`);
    throw e;
  }
  
  // Upload MSI
  const scpMsi = ['scp', ...scpOptions, msiFullPath, remotePath];
  execSync(scpMsi.join(' '), { stdio: 'inherit' });
  console.log(`✅ Uploaded ${msiFile}`);
  
  // Upload signature if exists
  if (sigFile && sigFullPath) {
    const scpSig = ['scp', ...scpOptions, sigFullPath, remotePath];
    execSync(scpSig.join(' '), { stdio: 'inherit' });
    console.log(`✅ Uploaded ${sigFile}`);
  }
  
  // Upload manifest as latest.json
  const scpManifest = ['scp', ...scpOptions, finalManifestPath, `${remotePath}/latest.json`];
  execSync(scpManifest.join(' '), { stdio: 'inherit' });
  console.log('✅ Uploaded latest.json');
  
  // Set permissions on remote files
  const chmodCmd = ['ssh', ...scpOptions, `${vpsUser}@${vpsHost}`, 
    `chmod 644 ${vpsReleasePath}/*`];
  execSync(chmodCmd.join(' '), { stdio: 'inherit' });
  
  console.log('✅ Deployment complete!');
  console.log(`🌐 Release available at: https://release.trackimo.lol/latest.json`);
  
} catch (error) {
  console.error(`❌ Deployment failed: ${error.message}`);
  process.exit(1);
} finally {
  // Clean up SSH key
  if (fs.existsSync(sshKeyPath)) {
    fs.unlinkSync(sshKeyPath);
  }
}

