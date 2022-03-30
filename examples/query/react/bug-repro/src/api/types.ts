export type CartEntry = {
    quantity: number
    subtotal: number
    total: number
    key: string
    id: number
    name: string
    price: number
}

export type Cart = Record<string, CartEntry>
