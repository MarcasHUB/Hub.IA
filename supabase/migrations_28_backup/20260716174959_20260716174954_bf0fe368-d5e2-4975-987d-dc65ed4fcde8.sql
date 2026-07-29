
ALTER TABLE public.product_offers DROP CONSTRAINT IF EXISTS product_offers_product_id_fkey;
ALTER TABLE public.product_offers
  ADD CONSTRAINT product_offers_product_id_fkey
  FOREIGN KEY (product_id) REFERENCES public.products(id) ON DELETE RESTRICT;

ALTER TABLE public.product_suppliers DROP CONSTRAINT IF EXISTS product_suppliers_product_id_fkey;
ALTER TABLE public.product_suppliers
  ADD CONSTRAINT product_suppliers_product_id_fkey
  FOREIGN KEY (product_id) REFERENCES public.products(id) ON DELETE RESTRICT;
;
