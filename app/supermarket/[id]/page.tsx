"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { useParams } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import toast from "react-hot-toast";
import { motion, AnimatePresence } from "framer-motion";
import {
  ShoppingCart,
  Trash2,
  LogOut,
  Plus,
  Minus,
  Filter,
  X,
} from "lucide-react";
import type { User } from "@supabase/supabase-js";

// --- Types ---
interface Supermarket {
  id: string;
  name: string;
  location?: string;
}

interface Product {
  id: string;
  supermarket_id: string;
  name: string;
  price: number;
  stock: number;
  image_url?: string | null;
  description?: string;
  category?: string;
}

interface CartItem {
  product: Product;
  quantity: number;
}

interface OrderItem {
  id: string;
  product_id: string;
  quantity: number;
  price: number;
}

interface Order {
  id: string;
  supermarket_id: string;
  total_amount: number;
  status: string;
  created_at: string;
  order_items?: OrderItem[];
  user_id?: string;
}

type SortOption = "priceAsc" | "priceDesc" | "stock";

// IMAGE FALLBACK COMPONENT
function ImageWithFallback({ src, alt }: { src?: string | null; alt?: string }) {
  const defaultSrc = "/placeholder.png";
  const [s, setS] = useState<string>(src || defaultSrc);

  return (
    <Image
      src={s}
      alt={alt ?? "Product"}
      width={400}
      height={400}
      className="object-cover w-full h-40 rounded-lg"
      onError={() => setS(defaultSrc)}
      unoptimized
    />
  );
}

export default function SupermarketPage() {
  const params = useParams();
  const paramsTyped = useParams<{ id?: string }>();
  const urlSupermarketId = paramsTyped.id ?? null;

  // Data states
  const [supermarkets, setSupermarkets] = useState<Supermarket[]>([]);
  const [selectedSupermarket, setSelectedSupermarket] = useState<Supermarket | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [user, setUser] = useState<User | null>(null);
  const [role, setRole] = useState<string>("user");

  // UI states
  const [search, setSearch] = useState<string>("");
  const [sortOption, setSortOption] = useState<SortOption>("priceAsc");
  const [cartOpen, setCartOpen] = useState<boolean>(false);
  const [filtersOpen, setFiltersOpen] = useState<boolean>(false); // mobile filter drawer

  // Filters
  const [categories, setCategories] = useState<string[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [minPrice, setMinPrice] = useState<number>(0);
  const [maxPrice, setMaxPrice] = useState<number>(100000);

  // Load current user + role
  useEffect(() => {
    const getUser = async () => {
      try {
        const { data } = await supabase.auth.getUser();
        const currentUser = data?.user as User | null;
        if (currentUser) {
          setUser(currentUser);
          const { data: profileData } = await supabase
            .from("profiles")
            .select("role")
            .eq("id", currentUser.id)
            .maybeSingle<{ role: string }>();
          if (profileData) setRole(profileData.role || "user");
        } else {
          setUser(null);
          setRole("user");
        }
      } catch (e) {
        console.error("Auth fetch error", e);
      }
    };
    getUser();
  }, []);

  // Fetch supermarkets (and select from URL if present)
  useEffect(() => {
    const fetchSupermarkets = async () => {
      const { data, error } = await supabase.from("supermarkets").select("*");
      if (error) {
        toast.error("Failed to load supermarkets");
        console.error(error);
        return;
      }
      if (data) {
        setSupermarkets(data as Supermarket[]);
        // If URL contains supermarket id, pick that one (if exists)
        if (urlSupermarketId) {
          const found = (data as Supermarket[]).find((s) => s.id === urlSupermarketId);
          if (found) {
            setSelectedSupermarket(found);
            return;
          }
        }
        // otherwise default to first
        if ((data as Supermarket[]).length > 0) setSelectedSupermarket((data as Supermarket[])[0]);
      }
    };
    fetchSupermarkets();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [urlSupermarketId]);

  // Load products for selected supermarket and categories
  useEffect(() => {
    if (!selectedSupermarket) return;
    const fetchProducts = async () => {
      const { data, error } = await supabase
        .from("products")
        .select("*")
        .eq("supermarket_id", selectedSupermarket.id);

      if (error) {
        console.error("Products error", error);
        toast.error("Failed to load products");
        return;
      }
      if (data) {
        // Ensure numeric fields are numbers (Supabase may return strings for numeric)
        const normalized = (data as Product[]).map((p) => ({
          ...p,
          price: typeof p.price === "string" ? Number(p.price) : p.price,
          stock: typeof p.stock === "string" ? Number(p.stock) : p.stock,
        }));
        setProducts(normalized);

        // categories
        const cats = Array.from(new Set(normalized.map((p) => p.category || "Uncategorized")));
        setCategories(cats);
        // set sensible max price
        const max = normalized.reduce((m, it) => Math.max(m, it.price ?? 0), 0);
        setMaxPrice(max > 0 ? max : 100000);
      }
    };
    fetchProducts();
  }, [selectedSupermarket]);

  // Load cart from localStorage for this supermarket
  useEffect(() => {
    if (!selectedSupermarket) return;
    try {
      const key = `cart_${selectedSupermarket.id}`;
      const stored = localStorage.getItem(key);
      if (stored) setCart(JSON.parse(stored));
      else setCart([]);
    } catch (e) {
      console.error("Load cart error", e);
    }
  }, [selectedSupermarket]);

  // Persist cart
  useEffect(() => {
    if (!selectedSupermarket) return;
    try {
      const key = `cart_${selectedSupermarket.id}`;
      localStorage.setItem(key, JSON.stringify(cart));
    } catch (e) {
      console.error("Persist cart error", e);
    }
  }, [cart, selectedSupermarket]);

  // Fetch orders for current user / supermarket
  useEffect(() => {
    if (!selectedSupermarket || !user) return;
    const fetchOrders = async () => {
      let query = supabase
        .from("orders")
        .select("*, order_items(*)")
        .eq("supermarket_id", selectedSupermarket.id)
        .order("created_at", { ascending: false });
      if (role !== "admin") query = query.eq("user_id", user.id);
      const { data, error } = await query;
      if (error) {
        console.error("Orders fetch error", error);
        toast.error("Failed to load orders");
        return;
      }
      if (data) setOrders(data as Order[]);
    };
    fetchOrders();
  }, [selectedSupermarket, user, role]);

  // --- AUTH HANDLERS (kept simple prompts like your original flow) ---
  const handleSignup = async () => {
    const email = prompt("Enter email:");
    const password = prompt("Enter password:");
    if (!email || !password) return;
    const { error } = await supabase.auth.signUp({ email, password });
    if (error) toast.error(error.message);
    else toast.success("Signup successful — check your email");
  };

  const handleLogin = async () => {
    const email = prompt("Enter email:");
    const password = prompt("Enter password:");
    if (!email || !password) return;
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) toast.error(error.message);
    else toast.success("Login successful");
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setUser(null);
    toast.success("Logged out");
  };

  // --- CART HELPERS (same functionality) ---
  const addToCart = (product: Product) => {
    if (!product || product.stock === 0) {
      toast.error("Out of stock");
      return;
    }
    setCart((prev) => {
      const existing = prev.find((i) => i.product.id === product.id);
      if (existing) {
        if (existing.quantity < (product.stock ?? Infinity)) {
          toast.success(`${product.name} quantity updated`);
          return prev.map((i) => (i.product.id === product.id ? { ...i, quantity: i.quantity + 1 } : i));
        } else {
          toast.error("No more stock available");
          return prev;
        }
      } else {
        toast.success(`${product.name} added to cart`);
        return [...prev, { product, quantity: 1 }];
      }
    });
  };

  const removeFromCart = (productId: string) => {
    setCart((prev) => prev.filter((i) => i.product.id !== productId));
    toast.success("Removed from cart");
  };

  const updateQuantity = (productId: string, qty: number) => {
    if (qty <= 0) return;
    setCart((prev) =>
      prev.map((i) => (i.product.id === productId ? { ...i, quantity: Math.min(qty, i.product.stock ?? qty) } : i))
    );
  };

  // --- CHECKOUT (same behavior, simplified redirect removed) ---
  const handleCheckout = async () => {
    if (!user || !selectedSupermarket) return toast.error("Please login first");
    if (cart.length === 0) return toast.error("Cart is empty");

    try {
      const ids = cart.map((i) => i.product.id);
      const { data: latestProducts } = await supabase.from("products").select("*").in("id", ids);

      for (const item of cart) {
        const latest = (latestProducts as Product[])?.find((p) => p.id === item.product.id);
        if (!latest || latest.stock < item.quantity) {
          return toast.error(`Not enough stock for ${item.product.name}`);
        }
      }

      const total = cart.reduce((sum, i) => sum + i.quantity * (i.product.price ?? 0), 0);

      const { data: orderData, error: orderError } = await supabase
        .from("orders")
        .insert([
          {
            supermarket_id: selectedSupermarket.id,
            user_id: user.id,
            total_amount: total,
            status: "pending",
          },
        ])
        .select()
        .single<Order>();

      if (orderError) throw orderError;

      const orderItems = cart.map((i) => ({
        order_id: orderData?.id,
        product_id: i.product.id,
        quantity: i.quantity,
        price: i.product.price,
      }));

      await supabase.from("order_items").insert(orderItems);

      setCart([]);
      toast.success("Order placed successfully!");
      // refresh orders list
      const { data: newOrders } = await supabase
        .from("orders")
        .select("*, order_items(*)")
        .eq("supermarket_id", selectedSupermarket.id)
        .order("created_at", { ascending: false });
      if (newOrders) setOrders(newOrders as Order[]);
    } catch (err) {
      console.error("Checkout error:", err);
      toast.error("Something went wrong during checkout");
    }
  };

  // Clear orders for current user + supermarket
  const clearOrders = async () => {
    if (!user || !selectedSupermarket) return toast.error("No user/supermarket selected");
    const confirmClear = confirm("Clear all orders for this supermarket? This cannot be undone.");
    if (!confirmClear) return;
    const { error } = await supabase
      .from("orders")
      .delete()
      .eq("supermarket_id", selectedSupermarket.id)
      .eq("user_id", user.id);
    if (error) {
      toast.error("Failed to clear orders");
      console.error(error);
    } else {
      setOrders([]);
      toast.success("Order history cleared");
    }
  };

  // Product request
  const handleRequestProduct = async (requestName: string) => {
    if (!requestName || !selectedSupermarket) return;
    const { error } = await supabase.from("requests").insert([
      {
        supermarket_id: selectedSupermarket.id,
        name: requestName,
      },
    ]);
    if (error) {
      toast.error("Failed to submit request");
      console.error(error);
    } else {
      toast.success("Product request submitted");
    }
  };

  // Filtering + sorting passed to render
  const filteredProducts = products
    .filter((p) => p.name.toLowerCase().includes(search.toLowerCase()))
    .filter((p) => (selectedCategory === "all" ? true : (p.category || "Uncategorized") === selectedCategory))
    .filter((p) => (p.price ?? 0) >= minPrice && (p.price ?? 0) <= maxPrice)
    .sort((a, b) =>
      sortOption === "priceAsc" ? (a.price ?? 0) - (b.price ?? 0) : sortOption === "priceDesc" ? (b.price ?? 0) - (a.price ?? 0) : (b.stock ?? 0) - (a.stock ?? 0)
    );

  // UI helpers
  const cartTotal = cart.reduce((sum, item) => sum + (item.product.price ?? 0) * item.quantity, 0);

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-red-50 text-gray-900">
      {/* HEADER */}
      <header className="flex items-center justify-between px-4 py-3 bg-white shadow-md sticky top-0 z-30">
        <div className="flex items-center gap-4">
          <div className="text-2xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-red-500">
            SnapCart
          </div>
          <div className="hidden md:block">
            <select
              value={selectedSupermarket?.id ?? ""}
              onChange={(e) => {
                const sm = supermarkets.find((s) => s.id === e.target.value);
                if (sm) setSelectedSupermarket(sm);
              }}
              className="border rounded-lg px-3 py-1"
            >
              {supermarkets.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="flex-1 px-4 hidden md:flex items-center justify-center">
          <div className="w-full max-w-2xl">
            <input
              type="search"
              placeholder="Search products..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full border rounded-lg px-4 py-2 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
            />
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => setFiltersOpen((s) => !s)}
            className="inline-flex items-center gap-2 px-3 py-2 rounded bg-white hover:shadow"
            title="Filters"
          >
            <Filter size={16} className="text-blue-600" />
            <span className="hidden sm:inline text-sm">Filters</span>
          </button>

          {!user ? (
            <>
              <button onClick={handleLogin} className="px-3 py-2 rounded bg-blue-600 text-white hover:opacity-95">
                Login
              </button>
              <button onClick={handleSignup} className="px-3 py-2 rounded bg-red-500 text-white hover:opacity-95">
                Signup
              </button>
            </>
          ) : (
            <button onClick={handleLogout} className="px-3 py-2 rounded bg-gray-100 flex items-center gap-2">
              <LogOut size={16} /> <span className="hidden sm:inline">Logout</span>
            </button>
          )}

          <button
            onClick={() => setCartOpen(true)}
            className="relative p-2 rounded-full bg-gradient-to-r from-blue-100 to-red-100"
            aria-label="Open cart"
          >
            <ShoppingCart className="text-blue-700" />
            {cart.length > 0 && (
              <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs px-2 py-0.5 rounded-full">
                {cart.length}
              </span>
            )}
          </button>
        </div>
      </header>

      <div className="flex">
        {/* DESKTOP FILTERS */}
        <aside className="hidden md:block w-64 p-4">
          <div className="bg-white rounded-lg shadow p-4 sticky top-20">
            <h3 className="font-semibold text-lg mb-3 flex items-center gap-2">
              <Filter size={18} /> Filters
            </h3>

            <div className="mb-4">
              <label className="block font-medium mb-2">Category</label>
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="w-full border rounded px-3 py-2"
              >
                <option value="all">All</option>
                {categories.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>

            <div className="mb-3">
              <label className="block font-medium mb-2">Price range</label>
              <div className="flex gap-2">
                <input
                  type="number"
                  value={minPrice}
                  onChange={(e) => setMinPrice(Number(e.target.value))}
                  className="w-1/2 border rounded px-2 py-1"
                />
                <input
                  type="number"
                  value={maxPrice}
                  onChange={(e) => setMaxPrice(Number(e.target.value))}
                  className="w-1/2 border rounded px-2 py-1"
                />
              </div>
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => {
                  setMinPrice(0);
                  setMaxPrice(products.reduce((m, p) => Math.max(m, p.price ?? 0), 100000));
                  setSelectedCategory("all");
                  toast.success("Filters reset");
                }}
                className="px-3 py-2 bg-blue-600 text-white rounded"
              >
                Reset
              </button>
              <button
                onClick={() => setFiltersOpen(false)}
                className="px-3 py-2 bg-gray-100 rounded"
              >
                Done
              </button>
            </div>
          </div>
        </aside>

        {/* MAIN */}
        <main className="flex-1 p-6">
          {/* Toolbar row (mobile search + sort) */}
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 mb-6">
            <div className="md:hidden w-full">
              <input
                type="search"
                placeholder="Search products..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full border rounded-lg px-4 py-2 shadow-sm"
              />
            </div>

            <div className="flex items-center gap-3 w-full md:w-auto">
              <select
                value={sortOption}
                onChange={(e) => setSortOption(e.target.value as SortOption)}
                className="border rounded px-3 py-2"
              >
                <option value="priceAsc">Price: Low → High</option>
                <option value="priceDesc">Price: High → Low</option>
                <option value="stock">Stock: High → Low</option>
              </select>

              {/* mobile filters button */}
              <button
                onClick={() => setFiltersOpen(true)}
                className="md:hidden px-3 py-2 bg-white rounded shadow inline-flex items-center gap-2"
              >
                <Filter size={16} /> Filters
              </button>
            </div>
          </div>

          {/* PRODUCTS GRID */}
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6">
            <AnimatePresence mode="popLayout">
              {filteredProducts.map((product) => (
                <motion.div
                  key={product.id}
                  layout
                  whileHover={{ scale: 1.03 }}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 6 }}
                  transition={{ type: "spring", stiffness: 300, damping: 20 }}
                  className="bg-white rounded-lg shadow p-4 flex flex-col"
                >
                  <div className="h-40 w-full overflow-hidden rounded">
                    <ImageWithFallback src={product.image_url ?? undefined} alt={product.name} />
                  </div>
                  <h3 className="font-semibold mt-3 text-blue-700">{product.name}</h3>
                  <p className="text-sm text-gray-600 line-clamp-2">{product.description}</p>
                  <div className="mt-2 flex items-center justify-between gap-4">
                    <div>
                      <div className="text-red-600 font-bold">KES {product.price}</div>
                      <div className={product.stock && product.stock > 0 ? "text-green-600 text-sm" : "text-red-600 text-sm"}>
                        {product.stock && product.stock > 0 ? `${product.stock} in stock` : "Out of stock"}
                      </div>
                    </div>
                    <button
                      onClick={() => addToCart(product)}
                      disabled={!product.stock || product.stock === 0}
                      className="bg-gradient-to-r from-blue-600 to-red-500 text-white px-3 py-2 rounded shadow hover:opacity-95"
                    >
                      Add
                    </button>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>

          {/* REQUEST PRODUCT */}
          <div className="mt-8 bg-white rounded-lg p-4 shadow">
            <h3 className="font-semibold mb-3">Request a Product</h3>
            <ProductRequestForm onRequest={handleRequestProduct} />
          </div>
        </main>
      </div>

      {/* ORDERS SECTION */}
      <section className="p-6 bg-gray-50 border-t">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold text-blue-700">{role === "admin" ? "All Orders" : "My Orders"}</h2>
          {orders.length > 0 && (
            <button
              onClick={clearOrders}
              className="bg-red-500 text-white px-3 py-2 rounded hover:scale-105 transform transition"
            >
              Clear Orders
            </button>
          )}
        </div>

        {orders.length === 0 ? (
          <p>No past orders.</p>
        ) : (
          <div className="grid gap-4">
            <AnimatePresence>
              {orders.map((order) => (
                <motion.div
                  key={order.id}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 6 }}
                  transition={{ duration: 0.18 }}
                  className="bg-white rounded shadow p-4"
                >
                  <p><span className="font-semibold">Order ID:</span> {order.id}</p>
                  <p><span className="font-semibold">Total:</span> KES {order.total_amount}</p>
                  <p><span className="font-semibold">Status:</span> {order.status}</p>
                  <p><span className="font-semibold">Date:</span> {new Date(order.created_at).toLocaleString()}</p>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        )}
      </section>

      {/* CART DRAWER */}
      <AnimatePresence>
        {cartOpen && (
          <>
            <motion.div
              key="overlay"
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.5 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black z-40"
              onClick={() => setCartOpen(false)}
            />
            <motion.aside
              key="drawer"
              initial={{ x: 300 }}
              animate={{ x: 0 }}
              exit={{ x: 300 }}
              transition={{ type: "spring", stiffness: 300, damping: 30 }}
              className="fixed right-0 top-0 h-full w-96 bg-white z-50 shadow-lg flex flex-col"
            >
              <div className="flex items-center justify-between p-4 border-b">
                <div className="flex items-center gap-2">
                  <ShoppingCart />
                  <h3 className="font-semibold">Your Cart</h3>
                </div>
                <button onClick={() => setCartOpen(false)} className="p-2">
                  <X />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {cart.length === 0 && <p className="text-gray-500">Your cart is empty</p>}
                <AnimatePresence>
                  {cart.map((item) => (
                    <motion.div
                      layout
                      key={item.product.id}
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: 6 }}
                      className="flex items-start justify-between gap-3"
                    >
                      <div className="w-14 h-14 overflow-hidden rounded">
                        <ImageWithFallback src={item.product.image_url ?? undefined} alt={item.product.name} />
                      </div>
                      <div className="flex-1">
                        <div className="font-semibold">{item.product.name}</div>
                        <div className="text-sm text-gray-500">KES {item.product.price}</div>
                        <div className="mt-2 flex items-center gap-2">
                          <button
                            onClick={() => updateQuantity(item.product.id, item.quantity - 1)}
                            disabled={item.quantity <= 1}
                            className="px-2 py-1 rounded bg-gray-100"
                          >
                            <Minus size={12} />
                          </button>
                          <div className="px-2">{item.quantity}</div>
                          <button
                            onClick={() => updateQuantity(item.product.id, item.quantity + 1)}
                            disabled={item.quantity >= (item.product.stock ?? Infinity)}
                            className="px-2 py-1 rounded bg-gray-100"
                          >
                            <Plus size={12} />
                          </button>
                        </div>
                      </div>
                      <div className="flex flex-col items-end gap-2">
                        <div className="font-medium">KES {item.product.price * item.quantity}</div>
                        <button
                          onClick={() => removeFromCart(item.product.id)}
                          className="text-red-500 text-sm flex items-center gap-1"
                        >
                          <Trash2 size={14} /> Remove
                        </button>
                      </div>
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>

              <div className="p-4 border-t">
                <div className="flex items-center justify-between mb-3">
                  <div className="font-semibold">Total</div>
                  <div className="text-red-600 font-bold">KES {cartTotal}</div>
                </div>
                <button
                  onClick={handleCheckout}
                  className="w-full bg-gradient-to-r from-blue-600 to-red-500 text-white py-2 rounded"
                  disabled={cart.length === 0}
                >
                  Checkout
                </button>
              </div>
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      {/* MOBILE FILTER DRAWER */}
      <AnimatePresence>
        {filtersOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.4 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black z-40"
              onClick={() => setFiltersOpen(false)}
            />
            <motion.div
              initial={{ x: -300 }}
              animate={{ x: 0 }}
              exit={{ x: -300 }}
              transition={{ type: "spring", stiffness: 300 }}
              className="fixed left-0 top-0 h-full w-80 bg-white z-50 p-4"
            >
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-lg">Filters</h3>
                <button onClick={() => setFiltersOpen(false)} className="p-2">
                  <X />
                </button>
              </div>

              <div className="mb-4">
                <label className="font-medium block mb-2">Category</label>
                <select value={selectedCategory} onChange={(e) => setSelectedCategory(e.target.value)} className="w-full border rounded px-3 py-2">
                  <option value="all">All</option>
                  {categories.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="font-medium block mb-2">Price range</label>
                <div className="flex gap-2">
                  <input type="number" value={minPrice} onChange={(e) => setMinPrice(Number(e.target.value))} className="w-1/2 border rounded px-2 py-1" />
                  <input type="number" value={maxPrice} onChange={(e) => setMaxPrice(Number(e.target.value))} className="w-1/2 border rounded px-2 py-1" />
                </div>
              </div>

              <div className="mt-4 flex gap-2">
                <button onClick={() => { setMinPrice(0); setMaxPrice(products.reduce((m, p) => Math.max(m, p.price ?? 0), 100000)); setSelectedCategory("all"); toast.success("Filters reset"); }} className="px-3 py-2 bg-blue-600 text-white rounded">Reset</button>
                <button onClick={() => setFiltersOpen(false)} className="px-3 py-2 bg-gray-100 rounded">Close</button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}

/* -------------------------
   Small sub-component: Request form
   kept inline to keep one-file as requested
   ------------------------- */
function ProductRequestForm({ onRequest }: { onRequest: (name: string) => void }) {
  const [value, setValue] = useState<string>("");

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (!value.trim()) {
          toast.error("Enter a product name");
          return;
        }
        onRequest(value.trim());
        setValue("");
      }}
      className="flex flex-col sm:flex-row gap-3"
    >
      <input
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="What product would you like us to add?"
        className="flex-1 border rounded px-3 py-2"
      />
      <button type="submit" className="bg-gradient-to-r from-blue-600 to-red-500 text-white px-4 py-2 rounded">
        Request
      </button>
    </form>
  );
}