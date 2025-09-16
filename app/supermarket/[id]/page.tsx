"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

interface Product {
  id: string;
  name: string;
  price: number;
  stock: number;
  image_url: string;
  description?: string;
  category?: string;
}

interface CartItem {
  product: Product;
  quantity: number;
}

interface OrderItem {
  product_id: string;
  quantity: number;
  price: number;
}

interface Order {
  id: string;
  total_amount: number;
  status: string;
  created_at: string;
  order_items?: OrderItem[];
}

interface Props {
  params: { id: string };
}

type SortOption = "priceAsc" | "priceDesc" | "stock";

export default function SupermarketPage({ params }: Props) {
  const supermarketId = params.id;
  const [products, setProducts] = useState<Product[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [sortOption, setSortOption] = useState<SortOption>("priceAsc");

  // Load cart from localStorage
  useEffect(() => {
    const storedCart = localStorage.getItem(`cart_${supermarketId}`);
    if (storedCart) setCart(JSON.parse(storedCart));
  }, [supermarketId]);

  // Save cart to localStorage
  useEffect(() => {
    localStorage.setItem(`cart_${supermarketId}`, JSON.stringify(cart));
  }, [cart, supermarketId]);

  // Fetch products
  useEffect(() => {
    const fetchProducts = async () => {
      try {
        setLoading(true);
        const { data, error } = await supabase
          .from("products")
          .select("*")
          .eq("supermarket_id", supermarketId);
        if (error) throw error;
        setProducts(data || []);
      } catch (err: any) {
        setError(err.message || "Failed to fetch products");
      } finally {
        setLoading(false);
      }
    };
    fetchProducts();
  }, [supermarketId]);

  // Fetch orders
  useEffect(() => {
    const fetchOrders = async () => {
      try {
        const { data, error } = await supabase
          .from("orders")
          .select("*, order_items(*)")
          .eq("supermarket_id", supermarketId)
          .order("created_at", { ascending: false });
        if (error) throw error;
        setOrders(data || []);
      } catch (err) {
        console.error(err);
      }
    };
    fetchOrders();
  }, [supermarketId]);

  // Cart functions
  const addToCart = (product: Product) => {
    if (product.stock === 0) return;
    setCart((prev) => {
      const item = prev.find((i) => i.product.id === product.id);
      if (item) {
        if (item.quantity < product.stock) {
          return prev.map((i) =>
            i.product.id === product.id ? { ...i, quantity: i.quantity + 1 } : i
          );
        }
        return prev;
      }
      return [...prev, { product, quantity: 1 }];
    });
  };

  const removeFromCart = (productId: string) => {
    setCart((prev) => prev.filter((i) => i.product.id !== productId));
  };

  const updateQuantity = (productId: string, qty: number) => {
    setCart((prev) =>
      prev.map((i) =>
        i.product.id === productId
          ? { ...i, quantity: Math.min(Math.max(qty, 1), i.product.stock) }
          : i
      )
    );
  };

  const handleCheckout = async () => {
    if (cart.length === 0) return alert("Cart is empty");

    try {
      const { data: latestProducts } = await supabase
        .from("products")
        .select("*")
        .in("id", cart.map((i) => i.product.id));

      for (const item of cart) {
        const latest = latestProducts?.find((p) => p.id === item.product.id);
        if (!latest || latest.stock < item.quantity) {
          return alert(`Not enough stock for ${item.product.name}`);
        }
      }

      const total = cart.reduce((sum, i) => sum + i.quantity * i.product.price, 0);
      const { data: orderData, error: orderError } = await supabase
        .from("orders")
        .insert([{ supermarket_id: supermarketId, total_amount: total, status: "pending" }])
        .select()
        .single();
      if (orderError) throw orderError;

      const orderItems = cart.map((i) => ({
        order_id: orderData.id,
        product_id: i.product.id,
        quantity: i.quantity,
        price: i.product.price,
      }));
      const { error: itemsError } = await supabase.from("order_items").insert(orderItems);
      if (itemsError) throw itemsError;

      for (const i of cart) {
        await supabase
          .from("products")
          .update({ stock: i.product.stock - i.quantity })
          .eq("id", i.product.id);
      }

      setCart([]);
      localStorage.removeItem(`cart_${supermarketId}`);

      const { data: refreshedProducts } = await supabase
        .from("products")
        .select("*")
        .eq("supermarket_id", supermarketId);
      setProducts(refreshedProducts || []);

      const { data: refreshedOrders } = await supabase
        .from("orders")
        .select("*, order_items(*)")
        .eq("supermarket_id", supermarketId)
        .order("created_at", { ascending: false });
      setOrders(refreshedOrders || []);

      alert("Order placed successfully!");
    } catch (err: any) {
      console.error(err);
      alert("Checkout error: " + err.message);
    }
  };

  // Filter & sort
  const filteredProducts = products
    .filter((p) => p.name.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => {
      if (sortOption === "priceAsc") return a.price - b.price;
      if (sortOption === "priceDesc") return b.price - a.price;
      if (sortOption === "stock") return b.stock - a.stock;
      return 0;
    });

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-4">Products</h1>

      {/* Search & Sort */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-4 gap-2">
        <input
          type="text"
          placeholder="Search products..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="border p-2 rounded w-full md:w-1/3"
        />
        <select
          value={sortOption}
          onChange={(e) => setSortOption(e.target.value as SortOption)}
          className="border p-2 rounded"
        >
          <option value="priceAsc">Price: Low → High</option>
          <option value="priceDesc">Price: High → Low</option>
          <option value="stock">Stock: High → Low</option>
        </select>
      </div>

      {/* Products */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {filteredProducts.map((product) => (
          <div key={product.id} className="border p-2 rounded">
            <img
              src={product.image_url || "https://via.placeholder.com/150"}
              alt={product.name}
              className="w-full h-32 object-cover mb-2"
            />
            <h2 className="font-semibold">{product.name}</h2>
            {product.description && <p className="text-sm mb-1">{product.description}</p>}
            <p>KES {product.price}</p>
            <p>{product.stock > 0 ? `${product.stock} in stock` : "Out of stock"}</p>
            <button
              disabled={product.stock === 0}
              onClick={() => addToCart(product)}
              className="mt-2 bg-blue-600 text-white px-2 py-1 rounded disabled:bg-gray-400"
            >
              Add to Cart
            </button>
          </div>
        ))}
      </div>

      {/* Cart */}
      <div className="mt-6 border-t pt-4">
        <h2 className="text-xl font-bold mb-2">Cart</h2>
        {cart.length === 0 && <p>Your cart is empty</p>}
        {cart.map((item) => {
          const outOfStock = item.product.stock === 0;
          return (
            <div key={item.product.id} className="flex justify-between items-center mb-2">
              <div>
                <span className="font-medium">{item.product.name}</span>
                <div className="flex items-center mt-1">
                  <button
                    onClick={() => updateQuantity(item.product.id, item.quantity - 1)}
                    disabled={item.quantity === 1 || outOfStock}
                    className="bg-gray-300 px-2 py-1 rounded"
                  >
                    −
                  </button>
                  <span className="px-2">{item.quantity}</span>
                  <button
                    onClick={() => updateQuantity(item.product.id, item.quantity + 1)}
                    disabled={item.quantity >= item.product.stock || outOfStock}
                    className="bg-gray-300 px-2 py-1 rounded"
                  >
                    +
                  </button>
                </div>
              </div>
              <button
                className="text-red-600"
                onClick={() => removeFromCart(item.product.id)}
              >
                Remove
              </button>
            </div>
          );
        })}
        {cart.length > 0 && (
          <>
            <p className="font-semibold mt-2">
              Total: KES {cart.reduce((acc, item) => acc + item.quantity * item.product.price, 0)}
            </p>
            <button
              onClick={handleCheckout}
              className="mt-2 bg-green-600 text-white px-4 py-2 rounded"
            >
              Checkout
            </button>
          </>
        )}
      </div>

      {/* Order History with Images */}
      <div className="mt-6 border-t pt-4">
        <h2 className="text-xl font-bold mb-2">Order History</h2>
        {orders.length === 0 && <p>No past orders.</p>}
        {orders.map((order) => (
          <div key={order.id} className="border p-2 mb-2 rounded">
            <p>
              <span className="font-semibold">Order ID:</span> {order.id}
            </p>
            <p>
              <span className="font-semibold">Total:</span> KES {order.total_amount}
            </p>
            <p>
              <span className="font-semibold">Status:</span> {order.status}
            </p>
            <p>
              <span className="font-semibold">Date:</span>{" "}
              {new Date(order.created_at).toLocaleString()}
            </p>
            {order.order_items && order.order_items.length > 0 && (
              <div className="mt-2">
                <span className="font-semibold">Items:</span>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mt-1">
                  {order.order_items.map((item, idx) => {
                    const product = products.find((p) => p.id === item.product_id);
                    return (
                      <div key={idx} className="border p-1 rounded flex flex-col items-center">
                        <img
                          src={product?.image_url || "https://via.placeholder.com/80"}
                          alt={product?.name || "Product"}
                          className="w-20 h-20 object-cover mb-1"
                        />
                        <p className="text-sm font-medium text-center">
                          {product?.name || item.product_id}
                        </p>
                        <p className="text-xs">Qty: {item.quantity}</p>
                        <p className="text-xs">Price: {item.price}</p>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
