#!/usr/bin/env python3
"""Git push script for daily_stock_analysis project"""
import subprocess
import sys
import os

def run_command(cmd, cwd=None):
    """Run a shell command and print output"""
    print(f"\n>>> {cmd}")
    result = subprocess.run(
        cmd,
        shell=True,
        cwd=cwd,
        capture_output=False,
        text=True
    )
    if result.returncode != 0:
        print(f"Error: Command failed with return code {result.returncode}")
        sys.exit(1)
    return result

def main():
    project_dir = r"D:\py2026\daily_stock_analysis"
    
    # Change to project directory
    os.chdir(project_dir)
    print(f"Working directory: {project_dir}")
    
    # Add changes
    files_to_add = [
        "api/v1/endpoints/agent.py",
        "apps/dsa-web/src/api/agent.ts",
        "apps/dsa-web/src/pages/ChatPage.tsx",
        "static/assets/*"
    ]
    
    print("\n=== Adding changes ===")
    run_command(f"git add {' '.join(files_to_add)}")
    
    # Commit
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
    
    print("\n=== Committing changes ===")
    run_command(f'git commit -m "{commit_msg}"')
    
    # Push to GitHub
    print("\n=== Pushing to GitHub ===")
    run_command("git push origin main")
    
    # Push to Gitee
    print("\n=== Pushing to Gitee ===")
    run_command("git push gitee main")
    
    print("\n✅ All done! Changes pushed to GitHub and Gitee.")

if __name__ == "__main__":
    main()
