import { useState, useEffect, useMemo } from "react";
import { Link, useLocation, Outlet, useNavigate } from "react-router-dom";
import { supabase } from "@/infrastructure/supabase/client";
import { cn } from "@/shared/utils/cn";
import {
  Globe,
  Settings,
  ShoppingCart,
  X,
  Trash2,
  MessageSquare,
  FileText,
} from "lucide-react";
import { Button } from "@/shared/components/ui/Button";
import { useQuotationCart } from "@/modules/quotations/presentation/context/QuotationCartContext";
import { NotificationBell } from "@/modules/notifications/presentation/components/NotificationBell";
import { useChatDrawer } from "@/modules/messages/presentation/context/ChatDrawerContext";
import { ChatDrawer } from "@/modules/messages/presentation/components/ChatDrawer";
import { QuotationTypeModal } from "@/modules/quotations/presentation/components/QuotationTypeModal";
import { resolveOrganizationLogoUrl } from "@/shared/utils/logoUtils";

const APP_VERSION = "1.0.1-build";
console.log(`[SupplyHub] AppLayout loaded - Version: ${APP_VERSION}`);

// NAV_ITEMS agora é calculado dinamicamente dentro de AppLayout

// ─── CompanyLogo (logo da empresa ou iniciais) ────────────────────────────────
function CompanyLogo({
  logo,
  initials,
}: {
  logo: string | null;
  initials?: string;
}) {
  const [imgError, setImgError] = useState(false);

  // Resetar o erro se o logo mudar
  useEffect(() => {
    setImgError(false);
  }, [logo]);

  return (
    <div className="h-8 w-8 rounded-full border border-indigo-200 overflow-hidden bg-slate-900 flex items-center justify-center shrink-0 shadow-sm relative group">
      {logo && !imgError ? (
        <img
          src={logo}
          alt="Logo"
          className="h-full w-full object-cover"
          onError={() => setImgError(true)}
        />
      ) : (
        <div className="h-full w-full bg-gradient-to-br from-indigo-600 to-violet-600 flex items-center justify-center">
          <span className="text-[10px] font-black text-white leading-none">
            {initials || "SH"}
          </span>
        </div>
      )}
    </div>
  );
}

const isNavItemActive = (itemHref: string, currentPath: string) => {
  if (itemHref === currentPath) return true;
  if (itemHref === "/dashboard") return false;
  if (itemHref === "/suppliers") {
    return (
      currentPath.startsWith("/suppliers") &&
      !currentPath.startsWith("/suppliers/network")
    );
  }
  return currentPath.startsWith(itemHref);
};

// ─── AppLayout ────────────────────────────────────────────────────────────────
export function AppLayout() {
  const location = useLocation();
  const navigate = useNavigate();
  const {
    items,
    isCartOpen,
    setCartOpen,
    removeItem,
    updateQuantity,
    updateNotes,
    clearCart,
  } = useQuotationCart();
  const { isChatOpen, openInbox } = useChatDrawer();
  const [isPreviewModalOpen, setIsPreviewModalOpen] = useState(false);

  const [companyLogo, setCompanyLogo] = useState<string | null>(
    resolveOrganizationLogoUrl(
      localStorage.getItem("supplyhub_company_logo"),
      localStorage.getItem("supplyhub_organization_id") || undefined,
    ),
  );
  const [companyName, setCompanyName] = useState<string>(
    localStorage.getItem("supplyhub_company_name") || "Hub.IA",
  );
  const [operatorProfile, setOperatorProfile] =
    useState<string>("Carregando...");
  const [operatorName, setOperatorName] = useState<string>("Usuário");

  const [authReady, setAuthReady] = useState(false);
  const [profileReady, setProfileReady] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);

  useEffect(() => {
    let isMounted = true;

    const loadAuth = async (retryCount = 0) => {
      try {
        if (isMounted) setProfileReady(false);

        // getUser() garante validação real do token contra o servidor,
        // aguardando refresh se necessário (diferente de getSession que pega do storage)
        const {
          data: { user },
          error: userError,
        } = await supabase.auth.getUser();

        if (userError || !user) {
          if (isMounted) {
            setIsAdmin(false);
            setAuthReady(true);
            setProfileReady(true);
            navigate("/login?reason=session_expired");
          }
          return;
        }

        if (isMounted) setAuthReady(true);

        // Verifica dados do profile (nome real e flag de super admin)
        const { data: globalUser } = await supabase
          .from("profiles")
          .select("full_name, display_name, avatar_url, is_super_admin")
          .eq("user_id", user.id)
          .single();

        console.log("USER AUTH", user);
        console.log("GLOBAL USER", globalUser);
        console.log("IS SUPER ADMIN", globalUser?.is_super_admin);

        // Carregar todas as possíveis memberships do usuário logado
        let memberships: string[] = [];

        try {
          const { data: opData } = await supabase
            .from("operators")
            .select("organization_id")
            .eq("id", user.id);
          if (opData)
            memberships.push(
              ...opData.map((o: any) => o.organization_id).filter(Boolean),
            );
        } catch {}

        try {
          const { data: roleData } = await supabase
            .from("user_roles")
            .select("organization_id")
            .eq("user_id", user.id);
          if (roleData)
            memberships.push(
              ...roleData.map((r: any) => r.organization_id).filter(Boolean),
            );
        } catch {}

        try {
          const { data: profileData } = await supabase
            .from("profiles")
            .select("organization_id")
            .eq("user_id", user.id);
          if (profileData)
            memberships.push(
              ...profileData.map((p: any) => p.organization_id).filter(Boolean),
            );
        } catch {}

        // Remove duplicatas
        memberships = Array.from(new Set(memberships));

        // Obter o tenant preferido do storage
        const storedOrgId = localStorage.getItem("supplyhub_organization_id");
        let activeOrganizationId = null;

        if (storedOrgId && memberships.includes(storedOrgId)) {
          activeOrganizationId = storedOrgId;
        } else if (memberships.length > 0) {
          activeOrganizationId = memberships[0];
          localStorage.setItem(
            "supplyhub_organization_id",
            activeOrganizationId,
          );
        }

        // Buscar dados da organização ativa
        if (activeOrganizationId) {
          const { data: orgData } = await supabase
            .from("organizations")
            .select("nome_fantasia, name, logo_url")
            .eq("id", activeOrganizationId)
            .maybeSingle();

          if (orgData) {
            const orgName = orgData.nome_fantasia || orgData.name || "Empresa";
            if (isMounted) {
              setCompanyName(orgName);
              setCompanyLogo(
                resolveOrganizationLogoUrl(
                  orgData.logo_url,
                  activeOrganizationId,
                ),
              );
            }
            // Persistir também pro resto do app em modo compatibilidade
            localStorage.setItem("supplyhub_company_name", orgName);
            if (orgData.logo_url) {
              localStorage.setItem("supplyhub_company_logo", orgData.logo_url);
            } else {
              localStorage.removeItem("supplyhub_company_logo");
            }
          }
        } else {
          // Caso não tenha nenhuma organização
          if (isMounted) {
            setCompanyName("Empresa");
            setCompanyLogo(null);
          }
        }

        if (isMounted) {
          let currentProfile = "Operador";
          let opNome = "";

          // Busca perfil pessoal primeiro de profiles
          const { data: profData } = await supabase
            .from("profiles")
            .select("display_name, full_name")
            .eq("user_id", user.id)
            .maybeSingle();
          opNome =
            profData?.display_name?.trim() ||
            profData?.full_name?.trim() ||
            user.email ||
            "Usuário não identificado";

          if (activeOrganizationId) {
            // Buscar role especifica da organizacao ativa
            const { data: roleData } = await supabase
              .from("user_roles")
              .select("role")
              .eq("user_id", user.id)
              .eq("organization_id", activeOrganizationId)
              .maybeSingle();
            const { data: opData } = await supabase
              .from("operators")
              .select("perfil")
              .eq("id", user.id)
              .eq("organization_id", activeOrganizationId)
              .maybeSingle();

            // Importa e usa a funcao getCompactRoleLabel que criamos
            const { getCompactRoleLabel } =
              await import("@/shared/utils/roleUtils");
            currentProfile = getCompactRoleLabel(
              roleData?.role || opData?.perfil || "operator",
            );

            if (
              roleData?.role === "organization_admin" ||
              opData?.perfil === "administrador"
            ) {
              setIsAdmin(true);
            } else {
              setIsAdmin(false);
            }
          }

          if (globalUser?.is_super_admin) {
            currentProfile = "ADMINISTRADOR GLOBAL";
            setIsSuperAdmin(true);
            setIsAdmin(true);
          } else {
            setIsSuperAdmin(false);
          }

          setOperatorProfile(currentProfile);

          // Nome do operador autenticado (nunca usar nome da empresa aqui)
          const nameToSet =
            globalUser?.display_name ||
            globalUser?.full_name ||
            opNome ||
            user.email ||
            "Usuário não identificado";
          setOperatorName(nameToSet);

          // Avatar
          if (globalUser?.avatar_url) {
            localStorage.setItem(
              "supplyhub_user_avatar",
              globalUser.avatar_url,
            );
          } else {
            localStorage.removeItem("supplyhub_user_avatar");
          }
        }
      } catch (err: any) {
        console.error("Erro ao verificar perfil:", err);
        // Se for erro de rede/fetch ao abrir o navegador (muito comum no Edge Startup Boost)
        // Tentamos novamente após 1 segundo (máximo 2 tentativas)
        if (
          retryCount < 2 &&
          (err.message?.includes("Failed to fetch") ||
            err.message?.includes("NetworkError"))
        ) {
          setTimeout(() => {
            if (isMounted) loadAuth(retryCount + 1);
          }, 1000);
          return; // Não finaliza o estado de loading ainda
        }
        if (isMounted) setIsAdmin(false);
      } finally {
        if (isMounted) {
          setAuthReady(true);
          setProfileReady(true);
        }
      }
    };

    loadAuth();

    // Supabase auth listener para reagir a login / logoff / refresh / troca de aba (se session sync ativado)
    const { data: authListener } = supabase.auth.onAuthStateChange(
      (event, _session) => {
        if (
          event === "SIGNED_IN" ||
          event === "TOKEN_REFRESHED" ||
          event === "USER_UPDATED"
        ) {
          loadAuth();
        } else if (event === "SIGNED_OUT") {
          if (isMounted) {
            setIsAdmin(false);
            setAuthReady(true);
            setProfileReady(true);
          }
        }
      },
    );

    // Restauracao de BFCache (botão Voltar / Restaurar sessão Edge)
    const handlePageShow = (e: PageTransitionEvent) => {
      if (e.persisted) {
        loadAuth();
      }
    };

    // Restauracao de visibilidade (ex: mudou de aba e voltou)
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        loadAuth();
      }
    };

    // Edge normal costuma restaurar abas antes da rede estar pronta
    const handleOnline = () => {
      loadAuth();
    };

    const handleLogoUpdate = (e: Event) => {
      const customEvent = e as CustomEvent;
      if (customEvent.detail && customEvent.detail.logo_url) {
        const orgId =
          localStorage.getItem("supplyhub_organization_id") || undefined;
        setCompanyLogo(
          resolveOrganizationLogoUrl(customEvent.detail.logo_url, orgId),
        );
        localStorage.setItem(
          "supplyhub_company_logo",
          customEvent.detail.logo_url,
        );
      }
    };

    window.addEventListener("pageshow", handlePageShow);
    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("online", handleOnline);
    window.addEventListener("hubia:company-logo-updated", handleLogoUpdate);

    return () => {
      isMounted = false;
      authListener.subscription.unsubscribe();
      window.removeEventListener("pageshow", handlePageShow);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("online", handleOnline);
      window.removeEventListener(
        "hubia:company-logo-updated",
        handleLogoUpdate,
      );
    };
  }, []);

  const dynamicNavItems = useMemo(() => {
    const baseItems = [
      { name: "Dashboard", href: "/dashboard" },
      { name: "Meus Parceiros", href: "/suppliers" },
      { name: "Materiais", href: "/products" },
      { name: "Cotações", href: "/quotations" },
    ];

    return baseItems;
  }, []);

  useEffect(() => {
    // Forçar limpeza de org-1 legado do localStorage
    if (localStorage.getItem("supplyhub_organization_id") === "org-1") {
      localStorage.setItem(
        "supplyhub_organization_id",
        "00000000-0000-0000-0000-000000000000",
      );
    }

    const handleUpdate = () => {
      const orgId =
        localStorage.getItem("supplyhub_organization_id") || undefined;
      setCompanyLogo(
        resolveOrganizationLogoUrl(
          localStorage.getItem("supplyhub_company_logo"),
          orgId,
        ),
      );
      setCompanyName(
        localStorage.getItem("supplyhub_company_name") || "Hub.IA",
      );
      // Aqui não atualizamos mais o Operador do localStorage para evitar piscar dados antigos
      // A responsabilidade de manter o operador agora é do loadAuth (profiles)
    };
    window.addEventListener("company_profile_updated", handleUpdate);
    return () =>
      window.removeEventListener("company_profile_updated", handleUpdate);
  }, []);

  // Verificação periódica de Sessão Única
  useEffect(() => {
    const interval = setInterval(() => {
      const savedOperator = localStorage.getItem("supplyhub_logged_operator");
      if (!savedOperator) return;

      const sessionToken = localStorage.getItem("supplyhub_session_token");

      const rawSessions = localStorage.getItem("supplyhub_sessions_v2") || "[]";
      const sessions = JSON.parse(rawSessions);

      // Procurar nossa sessão
      const currentSession = sessions.find(
        (s: any) => s.token_hash === sessionToken,
      );

      if (currentSession && currentSession.status === "encerrada") {
        // Desconectar o operador
        localStorage.removeItem("supplyhub_logged_operator");
        localStorage.removeItem("supplyhub_session_token");

        // Limpar cookies/sessão Supabase
        import("@/infrastructure/supabase/client").then(({ supabase }) => {
          supabase.auth.signOut();
        });

        navigate("/login?reason=session_terminated");
      }
    }, 3000);

    return () => clearInterval(interval);
  }, [navigate]);

  const handleFinishQuotation = () => {
    setCartOpen(false);
    setIsPreviewModalOpen(true);
  };

  const handleSaveQuotation = (data: any) => {
    const newQuotation = {
      id: data.code,
      title: data.productName,
      type: data.type,
      itemsCount: items.length,
      status: "Open" as const,
      date: new Date().toLocaleDateString("pt-BR"),
      targetSupplierName: data.targetSupplierName || "Fornecedor",
      requester: data.requester || "Comprador B2B",
      deliveryDate: data.deliveryDate,
      additionalDesc: data.additionalDesc,
      selectedProducts: items.map((item) => ({
        id: item.productId,
        name: item.name,
        price: 150.0,
        measures: item.uom,
        manufacturer: item.manufacturer,
        sku: item.sku,
        partNumber: item.partNumber,
      })),
      productQuantities: items.reduce(
        (acc, item) => {
          acc[item.productId] = String(item.quantity);
          return acc;
        },
        {} as Record<string, string>,
      ),
      proposals:
        data.type === "BID"
          ? [
              {
                supplierName: "Brasil Cabos",
                price: items.reduce(
                  (sum, i) => sum + i.quantity * 150 * 0.94,
                  0,
                ),
                deliveryDays: 2,
                relationshipScore: 95,
              },
              {
                supplierName: "Eletro Tudo B2B",
                price: items.reduce(
                  (sum, i) => sum + i.quantity * 150 * 0.98,
                  0,
                ),
                deliveryDays: 3,
                relationshipScore: 84,
              },
              {
                supplierName: "Fixação Ind.",
                price: items.reduce(
                  (sum, i) => sum + i.quantity * 150 * 1.02,
                  0,
                ),
                deliveryDays: 5,
                relationshipScore: 72,
              },
            ]
          : [
              {
                supplierName:
                  data.targetSupplierName || "Fornecedor Direcionado",
                price: items.reduce(
                  (sum, i) => sum + i.quantity * 150 * 0.95,
                  0,
                ),
                deliveryDays: 4,
                relationshipScore: 92,
              },
            ],
    };

    // Salva em supplyhub_quotations (listagem)
    const savedQuotes = localStorage.getItem("supplyhub_quotations");
    const quotesList = savedQuotes ? JSON.parse(savedQuotes) : [];
    quotesList.unshift(newQuotation);
    localStorage.setItem("supplyhub_quotations", JSON.stringify(quotesList));

    // Salva em supplyhub_sent_quotations (detalhes/comparação)
    const savedSentQuotes = localStorage.getItem("supplyhub_sent_quotations");
    const sentQuotesList = savedSentQuotes ? JSON.parse(savedSentQuotes) : [];
    sentQuotesList.unshift(newQuotation);
    localStorage.setItem(
      "supplyhub_sent_quotations",
      JSON.stringify(sentQuotesList),
    );

    clearCart();
    setIsPreviewModalOpen(false);
    navigate("/quotations");
  };

  return (
    <div className="flex flex-col h-screen w-full bg-slate-100 overflow-hidden">
      {/* ═══════════════════════════════════════════════════════════════════════
          NAVBAR ÚNICA NO TOPO
      ═══════════════════════════════════════════════════════════════════════ */}
      <header className="bg-white border-b border-slate-200 h-16 flex justify-center shrink-0 z-30 sticky top-0 shadow-sm">
        {/* Container centralizador para evitar que espalhe em telas largas */}
        <div className="w-full max-w-[1440px] px-6 flex items-center justify-between">
          {/* BLOCO DA ESQUERDA: Logo */}
          <Link
            to="/"
            className="flex items-center hover:opacity-80 transition-opacity shrink-0"
          >
            <span className="text-[22px] font-extrabold text-indigo-700 tracking-tight leading-none">
              Hub.IA
            </span>
            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-widest leading-none ml-2 mt-1">
              Suprimentos
            </span>
          </Link>

          {/* BLOCO CENTRAL: Navegação e Rede */}
          <nav className="hidden lg:flex items-center justify-center flex-1 shrink-0 px-8">
            <div className="flex items-center gap-6">
              {/* Rede de Empresas Integrada como Item de Menu */}
              <Link
                to="/suppliers/network"
                className={cn(
                  "flex items-center gap-1 text-[12px] font-bold uppercase tracking-wide transition-colors whitespace-nowrap",
                  location.pathname.startsWith("/suppliers/network")
                    ? "text-indigo-700"
                    : "text-slate-500 hover:text-slate-900",
                )}
              >
                <Globe className="h-[22px] w-[22px]" strokeWidth={2.5} />
                <span>REDE DE EMPRESAS</span>
              </Link>

              <div className="h-4 w-px bg-slate-300 shrink-0" />

              {authReady && profileReady ? (
                dynamicNavItems.map((item) => {
                  const isActive = isNavItemActive(
                    item.href,
                    location.pathname,
                  );
                  return (
                    <Link
                      key={item.name}
                      to={item.href}
                      className={cn(
                        "text-sm transition-colors whitespace-nowrap",
                        isActive
                          ? "font-bold text-indigo-700"
                          : "font-medium text-slate-500 hover:text-slate-900",
                      )}
                    >
                      {item.name}
                    </Link>
                  );
                })
              ) : (
                <div className="flex gap-6 items-center">
                  <div className="h-3.5 w-20 bg-slate-200 rounded-md animate-pulse" />
                  <div className="h-3.5 w-24 bg-slate-200 rounded-md animate-pulse" />
                  <div className="h-3.5 w-20 bg-slate-200 rounded-md animate-pulse" />
                  <div className="h-3.5 w-24 bg-slate-200 rounded-md animate-pulse" />
                </div>
              )}

              {isSuperAdmin && (
                <>
                  <div className="h-4 w-px bg-slate-300 shrink-0" />
                  <Link
                    to="/admin"
                    className={cn(
                      "flex items-center gap-1.5 text-[12px] font-bold uppercase tracking-wide transition-colors leading-none",
                      location.pathname.startsWith("/admin")
                        ? "text-indigo-700"
                        : "text-slate-500 hover:text-slate-900",
                    )}
                  >
                    <div className="flex flex-col items-center justify-center space-y-[2px]">
                      <span>ADM</span>
                      <span>GLOBAL</span>
                    </div>
                  </Link>
                </>
              )}
            </div>
          </nav>

          {/* BLOCO DA DIREITA: Empresa, Operador, Ações */}
          <div className="flex items-center gap-5 shrink-0">
            <div className="h-5 w-px bg-slate-200 shrink-0 hidden md:block" />

            {/* Card da Empresa Minimalista */}
            <Link
              to="/empresa"
              className="hidden md:flex items-center gap-2 hover:opacity-80 transition-opacity"
              title="Área da Empresa"
            >
              <CompanyLogo
                logo={companyLogo}
                initials={companyName.substring(0, 2).toUpperCase()}
              />
              <span className="text-sm font-bold text-slate-800">
                {companyName}
              </span>
            </Link>

            <div className="h-5 w-px bg-slate-200 shrink-0 hidden md:block" />

            {/* Operador Minimalista (Sem separador entre ele e a empresa) */}
            <div className="hidden md:flex items-center gap-3">
              <div className="flex flex-col text-right leading-tight">
                <span className="text-sm font-bold text-slate-800 capitalize">
                  {operatorName}
                </span>
                <span className="text-[10px] font-bold text-indigo-600 tracking-wide uppercase">
                  {operatorProfile}
                </span>
              </div>
              <Link
                to="/meus-dados"
                className="text-slate-400 hover:text-indigo-600 transition-colors"
                title="Meus Dados"
              >
                {localStorage.getItem("supplyhub_user_avatar") ? (
                  <img
                    src={localStorage.getItem("supplyhub_user_avatar")!}
                    alt="Avatar"
                    className="w-8 h-8 rounded-full object-cover"
                  />
                ) : (
                  <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center">
                    <span className="text-slate-400 font-bold uppercase">
                      {operatorName.charAt(0)}
                    </span>
                  </div>
                )}
              </Link>
            </div>

            <div className="h-5 w-px bg-slate-200 shrink-0" />

            {/* Ações (Chats, Carrinho, Notificações) */}
            <div className="flex items-center gap-4">
              <button
                onClick={() => openInbox()}
                className={cn(
                  "flex items-center gap-1.5 text-sm font-medium transition-colors",
                  isChatOpen
                    ? "text-indigo-700"
                    : "text-slate-500 hover:text-indigo-600",
                )}
                title="Abrir Chat B2B"
              >
                <MessageSquare className="h-4 w-4" />
                <span>Chats</span>
              </button>

              <button
                onClick={() => setCartOpen(true)}
                className="relative text-slate-500 hover:text-indigo-600 transition-colors"
                title="Cotação Atual"
              >
                <ShoppingCart className="h-5 w-5" />
                {items.length > 0 && (
                  <span className="absolute -top-1.5 -right-1.5 h-4 w-4 rounded-full bg-indigo-600 text-white text-[9px] font-bold flex items-center justify-center shadow-sm">
                    {items.length}
                  </span>
                )}
              </button>

              <div className="text-slate-500 hover:text-indigo-600 transition-colors">
                <NotificationBell />
              </div>
            </div>

            <div className="h-5 w-px bg-slate-200 shrink-0 mx-1" />

            {/* Botão Sair */}
            <button
              onClick={async () => {
                // Clear state memory
                setIsAdmin(false);
                setAuthReady(false);
                setProfileReady(false);

                // Clear app-specific items, preserving Supabase tokens
                localStorage.removeItem("supplyhub_razao_social");
                localStorage.removeItem("supplyhub_company_name");
                localStorage.removeItem("supplyhub_company_logo");
                localStorage.removeItem("supplyhub_organization_id");
                localStorage.removeItem("supplyhub_logged_operator");
                localStorage.removeItem("supplyhub_session_token");
                localStorage.removeItem("supplyhub_cnpj");
                localStorage.removeItem("supplyhub_email_corp");
                localStorage.removeItem("supplyhub_telefone");
                localStorage.removeItem("supplyhub_gestor_principal");

                try {
                  await supabase.auth.signOut();
                } catch (e) {
                  console.error("Logout err:", e);
                }
                window.location.href = "/login";
              }}
              className="text-sm font-semibold text-red-500 hover:text-red-700 transition-colors"
            >
              Sair
            </button>
          </div>
        </div>
      </header>

      {/* ═══════════════════════════════════════════════════════════════════════
          CONTEÚDO DA PÁGINA
      ═══════════════════════════════════════════════════════════════════════ */}
      <main className="flex-1 overflow-y-auto">
        <div className="p-8 max-w-7xl mx-auto min-h-full">
          <Outlet />
        </div>
      </main>

      {/* ═══════════════════════════════════════════════════════════════════════
          DRAWER DO CARRINHO DE COTAÇÃO
      ═══════════════════════════════════════════════════════════════════════ */}
      {isCartOpen && (
        <>
          <div
            className="fixed inset-0 bg-slate-900/20 backdrop-blur-sm z-40"
            onClick={() => setCartOpen(false)}
          />
          <div className="fixed right-0 top-0 h-full w-96 bg-white shadow-2xl z-50 flex flex-col animate-in slide-in-from-right-full duration-300">
            <div className="p-6 border-b border-slate-200 relative shrink-0">
              <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <ShoppingCart className="h-5 w-5 text-indigo-600" />
                Carrinho Corporativo
              </h2>
              <p className="text-xs text-slate-400 mt-1">
                Revise sua lista de itens antes de gerar a Requisição de Compra
                (RC).
              </p>
              <button
                onClick={() => setCartOpen(false)}
                className="absolute top-4 right-4 p-1.5 hover:bg-slate-100 rounded-full border border-slate-200 transition-colors"
                title="Fechar"
              >
                <X className="h-4 w-4 text-slate-500" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-4 bg-slate-50/30">
              {items.length === 0 ? (
                <div className="flex flex-col items-center text-center text-slate-400 mt-16 gap-5">
                  <div className="h-20 w-20 rounded-full bg-indigo-50 border-2 border-indigo-100 flex items-center justify-center">
                    <ShoppingCart className="h-9 w-9 text-indigo-300" />
                  </div>
                  <div>
                    <p className="font-semibold text-slate-700 text-sm">
                      Sua cesta de cotação está vazia
                    </p>
                    <p className="text-xs text-slate-400 mt-1">
                      Adicione produtos para gerar uma cotação.
                    </p>
                  </div>
                  <Button
                    onClick={() => {
                      setCartOpen(false);
                      navigate("/products");
                    }}
                    className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold h-10 px-5 rounded-xl flex items-center gap-2 shadow-sm"
                  >
                    🛍 Deseja iniciar uma cotação?
                  </Button>
                  <p className="text-[10px] text-slate-300">
                    Você será redirecionado ao catálogo de produtos
                  </p>
                </div>
              ) : (
                items.map((item) => (
                  <div
                    key={item.productId}
                    className="border border-slate-200 p-4 rounded-2xl bg-white shadow-sm relative space-y-2 flex flex-col"
                  >
                    <button
                      onClick={() => removeItem(item.productId)}
                      className="absolute top-4 right-4 p-1.5 text-slate-400 hover:text-red-650 hover:bg-red-50 rounded-lg transition-colors"
                      title="Remover Item"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>

                    <div className="space-y-1">
                      {item.category && (
                        <span className="inline-block text-[8px] font-black uppercase tracking-wider bg-indigo-50/70 text-indigo-700 px-1.5 py-0.5 rounded-md">
                          {item.category}
                        </span>
                      )}
                      <h4 className="font-bold text-slate-900 text-sm leading-tight pr-8">
                        {item.name}
                      </h4>
                      <p className="text-[10px] font-medium text-slate-450">
                        SKU: {item.sku || "N/D"}
                      </p>

                      <div className="flex flex-wrap gap-x-2 gap-y-0.5 pt-0.5 text-[9px] text-slate-500 font-semibold">
                        {item.manufacturer && (
                          <span>Fab: {item.manufacturer}</span>
                        )}
                        {item.partNumber && (
                          <span>· PN: {item.partNumber}</span>
                        )}
                        {item.supplier && (
                          <span>· Fornec: {item.supplier}</span>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-3 pt-1">
                      <div className="flex items-center border border-slate-200 rounded-lg bg-white overflow-hidden shadow-sm h-8">
                        <button
                          type="button"
                          onClick={() =>
                            updateQuantity(item.productId, item.quantity - 1)
                          }
                          className="px-2.5 h-full text-slate-500 hover:bg-slate-50 hover:text-slate-900 transition-colors font-bold text-base border-r border-slate-200"
                        >
                          -
                        </button>
                        <span className="text-xs font-bold w-8 text-center select-none text-slate-850">
                          {item.quantity}
                        </span>
                        <button
                          type="button"
                          onClick={() =>
                            updateQuantity(item.productId, item.quantity + 1)
                          }
                          className="px-2.5 h-full text-slate-500 hover:bg-slate-50 hover:text-slate-900 transition-colors font-bold text-base border-l border-slate-200"
                        >
                          +
                        </button>
                      </div>
                      <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                        {item.uom}
                      </span>
                    </div>

                    <textarea
                      value={item.notes || ""}
                      onChange={(e) =>
                        updateNotes(item.productId, e.target.value)
                      }
                      placeholder="Adicionar observação (ex: Urgente, Especificação técnica...)"
                      className="w-full text-xs rounded-xl border border-slate-200 px-3 py-2 mt-1 focus:outline-none focus:ring-1 focus:ring-indigo-500 bg-slate-50/50 resize-none h-12 text-slate-650 placeholder:text-slate-400"
                    />
                  </div>
                ))
              )}
            </div>

            {items.length > 0 && (
              <div className="p-6 border-t border-slate-200 bg-slate-50/80 space-y-4 shrink-0">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-600">
                    Total de itens:
                  </span>
                  <span className="text-sm font-bold text-slate-800">
                    {items.length} un.
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <Button
                    variant="outline"
                    onClick={clearCart}
                    className="border-slate-300 hover:bg-slate-100 hover:text-slate-800 font-bold h-10 rounded-xl"
                  >
                    Limpar
                  </Button>
                  <Button
                    onClick={handleFinishQuotation}
                    className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold h-10 rounded-xl flex items-center justify-center gap-1.5 shadow-md shadow-indigo-900/10"
                  >
                    <FileText className="h-4 w-4" />
                    Gerar Prévia
                  </Button>
                </div>
              </div>
            )}
          </div>
        </>
      )}
      {/* Chat lateral retrátil */}
      <ChatDrawer />

      <QuotationTypeModal
        isOpen={isPreviewModalOpen}
        onClose={() => setIsPreviewModalOpen(false)}
        preselectedProductIds={items.map((item) => item.productId)}
        onSubmit={handleSaveQuotation}
      />
    </div>
  );
}

// Mantido para compatibilidade de imports existentes
export function Sidebar() {
  return null;
}
