// app/page.tsx
"use client";

import { useEffect, useState } from "react";

interface Product {
  id: number;
  name: string;
  price: number;
  stock: number;
  image_url: string;
  description: string;
  category: string;
}

export default function HomePage() {
  const [products, setProducts] = useState<Product[]>([]);

  useEffect(() => {
    async function fetchProducts() {
      try {
        const res = await fetch("http://localhost:3001/products");
        if (!res.ok) {
          throw new Error("Failed to fetch products");
        }
        const data = await res.json();
        setProducts(data);
      } catch (err) {
        console.error("Error loading products:", err);
      }
    }
    fetchProducts();
  }, []);

  return (
    <div style={{ padding: "20px" }}>
      <h1>🛒 Supermarket Products</h1>
      {products.length === 0 ? (
        <p>No products found.</p>
      ) : (
        <ul>
          {products.map((p) => (
            <li key={p.id} style={{ marginBottom: "15px" }}>
              <h2>{p.name}</h2>
              <p>💰 KES {p.price}</p>
              <p>📦 Stock: {p.stock}</p>
              <p>{p.description}</p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
