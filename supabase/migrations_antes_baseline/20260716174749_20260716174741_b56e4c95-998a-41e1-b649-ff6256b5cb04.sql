
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'quotation_items_product_id_fkey'
      AND conrelid = 'public.quotation_items'::regclass
  ) THEN
    ALTER TABLE public.quotation_items
      ADD CONSTRAINT quotation_items_product_id_fkey
      FOREIGN KEY (product_id) REFERENCES public.products(id) ON DELETE RESTRICT;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'product_offers_product_id_fkey'
      AND conrelid = 'public.product_offers'::regclass
  ) THEN
    ALTER TABLE public.product_offers
      ADD CONSTRAINT product_offers_product_id_fkey
      FOREIGN KEY (product_id) REFERENCES public.products(id) ON DELETE RESTRICT;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'product_suppliers_product_id_fkey'
      AND conrelid = 'public.product_suppliers'::regclass
  ) THEN
    ALTER TABLE public.product_suppliers
      ADD CONSTRAINT product_suppliers_product_id_fkey
      FOREIGN KEY (product_id) REFERENCES public.products(id) ON DELETE RESTRICT;
  END IF;
END $$;
;
