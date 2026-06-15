import subprocess
import time

result = subprocess.Popen(
    ['pyinstaller', '--onefile', '--name', 'test_simple', 'test_simple.py'],
    stdout=subprocess.PIPE,
    stderr=subprocess.STDOUT,
    text=True
)

start_time = time.time()
while result.poll() is None:
    line = result.stdout.readline()
    if line:
        print(line, end='')
    if time.time() - start_time > 120:
        print('Timeout, killing...')
        result.kill()
        break

print('Return code:', result.returncode)