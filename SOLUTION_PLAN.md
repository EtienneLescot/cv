# Solution Plan for GitHub Actions Workflow Issue

## Problem Analysis

The workflow is failing because the GitHub Actions `checkout` step with `clean: false` is still deleting the repository contents when using `fetch-depth: 1`. This is a known limitation of the checkout action.

## Root Cause

- `checkout@v4` with `fetch-depth: 1` and any `clean` setting still initializes an empty repository
- Files copied to `360/` directory are not detected by Git because the working directory is empty
- `git add -A` has nothing to add because Git doesn't see the new files

## Solution Strategy

We need to use a different approach that doesn't rely on the checkout action preserving files. The working solution should:

1. **Use full history checkout** instead of shallow clone
2. **Explicitly add files** using specific paths
3. **Verify file existence** before commit operations

## Implementation Steps

### Step 1: Modify the Workflow

```yaml
# In .github/workflows/merge-cvclaude-to-360.yml

- name: Checkout main branch
  uses: actions/checkout@v4
  with:
    ref: main
    token: ${{ secrets.GITHUB_TOKEN }}
    fetch-depth: 0  # Get full history instead of shallow clone

# ... rest of the workflow remains the same until commit step ...

- name: Commit and push changes to main
  run: |
    git config --local user.email "action@github.com"
    git config --local user.name "GitHub Action"
    
    # Add files explicitly with verification
    echo "Checking if 360/ files exist:"
    ls -la 360/
    
    # Add files individually to ensure they're staged
    git add 360/index.html
    git add 360/index-fr.html
    git add 360/index-en.html
    git add 360/style.min.css
    
    git status
    git commit -m "Update 360 subfolder with cvclaude branch content [skip ci]" || echo "No changes to commit"
    git push origin main
```

### Step 2: Alternative Approach (If above doesn't work)

If the full history checkout doesn't solve the issue, we can use a different strategy:

```yaml
- name: Checkout main branch with full history
  uses: actions/checkout@v4
  with:
    ref: main
    token: ${{ secrets.GITHUB_TOKEN }}
    fetch-depth: 0

- name: Verify repository state
  run: |
    echo "Repository contents after checkout:"
    ls -la
    echo "Git status:"
    git status
```

### Step 3: Debugging Steps

1. Add comprehensive logging to verify each step
2. Check if the 360 directory exists in the main branch history
3. Verify file permissions and ownership
4. Test with explicit file additions

## Expected Outcome

After implementing this solution:
- The workflow should detect the new files in the `360/` directory
- `git add` should successfully stage the files
- The commit should include the 4 built files
- The push should update the main branch with cvclaude content in the 360 subfolder

## Verification

1. Check if `https://etiennelescot.github.io/cv/360/` becomes accessible
2. Verify the content matches the cvclaude branch
3. Confirm main branch content remains at root path