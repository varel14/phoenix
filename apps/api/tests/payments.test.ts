import { beforeAll, describe, expect, it } from "vitest";
import { createHmac } from "node:crypto";
import { api, createUser, uniqueEmail } from "./helpers.js";
import { prisma } from "../src/config/prisma.js";
import { env } from "../src/config/env.js";

let seedCounter = 0;

async function seedPaymentService() {
  seedCounter += 1;
  const category = await prisma.paymentCategory.create({
    data: { name: "Frais scolaires", slug: `test-frais-${seedCounter}` },
  });
  const service = await prisma.paymentService.create({
    data: {
      categoryId: category.id,
      name: `Frais de scolarité — Lycée Phoenix ${seedCounter}`,
      pricingMode: "FIXED",
      fixedPrice: 25000,
      fields: {
        create: [
          { key: "studentName", label: "Nom de l'élève", type: "TEXT", sortOrder: 0 },
          { key: "studentClass", label: "Classe", type: "TEXT", sortOrder: 1 },
        ],
      },
    },
  });
  return { category, service };
}

function sign(payload: unknown): { body: string; signature: string } {
  const body = JSON.stringify(payload);
  return { body, signature: createHmac("sha256", env.PAYMENT_WEBHOOK_SECRET).update(body).digest("hex") };
}

describe("Payments", () => {
  beforeAll(async () => {
    await prisma.$executeRawUnsafe(
      `TRUNCATE payment_categories, payment_services, payment_service_fields,
       payment_transactions, payment_receipts, orders, order_items, order_addresses CASCADE`,
    );
  });

  it("lists the catalog publicly and exposes dynamic fields", async () => {
    const { service } = await seedPaymentService();
    const app = await api();

    const categories = await app.get("/api/v1/payment-categories");
    expect(categories.status).toBe(200);
    expect(categories.body.data.some((c: { slug: string }) => c.slug.startsWith("test-frais-"))).toBe(true);

    const services = await app.get("/api/v1/payment-services");
    expect(services.status).toBe(200);
    expect(services.body.data.some((s: { id: string }) => s.id === service.id)).toBe(true);

    const detail = await app.get(`/api/v1/payment-services/${service.id}`);
    expect(detail.status).toBe(200);
    expect(detail.body.data.fields).toHaveLength(2);
  });

  it("creates a pending transaction with validated fields", async () => {
    const { service } = await seedPaymentService();
    const user = await createUser("Payer", uniqueEmail("payer"));
    const app = await api();

    const res = await app
      .post("/api/v1/payments")
      .set("Cookie", user.cookie)
      .send({
        serviceId: service.id,
        fields: { studentName: "Jean Élève", studentClass: "Terminale S" },
      });
    expect(res.status).toBe(201);
    expect(res.body.data.transaction.status).toBe("PENDING");
    expect(res.body.data.transaction.amount).toBe(25000);
    expect(res.body.data.transaction.reference).toMatch(/^PHX-PAY-/);

    // Required field missing → 400.
    const missing = await app
      .post("/api/v1/payments")
      .set("Cookie", user.cookie)
      .send({ serviceId: service.id, fields: { studentClass: "Terminale S" } });
    expect(missing.status).toBe(400);

    // Amount tampering on a FIXED service → 400.
    const tampered = await app
      .post("/api/v1/payments")
      .set("Cookie", user.cookie)
      .send({ serviceId: service.id, amount: 100, fields: { studentName: "X", studentClass: "Y" } });
    expect(tampered.status).toBe(400);
  });

  it("rejects an invalid service id", async () => {
    const user = await createUser("Payer", uniqueEmail("payer-invalid"));
    const app = await api();
    const res = await app
      .post("/api/v1/payments")
      .set("Cookie", user.cookie)
      .send({ serviceId: "5c1f3a52-9d3e-4e79-9bb5-33aa4d64a862", fields: {} });
    expect(res.status).toBe(404);
  });

  it("confirms payments only through a signed webhook and stays idempotent", async () => {
    const { service } = await seedPaymentService();
    const user = await createUser("Payer", uniqueEmail("payer-webhook"));
    const app = await api();

    const created = await app
      .post("/api/v1/payments")
      .set("Cookie", user.cookie)
      .send({ serviceId: service.id, fields: { studentName: "A", studentClass: "B" } });
    const reference = created.body.data.transaction.reference as string;

    // Unsigned webhook → 401.
    const unsigned = await app
      .post("/api/v1/payments/webhook/simulated")
      .send({ reference, status: "SUCCESS" });
    expect(unsigned.status).toBe(401);

    // Bad signature → 401.
    const badSignature = await app
      .post("/api/v1/payments/webhook/simulated")
      .set("x-phoenix-signature", "deadbeef")
      .send({ reference, status: "SUCCESS" });
    expect(badSignature.status).toBe(401);

    // Correctly signed webhook → success + receipt.
    const signed = sign({ reference, providerReference: "PROV-1", status: "SUCCESS", method: "mobile-money" });
    const confirmed = await app
      .post("/api/v1/payments/webhook/simulated")
      .set("Content-Type", "application/json")
      .set("x-phoenix-signature", signed.signature)
      .send(signed.body);
    expect(confirmed.status).toBe(200);
    expect(confirmed.body.data.status).toBe("SUCCESS");
    expect(confirmed.body.data.duplicate).toBe(false);

    // Duplicate webhook replay → idempotent, receipt not duplicated.
    const replay = await app
      .post("/api/v1/payments/webhook/simulated")
      .set("Content-Type", "application/json")
      .set("x-phoenix-signature", signed.signature)
      .send(signed.body);
    expect(replay.status).toBe(200);
    expect(replay.body.data.duplicate).toBe(true);

    const receipt = await prisma.paymentReceipt.count({ where: { transaction: { reference } } });
    expect(receipt).toBe(1);
  });

  it("marks failed payments through the webhook", async () => {
    const { service } = await seedPaymentService();
    const user = await createUser("Payer", uniqueEmail("payer-fail"));
    const app = await api();
    const created = await app
      .post("/api/v1/payments")
      .set("Cookie", user.cookie)
      .send({ serviceId: service.id, fields: { studentName: "A", studentClass: "B" } });
    const reference = created.body.data.transaction.reference as string;

    const failed = sign({ reference, status: "FAILED" });
    const res = await app
      .post("/api/v1/payments/webhook/simulated")
      .set("Content-Type", "application/json")
      .set("x-phoenix-signature", failed.signature)
      .send(failed.body);
    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe("FAILED");
  });

  it("hides other users' transactions", async () => {
    const { service } = await seedPaymentService();
    const alice = await createUser("Alice", uniqueEmail("alice-pay"));
    const bob = await createUser("Bob", uniqueEmail("bob-pay"));
    const app = await api();

    const created = await app
      .post("/api/v1/payments")
      .set("Cookie", alice.cookie)
      .send({ serviceId: service.id, fields: { studentName: "A", studentClass: "B" } });
    const transactionId = created.body.data.transaction.id as string;

    const forbidden = await app.get(`/api/v1/payments/${transactionId}`).set("Cookie", bob.cookie);
    expect(forbidden.status).toBe(404);

    const own = await app.get(`/api/v1/payments/${transactionId}`).set("Cookie", alice.cookie);
    expect(own.status).toBe(200);
  });

  it("lists transactions with French-ready status data", async () => {
    const user = await createUser("Payer", uniqueEmail("payer-list"));
    const app = await api();
    const res = await app.get("/api/v1/payments").set("Cookie", user.cookie);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
  });
});
