# 🧪 GreenHouse Pro API Testing Script
# ทดสอบ API Keys ว่าใช้งานได้จริงหรือไม่

$BASE_URL = "https://greenhouse-pro-server-production.up.railway.app"
$API_KEY_READONLY = "ghp_readonly_9271d426f500cf5914e9a52f8c313bc0e46ccff79e18def8c2c2e9f01bed755a"
$API_KEY_CONTROL = "ghp_fullaccess_291a3d1919e0bb99ac44b8a1b658365035787667f58546da59e7e1c15d14fcab"

Write-Host "=============================================" -ForegroundColor Cyan
Write-Host "🧪 GreenHouse Pro API Testing" -ForegroundColor Cyan
Write-Host "=============================================" -ForegroundColor Cyan
Write-Host ""

# ============================================
# Test 1: Health Check
# ============================================
Write-Host "Test 1: Health Check" -ForegroundColor Yellow
Write-Host "Checking if server is online..." -ForegroundColor Gray

try {
    $response = Invoke-WebRequest -Uri "$BASE_URL/api/health" -Method GET
    if ($response.StatusCode -eq 200) {
        Write-Host "✅ PASS - Server is online!" -ForegroundColor Green
        Write-Host "Response: $($response.Content)" -ForegroundColor Gray
    }
} catch {
    Write-Host "❌ FAIL - Server is offline!" -ForegroundColor Red
    Write-Host "Error: $_" -ForegroundColor Red
}
Write-Host ""

# ============================================
# Test 2: Read-Only API Key - ดูข้อมูลโรง 8
# ============================================
Write-Host "Test 2: Read-Only API Key (โรง 8)" -ForegroundColor Yellow
Write-Host "Testing: GET /data/greenhouses/maejard/greenhouse8/latest" -ForegroundColor Gray

try {
    $headers = @{
        "X-API-Key" = $API_KEY_READONLY
    }
    $response = Invoke-WebRequest -Uri "$BASE_URL/api/external/v1/data/greenhouses/maejard/greenhouse8/latest" -Method GET -Headers $headers
    
    if ($response.StatusCode -eq 200) {
        Write-Host "✅ PASS - Read-Only API works!" -ForegroundColor Green
        $data = $response.Content | ConvertFrom-Json
        Write-Host "Data received:" -ForegroundColor Gray
        Write-Host "  Temperature: $($data.data.air_temp)°C" -ForegroundColor Gray
        Write-Host "  Humidity: $($data.data.air_humidity)%" -ForegroundColor Gray
    }
} catch {
    Write-Host "❌ FAIL - Read-Only API failed!" -ForegroundColor Red
    Write-Host "Error: $($_.Exception.Message)" -ForegroundColor Red
}
Write-Host ""

# ============================================
# Test 3: Read-Only API Key - ทดสอบโรงอื่น (โรง 1)
# ============================================
Write-Host "Test 3: Read-Only API Key (โรง 1)" -ForegroundColor Yellow
Write-Host "Testing: GET /data/greenhouses/maejard/greenhouse1/latest" -ForegroundColor Gray

try {
    $headers = @{
        "X-API-Key" = $API_KEY_READONLY
    }
    $response = Invoke-WebRequest -Uri "$BASE_URL/api/external/v1/data/greenhouses/maejard/greenhouse1/latest" -Method GET -Headers $headers
    
    if ($response.StatusCode -eq 200) {
        Write-Host "✅ PASS - Can access greenhouse 1!" -ForegroundColor Green
        $data = $response.Content | ConvertFrom-Json
        Write-Host "Data received from greenhouse 1" -ForegroundColor Gray
    }
} catch {
    if ($_.Exception.Response.StatusCode.Value__ -eq 502) {
        Write-Host "⚠️  Expected - Greenhouse 1 may not have Device ID yet (502 Bad Gateway)" -ForegroundColor Yellow
    } else {
        Write-Host "❌ FAIL - Unexpected error!" -ForegroundColor Red
        Write-Host "Error: $($_.Exception.Message)" -ForegroundColor Red
    }
}
Write-Host ""

# ============================================
# Test 4: Read-Only API Key - ดูสถานะอุปกรณ์
# ============================================
Write-Host "Test 4: Device Status (โรง 8)" -ForegroundColor Yellow
Write-Host "Testing: GET /devices/maejard/greenhouse8/status" -ForegroundColor Gray

try {
    $headers = @{
        "X-API-Key" = $API_KEY_READONLY
    }
    $response = Invoke-WebRequest -Uri "$BASE_URL/api/external/v1/data/devices/maejard/greenhouse8/status" -Method GET -Headers $headers
    
    if ($response.StatusCode -eq 200) {
        Write-Host "✅ PASS - Device status works!" -ForegroundColor Green
        $data = $response.Content | ConvertFrom-Json
        Write-Host "Status:" -ForegroundColor Gray
        Write-Host "  Online: $($data.data.online)" -ForegroundColor Gray
        Write-Host "  Pump: $($data.data.pump_status)" -ForegroundColor Gray
        Write-Host "  Fan: $($data.data.fan_status)" -ForegroundColor Gray
    }
} catch {
    Write-Host "❌ FAIL - Device status failed!" -ForegroundColor Red
    Write-Host "Error: $($_.Exception.Message)" -ForegroundColor Red
}
Write-Host ""

# ============================================
# Test 5: Read-Only API Key - ทดสอบควบคุม (ต้องล้มเหลว)
# ============================================
Write-Host "Test 5: Read-Only Key Control Test (should FAIL)" -ForegroundColor Yellow
Write-Host "Testing: POST /control/devices (with Read-Only key)" -ForegroundColor Gray

try {
    $headers = @{
        "X-API-Key" = $API_KEY_READONLY
        "Content-Type" = "application/json"
    }
    $body = @{
        controlKey = "pump1"
        value = $true
    } | ConvertTo-Json
    
    $response = Invoke-WebRequest -Uri "$BASE_URL/api/external/v1/control/devices/maejard/greenhouse8/control" -Method POST -Headers $headers -Body $body
    
    Write-Host "❌ UNEXPECTED - Read-Only key should NOT be able to control!" -ForegroundColor Red
} catch {
    if ($_.Exception.Response.StatusCode.Value__ -eq 403) {
        Write-Host "✅ PASS - Correctly blocked! (403 Forbidden)" -ForegroundColor Green
    } else {
        Write-Host "⚠️  Different error than expected" -ForegroundColor Yellow
        Write-Host "Error: $($_.Exception.Message)" -ForegroundColor Yellow
    }
}
Write-Host ""

# ============================================
# Test 6: Full Access API Key - ทดสอบควบคุม (แบบไม่เปลี่ยนสถานะจริง)
# ============================================
Write-Host "Test 6: Full Access Key Control Test" -ForegroundColor Yellow
Write-Host "Testing: POST /control/devices (with Full Access key)" -ForegroundColor Gray
Write-Host "Note: This is a DRY RUN - not actually controlling devices" -ForegroundColor Gray

# เพื่อความปลอดภัย เราจะไม่ควบคุมจริง แค่เช็คว่า API Key ใช้งานได้
Write-Host "⚠️  Skipping actual control test for safety" -ForegroundColor Yellow
Write-Host "To test control manually, use:" -ForegroundColor Gray
Write-Host '  $headers = @{"X-API-Key" = "ghp_fullaccess_all_..."; "Content-Type" = "application/json"}' -ForegroundColor DarkGray
Write-Host '  $body = @{controlKey = "pump1"; value = $true} | ConvertTo-Json' -ForegroundColor DarkGray
Write-Host '  Invoke-WebRequest -Uri "$BASE_URL/api/external/v1/control/devices/maejard/greenhouse8/control" -Method POST -Headers $headers -Body $body' -ForegroundColor DarkGray
Write-Host ""

# ============================================
# Test 7: ทดสอบ Rate Limiting
# ============================================
Write-Host "Test 7: Rate Limiting Check" -ForegroundColor Yellow
Write-Host "Making 5 quick requests..." -ForegroundColor Gray

$successCount = 0
$headers = @{
    "X-API-Key" = $API_KEY_READONLY
}

for ($i = 1; $i -le 5; $i++) {
    try {
        $response = Invoke-WebRequest -Uri "$BASE_URL/api/external/v1/data/greenhouses/maejard/greenhouse8/latest" -Method GET -Headers $headers -TimeoutSec 5
        if ($response.StatusCode -eq 200) {
            $successCount++
        }
    } catch {
        # Ignore errors for this test
    }
}

if ($successCount -ge 4) {
    Write-Host "✅ PASS - Rate limiting allows normal usage ($successCount/5 requests succeeded)" -ForegroundColor Green
} else {
    Write-Host "⚠️  WARNING - Only $successCount/5 requests succeeded" -ForegroundColor Yellow
}
Write-Host ""

# ============================================
# Summary
# ============================================
Write-Host "=============================================" -ForegroundColor Cyan
Write-Host "📊 Test Summary" -ForegroundColor Cyan
Write-Host "=============================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "✅ If all tests passed, API is ready for production!" -ForegroundColor Green
Write-Host ""
Write-Host "📋 What to send to Mobile App Company:" -ForegroundColor Yellow
Write-Host "  - API_KEYS_FINAL.md (contains all documentation)" -ForegroundColor Gray
Write-Host "  - Base URL: $BASE_URL" -ForegroundColor Gray
Write-Host "  - Read-Only Key: $API_KEY_READONLY" -ForegroundColor Gray
Write-Host "  - Full Access Key: $API_KEY_CONTROL" -ForegroundColor Gray
Write-Host ""
Write-Host "⚠️  Important Reminders:" -ForegroundColor Yellow
Write-Host "  1. Keys support ALL greenhouses (1-9)" -ForegroundColor Gray
Write-Host "  2. Greenhouses without Device ID will return 502 errors (expected)" -ForegroundColor Gray
Write-Host "  3. No need to create new keys when adding greenhouses" -ForegroundColor Gray
Write-Host ""
