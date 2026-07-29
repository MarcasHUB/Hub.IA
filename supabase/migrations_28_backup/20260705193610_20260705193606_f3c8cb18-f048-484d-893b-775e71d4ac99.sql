
-- ============ ENUMS ============
CREATE TYPE public.app_role AS ENUM ('admin', 'buyer', 'supplier_manager');
CREATE TYPE public.quotation_status AS ENUM ('draft', 'sent', 'closed', 'cancelled');
CREATE TYPE public.supplier_quotation_status AS ENUM ('pending', 'submitted', 'declined');

-- ============ UPDATED_AT TRIGGER FN ============
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- ============ ORGANIZATIONS ============
CREATE TABLE public.organizations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  cnpj TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.organizations TO authenticated;
GRANT ALL ON public.organizations TO service_role;
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER trg_organizations_updated_at BEFORE UPDATE ON public.organizations
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============ PROFILES ============
CREATE TABLE public.profiles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  organization_id UUID REFERENCES public.organizations(id) ON DELETE SET NULL,
  full_name TEXT,
  email TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER trg_profiles_updated_at BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============ USER_ROLES ============
CREATE TABLE public.user_roles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, organization_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- ============ SECURITY DEFINER HELPERS ============
CREATE OR REPLACE FUNCTION public.current_org_id()
RETURNS UUID LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT organization_id FROM public.profiles WHERE user_id = auth.uid()
$$;

CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _org_id UUID, _role public.app_role)
RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND organization_id = _org_id AND role = _role
  )
$$;

CREATE OR REPLACE FUNCTION public.has_any_role(_user_id UUID, _org_id UUID)
RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND organization_id = _org_id
  )
$$;

-- ============ AUTO-CREATE PROFILE ON SIGNUP ============
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (user_id, email, full_name)
  VALUES (NEW.id, NEW.email, COALESCE(NEW.raw_user_meta_data->>'full_name', ''));
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============ ORGANIZATIONS POLICIES ============
CREATE POLICY "org_members_select" ON public.organizations FOR SELECT TO authenticated
  USING (id = public.current_org_id());
CREATE POLICY "org_admin_update" ON public.organizations FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), id, 'admin'))
  WITH CHECK (public.has_role(auth.uid(), id, 'admin'));
-- Insert/delete of organizations is done via privileged server function (signup flow).

-- ============ PROFILES POLICIES ============
CREATE POLICY "profiles_select_self_or_org" ON public.profiles FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR organization_id = public.current_org_id());
CREATE POLICY "profiles_update_self" ON public.profiles FOR UPDATE TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- ============ USER_ROLES POLICIES ============
CREATE POLICY "roles_select_self_or_admin" ON public.user_roles FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), organization_id, 'admin'));

-- ============ CATEGORIES ============
CREATE TABLE public.categories (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  parent_id UUID REFERENCES public.categories(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.categories TO authenticated;
GRANT ALL ON public.categories TO service_role;
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER trg_categories_updated_at BEFORE UPDATE ON public.categories
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE POLICY "categories_org_select" ON public.categories FOR SELECT TO authenticated
  USING (organization_id = public.current_org_id());
CREATE POLICY "categories_org_write" ON public.categories FOR ALL TO authenticated
  USING (organization_id = public.current_org_id()
    AND (public.has_role(auth.uid(), organization_id, 'admin') OR public.has_role(auth.uid(), organization_id, 'buyer')))
  WITH CHECK (organization_id = public.current_org_id()
    AND (public.has_role(auth.uid(), organization_id, 'admin') OR public.has_role(auth.uid(), organization_id, 'buyer')));

-- ============ SUPPLIERS ============
CREATE TABLE public.suppliers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  legal_name TEXT NOT NULL,
  trade_name TEXT,
  cnpj TEXT,
  email TEXT,
  phone TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.suppliers TO authenticated;
GRANT ALL ON public.suppliers TO service_role;
ALTER TABLE public.suppliers ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER trg_suppliers_updated_at BEFORE UPDATE ON public.suppliers
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE POLICY "suppliers_org_select" ON public.suppliers FOR SELECT TO authenticated
  USING (organization_id = public.current_org_id() OR user_id = auth.uid());
CREATE POLICY "suppliers_org_write" ON public.suppliers FOR ALL TO authenticated
  USING (organization_id = public.current_org_id()
    AND (public.has_role(auth.uid(), organization_id, 'admin') OR public.has_role(auth.uid(), organization_id, 'supplier_manager')))
  WITH CHECK (organization_id = public.current_org_id()
    AND (public.has_role(auth.uid(), organization_id, 'admin') OR public.has_role(auth.uid(), organization_id, 'supplier_manager')));
CREATE POLICY "suppliers_self_update" ON public.suppliers FOR UPDATE TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- ============ PRODUCTS ============
CREATE TABLE public.products (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  category_id UUID REFERENCES public.categories(id) ON DELETE SET NULL,
  sku TEXT,
  name TEXT NOT NULL,
  description TEXT,
  unit TEXT NOT NULL DEFAULT 'un',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.products TO authenticated;
GRANT ALL ON public.products TO service_role;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER trg_products_updated_at BEFORE UPDATE ON public.products
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE POLICY "products_org_select" ON public.products FOR SELECT TO authenticated
  USING (organization_id = public.current_org_id());
CREATE POLICY "products_org_write" ON public.products FOR ALL TO authenticated
  USING (organization_id = public.current_org_id()
    AND (public.has_role(auth.uid(), organization_id, 'admin') OR public.has_role(auth.uid(), organization_id, 'buyer')))
  WITH CHECK (organization_id = public.current_org_id()
    AND (public.has_role(auth.uid(), organization_id, 'admin') OR public.has_role(auth.uid(), organization_id, 'buyer')));

-- ============ QUOTATION_REQUESTS ============
CREATE TABLE public.quotation_requests (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  status public.quotation_status NOT NULL DEFAULT 'draft',
  due_date DATE,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.quotation_requests TO authenticated;
GRANT ALL ON public.quotation_requests TO service_role;
ALTER TABLE public.quotation_requests ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER trg_quotation_requests_updated_at BEFORE UPDATE ON public.quotation_requests
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE POLICY "qr_org_select" ON public.quotation_requests FOR SELECT TO authenticated
  USING (organization_id = public.current_org_id());
CREATE POLICY "qr_org_write" ON public.quotation_requests FOR ALL TO authenticated
  USING (organization_id = public.current_org_id()
    AND (public.has_role(auth.uid(), organization_id, 'admin') OR public.has_role(auth.uid(), organization_id, 'buyer')))
  WITH CHECK (organization_id = public.current_org_id()
    AND (public.has_role(auth.uid(), organization_id, 'admin') OR public.has_role(auth.uid(), organization_id, 'buyer')));

-- ============ QUOTATION_ITEMS ============
CREATE TABLE public.quotation_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  request_id UUID NOT NULL REFERENCES public.quotation_requests(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE RESTRICT,
  quantity NUMERIC(14,3) NOT NULL DEFAULT 1,
  unit TEXT NOT NULL DEFAULT 'un',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.quotation_items TO authenticated;
GRANT ALL ON public.quotation_items TO service_role;
ALTER TABLE public.quotation_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "qi_org_select" ON public.quotation_items FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.quotation_requests r
    WHERE r.id = request_id AND r.organization_id = public.current_org_id()));
CREATE POLICY "qi_org_write" ON public.quotation_items FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.quotation_requests r
    WHERE r.id = request_id AND r.organization_id = public.current_org_id()
      AND (public.has_role(auth.uid(), r.organization_id, 'admin') OR public.has_role(auth.uid(), r.organization_id, 'buyer'))))
  WITH CHECK (EXISTS (SELECT 1 FROM public.quotation_requests r
    WHERE r.id = request_id AND r.organization_id = public.current_org_id()
      AND (public.has_role(auth.uid(), r.organization_id, 'admin') OR public.has_role(auth.uid(), r.organization_id, 'buyer'))));

-- ============ SUPPLIER_QUOTATIONS ============
CREATE TABLE public.supplier_quotations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  request_id UUID NOT NULL REFERENCES public.quotation_requests(id) ON DELETE CASCADE,
  supplier_id UUID NOT NULL REFERENCES public.suppliers(id) ON DELETE CASCADE,
  status public.supplier_quotation_status NOT NULL DEFAULT 'pending',
  submitted_at TIMESTAMPTZ,
  total_amount NUMERIC(14,2),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (request_id, supplier_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.supplier_quotations TO authenticated;
GRANT ALL ON public.supplier_quotations TO service_role;
ALTER TABLE public.supplier_quotations ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER trg_supplier_quotations_updated_at BEFORE UPDATE ON public.supplier_quotations
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE POLICY "sq_org_or_supplier_select" ON public.supplier_quotations FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.quotation_requests r WHERE r.id = request_id AND r.organization_id = public.current_org_id())
    OR EXISTS (SELECT 1 FROM public.suppliers s WHERE s.id = supplier_id AND s.user_id = auth.uid())
  );
CREATE POLICY "sq_org_write" ON public.supplier_quotations FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.quotation_requests r
    WHERE r.id = request_id AND r.organization_id = public.current_org_id()
      AND (public.has_role(auth.uid(), r.organization_id, 'admin') OR public.has_role(auth.uid(), r.organization_id, 'buyer'))))
  WITH CHECK (EXISTS (SELECT 1 FROM public.quotation_requests r
    WHERE r.id = request_id AND r.organization_id = public.current_org_id()
      AND (public.has_role(auth.uid(), r.organization_id, 'admin') OR public.has_role(auth.uid(), r.organization_id, 'buyer'))));
CREATE POLICY "sq_supplier_update" ON public.supplier_quotations FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.suppliers s WHERE s.id = supplier_id AND s.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.suppliers s WHERE s.id = supplier_id AND s.user_id = auth.uid()));

-- ============ SUPPLIER_QUOTATION_ITEMS ============
CREATE TABLE public.supplier_quotation_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  supplier_quotation_id UUID NOT NULL REFERENCES public.supplier_quotations(id) ON DELETE CASCADE,
  quotation_item_id UUID NOT NULL REFERENCES public.quotation_items(id) ON DELETE CASCADE,
  unit_price NUMERIC(14,4),
  lead_time_days INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (supplier_quotation_id, quotation_item_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.supplier_quotation_items TO authenticated;
GRANT ALL ON public.supplier_quotation_items TO service_role;
ALTER TABLE public.supplier_quotation_items ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER trg_supplier_quotation_items_updated_at BEFORE UPDATE ON public.supplier_quotation_items
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE POLICY "sqi_select" ON public.supplier_quotation_items FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.supplier_quotations sq
    JOIN public.quotation_requests r ON r.id = sq.request_id
    WHERE sq.id = supplier_quotation_id
      AND (r.organization_id = public.current_org_id()
           OR EXISTS (SELECT 1 FROM public.suppliers s WHERE s.id = sq.supplier_id AND s.user_id = auth.uid()))));
CREATE POLICY "sqi_org_write" ON public.supplier_quotation_items FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.supplier_quotations sq
    JOIN public.quotation_requests r ON r.id = sq.request_id
    WHERE sq.id = supplier_quotation_id AND r.organization_id = public.current_org_id()
      AND (public.has_role(auth.uid(), r.organization_id, 'admin') OR public.has_role(auth.uid(), r.organization_id, 'buyer'))))
  WITH CHECK (EXISTS (SELECT 1 FROM public.supplier_quotations sq
    JOIN public.quotation_requests r ON r.id = sq.request_id
    WHERE sq.id = supplier_quotation_id AND r.organization_id = public.current_org_id()
      AND (public.has_role(auth.uid(), r.organization_id, 'admin') OR public.has_role(auth.uid(), r.organization_id, 'buyer'))));
CREATE POLICY "sqi_supplier_write" ON public.supplier_quotation_items FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.supplier_quotations sq
    JOIN public.suppliers s ON s.id = sq.supplier_id
    WHERE sq.id = supplier_quotation_id AND s.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.supplier_quotations sq
    JOIN public.suppliers s ON s.id = sq.supplier_id
    WHERE sq.id = supplier_quotation_id AND s.user_id = auth.uid()));
;
