-- ============================================================
-- МИГРАЦИЯ: Блок 1 - Операции акрила
-- Дата: 2025-12-10
-- Описание: Добавление таблиц для хранения операций акрила
-- ============================================================

-- Проверка: если таблицы уже существуют, они будут пропущены
DO $$
BEGIN
    -- Создание таблицы acrylic_operations
    IF NOT EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'acrylic_operations') THEN
        CREATE TABLE public.acrylic_operations (
            id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
            name text NOT NULL,
            unit text NOT NULL DEFAULT 'шт',
            created_at timestamptz NOT NULL DEFAULT now()
        );

        RAISE NOTICE 'Таблица acrylic_operations создана';
    ELSE
        RAISE NOTICE 'Таблица acrylic_operations уже существует';
    END IF;

    -- Создание таблицы order_acrylic_operations
    IF NOT EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'order_acrylic_operations') THEN
        CREATE TABLE public.order_acrylic_operations (
            id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
            order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
            operation_id uuid NOT NULL REFERENCES public.acrylic_operations(id),
            volume numeric(10,2) NOT NULL,
            created_at timestamptz NOT NULL DEFAULT now()
        );

        RAISE NOTICE 'Таблица order_acrylic_operations создана';
    ELSE
        RAISE NOTICE 'Таблица order_acrylic_operations уже существует';
    END IF;
END $$;

-- Создание индексов (IF NOT EXISTS работает с PostgreSQL 9.5+)
CREATE INDEX IF NOT EXISTS idx_order_acrylic_operations_order_id
    ON public.order_acrylic_operations(order_id);

CREATE INDEX IF NOT EXISTS idx_order_acrylic_operations_operation_id
    ON public.order_acrylic_operations(operation_id);

-- Заполнение справочника операций акрила (только если таблица пустая)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM public.acrylic_operations LIMIT 1) THEN
        INSERT INTO public.acrylic_operations (name, unit) VALUES
            ('Проверка размеров деталей после ЧПУ', 'шт'),
            ('Подгонка погонажных деталей', 'шт'),
            ('Сухая сборка изделия', 'шт'),
            ('Склейка', 'шт'),
            ('Уборка излишков клея', 'шт'),
            ('Фрезеровка запасов', 'шт'),
            ('Фрезеровка радиусов и кромок', 'шт'),
            ('Внедрение «дров»', 'шт'),
            ('Шлифовка', 'шт'),
            ('Приклейка мойки', 'шт'),
            ('Упаковка и складирование', 'шт');

        RAISE NOTICE '11 операций акрила добавлены';
    ELSE
        RAISE NOTICE 'Операции акрила уже существуют, пропускаем вставку';
    END IF;
END $$;

-- Проверка результатов
SELECT 'acrylic_operations' as table_name, COUNT(*) as records_count
FROM public.acrylic_operations
UNION ALL
SELECT 'order_acrylic_operations' as table_name, COUNT(*) as records_count
FROM public.order_acrylic_operations;
