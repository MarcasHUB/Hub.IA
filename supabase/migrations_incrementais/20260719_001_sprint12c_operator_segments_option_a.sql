-- Migration para implementar a Opção A de Gestão de Segmentos de Operador
-- Adicionando a flag global "todos_segmentos" diretamente na tabela de operadores e convites

ALTER TABLE public.operators
ADD COLUMN IF NOT EXISTS todos_segmentos boolean NOT NULL DEFAULT false;

ALTER TABLE public.operator_invitations
ADD COLUMN IF NOT EXISTS todos_segmentos boolean NOT NULL DEFAULT false;

-- O campo "todos_segmentos" de operator_segments será preterido/ignorado,
-- então não há impacto destrutivo em mantê-lo por retrocompatibilidade temporária.
