export interface CartItem {
  storybookId: string;
  type: 'digital' | 'print';
  title: string;
  price: number; // Note: Price is stored for display only. Server recalculates based on authoritative price constants during checkout for security.
}

const CART_STORAGE_KEY = 'storybook_cart';

export function getCart(): CartItem[] {
  try {
    const cartData = localStorage.getItem(CART_STORAGE_KEY);
    return cartData ? JSON.parse(cartData) : [];
  } catch (error) {
    console.error('Error reading cart from localStorage:', error);
    return [];
  }
}

export function addToCart(item: CartItem): void {
  try {
    const cart = getCart();
    
    // If adding print, remove digital for same book (print includes digital)
    let updatedCart = cart;
    if (item.type === 'print') {
      updatedCart = cart.filter(
        (cartItem) => !(cartItem.storybookId === item.storybookId && cartItem.type === 'digital')
      );
    }
    
    // If adding digital, check if print already exists
    if (item.type === 'digital' && hasPrintInCart(item.storybookId)) {
      console.log('Cannot add digital when print is already in cart');
      return;
    }
    
    const existingItemIndex = updatedCart.findIndex(
      (cartItem) => cartItem.storybookId === item.storybookId && cartItem.type === item.type
    );

    if (existingItemIndex === -1) {
      updatedCart.push(item);
      localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(updatedCart));
      window.dispatchEvent(new Event('cartUpdated'));
    }
  } catch (error) {
    console.error('Error adding to cart:', error);
  }
}

export function removeFromCart(storybookId: string, type: 'digital' | 'print'): void {
  try {
    const cart = getCart();
    const updatedCart = cart.filter(
      (item) => !(item.storybookId === storybookId && item.type === type)
    );
    localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(updatedCart));
    window.dispatchEvent(new Event('cartUpdated'));
  } catch (error) {
    console.error('Error removing from cart:', error);
  }
}

export function clearCart(): void {
  try {
    localStorage.removeItem(CART_STORAGE_KEY);
  } catch (error) {
    console.error('Error clearing cart:', error);
  }
}

export function isInCart(storybookId: string, type: 'digital' | 'print'): boolean {
  const cart = getCart();
  return cart.some((item) => item.storybookId === storybookId && item.type === type);
}

export function hasPrintInCart(storybookId: string): boolean {
  const cart = getCart();
  return cart.some((item) => item.storybookId === storybookId && item.type === 'print');
}

export function canAddDigitalToCart(storybookId: string): boolean {
  return !hasPrintInCart(storybookId);
}

export function getCartCount(): number {
  return getCart().length;
}
