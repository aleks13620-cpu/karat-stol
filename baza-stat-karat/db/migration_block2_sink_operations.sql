-- ============================================================
-- МИГРАЦИЯ: Блок 2 - Доп. операции по мойкам
-- Дата: 2025-12-10
-- Описание: Добавление типов моек и доп. операций
-- ============================================================

-- Проверка: если таблицы уже существуют, они будут пропущены
DO $$
BEGIN
    -- Создание таблицы sink_types (типы моек)
    IF NOT EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'sink_types') THEN
        CREATE TABLE public.sink_types (
            id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
            code text NOT NULL UNIQUE,
            name text NOT NULL,
            created_at timestamptz NOT NULL DEFAULT now()
        );

        RAISE NOTICE 'Таблица sink_types создана';
    ELSE
        RAISE NOTICE 'Таблица sink_types уже существует';
    END IF;

    -- Создание таблицы sink_extra_operations (доп. операции моек)
    IF NOT EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'sink_extra_operations') THEN
        CREATE TABLE public.sink_extra_operations (
            id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
            sink_type_id uuid NOT NULL REFERENCES public.sink_types(id),
            name text NOT NULL,
            default_price numeric(10,2),
            created_at timestamptz NOT NULL DEFAULT now()
        );

        RAISE NOTICE 'Таблица sink_extra_operations создана';
    ELSE
        RAISE NOTICE 'Таблица sink_extra_operations уже существует';
    END IF;

    -- Создание таблицы order_sink_operations (связь заказов с доп. операциями моек)
    IF NOT EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'order_sink_operations') THEN
        CREATE TABLE public.order_sink_operations (
            id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
            order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
            sink_op_id uuid NOT NULL REFERENCES public.sink_extra_operations(id),
            price numeric(10,2) NOT NULL,
            created_at timestamptz NOT NULL DEFAULT now()
        );

        RAISE NOTICE 'Таблица order_sink_operations создана';
    ELSE
        RAISE NOTICE 'Таблица order_sink_operations уже существует';
    END IF;
END $$;

-- Создание индексов
CREATE INDEX IF NOT EXISTS idx_sink_extra_operations_sink_type_id
    ON public.sink_extra_operations(sink_type_id);

CREATE INDEX IF NOT EXISTS idx_order_sink_operations_order_id
    ON public.order_sink_operations(order_id);

CREATE INDEX IF NOT EXISTS idx_order_sink_operations_sink_op_id
    ON public.order_sink_operations(sink_op_id);

-- Заполнение справочника типов моек (только если таблица пустая)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM public.sink_types LIMIT 1) THEN
        INSERT INTO public.sink_types (code, name) VALUES
            ('VN', 'Раковина VN'),
            ('КО', 'Мойка КО'),
            ('КГ', 'Мойка КГ'),
            ('КГР', 'Мойка КГР'),
            ('KR', 'Мойка KR');

        RAISE NOTICE '5 типов моек добавлены';
    ELSE
        RAISE NOTICE 'Типы моек уже существуют, пропускаем вставку';
    END IF;
END $$;

-- Заполнение доп. операций для типа VN (только если таблица пустая)
DO $$
DECLARE
    vn_type_id uuid;
BEGIN
    -- Получаем ID типа VN
    SELECT id INTO vn_type_id FROM public.sink_types WHERE code = 'VN' LIMIT 1;

    IF vn_type_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.sink_extra_operations LIMIT 1) THEN
        INSERT INTO public.sink_extra_operations (sink_type_id, name, default_price) VALUES
            (vn_type_id, 'Формовка (термоформинг)', NULL),
            (vn_type_id, 'Формовка, фрезеровка, подсклейку', NULL),
            (vn_type_id, 'Формовка, фрезеровка, подсклейку, отверстие, подслив, шлифовка', NULL),
            (vn_type_id, 'Подклейка, полировка', NULL);

        RAISE NOTICE '4 доп. операции для VN добавлены';
    ELSE
        RAISE NOTICE 'Доп. операции уже существуют, пропускаем вставку';
    END IF;
END $$;

-- Проверка результатов
SELECT 'sink_types' as table_name, COUNT(*) as records_count
FROM public.sink_types
UNION ALL
SELECT 'sink_extra_operations' as table_name, COUNT(*) as records_count
FROM public.sink_extra_operations
UNION ALL
SELECT 'order_sink_operations' as table_name, COUNT(*) as records_count
FROM public.order_sink_operations;
