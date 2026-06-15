import subprocess
import os
import time

os.chdir('D:\\py2026\\daily_stock_analysis\\apps\\dsa-desktop')
os.environ['DSA_SKIP_DEVMODE_CHECK'] = 'true'
os.environ['CSC_IDENTITY_AUTO_DISCOVERY'] = 'false'
os.environ['ELECTRON_BUILDER_ALLOW_UNRESOLVED_SYMLINKS'] = 'true'
os.environ['ELECTRON_BUILDER_CACHE'] = 'D:\\py2026\\daily_stock_analysis\\.electron-builder-cache'

print("Starting electron-builder...")
print(f"Current directory: {os.getcwd()}")
print(f"Node modules exists: {os.path.exists('node_modules')}")

result = subprocess.Popen(
    ['npm', 'run', 'build', '--', '--win', 'nsis', '--publish', 'never'],
    stdout=subprocess.PIPE,
    stderr=subprocess.STDOUT,
    text=True,
    bufsize=1,
    universal_newlines=True
)

start_time = time.time()
last_output_time = start_time

while True:
    line = result.stdout.readline()
    if line:
        print(line, end='')
        last_output_time = time.time()
    
    if result.poll() is not None:
        # Read remaining output
        for line in result.stdout:
            print(line, end='')
        print(f"\nReturn code: {result.returncode}")
        break
    
    # Timeout check
    if time.time() - last_output_time > 300:  # 5 minutes without output
        print("\nTimeout: No output for 5 minutes, killing process...")
        result.kill()
        break
    
    time.sleep(0.1)