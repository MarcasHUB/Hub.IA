import React, { createContext, useContext, useState } from 'react';

export interface CartItem {
    productId: string;
    name: string;
    uom: string;
    quantity: number;
    manufacturer: string;
    category: string;
}

interface QuotationCartContextType {
    items: CartItem[];
    addItem: (item: CartItem) => void;
    removeItem: (productId: string) => void;
    updateQuantity: (productId: string, quantity: number) => void;
    clearCart: () => void;
    isCartOpen: boolean;
    setCartOpen: (open: boolean) => void;
}

const QuotationCartContext = createContext<QuotationCartContextType | undefined>(undefined);

export function QuotationCartProvider({ children }: { children: React.ReactNode }) {
    const [items, setItems] = useState<CartItem[]>([]);
    const [isCartOpen, setCartOpen] = useState(false);

    const addItem = (item: CartItem) => {
        setItems(prev => {
            const exists = prev.find(i => i.productId === item.productId);
            if (exists) {
                return prev.map(i => i.productId === item.productId ? { ...i, quantity: i.quantity + item.quantity } : i);
            }
            return [...prev, item];
        });
        setCartOpen(true);
    };

    const removeItem = (productId: string) => {
        setItems(prev => prev.filter(i => i.productId !== productId));
    };

    const updateQuantity = (productId: string, quantity: number) => {
        if (quantity < 1) return;
        setItems(prev => prev.map(i => i.productId === productId ? { ...i, quantity } : i));
    };

    const clearCart = () => {
        setItems([]);
        setCartOpen(false);
    };

    return (
        <QuotationCartContext.Provider value={{ items, addItem, removeItem, updateQuantity, clearCart, isCartOpen, setCartOpen }}>
            {children}
        </QuotationCartContext.Provider>
    );
}

export function useQuotationCart() {
    const context = useContext(QuotationCartContext);
    if (!context) {
        throw new Error("useQuotationCart must be used within a QuotationCartProvider");
    }
    return context;
}