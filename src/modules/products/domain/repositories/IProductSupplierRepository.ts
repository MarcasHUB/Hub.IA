export interface IProductSupplierRepository {
    linkSuppliers(productId: string, supplierIds: string[]): Promise<void>;
    unlinkSupplier(productId: string, supplierId: string): Promise<void>;
    getSuppliersByProduct(productId: string): Promise<string[]>; // Returns an array of supplier IDs
}
