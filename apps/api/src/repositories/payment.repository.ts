import type { Prisma } from "./../generated/prisma/client.js";
import { prisma } from "../config/prisma.js";

export const paymentServiceFieldInclude = { fields: { orderBy: { sortOrder: "asc" as const } } } as const;

export type PaymentServiceWithFields = Prisma.PaymentServiceGetPayload<{ include: typeof paymentServiceFieldInclude }>;

export type PaymentTransactionWithRelations = Prisma.PaymentTransactionGetPayload<{
  include: {
    service: { include: { category: true } };
    receipt: true;
    order: { include: { items: true } };
  };
}>;

export const paymentRepository = {
  // ------------------------------------------------------------- catalog
  async findCategories() {
    return prisma.paymentCategory.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: "asc" },
    });
  },

  async findCategoryBySlug(slug: string) {
    return prisma.paymentCategory.findUnique({ where: { slug } });
  },

  async findServices(options: { categoryId?: string | undefined }) {
    const where: Prisma.PaymentServiceWhereInput = {
      isActive: true,
      category: { isActive: true },
      ...(options.categoryId ? { categoryId: options.categoryId } : {}),
    };
    return prisma.paymentService.findMany({
      where,
      include: { category: true },
      orderBy: { name: "asc" },
    });
  },

  async findServiceById(id: string): Promise<PaymentServiceWithFields | null> {
    return prisma.paymentService.findFirst({
      where: { id, isActive: true, category: { isActive: true } },
      include: paymentServiceFieldInclude,
    });
  },

  // --------------------------------------------------------- transactions
  async findTransactionById(id: string): Promise<PaymentTransactionWithRelations | null> {
    return prisma.paymentTransaction.findUnique({
      where: { id },
      include: {
        service: { include: { category: true } },
        receipt: true,
        order: { include: { items: true } },
      },
    });
  },

  async findTransactionByReference(reference: string): Promise<PaymentTransactionWithRelations | null> {
    return prisma.paymentTransaction.findUnique({
      where: { reference },
      include: {
        service: { include: { category: true } },
        receipt: true,
        order: { include: { items: true } },
      },
    });
  },

  async findTransactionsByUser(
    userId: string,
    options: { page: number; limit: number; status?: string | undefined },
  ): Promise<PaymentTransactionWithRelations[]> {
    const where: Prisma.PaymentTransactionWhereInput = {
      userId,
      ...(options.status ? { status: options.status as never } : {}),
    };
    return prisma.paymentTransaction.findMany({
      where,
      include: {
        service: { include: { category: true } },
        receipt: true,
        order: { include: { items: true } },
      },
      orderBy: { createdAt: "desc" },
      skip: (options.page - 1) * options.limit,
      take: options.limit,
    });
  },

  async countTransactionsByUser(userId: string, status?: string | undefined): Promise<number> {
    return prisma.paymentTransaction.count({
      where: { userId, ...(status ? { status: status as never } : {}) },
    });
  },
};
