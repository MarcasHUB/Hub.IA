import { useEffect, useRef, useState } from 'react';
import { ArrowLeft, Briefcase, FileText, History, Package, Plus, Save, ShieldCheck, Tags, Truck, Upload, Users } from 'lucide-react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuthenticatedIdentity } from '@/modules/auth/presentation/hooks/useAuthenticatedIdentity';
import { ActionModal } from '@/shared/components/ui/ActionModal';
import { Button } from '@/shared/components/ui/Button';
import { Input } from '@/shared/components/ui/Input';
import { Label } from '@/shared/components/ui/Label';
import { supabase } from '@/infrastructure/supabase/client';
import { SupabaseCategoryRepository } from '../../../categories/infrastructure/repositories/SupabaseCategoryRepository';
import { canMaintainGlobalMaster } from '../../application/policies/materialSaveIntegrity';
import {
  getLegacyAttachments,
  getMissingGlobalIdentificationFields,
  getPrimaryAttachment,
  calculateGlobalEnrichmentPercentage,
  needsManufacturerPairGuidance,
  replacePrimaryAttachment,
  resolveProductStatusForSave,
  type ProductAttachment,
  validateBasicProductInput,
} from '../../application/policies/productFormUx';
import { Product, ProductStatus } from '../../domain/entities/Product';
import {
  SupabaseProductRepository,
  type OrganizationMaterialSaveInput,
} from '../../infrastructure/repositories/SupabaseProductRepository';
import { SupabaseProductSupplierRepository } from '../../infrastructure/repositories/SupabaseProductSupplierRepository';
import { LinkSupplierModal } from '../components/LinkSupplierModal';

const repo = new SupabaseProductRepository();
const productSupplierRepo = new SupabaseProductSupplierRepository();
const categoryRepo = new SupabaseCategoryRepository();

const normalizeCatalogKey = (value: string) => value
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .trim()
  .replace(/\s+/g, ' ')
  .toLowerCase();

const normalizeManufacturerCode = (value: string) => value.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');

const acceptedPrimaryFileTypes = new Set(['application/pdf', 'image/jpeg', 'image/png']);
const configValue = (value: unknown): string => value === null || value === undefined ? '' : String(value);

export default function ProductFormPage({
  productId,
  onClose,
  onSaveSuccess,
  masterMaintenanceMode = false,
}: {
  productId?: string;
  onClose?: () => void;
  onSaveSuccess?: () => void;
  masterMaintenanceMode?: boolean;
} = {}) {
  const navigate = useNavigate();
  const { data: identity } = useAuthenticatedIdentity();
  const tenantId = identity?.organizationId || '';
  const { id: routeId } = useParams();
  const id = productId || routeId;
  const isEditing = Boolean(id);
  const canEditGlobalMaterial = canMaintainGlobalMaster(identity?.isPlatformAdmin, masterMaintenanceMode);
  const primaryFileInputRef = useRef<HTMLInputElement>(null);
  const [activeTab, setActiveTab] = useState('basic');

  const [basicInfo, setBasicInfo] = useState({
    name: '',
    companyInternalCode: '',
    manufacturer: '',
    description: '',
    status: 'Active',
    imageUrl: '',
    manufacturerCode: '',
    technicalDescription: '',
    availableForPurchase: true,
    availableForSale: false,
    materialId: '',
  });
  const [businessModel, setBusinessModel] = useState<'manufacturer' | 'reseller' | 'both'>('reseller');
  const [classification, setClassification] = useState({ category: '', baseUom: 'UN' });
  const [masterInfo, setMasterInfo] = useState({
    officialName: '',
    manufacturer: '',
    manufacturerCode: '',
    description: '',
    categoryName: '',
  });
  const [commercial, setCommercial] = useState({
    costCenter: '',
    targetPrice: '',
    moq: '',
    multiple: '',
  });
  const [logistics, setLogistics] = useState({
    grossWeight: '',
    netWeight: '',
    width: '',
    height: '',
    length: '',
    leadTime: '',
    storage: '',
  });
  const [persistedCommercialConfig, setPersistedCommercialConfig] = useState<Record<string, unknown>>({});
  const [persistedLogisticsConfig, setPersistedLogisticsConfig] = useState<Record<string, unknown>>({});
  const [persistedRelationshipType, setPersistedRelationshipType] = useState<OrganizationMaterialSaveInput['relationshipType']>();
  const [persistedProductSku, setPersistedProductSku] = useState('');
  const [persistedCompanyInternalCode, setPersistedCompanyInternalCode] = useState('');
  const [suppliers, setSuppliers] = useState<{ id: string; name: string; document: string }[]>([]);
  const [isLinkModalOpen, setIsLinkModalOpen] = useState(false);
  const [availableCategories, setAvailableCategories] = useState<{ id: string; name: string }[]>([]);
  const [attachmentsList, setAttachmentsList] = useState<ProductAttachment[]>([]);
  const [similarProduct, setSimilarProduct] = useState<Product | null>(null);
  const [isSimilarModalOpen, setIsSimilarModalOpen] = useState(false);
  const [isCancelModalOpen, setIsCancelModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const primaryAttachment = getPrimaryAttachment(attachmentsList);
  const legacyAttachments = getLegacyAttachments(attachmentsList);
  const missingGlobalIdentificationFields = getMissingGlobalIdentificationFields({
    name: basicInfo.name,
    categoryId: classification.category,
    unit: classification.baseUom,
    manufacturer: basicInfo.manufacturer,
    manufacturerCode: basicInfo.manufacturerCode,
  });
  const globalEnrichmentPercentage = calculateGlobalEnrichmentPercentage({
    name: basicInfo.name,
    categoryId: classification.category,
    unit: classification.baseUom,
    manufacturer: basicInfo.manufacturer,
    manufacturerCode: basicInfo.manufacturerCode,
    description: basicInfo.description,
    hasAttachment: attachmentsList.length > 0,
  });
  const showManufacturerPairGuidance = needsManufacturerPairGuidance(
    basicInfo.manufacturer,
    basicInfo.manufacturerCode,
  );

  const closeForm = () => {
    if (onClose) onClose();
    else navigate('/products');
  };

  const handlePrimaryFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!acceptedPrimaryFileTypes.has(file.type)) {
      alert('Selecione um arquivo PDF, JPG, JPEG ou PNG.');
      event.target.value = '';
      return;
    }

    const reader = new FileReader();
    reader.onloadend = () => {
      const base64 = reader.result as string;
      const nextAttachment: ProductAttachment = {
        type: 'Arquivo principal',
        filename: file.name,
        base64,
        uploadedAt: new Date().toISOString(),
        user: identity?.fullName || 'Usuário atual',
      };
      setAttachmentsList(current => replacePrimaryAttachment(current, nextAttachment));
      if (file.type.startsWith('image/')) {
        setBasicInfo(current => ({ ...current, imageUrl: base64 }));
      }
    };
    reader.readAsDataURL(file);
  };

  useEffect(() => {
    if (
      isEditing
      || !basicInfo.manufacturer.trim()
      || basicInfo.manufacturerCode.trim().length < 3
    ) return;

    const timer = setTimeout(async () => {
      try {
        const { data: materials, error } = await supabase
          .from('materials')
          .select('id, official_name, description, unit, manufacturer_code, normalized_manufacturer_code, manufacturers!inner(name, normalized_name)')
          .eq('normalized_manufacturer_code', normalizeManufacturerCode(basicInfo.manufacturerCode))
          .eq('manufacturers.normalized_name', normalizeCatalogKey(basicInfo.manufacturer))
          .limit(2);
        if (error) throw error;

        const match = materials?.find(
          material => material.normalized_manufacturer_code === normalizeManufacturerCode(basicInfo.manufacturerCode),
        );
        if (match && match.id !== basicInfo.materialId) {
          const manufacturerRelation = Array.isArray(match.manufacturers)
            ? match.manufacturers[0]
            : match.manufacturers;
          setSimilarProduct(new Product(
            match.id,
            tenantId,
            '',
            '',
            match.official_name,
            match.description || '',
            '',
            match.unit || 'UN',
            manufacturerRelation?.name || '',
            0,
            ProductStatus.ACTIVE,
            match.id,
            new Date(),
            new Date(),
            undefined,
            match.manufacturer_code,
          ));
          setIsSimilarModalOpen(true);
        }
      } catch (error) {
        console.error('Falha ao buscar produtos semelhantes', error);
      }
    }, 800);

    return () => clearTimeout(timer);
  }, [
    basicInfo.manufacturer,
    basicInfo.manufacturerCode,
    basicInfo.materialId,
    isEditing,
    tenantId,
  ]);

  useEffect(() => {
    if (!tenantId) return;

    async function loadData() {
      try {
        const categories = await categoryRepo.findAll(tenantId);
        setAvailableCategories(
          categories
            .filter(category => category.status === 'Active')
            .map(category => ({ id: category.id, name: category.name })),
        );
      } catch (error) {
        console.error('Falha ao carregar categorias', error);
      }

      try {
        const { data: organization } = await supabase
          .from('organizations')
          .select('business_model')
          .eq('id', tenantId)
          .maybeSingle();
        if (organization?.business_model) {
          setBusinessModel(organization.business_model as 'manufacturer' | 'reseller' | 'both');
        }
      } catch (error) {
        console.error('Falha ao carregar perfil da empresa', error);
      }

      if (!isEditing || !id) return;

      try {
        const product = await repo.findById(id, tenantId);
        if (!product) return;

        setBasicInfo(current => ({
          ...current,
          name: product.name || '',
          manufacturer: product.manufacturer || '',
          manufacturerCode: product.manufacturerCode || '',
          technicalDescription: product.technicalDescription || '',
          description: product.description || '',
          imageUrl: product.imageUrl || '',
          availableForPurchase: product.availableForPurchase ?? true,
          availableForSale: product.availableForSale ?? false,
          status: product.status === ProductStatus.DRAFT ? 'Draft' : 'Active',
          materialId: product.materialId || '',
        }));
        setPersistedProductSku(product.sku || '');
        setClassification({
          category: product.categoryId || '',
          baseUom: product.uom || 'UN',
        });
        setCommercial(current => ({
          ...current,
          targetPrice: product.price?.toString() || '',
        }));
        if (Array.isArray(product.attachments)) {
          setAttachmentsList(product.attachments as ProductAttachment[]);
        }

        if (product.materialId) {
          const { data: organizationMaterial, error: organizationMaterialError } = await supabase
            .from('organization_materials')
            .select('internal_sku, commercial_config, logistics_config, relationship_type')
            .eq('organization_id', tenantId)
            .eq('material_id', product.materialId)
            .maybeSingle();
          if (organizationMaterialError) throw organizationMaterialError;
          if (organizationMaterial) {
            setPersistedCompanyInternalCode(organizationMaterial.internal_sku || '');
            setBasicInfo(current => ({
              ...current,
              companyInternalCode: organizationMaterial.internal_sku || '',
            }));
            const commercialConfig = (organizationMaterial.commercial_config || {}) as Record<string, unknown>;
            const logisticsConfig = (organizationMaterial.logistics_config || {}) as Record<string, unknown>;
            setPersistedCommercialConfig(commercialConfig);
            setPersistedLogisticsConfig(logisticsConfig);
            setPersistedRelationshipType(
              organizationMaterial.relationship_type as OrganizationMaterialSaveInput['relationshipType'],
            );
            setCommercial(current => ({
              ...current,
              costCenter: configValue(commercialConfig.costCenter),
              targetPrice: configValue(commercialConfig.targetPrice ?? product.price),
              moq: configValue(commercialConfig.moq),
              multiple: configValue(commercialConfig.multiple),
            }));
            setLogistics(current => ({
              ...current,
              grossWeight: configValue(logisticsConfig.grossWeight),
              netWeight: configValue(logisticsConfig.netWeight),
              width: configValue(logisticsConfig.width),
              height: configValue(logisticsConfig.height),
              length: configValue(logisticsConfig.length),
              leadTime: configValue(logisticsConfig.leadTime),
              storage: configValue(logisticsConfig.storage),
            }));
          }

          const { data: material, error } = await supabase
            .from('materials')
            .select('official_name, description, manufacturer_code, manufacturers(name), categories(name)')
            .eq('id', product.materialId)
            .maybeSingle();
          if (error) throw error;
          if (material) {
            const manufacturerRelation = Array.isArray(material.manufacturers)
              ? material.manufacturers[0]
              : material.manufacturers;
            const categoryRelation = Array.isArray(material.categories)
              ? material.categories[0]
              : material.categories;
            setMasterInfo({
              officialName: material.official_name || '',
              manufacturer: manufacturerRelation?.name || '',
              manufacturerCode: material.manufacturer_code || '',
              description: material.description || '',
              categoryName: categoryRelation?.name || '',
            });
          }
        }
      } catch (error) {
        console.error('Falha ao carregar produto', error);
      }
    }

    void loadData();
  }, [id, isEditing, tenantId]);

  const handleSave = async () => {
    const missingFields = validateBasicProductInput({
      name: basicInfo.name,
      categoryId: classification.category,
      unit: classification.baseUom,
    });
    if (missingFields.length > 0) {
      alert(`Preencha os campos obrigatórios: ${missingFields.join(', ')}.`);
      return;
    }
    if (!tenantId) {
      alert('Não foi possível identificar a empresa ativa.');
      return;
    }

    setSaving(true);
    try {
      let materialId = basicInfo.materialId;
      let materialCreatedForSave = false;

      if (!materialId && missingGlobalIdentificationFields.length === 0) {
        const normalizedManufacturer = normalizeCatalogKey(basicInfo.manufacturer);
        const normalizedCode = normalizeManufacturerCode(basicInfo.manufacturerCode);
        const { data: manufacturer, error: manufacturerError } = await supabase
          .from('manufacturers')
          .select('id')
          .eq('normalized_name', normalizedManufacturer)
          .maybeSingle();
        if (manufacturerError) throw manufacturerError;
        if (manufacturer) {
          const { data: existingMaterial, error: existingMaterialError } = await supabase
            .from('materials')
            .select('id')
            .eq('manufacturer_id', manufacturer.id)
            .eq('normalized_manufacturer_code', normalizedCode)
            .is('merged_into_material_id', null)
            .maybeSingle();
          if (existingMaterialError) throw existingMaterialError;

          if (existingMaterial) {
            materialId = existingMaterial.id;
          } else {
            const { data: authData, error: authError } = await supabase.auth.getUser();
            if (authError) throw authError;
            if (!authData.user) throw new Error('Sessão autenticada não encontrada.');

            const { data: createdMaterial, error: materialError } = await supabase
              .from('materials')
              .insert({
                official_name: basicInfo.name.trim(),
                normalized_official_name: normalizeCatalogKey(basicInfo.name),
                description: basicInfo.description.trim() || null,
                unit: classification.baseUom.trim().toUpperCase(),
                manufacturer_id: manufacturer.id,
                manufacturer_code: basicInfo.manufacturerCode.trim(),
                category_id: classification.category,
                validation_status: 'pending_review',
                visibility: 'shared',
                created_source: 'manual',
                master_owner_organization_id: tenantId,
                created_by: authData.user.id,
                is_active: true,
              })
              .select('id')
              .single();
            if (materialError) throw materialError;
            materialId = createdMaterial.id;
            materialCreatedForSave = true;
          }

          setBasicInfo(current => ({ ...current, materialId }));
        }
      }

      const statusToSave = resolveProductStatusForSave(
        basicInfo.status,
        materialId,
        missingGlobalIdentificationFields.length === 0,
      );
      const product = new Product(
        isEditing && id ? id : crypto.randomUUID(),
        tenantId,
        suppliers[0]?.id || '',
        classification.category,
        basicInfo.name.trim(),
        basicInfo.description.trim(),
        persistedProductSku,
        classification.baseUom.trim().toUpperCase(),
        basicInfo.manufacturer.trim(),
        Number(commercial.targetPrice) || 0,
        statusToSave === 'Draft' ? ProductStatus.DRAFT : ProductStatus.ACTIVE,
        materialId || undefined,
        new Date(),
        new Date(),
        undefined,
        basicInfo.manufacturerCode.trim(),
        basicInfo.availableForPurchase,
        basicInfo.availableForSale,
        basicInfo.imageUrl,
        basicInfo.technicalDescription,
        attachmentsList,
      );

      const relationshipType = persistedRelationshipType || (businessModel === 'manufacturer'
        ? 'fabricante'
        : businessModel === 'reseller'
          ? 'revendedor'
          : 'fornecedor');

      await repo.saveTenantMaterial(product, materialId ? {
        internalSku: basicInfo.companyInternalCode,
        internalSkuProvided: basicInfo.companyInternalCode.trim() !== persistedCompanyInternalCode.trim(),
        displayName: basicInfo.name,
        isActive: statusToSave !== 'Draft',
        commercialConfig: { ...persistedCommercialConfig, ...commercial },
        logisticsConfig: { ...persistedLogisticsConfig, ...logistics },
        relationshipType,
      } : undefined);

      if (suppliers.length > 0) {
        await productSupplierRepo.linkSuppliers(product.id, suppliers.map(supplier => supplier.id));
      }

      if (canEditGlobalMaterial && materialId && isEditing && !materialCreatedForSave) {
        const normalizedMasterManufacturer = normalizeCatalogKey(masterInfo.manufacturer);
        const normalizedMasterCode = normalizeManufacturerCode(masterInfo.manufacturerCode);
        if (Boolean(normalizedMasterManufacturer) !== Boolean(normalizedMasterCode)) {
          throw new Error('Fabricante e código do fabricante devem ser informados em conjunto na governança do catálogo.');
        }

        let manufacturerId: string | null = null;
        if (normalizedMasterManufacturer && normalizedMasterCode) {
          const { data: manufacturer, error } = await supabase
            .from('manufacturers')
            .select('id')
            .eq('normalized_name', normalizedMasterManufacturer)
            .maybeSingle();
          if (error) throw error;
          if (!manufacturer) throw new Error('Fabricante não encontrado na área administrativa.');
          manufacturerId = manufacturer.id;
        }

        const { data: oldMaterial, error: oldMaterialError } = await supabase
          .from('materials')
          .select('id, official_name, description, manufacturer_id, manufacturer_code, category_id, updated_at')
          .eq('id', materialId)
          .maybeSingle();
        if (oldMaterialError) throw oldMaterialError;

        const { error: updateError } = await supabase
          .from('materials')
          .update({
            official_name: masterInfo.officialName,
            manufacturer_id: manufacturerId,
            manufacturer_code: normalizedMasterCode || null,
            description: masterInfo.description || null,
          })
          .eq('id', materialId);
        if (updateError) throw updateError;

        const { data: authData } = await supabase.auth.getUser();
        await supabase.from('audit_logs').insert({
          action: 'UPDATE',
          entity_name: 'materials',
          entity_id: materialId,
          user_id: authData?.user?.id || null,
          organization_id: tenantId,
          old_data: oldMaterial || {},
          new_data: {
            official_name: masterInfo.officialName,
            manufacturer_id: manufacturerId,
            manufacturer_code: normalizedMasterCode || null,
            manufacturer_name: masterInfo.manufacturer,
            description: masterInfo.description,
          },
          details: 'Edição do catálogo global pelo ADM GLOBAL',
        });
      }

      if (onSaveSuccess) onSaveSuccess();
      else navigate('/products');
    } catch (error) {
      console.error(error);
      const message = error && typeof error === 'object' && 'message' in error
        ? String(error.message)
        : 'Erro desconhecido.';
      alert(`Erro ao salvar produto: ${message}`);
    } finally {
      setSaving(false);
    }
  };

  const tabs = [
    { id: 'basic', label: 'Informações Básicas', icon: Package },
    { id: 'classification', label: 'Classificação', icon: Tags },
    { id: 'commercial', label: 'Comercial', icon: Briefcase },
    { id: 'logistics', label: 'Logística', icon: Truck },
    { id: 'suppliers', label: 'Base de Abastecimento do Material', icon: Users },
    { id: 'documents', label: 'Documentos', icon: FileText },
    { id: 'history', label: 'Histórico', icon: History },
  ];
  const selectedCategoryName = availableCategories.find(category => category.id === classification.category)?.name;

  return (
    <div className={`flex-1 flex flex-col font-sans ${onClose ? '' : 'bg-slate-50 min-h-full'}`}>
      {!onClose && (
        <div className="bg-slate-900 rounded-[2rem] mx-4 sm:mx-6 mt-6 mb-4 px-6 pt-8 pb-8 shadow-xl">
          <div className="max-w-[1600px] mx-auto">
            <button onClick={closeForm} className="flex items-center text-slate-400 hover:text-white transition-colors text-sm font-medium mb-4">
              <ArrowLeft className="h-4 w-4 mr-1" /> Voltar para Catálogo
            </button>
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white flex items-center gap-3">
                  {isEditing ? 'Editar Material' : 'Cadastrar produto'}
                </h1>
                <p className="text-slate-400 mt-1 text-sm max-w-2xl">Cadastre as informações do produto e complemente os dados nas abas quando necessário.</p>
              </div>
              <Button onClick={closeForm} className="bg-slate-800 hover:bg-slate-700 text-white border border-slate-700 h-10 px-5 font-bold">Voltar</Button>
            </div>
          </div>
        </div>
      )}

      <div className={`flex-1 ${onClose ? 'p-6' : 'px-4 sm:px-6 pb-12'}`}>
        <div className={`mx-auto flex flex-col gap-6 ${onClose ? 'w-full' : 'max-w-[1600px]'}`}>
          <div className="flex flex-wrap border-b border-slate-200 gap-y-2 gap-x-4 sm:gap-x-6 w-full px-2">
            {tabs.map(tab => (
              <button key={tab.id} onClick={() => setActiveTab(tab.id)} className={`pb-2 sm:pb-3 text-sm font-bold border-b-2 transition-all flex items-center gap-2 whitespace-nowrap ${activeTab === tab.id ? 'border-indigo-600 text-indigo-900' : 'border-transparent text-slate-400 hover:text-slate-600'}`}>
                <tab.icon className={`h-4 w-4 ${activeTab === tab.id ? 'text-indigo-600' : 'text-slate-400'}`} />{tab.label}
              </button>
            ))}
          </div>

          <div className="flex-1 bg-white rounded-2xl border border-slate-200 shadow-sm p-6 sm:p-8 min-h-[500px]">
            {activeTab === 'basic' && (
              <div className="space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-300">
                <div className="border-b border-slate-100 pb-4"><h3 className="text-lg font-bold text-slate-900">Informações Básicas</h3><p className="text-sm text-slate-500">Somente os campos marcados com * são obrigatórios.</p></div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2 md:col-span-2"><Label htmlFor="product-name">Nome do produto/material *</Label><Input id="product-name" value={basicInfo.name} onChange={event => setBasicInfo(current => ({ ...current, name: event.target.value }))} placeholder="Ex: Chave de impacto 1200 Nm" /></div>
                  <div className="space-y-2"><Label htmlFor="product-category">Categoria *</Label><select id="product-category" value={classification.category} onChange={event => setClassification(current => ({ ...current, category: event.target.value }))} className="flex h-10 w-full rounded-md border border-slate-200 bg-white px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-slate-950"><option value="">Selecione...</option>{availableCategories.map(category => <option key={category.id} value={category.id}>{category.name}</option>)}</select></div>
                  <div className="space-y-2"><Label htmlFor="product-unit">Unidade *</Label><Input id="product-unit" value={classification.baseUom} onChange={event => setClassification(current => ({ ...current, baseUom: event.target.value }))} placeholder="UN, KG, CX..." /></div>
                  <div className="space-y-2"><Label htmlFor="product-manufacturer">Fabricante/Marca *</Label><Input id="product-manufacturer" value={basicInfo.manufacturer} onChange={event => setBasicInfo(current => ({ ...current, manufacturer: event.target.value }))} placeholder="Informe o fabricante ou a marca" /></div>
                  <div className="space-y-2"><Label htmlFor="product-part-number">Código do fabricante / SKU do fabricante *</Label><Input id="product-part-number" value={basicInfo.manufacturerCode} onChange={event => setBasicInfo(current => ({ ...current, manufacturerCode: event.target.value }))} placeholder="Informe o código do fabricante" /></div>
                  {showManufacturerPairGuidance && <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800 md:col-span-2">Para localizar correspondências com mais precisão, informe fabricante e código do fabricante juntos.</p>}
                  <div className="space-y-2 md:col-span-2"><Label htmlFor="company-internal-code">Código interno da empresa</Label><Input id="company-internal-code" value={basicInfo.companyInternalCode} onChange={event => setBasicInfo(current => ({ ...current, companyInternalCode: event.target.value }))} placeholder="Opcional" disabled={!basicInfo.materialId} /><p className="text-xs text-slate-500">Código usado por esta empresa para identificar o produto em suas operações de compra ou venda.</p>{!basicInfo.materialId && <p className="text-xs text-amber-700">Disponível após o produto ser vinculado ao catálogo global.</p>}</div>
                  <div className="flex flex-wrap items-end gap-3 rounded-xl border border-slate-100 bg-slate-50 p-3"><label className="flex h-9 cursor-pointer items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-xs font-medium text-slate-700"><input type="checkbox" checked={basicInfo.availableForPurchase} onChange={event => setBasicInfo(current => ({ ...current, availableForPurchase: event.target.checked }))} className="h-4 w-4 rounded border-slate-300 text-indigo-600" />Compra este produto</label><label className="flex h-9 cursor-pointer items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-xs font-medium text-slate-700"><input type="checkbox" checked={basicInfo.availableForSale} onChange={event => setBasicInfo(current => ({ ...current, availableForSale: event.target.checked }))} className="h-4 w-4 rounded border-slate-300 text-indigo-600" />Vende este produto</label></div>
                  <div className="space-y-2 md:col-span-2"><Label htmlFor="product-description">Descrição curta</Label><textarea id="product-description" value={basicInfo.description} onChange={event => setBasicInfo(current => ({ ...current, description: event.target.value }))} maxLength={500} placeholder="Características importantes para reconhecer o produto." className="min-h-20 w-full resize-y rounded-lg border border-slate-300 bg-white p-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" /></div>
                </div>
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4"><div className="flex items-center justify-between gap-4"><div><p className="text-sm font-bold text-slate-800">Enriquecimento do cadastro global</p><p className="mt-1 text-xs text-slate-500">{missingGlobalIdentificationFields.length === 0 ? 'Identificação mínima completa.' : `Faltam: ${missingGlobalIdentificationFields.join(', ')}.`}</p></div><span className="text-lg font-extrabold text-indigo-700">{globalEnrichmentPercentage}%</span></div></div>
                {canEditGlobalMaterial && (
                  <div className="rounded-xl border border-violet-200 bg-violet-50/50 p-5">
                    <h4 className="flex items-center gap-2 text-sm font-bold text-violet-950"><ShieldCheck className="h-4 w-4" /> Governança do catálogo — Admin Global</h4>
                    <p className="mt-2 text-xs font-bold uppercase tracking-wide text-violet-700">Status técnico: {basicInfo.materialId ? 'Material global vinculado' : 'Material Global Pendente'}</p>
                    {basicInfo.materialId && <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2"><div className="space-y-2 md:col-span-2"><Label>Nome oficial</Label><Input value={masterInfo.officialName} onChange={event => setMasterInfo(current => ({ ...current, officialName: event.target.value }))} /></div><div className="space-y-2"><Label>Fabricante</Label><Input value={masterInfo.manufacturer} onChange={event => setMasterInfo(current => ({ ...current, manufacturer: event.target.value }))} /></div><div className="space-y-2"><Label>Código do fabricante</Label><Input value={masterInfo.manufacturerCode} onChange={event => setMasterInfo(current => ({ ...current, manufacturerCode: event.target.value }))} /></div><div className="space-y-2 md:col-span-2"><Label>Descrição oficial</Label><textarea value={masterInfo.description} onChange={event => setMasterInfo(current => ({ ...current, description: event.target.value }))} className="min-h-20 w-full rounded-lg border border-violet-200 bg-white p-3 text-sm" /></div></div>}
                  </div>
                )}
              </div>
            )}

            {activeTab === 'classification' && <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300"><div className="border-b border-slate-100 pb-4"><h3 className="text-lg font-bold text-slate-900">Classificação</h3><p className="text-sm text-slate-500">A categoria principal é definida em Informações Básicas.</p></div><div className="rounded-xl border border-slate-200 bg-slate-50 p-5"><p className="text-xs font-bold uppercase tracking-wide text-slate-400">Categoria selecionada</p><p className="mt-1 font-semibold text-slate-800">{selectedCategoryName || 'Nenhuma categoria selecionada'}</p><p className="mt-3 text-xs text-slate-500">Classificações internas ou legadas permanecem preservadas quando existirem.</p></div></div>}

            {activeTab === 'commercial' && <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300"><div className="border-b border-slate-100 pb-4"><h3 className="text-lg font-bold text-slate-900">Comercial e Compras</h3><p className="text-sm text-slate-500">Parâmetros opcionais de aquisição e comercialização.</p></div><div className="grid grid-cols-1 md:grid-cols-2 gap-6"><div className="space-y-2"><Label>Centro de Custo Padrão</Label><Input value={commercial.costCenter} onChange={event => setCommercial(current => ({ ...current, costCenter: event.target.value }))} /></div><div className="space-y-2"><Label>Preço/Custo (R$)</Label><Input type="number" value={commercial.targetPrice} onChange={event => setCommercial(current => ({ ...current, targetPrice: event.target.value }))} /></div><div className="space-y-2"><Label>Quantidade mínima</Label><Input type="number" value={commercial.moq} onChange={event => setCommercial(current => ({ ...current, moq: event.target.value }))} /></div><div className="space-y-2"><Label>Lote múltiplo</Label><Input type="number" value={commercial.multiple} onChange={event => setCommercial(current => ({ ...current, multiple: event.target.value }))} /></div></div></div>}

            {activeTab === 'logistics' && (
              <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
                <div className="border-b border-slate-100 pb-4"><h3 className="text-lg font-bold text-slate-900">Logística</h3><p className="text-sm text-slate-500">Dados opcionais de peso, dimensão e armazenagem.</p></div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="space-y-2"><Label>Peso Bruto (Kg)</Label><Input value={logistics.grossWeight} onChange={event => setLogistics(current => ({ ...current, grossWeight: event.target.value }))} /></div>
                  <div className="space-y-2"><Label>Peso Líquido (Kg)</Label><Input value={logistics.netWeight} onChange={event => setLogistics(current => ({ ...current, netWeight: event.target.value }))} /></div>
                  <div className="space-y-2"><Label>Prazo padrão (dias)</Label><Input value={logistics.leadTime} onChange={event => setLogistics(current => ({ ...current, leadTime: event.target.value }))} /></div>
                  <div className="space-y-2"><Label>Largura (cm)</Label><Input value={logistics.width} onChange={event => setLogistics(current => ({ ...current, width: event.target.value }))} /></div>
                  <div className="space-y-2"><Label>Altura (cm)</Label><Input value={logistics.height} onChange={event => setLogistics(current => ({ ...current, height: event.target.value }))} /></div>
                  <div className="space-y-2"><Label>Comprimento (cm)</Label><Input value={logistics.length} onChange={event => setLogistics(current => ({ ...current, length: event.target.value }))} /></div>
                  <div className="space-y-2 md:col-span-3"><Label>Armazenagem</Label><textarea value={logistics.storage} onChange={event => setLogistics(current => ({ ...current, storage: event.target.value }))} className="min-h-20 w-full rounded-lg border border-slate-300 p-3 text-sm" /></div>
                </div>
              </div>
            )}

            {activeTab === 'suppliers' && <div className="animate-in fade-in slide-in-from-bottom-2 duration-300"><div className="flex justify-between items-center mb-6"><div><h3 className="text-lg font-bold text-slate-900">Base de Abastecimento</h3><p className="text-sm text-slate-500">Fornecedores vinculados a este produto.</p></div><Button onClick={() => setIsLinkModalOpen(true)} className="bg-indigo-600 hover:bg-indigo-700 text-white"><Plus className="h-4 w-4 mr-2" /> Vincular Fornecedor</Button></div>{suppliers.length === 0 ? <div className="py-12 text-center border-2 border-dashed border-slate-200 rounded-xl bg-slate-50"><Users className="h-10 w-10 text-slate-300 mx-auto mb-3" /><h4 className="text-sm font-medium text-slate-900">Base de Abastecimento Vazia</h4><p className="text-sm text-slate-500 mt-1">Nenhum fornecedor vinculado a este produto.</p></div> : <div className="border rounded-xl bg-white overflow-hidden overflow-x-auto"><table className="w-full text-sm text-left whitespace-nowrap"><thead className="bg-slate-50 border-b text-slate-600"><tr><th className="px-4 py-3">Fornecedor</th><th className="px-4 py-3">Documento</th><th className="px-4 py-3 text-right">Ações</th></tr></thead><tbody className="divide-y">{suppliers.map(supplier => <tr key={supplier.id}><td className="px-4 py-3 font-medium text-slate-900">{supplier.name}</td><td className="px-4 py-3 text-slate-500">{supplier.document || '-'}</td><td className="px-4 py-3 text-right"><Button variant="outline" size="sm" onClick={async () => { if (isEditing && id) await productSupplierRepo.unlinkSupplier(id, supplier.id); setSuppliers(current => current.filter(item => item.id !== supplier.id)); }}>Desvincular</Button></td></tr>)}</tbody></table></div>}</div>}

            {activeTab === 'documents' && (
              <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
                <div className="mb-6">
                  <h3 className="text-lg font-bold text-slate-900">Documentos Técnicos</h3>
                  <p className="text-sm text-slate-500">Um arquivo principal e os anexos anteriores deste produto.</p>
                </div>
                <button
                  type="button"
                  onClick={() => primaryFileInputRef.current?.click()}
                  className="flex w-full flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-slate-200 bg-slate-50 px-5 py-7 text-center text-slate-600 hover:border-indigo-300 hover:bg-indigo-50"
                >
                  <span className="flex items-center justify-center gap-2 text-sm font-bold">
                    <Upload className="h-5 w-5 text-indigo-500" />
                    {primaryAttachment ? 'Substituir arquivo principal' : 'Selecionar arquivo principal'}
                  </span>
                  <span className="text-xs font-normal text-slate-500">PDF, JPG, JPEG ou PNG</span>
                </button>
                <input ref={primaryFileInputRef} type="file" className="hidden" accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png" onChange={handlePrimaryFileUpload} />
                {primaryAttachment && (
                  <div className="mt-4 flex items-center justify-between rounded-lg border border-indigo-100 bg-indigo-50 px-4 py-3">
                    <div><p className="text-sm font-bold text-indigo-900">{primaryAttachment.filename}</p><p className="text-xs text-indigo-600">Arquivo principal · {primaryAttachment.base64.startsWith('data:application/pdf') ? 'PDF' : 'Imagem'}</p></div>
                    <a href={primaryAttachment.base64} target="_blank" rel="noreferrer" className="text-xs font-bold text-indigo-700">Visualizar</a>
                  </div>
                )}
                {legacyAttachments.length > 0 && (
                  <div className="mt-6">
                    <h4 className="text-sm font-bold text-slate-800">Arquivos anteriores</h4>
                    <div className="mt-3 divide-y rounded-xl border border-slate-200">
                      {legacyAttachments.map((attachment, index) => (
                        <div key={`${attachment.type}-${attachment.filename}-${index}`} className="flex items-center justify-between gap-3 px-4 py-3">
                          <div className="min-w-0"><p className="truncate text-sm font-medium text-slate-800">{attachment.filename}</p><p className="text-[10px] font-bold uppercase text-slate-400">{attachment.type}</p></div>
                          <div className="flex gap-3 text-xs font-bold"><a href={attachment.base64} target="_blank" rel="noreferrer" className="text-indigo-600">Visualizar</a><a href={attachment.base64} download={attachment.filename} className="text-indigo-600">Baixar</a></div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {!primaryAttachment && legacyAttachments.length === 0 && <p className="mt-6 text-center text-sm text-slate-500">Nenhum documento anexado.</p>}
              </div>
            )}

            {activeTab === 'history' && <div className="flex flex-col items-center justify-center py-20 text-center animate-in fade-in slide-in-from-bottom-2 duration-300"><div className="h-16 w-16 bg-slate-50 rounded-full flex items-center justify-center mb-4"><History className="h-8 w-8 text-slate-400" /></div><h3 className="text-lg font-bold text-slate-900 mb-1">Nenhum histórico disponível</h3><p className="text-slate-500 max-w-sm">Eventos reais aparecerão aqui quando o histórico estiver disponível.</p></div>}
          </div>
        </div>

        <div className="max-w-[1600px] mx-auto mt-8 mb-12 flex justify-center sm:justify-end gap-3 flex-wrap">
          <Button variant="outline" onClick={() => setIsCancelModalOpen(true)} className="h-10 px-6 font-bold text-slate-600 bg-white border-slate-200 hover:bg-slate-50">Cancelar</Button>
          <Button onClick={() => void handleSave()} disabled={saving} className="bg-indigo-600 hover:bg-indigo-700 text-white h-10 px-8 font-bold shadow-sm"><Save className="h-4 w-4 mr-2" />{saving ? 'Salvando...' : 'Salvar produto'}</Button>
        </div>
      </div>

      <LinkSupplierModal isOpen={isLinkModalOpen} onClose={() => setIsLinkModalOpen(false)} alreadyLinkedIds={suppliers.map(supplier => supplier.id)} onLink={selected => setSuppliers(current => [...current, ...selected])} />

      <ActionModal
        isOpen={isCancelModalOpen}
        title="Deseja cancelar?"
        description="Todas as alterações não salvas serão perdidas."
        confirmText="Sim, cancelar"
        cancelText="Continuar editando"
        variant="danger"
        onConfirm={closeForm}
        onCancel={() => setIsCancelModalOpen(false)}
      />

      {isSimilarModalOpen && similarProduct && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-6 shadow-xl">
            <div className="text-center">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-amber-100 text-amber-600"><Package className="h-6 w-6" /></div>
              <h3 className="mt-4 text-xl font-bold text-slate-900">Encontramos produtos semelhantes</h3>
              <p className="mt-1 text-sm text-slate-500">Confirme qual corresponde ao seu produto.</p>
            </div>
            <div className="mt-5 rounded-xl border border-slate-200 bg-slate-50 p-4">
              <p className="font-semibold text-slate-900">{similarProduct.name}</p>
              <p className="mt-1 text-xs text-slate-500">Fabricante: {similarProduct.manufacturer || 'Não informado'}</p>
              <p className="text-xs text-slate-500">Código do fabricante: {similarProduct.manufacturerCode || 'Não informado'}</p>
            </div>
            <div className="mt-5 flex flex-col gap-3">
              <Button onClick={() => {
                setBasicInfo(current => ({
                  ...current,
                  materialId: similarProduct.id,
                  manufacturer: similarProduct.manufacturer || current.manufacturer,
                  manufacturerCode: similarProduct.manufacturerCode || current.manufacturerCode,
                }));
                setIsSimilarModalOpen(false);
              }} className="h-11 w-full bg-indigo-600 text-white hover:bg-indigo-700">Usar este produto</Button>
              <button onClick={() => setIsSimilarModalOpen(false)} className="w-full py-2 text-sm font-medium text-slate-500 hover:text-slate-700">Continuar com meu cadastro</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
