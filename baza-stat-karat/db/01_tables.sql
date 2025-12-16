-- 01_tables.sql
-- Создание таблиц для baza-stat-karat

-- Таблица orders
CREATE TABLE public.orders (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    order_number text NOT NULL UNIQUE,
    calculator_type text NOT NULL,
    calculator_version text NOT NULL,
    hourly_rate numeric(10,2) NOT NULL,
    theoretical_time_calc_hours numeric(10,2) NOT NULL,
    additional_work_cost numeric(10,2),
    additional_work_time_hours numeric(10,2),
    theoretical_time_total_hours numeric(10,2) NOT NULL,
    complexity_level int,
    is_training_data boolean NOT NULL DEFAULT false,
    is_outlier boolean NOT NULL DEFAULT false
);

-- Таблица order_parameters
CREATE TABLE public.order_parameters (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
    countertop_sqm numeric(10,2) NOT NULL DEFAULT 0,
    edge_radius_m numeric(10,2) NOT NULL DEFAULT 0,
    sink_round_pcs int NOT NULL DEFAULT 0,
    sink_rect_pcs int NOT NULL DEFAULT 0,
    thickness_mm int NOT NULL DEFAULT 0
);

-- Таблица operations_dictionary
CREATE TABLE public.operations_dictionary (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    code text NOT NULL UNIQUE,
    name text NOT NULL,
    description text,
    default_duration_min int NOT NULL,
    is_active boolean NOT NULL DEFAULT true
);

-- Таблица order_operations
CREATE TABLE public.order_operations (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
    operation_id uuid NOT NULL REFERENCES public.operations_dictionary(id),
    theoretical_duration_min int NOT NULL,
    source text NOT NULL
);

-- Таблица masters
CREATE TABLE public.masters (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at timestamptz NOT NULL DEFAULT now(),
    name text NOT NULL,
    qualification_level int NOT NULL,
    hourly_rate numeric(10,2),
    is_active boolean NOT NULL DEFAULT true,
    skills_text text -- Навыки мастера (текстовое поле для ручного ввода)
);

-- Таблица order_execution
CREATE TABLE public.order_execution (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id uuid NOT NULL REFERENCES public.orders(id),
    master_id uuid NOT NULL REFERENCES public.masters(id),
    planned_start_at timestamptz,
    planned_end_at timestamptz,
    fact_start_at timestamptz NOT NULL,
    fact_end_at timestamptz,
    status text NOT NULL,
    comment text,
    sla_hours numeric(10,2)
);

-- Таблица pauses
CREATE TABLE public.pauses (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    order_execution_id uuid NOT NULL REFERENCES public.order_execution(id) ON DELETE CASCADE,
    paused_at timestamptz NOT NULL,
    resumed_at timestamptz,
    reason text NOT NULL,
    duration_min int
);

-- Таблица qualification_history
CREATE TABLE public.qualification_history (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    master_id uuid NOT NULL REFERENCES public.masters(id) ON DELETE CASCADE,
    changed_at timestamptz NOT NULL,
    old_level int NOT NULL,
    new_level int NOT NULL,
    reason text,
    initiator text
);

-- ============================================================
-- СПРАВОЧНИК: Технологические операции производства
-- ============================================================

-- Таблица process_operations (справочник технологических операций)
CREATE TABLE public.process_operations (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    code text NOT NULL UNIQUE,
    name text NOT NULL,
    description text,
    material_type text NOT NULL DEFAULT 'acrylic',
    is_active boolean NOT NULL DEFAULT true,
    created_at timestamptz NOT NULL DEFAULT now()
);

-- ============================================================
-- НОВЫЕ ТАБЛИЦЫ: Справочники ставок, поставщиков и камней
-- ============================================================

-- Таблица hourly_rates (справочник часовых ставок)
CREATE TABLE public.hourly_rates (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name text NOT NULL,
    material_type text NOT NULL,
    description text,
    rate_value numeric(10,2) NOT NULL,
    is_default boolean NOT NULL DEFAULT false,
    created_at timestamptz NOT NULL DEFAULT now()
);

-- Таблица stone_suppliers (поставщики камня)
CREATE TABLE public.stone_suppliers (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name text NOT NULL UNIQUE,
    is_active boolean NOT NULL DEFAULT true,
    created_at timestamptz NOT NULL DEFAULT now()
);

-- Таблица stones (каталог камней)
CREATE TABLE public.stones (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    supplier_id uuid NOT NULL REFERENCES public.stone_suppliers(id),
    name text NOT NULL,
    material_type text NOT NULL DEFAULT 'acrylic',
    hourly_rate_id uuid REFERENCES public.hourly_rates(id),
    complexity_level text,
    is_active boolean NOT NULL DEFAULT true,
    created_at timestamptz NOT NULL DEFAULT now()
);

-- Расширение таблицы orders: добавление связи с камнем
ALTER TABLE public.orders
ADD COLUMN stone_id uuid REFERENCES public.stones(id);

-- ============================================================
-- ИНДЕКСЫ
-- ============================================================

CREATE INDEX idx_order_parameters_order_id ON public.order_parameters(order_id);
CREATE INDEX idx_order_operations_order_id ON public.order_operations(order_id);
CREATE INDEX idx_order_operations_operation_id ON public.order_operations(operation_id);
CREATE INDEX idx_order_execution_order_id ON public.order_execution(order_id);
CREATE INDEX idx_order_execution_master_id ON public.order_execution(master_id);
CREATE INDEX idx_pauses_order_execution_id ON public.pauses(order_execution_id);
CREATE INDEX idx_qualification_history_master_id ON public.qualification_history(master_id);

-- Индексы для process_operations
CREATE UNIQUE INDEX idx_process_operations_code ON public.process_operations(code);
CREATE INDEX idx_process_operations_material_type ON public.process_operations(material_type);

-- Индексы для новых таблиц
CREATE INDEX idx_stones_supplier_id ON public.stones(supplier_id);
CREATE INDEX idx_stones_hourly_rate_id ON public.stones(hourly_rate_id);
CREATE INDEX idx_orders_stone_id ON public.orders(stone_id);
CREATE INDEX idx_hourly_rates_material_type ON public.hourly_rates(material_type);
CREATE INDEX idx_hourly_rates_is_default ON public.hourly_rates(is_default);

-- ============================================================
-- ТРИГГЕРЫ для updated_at
-- ============================================================

CREATE OR REPLACE FUNCTION public.set_current_timestamp_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_orders_updated_at
    BEFORE UPDATE ON public.orders
    FOR EACH ROW
    EXECUTE FUNCTION public.set_current_timestamp_updated_at();

CREATE TRIGGER set_order_parameters_updated_at
    BEFORE UPDATE ON public.order_parameters
    FOR EACH ROW
    EXECUTE FUNCTION public.set_current_timestamp_updated_at();

CREATE TRIGGER set_order_operations_updated_at
    BEFORE UPDATE ON public.order_operations
    FOR EACH ROW
    EXECUTE FUNCTION public.set_current_timestamp_updated_at();

CREATE TRIGGER set_masters_updated_at
    BEFORE UPDATE ON public.masters
    FOR EACH ROW
    EXECUTE FUNCTION public.set_current_timestamp_updated_at();

CREATE TRIGGER set_order_execution_updated_at
    BEFORE UPDATE ON public.order_execution
    FOR EACH ROW
    EXECUTE FUNCTION public.set_current_timestamp_updated_at();

CREATE TRIGGER set_pauses_updated_at
    BEFORE UPDATE ON public.pauses
    FOR EACH ROW
    EXECUTE FUNCTION public.set_current_timestamp_updated_at();

CREATE TRIGGER set_qualification_history_updated_at
    BEFORE UPDATE ON public.qualification_history
    FOR EACH ROW
    EXECUTE FUNCTION public.set_current_timestamp_updated_at();

-- ============================================================
-- БЛОК 1: Операции акрила (основные 11 операций)
-- ============================================================

-- Таблица acrylic_operations (справочник основных операций акрила)
CREATE TABLE public.acrylic_operations (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name text NOT NULL,
    unit text NOT NULL DEFAULT 'шт',
    created_at timestamptz NOT NULL DEFAULT now()
);

-- Таблица order_acrylic_operations (связь заказов с операциями акрила)
CREATE TABLE public.order_acrylic_operations (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
    operation_id uuid NOT NULL REFERENCES public.acrylic_operations(id),
    volume numeric(10,2) NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now()
);

-- Индексы для новых таблиц
CREATE INDEX idx_order_acrylic_operations_order_id ON public.order_acrylic_operations(order_id);
CREATE INDEX idx_order_acrylic_operations_operation_id ON public.order_acrylic_operations(operation_id);

-- Заполнение справочника операций акрила (11 операций)
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

-- ============================================================
-- БЛОК 3: Квалификации и навыки мастеров
-- ============================================================

-- Таблица master_levels (справочник уровней мастеров)
CREATE TABLE public.master_levels (
    id smallint PRIMARY KEY,
    name text NOT NULL,
    description text,
    time_factor numeric(3,2) DEFAULT 1.0,
    created_at timestamptz NOT NULL DEFAULT now()
);

-- Таблица master_skills (справочник навыков/сложных работ)
CREATE TABLE public.master_skills (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    code text NOT NULL UNIQUE,
    name text NOT NULL,
    description text,
    is_complex boolean DEFAULT true,
    is_active boolean NOT NULL DEFAULT true,
    created_at timestamptz NOT NULL DEFAULT now()
);

-- Индексы для новых таблиц
CREATE UNIQUE INDEX idx_master_skills_code ON public.master_skills(code);
CREATE INDEX idx_master_skills_is_active ON public.master_skills(is_active);

-- Заполнение справочника уровней мастеров (4 уровня)
INSERT INTO public.master_levels (id, name, description, time_factor) VALUES
    (1, 'Уровень 1', 'Самый высокий уровень квалификации', 0.85),
    (2, 'Уровень 2', 'Высокий уровень квалификации', 0.95),
    (3, 'Уровень 3', 'Средний уровень квалификации', 1.00),
    (4, 'Уровень 4', 'Начальный уровень квалификации', 1.15);

-- Заполнение справочника навыков (базовый набор)
INSERT INTO public.master_skills (code, name, description, is_complex) VALUES
    ('sink_vn', 'Сложные работы с раковинами VN', 'Термоформинг и сложная обработка раковин VN', true),
    ('sink_ko', 'Сложные работы с мойками КО', 'Установка и обработка моек типа КО', true),
    ('sink_kg', 'Сложные работы с мойками КГ/КГР', 'Установка и обработка моек типа КГ и КГР', true),
    ('sink_kr', 'Сложные работы с мойками KR', 'Установка и обработка моек типа KR', true),
    ('curved_edges', 'Работа с радиусными кромками', 'Фрезеровка и обработка радиусных и фигурных кромок', true),
    ('complex_gluing', 'Сложная склейка', 'Склейка сложных многокомпонентных изделий', true),
    ('thermoforming', 'Термоформинг', 'Формовка акрила с применением нагрева', true),
    ('polishing', 'Финишная полировка', 'Качественная финишная полировка и шлифовка', true);

-- ============================================================
-- БЛОК 3: Связь мастеров и навыков
-- ============================================================

-- Таблица связи мастеров и навыков (many-to-many)
CREATE TABLE public.master_skills_mapping (
    master_id uuid NOT NULL REFERENCES public.masters(id) ON DELETE CASCADE,
    skill_id uuid NOT NULL REFERENCES public.master_skills(id) ON DELETE CASCADE,
    created_at timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (master_id, skill_id)
);

-- Индексы для оптимизации запросов
CREATE INDEX idx_master_skills_mapping_master ON public.master_skills_mapping(master_id);
CREATE INDEX idx_master_skills_mapping_skill ON public.master_skills_mapping(skill_id);
