import { Link } from 'react-router-dom';
import { useCart } from '../../api/cart';
import { useTheme } from '../../context/ThemeContext';

const formatCurrency = (amount: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);

export default function CartPage() {
  const { cartQuery, updateItem, removeItem } = useCart();
  const { darkMode } = useTheme();
  const cart = cartQuery.data;
  const mutationFailed = updateItem.isError || removeItem.isError;

  return (
    <section
      className={`min-h-screen ${darkMode ? 'bg-dark text-light' : 'bg-gray-100 text-gray-800'} pt-24 pb-16 px-4`}
    >
      <div className="max-w-6xl mx-auto">
        <h1 className="text-3xl font-bold mb-2">Your cart</h1>
        <p className={`${darkMode ? 'text-gray-400' : 'text-gray-600'} mb-8`}>
          {cart ? `${cart.itemCount} ${cart.itemCount === 1 ? 'item' : 'items'}` : 'Review your items'}
        </p>

        {cartQuery.isLoading && <p role="status">Loading your cart…</p>}
        {cartQuery.isError && (
          <p role="alert" className="text-red-600">
            Your cart couldn’t be loaded. Check your connection and try again.
          </p>
        )}
        {mutationFailed && (
          <p role="alert" className="text-red-600 mb-4">
            Your cart wasn’t updated. Check your connection and try again.
          </p>
        )}

        {cart && cart.items.length === 0 && (
          <div className={`${darkMode ? 'bg-gray-800' : 'bg-white'} rounded-xl p-8 text-center shadow-sm`}>
            <p className="text-xl font-semibold mb-2">Your cart is empty</p>
            <p className={`${darkMode ? 'text-gray-400' : 'text-gray-600'} mb-6`}>
              Find something to make your cat’s day.
            </p>
            <Link
              to="/products"
              className="inline-flex rounded-lg bg-primary px-5 py-3 font-semibold text-white hover:bg-accent focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
            >
              Browse products
            </Link>
          </div>
        )}

        {cart && cart.items.length > 0 && (
          <div className="grid gap-8 lg:grid-cols-[1fr_20rem]">
            <ul className="space-y-4" aria-label="Cart items">
              {cart.items.map((item) => (
                <li
                  key={item.productId}
                  data-cart-product-id={item.productId}
                  className={`${darkMode ? 'bg-gray-800' : 'bg-white'} rounded-xl p-4 sm:p-6 shadow-sm flex flex-col sm:flex-row sm:items-center gap-5`}
                >
                  <img
                    src={`/${item.imgName ?? 'copilot.png'}`}
                    alt={item.name}
                    className="h-28 w-28 rounded-lg bg-gray-100 object-contain p-2"
                  />
                  <div className="flex-1">
                    <h2 className="text-lg font-semibold">{item.name}</h2>
                    <p className={`${darkMode ? 'text-gray-400' : 'text-gray-600'} text-sm`}>
                      SKU: {item.sku}
                    </p>
                    <p className="mt-2 font-medium">{formatCurrency(item.unitPrice)} each</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      aria-label={`Decrease quantity of ${item.name}`}
                      disabled={item.quantity <= 1 || updateItem.isLoading}
                      onClick={() => updateItem.mutate({ productId: item.productId, quantity: item.quantity - 1 })}
                      className="h-9 w-9 rounded-full border border-gray-400 disabled:opacity-40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"
                    >
                      −
                    </button>
                    <span aria-label={`Quantity of ${item.name}`} className="min-w-8 text-center">
                      {item.quantity}
                    </span>
                    <button
                      type="button"
                      aria-label={`Increase quantity of ${item.name}`}
                      disabled={updateItem.isLoading}
                      onClick={() => updateItem.mutate({ productId: item.productId, quantity: item.quantity + 1 })}
                      className="h-9 w-9 rounded-full border border-gray-400 disabled:opacity-40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"
                    >
                      +
                    </button>
                  </div>
                  <div className="sm:text-right sm:min-w-24">
                    <p className="font-bold">{formatCurrency(item.lineTotal)}</p>
                    <button
                      type="button"
                      disabled={removeItem.isLoading}
                      onClick={() => removeItem.mutate(item.productId)}
                      className="mt-2 text-sm text-red-600 underline hover:text-red-800 disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-600"
                    >
                      Remove {item.name}
                    </button>
                  </div>
                </li>
              ))}
            </ul>

            <aside className={`${darkMode ? 'bg-gray-800' : 'bg-white'} rounded-xl p-6 shadow-sm h-fit`}>
              <h2 className="text-xl font-semibold mb-5">Order summary</h2>
              <div className="flex justify-between border-t border-gray-300 pt-4 text-lg font-bold">
                <span>Cart total</span>
                <span data-testid="cart-total">{formatCurrency(cart.total)}</span>
              </div>
              <p className={`${darkMode ? 'text-gray-400' : 'text-gray-600'} mt-3 text-sm`}>
                Prices reflect current product discounts. Checkout isn’t available yet.
              </p>
            </aside>
          </div>
        )}
      </div>
    </section>
  );
}
