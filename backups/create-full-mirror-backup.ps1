param(
  [string]$Repository = "https://github.com/Apicehotel/Apicehotel-Manutenzione.git",
  [string]$Destination = "$HOME\\RandApp-BranchBackup"
)
$ErrorActionPreference = "Stop"
$stamp = Get-Date -Format "yyyyMMdd-HHmmss"
$folder = Join-Path $Destination $stamp
New-Item -ItemType Directory -Force -Path $folder | Out-Null
$mirror = Join-Path $folder "Apicehotel-Manutenzione.git"
git clone --mirror $Repository $mirror
if ($LASTEXITCODE -ne 0) { throw "Mirror clone failed" }
Push-Location $mirror
try {
  git fsck --full
  if ($LASTEXITCODE -ne 0) { throw "git fsck failed" }
  git show-ref | Out-File -Encoding utf8 (Join-Path $folder "all-refs.txt")
  git for-each-ref --format="%(refname) %(objectname)" refs/heads refs/remotes | Out-File -Encoding utf8 (Join-Path $folder "branch-heads.txt")
  $bundle = Join-Path $folder "Apicehotel-Manutenzione-all.bundle"
  git bundle create $bundle --all
  if ($LASTEXITCODE -ne 0) { throw "Bundle generation failed" }
  git bundle verify $bundle
  if ($LASTEXITCODE -ne 0) { throw "Bundle verification failed" }
  Get-FileHash $bundle -Algorithm SHA256 | Format-List | Out-File -Encoding utf8 (Join-Path $folder "bundle-sha256.txt")
  Write-Host "Verified Git mirror and bundle: $folder"
} finally { Pop-Location }
# Safety: no remote push, branch deletion or merge occurs.
