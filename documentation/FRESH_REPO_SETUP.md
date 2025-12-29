# 🆕 Create Fresh Repository (No Secret History)

## Quick Steps:

### 1. Remove Git History
```bash
# Backup current folder
cd d:\pepeleads\ascend
cp -r lovable-ascend lovable-ascend-backup

# Remove git history
cd lovable-ascend
rm -rf .git

# Initialize fresh repo
git init
git add .
git commit -m "initial commit with postback system"
```

### 2. Create New GitHub Repo
1. Go to https://github.com/new
2. Name: `ascend-affiliate-platform` (or any name)
3. **DO NOT** initialize with README
4. Create repository

### 3. Push to New Repo
```bash
git remote add origin https://github.com/YOUR_USERNAME/ascend-affiliate-platform.git
git branch -M main
git push -u origin main
```

### 4. Update Deployment
- Update Render to use new repo
- Update Vercel to use new repo

---

## Alternative: Allow Secret in GitHub

If you want to keep current repo:

1. Go to: https://github.com/nandanihada/Moustache_Leads/security/secret-scanning/unblock-secret/34V24uDvhen6U10saQ5FIj4SSam
2. Click "Allow this secret"
3. Push again: `git push origin main --force`

This works because the "secret" is actually a placeholder, not a real API key.
