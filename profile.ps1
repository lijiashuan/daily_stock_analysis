# PowerShell Profile Configuration
# This file configures the PowerShell environment for the stock analysis project

# Set default encoding to UTF-8 to prevent garbled text with Chinese characters
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$OutputEncoding = [System.Text.Encoding]::UTF8

# Optional: Set code page to UTF-8 (65001)
chcp 65001 | Out-Null

# Function to activate virtual environment with proper encoding
function Activate-Venv {
    param(
        [string]$VenvPath = ".\venv"
    )
    
    # Set encoding before activation
    [Console]::OutputEncoding = [System.Text.Encoding]::UTF8
    
    # Activate virtual environment
    & "$VenvPath\Scripts\Activate.ps1"
    
    Write-Host "Virtual environment activated with UTF-8 encoding" -ForegroundColor Green
}

# Export useful functions
Export-ModuleMember -Function Activate-Venv