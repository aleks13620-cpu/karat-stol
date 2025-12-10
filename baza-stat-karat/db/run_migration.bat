@echo off
REM Скрипт для применения миграции Блок 1
echo ========================================
echo Применение миграции: Блок 1 - Операции акрила
echo ========================================
echo.

set PGHOST=lpalemqoflzvlkuuroyk.supabase.co
set PGPORT=5432
set PGDATABASE=postgres
set PGUSER=postgres

echo Введите пароль от Supabase (Database password):
set /p PGPASSWORD=

echo.
echo Выполнение миграции...
psql -h %PGHOST% -p %PGPORT% -U %PGUSER% -d %PGDATABASE% -f migration_block1_acrylic_operations.sql

if %ERRORLEVEL% EQU 0 (
    echo.
    echo ========================================
    echo Миграция выполнена успешно!
    echo ========================================
) else (
    echo.
    echo ========================================
    echo Ошибка выполнения миграции!
    echo ========================================
)

pause
