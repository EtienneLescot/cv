# Multi-Branch Deployment Architecture

## Overview

This project now supports deploying multiple branches to GitHub Pages with different paths:

- **Main Branch**: Deployed to root path (`https://etiennelescot.github.io/cv/`)
- **CVClaude Branch**: Deployed to `/360` subfolder (`https://etiennelescot.github.io/cv/360/`)

## Architecture

### GitHub Actions Workflows

Two workflows handle the deployments:

#### Main Branch Workflow ([`static.yml`](.github/workflows/static.yml))
- **Trigger**: Runs on pushes to `main` branch only
- **Deployment**: Deploys to root path (`.`)

#### CVClaude Merge Workflow ([`merge-cvclaude-to-360.yml`](.github/workflows/merge-cvclaude-to-360.yml))
- **Trigger**: Runs on pushes to `cvclaude` branch
- **Action**: Builds cvclaude branch and merges content into main branch's `/360` subfolder
- **Configuration**: Uses `BASE_PATH=/cv/360` environment variable

### Build Process Modifications

The [`build-static-locales.js`](build-static-locales.js) script has been enhanced to:

1. **Dynamic Resource Paths**: CSS and other resources are referenced with correct base path
2. **Language Switcher**: Links updated to work correctly in subfolder context
3. **Environment Variables**: Uses `BASE_PATH` environment variable to determine deployment context

## Deployment Structure

```
GitHub Pages Structure:
/
├── index.html          (main branch)
├── index-fr.html       (main branch)
├── index-en.html       (main branch)
├── style.min.css       (main branch)
└── 360/
    ├── index.html      (cvclaude branch)
    ├── index-fr.html   (cvclaude branch)
    ├── index-en.html   (cvclaude branch)
    └── style.min.css   (cvclaude branch)
```

## URLs

- **Main Branch**: `https://etiennelescot.github.io/cv/`
- **CVClaude Branch**: `https://etiennelescot.github.io/cv/360/`

## How It Works

### 1. Main Branch Deployment

**Main Branch Workflow** ([`static.yml`](.github/workflows/static.yml)):
- Triggers on `main` branch pushes
- Builds with default settings (root deployment)
- Deploys files to root directory via GitHub Pages

### 2. CVClaude Branch Integration

**CVClaude Merge Workflow** ([`merge-cvclaude-to-360.yml`](.github/workflows/merge-cvclaude-to-360.yml)):
- Triggers on `cvclaude` branch pushes
- Checks out both `main` and `cvclaude` branches
- Builds cvclaude branch with `BASE_PATH=/cv/360` environment variable
- Copies built files to `360/` subfolder in main branch
- Commits and pushes changes to main branch
- This triggers the main branch workflow to redeploy with updated 360 subfolder

### 2. Build Configuration

The build script uses the `BASE_PATH` environment variable:

```javascript
const CONFIG = {
  // ... other config
  basePath: process.env.BASE_PATH || ''
};
```

### 3. Resource Path Adjustment

During build, CSS links and language switcher URLs are dynamically adjusted:

```javascript
// Update CSS path
const cssLink = document.querySelector('link[rel="stylesheet"]');
if (cssLink && CONFIG.basePath) {
  cssLink.href = `${CONFIG.basePath}/style.min.css`;
}

// Update language switcher links
let href = locale === CONFIG.defaultLocale ? './index.html' : `./index-${locale}.html`;
if (CONFIG.basePath) {
  href = `${CONFIG.basePath}/${href}`;
}
```

### 4. Deployment

For CVClaude branch, files are moved to the 360 subdirectory:

```yaml
- name: Prepare 360 deployment directory
  run: |
    mkdir -p 360
    mv *.html *.css *.js 360/ 2>/dev/null || true
```

## Testing

To test the deployment:

1. **Main Branch**: Push changes to `main` branch and verify deployment at root URL
2. **CVClaude Branch**: Push changes to `cvclaude` branch and verify deployment at `/360` subfolder

## Maintenance

### Adding New Branches

To add support for additional branches:

1. Add the branch name to the workflow trigger in [`static.yml`](.github/workflows/static.yml)
2. Update the branch detection logic to handle the new branch
3. Define the deployment path for the new branch

### Modifying Deployment Paths

Update the `Determine deployment path` step in the workflow to change deployment locations for existing branches.

## Benefits

- **Isolation**: Each branch deployment is isolated in its own path
- **No Conflicts**: Multiple versions can coexist without interference
- **Easy Testing**: Different branches can be tested simultaneously
- **Rollback**: Easy to revert to previous versions by switching branches