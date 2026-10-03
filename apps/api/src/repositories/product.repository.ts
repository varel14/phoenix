import type { Prisma } from "./../generated/prisma/client.js";
import { prisma } from "../config/prisma.js";
import type { ListProductsQuery } from "../validators/product.schema.js";

export const productCardInclude = {
  category: true,
  seller: { select: { id: true, name: true, isVerified: true } },
  images: { orderBy: { position: "asc" as const } },
} as const;

export const productDetailInclude = {
  ...productCardInclude,
  variants: { where: { isActive: true }, orderBy: { createdAt: "asc" as const } },
} as const;

export type ProductCard = Prisma.ProductGetPayload<{ include: typeof productCardInclude }>;
export type ProductDetail = Prisma.ProductGetPayload<{ include: typeof productDetailInclude }>;

const SORT_RECENT: Prisma.ProductOrderByWithRelationInput[] = [{ publishedAt: "desc" }];
const SORT_PRICE_ASC: Prisma.ProductOrderByWithRelationInput[] = [{ price: "asc" }];
const SORT_PRICE_DESC: Prisma.ProductOrderByWithRelationInput[] = [{ price: "desc" }];

function sortFor(sort: string): Prisma.ProductOrderByWithRelationInput[] {
  switch (sort) {
    case "price_asc":
      return SORT_PRICE_ASC;
    case "price_desc":
      return SORT_PRICE_DESC;
    default:
      return SORT_RECENT;
  }
}

export const productRepository = {
  async findMany(query: ListProductsQuery): Promise<{ products: ProductCard[]; total: number }> {
    const where: Prisma.ProductWhereInput = {
      isActive: true,
      category: { isActive: true },
      publishedAt: { lte: new Date() },
      ...(query.categoryId ? { categoryId: query.categoryId } : {}),
      ...(query.type ? { type: query.type } : {}),
      ...(query.search ? { name: { contains: query.search, mode: "insensitive" } } : {}),
      ...(query.minPrice != null || query.maxPrice != null
        ? {
            price: {
              ...(query.minPrice != null ? { gte: query.minPrice } : {}),
              ...(query.maxPrice != null ? { lte: query.maxPrice } : {}),
            },
          }
        : {}),
      ...(query.inStock
        ? { OR: [{ type: "DIGITAL" as const }, { stock: null }, { stock: { gt: 0 } }] }
        : {}),
    };
    const [products, total] = await Promise.all([
      prisma.product.findMany({
        where,
        include: productCardInclude,
        orderBy: sortFor(query.sort),
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      }),
      prisma.product.count({ where }),
    ]);
    return { products, total };
  },

  async findDetailById(id: string): Promise<ProductDetail | null> {
    return prisma.product.findFirst({
      where: {
        id,
        isActive: true,
        category: { isActive: true },
        publishedAt: { lte: new Date() },
      },
      include: productDetailInclude,
    });
  },

  async findByIdRef(id: string) {
    return prisma.product.findUnique({
      where: { id },
      select: { id: true, sellerId: true, isActive: true, type: true, price: true, stock: true },
    });
  },

  async findCategoryById(id: string) {
    return prisma.productCategory.findFirst({ where: { id, isActive: true } });
  },

  async findCategories() {
    return prisma.productCategory.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: "asc" },
    });
  },

  async create(sellerId: string, data: Prisma.ProductUncheckedCreateInput) {
    return prisma.product.create({ data, include: productDetailInclude });
  },

  async findOwnedById(id: string) {
    return prisma.product.findUnique({
      where: { id },
      include: { seller: { select: { id: true, userId: true } } },
    });
  },

  async update(id: string, data: Prisma.ProductUncheckedUpdateInput) {
    return prisma.product.update({ where: { id }, data, include: productDetailInclude });
  },

  async remove(id: string): Promise<void> {
    await prisma.product.delete({ where: { id } });
  },
};
