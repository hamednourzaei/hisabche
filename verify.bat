@echo off
echo ==================================
echo [1/4] Cleaning previous builds...
echo ==================================
if exist apps\web\.next rmdir /s /q apps\web\.next
if exist .turbo rmdir /s /q .turbo

echo.
echo ==================================
echo [2/4] Type checking...
echo ==================================
call npm run type-check
if %errorlevel% neq 0 (
    echo TYPE-CHECK FAILED
    exit /b 1
)

echo.
echo ==================================
echo [3/4] Linting...
echo ==================================
call npm run lint
if %errorlevel% neq 0 (
    echo LINT FAILED
    exit /b 1
)

echo.
echo ==================================
echo [4/4] Building...
echo ==================================
call npm run build
if %errorlevel% neq 0 (
    echo BUILD FAILED
    exit /b 1
)

echo.
echo ==================================
echo ALL CHECKS PASSED! Ready to deploy.
echo ==================================