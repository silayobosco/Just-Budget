Add-Type -AssemblyName System.Drawing

$srcPath = "C:\Users\User\.gemini\antigravity\brain\56fadabf-d633-4df1-a7d1-6c0bc10c68f3\just_budget_app_icon_v2_1793442701236.jpg"
$destDir = "C:\Users\User\Desktop\just-budget\assets"

$img = [System.Drawing.Image]::FromFile($srcPath)
Write-Host "Loaded image: $($img.Width)x$($img.Height)"

# 1. Main Icon (1024x1024 PNG)
$bmp1024 = New-Object System.Drawing.Bitmap(1024, 1024)
$g1024 = [System.Drawing.Graphics]::FromImage($bmp1024)
$g1024.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
$g1024.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
$g1024.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
$g1024.DrawImage($img, 0, 0, 1024, 1024)
$g1024.Dispose()
$bmp1024.Save("$destDir\icon.png", [System.Drawing.Imaging.ImageFormat]::Png)
$bmp1024.Save("$destDir\android-icon-foreground.png", [System.Drawing.Imaging.ImageFormat]::Png)
$bmp1024.Save("$destDir\splash-icon.png", [System.Drawing.Imaging.ImageFormat]::Png)
$bmp1024.Dispose()

# 2. Android Icon Background (1024x1024 solid/subtle deep dark purple)
$bmpBg = New-Object System.Drawing.Bitmap(1024, 1024)
$gBg = [System.Drawing.Graphics]::FromImage($bmpBg)
$brush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(255, 18, 14, 28))
$gBg.FillRectangle($brush, 0, 0, 1024, 1024)
$brush.Dispose()
$gBg.Dispose()
$bmpBg.Save("$destDir\android-icon-background.png", [System.Drawing.Imaging.ImageFormat]::Png)
$bmpBg.Dispose()

# 3. Favicon (48x48 PNG)
$bmpFav = New-Object System.Drawing.Bitmap(48, 48)
$gFav = [System.Drawing.Graphics]::FromImage($bmpFav)
$gFav.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
$gFav.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
$gFav.DrawImage($img, 0, 0, 48, 48)
$gFav.Dispose()
$bmpFav.Save("$destDir\favicon.png", [System.Drawing.Imaging.ImageFormat]::Png)
$bmpFav.Dispose()

$img.Dispose()
Write-Host "Icons generated successfully in $destDir"
