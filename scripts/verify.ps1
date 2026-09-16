[CmdletBinding()]
param()

$ErrorActionPreference = "Stop"

$repositoryRoot = Split-Path -Parent $PSScriptRoot
$solutionPath = Join-Path $repositoryRoot "backend/FikirPlatformu.slnx"
$frontendPath = Join-Path $repositoryRoot "frontend"

dotnet restore $solutionPath
if ($LASTEXITCODE -ne 0) {
    exit $LASTEXITCODE
}

dotnet build $solutionPath --no-restore --configuration Release
if ($LASTEXITCODE -ne 0) {
    exit $LASTEXITCODE
}

Push-Location $frontendPath
try {
    pnpm install --frozen-lockfile
    if ($LASTEXITCODE -ne 0) {
        exit $LASTEXITCODE
    }

    pnpm typecheck
    if ($LASTEXITCODE -ne 0) {
        exit $LASTEXITCODE
    }

    pnpm build
    exit $LASTEXITCODE
}
finally {
    Pop-Location
}
