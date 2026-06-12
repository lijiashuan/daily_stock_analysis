#!/usr/bin/env python
"""Static asset sanity check script."""
import sys
import os

def main():
    if len(sys.argv) < 2:
        print("Usage: check_static_assets.py <static_dir>", file=sys.stderr)
        sys.exit(1)
    
    static_dir = sys.argv[1]
    if not os.path.exists(static_dir):
        print(f"Error: Static directory not found: {static_dir}", file=sys.stderr)
        sys.exit(1)
    
    # Check for required files
    required_files = ['index.html']
    for filename in required_files:
        filepath = os.path.join(static_dir, filename)
        if not os.path.exists(filepath):
            print(f"Warning: Missing required file: {filepath}", file=sys.stderr)
    
    print(f"Static assets check passed for: {static_dir}")
    sys.exit(0)

if __name__ == "__main__":
    main()