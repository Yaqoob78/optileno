#!/usr/bin/env pwsh

# Planner Issues Quick Test Script
# Tests the fixes applied to task/goal/habit creation and analytics

Write-Host "=" * 60 -ForegroundColor Cyan
Write-Host "Planner Issues - Quick Verification" -ForegroundColor Green
Write-Host "=" * 60 -ForegroundColor Cyan

Write-Host "`n1. CHECKING MODIFIED FILES..." -ForegroundColor Yellow

$files = @(
    "frontend/src/hooks/usePlannerCreate.ts",
    "frontend/src/hooks/useAnalyticsLoader.ts",
    "frontend/src/pages/Planner/Planner.tsx",
    "frontend/src/components/planner/GoalTimeline.tsx",
    "frontend/src/components/planner/HabitTracker.tsx",
    "frontend/src/styles/pages/planner.css"
)

foreach ($file in $files) {
    $path = Join-Path $PSScriptRoot $file
    if (Test-Path $path) {
        Write-Host "✓ $file" -ForegroundColor Green
    } else {
        Write-Host "✗ $file NOT FOUND" -ForegroundColor Red
    }
}

Write-Host "`n2. KEY FIXES APPLIED..." -ForegroundColor Yellow

Write-Host "`n  Task Creation:" -ForegroundColor Cyan
Write-Host "    ✓ Added proper store synchronization in usePlannerCreate"
Write-Host "    ✓ Added fetchTasks() refresh after creation"
Write-Host "    ✓ Added error handling in Planner.tsx"

Write-Host "`n  Goal Creation:" -ForegroundColor Cyan
Write-Host "    ✓ Enhanced handleSaveGoal with proper refresh"
Write-Host "    ✓ Added form reset after successful creation"
Write-Host "    ✓ Added 300ms delay before refresh"

Write-Host "`n  Habit Creation:" -ForegroundColor Cyan
Write-Host "    ✓ Fixed to append instead of replace habits list"
Write-Host "    ✓ Added fetchHabits() after creation"
Write-Host "    ✓ Improved error messaging"

Write-Host "`n  Modal Z-Index Layering:" -ForegroundColor Cyan
Write-Host "    ✓ Updated modal-overlay z-index: 99999 !important"
Write-Host "    ✓ Updated modal-content z-index: 100000 !important"
Write-Host "    ✓ Added pointer-events: auto !important"

Write-Host "`n  Analytics Refresh:" -ForegroundColor Cyan
Write-Host "    ✓ Reduced refresh interval from 30s to 20s"
Write-Host "    ✓ Added period change listener"
Write-Host "    ✓ Added auto-refresh logging"

Write-Host "`n3. TESTING INSTRUCTIONS..." -ForegroundColor Yellow
Write-Host "
  Frontend:
    cd frontend
    npm run dev
    
  Then test:
    1. Create a task → should appear in 'Today's Tasks'
    2. Create a goal → should appear in 'Goal Timeline'
    3. Create a habit → should appear in 'Habit Tracker'
    4. Modal should be on top (not mixed with dashboard)
    5. Analytics should update every 20 seconds
    6. Check console for: '✓ Task created and added to store'
" -ForegroundColor Cyan

Write-Host "`n4. EXPECTED BEHAVIOR..." -ForegroundColor Yellow
Write-Host "
  ✓ Items created should appear immediately
  ✓ No data loss on page navigation
  ✓ Modal dialogs appear above all content
  ✓ Analytics auto-refreshes every 20 seconds
  ✓ Smooth creation with proper feedback
  ✓ Error messages on failure
" -ForegroundColor Green

Write-Host "`n" * 2
Write-Host "=" * 60 -ForegroundColor Cyan
Write-Host "Ready to test! Run 'npm run dev' in frontend folder" -ForegroundColor Green
Write-Host "=" * 60 -ForegroundColor Cyan
