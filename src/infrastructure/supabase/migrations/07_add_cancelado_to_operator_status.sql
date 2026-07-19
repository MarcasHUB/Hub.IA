-- ==========================================
-- Migration: Adicionar 'cancelado' ao ENUM operator_status
-- ==========================================

-- PostgreSQL permite adicionar valores a um ENUM existente
ALTER TYPE operator_status ADD VALUE IF NOT EXISTS 'cancelado';
