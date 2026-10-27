import axios from 'axios';
import { useMutation, useQuery, useQueryClient } from 'react-query';
import { api } from './config';

export interface CartItem {
  productId: number;
  name: string;
  imgName: string | null;
  sku: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
}

export interface Cart {
  cartId: string;
  items: CartItem[];
  itemCount: number;
  total: number;
}

interface AddCartItemRequest {
  productId: number;
  quantity: number;
}

interface UpdateCartItemRequest {
  productId: number;
  quantity: number;
}

const CART_QUERY_KEY = ['cart'] as const;
const CART_ID_STORAGE_KEY = 'octocat-cart-id';

const createCart = async (): Promise<Cart> => {
  const { data } = await axios.post<Cart>(`${api.baseURL}${api.endpoints.carts}`);
  localStorage.setItem(CART_ID_STORAGE_KEY, data.cartId);
  return data;
};

const getCartId = async (): Promise<string> => {
  const storedCartId = localStorage.getItem(CART_ID_STORAGE_KEY);
  return storedCartId ?? (await createCart()).cartId;
};

const fetchCart = async (): Promise<Cart> => {
  const cartId = localStorage.getItem(CART_ID_STORAGE_KEY);
  if (!cartId) {
    return createCart();
  }

  try {
    const { data } = await axios.get<Cart>(`${api.baseURL}${api.endpoints.carts}/${cartId}`);
    return data;
  } catch (error) {
    if (axios.isAxiosError(error) && error.response?.status === 404) {
      localStorage.removeItem(CART_ID_STORAGE_KEY);
      return createCart();
    }
    throw error;
  }
};

export function useCart() {
  const queryClient = useQueryClient();
  const cartQuery = useQuery<Cart, Error>(CART_QUERY_KEY, fetchCart);

  const addItem = useMutation<Cart, Error, AddCartItemRequest>(
    async ({ productId, quantity }) => {
      const cartId = await getCartId();
      const { data } = await axios.post<Cart>(
        `${api.baseURL}${api.endpoints.carts}/${cartId}/items`,
        { productId, quantity },
      );
      return data;
    },
    {
      onSuccess: (cart) => {
        queryClient.setQueryData(CART_QUERY_KEY, cart);
      },
    },
  );

  const updateItem = useMutation<Cart, Error, UpdateCartItemRequest>(
    async ({ productId, quantity }) => {
      const cartId = await getCartId();
      const { data } = await axios.put<Cart>(
        `${api.baseURL}${api.endpoints.carts}/${cartId}/items/${productId}`,
        { quantity },
      );
      return data;
    },
    {
      onSuccess: (cart) => {
        queryClient.setQueryData(CART_QUERY_KEY, cart);
      },
    },
  );

  const removeItem = useMutation<void, Error, number>(
    async (productId) => {
      const cartId = await getCartId();
      await axios.delete(`${api.baseURL}${api.endpoints.carts}/${cartId}/items/${productId}`);
    },
    { onSuccess: () => queryClient.invalidateQueries(CART_QUERY_KEY) },
  );

  return { cartQuery, addItem, updateItem, removeItem };
}
