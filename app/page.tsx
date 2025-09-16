"use client";

import SupermarketPage from "./supermarket/[id]/page";

export default function Home() {
  // 👇 Your actual supermarket ID
  const defaultSupermarketId = "6e64423c-672a-48f0-9d65-34d61db37f93";

  return (
    <div>
      <SupermarketPage params={{ id: defaultSupermarketId }} />
    </div>
  );
}
