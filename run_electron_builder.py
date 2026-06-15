import subprocess
import os

os.chdir('D:\\py2026\\daily_stock_analysis\\apps\\dsa-desktop')
os.environ['DSA_SKIP_DEVMODE_CHECK'] = 'true'
os.environ['CSC_IDENTITY_AUTO_DISCOVERY'] = 'false'
os.environ['ELECTRON_BUILDER_ALLOW_UNRESOLVED_SYMLINKS'] = 'true'
os.environ['ELECTRON_BUILDER_CACHE'] = 'D:\\py2026\\daily_stock_analysis\\.electron-builder-cache'

result = subprocess.Popen(
    ['npx', 'electron-builder', '--win', 'nsis', '--publish', 'never'],
    stdout=subprocess.PIPE,
    stderr=subprocess.STDOUT,
    text=True
)

while True:
    line = result.stdout.readline()
    if not line and result.poll() is not None:
        break
    if line:
        print(line, end='')

print('Return code:', result.returncode)