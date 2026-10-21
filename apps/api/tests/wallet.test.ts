import { beforeAll, describe, expect, it } from "vitest";
import { api, createUser, uniqueEmail } from "./helpers.js";
import { prisma } from "../src/config/prisma.js";

async function makeContact(me: { cookie: string }, otherId: string) {
  const app = await api();
  await app
    .post("/api/v1/conversations")
    .set("Cookie", me.cookie)
    .send({ recipientId: otherId });
}

describe("Wallet", () => {
  beforeAll(async () => {
    await prisma.$executeRawUnsafe(
      `TRUNCATE users, sessions, accounts, verifications,
       conversations, conversation_participants, messages, message_attachments, calls,
       wallets, wallet_transactions CASCADE`,
    );
  });

  it("lazily creates a zero-balance wallet on first read", async () => {
    const user = await createUser("Nina", uniqueEmail("nina-wallet"));
    const app = await api();

    const res = await app.get("/api/v1/wallet").set("Cookie", user.cookie);
    expect(res.status).toBe(200);
    expect(res.body.data.wallet.balance).toBe(0);
    expect(res.body.data.wallet.currency).toBe("XOF");

    // Second read returns the same wallet — no duplicate creation.
    const again = await app.get("/api/v1/wallet").set("Cookie", user.cookie);
    expect(again.body.data.wallet.id).toBe(res.body.data.wallet.id);
  });

  it("requires authentication", async () => {
    const app = await api();
    expect((await app.get("/api/v1/wallet")).status).toBe(401);
    expect(
      (await app.post("/api/v1/wallet/topups").send({ amount: 1000 })).status,
    ).toBe(401);
    expect(
      (
        await app
          .post("/api/v1/wallet/transfers")
          .send({ recipientId: "x", amount: 100 })
      ).status,
    ).toBe(401);
  });

  it("tops up only after confirmation, idempotently", async () => {
    const user = await createUser("Tina", uniqueEmail("tina-topup"));
    const app = await api();

    const initiated = await app
      .post("/api/v1/wallet/topups")
      .set("Cookie", user.cookie)
      .send({ amount: 10_000 });
    expect(initiated.status).toBe(201);
    expect(initiated.body.data.transaction.status).toBe("PENDING");
    expect(initiated.body.data.transaction.reference).toMatch(/^PHX-WAL-/);

    // Balance is untouched while the top-up is pending.
    const pending = await app.get("/api/v1/wallet").set("Cookie", user.cookie);
    expect(pending.body.data.wallet.balance).toBe(0);

    // Another user cannot confirm someone else's top-up.
    const stranger = await createUser(
      "Stranger",
      uniqueEmail("stranger-topup"),
    );
    const forbidden = await app
      .post(
        `/api/v1/wallet/topups/${initiated.body.data.transaction.reference}/dev-confirm`,
      )
      .set("Cookie", stranger.cookie);
    expect(forbidden.status).toBe(404);

    // The owner confirms through the dev pipeline → balance credited.
    const confirmed = await app
      .post(
        `/api/v1/wallet/topups/${initiated.body.data.transaction.reference}/dev-confirm`,
      )
      .set("Cookie", user.cookie);
    expect(confirmed.status).toBe(200);
    expect(confirmed.body.data.transaction.status).toBe("SUCCESS");
    expect(confirmed.body.data.transaction.balanceAfter).toBe(10_000);
    expect(confirmed.body.data.wallet.balance).toBe(10_000);
    expect(confirmed.body.data.duplicate).toBe(false);

    // Replay is idempotent: balance credited exactly once.
    const replay = await app
      .post(
        `/api/v1/wallet/topups/${initiated.body.data.transaction.reference}/dev-confirm`,
      )
      .set("Cookie", user.cookie);
    expect(replay.status).toBe(200);
    expect(replay.body.data.duplicate).toBe(true);
    expect(replay.body.data.wallet.balance).toBe(10_000);

    // Sub-100 amounts are rejected by validation.
    const tooSmall = await app
      .post("/api/v1/wallet/topups")
      .set("Cookie", user.cookie)
      .send({ amount: 50 });
    expect(tooSmall.status).toBe(400);
  });

  it("moves money atomically between wallets and writes both ledger legs", async () => {
    const alice = await createUser("Alice", uniqueEmail("alice-send"));
    const bob = await createUser("Bob", uniqueEmail("bob-send"));
    const app = await api();

    const topup = await app
      .post("/api/v1/wallet/topups")
      .set("Cookie", alice.cookie)
      .send({ amount: 20_000 });
    await app
      .post(
        `/api/v1/wallet/topups/${topup.body.data.transaction.reference}/dev-confirm`,
      )
      .set("Cookie", alice.cookie);

    const sent = await app
      .post("/api/v1/wallet/transfers")
      .set("Cookie", alice.cookie)
      .send({ recipientId: bob.userId, amount: 7_500, note: "Merci !" });
    expect(sent.status).toBe(201);
    expect(sent.body.data.transaction.type).toBe("TRANSFER_OUT");
    expect(sent.body.data.transaction.balanceAfter).toBe(12_500);
    expect(sent.body.data.wallet.balance).toBe(12_500);
    expect(sent.body.data.transaction.counterparty.id).toBe(bob.userId);

    const bobWallet = await app.get("/api/v1/wallet").set("Cookie", bob.cookie);
    expect(bobWallet.body.data.wallet.balance).toBe(7_500);

    // Both legs share the transfer reference.
    const legs = await prisma.walletTransaction.findMany({
      where: { transferRef: sent.body.data.transaction.transferRef },
    });
    expect(legs).toHaveLength(2);
    expect(legs.map((l) => l.type).sort()).toEqual([
      "TRANSFER_IN",
      "TRANSFER_OUT",
    ]);
  });

  it("rejects bad transfers: insufficient funds, self, unknown recipient", async () => {
    const alice = await createUser("Alice2", uniqueEmail("alice2-send"));
    const bob = await createUser("Bob2", uniqueEmail("bob2-send"));
    const app = await api();

    const topup = await app
      .post("/api/v1/wallet/topups")
      .set("Cookie", alice.cookie)
      .send({ amount: 1_000 });
    await app
      .post(
        `/api/v1/wallet/topups/${topup.body.data.transaction.reference}/dev-confirm`,
      )
      .set("Cookie", alice.cookie);

    const broke = await app
      .post("/api/v1/wallet/transfers")
      .set("Cookie", alice.cookie)
      .send({ recipientId: bob.userId, amount: 999_999 });
    expect(broke.status).toBe(422);

    // Failed transfer leaves the balance untouched.
    const after = await app.get("/api/v1/wallet").set("Cookie", alice.cookie);
    expect(after.body.data.wallet.balance).toBe(1_000);

    const self = await app
      .post("/api/v1/wallet/transfers")
      .set("Cookie", alice.cookie)
      .send({ recipientId: alice.userId, amount: 100 });
    expect(self.status).toBe(400);

    const ghost = await app
      .post("/api/v1/wallet/transfers")
      .set("Cookie", alice.cookie)
      .send({
        recipientId: "5c1f3a52-9d3e-4e79-9bb5-33aa4d64a862",
        amount: 100,
      });
    expect(ghost.status).toBe(404);

    const zero = await app
      .post("/api/v1/wallet/transfers")
      .set("Cookie", alice.cookie)
      .send({ recipientId: bob.userId, amount: 0 });
    expect(zero.status).toBe(400);
  });

  it("lists the ledger with filters and pagination", async () => {
    const user = await createUser("Léa", uniqueEmail("lea-ledger"));
    const other = await createUser("Marc", uniqueEmail("marc-ledger"));
    const app = await api();

    const topup = await app
      .post("/api/v1/wallet/topups")
      .set("Cookie", user.cookie)
      .send({ amount: 5_000 });
    const reference = topup.body.data.transaction.reference as string;
    await app
      .post(`/api/v1/wallet/topups/${reference}/dev-confirm`)
      .set("Cookie", user.cookie);
    await app
      .post("/api/v1/wallet/transfers")
      .set("Cookie", user.cookie)
      .send({ recipientId: other.userId, amount: 1_000 });

    const all = await app
      .get("/api/v1/wallet/transactions")
      .set("Cookie", user.cookie);
    expect(all.status).toBe(200);
    expect(all.body.data).toHaveLength(2);
    expect(all.body.pagination.total).toBe(2);

    const onlyTopups = await app
      .get("/api/v1/wallet/transactions?type=TOPUP")
      .set("Cookie", user.cookie);
    expect(onlyTopups.body.data).toHaveLength(1);
    expect(onlyTopups.body.data[0].type).toBe("TOPUP");

    // Ledger rows expose the counterparty's public profile.
    const outs = await app
      .get("/api/v1/wallet/transactions?type=TRANSFER_OUT")
      .set("Cookie", user.cookie);
    expect(outs.body.data[0].counterparty.name).toBe("Marc");
    expect(outs.body.data[0].note).toBeNull();

    // Detail by id, scoped to the owner.
    const detail = await app
      .get(`/api/v1/wallet/transactions/${all.body.data[0].id}`)
      .set("Cookie", user.cookie);
    expect(detail.status).toBe(200);
    const forbidden = await app
      .get(`/api/v1/wallet/transactions/${all.body.data[0].id}`)
      .set("Cookie", other.cookie);
    expect(forbidden.status).toBe(404);
  });

  it("suggests chat contacts and recent counterparties as recipients", async () => {
    const nina = await createUser("Nina", uniqueEmail("nina-recip"));
    const koffi = await createUser("David Koffi", uniqueEmail("david-recip"));
    const aloof = await createUser(
      "Aloof Stranger",
      uniqueEmail("aloof-recip"),
    );
    const app = await api();

    // Koffi is a chat contact; a transfer makes him a recent counterparty too.
    await makeContact(nina, koffi.userId);
    const topup = await app
      .post("/api/v1/wallet/topups")
      .set("Cookie", nina.cookie)
      .send({ amount: 500 });
    await app
      .post(
        `/api/v1/wallet/topups/${topup.body.data.transaction.reference}/dev-confirm`,
      )
      .set("Cookie", nina.cookie);
    await app
      .post("/api/v1/wallet/transfers")
      .set("Cookie", nina.cookie)
      .send({ recipientId: koffi.userId, amount: 100 });

    const noSearch = await app
      .get("/api/v1/wallet/recipients")
      .set("Cookie", nina.cookie);
    expect(noSearch.status).toBe(200);
    const ids = noSearch.body.data.map((r: { id: string }) => r.id);
    expect(ids).toContain(koffi.userId);
    expect(ids).not.toContain(nina.userId); // never yourself
    expect(ids).not.toContain(aloof.userId); // strangers stay out without a search

    const searched = await app
      .get("/api/v1/wallet/recipients?search=Aloof")
      .set("Cookie", nina.cookie);
    expect(searched.body.data.map((r: { id: string }) => r.id)).toContain(
      aloof.userId,
    );
  });
});
