import { beforeAll, describe, expect, it } from "vitest";
import { createHmac } from "node:crypto";
import { writeFileSync } from "node:fs";
import { api, createArtist, createUser, uniqueEmail } from "./helpers.js";
import { prisma } from "../src/config/prisma.js";
import { env } from "../src/config/env.js";
import { digitalFilesDir } from "../src/lib/storage.js";

let seedCounter = 0;

async function seedMarketplace() {
  seedCounter += 1;
  const artistUser = await createArtist(`Studio Phoenix ${seedCounter}`, uniqueEmail("seller"));
  const category = await prisma.productCategory.create({
    data: { name: "Livres & Audios", slug: `test-livres-${seedCounter}` },
  });

  const tshirt = await prisma.product.create({
    data: {
      sellerId: artistUser.artistId,
      categoryId: category.id,
      name: `T-shirt Phoenix ${seedCounter}`,
      type: "PHYSICAL",
      price: 7500,
      stock: 10,
      variants: {
        create: [
          { name: "S", stock: 3 },
          { name: "M", stock: 5 },
        ],
      },
    },
  });

  const ebook = await prisma.product.create({
    data: {
      sellerId: artistUser.artistId,
      categoryId: category.id,
      name: `Livre numérique Phoenix ${seedCounter}`,
      type: "DIGITAL",
      price: 3500,
      digitalStorageKey: "test-ebook.pdf",
      downloadLimit: 3,
    },
  });

  const buyer = await createUser("Acheteur", uniqueEmail("buyer"));
  return { category, tshirt, ebook, buyer, artistUser };
}

describe("Marketplace", () => {
  beforeAll(async () => {
    await prisma.$executeRawUnsafe(
      `TRUNCATE product_categories, products, product_variants, product_images,
       carts, cart_items, orders, order_items, order_addresses,
       payment_transactions, payment_receipts CASCADE`,
    );
    // The protected download streams a real file from the digital files dir.
    writeFileSync(`${digitalFilesDir()}/test-ebook.pdf`, "%PDF-1.4 test");
  });

  it("lists active products with category and type filters", async () => {
    const { category, ebook } = await seedMarketplace();
    const app = await api();

    const all = await app.get("/api/v1/products");
    expect(all.status).toBe(200);
    expect(all.body.data.length).toBeGreaterThanOrEqual(2);

    const digital = await app.get("/api/v1/products?type=DIGITAL");
    expect(digital.body.data.every((p: { type: string }) => p.type === "DIGITAL")).toBe(true);

    const filtered = await app.get(`/api/v1/products?categoryId=${category.id}`);
    expect(filtered.body.data.length).toBeGreaterThanOrEqual(2);

    const searched = await app.get("/api/v1/products?search=t-shirt");
    expect(searched.body.data.some((p: { id: string }) => p.id === ebook.id)).toBe(false);

    const categories = await app.get("/api/v1/product-categories");
    expect(categories.status).toBe(200);
    expect(categories.body.data.some((c: { slug: string }) => c.slug.startsWith("test-livres-"))).toBe(true);
  });

  it("adds cart items, enforces variants and validates stock server-side", async () => {
    const { tshirt, ebook, buyer } = await seedMarketplace();
    const app = await api();

    // Adding a physical product that has variants without choosing one fails? (variants optional but recommended)
    const variant = await prisma.productVariant.findFirstOrThrow({ where: { productId: tshirt.id, name: "S" } });

    const added = await app
      .post("/api/v1/cart/items")
      .set("Cookie", buyer.cookie)
      .send({ productId: tshirt.id, variantId: variant.id, quantity: 2 });
    expect(added.status).toBe(201);
    expect(added.body.data.subtotal).toBe(15000);

    // Invalid variant → 400.
    const badVariant = await app
      .post("/api/v1/cart/items")
      .set("Cookie", buyer.cookie)
      .send({ productId: tshirt.id, variantId: ebook.id, quantity: 1 });
    expect(badVariant.status).toBe(400);

    // Insufficient stock → 409.
    const tooMany = await app
      .post("/api/v1/cart/items")
      .set("Cookie", buyer.cookie)
      .send({ productId: tshirt.id, variantId: variant.id, quantity: 99 });
    expect(tooMany.status).toBe(409);

    // Quantity update respects stock as well.
    const itemId = added.body.data.items[0].id as string;
    const overStock = await app
      .patch(`/api/v1/cart/items/${itemId}`)
      .set("Cookie", buyer.cookie)
      .send({ quantity: 4 });
    expect(overStock.status).toBe(409);

    const okQuantity = await app
      .patch(`/api/v1/cart/items/${itemId}`)
      .set("Cookie", buyer.cookie)
      .send({ quantity: 1 });
    expect(okQuantity.status).toBe(200);
    expect(okQuantity.body.data.subtotal).toBe(7500);

    const removed = await app.delete(`/api/v1/cart/items/${itemId}`).set("Cookie", buyer.cookie);
    expect(removed.status).toBe(200);
    expect(removed.body.data.items).toHaveLength(0);
  });

  it("creates orders with server-side prices, snapshots and digital keys", async () => {
    const { tshirt, ebook, buyer } = await seedMarketplace();
    const app = await api();
    const variant = await prisma.productVariant.findFirstOrThrow({ where: { productId: tshirt.id, name: "M" } });

    await app.post("/api/v1/cart/items").set("Cookie", buyer.cookie).send({ productId: tshirt.id, variantId: variant.id, quantity: 2 });
    await app.post("/api/v1/cart/items").set("Cookie", buyer.cookie).send({ productId: ebook.id, quantity: 1 });

    // Physical products require a delivery address.
    const noAddress = await app.post("/api/v1/orders").set("Cookie", buyer.cookie).send({});
    expect(noAddress.status).toBe(400);

    const order = await app
      .post("/api/v1/orders")
      .set("Cookie", buyer.cookie)
      .send({
        shippingAddress: {
          recipientName: "Acheteur Dupont",
          phone: "+237690000000",
          city: "Douala",
          area: "Bonapriso",
        },
      });
    expect(order.status).toBe(201);

    const created = order.body.data;
    expect(created.order.reference).toMatch(/^PHX-CMD-/);
    expect(created.order.subtotal).toBe(7500 * 2 + 3500);
    expect(created.transaction.status).toBe("PENDING");

    // Snapshots and digital key present on items.
    const items = created.order.items as Array<{ productName: string; digitalStorageKey: string | null }>;
    expect(items.find((item) => item.productName === tshirt.name)?.digitalStorageKey).toBeNull();
    expect(items.find((item) => item.productName === ebook.name)?.digitalStorageKey).toBe("test-ebook.pdf");

    // Cart is emptied after checkout.
    const cart = await app.get("/api/v1/cart").set("Cookie", buyer.cookie);
    expect(cart.body.data.items).toHaveLength(0);
  });

  it("marks the order paid through the webhook, decrements stock and protects downloads", async () => {
    const { tshirt, ebook, buyer } = await seedMarketplace();
    const app = await api();
    const variant = await prisma.productVariant.findFirstOrThrow({ where: { productId: tshirt.id, name: "M" } });

    await app.post("/api/v1/cart/items").set("Cookie", buyer.cookie).send({ productId: tshirt.id, variantId: variant.id, quantity: 1 });
    await app.post("/api/v1/cart/items").set("Cookie", buyer.cookie).send({ productId: ebook.id, quantity: 1 });
    const order = await app
      .post("/api/v1/orders")
      .set("Cookie", buyer.cookie)
      .send({
        shippingAddress: { recipientName: "Acheteur", phone: "+237690000001", city: "Yaoundé" },
      });

    const orderId = order.body.data.order.id as string;
    const paymentReference = order.body.data.transaction.reference as string;
    const digitalItem = (order.body.data.order.items as Array<{ id: string; productType: string }>).find(
      (item) => item.productType === "DIGITAL",
    )!;

    // Downloads are forbidden before payment.
    const before = await app.get(`/api/v1/orders/${orderId}/items/${digitalItem.id}/download`).set("Cookie", buyer.cookie);
    expect(before.status).toBe(403);

    const stockBefore = await prisma.product.findUniqueOrThrow({ where: { id: tshirt.id }, select: { stock: true } });

    // Signed webhook pays the transaction → order becomes PAID.
    const payload = JSON.stringify({ reference: paymentReference, providerReference: "PROV-MKT", status: "SUCCESS" });
    const signature = createHmac("sha256", env.PAYMENT_WEBHOOK_SECRET).update(payload).digest("hex");
    const confirmed = await app
      .post("/api/v1/payments/webhook/simulated")
      .set("Content-Type", "application/json")
      .set("x-phoenix-signature", signature)
      .send(payload);
    expect(confirmed.status).toBe(200);

    const paid = await app.get(`/api/v1/orders/${orderId}`).set("Cookie", buyer.cookie);
    expect(paid.body.data.status).toBe("PAID");

    const stockAfter = await prisma.product.findUniqueOrThrow({ where: { id: tshirt.id }, select: { stock: true } });
    expect(stockAfter.stock).toBe(stockBefore.stock! - 1);

    // Authorized download works after payment.
    const download = await app.get(`/api/v1/orders/${orderId}/items/${digitalItem.id}/download`).set("Cookie", buyer.cookie);
    expect(download.status).toBe(200);

    // Another user cannot download someone else's digital purchase.
    const mallory = await createUser("Mallory", uniqueEmail("mallory-mkt"));
    const stolen = await app.get(`/api/v1/orders/${orderId}/items/${digitalItem.id}/download`).set("Cookie", mallory.cookie);
    expect(stolen.status).toBe(404);

    // Orders are private.
    const foreignOrder = await app.get(`/api/v1/orders/${orderId}`).set("Cookie", mallory.cookie);
    expect(foreignOrder.status).toBe(404);
  });

  it("keeps digital-only carts address-free", async () => {
    const { ebook, buyer } = await seedMarketplace();
    const app = await api();
    await app.post("/api/v1/cart/items").set("Cookie", buyer.cookie).send({ productId: ebook.id, quantity: 1 });
    const order = await app.post("/api/v1/orders").set("Cookie", buyer.cookie).send({});
    expect(order.status).toBe(201);
    expect(order.body.data.order.address).toBeNull();
  });
});
