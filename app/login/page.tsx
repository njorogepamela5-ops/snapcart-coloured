// app/supermarket/[id]/page.tsx
"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

interface Product {
  id: string;
  name: string;
  price: number;
  stock: number;
  image_url?: string | null;
  description?: string | null;
  category?: string | null;
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
  order_items?: OrderItem[] | null;
  user_id?: string | null;
}

type SortOption = "priceAsc" | "priceDesc" | "stock";

interface Props {
  params: { id: string };
}

/** Simple image fallback component using <img> to avoid next/image remote host config issues. */
function ImageWithFallback({ src, alt }: { src?: string | null; alt?: string }) {
  const defaultSrc = "/placeholder.png";
  const [currentSrc, setCurrentSrc] = useState<string>(src ?? defaultSrc);

  useEffect(() => {
    setCurrentSrc(src ?? defaultSrc);
  }, [src]);

  return (
    <div className="w-full h-32 mb-2 bg-white flex items-center justify-center overflow-hidden rounded">
      <img
        src={currentSrc}
        alt={alt ?? "Product"}
        className="object-cover w-full h-full"
        onError={(e) => {
          (e.target as HTMLImageElement).src = defaultSrc;
        }}
      />
    </div>
  );
}

export default function SupermarketPage({ params }: Props) {
  const supermarketId = params.id;
  const router = useRouter();

  const [products, setProducts] = useState<Product[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [search, setSearch] = useState("");
  const [sortOption, setSortOption] = useState<SortOption>("priceAsc");
  const [requestProduct, setRequestProduct] = useState("");
  const [requestSuccess, setRequestSuccess] = useState(false);
  const [user, setUser] = useState<any>(null);
  const [role, setRole] = useState<string>("user");

  // --- Auth (client-side)
  useEffect(() => {
    const getUser = async () => {
      try {
        const { data } = await supabase.auth.getUser();
        const currentUser = data?.user ?? null;
        setUser(currentUser);

        if (currentUser) {
          const profileRes = await supabase
            .from("profiles")
            .select("role")
            .eq("id", currentUser.id)
            .single();
          const profile = profileRes.data as { role?: string } | null;
          setRole(profile?.role ?? "user");
        } else {
          setRole("user");
        }
      } catch (err) {
        console.warn("getUser error:", err);
        setUser(null);
        setRole("user");
      }
    };

    getUser();
  }, []);

  // --- Persist cart per supermarket
  useEffect(() => {
    try {
      const raw = localStorage.getItem(`cart_${supermarketId}`);
      if (raw) setCart(JSON.parse(raw));
    } catch (err) {
      console.warn("Load cart error:", err);
    }
  }, [supermarketId]);

  useEffect(() => {
    try {
      localStorage.setItem(`cart_${supermarketId}`, JSON.stringify(cart));
    } catch (err) {
      console.warn("Save cart error:", err);
    }
  }, [cart, supermarketId]);

  // --- Products + realtime
  useEffect(() => {
    let channel: any = null;

    const fetchProducts = async () => {
      try {
        const res = await supabase.from("products").select("*").eq("supermarket_id", supermarketId);
        const data = res.data as Product[] | null;
        if (data) setProducts(data);
      } catch (err) {
        console.warn("fetchProducts error:", err);
      }
    };

    fetchProducts();

    try {
      channel = supabase
        .channel(`products-${supermarketId}`)
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "products",
            filter: `supermarket_id=eq.${supermarketId}`,
          },
          (payload: any) => {
            setProducts((prev) => {
              const newRow = payload?.new;
              const oldRow = payload?.old;
              if (payload.eventType === "DELETE" && oldRow) {
                return prev.filter((p) => p.id !== oldRow.id);
              }
              if (!newRow) return prev;
              const idx = prev.findIndex((p) => p.id === newRow.id);
              if (idx > -1) {
                const copy = [...prev];
                copy[idx] = newRow;
                return copy;
              } else {
                return [newRow, ...prev];
              }
            });
          }
        )
        .subscribe();
    } catch (err) {
      console.warn("product subscription error:", err);
    }

    return () => {
      try {
        if (channel?.unsubscribe) channel.unsubscribe();
      } catch (err) {
        // ignore
      }
    };
  }, [supermarketId]);

  // --- Orders + realtime (only when user known)
  useEffect(() => {
    if (!user) return;
    let ordersChannel: any = null;

    const fetchOrders = async () => {
      try {
        let q = supabase.from("orders").select("*, order_items(*)").eq("supermarket_id", supermarketId).order("created_at", { ascending: false });
        if (role !== "admin") q = q.eq("user_id", user.id);
        const res = await q;
        const data = res.data as Order[] | null;
        if (data) setOrders(data);
      } catch (err) {
        console.warn("fetchOrders error:", err);
      }
    };

    fetchOrders();

    try {
      ordersChannel = supabase
        .channel(`orders-${supermarketId}`)
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "orders",
            filter: `supermarket_id=eq.${supermarketId}`,
          },
          (payload: any) => {
            setOrders((prev) => {
              if (payload.eventType === "DELETE" && payload.old) return prev.filter((o) => o.id !== payload.old.id);
              const newRow = payload?.new;
              if (!newRow) return prev;
              const idx = prev.findIndex((o) => o.id === newRow.id);
              if (idx > -1) {
                const copy = [...prev];
                copy[idx] = newRow;
                return copy;
              } else {
                return [newRow, ...prev];
              }
            });
          }
        )
        .subscribe();
    } catch (err) {
      console.warn("orders subscription error:", err);
    }

    return () => {
      try {
        if (ordersChannel?.unsubscribe) ordersChannel.unsubscribe();
      } catch (err) {
        // ignore
      }
    };
  }, [supermarketId, user, role]);

  // --- Cart helpers
  const addToCart = (product: Product) => {
    if (!product || product.stock === 0) return;
    setCart((prev) => {
      const found = prev.find((i) => i.product.id === product.id);
      if (found) {
        if (found.quantity < (product.stock ?? Infinity)) {
          return prev.map((i) => (i.product.id === product.id ? { ...i, quantity: i.quantity + 1 } : i));
        }
        return prev;
      }
      return [...prev, { product, quantity: 1 }];
    });
  };

  const removeFromCart = (productId: string) => setCart((prev) => prev.filter((i) => i.product.id !== productId));
  const updateQuantity = (productId: string, qty: number) => setCart((prev) => prev.map((i) => (i.product.id === productId ? { ...i, quantity: Math.min(Math.max(qty, 1), i.product.stock ?? qty) } : i)));

  // --- Checkout: ensure logged in; create order & redirect to Paystack
  const handleCheckout = async () => {
    if (!user) {
      router.push("/login");
      return;
    }
    if (cart.length === 0) {
      alert("Cart is empty");
      return;
    }

    try {
      const ids = cart.map((i) => i.product.id);
      const prodRes = await supabase.from("products").select("*").in("id", ids);
      const latestProducts = prodRes.data as Product[] | null;

      for (const item of cart) {
        const latest = latestProducts?.find((p) => p.id === item.product.id);
        if (!latest || latest.stock < item.quantity) {
          alert(`Not enough stock for ${item.product.name}`);
          return;
        }
      }

      const total = cart.reduce((sum, i) => sum + i.quantity * (i.product.price ?? 0), 0);

      const orderRes = await supabase.from("orders").insert([{ supermarket_id: supermarketId, user_id: user.id, total_amount: total, status: "pending" }]).select().single();
      const orderData = orderRes.data as any;
      if (!orderData || !orderData.id) throw new Error("Order creation failed");

      const orderItems = cart.map((i) => ({ order_id: orderData.id, product_id: i.product.id, quantity: i.quantity, price: i.product.price }));
      await supabase.from("order_items").insert(orderItems);

      // call server-side API to create Paystack transaction and return authorization_url
      const res = await fetch("/api/pay", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: user.email, amount: total, reference: orderData.id }),
      });
      const result = await res.json();
      if (result?.data?.authorization_url) {
        window.location.href = result.data.authorization_url;
      } else {
        alert("Failed to start payment");
      }
    } catch (err: any) {
      console.error("checkout error:", err);
      alert("Checkout error: " + (err?.message || String(err)));
    }
  };

  // --- Clear orders
  const clearOrders = async () => {
    if (!user) {
      router.push("/login");
      return;
    }
    try {
      let q = supabase.from("orders").delete().eq("supermarket_id", supermarketId);
      if (role !== "admin") q = q.eq("user_id", user.id);
      const { error } = await q;
      if (error) throw error;
      setOrders([]);
      alert("Orders cleared");
    } catch (err: any) {
      console.error("clearOrders error:", err);
      alert("Error clearing orders: " + (err?.message || String(err)));
    }
  };

  // --- Request product
  const handleRequestProduct = async () => {
    if (!requestProduct.trim()) return;
    try {
      const { error } = await supabase.from("product_requests").insert([{ supermarket_id: supermarketId, request: requestProduct.trim(), created_at: new Date().toISOString() }]);
      if (error) throw error;
      setRequestProduct("");
      setRequestSuccess(true);
      setTimeout(() => setRequestSuccess(false), 3000);
    } catch (err) {
      console.error("request product error:", err);
      alert("Failed to submit request");
    }
  };

  // --- Filter & sort
  const filteredProducts = products
    .filter((p) => (p.name || "").toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => {
      if (sortOption === "priceAsc") return (a.price ?? 0) - (b.price ?? 0);
      if (sortOption === "priceDesc") return (b.price ?? 0) - (a.price ?? 0);
      if (sortOption === "stock") return (b.stock ?? 0) - (a.stock ?? 0);
      return 0;
    });

  return (
    <div className="p-6 min-h-screen bg-white text-gray-900">
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-blue-700">Supermarket</h1>

        <div className="flex gap-2">
          {!user ? (
            <>
              <button onClick={() => router.push("/login")} className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1 rounded">Login</button>
              <button onClick={() => router.push("/login?mode=signup")} className="bg-pink-500 hover:bg-pink-600 text-white px-3 py-1 rounded">Signup</button>
            </>
          ) : (
            <button onClick={async () => { await supabase.auth.signOut(); setUser(null); router.push("/login"); }} className="bg-gray-300 hover:bg-gray-400 text-gray-800 px-3 py-1 rounded">
              Logout {user?.email ? `(${user.email})` : ""}
            </button>
          )}
        </div>
      </div>

      {/* Toolbar */}
      <div className="mb-4 flex flex-col md:flex-row md:items-center md:justify-between gap-2">
        <input type="text" placeholder="Search products..." value={search} onChange={(e) => setSearch(e.target.value)} className="border p-2 rounded w-full md:w-1/3" />
        <select value={sortOption} onChange={(e) => setSortOption(e.target.value as SortOption)} className="border p-2 rounded">
          <option value="priceAsc">Price: Low → High</option>
          <option value="priceDesc">Price: High → Low</option>
          <option value="stock">Stock: High → Low</option>
        </select>
      </div>

      {/* Products */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {filteredProducts.map((product) => (
          <div key={product.id} className="border p-3 rounded flex flex-col items-center bg-blue-50">
            <ImageWithFallback src={product.image_url ?? undefined} alt={product.name ?? "Product"} />
            <h3 className="font-semibold text-center">{product.name}</h3>
            {product.description && <p className="text-sm text-center mb-1">{product.description}</p>}
            <p className="mt-1">KES {product.price}</p>
            <p className={product.stock && product.stock > 0 ? "text-green-600" : "text-red-600"}>{product.stock && product.stock > 0 ? `${product.stock} in stock` : "Out of stock"}</p>
            <button onClick={() => addToCart(product)} disabled={!product.stock || product.stock === 0} className="mt-3 bg-pink-500 hover:bg-pink-600 text-white px-3 py-1 rounded disabled:bg-gray-400">Add to Cart</button>
          </div>
        ))}
      </div>

      {/* Cart */}
      <div className="mt-6 border-t pt-4">
        <h2 className="text-xl font-bold mb-2 text-blue-700">Cart</h2>
        {cart.length === 0 && <p>Your cart is empty</p>}
        {cart.map((item) => (
          <div key={item.product.id} className="flex justify-between items-center mb-2">
            <div>
              <div className="font-medium">{item.product.name}</div>
              <div className="flex items-center gap-2 mt-1">
                <button onClick={() => updateQuantity(item.product.id, item.quantity - 1)} disabled={item.quantity <= 1} className="bg-gray-300 px-2 py-1 rounded">−</button>
                <span className="px-2">{item.quantity}</span>
                <button onClick={() => updateQuantity(item.product.id, item.quantity + 1)} disabled={item.quantity >= (item.product.stock ?? Infinity)} className="bg-gray-300 px-2 py-1 rounded">+</button>
              </div>
            </div>

            <div className="flex items-center gap-4">
              <div className="text-sm">KES {item.product.price * item.quantity}</div>
              <button className="text-pink-600" onClick={() => removeFromCart(item.product.id)}>Remove</button>
            </div>
          </div>
        ))}

        {cart.length > 0 && (
          <>
            <p className="font-semibold mt-2">Total: KES {cart.reduce((acc, item) => acc + item.quantity * (item.product.price ?? 0), 0)}</p>
            <button onClick={handleCheckout} className="mt-2 bg-pink-500 hover:bg-pink-600 text-white px-4 py-2 rounded">Checkout</button>
          </>
        )}
      </div>

      {/* Orders */}
      <div className="mt-6 border-t pt-4">
        <div className="flex justify-between items-center mb-2">
          <h2 className="text-xl font-bold text-blue-700">{role === "admin" ? "All Orders" : "My Orders"}</h2>
          {orders.length > 0 && <button onClick={clearOrders} className="bg-pink-500 hover:bg-pink-600 text-white px-3 py-1 rounded">Clear Orders</button>}
        </div>

        {orders.length === 0 && <p>No past orders.</p>}
        {orders.map((order) => (
          <div key={order.id} className="border p-2 mb-2 rounded bg-blue-50">
            <p><span className="font-semibold">Order ID:</span> {order.id}</p>
            <p><span className="font-semibold">Total:</span> KES {order.total_amount}</p>
            <p><span className="font-semibold">Status:</span> {order.status}</p>
            <p><span className="font-semibold">Date:</span> {new Date(order.created_at).toLocaleString()}</p>
          </div>
        ))}
      </div>

      {/* Product request */}
      <div className="mt-6 border-t pt-4">
        <h2 className="text-xl font-bold mb-2 text-blue-700">Request a Product</h2>
        <div className="flex gap-2">
          <input type="text" placeholder="Enter product name" value={requestProduct} onChange={(e) => setRequestProduct(e.target.value)} className="border p-2 rounded w-full" />
          <button onClick={handleRequestProduct} className="bg-pink-500 hover:bg-pink-600 text-white px-4 py-2 rounded">Submit</button>
        </div>
        {requestSuccess && <p className="text-green-600 mt-2">Request submitted successfully!</p>}
      </div>
    </div>
  );
}
