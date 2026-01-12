#!/bin/bash
# Quick fix: Remove secrets from git history using BFG or git filter-repo
# This is the simplest approach for your situation

set -e

echo "🔒 Fixing GitHub Push Protection Issue"
echo "======================================"
echo ""
echo "The issue: commit 1c5285293e3f0066fc5c9de2cdaa089f7bff8457 contains"
echo "API keys that match the sk_live_* pattern (detected as Stripe keys)"
echo ""
echo "OPTION 1: Use GitHub's allow URL (quickest)"
echo "-------------------------------------------"
echo "GitHub provided this URL to allow the secret:"
echo "https://github.com/loganpowell/cf-auth/security/secret-scanning/unblock-secret/38APVyBXzVNNbEBtPNJIgcstTIv"
echo ""
echo "This tells GitHub 'this is not a real secret, allow it'"
echo ""
echo "OPTION 2: Rewrite history (cleaner, but more work)"
echo "---------------------------------------------------"
echo ""

read -p "Which option? (1=Allow secret, 2=Rewrite history, q=Quit): " choice

case "$choice" in
    1)
        echo ""
        echo "✅ Opening GitHub's allow URL in your browser..."
        echo ""
        echo "Steps:"
        echo "  1. Click 'Allow secret' on the GitHub page"
        echo "  2. Return here and push again:"
        echo "     git push origin feat/multi-tenant-infrastructure"
        echo ""
        
        # Open in browser
        if command -v open &> /dev/null; then
            open "https://github.com/loganpowell/cf-auth/security/secret-scanning/unblock-secret/38APVyBXzVNNbEBtPNJIgcstTIv"
        else
            echo "Please open this URL manually:"
            echo "https://github.com/loganpowell/cf-auth/security/secret-scanning/unblock-secret/38APVyBXzVNNbEBtPNJIgcstTIv"
        fi
        ;;
        
    2)
        echo ""
        echo "🔧 Option 2: Rewriting history..."
        echo ""
        
        # Check if git-filter-repo is available
        if ! command -v git-filter-repo &> /dev/null; then
            echo "❌ git-filter-repo not found. Installing..."
            echo ""
            
            # Try to install it
            if command -v brew &> /dev/null; then
                echo "Installing via Homebrew..."
                brew install git-filter-repo
            elif command -v pip3 &> /dev/null; then
                echo "Installing via pip..."
                pip3 install git-filter-repo
            else
                echo "Please install git-filter-repo manually:"
                echo "  brew install git-filter-repo"
                echo "  # or"
                echo "  pip3 install git-filter-repo"
                exit 1
            fi
        fi
        
        echo "✅ git-filter-repo available"
        echo ""
        echo "⚠️  WARNING: This will rewrite history!"
        echo "   - Creates new commit hashes"
        echo "   - Requires force push"
        echo "   - Others need to rebase"
        echo ""
        read -p "Continue with rewrite? (yes/no): " confirm
        
        if [ "$confirm" != "yes" ]; then
            echo "Aborted."
            exit 1
        fi
        
        # Create replacement file
        cat > /tmp/replacements.txt << 'EOF'
sk_live_b3BUwJF8cQHRmGOTNPtAVKvg22UBp:d98730fc6e18df352373d43a7fa0830a3cab3afc0c542139a36c8270813c4805==>rk_live_EXAMPLE_KEY:EXAMPLE_SECRET_HASH
EOF
        
        echo "📝 Rewriting history to replace secrets..."
        git filter-repo --replace-text /tmp/replacements.txt --force
        
        rm /tmp/replacements.txt
        
        echo ""
        echo "✅ History rewritten!"
        echo ""
        echo "Next steps:"
        echo "  git push origin feat/multi-tenant-infrastructure --force-with-lease"
        echo ""
        ;;
        
    q|Q)
        echo "Aborted."
        exit 0
        ;;
        
    *)
        echo "Invalid choice. Aborted."
        exit 1
        ;;
esac
