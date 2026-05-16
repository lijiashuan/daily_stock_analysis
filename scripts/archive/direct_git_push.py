#!/usr/bin/env python3
"""
Direct Git push script - bypasses terminal issues
"""
import subprocess
import sys
import os

def run_git_command(cmd, cwd=None):
    """Run git command and return result"""
    print(f"\n>>> {' '.join(cmd)}")
    try:
        result = subprocess.run(
            cmd,
            cwd=cwd,
            capture_output=True,
            text=True,
            timeout=60
        )
        
        if result.stdout:
            print(result.stdout)
        if result.stderr:
            print(result.stderr)
            
        return result.returncode == 0, result.stdout + result.stderr
    except Exception as e:
        print(f"Error: {e}")
        return False, str(e)

def main():
    project_dir = r"D:\py2026\daily_stock_analysis"
    
    print("=" * 60)
    print("Git Push Script for daily_stock_analysis")
    print("=" * 60)
    
    # Check if directory exists
    if not os.path.exists(project_dir):
        print(f"Error: Directory {project_dir} does not exist!")
        sys.exit(1)
    
    os.chdir(project_dir)
    print(f"\nWorking directory: {os.getcwd()}")
    
    # Step 1: Check remotes
    print("\n" + "=" * 60)
    print("Step 1: Checking Git remotes...")
    print("=" * 60)
    success, output = run_git_command(["git", "remote", "-v"])
    if not success:
        print("Warning: Could not check remotes")
    
    # Step 2: Add files
    print("\n" + "=" * 60)
    print("Step 2: Adding modified files...")
    print("=" * 60)
    files_to_add = [
        "api/v1/endpoints/agent.py",
        "apps/dsa-web/src/api/agent.ts",
        "apps/dsa-web/src/pages/ChatPage.tsx"
    ]
    
    success, output = run_git_command(["git", "add"] + files_to_add)
    if not success:
        print(f"Failed to add files: {output}")
        sys.exit(1)
    print("✓ Files added successfully")
    
    # Step 3: Check status
    print("\n" + "=" * 60)
    print("Step 3: Checking git status...")
    print("=" * 60)
    success, output = run_git_command(["git", "status", "--short"])
    if success:
        print(output)
    
    # Step 4: Commit
    print("\n" + "=" * 60)
    print("Step 4: Committing changes...")
    print("=" * 60)
    
    commit_msg = """feat: enhance single message export with multi-format support

- Add backend API endpoint for single message export
- Support MD, DOCX, PDF, HTML, RTF formats
- Fix RTF encoding issue by using ReportExportService
- Simplify frontend implementation to use backend API
- Ensure only selected message is exported, not entire session

Changes:
- api/v1/endpoints/agent.py: Add /export-message endpoint
- apps/dsa-web/src/api/agent.ts: Add exportChatMessage method
- apps/dsa-web/src/pages/ChatPage.tsx: Simplify export logic
- static/assets/*: Rebuild frontend bundle"""
    
    success, output = run_git_command(["git", "commit", "-m", commit_msg])
    if not success:
        if "nothing to commit" in output.lower() or "no changes added" in output.lower():
            print("No changes to commit (already committed)")
        else:
            print(f"Commit failed: {output}")
            sys.exit(1)
    else:
        print("✓ Changes committed successfully")
    
    # Step 5: Push to GitHub
    print("\n" + "=" * 60)
    print("Step 5: Pushing to GitHub (origin)...")
    print("=" * 60)
    success, output = run_git_command(["git", "push", "origin", "main"])
    if not success:
        print(f"Failed to push to GitHub: {output}")
        print("\nPossible solutions:")
        print("1. Check SSH key configuration")
        print("2. Verify remote URL: git remote -v")
        print("3. Try: git remote set-url origin git@github.com:USERNAME/repo.git")
        sys.exit(1)
    print("✓ Pushed to GitHub successfully")
    
    # Step 6: Push to Gitee
    print("\n" + "=" * 60)
    print("Step 6: Pushing to Gitee...")
    print("=" * 60)
    success, output = run_git_command(["git", "push", "gitee", "main"])
    if not success:
        print(f"Warning: Failed to push to Gitee: {output}")
        print("This is not critical. You can push to Gitee later.")
    else:
        print("✓ Pushed to Gitee successfully")
    
    # Summary
    print("\n" + "=" * 60)
    print("✅ All done! Changes pushed successfully!")
    print("=" * 60)
    print("\nModified files:")
    for f in files_to_add:
        print(f"  - {f}")
    print("\nNext steps:")
    print("1. Verify on GitHub: https://github.com/[your-username]/daily_stock_analysis")
    print("2. Verify on Gitee: https://gitee.com/[your-username]/daily_stock_analysis")
    print("=" * 60)

if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        print("\n\nOperation cancelled by user")
        sys.exit(0)
    except Exception as e:
        print(f"\n\nUnexpected error: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
