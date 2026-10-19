param(
    [Parameter(Mandatory=$true)][string]$Emcc,
    [Parameter(Mandatory=$true)][string]$SourceRoot
)
$ErrorActionPreference='Stop'
$outputDir=$PSScriptRoot
$engineDir=Join-Path $SourceRoot 'mohex'
$boostDir=Join-Path $SourceRoot 'boost-headers'
if(!(Test-Path (Join-Path $engineDir 'leaf-sources.txt'))){throw 'Extract source.zip and set SourceRoot to its root directory.'}
Copy-Item -LiteralPath (Join-Path $outputDir 'browser-adapter.cpp') -Destination (Join-Path $engineDir 'leaf.cpp') -Force

# Keep the upstream move generation, VC builder, patterns and UCT intact.
# Two small runtime changes: honor subsecond budgets and yield the browser thread.
$playerFile=Join-Path $engineDir 'src/mohex/MoHexPlayer.cpp'
$playerText=Get-Content -LiteralPath $playerFile -Raw
$playerText=$playerText.Replace('maxTime = std::max(1.0, maxTime);','maxTime = std::max(0.005, maxTime);')
# Upstream's empty-tree fallback chooses from every empty cell. Keep it in
# MoHex's own computed consider set even when a very short budget expires.
$playerText=$playerText.Replace('return BoardUtil::RandomEmptyCell(brd.GetPosition());','return consider.any() ? static_cast<HexPoint>(BitsetUtil::FindSetBit(consider)) : BoardUtil::RandomEmptyCell(brd.GetPosition());')
[IO.File]::WriteAllText($playerFile,$playerText)
$mohexFile=Join-Path $engineDir 'src/mohex/MoHexSearch.cpp'
$mohexText=(Get-Content -LiteralPath $mohexFile -Raw).Replace('m_fillinMapBits(16)','m_fillinMapBits(12)')
[IO.File]::WriteAllText($mohexFile,$mohexText)
$boardFile=Join-Path $engineDir 'src/hex/HexBoard.cpp'
$boardText=Get-Content -LiteralPath $boardFile -Raw
if(!$boardText.Contains('return INVALID_POINT; // No reverser when ICE is disabled.')){
    $boardText=[regex]::Replace($boardText,'(HexPoint HexBoard::ComputeInferiorCells[\s\S]*?return reverser;\r?\n    })\r?\n}', '$1'+"`n    return INVALID_POINT; // No reverser when ICE is disabled.`n}")
}
[IO.File]::WriteAllText($boardFile,$boardText)
$searchFile=Join-Path $engineDir 'src/smartgame/SgUctSearch.cpp'
$searchText=Get-Content -LiteralPath $searchFile -Raw
if(!$searchText.Contains('hex_yield')){
    $searchText=$searchText.Replace('#include "SgSystem.h"',"#include `"SgSystem.h`"`nextern `"C`" void hex_yield(double, double);")
    $searchText=$searchText.Replace('    if (SgUserAbort())',"    hex_yield(GamesPlayed(), m_tree.Root().MoveCount() > 0 ? m_tree.Root().Mean() : 0.5);`n    if (SgUserAbort())")
}
[IO.File]::WriteAllText($searchFile,$searchText)
$sources=@(Get-Content -LiteralPath (Join-Path $engineDir 'leaf-sources.txt'))+@('src/commonengine/SwapCheck.cpp','leaf.cpp')
$compile=@('-O2','-std=c++17',
    '-D_LIBCPP_ENABLE_CXX17_REMOVED_AUTO_PTR','-DNDEBUG','-DBOOST_FILESYSTEM_VERSION=3',
    '-DBOOST_VERSION_MAJOR=1','-DBOOST_VERSION_MINOR=90','-DABS_TOP_SRCDIR="/"','-DDATADIR="/share"',
    '-fexceptions','-Ileaf-include',('-I'+(Join-Path $outputDir 'boost-extra')),('-I'+$boostDir),'-Isrc','-Isrc/hex','-Isrc/util','-Isrc/mohex',
    '-Isrc/smartgame','-Isrc/gtpengine','-Isrc/commonengine','-Isrc/solver','-Isrc/book')
$link=@('-O2','-g2','-fexceptions',
    '-sALLOW_MEMORY_GROWTH=1','-sINITIAL_MEMORY=128MB','-sMAXIMUM_MEMORY=512MB','-sSTACK_SIZE=16MB',
    '-sMODULARIZE=1','-sEXPORT_NAME=createMoHex','-sEXPORTED_FUNCTIONS=_hex_search,_hex_cancel',
    '-sEXPORTED_RUNTIME_METHODS=ccall,FS','-sENVIRONMENT=web,worker,node','-sASYNCIFY=1','-sSINGLE_FILE=1',
    '-o',(Join-Path $outputDir 'mohex.js'))
$config=@{cwd=$engineDir;emcc=$Emcc;sources=$sources;compile=$compile;link=$link}
$configFile=Join-Path $engineDir '.browser-build.json'
[IO.File]::WriteAllText($configFile,($config|ConvertTo-Json -Depth 3))
& node (Join-Path $outputDir 'build-driver.cjs') $configFile
if($LASTEXITCODE -ne 0){throw 'MoHex WebAssembly build failed'}
