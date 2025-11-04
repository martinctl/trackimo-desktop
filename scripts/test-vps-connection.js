#!/usr/bin/env node

/**
 * Test VPS connection and permissions
 * 
 * This script tests SSH connectivity and checks directory permissions
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

if (!vpsHost) {
  console.error('❌ Error: VPS_HOST environment variable is required');
  process.exit(1);
}

if (!vpsSshKey) {
  console.error('❌ Error: VPS_SSH_KEY environment variable is required');
  process.exit(1);
}

// Create temporary SSH key file
const sshKeyPath = path.join(__dirname, '../.tmp-ssh-key');
const sshKeyDir = path.dirname(sshKeyPath);

try {
  console.log('🔍 Testing VPS Connection...\n');
  
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
    try {
      execSync(`icacls "${sshKeyPath}" /inheritance:r`, { stdio: 'ignore' });
      execSync(`icacls "${sshKeyPath}" /grant:r "${process.env.USERNAME || 'runneradmin'}:(F)"`, { stdio: 'ignore' });
      execSync(`icacls "${sshKeyPath}" /remove "BUILTIN\\Users"`, { stdio: 'ignore' });
    } catch (e) {
      console.warn('⚠️  Warning: Could not set Windows file permissions.');
    }
  } else {
    fs.chmodSync(sshKeyPath, 0o600);
  }
  
  const sshOptions = [
    '-i', sshKeyPath,
    '-o', 'StrictHostKeyChecking=no',
    '-o', 'UserKnownHostsFile=/dev/null',
    '-o', 'BatchMode=yes'
  ];
  
  const sshCmd = sshOptions.join(' ');
  const remote = `${vpsUser}@${vpsHost}`;
  
  console.log('📋 Configuration:');
  console.log(`   VPS Host: ${vpsHost}`);
  console.log(`   VPS User: ${vpsUser}`);
  console.log(`   Remote Path: ${vpsReleasePath}`);
  console.log(`   SSH Key: ${sshKeyPath}`);
  console.log('');
  
  // Test 1: SSH Connection
  console.log('1️⃣  Testing SSH connection...');
  try {
    const result = execSync(`ssh ${sshCmd} ${remote} "echo 'SSH connection successful!'"`, { 
      encoding: 'utf-8',
      stdio: 'pipe'
    });
    console.log(`   ✅ ${result.trim()}`);
  } catch (e) {
    console.error(`   ❌ SSH connection failed: ${e.message}`);
    process.exit(1);
  }
  
  // Test 2: Check if directory exists
  console.log('\n2️⃣  Checking if directory exists...');
  try {
    const result = execSync(`ssh ${sshCmd} ${remote} "test -d ${vpsReleasePath} && echo 'exists' || echo 'not found'"`, { 
      encoding: 'utf-8',
      stdio: 'pipe'
    });
    if (result.trim() === 'exists') {
      console.log(`   ✅ Directory exists: ${vpsReleasePath}`);
    } else {
      console.log(`   ⚠️  Directory does not exist: ${vpsReleasePath}`);
      console.log(`   💡 Try creating it: ssh ${remote} "sudo mkdir -p ${vpsReleasePath}"`);
    }
  } catch (e) {
    console.error(`   ❌ Error checking directory: ${e.message}`);
  }
  
  // Test 3: Check directory permissions
  console.log('\n3️⃣  Checking directory permissions...');
  try {
    const result = execSync(`ssh ${sshCmd} ${remote} "ls -ld ${vpsReleasePath}"`, { 
      encoding: 'utf-8',
      stdio: 'pipe'
    });
    console.log(`   ${result.trim()}`);
    
    // Check if user can write
    const writeTest = execSync(`ssh ${sshCmd} ${remote} "test -w ${vpsReleasePath} && echo 'writable' || echo 'not writable'"`, { 
      encoding: 'utf-8',
      stdio: 'pipe'
    });
    if (writeTest.trim() === 'writable') {
      console.log(`   ✅ Directory is writable by ${vpsUser}`);
    } else {
      console.log(`   ❌ Directory is NOT writable by ${vpsUser}`);
      console.log(`   💡 Fix permissions: ssh ${remote} "sudo chown -R ${vpsUser}:${vpsUser} ${vpsReleasePath}"`);
      console.log(`   💡 Or: ssh ${remote} "sudo chmod 755 ${vpsReleasePath}"`);
    }
  } catch (e) {
    console.error(`   ❌ Error checking permissions: ${e.message}`);
  }
  
  // Test 4: Check current user
  console.log('\n4️⃣  Checking current user...');
  try {
    const result = execSync(`ssh ${sshCmd} ${remote} "whoami"`, { 
      encoding: 'utf-8',
      stdio: 'pipe'
    });
    console.log(`   ✅ Current user: ${result.trim()}`);
  } catch (e) {
    console.error(`   ❌ Error: ${e.message}`);
  }
  
  // Test 5: Try to create a test file
  console.log('\n5️⃣  Testing file upload...');
  const testFile = path.join(__dirname, '../test-upload.txt');
  fs.writeFileSync(testFile, 'Test file from GitHub Actions\n');
  
  try {
    execSync(`scp ${sshCmd} "${testFile}" ${remote}:${vpsReleasePath}/test-upload.txt`, { 
      stdio: 'inherit'
    });
    console.log(`   ✅ File uploaded successfully!`);
    
    // Verify file exists
    const verify = execSync(`ssh ${sshCmd} ${remote} "test -f ${vpsReleasePath}/test-upload.txt && echo 'exists' || echo 'not found'"`, { 
      encoding: 'utf-8',
      stdio: 'pipe'
    });
    if (verify.trim() === 'exists') {
      console.log(`   ✅ File verified on remote server`);
      
      // Clean up test file
      execSync(`ssh ${sshCmd} ${remote} "rm ${vpsReleasePath}/test-upload.txt"`, { 
        stdio: 'ignore'
      });
      console.log(`   ✅ Test file cleaned up`);
    }
  } catch (e) {
    console.error(`   ❌ File upload failed: ${e.message}`);
    console.log(`   💡 This is likely the same issue you're seeing in deployment`);
  }
  
  // Clean up local test file
  if (fs.existsSync(testFile)) {
    fs.unlinkSync(testFile);
  }
  
  console.log('\n✅ VPS connection test complete!');
  
} catch (error) {
  console.error(`❌ Test failed: ${error.message}`);
  process.exit(1);
} finally {
  // Clean up SSH key
  if (fs.existsSync(sshKeyPath)) {
    fs.unlinkSync(sshKeyPath);
  }
}

