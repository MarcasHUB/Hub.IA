export interface SearchQueryDTO {
    query: string;
    filters?: {
        categories?: string[];
        suppliers?: string[];
        manufacturers?: string[];
        minPrice?: number;
        maxPrice?: number;
        status?: string[];
    };
    sort?: {
        field: 'price' | 'date' | 'name' | 'supplier';
        order: 'asc' | 'desc';
    };
    page?: number;
    limit?: number;
}