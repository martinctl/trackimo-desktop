#!/usr/bin/env node

/**
 * Generates a Tauri updater-compatible JSON manifest from GitHub Releases
 * 
 * This script fetches the latest release from GitHub and generates a manifest
 * in the format expected by Tauri's updater plugin.
 * 
 * Usage:
 *   node scripts/generate-update-manifest.js
 * 
 * Environment variables:
 *   GITHUB_TOKEN - GitHub personal access token (required for private repos)
 *   REPO_OWNER - Repository owner (default: from git remote)
 *   REPO_NAME - Repository name (default: from git remote)
 *   RELEASE_TAG - Specific release tag to use (default: latest)
 */

import https from 'https';
import fs from 'fs';
import { execSync } from 'child_process';

// Get repository info from git if not provided
function getRepoInfo() {
  try {
    const remoteUrl = execSync('git config --get remote.origin.url', { encoding: 'utf-8' }).trim();
    const match = remoteUrl.match(/github\.com[:/]([^/]+)\/([^/]+)(?:\.git)?$/);
    if (match) {
      return { owner: match[1], name: match[2].replace('.git', '') };
    }
  } catch (e) {
    // Ignore
  }
  return { owner: process.env.REPO_OWNER, name: process.env.REPO_NAME };
}

// Fetch release from GitHub API
function fetchRelease(owner, repo, tag = 'latest', token) {
  return new Promise((resolve, reject) => {
    const path = tag === 'latest' 
      ? `/repos/${owner}/${repo}/releases/latest`
      : `/repos/${owner}/${repo}/releases/tags/${tag}`;
    
    const options = {
      hostname: 'api.github.com',
      path: path,
      method: 'GET',
      headers: {
        'User-Agent': 'Tauri-Updater-Manifest-Generator',
        'Accept': 'application/vnd.github.v3+json',
        ...(token && { 'Authorization': `token ${token}` })
      }
    };

    https.get(options, (res) => {
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        if (res.statusCode === 200) {
          try {
            resolve(JSON.parse(data));
          } catch (e) {
            reject(new Error('Failed to parse GitHub API response'));
          }
        } else if (res.statusCode === 404) {
          reject(new Error(`Release not found: ${tag}`));
        } else {
          reject(new Error(`GitHub API error: ${res.statusCode} - ${data}`));
        }
      });
    }).on('error', reject);
  });
}

// Map platform names
function getPlatformName(assetName) {
  const name = assetName.toLowerCase();
  if (name.includes('darwin') || name.includes('macos') || name.includes('.dmg') || name.includes('.app')) {
    return 'darwin';
  }
  if (name.includes('windows') || name.includes('.exe') || name.includes('.msi')) {
    return 'windows';
  }
  if (name.includes('linux') || name.includes('.AppImage') || name.includes('.deb') || name.includes('.rpm')) {
    return 'linux';
  }
  return null;
}

// Map architecture
function getArch(assetName) {
  const name = assetName.toLowerCase();
  if (name.includes('x86_64') || name.includes('x64') || name.includes('amd64')) {
    return 'x86_64';
  }
  if (name.includes('aarch64') || name.includes('arm64')) {
    return 'aarch64';
  }
  if (name.includes('x86') || name.includes('i386') || name.includes('i686')) {
    return 'x86';
  }
  return 'x86_64'; // default
}

// Generate Tauri update manifest
function generateManifest(release) {
  const version = release.tag_name.replace(/^v/, ''); // Remove 'v' prefix if present
  const platforms = {};
  
  // Process each asset
  for (const asset of release.assets) {
    const platform = getPlatformName(asset.name);
    if (!platform) continue;
    
    const arch = getArch(asset.name);
    const key = `${platform}-${arch}`;
    
    // Find signature file
    const sigAsset = release.assets.find(a => 
      a.name === `${asset.name}.sig` || 
      a.name === asset.name.replace(/\.(tar\.gz|zip|dmg|exe|msi|AppImage|deb|rpm)$/, '.sig')
    );
    
    if (!platforms[key]) {
      platforms[key] = {
        signature: sigAsset ? sigAsset.browser_download_url : '',
        url: asset.browser_download_url
      };
    }
  }
  
  // If no platforms found, create a generic entry
  if (Object.keys(platforms).length === 0) {
    console.warn('⚠️  No platform-specific assets found. Creating generic manifest.');
    if (release.assets.length > 0) {
      const firstAsset = release.assets[0];
      const sigAsset = release.assets.find(a => a.name.endsWith('.sig'));
      platforms['*'] = {
        signature: sigAsset ? sigAsset.browser_download_url : '',
        url: firstAsset.browser_download_url
      };
    }
  }
  
  return {
    version: version,
    notes: release.body || `Update to version ${version}`,
    pub_date: release.published_at || new Date().toISOString(),
    platforms: platforms
  };
}

// Main execution
async function main() {
  const token = process.env.GITHUB_TOKEN;
  const repoInfo = getRepoInfo();
  const releaseTag = process.env.RELEASE_TAG || 'latest';
  
  if (!repoInfo.owner || !repoInfo.name) {
    console.error('❌ Error: Could not determine repository. Please set REPO_OWNER and REPO_NAME environment variables.');
    process.exit(1);
  }
  
  console.log(`📦 Fetching release: ${repoInfo.owner}/${repoInfo.name}@${releaseTag}`);
  
  try {
    const release = await fetchRelease(repoInfo.owner, repoInfo.name, releaseTag, token);
    console.log(`✅ Found release: ${release.tag_name}`);
    
    const manifest = generateManifest(release);
    const manifestJson = JSON.stringify(manifest, null, 2);
    
    fs.writeFileSync('update-manifest.json', manifestJson);
    console.log('✅ Generated update-manifest.json');
    console.log('\n📋 Manifest preview:');
    console.log(manifestJson);
    
  } catch (error) {
    console.error(`❌ Error: ${error.message}`);
    if (!token && error.message.includes('404')) {
      console.error('\n💡 Tip: For private repositories, set GITHUB_TOKEN environment variable');
    }
    process.exit(1);
  }
}

main();

