#!/bin/bash
# Remove sensitive keys from git history
# This rewrites history - use with caution!

set -e

echo "🔒 Removing sensitive keys from git history..."
echo ""
echo "⚠️  WARNING: This will rewrite git history!"
echo "   - Make sure you have a backup"
echo "   - You'll need to force push after this"
echo "   - Other contributors will need to rebase"
echo ""
read -p "Continue? (y/N): " confirm

if [ "$confirm" != "y" ]; then
    echo "Aborted."
    exit 1
fi

# Files that contain the sensitive keys
FILES_TO_CLEAN=(
    "ADMIN_API_KEY.md"
    "TESTING_GUIDE.md"
    "scripts/e2e-test.sh"
)

echo ""
echo "📝 Files to clean:"
for file in "${FILES_TO_CLEAN[@]}"; do
    echo "   - $file"
done
echo ""

# Use git filter-repo if available, otherwise use filter-branch
if command -v git-filter-repo &> /dev/null; then
    echo "✅ Using git-filter-repo (recommended)"
    echo ""
    
    # Create a paths file
    PATHS_FILE=$(mktemp)
    for file in "${FILES_TO_CLEAN[@]}"; do
        echo "$file" >> "$PATHS_FILE"
    done
    
    # Run filter-repo to rewrite these files
    git filter-repo --invert-paths --paths-from-file "$PATHS_FILE" --force
    
    # Re-add the cleaned versions
    git add "${FILES_TO_CLEAN[@]}"
    git commit -m "chore: remove sensitive keys from documentation (use env vars instead)"
    
    rm "$PATHS_FILE"
    
else
    echo "❌ git-filter-repo not found"
    echo ""
    echo "Please install it for safer history rewriting:"
    echo "  brew install git-filter-repo"
    echo ""
    echo "Or use BFG Repo Cleaner as an alternative:"
    echo "  brew install bfg"
    echo "  bfg --replace-text replacements.txt"
    echo ""
    exit 1
fi

echo ""
echo "✅ History cleaned!"
echo ""
echo "Next steps:"
echo "  1. Verify the changes: git log --oneline"
echo "  2. Force push: git push origin feat/multi-tenant-infrastructure --force-with-lease"
echo "  3. Notify team members to rebase their branches"
echo ""
