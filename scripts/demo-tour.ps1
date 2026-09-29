<#
  OpenPocket POS - 60 second feature tour for screen recording.

  Drives the Android emulator over adb with ~1 second on each feature:
  dashboard, products, filters, categories, cart, checkout, receipt, sales,
  sale detail, shop profile + receipt design, reports, customers, scanner.

  Prereqs: emulator running, Metro running (pnpm exec expo start --dev-client),
  app installed, demo shop loaded ("Load demo shop (dev)" on the setup screen).

  Usage:   powershell -File scripts\demo-tour.ps1              # just run the tour
           powershell -File scripts\demo-tour.ps1 -Record      # also save an .mp4 from the emulator
  Tune the pace with -Dwell (seconds per feature, default 1.0).
#>
param(
  [switch]$Record,
  [string]$Shots = '',            # folder: save a screenshot after every step (to verify the tour)
  [double]$Dwell = 1.0,
  [string]$Out = "$env:USERPROFILE\Desktop\openpocket-demo.mp4"
)

$adb = "$env:LOCALAPPDATA\Android\Sdk\platform-tools\adb.exe"
$pkg = 'io.openpocket.pos'

function Tap([int]$x, [int]$y) { & $adb shell input tap $x $y | Out-Null }
function Swipe([int]$x1, [int]$y1, [int]$x2, [int]$y2, [int]$ms = 350) { & $adb shell input swipe $x1 $y1 $x2 $y2 $ms | Out-Null }
function Wait([double]$s) { Start-Sleep -Milliseconds ([int]($s * 1000)) }
$script:n = 0
function Step([string]$name, [scriptblock]$do, [double]$hold = $Dwell) {
  Write-Host ("{0,-34}" -f $name) -NoNewline
  & $do
  Wait $hold
  if ($Shots) {
    New-Item -ItemType Directory -Force $Shots | Out-Null
    $script:n++
    & $adb shell screencap -p /sdcard/shot.png
    & $adb pull /sdcard/shot.png (Join-Path $Shots ('{0:D2}.png' -f $script:n)) | Out-Null
  }
  Write-Host 'ok'
}

# Bottom tabs and header back button (1080x2400 screen)
$Home_ = @(108, 2190); $Products = @(324, 2190); $Scan = @(540, 2160); $Sales = @(756, 2190); $More = @(972, 2190)
$Back = @(95, 136)

# ---- Start clean: relaunch the app, sign in as the demo owner (Alex, PIN 1234) ----------------
& $adb shell pm grant $pkg android.permission.CAMERA 2>$null
& $adb reverse tcp:8081 tcp:8081 | Out-Null
& $adb shell am force-stop $pkg
& $adb shell am start -a android.intent.action.VIEW -d 'openpocketpos://expo-development-client/?url=http%3A%2F%2F10.0.2.2%3A8081' $pkg | Out-Null
Write-Host 'Launching app...'
Wait 22
Tap 388 792; Wait 1                                   # "Alex - Owner"
foreach ($p in @(@(256, 912), @(540, 912), @(822, 912), @(256, 1182))) { Tap $p[0] $p[1]; Wait 0.35 }   # PIN 1234
Wait 3

# ---- Record ------------------------------------------------------------------------------------
$rec = $null
if ($Record) {
  & $adb shell rm -f /sdcard/demo.mp4 | Out-Null
  $rec = Start-Process -FilePath $adb -ArgumentList 'shell', 'screenrecord', '--time-limit', '90', '--bit-rate', '8000000', '/sdcard/demo.mp4' -PassThru -WindowStyle Hidden
  Wait 1.5
}
Write-Host '--- tour ---'

Step '1  Dashboard'                 { Tap $Home_[0] $Home_[1] }
Step '2  Scroll home'               { Swipe 540 1700 540 900 400 } 0.6
Step '   ...back up'                { Swipe 540 900 540 1700 400 } 0.4
Step '3  Products grid'             { Tap $Products[0] $Products[1] }
Step '4  Smooth scroll'             { Swipe 540 1700 540 500 500 } 0.7
Step '   ...back up'                { Swipe 540 700 540 1900 500 } 0.4
Step '5  Low-stock filter'          { Tap 324 444 }
Step '6  Out-of-stock filter'       { Tap 638 444 }
Step '7  All products'              { Tap 103 444 } 0.5
Step '8  Category: Beverages'       { Tap 972 444 }
Step '   ...all again'              { Tap 103 444 } 0.4
Step '9  Add to cart (x2)'          { Tap 288 1086; Wait 0.3; Tap 798 1086 } 0.8
Step '10 Cart -> checkout'          { Tap 540 2013 } 1.2
Step '11 Quick cash amount'         { Tap 144 1794 } 0.7
Step '12 Complete sale'             { Tap 540 2148 } 1.4
Step '13 New sale'                  { Tap 540 1769 } 0.5
Step '14 Sales history'             { Tap $Sales[0] $Sales[1] }
Step '15 Sale detail'               { Tap 540 924 }
Step '   ...back'                   { Tap $Back[0] $Back[1] } 0.4
Step '16 More menu'                 { Tap $More[0] $More[1] }
Step '17 Shop profile + receipt'    { Tap 480 946 }
Step '18 Receipt design preview'    { Swipe 540 1900 540 500 500; Wait 0.3; Swipe 540 1900 540 500 500 }
Step '   ...back'                   { Tap $Back[0] $Back[1] } 0.4
Step '19 Reports'                   { Tap 480 1105 }
Step '   ...back'                   { Tap $Back[0] $Back[1] } 0.4
Step '20 Customers & credit'        { Tap 480 1264 }
Step '   ...back'                   { Tap $Back[0] $Back[1] } 0.4
Step '21 Barcode scanner'           { Tap $Scan[0] $Scan[1] } 1.3
Step '   ...back'                   { Tap $Back[0] $Back[1] } 0.4
Step '22 Home'                      { Tap $Home_[0] $Home_[1] } 1.2

# ---- Save the video ----------------------------------------------------------------------------
if ($Record) {
  & $adb shell pkill -2 screenrecord 2>$null | Out-Null
  Wait 3
  & $adb pull /sdcard/demo.mp4 $Out | Out-Null
  Write-Host "Saved: $Out"
}
Write-Host 'Done.'
